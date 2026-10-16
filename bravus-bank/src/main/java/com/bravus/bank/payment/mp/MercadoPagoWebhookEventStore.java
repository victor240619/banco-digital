package com.bravus.bank.payment.mp;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;

@Service
public class MercadoPagoWebhookEventStore {
    private final MercadoPagoWebhookEventRepository repository;

    public MercadoPagoWebhookEventStore(MercadoPagoWebhookEventRepository repository) {
        this.repository = repository;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public boolean start(String requestId, String providerOrderId, String eventType, String action) {
        var existing = repository.findByRequestIdForUpdate(requestId);
        if (existing.isPresent()) {
            MercadoPagoWebhookEventEntity event = existing.get();
            if (!event.getProviderOrderId().equals(providerOrderId)) {
                throw new MercadoPagoIntegrationException(
                        "MP_WEBHOOK_REQUEST_CONFLICT",
                        "Identificador da notificação já associado a outra order.");
            }
            if (!"FAILED".equals(event.getProcessingStatus())) return false;
            event.setProcessingStatus("RECEIVED");
            event.setErrorCode(null);
            event.setProcessedAt(null);
            repository.save(event);
            return true;
        }
        MercadoPagoWebhookEventEntity event = new MercadoPagoWebhookEventEntity();
        event.setRequestId(requestId);
        event.setProviderOrderId(providerOrderId);
        event.setEventType(normalize(eventType, "orders", 40));
        event.setAction(normalize(action, null, 80));
        event.setProcessingStatus("RECEIVED");
        repository.saveAndFlush(event);
        return true;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void finish(String requestId, String status, String errorCode) {
        repository.findByRequestId(requestId).ifPresent(event -> {
            event.setProcessingStatus(status);
            event.setErrorCode(normalize(errorCode, null, 80));
            event.setProcessedAt(OffsetDateTime.now());
            repository.save(event);
        });
    }

    private String normalize(String value, String fallback, int maxLength) {
        if (value == null || value.isBlank()) return fallback;
        String normalized = value.trim();
        return normalized.length() <= maxLength ? normalized : normalized.substring(0, maxLength);
    }
}
