package com.bravus.bank.user.security;

import org.springframework.data.jpa.repository.JpaRepository;

public interface UserCredentialAuditRepository extends JpaRepository<UserCredentialAuditEntity, Long> {
}
