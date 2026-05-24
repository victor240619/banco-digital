package com.bravus.bank.ledger.repo;

import com.bravus.bank.ledger.entity.LedgerAccountEntity;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface LedgerAccountRepository extends JpaRepository<LedgerAccountEntity, Long> {

    Optional<LedgerAccountEntity> findByCodigo(String codigo);

    List<LedgerAccountEntity> findByTipoOrderByCodigo(String tipo);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT a FROM LedgerAccountEntity a WHERE a.codigo = :codigo")
    Optional<LedgerAccountEntity> findByCodigoForUpdate(@Param("codigo") String codigo);
}
