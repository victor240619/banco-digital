package com.bravus.bank.payment.mp;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;

@Service
public class MercadoPagoWebhookService {
    private final MercadoPagoOrdersGateway gateway;
    private final MercadoPagoWebhookEventStore eventStore;
    private final MercadoPagoSettlementService settlementService;

    public MercadoPagoWebhookService(
            MercadoPagoOrdersGateway gateway,
            MercadoPagoWebhookEventStore eventStore,
            MercadoPagoSettlementService settlementService) {
        this.gateway = gateway;
        this.eventStore = eventStore;
        this.settlementService = settlementService;
    }

    public WebhookResult process(String providerOrderId, String requestId, String eventType, String action) {
        validateIdentifiers(providerOrderId, requestId);
        boolean firstDelivery;
        try {
            firstDelivery = eventStore.start(requestId, providerOrderId, eventType, action);
        } catch (DataIntegrityViolationException duplicate) {
            firstDelivery = false;
        }
        if (!firstDelivery) return new WebhookResult(false, true, "DUPLICATE");

        if (!"order".equalsIgnoreCase(eventType)) {
            eventStore.finish(requestId, "IGNORED", "UNSUPPORTED_EVENT_TYPE");
            return new WebhookResult(false, false, "IGNORED");
        }

        try {
            MercadoPagoOrdersGateway.OrderSnapshot providerOrder = gateway.getOrder(providerOrderId);
            MercadoPagoSettlementService.SettlementResult settlement = settlementService.apply(providerOrder);
            eventStore.finish(requestId, "PROCESSED", null);
            return new WebhookResult(settlement.credited(), settlement.idempotentReplay(), settlement.status());
        } catch (MercadoPagoIntegrationException exception) {
            eventStore.finish(requestId, "FAILED", exception.getCode());
            throw exception;
        } catch (RuntimeException exception) {
            eventStore.finish(requestId, "FAILED", "INTERNAL_ERROR");
            throw exception;
        }
    }

    private void validateIdentifiers(String providerOrderId, String requestId) {
        if (providerOrderId == null || !providerOrderId.matches("[A-Za-z0-9_-]{1,80}")) {
            throw new MercadoPagoIntegrationException("MP_INVALID_ORDER_ID", "Identificador de order inválido.");
        }
        if (requestId == null || requestId.isBlank() || requestId.length() > 100) {
            throw new MercadoPagoIntegrationException("MP_INVALID_REQUEST_ID", "Identificador da notificação inválido.");
        }
    }

    public record WebhookResult(boolean credited, boolean idempotentReplay, String status) {}
}
