package com.bravus.bank.user.transfer;

import com.bravus.bank.db.entity.UserEntity;
import com.bravus.bank.db.repo.TransactionRepository;
import com.bravus.bank.db.repo.UserRepository;
import com.bravus.bank.external.ExternalTransferRepository;
import com.bravus.bank.user.OutboundOperationPolicy;
import com.bravus.bank.user.OutboundOperationRestrictedException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:internal-transfer-test;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.flyway.enabled=false",
        "jwt.secret=0123456789012345678901234567890123456789012345678901234567890123",
        "bravus.biometric.key=01234567890123456789012345678901"
})
class PersistentInternalTransferServiceIntegrationTest {
    @Autowired
    private PersistentInternalTransferService service;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private TransactionRepository transactionRepository;

    @Autowired
    private ExternalTransferRepository externalTransferRepository;

    @Autowired
    private InternalTransferRequestRepository requestRepository;

    @Autowired
    private AccountLedgerEntryRepository accountLedgerRepository;

    private UserEntity joao;
    private UserEntity francisca;

    @BeforeEach
    void setUp() {
        accountLedgerRepository.deleteAll();
        requestRepository.deleteAll();
        externalTransferRepository.deleteAll();
        transactionRepository.deleteAll();
        userRepository.deleteAll();

        joao = userRepository.save(user(
                "joao.transfer", "joao.transfer@example.com", "11111111111", "1111111111", 10000L));
        francisca = userRepository.save(user(
                "francisca.transfer", "francisca.transfer@example.com", "22222222222", "2222222222", 0L));
    }

    @Test
    void transfersAtomicallyAndWritesBalancedAccountLedger() {
        PersistentInternalTransferService.TransferResult result = service.transfer(
                joao.getUsername(),
                francisca.getAccountNumber(),
                2500L,
                "Teste atomico",
                "transfer-idempotency-key-000001");

        assertFalse(result.idempotentReplay());
        assertEquals(7500L, userRepository.findById(joao.getId()).orElseThrow().getBalance());
        assertEquals(2500L, userRepository.findById(francisca.getId()).orElseThrow().getBalance());
        assertEquals(2L, transactionRepository.count());
        assertEquals(1L, externalTransferRepository.count());
        assertEquals(1L, requestRepository.count());

        List<AccountLedgerEntryEntity> entries = accountLedgerRepository.findAll();
        assertEquals(2, entries.size());
        assertEquals(0L, entries.stream().mapToLong(AccountLedgerEntryEntity::getSignedAmountCentavos).sum());
        assertTrue(entries.stream().anyMatch(entry -> "debit".equals(entry.getEntryType())));
        assertTrue(entries.stream().anyMatch(entry -> "credit".equals(entry.getEntryType())));
    }

    @Test
    void sameIdempotencyKeyReturnsOriginalTransferWithoutSecondDebit() {
        String key = "transfer-idempotency-key-000002";
        PersistentInternalTransferService.TransferResult first = service.transfer(
                joao.getUsername(), francisca.getCpf(), 3000L, "Uma vez", key);
        PersistentInternalTransferService.TransferResult replay = service.transfer(
                joao.getUsername(), francisca.getCpf(), 3000L, "Uma vez", key);

        assertTrue(replay.idempotentReplay());
        assertEquals(first.transactionOutId(), replay.transactionOutId());
        assertEquals(7000L, userRepository.findById(joao.getId()).orElseThrow().getBalance());
        assertEquals(3000L, userRepository.findById(francisca.getId()).orElseThrow().getBalance());
        assertEquals(2L, transactionRepository.count());
        assertEquals(2L, accountLedgerRepository.count());
        assertEquals(1L, requestRepository.count());
    }

    @Test
    void reusedIdempotencyKeyWithDifferentPayloadIsRejected() {
        String key = "transfer-idempotency-key-000003";
        service.transfer(joao.getUsername(), francisca.getAccountNumber(), 1000L, "Original", key);

        InternalTransferException exception = assertThrows(
                InternalTransferException.class,
                () -> service.transfer(
                        joao.getUsername(), francisca.getAccountNumber(), 1100L, "Alterada", key));

        assertEquals("IDEMPOTENCY_CONFLICT", exception.getCode());
        assertEquals(9000L, userRepository.findById(joao.getId()).orElseThrow().getBalance());
        assertEquals(1000L, userRepository.findById(francisca.getId()).orElseThrow().getBalance());
        assertEquals(2L, transactionRepository.count());
    }

    @Test
    void insufficientBalanceRollsBackRequestTransactionsAndLedger() {
        InternalTransferException exception = assertThrows(
                InternalTransferException.class,
                () -> service.transfer(
                        joao.getUsername(),
                        francisca.getAccountNumber(),
                        10001L,
                        "Sem saldo",
                        "transfer-idempotency-key-000004"));

        assertEquals("INSUFFICIENT_BALANCE", exception.getCode());
        assertEquals(10000L, userRepository.findById(joao.getId()).orElseThrow().getBalance());
        assertEquals(0L, userRepository.findById(francisca.getId()).orElseThrow().getBalance());
        assertEquals(0L, requestRepository.count());
        assertEquals(0L, transactionRepository.count());
        assertEquals(0L, accountLedgerRepository.count());
        assertEquals(0L, externalTransferRepository.count());
    }

    @Test
    void accountUnderReviewCanReceiveButCannotSend() {
        joao.setOutboundOperationsEnabled(false);
        userRepository.saveAndFlush(joao);

        OutboundOperationRestrictedException exception = assertThrows(
                OutboundOperationRestrictedException.class,
                () -> service.transfer(
                        joao.getUsername(),
                        francisca.getAccountNumber(),
                        1000L,
                        "Conta em analise",
                        "transfer-idempotency-key-000005"));

        assertEquals("ACCOUNT_UNDER_REVIEW", exception.getCode());
        assertEquals(OutboundOperationPolicy.RESTRICTION_MESSAGE, exception.getMessage());
        assertEquals(10000L, userRepository.findById(joao.getId()).orElseThrow().getBalance());
        assertEquals(0L, userRepository.findById(francisca.getId()).orElseThrow().getBalance());
        assertEquals(0L, requestRepository.count());
        assertEquals(0L, transactionRepository.count());
    }

    private UserEntity user(
            String username,
            String email,
            String cpf,
            String accountNumber,
            long balance) {
        UserEntity user = new UserEntity();
        user.setUsername(username);
        user.setEmail(email);
        user.setPassword("$2b$12$test-only-hash");
        user.setFullName(username);
        user.setCpf(cpf);
        user.setAccountNumber(accountNumber);
        user.setBalance(balance);
        user.setIsActive(true);
        user.setOutboundOperationsEnabled(true);
        user.setStatusKyc("VERIFICADO");
        user.setChavePix(cpf);
        user.setTipoChavePix("CPF");
        return user;
    }
}
