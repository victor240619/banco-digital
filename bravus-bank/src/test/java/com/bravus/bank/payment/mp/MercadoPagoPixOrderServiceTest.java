package com.bravus.bank.payment.mp;

import com.bravus.bank.db.entity.UserEntity;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Duration;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MercadoPagoPixOrderServiceTest {
    @Mock MercadoPagoOrdersGateway gateway;
    @Mock MercadoPagoPixOrderStore store;

    private MercadoPagoPixOrderService service;

    @BeforeEach
    void setUp() {
        MercadoPagoProperties properties = new MercadoPagoProperties(
                true, "test-token", "test-secret", "https://api.mercadopago.com",
                100, 1_000_000, Duration.ofMinutes(30), Duration.ofMinutes(5));
        service = new MercadoPagoPixOrderService(properties, gateway, store);
    }

    @Test
    void replaysExistingProviderOrderWithoutCreatingAnotherCharge() {
        MercadoPagoPixOrderEntity existing = localOrder(5_000L);
        existing.setProviderOrderId("ORD01EXISTING");
        existing.setStatus("ACTION_REQUIRED");
        when(store.prepare("user", 5_000L, "Depósito", "client-key-1234567890"))
                .thenReturn(new MercadoPagoPixOrderStore.PreparedOrder(existing, "user@example.com"));

        MercadoPagoPixOrderService.PixOrderResult result = service.create(
                "user", 5_000L, "Depósito", "client-key-1234567890");

        assertEquals("ORD01EXISTING", result.providerOrderId());
        assertTrue(result.idempotentReplay());
        verify(gateway, never()).createPixOrder(any());
    }

    @Test
    void forwardsPersistedProviderIdempotencyKeyToOrdersApi() {
        MercadoPagoPixOrderEntity local = localOrder(5_000L);
        when(store.prepare("user", 5_000L, "Depósito", "client-key-1234567890"))
                .thenReturn(new MercadoPagoPixOrderStore.PreparedOrder(local, "user@example.com"));
        MercadoPagoOrdersGateway.OrderSnapshot snapshot = new MercadoPagoOrdersGateway.OrderSnapshot(
                "ORD01NEW", "PAY01NEW", local.getExternalReference(), 5_000L, null,
                "BRL", "pix", "bank_transfer",
                "action_required", "waiting_transfer", "pix-code", "base64", "https://ticket");
        when(gateway.createPixOrder(any())).thenReturn(snapshot);
        MercadoPagoPixOrderEntity completed = localOrder(5_000L);
        completed.setId(local.getId());
        completed.setExternalReference(local.getExternalReference());
        completed.setProviderIdempotencyKey(local.getProviderIdempotencyKey());
        completed.setProviderOrderId("ORD01NEW");
        completed.setStatus("ACTION_REQUIRED");
        when(store.completeCreation(local.getId(), snapshot)).thenReturn(completed);

        service.create("user", 5_000L, "Depósito", "client-key-1234567890");

        ArgumentCaptor<MercadoPagoOrdersGateway.CreatePixOrderCommand> captor =
                ArgumentCaptor.forClass(MercadoPagoOrdersGateway.CreatePixOrderCommand.class);
        verify(gateway).createPixOrder(captor.capture());
        assertEquals(local.getProviderIdempotencyKey(), captor.getValue().idempotencyKey());
        assertEquals(local.getExternalReference(), captor.getValue().externalReference());
    }

    @Test
    void rejectsValueAboveConfiguredLimitBeforeCallingProvider() {
        MercadoPagoIntegrationException exception = assertThrows(
                MercadoPagoIntegrationException.class,
                () -> service.create("user", 1_000_001L, "Depósito", "client-key-1234567890"));

        assertEquals("AMOUNT_LIMIT_EXCEEDED", exception.getCode());
        verify(gateway, never()).createPixOrder(any());
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {" ", "\t"})
    void rejectsChargeWithoutWebhookSecretBeforePersistingOrCallingProvider(String secret) {
        MercadoPagoProperties properties = new MercadoPagoProperties(
                true, "test-token", secret, "https://api.mercadopago.com",
                100, 1_000_000, Duration.ofMinutes(30), Duration.ofMinutes(5));
        service = new MercadoPagoPixOrderService(properties, gateway, store);

        MercadoPagoIntegrationException exception = assertThrows(
                MercadoPagoIntegrationException.class,
                () -> service.create("user", 5_000L, "Depósito", "client-key-1234567890"));

        assertEquals("MP_WEBHOOK_NOT_CONFIGURED", exception.getCode());
        verifyNoInteractions(store, gateway);
    }

    private MercadoPagoPixOrderEntity localOrder(long amount) {
        UserEntity user = new UserEntity();
        user.setEmail("user@example.com");
        MercadoPagoPixOrderEntity order = new MercadoPagoPixOrderEntity();
        UUID id = UUID.randomUUID();
        order.setId(id);
        order.setUser(user);
        order.setClientIdempotencyKey("client-key-1234567890");
        order.setProviderIdempotencyKey(UUID.randomUUID().toString());
        order.setExternalReference("vantyx:pix:" + id);
        order.setAmountCentavos(amount);
        order.setCurrency("BRL");
        order.setDescription("Depósito");
        order.setStatus("CREATING");
        return order;
    }
}
