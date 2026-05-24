package com.bravus.bank.ledger.service;

import com.bravus.bank.db.entity.TransactionEntity;
import com.bravus.bank.db.entity.UserEntity;
import com.bravus.bank.db.repo.TransactionRepository;
import com.bravus.bank.db.repo.UserRepository;
import com.bravus.bank.ledger.entity.CreditUsageEntity;
import com.bravus.bank.ledger.entity.LedgerEntryEntity;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Transferência escritural ENTRE CLIENTES Bravus.
 *
 * Fluxo atômico:
 *   1. Locks pessimistas em remetente e destinatário (ordenados por id para evitar deadlock)
 *   2. Valida saldo escritural disponível do remetente
 *   3. Consome crédito do remetente via CreditService.useCredit
 *   4. Cria 2 transactions (TRANSFER_OUT no remetente, TRANSFER_IN no destinatário)
 *   5. Atualiza balances cached em users
 *
 * Não envolve ledger entries adicionais além dos gerados pelo useCredit
 * (que já registra DÉBITO 2.1.1 / CRÉDITO 1.2.2 com hash chain).
 */
@Service
public class InternalTransferService {

    private static final Logger log = LoggerFactory.getLogger(InternalTransferService.class);

    private final UserRepository userRepo;
    private final TransactionRepository txRepo;
    private final CreditService creditService;

    public InternalTransferService(UserRepository userRepo,
                                   TransactionRepository txRepo,
                                   CreditService creditService) {
        this.userRepo = userRepo;
        this.txRepo = txRepo;
        this.creditService = creditService;
    }

    @Transactional(isolation = Isolation.SERIALIZABLE)
    public TransferResult transfer(Long fromUserId, Long toUserId,
                                   Long valorCentavos, String descricao) {
        if (fromUserId.equals(toUserId))
            throw new IllegalArgumentException("Remetente e destinatário não podem ser o mesmo usuário");
        if (valorCentavos == null || valorCentavos <= 0)
            throw new IllegalArgumentException("Valor deve ser positivo");

        // Lock ordenado por id (evita deadlock)
        Long firstId  = Math.min(fromUserId, toUserId);
        Long secondId = Math.max(fromUserId, toUserId);
        UserEntity uA = userRepo.findById(firstId)
                .orElseThrow(() -> new IllegalArgumentException("Usuário não encontrado: " + firstId));
        UserEntity uB = userRepo.findById(secondId)
                .orElseThrow(() -> new IllegalArgumentException("Usuário não encontrado: " + secondId));

        UserEntity from = uA.getId().equals(fromUserId) ? uA : uB;
        UserEntity to   = uA.getId().equals(toUserId)   ? uA : uB;

        if (from.getBalance() < valorCentavos)
            throw new IllegalStateException(String.format(
                    "Saldo insuficiente. Disponível: %d centavos, requisitado: %d",
                    from.getBalance(), valorCentavos));

        // 1. TRANSFER_OUT
        TransactionEntity txOut = new TransactionEntity();
        txOut.setUser(from);
        txOut.setType("TRANSFER_OUT");
        txOut.setAmount(valorCentavos);
        txOut.setDescription(descricao);
        txOut.setDestinationAccount(to.getAccountNumber());
        txOut.setStatus("COMPLETED");
        txOut = txRepo.save(txOut);

        // 2. Consome crédito (gera ledger entry com hash chain)
        CreditService.UseCommand useCmd = new CreditService.UseCommand();
        useCmd.userId = from.getId();
        useCmd.valor = valorCentavos;
        useCmd.tipo = "TRANSFERENCIA_INTERNA";
        useCmd.transactionId = txOut.getId();
        useCmd.criadoPor = from.getUsername();
        useCmd.observacao = "Transferência para " + to.getAccountNumber();
        List<CreditUsageEntity> usages = creditService.useCredit(useCmd);

        // 3. TRANSFER_IN no destinatário
        TransactionEntity txIn = new TransactionEntity();
        txIn.setUser(to);
        txIn.setType("TRANSFER_IN");
        txIn.setAmount(valorCentavos);
        txIn.setDescription(descricao);
        txIn.setDestinationAccount(from.getAccountNumber());
        txIn.setStatus("COMPLETED");
        txIn = txRepo.save(txIn);

        // 4. Atualiza balances cached
        from.setBalance(from.getBalance() - valorCentavos);
        to.setBalance(to.getBalance() + valorCentavos);
        userRepo.save(from);
        userRepo.save(to);

        log.info("Transferência interna: {} → {}  valor={} centavos  txOut={}  txIn={}  usages={}",
                from.getUsername(), to.getUsername(), valorCentavos,
                txOut.getId(), txIn.getId(), usages.size());

        TransferResult r = new TransferResult();
        r.transactionOutId = txOut.getId();
        r.transactionInId = txIn.getId();
        r.valor = valorCentavos;
        r.saldoRemetente = from.getBalance();
        r.saldoDestinatario = to.getBalance();
        r.creditUsageIds = usages.stream().map(CreditUsageEntity::getId).toList();
        // pega o ledger entry do primeiro usage como referência
        if (!usages.isEmpty()) {
            r.ledgerEntryId = usages.get(0).getLedgerEntryId();
        }
        return r;
    }

    public static class TransferResult {
        public Long transactionOutId;
        public Long transactionInId;
        public Long valor;
        public Long saldoRemetente;
        public Long saldoDestinatario;
        public Long ledgerEntryId;
        public List<Long> creditUsageIds;
    }
}
