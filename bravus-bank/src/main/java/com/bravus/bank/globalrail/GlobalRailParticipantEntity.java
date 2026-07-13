package com.bravus.bank.globalrail;

import jakarta.persistence.*;
import java.time.OffsetDateTime;

@Entity
@Table(name = "global_rail_participants")
public class GlobalRailParticipantEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "participant_code", nullable = false, unique = true)
    private String participantCode;

    @Column(name = "legal_name", nullable = false)
    private String legalName;

    @Column(nullable = false)
    private String country = "KY";

    @Column(nullable = false)
    private String network = "GLOBAL";

    @Column(name = "bank_code")
    private String bankCode;

    private String ispb;

    @Column(name = "swift_bic")
    private String swiftBic;

    @Column(name = "routing_code")
    private String routingCode;

    @Column(name = "endpoint_url")
    private String endpointUrl;

    @Column(name = "auth_mode", nullable = false)
    private String authMode = "NONE";

    @Column(name = "connection_mode", nullable = false)
    private String connectionMode = "MANUAL_CONFIRMATION";

    @Column(name = "settlement_account")
    private String settlementAccount;

    @Column(name = "supports_instant", nullable = false)
    private Boolean supportsInstant = false;

    @Column(nullable = false)
    private String status = "DRAFT";

    @Column(name = "created_at")
    private OffsetDateTime createdAt;

    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = OffsetDateTime.now();
        updatedAt = OffsetDateTime.now();
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = OffsetDateTime.now();
    }

    public Long getId() { return id; }
    public String getParticipantCode() { return participantCode; }
    public void setParticipantCode(String participantCode) { this.participantCode = participantCode; }
    public String getLegalName() { return legalName; }
    public void setLegalName(String legalName) { this.legalName = legalName; }
    public String getCountry() { return country; }
    public void setCountry(String country) { this.country = country; }
    public String getNetwork() { return network; }
    public void setNetwork(String network) { this.network = network; }
    public String getBankCode() { return bankCode; }
    public void setBankCode(String bankCode) { this.bankCode = bankCode; }
    public String getIspb() { return ispb; }
    public void setIspb(String ispb) { this.ispb = ispb; }
    public String getSwiftBic() { return swiftBic; }
    public void setSwiftBic(String swiftBic) { this.swiftBic = swiftBic; }
    public String getRoutingCode() { return routingCode; }
    public void setRoutingCode(String routingCode) { this.routingCode = routingCode; }
    public String getEndpointUrl() { return endpointUrl; }
    public void setEndpointUrl(String endpointUrl) { this.endpointUrl = endpointUrl; }
    public String getAuthMode() { return authMode; }
    public void setAuthMode(String authMode) { this.authMode = authMode; }
    public String getConnectionMode() { return connectionMode; }
    public void setConnectionMode(String connectionMode) { this.connectionMode = connectionMode; }
    public String getSettlementAccount() { return settlementAccount; }
    public void setSettlementAccount(String settlementAccount) { this.settlementAccount = settlementAccount; }
    public Boolean getSupportsInstant() { return supportsInstant; }
    public void setSupportsInstant(Boolean supportsInstant) { this.supportsInstant = supportsInstant; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public OffsetDateTime getUpdatedAt() { return updatedAt; }
}
