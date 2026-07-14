package com.bravus.bank.user;

import com.bravus.bank.db.entity.TransactionEntity;
import com.bravus.bank.db.entity.UserEntity;
import com.bravus.bank.db.repo.TransactionRepository;
import com.bravus.bank.db.repo.UserRepository;
import com.bravus.bank.external.ExternalTransferEntity;
import com.bravus.bank.external.ExternalTransferRepository;
import com.bravus.bank.ledger.repo.CreditGrantRepository;
import com.bravus.bank.ledger.service.CreditService;
import jakarta.transaction.Transactional;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/user")
public class UserController {
    
    private final UserRepository userRepository;
    private final TransactionRepository transactionRepository;
    private final ExternalTransferRepository externalTransferRepository;
    private final CreditGrantRepository creditGrantRepository;
    private final CreditService creditService;
    
    public UserController(UserRepository userRepository,
                          TransactionRepository transactionRepository,
                          ExternalTransferRepository externalTransferRepository,
                          CreditGrantRepository creditGrantRepository,
                          CreditService creditService) {
        this.userRepository = userRepository;
        this.transactionRepository = transactionRepository;
        this.externalTransferRepository = externalTransferRepository;
        this.creditGrantRepository = creditGrantRepository;
        this.creditService = creditService;
    }
    
    public record UserProfileResponse(
            Long id,
            String username,
            String email,
            String fullName,
            String cpf,
            String phone,
            String accountNumber,
            String accountType,
            Long balance
    ) {}
    
    public record TransactionRequest(
            @NotBlank String type,
            @NotNull @Min(1) Long amount,
            String description,
            String destinationAccount
    ) {}
    
    public record TransactionResponse(
            Long id,
            String type,
            Long amount,
            String description,
            String destinationAccount,
            String status,
            String createdAt,
            String senderName,
            String senderDocument,
            String senderBankName,
            String senderBankCode,
            String senderIspb,
            String senderAgency,
            String senderAccountNumber,
            String senderAccountDigit,
            String senderAccountType,
            String receiverName,
            String receiverDocument,
            String receiverBankName,
            String receiverBankCode,
            String receiverIspb,
            String receiverAgency,
            String receiverAccountNumber,
            String receiverAccountDigit,
            String receiverAccountType,
            String counterpartyName,
            String counterpartyDocument,
            String counterpartyBankName,
            String counterpartyAccount,
            String counterpartyRole,
            Long receiptOrderId,
            Long externalOrderId,
            Boolean receiptAvailable
    ) {}

    public record TransferDestinationResponse(
            boolean found,
            String username,
            String name,
            String document,
            String bankName,
            String bankCode,
            String ispb,
            String agency,
            String accountNumber,
            String accountDigit,
            String accountType,
            String pixKey,
            String pixKeyType,
            String statusKyc
    ) {}
    
    @GetMapping("/profile")
    public ResponseEntity<?> getProfile() {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        UserEntity user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"));
        
        return ResponseEntity.ok(new UserProfileResponse(
                user.getId(),
                user.getUsername(),
                user.getEmail(),
                user.getFullName(),
                user.getCpf(),
                user.getPhone(),
                user.getAccountNumber(),
                user.getAccountType(),
                user.getBalance()
        ));
    }
    
    @GetMapping("/balance")
    public ResponseEntity<?> getBalance() {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        UserEntity user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"));
        
        return ResponseEntity.ok(user.getBalance());
    }
    
    @GetMapping("/transactions")
    public ResponseEntity<?> getTransactions() {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        UserEntity user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"));
        
        List<TransactionResponse> transactions = transactionRepository
                .findByUserOrderByCreatedAtDesc(user)
                .stream()
                .map(t -> toTransactionResponse(t, user))
                .collect(Collectors.toList());
        
        return ResponseEntity.ok(transactions);
    }

    @GetMapping("/transfer/resolve")
    public ResponseEntity<?> resolveTransferDestination(@RequestParam String destination) {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        UserEntity currentUser = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"));
        Optional<UserEntity> found = findTransferDestination(destination);
        if (found.isEmpty()) {
            return ResponseEntity.ok(Map.of(
                    "found", false,
                    "message", "Destinatario Bravus nao localizado."
            ));
        }
        UserEntity destinationUser = found.get();
        if (destinationUser.getId().equals(currentUser.getId())) {
            return ResponseEntity.ok(Map.of(
                    "found", false,
                    "code", "SELF_TRANSFER",
                    "message", "Nao e permitido transferir para a propria conta."
            ));
        }
        return ResponseEntity.ok(toDestinationResponse(destinationUser));
    }
    
