package com.bravus.bank.admin;

import com.bravus.bank.db.entity.TransactionEntity;
import com.bravus.bank.db.entity.UserEntity;
import com.bravus.bank.db.repo.TransactionRepository;
import com.bravus.bank.db.repo.UserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/admin")
@PreAuthorize("hasRole('ADMIN')")
public class AdminController {
    
    private final UserRepository userRepository;
    private final TransactionRepository transactionRepository;
    
    public AdminController(UserRepository userRepository, TransactionRepository transactionRepository) {
        this.userRepository = userRepository;
        this.transactionRepository = transactionRepository;
    }
    
    public record UserSummary(
            Long id,
            String username,
            String email,
            String fullName,
            String accountNumber,
            Long balance,
            Boolean isActive,
            Boolean outboundOperationsEnabled,
            String createdAt
    ) {}
    
    public record TransactionSummary(
            Long id,
            String username,
            String type,
            Long amount,
            String description,
            String status,
            String createdAt
    ) {}
    
    public record DashboardStats(
            long totalUsers,
            long activeUsers,
            long totalTransactions,
            long totalBalance
    ) {}
    
    @GetMapping("/dashboard")
    public ResponseEntity<?> getDashboardStats() {
        long totalUsers = userRepository.count();
        long activeUsers = userRepository.findAll().stream()
                .filter(UserEntity::getIsActive)
                .count();
        long totalTransactions = transactionRepository.count();
        long totalBalance = userRepository.findAll().stream()
                .mapToLong(UserEntity::getBalance)
                .sum();
        
        return ResponseEntity.ok(new DashboardStats(totalUsers, activeUsers, totalTransactions, totalBalance));
    }
    
    @GetMapping("/users")
    public ResponseEntity<?> getAllUsers() {
        List<UserSummary> users = userRepository.findAll().stream()
                .map(u -> new UserSummary(
                        u.getId(),
                        u.getUsername(),
                        u.getEmail(),
                        u.getFullName(),
                        u.getAccountNumber(),
                        u.getBalance(),
                        u.getIsActive(),
                        u.getOutboundOperationsEnabled(),
                        u.getCreatedAt().toString()
                ))
                .collect(Collectors.toList());
        
        return ResponseEntity.ok(users);
    }
    
    @GetMapping("/users/{id}")
    public ResponseEntity<?> getUserById(@PathVariable Long id) {
        UserEntity user = userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("User not found"));
        
        return ResponseEntity.ok(new UserSummary(
                user.getId(),
                user.getUsername(),
                user.getEmail(),
                user.getFullName(),
                user.getAccountNumber(),
                user.getBalance(),
                user.getIsActive(),
                user.getOutboundOperationsEnabled(),
                user.getCreatedAt().toString()
        ));
    }

    @PutMapping("/users/{id}/transfers/enable")
    public ResponseEntity<?> enableTransfers(@PathVariable Long id) {
        UserEntity user = userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("User not found"));
        user.setOutboundOperationsEnabled(true);
        userRepository.save(user);
        return ResponseEntity.ok("Transferencias liberadas para o usuario.");
    }

    @PutMapping("/users/{id}/transfers/disable")
    public ResponseEntity<?> disableTransfers(@PathVariable Long id) {
        UserEntity user = userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("User not found"));
        user.setOutboundOperationsEnabled(false);
        userRepository.save(user);
        return ResponseEntity.ok("Transferencias bloqueadas para o usuario.");
    }
    
    @PutMapping("/users/{id}/activate")
    public ResponseEntity<?> activateUser(@PathVariable Long id) {
        UserEntity user = userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("User not found"));
        
        user.setIsActive(true);
        userRepository.save(user);
        
        return ResponseEntity.ok("User activated successfully");
    }
    
    @PutMapping("/users/{id}/deactivate")
    public ResponseEntity<?> deactivateUser(@PathVariable Long id) {
        UserEntity user = userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("User not found"));
        
        user.setIsActive(false);
        userRepository.save(user);
        
        return ResponseEntity.ok("User deactivated successfully");
    }
    
    @DeleteMapping("/users/{id}")
    public ResponseEntity<?> deleteUser(@PathVariable Long id) {
        if (!userRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        userRepository.deleteById(id);
        return ResponseEntity.ok("User deleted successfully");
    }
    
    @GetMapping("/transactions")
    public ResponseEntity<?> getAllTransactions() {
        List<TransactionSummary> transactions = transactionRepository.findAll().stream()
                .map(t -> new TransactionSummary(
                        t.getId(),
                        t.getUser().getUsername(),
                        t.getType(),
                        t.getAmount(),
                        t.getDescription(),
                        t.getStatus(),
                        t.getCreatedAt().toString()
                ))
                .collect(Collectors.toList());
        
        return ResponseEntity.ok(transactions);
    }
}
