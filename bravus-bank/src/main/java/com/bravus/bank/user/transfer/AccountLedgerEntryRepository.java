package com.bravus.bank.user.transfer;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AccountLedgerEntryRepository extends JpaRepository<AccountLedgerEntryEntity, Long> {
    List<AccountLedgerEntryEntity> findByTransferIdOrderByIdAsc(String transferId);
}
