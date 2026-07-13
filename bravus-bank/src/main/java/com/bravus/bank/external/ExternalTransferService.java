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
import java.util.Optional;
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

        UserEntity bravusDestination = resolveBravusDestination(cmd).orElse(null);
        if (bravusDestination != null) {
            return submitInternalBravusTransfer(cmd, requestedByUsername, channel, user, requestedBy, bravusDestination);
        }

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
            order.setErrorMessage("Configure BRAVUS_BANKING_PROVIDER_URL/TOKEN ou BRAVUS_BANKING_PROVIDER_MODE=CELCOIN com credenciais Celcoin para liquidar fora do Bravus.");
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
        if (order.getUser() != null && order.getUser().getId().equals(userId)) {
            return order;
        }
        UserEntity viewer = userRepo.findById(userId).orElse(null);
        if (viewer != null && isBeneficiary(order, viewer)) {
            return order;
        }
        if (order.getUser() == null || !order.getUser().getId().equals(userId)) {
            throw new IllegalArgumentException("Transferencia nao encontrada para este usuario.");
        }
        return order;
    }

    private boolean isBeneficiary(ExternalTransferEntity order, UserEntity viewer) {
        String viewerCpf = DocumentUtilsBridge.digits(viewer.getCpf());
        String orderDocument = DocumentUtilsBridge.digits(order.getBeneficiaryDocument());
        if (!viewerCpf.isBlank() && viewerCpf.equals(orderDocument)) return true;
        if (order.getAccountNumber() != null && order.getAccountNumber().equals(viewer.getAccountNumber())) return true;
        if (order.getPixKey() != null && order.getPixKey().equalsIgnoreCase(viewer.getEmail())) return true;
        return !viewerCpf.isBlank() && order.getPixKey() != null
                && viewerCpf.equals(DocumentUtilsBridge.digits(order.getPixKey()));
    }

    private BankingTransferProvider.ProviderTransferResult pendingProviderResult() {
        BankingTransferProvider.ProviderTransferResult result = new BankingTransferProvider.ProviderTransferResult();
        result.status = "PENDING_PROVIDER";
        result.rawResponse = "{\"status\":\"PENDING_PROVIDER\",\"message\":\"Banking provider not configured\"}";
        return result;
    }

    private ExternalTransferEntity submitInternalBravusTransfer(ExternalTransferCommand cmd,
                                                               String requestedByUsername,
                                                               String channel,
                                                               UserEntity fromUser,
                                                               UserEntity requestedBy,
                                                               UserEntity toUser) {
        if (fromUser.getId().equals(toUser.getId())) {
            throw new IllegalArgumentException("Nao e permitido transferir para a propria conta Bravus.");
        }
        if (fromUser.getBalance() == null || fromUser.getBalance() < cmd.amountCentavos) {
            throw new IllegalStateException("Saldo contabil do usuario insuficiente.");
        }

        String idempotencyKey = "bravus-internal-" + UUID.randomUUID();

        fromUser.setBalance(fromUser.getBalance() - cmd.amountCentavos);
        toUser.setBalance((toUser.getBalance() == null ? 0L : toUser.getBalance()) + cmd.amountCentavos);
        userRepo.save(fromUser);
        userRepo.save(toUser);

        TransactionEntity outTx = new TransactionEntity();
        outTx.setUser(fromUser);
        outTx.setType("TRANSFER_OUT");
        outTx.setAmount(cmd.amountCentavos);
        outTx.setDescription(cmd.description != null ? cmd.description : "Transferencia interna Bravus");
        outTx.setDestinationAccount(toUser.getAccountNumber());
        outTx.setStatus("COMPLETED");
        outTx = transactionRepo.save(outTx);

        consumeCreditIfAvailable(
                fromUser,
                cmd.amountCentavos,
                outTx.getId(),
                requestedByUsername,
                "Transferencia interna Bravus para " + toUser.getAccountNumber());

        TransactionEntity inTx = new TransactionEntity();
        inTx.setUser(toUser);
        inTx.setType("TRANSFER_IN");
        inTx.setAmount(cmd.amountCentavos);
        inTx.setDescription(cmd.description != null ? cmd.description : "Transferencia recebida Bravus");
        inTx.setDestinationAccount(fromUser.getAccountNumber());
        inTx.setStatus("COMPLETED");
        transactionRepo.save(inTx);

        ExternalTransferEntity order = new ExternalTransferEntity();
        order.setUser(fromUser);
        order.setRequestedBy(requestedBy);
        order.setTransactionId(outTx.getId());
        order.setAmountCentavos(cmd.amountCentavos);
        order.setChannel(channel);
        order.setCurrency("BRL");
        order.setBeneficiaryName(toUser.getFullName() != null ? toUser.getFullName() : cmd.beneficiaryName);
        order.setBeneficiaryDocument(DocumentUtilsBridge.digits(
                toUser.getCpf() != null ? toUser.getCpf() : cmd.beneficiaryDocument));
        order.setBankCode("999");
        order.setIspb("99999999");
        order.setAgency("0001");
        order.setAccountNumber(toUser.getAccountNumber());
        order.setAccountDigit(cmd.accountDigit);
        order.setAccountType(toUser.getAccountType() != null ? toUser.getAccountType() : "CORRENTE");
        order.setPixKey(toUser.getChavePix() != null ? toUser.getChavePix() : cmd.pixKey);
        order.setPixKeyType(cmd.pixKeyType);
        order.setDescription(cmd.description);
        order.setProvider("BRAVUS_INTERNAL_LEDGER");
        order.setProviderTransferId(idempotencyKey);
        order.setIdempotencyKey(idempotencyKey);
        order.setStatus("COMPLETED");
        order.setSettlementStatus("LIQUIDADA_CONFIRMADA");
        order.setReceiptKind("COMPROVANTE_LIQUIDACAO_CONFIRMADA");
        order.setDestinationNetwork("INTERNAL_BRAVUS");
        order.setDestinationParticipantCode("BRAVUS-INTERNAL");
        order.setDestinationConfirmationId(idempotencyKey);
        order.setDestinationConfirmedAt(java.time.OffsetDateTime.now());
        order.setSettlementMessage("Liquidacao interna confirmada no ledger Bravus, sem uso de Celcoin.");
        order.setErrorMessage(null);
        order.setRawResponse("{\"provider\":\"BRAVUS_INTERNAL_LEDGER\",\"status\":\"COMPLETED\",\"settlement\":\"INTERNAL_LEDGER\"}");
        return transferRepo.save(order);
    }

    private Optional<UserEntity> resolveBravusDestination(ExternalTransferCommand cmd) {
        return findBravusUser(cmd.pixKey)
                .or(() -> findBravusUser(cmd.accountNumber))
                .or(() -> findBravusUser(cmd.beneficiaryDocument));
    }

    private Optional<UserEntity> findBravusUser(String destination) {
        if (blank(destination)) {
            return Optional.empty();
        }
        String raw = destination.trim();
        String digits = DocumentUtilsBridge.digits(raw);

        Optional<UserEntity> found = userRepo.findByAccountNumber(raw);
        if (found.isPresent()) return found;

        if (!digits.isBlank()) {
            found = userRepo.findByAccountNumber(digits);
            if (found.isPresent()) return found;
            if (digits.length() == 11 || digits.length() == 14) {
                found = userRepo.findByCpf(digits);
                if (found.isPresent()) return found;
            }
            found = userRepo.findByChavePix(digits);
            if (found.isPresent()) return found;
        }

        return userRepo.findByEmail(raw)
                .or(() -> userRepo.findByUsername(raw))
                .or(() -> userRepo.findByChavePix(raw));
    }

    private void consumeCreditIfAvailable(UserEntity user,
                                          Long amount,
                                          Long transactionId,
                                          String createdBy,
                                          String note) {
        Long availableCredit = grantRepo.sumAvailableByUser(user.getId());
        if (availableCredit == null || availableCredit <= 0) {
            return;
        }
        long coveredByCredit = Math.min(amount, availableCredit);
        if (coveredByCredit <= 0) {
            return;
        }

        CreditService.UseCommand use = new CreditService.UseCommand();
        use.userId = user.getId();
        use.valor = coveredByCredit;
        use.tipo = "TRANSFERENCIA_INTERNA";
        use.transactionId = transactionId;
        use.criadoPor = createdBy;
        use.observacao = note;
        creditService.useCredit(use);
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
