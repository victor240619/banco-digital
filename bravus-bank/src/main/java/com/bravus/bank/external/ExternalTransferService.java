package com.bravus.bank.external;

import com.bravus.bank.compliance.DocumentAnalysisService;
import com.bravus.bank.db.entity.TransactionEntity;
import com.bravus.bank.db.entity.UserEntity;
import com.bravus.bank.db.repo.TransactionRepository;
import com.bravus.bank.db.repo.UserRepository;
import com.bravus.bank.ledger.repo.CreditGrantRepository;
import com.bravus.bank.ledger.service.CreditService;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class ExternalTransferService {
    private final ExternalTransferRepository transferRepo;
    private final UserRepository userRepo;
    private final TransactionRepository transactionRepo;
    private final CreditGrantRepository grantRepo;
    private final CreditService creditService;
    private final BankingTransferProvider bankingProvider;
    private final DocumentAnalysisService documentAnalysisService;

    public ExternalTransferService(ExternalTransferRepository transferRepo,
                                   UserRepository userRepo,
                                   TransactionRepository transactionRepo,
                                   CreditGrantRepository grantRepo,
                                   CreditService creditService,
                                   BankingTransferProvider bankingProvider,
                                   DocumentAnalysisService documentAnalysisService) {
        this.transferRepo = transferRepo;
        this.userRepo = userRepo;
        this.transactionRepo = transactionRepo;
        this.grantRepo = grantRepo;
        this.creditService = creditService;
        this.bankingProvider = bankingProvider;
        this.documentAnalysisService = documentAnalysisService;
    }

    @Transactional(isolation = Isolation.SERIALIZABLE)
    public ExternalTransferEntity submit(ExternalTransferCommand cmd, String adminUsername) {
        if (!bankingProvider.isConfigured()) {
            throw new IllegalStateException(
                    "Gateway bancario proprio nao configurado. Defina BRAVUS_BANKING_PROVIDER_URL/TOKEN.");
        }
        if (cmd.amountCentavos == null || cmd.amountCentavos <= 0) {
            throw new IllegalArgumentException("Valor deve ser positivo.");
        }

        String channel = upper(cmd.channel);
        if (!"PIX".equals(channel) && !"TED".equals(channel)) {
            throw new IllegalArgumentException("Canal deve ser PIX ou TED.");
        }
        if ("PIX".equals(channel) && blank(cmd.pixKey)) {
            throw new IllegalArgumentException("Informe a chave PIX para transferencia PIX.");
        }
        if ("TED".equals(channel) && (blank(cmd.bankCode) || blank(cmd.agency) || blank(cmd.accountNumber))) {
            throw new IllegalArgumentException("Informe banco, agencia e conta para TED.");
        }

        UserEntity user = userRepo.findById(cmd.userId)
                .orElseThrow(() -> new IllegalArgumentException("Usuario nao encontrado: " + cmd.userId));
        UserEntity admin = userRepo.findByUsername(adminUsername).orElse(null);
        documentAnalysisService.assertApprovedForUser(user);

        DocumentAnalysisService.AnalysisCommand beneficiaryAnalysis =
                new DocumentAnalysisService.AnalysisCommand();
        beneficiaryAnalysis.document = cmd.beneficiaryDocument;
        beneficiaryAnalysis.subjectName = cmd.beneficiaryName;
        documentAnalysisService.assertApproved(beneficiaryAnalysis, adminUsername, "o beneficiario da transferencia");

        Long availableCredit = grantRepo.sumAvailableByUser(user.getId());
        if (availableCredit == null || availableCredit < cmd.amountCentavos) {
            throw new IllegalStateException("Saldo escritural liberado insuficiente.");
        }
        if (user.getBalance() == null || user.getBalance() < cmd.amountCentavos) {
            throw new IllegalStateException("Saldo contabil do usuario insuficiente.");
        }

        String idempotencyKey = "bravus-" + UUID.randomUUID();
        BankingTransferProvider.ProviderTransferCommand providerCommand = toProviderCommand(cmd, channel, idempotencyKey);
        BankingTransferProvider.ProviderTransferResult providerResult = bankingProvider.submit(providerCommand);
        if ("FAILED".equals(providerResult.status)) {
            throw new IllegalStateException("Gateway bancario recusou a transferencia externa.");
        }

        user.setBalance(user.getBalance() - cmd.amountCentavos);
        userRepo.save(user);

        TransactionEntity tx = new TransactionEntity();
        tx.setUser(user);
        tx.setType("TRANSFER_EXTERNAL");
        tx.setAmount(cmd.amountCentavos);
        tx.setDescription(cmd.description != null ? cmd.description : "Transferencia externa " + channel);
        tx.setDestinationAccount(destinationLabel(cmd));
        tx.setStatus("COMPLETED".equals(providerResult.status) ? "COMPLETED" : "PENDING");
        tx = transactionRepo.save(tx);

        CreditService.UseCommand use = new CreditService.UseCommand();
        use.userId = user.getId();
        use.valor = cmd.amountCentavos;
        use.tipo = "PIX".equals(channel) ? "PIX" : "PAGAMENTO";
        use.transactionId = tx.getId();
        use.criadoPor = adminUsername;
        use.observacao = "Transferencia externa " + channel + " - " + destinationLabel(cmd);
        creditService.useCredit(use);

        ExternalTransferEntity order = new ExternalTransferEntity();
        order.setUser(user);
        order.setRequestedBy(admin);
        order.setTransactionId(tx.getId());
        order.setAmountCentavos(cmd.amountCentavos);
        order.setChannel(channel);
        order.setCurrency("BRL");
        order.setBeneficiaryName(cmd.beneficiaryName);
        order.setBeneficiaryDocument(DocumentUtilsBridge.digits(cmd.beneficiaryDocument));
        order.setBankCode(cmd.bankCode);
        order.setIspb(cmd.ispb);
        order.setAgency(cmd.agency);
        order.setAccountNumber(cmd.accountNumber);
        order.setAccountDigit(cmd.accountDigit);
        order.setAccountType(cmd.accountType);
        order.setPixKey(cmd.pixKey);
        order.setPixKeyType(cmd.pixKeyType);
        order.setDescription(cmd.description);
        order.setProvider(bankingProvider.providerName());
        order.setProviderTransferId(providerResult.providerTransferId);
        order.setIdempotencyKey(idempotencyKey);
        order.setStatus(providerResult.status != null ? providerResult.status : "PROCESSING");
        order.setRawResponse(providerResult.rawResponse);
        return transferRepo.save(order);
    }

    @Transactional(readOnly = true)
    public List<ExternalTransferEntity> recent(int limit) {
        return transferRepo.findAllByOrderByCreatedAtDesc(PageRequest.of(0, Math.max(1, Math.min(limit, 50))));
    }

    private BankingTransferProvider.ProviderTransferCommand toProviderCommand(
            ExternalTransferCommand cmd, String channel, String idempotencyKey) {
        BankingTransferProvider.ProviderTransferCommand pc = new BankingTransferProvider.ProviderTransferCommand();
        pc.idempotencyKey = idempotencyKey;
        pc.channel = channel;
        pc.amountCentavos = cmd.amountCentavos;
        pc.currency = "BRL";
        pc.beneficiaryName = cmd.beneficiaryName;
        pc.beneficiaryDocument = DocumentUtilsBridge.digits(cmd.beneficiaryDocument);
        pc.bankCode = cmd.bankCode;
        pc.ispb = cmd.ispb;
        pc.agency = cmd.agency;
        pc.accountNumber = cmd.accountNumber;
        pc.accountDigit = cmd.accountDigit;
        pc.accountType = cmd.accountType;
        pc.pixKey = cmd.pixKey;
        pc.pixKeyType = cmd.pixKeyType;
        pc.description = cmd.description;
        return pc;
    }

    private String destinationLabel(ExternalTransferCommand cmd) {
        if (!blank(cmd.pixKey)) return "PIX " + cmd.pixKey;
        return (cmd.bankCode == null ? "" : cmd.bankCode) + " ag " + cmd.agency + " cc " + cmd.accountNumber;
    }

    private String upper(String value) {
        return value == null ? "" : value.trim().toUpperCase();
    }

    private boolean blank(String value) {
        return value == null || value.isBlank();
    }

    public static class ExternalTransferCommand {
        public Long userId;
        public Long amountCentavos;
        public String channel;
        public String beneficiaryName;
        public String beneficiaryDocument;
        public String bankCode;
        public String ispb;
        public String agency;
        public String accountNumber;
        public String accountDigit;
        public String accountType;
        public String pixKey;
        public String pixKeyType;
        public String description;
    }

    private static class DocumentUtilsBridge {
        static String digits(String value) {
            return value == null ? "" : value.replaceAll("\\D", "");
        }
    }
}
