package com.bravus.bank.auth.recovery;

import org.springframework.data.jpa.repository.JpaRepository;

public interface PasswordResetAuditRepository extends JpaRepository<PasswordResetAuditEntity, Long> {
}
