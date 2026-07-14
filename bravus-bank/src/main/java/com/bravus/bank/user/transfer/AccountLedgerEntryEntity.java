package com.bravus.bank.user.transfer;

import com.bravus.bank.db.entity.UserEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.time.OffsetDateTime;

@Entity
@Table(
        name = "account_ledger_entries",
        uniqueConstraints = @UniqueConstraint(
                name = "uq_account_ledger_side",
                columnNames = {"transfer_id", "account_number", "entry_type"}))
public class AccountLedgerEntryEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "transfer_request_id")
    private InternalTransferRequestEntity transferRequest;

    @Column(name = "transfer_id", nullable = false, length = 160)
    private String transferId;

    @Column(name = "transaction_id")
    private Long transactionId;

    @Column(name = "external_order_id")
    private Long externalOrderId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private UserEntity user;

    @Column(name = "account_number", nullable = false, length = 40)
    private String accountNumber;

    @Column(name = "entry_type", nullable = false, length = 10)
    private String entryType;

    @Column(name = "signed_amount_centavos", nullable = false)
    private Long signedAmountCentavos;

    @Column(nullable = false, length = 3)
    private String currency = "BRL";

    @Column(nullable = false, length = 100)
    private String reason;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = OffsetDateTime.now();
    }

    public Long getId() { return id; }
    public InternalTransferRequestEntity getTransferRequest() { return transferRequest; }
    public void setTransferRequest(InternalTransferRequestEntity transferRequest) { this.transferRequest = transferRequest; }
    public String getTransferId() { return transferId; }
    public void setTransferId(String transferId) { this.transferId = transferId; }
    public Long getTransactionId() { return transactionId; }
    public void setTransactionId(Long transactionId) { this.transactionId = transactionId; }
    public Long getExternalOrderId() { return externalOrderId; }
    public void setExternalOrderId(Long externalOrderId) { this.externalOrderId = externalOrderId; }
    public UserEntity getUser() { return user; }
    public void setUser(UserEntity user) { this.user = user; }
    public String getAccountNumber() { return accountNumber; }
    public void setAccountNumber(String accountNumber) { this.accountNumber = accountNumber; }
    public String getEntryType() { return entryType; }
    public void setEntryType(String entryType) { this.entryType = entryType; }
    public Long getSignedAmountCentavos() { return signedAmountCentavos; }
    public void setSignedAmountCentavos(Long signedAmountCentavos) { this.signedAmountCentavos = signedAmountCentavos; }
    public String getCurrency() { return currency; }
    public void setCurrency(String currency) { this.currency = currency; }
    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
}
