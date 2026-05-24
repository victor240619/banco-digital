package com.bravus.bank.ledger.repo;

import com.bravus.bank.ledger.entity.InternalReserveEntity;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface InternalReserveRepository extends JpaRepository<InternalReserveEntity, Long> {

    Optional<InternalReserveEntity> findByCodigo(String codigo);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT r FROM InternalReserveEntity r WHERE r.id = :id")
    Optional<InternalReserveEntity> findByIdForUpdate(@Param("id") Long id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT r FROM InternalReserveEntity r WHERE r.codigo = :codigo")
    Optional<InternalReserveEntity> findByCodigoForUpdate(@Param("codigo") String codigo);

    List<InternalReserveEntity> findByAtivaTrue();
}
