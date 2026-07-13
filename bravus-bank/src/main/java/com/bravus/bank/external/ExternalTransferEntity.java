package com.bravus.bank.external;

import com.bravus.bank.db.entity.UserEntity;
import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import java.time.OffsetDateTime;

@Entity
@Table(name = "external_transfer_orders")
public class ExternalTransferEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id")
    @JsonIgnore
    private UserEntity user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "requested_by")
    @JsonIgnore
    private UserEntity requestedBy;

    @Column(name = "transaction_id")
    private Long transactionId;

    @Column(name = "amount_centavos", nullable = false)
    private Long amountCentavos;

    @Column(nullable = false)
    private String channel;

    @Column(nullable = false)
    private String currency = "BRL";

    @Column(name = "beneficiary_name", nullable = false)
    private String beneficiaryName;

    @Column(name = "beneficiary_document", nullable = false)
    private String beneficiaryDocument;

    @Column(name = "bank_code")
    private String bankCode;

    private String ispb;
    private String agency;

    @Column(name = "account_number")
    private String accountNumber;

    @Column(name = "account_digit")
    private String accountDigit;

    @Column(name = "account_type")
    private String accountType;

    @Column(name = "pix_key")
    private String pixKey;

    @Column(name = "pix_key_type")
    private String pixKeyType;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(nullable = false)
    private String provider;

    @Column(name = "provider_transfer_id")
    private String providerTransferId;

    @Column(name = "idempotency_key", nullable = false, unique = true)
    private String idempotencyKey;

    @Column(nullable = false)
    private String status = "PENDING";

    @Column(name = "settlement_status")
    private String settlementStatus = "DEBITADA_NO_BRAVUS_AGUARDANDO_CONEXAO_DESTINO";

    @Column(name = "receipt_kind")
    private String receiptKind = "COMPROVANTE_SAIDA_BRAVUS";

    @Column(name = "destination_network")
    private String destinationNetwork;

    @Column(name = "destination_participant_code")
    private String destinationParticipantCode;

    @Column(name = "destination_confirmation_id")
    private String destinationConfirmationId;

    @Column(name = "destination_confirmed_at")
    private OffsetDateTime destinationConfirmedAt;

    @Column(name = "settlement_message", columnDefinition = "TEXT")
    private String settlementMessage;

    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;

    @Column(name = "raw_response", columnDefinition = "TEXT")
    private String rawResponse;

    @Column(name = "created_at")
    private OffsetDateTime createdAt;

    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = OffsetDateTime.now();
        updatedAt = createdAt;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = OffsetDateTime.now();
    }

    public Long getId() { return id; }
    public UserEntity getUser() { return user; }
    public void setUser(UserEntity user) { this.user = user; }
    public UserEntity getRequestedBy() { return requestedBy; }
    public void setRequestedBy(UserEntity requestedBy) { this.requestedBy = requestedBy; }
    public Long getTransactionId() { return transactionId; }
    public void setTransactionId(Long transactionId) { this.transactionId = transactionId; }
    public Long getAmountCentavos() { return amountCentavos; }
    public void setAmountCentavos(Long amountCentavos) { this.amountCentavos = amountCentavos; }
    public String getChannel() { return channel; }
    public void setChannel(String channel) { this.channel = channel; }
    public String getCurrency() { return currency; }
    public void setCurrency(String currency) { this.currency = currency; }
    public String getBeneficiaryName() { return beneficiaryName; }
    public void setBeneficiaryName(String beneficiaryName) { this.beneficiaryName = beneficiaryName; }
    public String getBeneficiaryDocument() { return beneficiaryDocument; }
    public void setBeneficiaryDocument(String beneficiaryDocument) { this.beneficiaryDocument = beneficiaryDocument; }
    public String getBankCode() { return bankCode; }
    public void setBankCode(String bankCode) { this.bankCode = bankCode; }
    public String getIspb() { return ispb; }
    public void setIspb(String ispb) { this.ispb = ispb; }
    public String getAgency() { return agency; }
    public void setAgency(String agency) { this.agency = agency; }
    public String getAccountNumber() { return accountNumber; }
    public void setAccountNumber(String accountNumber) { this.accountNumber = accountNumber; }
    public String getAccountDigit() { return accountDigit; }
    public void setAccountDigit(String accountDigit) { this.accountDigit = accountDigit; }
    public String getAccountType() { return accountType; }
    public void setAccountType(String accountType) { this.accountType = accountType; }
    public String getPixKey() { return pixKey; }
    public void setPixKey(String pixKey) { this.pixKey = pixKey; }
    public String getPixKeyType() { return pixKeyType; }
    public void setPixKeyType(String pixKeyType) { this.pixKeyType = pixKeyType; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getProvider() { return provider; }
    public void setProvider(String provider) { this.provider = provider; }
    public String getProviderTransferId() { return providerTransferId; }
    public void setProviderTransferId(String providerTransferId) { this.providerTransferId = providerTransferId; }
    public String getIdempotencyKey() { return idempotencyKey; }
    public void setIdempotencyKey(String idempotencyKey) { this.idempotencyKey = idempotencyKey; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getSettlementStatus() {
        return settlementStatus == null
                ? "DEBITADA_NO_BRAVUS_AGUARDANDO_CONEXAO_DESTINO"
                : settlementStatus;
    }
    public void setSettlementStatus(String settlementStatus) { this.settlementStatus = settlementStatus; }
    public String getReceiptKind() {
        return receiptKind == null ? "COMPROVANTE_SAIDA_BRAVUS" : receiptKind;
    }
    public void setReceiptKind(String receiptKind) { this.receiptKind = receiptKind; }
    public String getDestinationNetwork() { return destinationNetwork; }
    public void setDestinationNetwork(String destinationNetwork) { this.destinationNetwork = destinationNetwork; }
    public String getDestinationParticipantCode() { return destinationParticipantCode; }
    public void setDestinationParticipantCode(String destinationParticipantCode) { this.destinationParticipantCode = destinationParticipantCode; }
    public String getDestinationConfirmationId() { return destinationConfirmationId; }
    public void setDestinationConfirmationId(String destinationConfirmationId) { this.destinationConfirmationId = destinationConfirmationId; }
    public OffsetDateTime getDestinationConfirmedAt() { return destinationConfirmedAt; }
    public void setDestinationConfirmedAt(OffsetDateTime destinationConfirmedAt) { this.destinationConfirmedAt = destinationConfirmedAt; }
    public String getSettlementMessage() { return settlementMessage; }
    public void setSettlementMessage(String settlementMessage) { this.settlementMessage = settlementMessage; }
    public String getErrorMessage() { return errorMessage; }
    public void setErrorMessage(String errorMessage) { this.errorMessage = errorMessage; }
    public String getRawResponse() { return rawResponse; }
    public void setRawResponse(String rawResponse) { this.rawResponse = rawResponse; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public OffsetDateTime getUpdatedAt() { return updatedAt; }
}
