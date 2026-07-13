package com.bravus.bank.external;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ExternalTransferRepository extends JpaRepository<ExternalTransferEntity, Long> {
    List<ExternalTransferEntity> findAllByOrderByCreatedAtDesc(Pageable pageable);
    List<ExternalTransferEntity> findByUserIdOrderByCreatedAtDesc(Long userId, Pageable pageable);
}
