package com.bravus.bank.ledger.repo;

import com.bravus.bank.ledger.entity.BankReserveEntity;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import java.util.Optional;

public interface BankReserveRepository extends JpaRepository<BankReserveEntity, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT b FROM BankReserveEntity b WHERE b.id = (SELECT MIN(b2.id) FROM BankReserveEntity b2)")
    Optional<BankReserveEntity> findMasterForUpdate();

    @Query("SELECT b FROM BankReserveEntity b WHERE b.id = (SELECT MIN(b2.id) FROM BankReserveEntity b2)")
    Optional<BankReserveEntity> findMaster();
}
