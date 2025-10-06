package com.bravus.bank.db.repo;

import com.bravus.bank.db.entity.PaymentEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface PaymentRepository extends JpaRepository<PaymentEntity, Long> {
    Optional<PaymentEntity> findByStripePaymentIntentId(String stripePaymentIntentId);
}
