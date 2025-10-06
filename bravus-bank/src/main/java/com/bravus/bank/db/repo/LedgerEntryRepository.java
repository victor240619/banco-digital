package com.bravus.bank.db.repo;

import com.bravus.bank.db.entity.AccountEntity;
import com.bravus.bank.db.entity.LedgerEntryEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface LedgerEntryRepository extends JpaRepository<LedgerEntryEntity, Long> {
    @Query("select coalesce(sum(case when le.type = 'CREDIT' then le.amount else -le.amount end),0) from LedgerEntryEntity le where le.account = :account")
    Long computeBalance(@Param("account") AccountEntity account);
}
