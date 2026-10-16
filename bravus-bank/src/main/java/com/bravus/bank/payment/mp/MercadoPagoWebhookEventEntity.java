package com.bravus.bank.payment.mp;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.OffsetDateTime;

@Entity
@Table(name = "mercado_pago_webhook_events")
public class MercadoPagoWebhookEventEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "request_id", nullable = false, unique = true, length = 100)
    private String requestId;

    @Column(name = "provider_order_id", nullable = false, length = 80)
    private String providerOrderId;

    @Column(name = "event_type", nullable = false, length = 40)
    private String eventType;

    @Column(length = 80)
    private String action;

    @Column(name = "processing_status", nullable = false, length = 20)
    private String processingStatus;

    @Column(name = "error_code", length = 80)
    private String errorCode;

    @Column(name = "received_at", nullable = false)
    private OffsetDateTime receivedAt;

    @Column(name = "processed_at")
    private OffsetDateTime processedAt;

    @PrePersist
    void onCreate() {
        if (receivedAt == null) receivedAt = OffsetDateTime.now();
    }

    public Long getId() { return id; }
    public String getRequestId() { return requestId; }
    public void setRequestId(String value) { this.requestId = value; }
    public String getProviderOrderId() { return providerOrderId; }
    public void setProviderOrderId(String value) { this.providerOrderId = value; }
    public String getEventType() { return eventType; }
    public void setEventType(String value) { this.eventType = value; }
    public String getAction() { return action; }
    public void setAction(String value) { this.action = value; }
    public String getProcessingStatus() { return processingStatus; }
    public void setProcessingStatus(String value) { this.processingStatus = value; }
    public String getErrorCode() { return errorCode; }
    public void setErrorCode(String value) { this.errorCode = value; }
    public OffsetDateTime getReceivedAt() { return receivedAt; }
    public OffsetDateTime getProcessedAt() { return processedAt; }
    public void setProcessedAt(OffsetDateTime value) { this.processedAt = value; }
}
