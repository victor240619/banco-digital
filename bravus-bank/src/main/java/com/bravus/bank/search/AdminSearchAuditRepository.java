package com.bravus.bank.search;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface AdminSearchAuditRepository extends JpaRepository<AdminSearchAuditEntity, Long> {
}
