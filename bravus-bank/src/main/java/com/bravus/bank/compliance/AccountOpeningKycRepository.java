package com.bravus.bank.compliance;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface AccountOpeningKycRepository extends JpaRepository<AccountOpeningKycEntity, Long> {
    Optional<AccountOpeningKycEntity> findByUserId(Long userId);
}
