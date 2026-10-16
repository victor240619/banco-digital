package com.bravus.bank.payment.mp;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface MercadoPagoPixOrderRepository extends JpaRepository<MercadoPagoPixOrderEntity, UUID> {
    Optional<MercadoPagoPixOrderEntity> findByUserIdAndClientIdempotencyKey(Long userId, String key);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select o from MercadoPagoPixOrderEntity o where o.id = :id")
    Optional<MercadoPagoPixOrderEntity> findByIdForUpdate(@Param("id") UUID id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select o from MercadoPagoPixOrderEntity o where o.providerOrderId = :providerOrderId")
    Optional<MercadoPagoPixOrderEntity> findByProviderOrderIdForUpdate(
            @Param("providerOrderId") String providerOrderId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select o from MercadoPagoPixOrderEntity o where o.externalReference = :externalReference")
    Optional<MercadoPagoPixOrderEntity> findByExternalReferenceForUpdate(
            @Param("externalReference") String externalReference);
}
