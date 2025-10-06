package com.bravus.bank.ledger;

import com.bravus.bank.db.entity.AccountEntity;
import com.bravus.bank.db.entity.CustomerEntity;
import com.bravus.bank.db.entity.LedgerEntryEntity;
import com.bravus.bank.db.repo.AccountRepository;
import com.bravus.bank.db.repo.CustomerRepository;
import com.bravus.bank.db.repo.LedgerEntryRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class LedgerService {

    private final AccountRepository accountRepository;
    private final CustomerRepository customerRepository;
    private final LedgerEntryRepository ledgerEntryRepository;

    public LedgerService(AccountRepository accountRepository,
                         CustomerRepository customerRepository,
                         LedgerEntryRepository ledgerEntryRepository) {
        this.accountRepository = accountRepository;
        this.customerRepository = customerRepository;
        this.ledgerEntryRepository = ledgerEntryRepository;
    }

    @Transactional
    public AccountEntity ensureAccountForStripeCustomer(String stripeCustomerId, String currency) {
        CustomerEntity customer = customerRepository.findByStripeCustomerId(stripeCustomerId)
                .orElseThrow(() -> new IllegalArgumentException("Cliente não encontrado"));
        return accountRepository.findByCustomer(customer).orElseGet(() -> {
            AccountEntity account = new AccountEntity();
            account.setCustomer(customer);
            account.setCurrency(currency);
            return accountRepository.save(account);
        });
    }

    @Transactional
    public void credit(AccountEntity account, long amount, String currency, String description, String refType, String refId) {
        LedgerEntryEntity e = new LedgerEntryEntity();
        e.setAccount(account);
        e.setType("CREDIT");
        e.setAmount(amount);
        e.setCurrency(currency);
        e.setDescription(description);
        e.setReferenceType(refType);
        e.setReferenceId(refId);
        ledgerEntryRepository.save(e);
    }

    @Transactional
    public void debit(AccountEntity account, long amount, String currency, String description, String refType, String refId) {
        long balance = ledgerEntryRepository.computeBalance(account);
        if (balance < amount) throw new IllegalStateException("Saldo insuficiente");
        LedgerEntryEntity e = new LedgerEntryEntity();
        e.setAccount(account);
        e.setType("DEBIT");
        e.setAmount(amount);
        e.setCurrency(currency);
        e.setDescription(description);
        e.setReferenceType(refType);
        e.setReferenceId(refId);
        ledgerEntryRepository.save(e);
    }

    @Transactional(readOnly = true)
    public long balance(AccountEntity account) {
        return ledgerEntryRepository.computeBalance(account);
    }
}
