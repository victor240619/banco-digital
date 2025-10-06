package com.bravus.bank.db.repo;

import com.bravus.bank.db.entity.AccountEntity;
import com.bravus.bank.db.entity.CustomerEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface AccountRepository extends JpaRepository<AccountEntity, Long> {
    Optional<AccountEntity> findByCustomer(CustomerEntity customer);
}
