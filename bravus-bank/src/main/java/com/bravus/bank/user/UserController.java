package com.bravus.bank.user;

import com.bravus.bank.db.entity.TransactionEntity;
import com.bravus.bank.db.entity.UserEntity;
import com.bravus.bank.db.repo.TransactionRepository;
import com.bravus.bank.db.repo.UserRepository;
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

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/user")
public class UserController {
    
    private final UserRepository userRepository;
    private final TransactionRepository transactionRepository;
    private final CreditGrantRepository creditGrantRepository;
    private final CreditService creditService;
    
    public UserController(UserRepository userRepository,
                          TransactionRepository transactionRepository,
                          CreditGrantRepository creditGrantRepository,
                          CreditService creditService) {
        this.userRepository = userRepository;
        this.transactionRepository = transactionRepository;
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
            String createdAt
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
                .map(t -> new TransactionResponse(
                        t.getId(),
                        t.getType(),
                        t.getAmount(),
                        t.getDescription(),
                        t.getDestinationAccount(),
                        t.getStatus(),
                        t.getCreatedAt().toString()
                ))
                .collect(Collectors.toList());
        
        return ResponseEntity.ok(transactions);
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
        
        return ResponseEntity.ok(Map.of(
                "message", "Transferencia interna Bravus liquidada.",
                "status", "COMPLETED",
                "provider", "BRAVUS_INTERNAL_LEDGER",
                "settlementStatus", "LIQUIDADA_CONFIRMADA",
                "balanceCentavos", fromUser.getBalance(),
                "transactionId", outTransaction.getId(),
                "destinationAccount", toUser.getAccountNumber()
        ));
    }

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
