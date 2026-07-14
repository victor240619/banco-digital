package com.bravus.bank.auth.recovery;

import com.bravus.bank.db.entity.UserEntity;
import jakarta.persistence.*;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "password_reset_requests")
public class PasswordResetRequestEntity {
    @Id
    private UUID id;

    @Version
    private Long version;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private UserEntity user;

    @Column(name = "identifier_hash", nullable = false, length = 64)
    private String identifierHash;

    @Column(name = "idempotency_key", nullable = false, unique = true, length = 128)
    private String idempotencyKey;

    @Column(name = "client_secret_hash", nullable = false, length = 64)
    private String clientSecretHash;

    @Column(nullable = false, length = 120)
    private String challenge;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private PasswordResetStatus status;

    @Column(nullable = false)
    private Integer attempts = 0;

    @Column(name = "submitted_face_cipher", columnDefinition = "bytea")
    private byte[] submittedFaceCipher;

    @Column(name = "submitted_face_iv")
    private byte[] submittedFaceIv;

    @Column(name = "submitted_face_mime", length = 40)
    private String submittedFaceMime;

    @Column(name = "submitted_face_sha256", length = 64)
    private String submittedFaceSha256;

    @Column(name = "reviewed_by", length = 120)
    private String reviewedBy;

    @Column(name = "review_reason", length = 500)
    private String reviewReason;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "expires_at", nullable = false)
    private OffsetDateTime expiresAt;

    @Column(name = "reviewed_at")
    private OffsetDateTime reviewedAt;

    @Column(name = "consumed_at")
    private OffsetDateTime consumedAt;

    public void transitionTo(PasswordResetStatus next) {
        if (status == null || !status.canTransitionTo(next)) {
            throw new IllegalStateException("Transicao de recuperacao de senha invalida: " + status + " -> " + next);
        }
        this.status = next;
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public Long getVersion() { return version; }
    public UserEntity getUser() { return user; }
    public void setUser(UserEntity user) { this.user = user; }
    public String getIdentifierHash() { return identifierHash; }
    public void setIdentifierHash(String identifierHash) { this.identifierHash = identifierHash; }
    public String getIdempotencyKey() { return idempotencyKey; }
    public void setIdempotencyKey(String idempotencyKey) { this.idempotencyKey = idempotencyKey; }
    public String getClientSecretHash() { return clientSecretHash; }
    public void setClientSecretHash(String clientSecretHash) { this.clientSecretHash = clientSecretHash; }
    public String getChallenge() { return challenge; }
    public void setChallenge(String challenge) { this.challenge = challenge; }
    public PasswordResetStatus getStatus() { return status; }
    public void setStatus(PasswordResetStatus status) { this.status = status; }
    public Integer getAttempts() { return attempts; }
    public void setAttempts(Integer attempts) { this.attempts = attempts; }
    public byte[] getSubmittedFaceCipher() { return submittedFaceCipher; }
    public void setSubmittedFaceCipher(byte[] submittedFaceCipher) { this.submittedFaceCipher = submittedFaceCipher; }
    public byte[] getSubmittedFaceIv() { return submittedFaceIv; }
    public void setSubmittedFaceIv(byte[] submittedFaceIv) { this.submittedFaceIv = submittedFaceIv; }
    public String getSubmittedFaceMime() { return submittedFaceMime; }
    public void setSubmittedFaceMime(String submittedFaceMime) { this.submittedFaceMime = submittedFaceMime; }
    public String getSubmittedFaceSha256() { return submittedFaceSha256; }
    public void setSubmittedFaceSha256(String submittedFaceSha256) { this.submittedFaceSha256 = submittedFaceSha256; }
    public String getReviewedBy() { return reviewedBy; }
    public void setReviewedBy(String reviewedBy) { this.reviewedBy = reviewedBy; }
    public String getReviewReason() { return reviewReason; }
    public void setReviewReason(String reviewReason) { this.reviewReason = reviewReason; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }
    public OffsetDateTime getExpiresAt() { return expiresAt; }
    public void setExpiresAt(OffsetDateTime expiresAt) { this.expiresAt = expiresAt; }
    public OffsetDateTime getReviewedAt() { return reviewedAt; }
    public void setReviewedAt(OffsetDateTime reviewedAt) { this.reviewedAt = reviewedAt; }
    public OffsetDateTime getConsumedAt() { return consumedAt; }
    public void setConsumedAt(OffsetDateTime consumedAt) { this.consumedAt = consumedAt; }
}
