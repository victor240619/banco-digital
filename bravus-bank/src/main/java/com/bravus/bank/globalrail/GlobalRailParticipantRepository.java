package com.bravus.bank.globalrail;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface GlobalRailParticipantRepository extends JpaRepository<GlobalRailParticipantEntity, Long> {
    Optional<GlobalRailParticipantEntity> findByParticipantCode(String participantCode);
    Optional<GlobalRailParticipantEntity> findFirstByNetworkAndBankCodeOrderByUpdatedAtDesc(String network, String bankCode);
    Optional<GlobalRailParticipantEntity> findFirstByNetworkAndIspbOrderByUpdatedAtDesc(String network, String ispb);
    List<GlobalRailParticipantEntity> findAllByOrderByCreatedAtDesc();
}
