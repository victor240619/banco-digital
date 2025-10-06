package com.bravus.bank.account;

import com.bravus.bank.config.BankProperties;
import com.bravus.bank.db.entity.AccountEntity;
import com.bravus.bank.db.entity.CustomerEntity;
import com.bravus.bank.db.repo.AccountRepository;
import com.bravus.bank.db.repo.CustomerRepository;
import com.bravus.bank.ledger.LedgerService;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/accounts")
public class AccountController {
    private final LedgerService ledgerService;
    private final CustomerRepository customerRepository;
    private final AccountRepository accountRepository;
    private final BankProperties properties;

    public AccountController(LedgerService ledgerService, CustomerRepository customerRepository, AccountRepository accountRepository, BankProperties properties) {
        this.ledgerService = ledgerService;
        this.customerRepository = customerRepository;
        this.accountRepository = accountRepository;
        this.properties = properties;
    }

    public record CreateAccountRequest(@NotBlank String stripeCustomerId) {}
    public record BalanceResponse(long balance, String currency) {}

    @PostMapping
    public ResponseEntity<?> create(@RequestBody CreateAccountRequest req) {
        AccountEntity account = ledgerService.ensureAccountForStripeCustomer(req.stripeCustomerId(), properties.getDefaultCurrency());
        long balance = ledgerService.balance(account);
        return ResponseEntity.ok(new BalanceResponse(balance, account.getCurrency()));
    }

    @GetMapping("/{stripeCustomerId}/balance")
    public ResponseEntity<?> balance(@PathVariable String stripeCustomerId) {
        AccountEntity account = ledgerService.ensureAccountForStripeCustomer(stripeCustomerId, properties.getDefaultCurrency());
        long balance = ledgerService.balance(account);
        return ResponseEntity.ok(new BalanceResponse(balance, account.getCurrency()));
    }

    public record TransferInternalRequest(@NotBlank String fromStripeCustomerId, @NotBlank String toStripeCustomerId, long amountInCents, String description) {}

    @PostMapping("/transfer-internal")
    public ResponseEntity<?> transferInternal(@RequestBody TransferInternalRequest req) {
        AccountEntity from = ledgerService.ensureAccountForStripeCustomer(req.fromStripeCustomerId(), properties.getDefaultCurrency());
        AccountEntity to = ledgerService.ensureAccountForStripeCustomer(req.toStripeCustomerId(), properties.getDefaultCurrency());
        ledgerService.debit(from, req.amountInCents(), properties.getDefaultCurrency(), req.description(), "INTERNAL_TRANSFER", null);
        ledgerService.credit(to, req.amountInCents(), properties.getDefaultCurrency(), req.description(), "INTERNAL_TRANSFER", null);
        return ResponseEntity.ok().build();
    }
}
