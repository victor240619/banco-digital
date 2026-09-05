package com.bravus.bank.user;

import com.bravus.bank.db.entity.TransactionEntity;
import com.bravus.bank.db.entity.UserEntity;
import com.bravus.bank.db.repo.TransactionRepository;
import com.bravus.bank.db.repo.UserRepository;
import com.bravus.bank.external.ExternalTransferRepository;
import com.bravus.bank.user.transfer.PersistentInternalTransferService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UserControllerTransactionIsolationTest {
    @Mock UserRepository userRepository;
    @Mock TransactionRepository transactionRepository;
    @Mock ExternalTransferRepository externalTransferRepository;
    @Mock PersistentInternalTransferService persistentInternalTransferService;
    @Mock OutboundOperationPolicy outboundOperationPolicy;

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void unverifiedDepositsNeverAccessRepositoriesOrCreditBalances() {
        UserController controller = new UserController(userRepository, transactionRepository,
                externalTransferRepository, persistentInternalTransferService, outboundOperationPolicy);
        for (long amount : new long[] { 1L, 100000000000L, Long.MAX_VALUE }) {
            ResponseEntity<?> response = controller.deposit(
                    new UserController.TransactionRequest("DEPOSIT", amount, "unverified request", null));
            assertEquals(409, response.getStatusCode().value());
            assertEquals("DEPOSIT_PAYMENT_REQUIRED", ((java.util.Map<?, ?>) response.getBody()).get("code"));
        }
        verifyNoInteractions(userRepository, transactionRepository, externalTransferRepository,
                persistentInternalTransferService, outboundOperationPolicy);
    }

    @Test
    void statementQueriesOnlyTheAuthenticatedOwnerAndDisablesSharedCaching() {
        UserEntity owner = new UserEntity();
        owner.setId(41L);
        owner.setUsername("account-owner");
        owner.setFullName("Account Owner");
        owner.setCpf("11144477735");
        owner.setAccountNumber("123456");

        TransactionEntity ownTransaction = new TransactionEntity();
        ownTransaction.setId(700L);
        ownTransaction.setUser(owner);
        ownTransaction.setType("DEPOSIT");
        ownTransaction.setAmount(1250L);
        ownTransaction.setStatus("COMPLETED");

        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(owner.getUsername(), "ignored")
        );
        when(userRepository.findByUsername(owner.getUsername())).thenReturn(Optional.of(owner));
        when(transactionRepository.findByUserIdOrderByCreatedAtDesc(owner.getId()))
                .thenReturn(List.of(ownTransaction));
        when(externalTransferRepository.findByTransactionId(ownTransaction.getId()))
                .thenReturn(Optional.empty());

        UserController controller = new UserController(
                userRepository,
                transactionRepository,
                externalTransferRepository,
                persistentInternalTransferService,
                outboundOperationPolicy
        );
        ResponseEntity<?> response = controller.getTransactions();

        assertEquals(200, response.getStatusCode().value());
        assertTrue(response.getHeaders().getCacheControl().contains("no-store"));
        assertEquals("Authorization", response.getHeaders().getFirst("Vary"));
        List<?> body = (List<?>) response.getBody();
        assertEquals(1, body.size());
        UserController.TransactionResponse transaction = (UserController.TransactionResponse) body.get(0);
        assertEquals(owner.getUsername(), transaction.username());
        assertEquals(ownTransaction.getId(), transaction.id());
        verify(transactionRepository).findByUserIdOrderByCreatedAtDesc(owner.getId());
        verify(transactionRepository, never()).findAll();
    }
}
