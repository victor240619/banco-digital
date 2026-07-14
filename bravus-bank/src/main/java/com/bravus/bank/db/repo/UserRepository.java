package com.bravus.bank.db.repo;

import com.bravus.bank.db.entity.UserEntity;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<UserEntity, Long> {
    Optional<UserEntity> findByUsername(String username);
    Optional<UserEntity> findByEmail(String email);
    Optional<UserEntity> findByCpf(String cpf);
    Optional<UserEntity> findByAccountNumber(String accountNumber);
    Optional<UserEntity> findByChavePix(String chavePix);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select u from UserEntity u where u.id in :ids order by u.id")
    List<UserEntity> findAllByIdInOrderByIdForUpdate(@Param("ids") Collection<Long> ids);

    boolean existsByUsername(String username);
    boolean existsByEmail(String email);
    boolean existsByAccountNumber(String accountNumber);
    boolean existsByCpf(String cpf);
}
