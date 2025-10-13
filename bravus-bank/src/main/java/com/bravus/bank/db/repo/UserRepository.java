package com.bravus.bank.db.repo;

import com.bravus.bank.db.entity.UserEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<UserEntity, Long> {
    Optional<UserEntity> findByUsername(String username);
    Optional<UserEntity> findByEmail(String email);
    Optional<UserEntity> findByAccountNumber(String accountNumber);
    boolean existsByUsername(String username);
    boolean existsByEmail(String email);
    boolean existsByAccountNumber(String accountNumber);
    boolean existsByCpf(String cpf);
}
