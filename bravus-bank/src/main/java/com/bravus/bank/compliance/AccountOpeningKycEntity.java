package com.bravus.bank.compliance;

import com.bravus.bank.db.entity.UserEntity;
import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;

import java.time.OffsetDateTime;

@Entity
@Table(name = "account_opening_kyc")
public class AccountOpeningKycEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    @JsonIgnore
    private UserEntity user;

    @Column(name = "document_type")
    private String documentType;

    @Column(name = "document_number")
    private String documentNumber;

    @Column(name = "front_file_path", nullable = false)
    private String frontFilePath;

    @Column(name = "back_file_path", nullable = false)
    private String backFilePath;

    @Column(name = "face_file_path", nullable = false)
    private String faceFilePath;

    @Column(name = "front_sha256", nullable = false, length = 64)
    private String frontSha256;

    @Column(name = "back_sha256", nullable = false, length = 64)
    private String backSha256;

    @Column(name = "face_sha256", nullable = false, length = 64)
    private String faceSha256;

    @Column(name = "front_mime", nullable = false)
    private String frontMime;

    @Column(name = "back_mime", nullable = false)
    private String backMime;

    @Column(name = "face_mime", nullable = false)
    private String faceMime;

    @Column(name = "front_bytes", nullable = false)
    private Long frontBytes;

    @Column(name = "back_bytes", nullable = false)
    private Long backBytes;

    @Column(name = "face_bytes", nullable = false)
    private Long faceBytes;

    @Column(name = "face_capture_method", nullable = false)
    private String faceCaptureMethod = "CAMERA";

    @Column(name = "biometric_challenge")
    private String biometricChallenge;

    @Column(nullable = false)
    private String provider = "BRAVUS_SELF_KYC";

    @Column(nullable = false)
    private String status = "CAPTURADO";

    @Column(name = "risk_score", nullable = false)
    private Integer riskScore = 10;

    @Column(name = "created_at")
    private OffsetDateTime createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = OffsetDateTime.now();
    }

    public Long getId() { return id; }
    public UserEntity getUser() { return user; }
    public void setUser(UserEntity user) { this.user = user; }
    public String getDocumentType() { return documentType; }
    public void setDocumentType(String documentType) { this.documentType = documentType; }
    public String getDocumentNumber() { return documentNumber; }
    public void setDocumentNumber(String documentNumber) { this.documentNumber = documentNumber; }
    public String getFrontFilePath() { return frontFilePath; }
    public void setFrontFilePath(String frontFilePath) { this.frontFilePath = frontFilePath; }
    public String getBackFilePath() { return backFilePath; }
    public void setBackFilePath(String backFilePath) { this.backFilePath = backFilePath; }
    public String getFaceFilePath() { return faceFilePath; }
    public void setFaceFilePath(String faceFilePath) { this.faceFilePath = faceFilePath; }
    public String getFrontSha256() { return frontSha256; }
    public void setFrontSha256(String frontSha256) { this.frontSha256 = frontSha256; }
    public String getBackSha256() { return backSha256; }
    public void setBackSha256(String backSha256) { this.backSha256 = backSha256; }
    public String getFaceSha256() { return faceSha256; }
    public void setFaceSha256(String faceSha256) { this.faceSha256 = faceSha256; }
    public String getFrontMime() { return frontMime; }
    public void setFrontMime(String frontMime) { this.frontMime = frontMime; }
    public String getBackMime() { return backMime; }
    public void setBackMime(String backMime) { this.backMime = backMime; }
    public String getFaceMime() { return faceMime; }
    public void setFaceMime(String faceMime) { this.faceMime = faceMime; }
    public Long getFrontBytes() { return frontBytes; }
    public void setFrontBytes(Long frontBytes) { this.frontBytes = frontBytes; }
    public Long getBackBytes() { return backBytes; }
    public void setBackBytes(Long backBytes) { this.backBytes = backBytes; }
    public Long getFaceBytes() { return faceBytes; }
    public void setFaceBytes(Long faceBytes) { this.faceBytes = faceBytes; }
    public String getFaceCaptureMethod() { return faceCaptureMethod; }
    public void setFaceCaptureMethod(String faceCaptureMethod) { this.faceCaptureMethod = faceCaptureMethod; }
    public String getBiometricChallenge() { return biometricChallenge; }
    public void setBiometricChallenge(String biometricChallenge) { this.biometricChallenge = biometricChallenge; }
    public String getProvider() { return provider; }
    public void setProvider(String provider) { this.provider = provider; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public Integer getRiskScore() { return riskScore; }
    public void setRiskScore(Integer riskScore) { this.riskScore = riskScore; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
}