    @PostMapping("/deposit")
    @Transactional
    public ResponseEntity<?> deposit(@RequestBody @Valid TransactionRequest request) {
        if (!"DEPOSIT".equals(request.type())) {
            return ResponseEntity.badRequest().body("Invalid transaction type");
        }
        
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        UserEntity user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"));
        
        // Update balance
        user.setBalance(user.getBalance() + request.amount());
        userRepository.save(user);
        
        // Create transaction record
        TransactionEntity transaction = new TransactionEntity();
        transaction.setUser(user);
        transaction.setType("DEPOSIT");
        transaction.setAmount(request.amount());
        transaction.setDescription(request.description() != null ? request.description() : "Deposit");
        transaction.setStatus("COMPLETED");
        transactionRepository.save(transaction);
        
        return ResponseEntity.ok("Deposit successful. New balance: " + user.getBalance());
    }
    
    @PostMapping("/withdraw")
    @Transactional
    public ResponseEntity<?> withdraw(@RequestBody @Valid TransactionRequest request) {
        if (!"WITHDRAWAL".equals(request.type())) {
            return ResponseEntity.badRequest().body("Invalid transaction type");
        }
        
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        UserEntity user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"));
        
        if (user.getBalance() < request.amount()) {
            return ResponseEntity.badRequest().body("Insufficient balance");
        }
        
        // Update balance
        user.setBalance(user.getBalance() - request.amount());
        userRepository.save(user);
        
        // Create transaction record
        TransactionEntity transaction = new TransactionEntity();
        transaction.setUser(user);
        transaction.setType("WITHDRAWAL");
        transaction.setAmount(request.amount());
        transaction.setDescription(request.description() != null ? request.description() : "Withdrawal");
        transaction.setStatus("COMPLETED");
        transactionRepository.save(transaction);
        
        return ResponseEntity.ok("Withdrawal successful. New balance: " + user.getBalance());
    }
    
    @PostMapping("/transfer")
    @Transactional
    public ResponseEntity<?> transfer(@RequestBody @Valid TransactionRequest request) {
        if (!"TRANSFER_OUT".equals(request.type())) {
            return transactionError("Tipo de transacao invalido para transferencia.", "INVALID_TRANSACTION_TYPE");
        }
        
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        UserEntity fromUser = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"));
        
        if (fromUser.getBalance() < request.amount()) {
            return transactionError("Saldo contabil insuficiente para concluir a transferencia.", "INSUFFICIENT_BALANCE");
        }
        
        UserEntity toUser = findTransferDestination(request.destinationAccount()).orElse(null);
        
        if (toUser == null) {
            return transactionError(
                    "Destino Bravus nao encontrado. Para outros bancos, use Pagamentos/Pix ou Outros bancos.",
                    "BRAVUS_DESTINATION_NOT_FOUND");
        }
        
        if (fromUser.getId().equals(toUser.getId())) {
            return transactionError("Nao e permitido transferir para a propria conta Bravus.", "SELF_TRANSFER");
        }
        
        // Update balances
        fromUser.setBalance(fromUser.getBalance() - request.amount());
        toUser.setBalance(toUser.getBalance() + request.amount());
        userRepository.save(fromUser);
        userRepository.save(toUser);
        
        // Create transaction records
        TransactionEntity outTransaction = new TransactionEntity();
        outTransaction.setUser(fromUser);
        outTransaction.setType("TRANSFER_OUT");
        outTransaction.setAmount(request.amount());
        outTransaction.setDescription(request.description() != null ? request.description() : "Transfer");
        outTransaction.setDestinationAccount(toUser.getAccountNumber());
        outTransaction.setStatus("COMPLETED");
        outTransaction = transactionRepository.save(outTransaction);

        consumeCreditIfAvailable(
                fromUser,
                request.amount(),
                outTransaction.getId(),
                username,
                "Transferencia interna Bravus para " + toUser.getAccountNumber());
        
        TransactionEntity inTransaction = new TransactionEntity();
        inTransaction.setUser(toUser);
        inTransaction.setType("TRANSFER_IN");
        inTransaction.setAmount(request.amount());
        inTransaction.setDescription(request.description() != null ? request.description() : "Transfer received");
        inTransaction.setDestinationAccount(fromUser.getAccountNumber());
        inTransaction.setStatus("COMPLETED");
        transactionRepository.save(inTransaction);

        ExternalTransferEntity order = createInternalReceiptOrder(
                fromUser,
                toUser,
                outTransaction,
                request.amount(),
                request.description(),
                username);
        
        return ResponseEntity.ok(Map.of(
                "message", "Transferencia interna Bravus liquidada.",
                "status", "COMPLETED",
                "provider", "BRAVUS_INTERNAL_LEDGER",
                "settlementStatus", "LIQUIDADA_CONFIRMADA",
                "balanceCentavos", fromUser.getBalance(),
                "transactionId", outTransaction.getId(),
                "destinationAccount", toUser.getAccountNumber(),
                "receiptOrderId", order.getId(),
                "externalOrderId", order.getId()
        ));
    }

