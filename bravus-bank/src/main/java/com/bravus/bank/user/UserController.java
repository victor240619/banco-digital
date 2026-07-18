package com.bravus.bank.user;

import com.bravus.bank.db.entity.TransactionEntity;
import com.bravus.bank.db.entity.UserEntity;
import com.bravus.bank.db.repo.TransactionRepository;
import com.bravus.bank.db.repo.UserRepository;
import com.bravus.bank.external.ExternalTransferEntity;
import com.bravus.bank.external.ExternalTransferRepository;
import com.bravus.bank.user.transfer.DuplicateInternalTransferRequestException;
import com.bravus.bank.user.transfer.InternalTransferException;
import com.bravus.bank.user.transfer.PersistentInternalTransferService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/user")
public class UserController {
    
    private final UserRepository userRepository;
    private final TransactionRepository transactionRepository;
    private final ExternalTransferRepository externalTransferRepository;
    private final PersistentInternalTransferService persistentInternalTransferService;
    private final OutboundOperationPolicy outboundOperationPolicy;
    
    public UserController(UserRepository userRepository,
                          TransactionRepository transactionRepository,
                          ExternalTransferRepository externalTransferRepository,
                          PersistentInternalTransferService persistentInternalTransferService,
                          OutboundOperationPolicy outboundOperationPolicy) {
        this.userRepository = userRepository;
        this.transactionRepository = transactionRepository;
        this.externalTransferRepository = externalTransferRepository;
        this.persistentInternalTransferService = persistentInternalTransferService;
        this.outboundOperationPolicy = outboundOperationPolicy;
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
            Long balance,
            Boolean outboundOperationsEnabled
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
                user.getBalance(),
                user.getOutboundOperationsEnabled()
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
        outboundOperationPolicy.assertAllowed(user);
        
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
    public ResponseEntity<?> transfer(
            @RequestBody @Valid TransactionRequest request,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {
        if (!"TRANSFER_OUT".equals(request.type())) {
            return transactionError("Tipo de transacao invalido para transferencia.", "INVALID_TRANSACTION_TYPE");
        }

        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        try {
            PersistentInternalTransferService.TransferResult result = persistentInternalTransferService.transfer(
                    username,
                    request.destinationAccount(),
                    request.amount(),
                    request.description(),
                    idempotencyKey);
            return transferResponse(result);
        } catch (DuplicateInternalTransferRequestException duplicate) {
            PersistentInternalTransferService.TransferResult result = persistentInternalTransferService
                    .findCompletedAfterConcurrentDuplicate(
                            duplicate.getUserId(),
                            duplicate.getIdempotencyKey(),
                            duplicate.getDestinationUserId(),
                            duplicate.getAmountCentavos())
                    .orElseThrow(() -> new InternalTransferException(
                            "TRANSFER_PENDING_RETRY",
                            "A transferencia ainda esta sendo processada. Tente novamente com a mesma chave."));
            return transferResponse(result);
        } catch (InternalTransferException exception) {
            return transactionError(exception.getMessage(), exception.getCode());
        }
    }

    private ResponseEntity<?> transferResponse(PersistentInternalTransferService.TransferResult result) {
        return ResponseEntity.ok(Map.of(
                "message", "Transferencia interna Bravus liquidada.",
                "status", "COMPLETED",
                "provider", "BRAVUS_INTERNAL_LEDGER",
                "settlementStatus", "LIQUIDADA_CONFIRMADA",
                "balanceCentavos", result.balanceCentavos(),
                "transactionId", result.transactionOutId(),
                "destinationAccount", result.destinationAccount(),
                "receiptOrderId", result.receiptOrderId(),
                "externalOrderId", result.receiptOrderId(),
                "idempotentReplay", result.idempotentReplay()
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

        Optional<UserEntity> found = userRepository.findByCurrentOrLegacyAccountNumber(raw);
        if (found.isPresent()) return found;

        if (!digits.isBlank()) {
            found = userRepository.findByCurrentOrLegacyAccountNumber(digits);
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

}
