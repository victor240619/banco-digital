package com.bravus.bank.payment.mp;

import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class MercadoPagoWebhookEventStoreTest {
    @Test
    void retriesPreviouslyFailedDeliveryWithSameRequestId() {
        MercadoPagoWebhookEventRepository repository = mock(MercadoPagoWebhookEventRepository.class);
        MercadoPagoWebhookEventEntity failed = new MercadoPagoWebhookEventEntity();
        failed.setRequestId("request-1");
        failed.setProviderOrderId("ORD01TEST");
        failed.setEventType("order");
        failed.setProcessingStatus("FAILED");
        failed.setErrorCode("MP_PROVIDER_UNAVAILABLE");
        when(repository.findByRequestIdForUpdate("request-1")).thenReturn(Optional.of(failed));

        MercadoPagoWebhookEventStore store = new MercadoPagoWebhookEventStore(repository);
        boolean shouldProcess = store.start("request-1", "ORD01TEST", "order", "order.processed");

        assertTrue(shouldProcess);
        assertTrue("RECEIVED".equals(failed.getProcessingStatus()));
        verify(repository).save(failed);
    }
}
