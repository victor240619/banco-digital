package com.bravus.bank.payment.mp;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MercadoPagoWebhookServiceTest {
    @Mock MercadoPagoOrdersGateway gateway;
    @Mock MercadoPagoWebhookEventStore eventStore;
    @Mock MercadoPagoSettlementService settlementService;

    private MercadoPagoWebhookService service;

    @BeforeEach
    void setUp() {
        service = new MercadoPagoWebhookService(gateway, eventStore, settlementService);
    }

    @Test
    void ignoresSignedEventsOutsideOrderTopicWithoutProviderLookup() {
        when(eventStore.start("request-1", "ORD01TEST", "payment", "payment.updated"))
                .thenReturn(true);

        var result = service.process("ORD01TEST", "request-1", "payment", "payment.updated");

        assertEquals("IGNORED", result.status());
        assertFalse(result.credited());
        verify(eventStore).finish("request-1", "IGNORED", "UNSUPPORTED_EVENT_TYPE");
        verify(gateway, never()).getOrder("ORD01TEST");
    }

    @Test
    void duplicateDeliveryDoesNotLookupOrSettleAgain() {
        when(eventStore.start("request-2", "ORD01TEST", "order", "order.processed"))
                .thenReturn(false);

        var result = service.process("ORD01TEST", "request-2", "order", "order.processed");

        assertEquals("DUPLICATE", result.status());
        verify(gateway, never()).getOrder("ORD01TEST");
        verify(settlementService, never()).apply(org.mockito.ArgumentMatchers.any());
    }
}
