package com.bravus.bank.ledger.repo;

import com.bravus.bank.ledger.entity.CreditGrantEntity;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface CreditGrantRepository extends JpaRepository<CreditGrantEntity, Long> {

    List<CreditGrantEntity> findByUserIdOrderByDataConcessaoDesc(Long userId);

    List<CreditGrantEntity> findByUserIdAndStatus(Long userId, String status);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT g FROM CreditGrantEntity g WHERE g.id = :id")
    Optional<CreditGrantEntity> findByIdForUpdate(@Param("id") Long id);

    @Query("SELECT g FROM CreditGrantEntity g " +
           "WHERE g.user.id = :userId AND g.status = 'ATIVO' AND g.valorDisponivel > 0 " +
           "ORDER BY g.dataConcessao ASC")
    List<CreditGrantEntity> findActiveByUser(@Param("userId") Long userId);

    @Query("SELECT COALESCE(SUM(g.valorDisponivel), 0) FROM CreditGrantEntity g " +
           "WHERE g.user.id = :userId AND g.status = 'ATIVO'")
    Long sumAvailableByUser(@Param("userId") Long userId);
}
