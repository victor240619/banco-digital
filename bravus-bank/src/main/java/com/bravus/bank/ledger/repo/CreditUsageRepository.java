package com.bravus.bank.ledger.repo;

import com.bravus.bank.ledger.entity.CreditUsageEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CreditUsageRepository extends JpaRepository<CreditUsageEntity, Long> {

    List<CreditUsageEntity> findByCreditGrantIdOrderByCreatedAtDesc(Long creditGrantId);

    List<CreditUsageEntity> findByTransactionId(Long transactionId);
}
