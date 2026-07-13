package com.bravus.bank.rail;

import jakarta.persistence.*;
import java.time.OffsetDateTime;

@Entity
@Table(name = "cayman_rail_participants")
public class CaymanRailParticipantEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "participant_code", nullable = false, unique = true)
    private String participantCode;

    @Column(name = "legal_name", nullable = false)
    private String legalName;

    @Column(name = "institution_type", nullable = false)
    private String institutionType = "INTERNAL";

    @Column(nullable = false)
    private String country = "KY";

    @Column(name = "swift_bic")
    private String swiftBic;

    @Column(name = "local_routing_code")
    private String localRoutingCode;

    @Column(name = "settlement_account")
    private String settlementAccount;

    @Column(name = "direct_participant", nullable = false)
    private Boolean directParticipant = false;

    @Column(nullable = false)
    private String status = "PENDING";

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
    public String getInstitutionType() { return institutionType; }
    public void setInstitutionType(String institutionType) { this.institutionType = institutionType; }
    public String getCountry() { return country; }
    public void setCountry(String country) { this.country = country; }
    public String getSwiftBic() { return swiftBic; }
    public void setSwiftBic(String swiftBic) { this.swiftBic = swiftBic; }
    public String getLocalRoutingCode() { return localRoutingCode; }
    public void setLocalRoutingCode(String localRoutingCode) { this.localRoutingCode = localRoutingCode; }
    public String getSettlementAccount() { return settlementAccount; }
    public void setSettlementAccount(String settlementAccount) { this.settlementAccount = settlementAccount; }
    public Boolean getDirectParticipant() { return directParticipant; }
    public void setDirectParticipant(Boolean directParticipant) { this.directParticipant = directParticipant; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public OffsetDateTime getUpdatedAt() { return updatedAt; }
}