    private TransactionResponse toTransactionResponse(TransactionEntity tx, UserEntity viewer) {
        Optional<ExternalTransferEntity> order = receiptOrderFor(tx, viewer);
        Party sender = null;
        Party receiver = null;

        if ("TRANSFER_IN".equals(tx.getType())) {
            sender = findTransferDestination(tx.getDestinationAccount()).map(this::partyForUser).orElse(null);
            receiver = partyForUser(viewer);
        } else if ("TRANSFER_OUT".equals(tx.getType())) {
            sender = partyForUser(viewer);
            receiver = order.map(this::partyForOrderBeneficiary)
                    .or(() -> findTransferDestination(tx.getDestinationAccount()).map(this::partyForUser))
                    .orElse(null);
        } else if ("TRANSFER_EXTERNAL".equals(tx.getType())) {
            sender = partyForUser(viewer);
            receiver = order.map(this::partyForOrderBeneficiary).orElse(null);
        } else if ("DEPOSIT".equals(tx.getType())) {
            sender = bankParty();
            receiver = partyForUser(viewer);
        } else if ("WITHDRAWAL".equals(tx.getType())) {
            sender = partyForUser(viewer);
            receiver = bankParty();
        }

        boolean incoming = "DEPOSIT".equals(tx.getType()) || "TRANSFER_IN".equals(tx.getType());
        Party counterparty = incoming ? sender : receiver;
        Long orderId = order.map(ExternalTransferEntity::getId).orElse(null);

        return new TransactionResponse(
                tx.getId(),
                tx.getType(),
                tx.getAmount(),
                tx.getDescription(),
                tx.getDestinationAccount(),
                tx.getStatus(),
                tx.getCreatedAt() == null ? null : tx.getCreatedAt().toString(),
                value(sender, "name"),
                value(sender, "document"),
                value(sender, "bankName"),
                value(sender, "bankCode"),
                value(sender, "ispb"),
                value(sender, "agency"),
                value(sender, "accountNumber"),
                value(sender, "accountDigit"),
                value(sender, "accountType"),
                value(receiver, "name"),
                value(receiver, "document"),
                value(receiver, "bankName"),
                value(receiver, "bankCode"),
                value(receiver, "ispb"),
                value(receiver, "agency"),
                value(receiver, "accountNumber"),
                value(receiver, "accountDigit"),
                value(receiver, "accountType"),
                value(counterparty, "name"),
                value(counterparty, "document"),
                value(counterparty, "bankName"),
                value(counterparty, "accountNumber"),
                incoming ? "PAGADOR" : "RECEBEDOR",
                orderId,
                orderId,
                orderId != null
        );
    }

    private Optional<ExternalTransferEntity> receiptOrderFor(TransactionEntity tx, UserEntity viewer) {
        Optional<ExternalTransferEntity> byTransaction = externalTransferRepository.findByTransactionId(tx.getId());
        if (byTransaction.isPresent()) return byTransaction;
        if ("TRANSFER_IN".equals(tx.getType())) {
            return externalTransferRepository.findTopByBeneficiaryDocumentAndAccountNumberAndAmountCentavosOrderByCreatedAtDesc(
                    digits(viewer.getCpf()),
                    viewer.getAccountNumber(),
                    tx.getAmount());
        }
        return Optional.empty();
    }

    private ExternalTransferEntity createInternalReceiptOrder(UserEntity fromUser,
                                                             UserEntity toUser,
                                                             TransactionEntity transaction,
                                                             Long amount,
                                                             String description,
                                                             String requestedByUsername) {
        UserEntity requestedBy = userRepository.findByUsername(requestedByUsername).orElse(fromUser);
        String idempotencyKey = "bravus-internal-" + UUID.randomUUID();
        ExternalTransferEntity order = new ExternalTransferEntity();
        order.setUser(fromUser);
        order.setRequestedBy(requestedBy);
        order.setTransactionId(transaction.getId());
        order.setAmountCentavos(amount);
        order.setChannel("PIX");
        order.setCurrency("BRL");
        order.setBeneficiaryName(toUser.getFullName() != null ? toUser.getFullName() : toUser.getUsername());
        order.setBeneficiaryDocument(digits(toUser.getCpf()));
        order.setBankCode("999");
        order.setIspb("99999999");
        order.setAgency(toUser.getAgencia() != null ? toUser.getAgencia() : "0001");
        order.setAccountNumber(toUser.getAccountNumber());
        order.setAccountDigit(null);
        order.setAccountType(toUser.getAccountType() != null ? toUser.getAccountType() : "CORRENTE");
        order.setPixKey(toUser.getChavePix() != null ? toUser.getChavePix() : toUser.getCpf());
        order.setPixKeyType(toUser.getTipoChavePix() != null ? toUser.getTipoChavePix() : "CPF");
        order.setDescription(description);
        order.setProvider("BRAVUS_INTERNAL_LEDGER");
        order.setProviderTransferId(idempotencyKey);
        order.setIdempotencyKey(idempotencyKey);
        order.setStatus("COMPLETED");
        order.setSettlementStatus("LIQUIDADA_CONFIRMADA");
        order.setReceiptKind("COMPROVANTE_LIQUIDACAO_CONFIRMADA");
        order.setDestinationNetwork("INTERNAL_BRAVUS");
        order.setDestinationParticipantCode("BRAVUS-INTERNAL");
        order.setDestinationConfirmationId(idempotencyKey);
        order.setDestinationConfirmedAt(OffsetDateTime.now());
        order.setSettlementMessage("Liquidacao interna confirmada no ledger Bravus.");
        order.setErrorMessage(null);
        order.setRawResponse("{\"provider\":\"BRAVUS_INTERNAL_LEDGER\",\"status\":\"COMPLETED\",\"settlement\":\"INTERNAL_LEDGER\"}");
        return externalTransferRepository.save(order);
    }

