package com.bravus.bank.rail;

import jakarta.persistence.*;
import java.time.OffsetDateTime;

@Entity
@Table(name = "cayman_rail_config")
public class CaymanRailConfigEntity {
    @Id
    private Long id = 1L;

    @Column(name = "legal_entity_name", nullable = false)
    private String legalEntityName = "Bravus Bank Cayman Ltd.";

    @Column(nullable = false)
    private String jurisdiction = "Cayman Islands";

    @Column(name = "registry_number")
    private String registryNumber;

    @Column(name = "cima_license_number")
    private String cimaLicenseNumber;

    @Column(name = "license_class")
    private String licenseClass;

    @Column(name = "regulatory_status", nullable = false)
    private String regulatoryStatus = "DRAFT";

    @Column(name = "production_enabled", nullable = false)
    private Boolean productionEnabled = false;

    @Column(name = "settlement_mode", nullable = false)
    private String settlementMode = "INTERNAL_ONLY";

    @Column(name = "aml_policy_version")
    private String amlPolicyVersion;

    @Column(name = "created_at")
    private OffsetDateTime createdAt;

    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;

    @PrePersist
    void onCreate() {
        if (id == null) id = 1L;
        if (createdAt == null) createdAt = OffsetDateTime.now();
        updatedAt = OffsetDateTime.now();
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = OffsetDateTime.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getLegalEntityName() { return legalEntityName; }
    public void setLegalEntityName(String legalEntityName) { this.legalEntityName = legalEntityName; }
    public String getJurisdiction() { return jurisdiction; }
    public void setJurisdiction(String jurisdiction) { this.jurisdiction = jurisdiction; }
    public String getRegistryNumber() { return registryNumber; }
    public void setRegistryNumber(String registryNumber) { this.registryNumber = registryNumber; }
    public String getCimaLicenseNumber() { return cimaLicenseNumber; }
    public void setCimaLicenseNumber(String cimaLicenseNumber) { this.cimaLicenseNumber = cimaLicenseNumber; }
    public String getLicenseClass() { return licenseClass; }
    public void setLicenseClass(String licenseClass) { this.licenseClass = licenseClass; }
    public String getRegulatoryStatus() { return regulatoryStatus; }
    public void setRegulatoryStatus(String regulatoryStatus) { this.regulatoryStatus = regulatoryStatus; }
    public Boolean getProductionEnabled() { return productionEnabled; }
    public void setProductionEnabled(Boolean productionEnabled) { this.productionEnabled = productionEnabled; }
    public String getSettlementMode() { return settlementMode; }
    public void setSettlementMode(String settlementMode) { this.settlementMode = settlementMode; }
    public String getAmlPolicyVersion() { return amlPolicyVersion; }
    public void setAmlPolicyVersion(String amlPolicyVersion) { this.amlPolicyVersion = amlPolicyVersion; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public OffsetDateTime getUpdatedAt() { return updatedAt; }
}
