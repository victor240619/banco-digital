package com.bravus.bank.user.transfer;

import com.bravus.bank.db.entity.UserEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import jakarta.persistence.Version;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(
        name = "internal_transfer_requests",
        uniqueConstraints = @UniqueConstraint(
                name = "uq_internal_transfer_request",
                columnNames = {"user_id", "idempotency_key"}))
public class InternalTransferRequestEntity {
    @Id
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private UserEntity user;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "destination_user_id", nullable = false)
    private UserEntity destinationUser;

    @Column(name = "idempotency_key", nullable = false, length = 128)
    private String idempotencyKey;

    @Column(name = "amount_centavos", nullable = false)
    private Long amountCentavos;

    @Column(length = 500)
    private String description;

    @Column(nullable = false, length = 20)
    private String status;

    @Column(name = "out_transaction_id")
    private Long outTransactionId;

    @Column(name = "in_transaction_id")
    private Long inTransactionId;

    @Column(name = "receipt_order_id")
    private Long receiptOrderId;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "completed_at")
    private OffsetDateTime completedAt;

    @Version
    private Long version;

    @PrePersist
    void onCreate() {
        if (id == null) id = UUID.randomUUID();
        if (createdAt == null) createdAt = OffsetDateTime.now();
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UserEntity getUser() { return user; }
    public void setUser(UserEntity user) { this.user = user; }
    public UserEntity getDestinationUser() { return destinationUser; }
    public void setDestinationUser(UserEntity destinationUser) { this.destinationUser = destinationUser; }
    public String getIdempotencyKey() { return idempotencyKey; }
    public void setIdempotencyKey(String idempotencyKey) { this.idempotencyKey = idempotencyKey; }
    public Long getAmountCentavos() { return amountCentavos; }
    public void setAmountCentavos(Long amountCentavos) { this.amountCentavos = amountCentavos; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public Long getOutTransactionId() { return outTransactionId; }
    public void setOutTransactionId(Long outTransactionId) { this.outTransactionId = outTransactionId; }
    public Long getInTransactionId() { return inTransactionId; }
    public void setInTransactionId(Long inTransactionId) { this.inTransactionId = inTransactionId; }
    public Long getReceiptOrderId() { return receiptOrderId; }
    public void setReceiptOrderId(Long receiptOrderId) { this.receiptOrderId = receiptOrderId; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public OffsetDateTime getCompletedAt() { return completedAt; }
    public void setCompletedAt(OffsetDateTime completedAt) { this.completedAt = completedAt; }
    public Long getVersion() { return version; }
}
