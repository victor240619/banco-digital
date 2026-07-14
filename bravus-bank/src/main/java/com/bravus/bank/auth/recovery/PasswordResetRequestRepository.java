package com.bravus.bank.auth.recovery;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PasswordResetRequestRepository extends JpaRepository<PasswordResetRequestEntity, UUID> {
    Optional<PasswordResetRequestEntity> findByIdempotencyKey(String idempotencyKey);

    long countByIdentifierHashAndCreatedAtAfter(String identifierHash, OffsetDateTime createdAt);

    long countByCreatedAtAfter(OffsetDateTime createdAt);

    List<PasswordResetRequestEntity> findTop100ByStatusAndSubmittedFaceCipherIsNotNullAndExpiresAtAfterOrderByCreatedAtDesc(
            PasswordResetStatus status, OffsetDateTime expiresAt);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from PasswordResetRequestEntity r left join fetch r.user where r.id = :id")
    Optional<PasswordResetRequestEntity> findLockedById(@Param("id") UUID id);
}
