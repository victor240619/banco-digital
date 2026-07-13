package com.bravus.bank.rail;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CaymanRailParticipantRepository extends JpaRepository<CaymanRailParticipantEntity, Long> {
    Optional<CaymanRailParticipantEntity> findByParticipantCode(String participantCode);
    List<CaymanRailParticipantEntity> findAllByOrderByCreatedAtDesc();
    long countByStatus(String status);
}
