package com.bravus.bank.external;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Collection;
import java.util.Optional;

public interface ExternalTransferRepository extends JpaRepository<ExternalTransferEntity, Long> {
    List<ExternalTransferEntity> findAllByOrderByCreatedAtDesc(Pageable pageable);
    List<ExternalTransferEntity> findByUserIdOrderByCreatedAtDesc(Long userId, Pageable pageable);
    Optional<ExternalTransferEntity> findByTransactionId(Long transactionId);
    Optional<ExternalTransferEntity> findTopByBeneficiaryDocumentAndAccountNumberAndAmountCentavosOrderByCreatedAtDesc(
            String beneficiaryDocument,
            String accountNumber,
            Long amountCentavos);
    Optional<ExternalTransferEntity> findTopByBeneficiaryDocumentAndAccountNumberInAndAmountCentavosOrderByCreatedAtDesc(
            String beneficiaryDocument,
            Collection<String> accountNumbers,
            Long amountCentavos);
}
