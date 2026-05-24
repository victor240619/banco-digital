package com.bravus.bank.ledger.repo;

import com.bravus.bank.ledger.entity.LedgerEntryEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface LedgerEntryRepository extends JpaRepository<LedgerEntryEntity, Long> {

    Optional<LedgerEntryEntity> findTopByOrderBySequenciaDesc();

    @Query("SELECT COALESCE(MAX(e.sequencia), 0) FROM LedgerEntryEntity e")
    Long findMaxSequencia();

    Page<LedgerEntryEntity> findAllByOrderBySequenciaDesc(Pageable pageable);

    List<LedgerEntryEntity> findByReferenciaTipoAndReferenciaId(String referenciaTipo, Long referenciaId);

    List<LedgerEntryEntity> findAllByOrderBySequenciaAsc();
}
