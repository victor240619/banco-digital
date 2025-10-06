package com.bravus.bank.db.repo;

import com.bravus.bank.db.entity.CustomerEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface CustomerRepository extends JpaRepository<CustomerEntity, Long> {
    Optional<CustomerEntity> findByStripeCustomerId(String stripeCustomerId);
}
