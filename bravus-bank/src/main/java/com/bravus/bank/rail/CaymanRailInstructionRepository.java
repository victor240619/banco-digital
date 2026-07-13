package com.bravus.bank.rail;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CaymanRailInstructionRepository extends JpaRepository<CaymanRailInstructionEntity, Long> {
    List<CaymanRailInstructionEntity> findAllByOrderByCreatedAtDesc(Pageable pageable);
    long countByStatus(String status);
}