    private TransferDestinationResponse toDestinationResponse(UserEntity user) {
        return new TransferDestinationResponse(
                true,
                user.getUsername(),
                user.getFullName(),
                user.getCpf(),
                user.getNomeBanco(),
                user.getCodigoBanco(),
                user.getIspb(),
                user.getAgencia(),
                user.getAccountNumber(),
                null,
                user.getAccountType(),
                user.getChavePix() != null ? user.getChavePix() : user.getCpf(),
                user.getTipoChavePix() != null ? user.getTipoChavePix() : "CPF",
                user.getStatusKyc()
        );
    }

    private Party partyForUser(UserEntity user) {
        return new Party(
                user.getFullName(),
                user.getCpf(),
                user.getNomeBanco(),
                user.getCodigoBanco(),
                user.getIspb(),
                user.getAgencia(),
                user.getAccountNumber(),
                null,
                user.getAccountType()
        );
    }

    private Party partyForOrderBeneficiary(ExternalTransferEntity order) {
        return new Party(
                order.getBeneficiaryName(),
                order.getBeneficiaryDocument(),
                null,
                order.getBankCode(),
                order.getIspb(),
                order.getAgency(),
                order.getAccountNumber(),
                order.getAccountDigit(),
                order.getAccountType()
        );
    }

    private Party bankParty() {
        return new Party(
                "Bravus Premium Bank",
                "BRAVUS-LEDGER",
                "Bravus Premium Bank",
                "999",
                "99999999",
                "0001",
                "BRAVUS-LEDGER",
                null,
                "RAIL"
        );
    }

    private String value(Party party, String field) {
        if (party == null) return null;
        return switch (field) {
            case "name" -> party.name();
            case "document" -> party.document();
            case "bankName" -> party.bankName();
            case "bankCode" -> party.bankCode();
            case "ispb" -> party.ispb();
            case "agency" -> party.agency();
            case "accountNumber" -> party.accountNumber();
            case "accountDigit" -> party.accountDigit();
            case "accountType" -> party.accountType();
            default -> null;
        };
    }

    private String digits(String value) {
        return value == null ? "" : value.replaceAll("\\D", "");
    }

    private record Party(
            String name,
            String document,
            String bankName,
            String bankCode,
            String ispb,
            String agency,
            String accountNumber,
            String accountDigit,
            String accountType
    ) {}

    private ResponseEntity<Map<String, String>> transactionError(String message, String code) {
        return ResponseEntity.badRequest().body(Map.of(
                "message", message,
                "code", code
        ));
    }

    private Optional<UserEntity> findTransferDestination(String destination) {
        if (destination == null || destination.isBlank()) {
            return Optional.empty();
        }
        String raw = destination.trim();
        String digits = raw.replaceAll("\\D", "");

        Optional<UserEntity> found = userRepository.findByAccountNumber(raw);
        if (found.isPresent()) return found;

        if (!digits.isBlank()) {
            found = userRepository.findByAccountNumber(digits);
            if (found.isPresent()) return found;
            if (digits.length() == 11 || digits.length() == 14) {
                found = userRepository.findByCpf(digits);
                if (found.isPresent()) return found;
            }
            found = userRepository.findByChavePix(digits);
            if (found.isPresent()) return found;
        }

        return userRepository.findByEmail(raw)
                .or(() -> userRepository.findByUsername(raw))
                .or(() -> userRepository.findByChavePix(raw));
    }

    private void consumeCreditIfAvailable(UserEntity user,
                                          Long amount,
                                          Long transactionId,
                                          String createdBy,
                                          String note) {
        Long availableCredit = creditGrantRepository.sumAvailableByUser(user.getId());
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
}
