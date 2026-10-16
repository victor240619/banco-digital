package com.bravus.bank.payment.mp;

import com.bravus.bank.db.repo.UserRepository;
import org.junit.jupiter.api.Test;

import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class MercadoPagoPixOrderStoreTest {
    @Test
    void lateCreateResponseCannotRegressAnAlreadyCreditedOrder() {
        MercadoPagoPixOrderRepository repository = mock(MercadoPagoPixOrderRepository.class);
        MercadoPagoPixOrderEntity order = new MercadoPagoPixOrderEntity();
        UUID id = UUID.randomUUID();
        order.setId(id);
        order.setExternalReference("vantyx:pix:" + id);
        order.setAmountCentavos(10_000L);
        order.setCurrency("BRL");
        order.setStatus("CREDITED");
        order.setCreditedAt(OffsetDateTime.now());
        order.setTransactionId(77L);
        when(repository.findByIdForUpdate(id)).thenReturn(Optional.of(order));
        when(repository.save(order)).thenReturn(order);

        MercadoPagoPixOrderStore store = new MercadoPagoPixOrderStore(repository, mock(UserRepository.class));
        MercadoPagoOrdersGateway.OrderSnapshot createResponse = new MercadoPagoOrdersGateway.OrderSnapshot(
                "ORD01TEST", "PAY01TEST", order.getExternalReference(), 10_000L, 10_000L,
                "BRL", "pix", "bank_transfer",
                "processed", "accredited", null, null, null);

        MercadoPagoPixOrderEntity saved = store.completeCreation(id, createResponse);

        assertEquals("CREDITED", saved.getStatus());
        verify(repository).save(order);
    }

    @Test
    void partialProviderUpdatePreservesExistingQrFields() {
        MercadoPagoPixOrderStore store = new MercadoPagoPixOrderStore(
                mock(MercadoPagoPixOrderRepository.class), mock(UserRepository.class));
        MercadoPagoPixOrderEntity order = new MercadoPagoPixOrderEntity();
        order.setQrCode("pix-copy-code");
        order.setQrCodeBase64("base64-image");
        order.setTicketUrl("https://example.test/ticket");

        store.applyProviderSnapshot(order, new MercadoPagoOrdersGateway.OrderSnapshot(
                "ORD01TEST", null, "vantyx:pix:local", 10_000L, null,
                "BRL", "pix", "bank_transfer",
                "processing", "in_process", null, null, null));

        assertEquals("pix-copy-code", order.getQrCode());
        assertEquals("base64-image", order.getQrCodeBase64());
        assertEquals("https://example.test/ticket", order.getTicketUrl());
    }

    @Test
    void rejectsAccreditedOrderWhenPaidAmountDoesNotMatch() {
        MercadoPagoPixOrderStore store = new MercadoPagoPixOrderStore(
                mock(MercadoPagoPixOrderRepository.class), mock(UserRepository.class));
        MercadoPagoPixOrderEntity order = new MercadoPagoPixOrderEntity();
        order.setExternalReference("vantyx:pix:local");
        order.setAmountCentavos(10_000L);

        var exception = org.junit.jupiter.api.Assertions.assertThrows(
                MercadoPagoIntegrationException.class,
                () -> store.validateProviderOrder(order, new MercadoPagoOrdersGateway.OrderSnapshot(
                        "ORD01TEST", "PAY01TEST", "vantyx:pix:local", 10_000L, 9_999L,
                        "BRL", "pix", "bank_transfer", "processed", "accredited",
                        null, null, null)));

        assertEquals("MP_PAID_AMOUNT_MISMATCH", exception.getCode());
    }

    @Test
    void rejectsAccreditedOrderFromAnotherPaymentMethod() {
        MercadoPagoPixOrderStore store = new MercadoPagoPixOrderStore(
                mock(MercadoPagoPixOrderRepository.class), mock(UserRepository.class));
        MercadoPagoPixOrderEntity order = new MercadoPagoPixOrderEntity();
        order.setExternalReference("vantyx:pix:local");
        order.setAmountCentavos(10_000L);

        var exception = org.junit.jupiter.api.Assertions.assertThrows(
                MercadoPagoIntegrationException.class,
                () -> store.validateProviderOrder(order, new MercadoPagoOrdersGateway.OrderSnapshot(
                        "ORD01TEST", "PAY01TEST", "vantyx:pix:local", 10_000L, 10_000L,
                        "BRL", "visa", "credit_card", "processed", "accredited",
                        null, null, null)));

        assertEquals("MP_PAYMENT_METHOD_MISMATCH", exception.getCode());
    }
}
