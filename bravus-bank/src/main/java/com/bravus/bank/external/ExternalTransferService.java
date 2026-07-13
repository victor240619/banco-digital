package com.bravus.bank.external;

import com.bravus.bank.compliance.DocumentAnalysisService;
import com.bravus.bank.db.entity.TransactionEntity;
import com.bravus.bank.db.entity.UserEntity;
import com.bravus.bank.db.repo.TransactionRepository;
import com.bravus.bank.db.repo.UserRepository;
import com.bravus.bank.globalrail.GlobalRailService;
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
    private final GlobalRailService globalRailService;

    public ExternalTransferService(ExternalTransferRepository transferRepo,
                                   UserRepository userRepo,
                                   TransactionRepository transactionRepo,
                                   CreditGrantRepository grantRepo,
                                   CreditService creditService,
                                   BankingTransferProvider bankingProvider,
                                   DocumentAnalysisService documentAnalysisService,
                                   GlobalRailService globalRailService) {
        this.transferRepo = transferRepo;
        this.userRepo = userRepo;
        this.transactionRepo = transactionRepo;
        this.grantRepo = grantRepo;
        this.creditService = creditService;
        this.bankingProvider = bankingProvider;
        this.documentAnalysisService = documentAnalysisService;
        this.globalRailService = globalRailService;
    }

    @Transactional(isolation = Isolation.SERIALIZABLE)
    public ExternalTransferEntity submit(ExternalTransferCommand cmd, String requestedByUsername) {
        if (cmd.amountCentavos == null || cmd.amountCentavos <= 0) {
            throw new IllegalArgumentException("Valor deve ser positivo.");
        }

        String channel = upper(cmd.channel);
        if (!allowedChannel(channel)) {
            throw new IllegalArgumentException("Canal deve ser PIX, TED, SWIFT, ACH, SEPA, CAYMAN_RAIL ou GLOBAL.");
        }
        if ("PIX".equals(channel) && blank(cmd.pixKey)) {
            throw new IllegalArgumentException("Informe a chave PIX para transferencia PIX.");
        }
        if ("TED".equals(channel) && (blank(cmd.bankCode) || blank(cmd.agency) || blank(cmd.accountNumber))) {
            throw new IllegalArgumentException("Informe banco, agencia e conta para TED.");
        }
        if (!"PIX".equals(channel) && !"TED".equals(channel) && blank(cmd.accountNumber)) {
            throw new IllegalArgumentException("Informe a conta beneficiaria para o canal selecionado.");
        }

        UserEntity user = userRepo.findById(cmd.userId)
                .orElseThrow(() -> new IllegalArgumentException("Usuario nao encontrado: " + cmd.userId));
        UserEntity requestedBy = userRepo.findByUsername(requestedByUsername).orElse(null);
        documentAnalysisService.assertApprovedForUser(user);

        DocumentAnalysisService.AnalysisCommand beneficiaryAnalysis =
                new DocumentAnalysisService.AnalysisCommand();
        beneficiaryAnalysis.document = cmd.beneficiaryDocument;
        beneficiaryAnalysis.subjectName = cmd.beneficiaryName;
        documentAnalysisService.assertApproved(beneficiaryAnalysis, requestedByUsername, "o beneficiario da transferencia");

        Long availableCredit = grantRepo.sumAvailableByUser(user.getId());
        if (availableCredit == null || availableCredit < cmd.amountCentavos) {
            throw new IllegalStateException("Saldo escritural liberado insuficiente.");
        }
        if (user.getBalance() == null || user.getBalance() < cmd.amountCentavos) {
            throw new IllegalStateException("Saldo contabil do usuario insuficiente.");
        }

        String idempotencyKey = "bravus-" + UUID.randomUUID();
        BankingTransferProvider.ProviderTransferCommand providerCommand = toProviderCommand(cmd, channel, idempotencyKey);
        boolean providerConfigured = bankingProvider.isConfigured();
        BankingTransferProvider.ProviderTransferResult providerResult;
        if (providerConfigured) {
            providerResult = bankingProvider.submit(providerCommand);
            if ("FAILED".equals(providerResult.status)) {
                throw new IllegalStateException("Gateway bancario recusou a transferencia externa.");
            }
        } else {
            providerResult = pendingProviderResult();
        }
        GlobalRailService.SettlementDecision settlement = globalRailService.settlementFor(
                cmd, channel, providerConfigured, providerResult, idempotencyKey);

        TransactionEntity tx = new TransactionEntity();
        tx.setUser(user);
        tx.setType("TRANSFER_EXTERNAL");
        tx.setAmount(cmd.amountCentavos);
        tx.setDescription(cmd.description != null ? cmd.description : "Transferencia externa " + channel);
        tx.setDestinationAccount(destinationLabel(cmd));
        tx.setStatus("COMPLETED".equals(providerResult.status) ? "COMPLETED" : "PENDING");
        tx = transactionRepo.save(tx);

        if (providerConfigured) {
            user.setBalance(user.getBalance() - cmd.amountCentavos);
            userRepo.save(user);

            CreditService.UseCommand use = new CreditService.UseCommand();
            use.userId = user.getId();
            use.valor = cmd.amountCentavos;
            use.tipo = "PIX".equals(channel) ? "PIX" : "PAGAMENTO";
            use.transactionId = tx.getId();
            use.criadoPor = requestedByUsername;
            use.observacao = "Transferencia externa " + channel + " - " + destinationLabel(cmd);
            creditService.useCredit(use);
        }

        ExternalTransferEntity order = new ExternalTransferEntity();
        order.setUser(user);
        order.setRequestedBy(requestedBy);
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
        order.setProvider(providerConfigured ? bankingProvider.providerName() : "PROVIDER_NOT_CONFIGURED");
        order.setProviderTransferId(providerResult.providerTransferId);
        order.setIdempotencyKey(idempotencyKey);
        order.setStatus(providerResult.status != null ? providerResult.status : "PROCESSING");
        order.setSettlementStatus(settlement.settlementStatus);
        order.setReceiptKind(settlement.receiptKind);
        order.setDestinationNetwork(settlement.destinationNetwork);
        order.setDestinationParticipantCode(settlement.destinationParticipantCode);
        order.setDestinationConfirmationId(settlement.destinationConfirmationId);
        order.setDestinationConfirmedAt(settlement.destinationConfirmedAt);
        order.setSettlementMessage(settlement.settlementMessage);
        if (!providerConfigured) {
            order.setErrorMessage("Configure BRAVUS_BANKING_PROVIDER_URL/TOKEN para liquidar esta ordem fora do Bravus.");
        }
        order.setRawResponse(providerResult.rawResponse);
        return transferRepo.save(order);
    }

    @Transactional(readOnly = true)
    public List<ExternalTransferEntity> recent(int limit) {
        return transferRepo.findAllByOrderByCreatedAtDesc(PageRequest.of(0, Math.max(1, Math.min(limit, 50))));
    }

    @Transactional(readOnly = true)
    public List<ExternalTransferEntity> recentForUser(Long userId, int limit) {
        return transferRepo.findByUserIdOrderByCreatedAtDesc(
                userId,
                PageRequest.of(0, Math.max(1, Math.min(limit, 50))));
    }

    @Transactional(readOnly = true)
    public ExternalTransferEntity findForUser(Long orderId, Long userId) {
        ExternalTransferEntity order = transferRepo.findById(orderId)
                .orElseThrow(() -> new IllegalArgumentException("Transferencia nao encontrada."));
        if (order.getUser() == null || !order.getUser().getId().equals(userId)) {
            throw new IllegalArgumentException("Transferencia nao encontrada para este usuario.");
        }
        return order;
    }

    private BankingTransferProvider.ProviderTransferResult pendingProviderResult() {
        BankingTransferProvider.ProviderTransferResult result = new BankingTransferProvider.ProviderTransferResult();
        result.status = "PENDING_PROVIDER";
        result.rawResponse = "{\"status\":\"PENDING_PROVIDER\",\"message\":\"Banking provider not configured\"}";
        return result;
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

    private boolean allowedChannel(String channel) {
        return List.of("PIX", "TED", "SWIFT", "ACH", "SEPA", "CAYMAN_RAIL", "GLOBAL").contains(channel);
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
        public String destinationNetwork;
        public String participantCode;
        public String description;
    }

    private static class DocumentUtilsBridge {
        static String digits(String value) {
            return value == null ? "" : value.replaceAll("\\D", "");
        }
    }
}
