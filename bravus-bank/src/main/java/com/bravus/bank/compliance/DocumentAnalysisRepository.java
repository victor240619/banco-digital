package com.bravus.bank.compliance;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DocumentAnalysisRepository extends JpaRepository<DocumentAnalysisEntity, Long> {
    List<DocumentAnalysisEntity> findAllByOrderByCreatedAtDesc(Pageable pageable);
}
