package com.bravus.bank.payment.mp;

import com.bravus.bank.db.entity.TransactionEntity;
import com.bravus.bank.db.entity.UserEntity;
import com.bravus.bank.db.repo.TransactionRepository;
import com.bravus.bank.db.repo.UserRepository;
import com.bravus.bank.user.transfer.AccountLedgerEntryEntity;
import com.bravus.bank.user.transfer.AccountLedgerEntryRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MercadoPagoSettlementServiceTest {
    @Mock MercadoPagoPixOrderRepository orderRepository;
    @Mock UserRepository userRepository;
    @Mock TransactionRepository transactionRepository;
    @Mock AccountLedgerEntryRepository accountLedgerRepository;
    @Mock MercadoPagoPixOrderStore orderStore;

    private MercadoPagoSettlementService service;
    private MercadoPagoPixOrderEntity localOrder;
    private UserEntity user;
    private MercadoPagoOrdersGateway.OrderSnapshot accredited;

    @BeforeEach
    void setUp() {
        service = new MercadoPagoSettlementService(
                orderRepository, userRepository, transactionRepository, accountLedgerRepository, orderStore);

        user = new UserEntity();
        user.setId(42L);
        user.setUsername("user");
        user.setAccountNumber("123456");
        user.setBalance(1_000L);

        localOrder = new MercadoPagoPixOrderEntity();
        localOrder.setId(UUID.randomUUID());
        localOrder.setUser(user);
        localOrder.setExternalReference("vantyx:pix:" + localOrder.getId());
        localOrder.setProviderOrderId("ORD01PAID");
        localOrder.setProviderPaymentId("PAY01PAID");
        localOrder.setAmountCentavos(5_000L);
        localOrder.setCurrency("BRL");
        localOrder.setDescription("Depósito Pix Vantyx Bank");
        localOrder.setStatus("ACTION_REQUIRED");

        accredited = new MercadoPagoOrdersGateway.OrderSnapshot(
                "ORD01PAID", "PAY01PAID", localOrder.getExternalReference(),
                5_000L, 5_000L, "BRL", "pix", "bank_transfer",
                "processed", "accredited", null, null, null);

        when(orderRepository.findByProviderOrderIdForUpdate("ORD01PAID")).thenReturn(Optional.of(localOrder));
        when(userRepository.findByIdForUpdate(42L)).thenReturn(Optional.of(user));
        when(transactionRepository.save(any(TransactionEntity.class))).thenAnswer(invocation -> {
            TransactionEntity transaction = invocation.getArgument(0);
            transaction.setId(99L);
            return transaction;
        });
    }

    @Test
    void creditsExactlyOnceAndWritesBalancedAccountLedger() {
        MercadoPagoSettlementService.SettlementResult first = service.apply(accredited);

        assertTrue(first.credited());
        assertEquals(6_000L, user.getBalance());
        assertEquals("CREDITED", localOrder.getStatus());
        assertEquals(99L, localOrder.getTransactionId());

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<AccountLedgerEntryEntity>> ledgerCaptor = ArgumentCaptor.forClass(List.class);
        verify(accountLedgerRepository).saveAll(ledgerCaptor.capture());
        long sum = ledgerCaptor.getValue().stream()
                .mapToLong(AccountLedgerEntryEntity::getSignedAmountCentavos)
                .sum();
        assertEquals(0L, sum);
        assertEquals(-5_000L, ledgerCaptor.getValue().get(0).getSignedAmountCentavos());
        assertEquals(5_000L, ledgerCaptor.getValue().get(1).getSignedAmountCentavos());

        clearInvocations(userRepository, transactionRepository, accountLedgerRepository);
        MercadoPagoSettlementService.SettlementResult replay = service.apply(accredited);

        assertFalse(replay.credited());
        assertTrue(replay.idempotentReplay());
        assertEquals(6_000L, user.getBalance());
        verify(userRepository, never()).save(any());
        verify(transactionRepository, never()).save(any());
        verify(accountLedgerRepository, never()).saveAll(any());
    }
}
