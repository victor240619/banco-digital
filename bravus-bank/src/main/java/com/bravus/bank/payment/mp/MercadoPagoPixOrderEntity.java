package com.bravus.bank.payment.mp;

import com.bravus.bank.db.entity.UserEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import jakarta.persistence.Version;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(
        name = "mercado_pago_pix_orders",
        uniqueConstraints = {
                @UniqueConstraint(name = "uq_mp_pix_user_idempotency", columnNames = {"user_id", "client_idempotency_key"}),
                @UniqueConstraint(name = "uq_mp_pix_provider_idempotency", columnNames = "provider_idempotency_key"),
                @UniqueConstraint(name = "uq_mp_pix_external_reference", columnNames = "external_reference"),
                @UniqueConstraint(name = "uq_mp_pix_provider_order", columnNames = "provider_order_id"),
                @UniqueConstraint(name = "uq_mp_pix_provider_payment", columnNames = "provider_payment_id")
        })
public class MercadoPagoPixOrderEntity {
    @Id
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private UserEntity user;

    @Column(name = "client_idempotency_key", nullable = false, length = 128)
    private String clientIdempotencyKey;

    @Column(name = "provider_idempotency_key", nullable = false, length = 64)
    private String providerIdempotencyKey;

    @Column(name = "external_reference", nullable = false, length = 100)
    private String externalReference;

    @Column(name = "provider_order_id", length = 80)
    private String providerOrderId;

    @Column(name = "provider_payment_id", length = 80)
    private String providerPaymentId;

    @Column(name = "amount_centavos", nullable = false)
    private Long amountCentavos;

    @Column(nullable = false, length = 3)
    private String currency = "BRL";

    @Column(length = 255)
    private String description;

    @Column(nullable = false, length = 32)
    private String status;

    @Column(name = "status_detail", length = 80)
    private String statusDetail;

    @Column(name = "qr_code", columnDefinition = "TEXT")
    private String qrCode;

    @Column(name = "qr_code_base64", columnDefinition = "TEXT")
    private String qrCodeBase64;

    @Column(name = "ticket_url", columnDefinition = "TEXT")
    private String ticketUrl;

    @Column(name = "transaction_id")
    private Long transactionId;

    @Column(name = "credited_at")
    private OffsetDateTime creditedAt;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    @Version
    private Long version;

    @PrePersist
    void onCreate() {
        OffsetDateTime now = OffsetDateTime.now();
        if (id == null) id = UUID.randomUUID();
        if (createdAt == null) createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = OffsetDateTime.now();
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UserEntity getUser() { return user; }
    public void setUser(UserEntity user) { this.user = user; }
    public String getClientIdempotencyKey() { return clientIdempotencyKey; }
    public void setClientIdempotencyKey(String value) { this.clientIdempotencyKey = value; }
    public String getProviderIdempotencyKey() { return providerIdempotencyKey; }
    public void setProviderIdempotencyKey(String value) { this.providerIdempotencyKey = value; }
    public String getExternalReference() { return externalReference; }
    public void setExternalReference(String value) { this.externalReference = value; }
    public String getProviderOrderId() { return providerOrderId; }
    public void setProviderOrderId(String value) { this.providerOrderId = value; }
    public String getProviderPaymentId() { return providerPaymentId; }
    public void setProviderPaymentId(String value) { this.providerPaymentId = value; }
    public Long getAmountCentavos() { return amountCentavos; }
    public void setAmountCentavos(Long value) { this.amountCentavos = value; }
    public String getCurrency() { return currency; }
    public void setCurrency(String value) { this.currency = value; }
    public String getDescription() { return description; }
    public void setDescription(String value) { this.description = value; }
    public String getStatus() { return status; }
    public void setStatus(String value) { this.status = value; }
    public String getStatusDetail() { return statusDetail; }
    public void setStatusDetail(String value) { this.statusDetail = value; }
    public String getQrCode() { return qrCode; }
    public void setQrCode(String value) { this.qrCode = value; }
    public String getQrCodeBase64() { return qrCodeBase64; }
    public void setQrCodeBase64(String value) { this.qrCodeBase64 = value; }
    public String getTicketUrl() { return ticketUrl; }
    public void setTicketUrl(String value) { this.ticketUrl = value; }
    public Long getTransactionId() { return transactionId; }
    public void setTransactionId(Long value) { this.transactionId = value; }
    public OffsetDateTime getCreditedAt() { return creditedAt; }
    public void setCreditedAt(OffsetDateTime value) { this.creditedAt = value; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public OffsetDateTime getUpdatedAt() { return updatedAt; }
    public Long getVersion() { return version; }
}
