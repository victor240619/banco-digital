package com.bravus.bank.payment.mp;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface MercadoPagoWebhookEventRepository extends JpaRepository<MercadoPagoWebhookEventEntity, Long> {
    Optional<MercadoPagoWebhookEventEntity> findByRequestId(String requestId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select e from MercadoPagoWebhookEventEntity e where e.requestId = :requestId")
    Optional<MercadoPagoWebhookEventEntity> findByRequestIdForUpdate(@Param("requestId") String requestId);
}
