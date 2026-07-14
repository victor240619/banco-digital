package com.bravus.bank.user.transfer;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface InternalTransferRequestRepository
        extends JpaRepository<InternalTransferRequestEntity, UUID> {
    Optional<InternalTransferRequestEntity> findByUserIdAndIdempotencyKey(
            Long userId,
            String idempotencyKey);
}
