package com.bravus.bank.payment.mp;

import com.bravus.bank.db.entity.TransactionEntity;
import com.bravus.bank.db.entity.UserEntity;
import com.bravus.bank.db.repo.TransactionRepository;
import com.bravus.bank.db.repo.UserRepository;
import com.bravus.bank.user.transfer.AccountLedgerEntryEntity;
import com.bravus.bank.user.transfer.AccountLedgerEntryRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;

@Service
public class MercadoPagoSettlementService {
    private static final String PROVIDER_ACCOUNT = "MERCADOPAGO-CUSTODY";

    private final MercadoPagoPixOrderRepository orderRepository;
    private final UserRepository userRepository;
    private final TransactionRepository transactionRepository;
    private final AccountLedgerEntryRepository accountLedgerRepository;
    private final MercadoPagoPixOrderStore orderStore;

    public MercadoPagoSettlementService(
            MercadoPagoPixOrderRepository orderRepository,
            UserRepository userRepository,
            TransactionRepository transactionRepository,
            AccountLedgerEntryRepository accountLedgerRepository,
            MercadoPagoPixOrderStore orderStore) {
        this.orderRepository = orderRepository;
        this.userRepository = userRepository;
        this.transactionRepository = transactionRepository;
        this.accountLedgerRepository = accountLedgerRepository;
        this.orderStore = orderStore;
    }

    @Transactional(isolation = Isolation.SERIALIZABLE)
    public SettlementResult apply(MercadoPagoOrdersGateway.OrderSnapshot providerOrder) {
        MercadoPagoPixOrderEntity order = orderRepository.findByProviderOrderIdForUpdate(providerOrder.orderId())
                .orElseGet(() -> orderRepository
                        .findByExternalReferenceForUpdate(providerOrder.externalReference())
                        .orElseThrow(() -> new MercadoPagoIntegrationException(
                                "MP_UNKNOWN_ORDER",
                                "Order do Mercado Pago não pertence à Vantyx.")));

        orderStore.validateProviderOrder(order, providerOrder);
        boolean alreadyCredited = order.getCreditedAt() != null;

        if (alreadyCredited && !isAccredited(providerOrder)) {
            order.setStatus("REVIEW_REQUIRED");
            order.setStatusDetail(providerOrder.statusDetail());
            orderRepository.save(order);
            return new SettlementResult(order.getId(), false, true, "REVIEW_REQUIRED");
        }

        orderStore.applyProviderSnapshot(order, providerOrder);
        if (!isAccredited(providerOrder)) {
            orderRepository.save(order);
            return new SettlementResult(order.getId(), false, alreadyCredited, order.getStatus());
        }
        if (alreadyCredited) {
            order.setStatus("CREDITED");
            orderRepository.save(order);
            return new SettlementResult(order.getId(), false, true, "CREDITED");
        }

        UserEntity user = userRepository.findByIdForUpdate(order.getUser().getId())
                .orElseThrow(() -> new MercadoPagoIntegrationException("ACCOUNT_NOT_FOUND", "Conta não encontrada."));

        long oldBalance = user.getBalance() == null ? 0L : user.getBalance();
        long newBalance;
        try {
            newBalance = Math.addExact(oldBalance, order.getAmountCentavos());
        } catch (ArithmeticException overflow) {
            throw new MercadoPagoIntegrationException("BALANCE_OVERFLOW", "Saldo excede o limite suportado.", overflow);
        }
        user.setBalance(newBalance);
        userRepository.save(user);

        TransactionEntity transaction = new TransactionEntity();
        transaction.setUser(user);
        transaction.setType("DEPOSIT");
        transaction.setAmount(order.getAmountCentavos());
        transaction.setDescription(order.getDescription());
        transaction.setDestinationAccount(user.getAccountNumber());
        transaction.setStatus("COMPLETED");
        transaction = transactionRepository.save(transaction);

        String transferId = "mp-order:" + providerOrder.orderId();
        accountLedgerRepository.saveAll(List.of(
                ledgerSide(transferId, transaction.getId(), null, PROVIDER_ACCOUNT, "debit", -order.getAmountCentavos()),
                ledgerSide(transferId, transaction.getId(), user, user.getAccountNumber(), "credit", order.getAmountCentavos())));

        order.setStatus("CREDITED");
        order.setStatusDetail("accredited");
        order.setTransactionId(transaction.getId());
        order.setCreditedAt(OffsetDateTime.now());
        orderRepository.save(order);
        return new SettlementResult(order.getId(), true, false, "CREDITED");
    }

    private AccountLedgerEntryEntity ledgerSide(
            String transferId,
            Long transactionId,
            UserEntity user,
            String accountNumber,
            String entryType,
            Long signedAmount) {
        AccountLedgerEntryEntity entry = new AccountLedgerEntryEntity();
        entry.setTransferId(transferId);
        entry.setTransactionId(transactionId);
        entry.setUser(user);
        entry.setAccountNumber(accountNumber);
        entry.setEntryType(entryType);
        entry.setSignedAmountCentavos(signedAmount);
        entry.setCurrency("BRL");
        entry.setReason("MERCADO_PAGO_PIX_DEPOSIT");
        return entry;
    }

    private boolean isAccredited(MercadoPagoOrdersGateway.OrderSnapshot order) {
        return "processed".equals(order.status()) && "accredited".equals(order.statusDetail());
    }

    public record SettlementResult(
            java.util.UUID requestId,
            boolean credited,
            boolean idempotentReplay,
            String status) {}
}
