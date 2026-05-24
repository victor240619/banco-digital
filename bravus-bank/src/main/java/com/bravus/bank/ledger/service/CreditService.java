package com.bravus.bank.ledger.service;

import com.bravus.bank.db.entity.UserEntity;
import com.bravus.bank.db.repo.UserRepository;
import com.bravus.bank.ledger.entity.*;
import com.bravus.bank.ledger.repo.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;

/**
 * Serviço de concessão e uso de crédito escritural.
 *
 * Regras de negócio:
 *   • Admin emite crédito → DÉBITO 1.2.1 Créditos Concedidos / CRÉDITO 2.1.1 Obrigações
 *     (banco passa a dever ao cliente um saldo escritural)
 *   • Cliente usa crédito → DÉBITO 2.1.1 Obrigações / CRÉDITO 1.2.2 Créditos em Uso
 *     (quita parte da obrigação, registra uso)
 *   • Liquidação → DÉBITO 1.2.2 / CRÉDITO 2.1.2
 *   • Inadimplência → DÉBITO 1.2.3 / CRÉDITO 1.2.2
 *
 * Nenhuma concessão pode exceder:
 *   • saldo da reserva interna escolhida
 *   • capacidade de emissão da reserva mestre (capital × multiplicador)
 */
@Service
public class CreditService {

    private static final Logger log = LoggerFactory.getLogger(CreditService.class);

    private final CreditGrantRepository grantRepo;
    private final CreditUsageRepository usageRepo;
    private final InternalReserveRepository reserveRepo;
    private final BankReserveRepository bankReserveRepo;
    private final UserRepository userRepo;
    private final LedgerService ledgerService;

    public CreditService(CreditGrantRepository grantRepo,
                         CreditUsageRepository usageRepo,
                         InternalReserveRepository reserveRepo,
                         BankReserveRepository bankReserveRepo,
                         UserRepository userRepo,
                         LedgerService ledgerService) {
        this.grantRepo = grantRepo;
        this.usageRepo = usageRepo;
        this.reserveRepo = reserveRepo;
        this.bankReserveRepo = bankReserveRepo;
        this.userRepo = userRepo;
        this.ledgerService = ledgerService;
    }

    /**
     * Concede crédito escritural a um usuário.
     */
    @Transactional(isolation = Isolation.SERIALIZABLE)
    public CreditGrantEntity grantCredit(GrantCommand cmd) {
        if (cmd.valor == null || cmd.valor <= 0)
            throw new IllegalArgumentException("Valor deve ser positivo");

        // 1. Locks pessimistas em reserva mestre + interna
        BankReserveEntity master = bankReserveRepo.findMasterForUpdate()
                .orElseThrow(() -> new IllegalStateException("Reserva mestre não inicializada"));
        if (!"ATIVA".equals(master.getStatus()))
            throw new IllegalStateException("Reserva mestre está " + master.getStatus());

        InternalReserveEntity reserve = reserveRepo.findByCodigoForUpdate(cmd.reservaCodigo)
                .orElseThrow(() -> new IllegalStateException("Reserva interna não encontrada: " + cmd.reservaCodigo));
        if (!reserve.getAtiva())
            throw new IllegalStateException("Reserva " + reserve.getCodigo() + " inativa");

        // 2. Validações de capacidade
        long disponivelInterna = reserve.getValorDisponivel();
        if (cmd.valor > disponivelInterna)
            throw new IllegalStateException(String.format(
                    "Reserva %s não tem saldo. Disponível: %d centavos, solicitado: %d",
                    reserve.getCodigo(), disponivelInterna, cmd.valor));

        long capacidadeRestante = master.getCapacidadeTotalEmissao() - master.getTotalEmitido();
        if (cmd.valor > capacidadeRestante)
            throw new IllegalStateException(String.format(
                    "Capacidade de emissão excedida. Restante: %d centavos, solicitado: %d",
                    capacidadeRestante, cmd.valor));

        UserEntity user = userRepo.findById(cmd.userId)
                .orElseThrow(() -> new IllegalArgumentException("Usuário não encontrado: " + cmd.userId));

        UserEntity admin = (cmd.aprovadoPorId != null)
                ? userRepo.findById(cmd.aprovadoPorId).orElse(null) : null;

        // 3. Cria o registro de concessão (sem ledger_entry_id ainda)
        CreditGrantEntity grant = new CreditGrantEntity();
        grant.setUser(user);
        grant.setInternalReserve(reserve);
        grant.setValorConcedido(cmd.valor);
        grant.setValorDisponivel(cmd.valor);
        grant.setStatus("ATIVO");
        grant.setMotivoConcessao(cmd.motivo);
        grant.setRegraElegibilidade(cmd.regraElegibilidade);
        grant.setTaxaJurosAnual(cmd.taxaJurosAnual != null ? cmd.taxaJurosAnual : BigDecimal.ZERO);
        grant.setDataConcessao(OffsetDateTime.now());
        grant.setDataVencimento(cmd.dataVencimento);
        grant.setAprovadoPor(admin);
        grant.setObservacoes(cmd.observacoes);
        grant = grantRepo.save(grant);

        // 4. Lançamento contábil:
        //    DÉBITO  1.2.1 Créditos Concedidos a Clientes
        //    CRÉDITO 2.1.1 Obrigações Escriturais
        LedgerService.AppendEntryCommand ec = LedgerService.AppendEntryCommand.of(
                "CONCESSAO",
                "Concessão de crédito escritural — usuário " + user.getUsername(),
                "1.2.1", "2.1.1",
                cmd.valor);
        ec.referenciaTipo = "CreditGrant";
        ec.referenciaId = grant.getId();
        ec.criadoPor = (admin != null ? admin.getUsername() : "SYSTEM");
        ec.observacao = cmd.motivo;
        LedgerEntryEntity entry = ledgerService.appendEntry(ec);

        grant.setLedgerEntryId(entry.getId());
        grant = grantRepo.save(grant);

        // 5. Atualiza saldos da reserva interna e da reserva mestre
        reserve.setValorAlocado(reserve.getValorAlocado() + cmd.valor);
        reserve.setValorDisponivel(reserve.getValorDisponivel() - cmd.valor);
        reserveRepo.save(reserve);

        master.setTotalEmitido(master.getTotalEmitido() + cmd.valor);
        bankReserveRepo.save(master);

        // 6. Atualiza balance do usuário (refletindo o crédito escritural disponível)
        user.setBalance(user.getBalance() + cmd.valor);
        userRepo.save(user);

        log.info("Crédito concedido: grant_id={} user={} valor={} reserva={}",
                grant.getId(), user.getUsername(), cmd.valor, reserve.getCodigo());

        return grant;
    }

    /**
     * Consome crédito disponível do usuário (usa o método FIFO entre grants ativos).
     * Gera um lançamento contábil de USO e um CreditUsage rastreando a movimentação.
     *
     * @return lista de CreditUsage gerados (pode envolver múltiplos grants se um só não cobrir)
     */
    @Transactional(isolation = Isolation.SERIALIZABLE)
    public List<CreditUsageEntity> useCredit(UseCommand cmd) {
        if (cmd.valor == null || cmd.valor <= 0)
            throw new IllegalArgumentException("Valor deve ser positivo");

        List<CreditGrantEntity> ativos = grantRepo.findActiveByUser(cmd.userId);
        Long totalDisponivel = ativos.stream().mapToLong(CreditGrantEntity::getValorDisponivel).sum();
        if (cmd.valor > totalDisponivel)
            throw new IllegalStateException(String.format(
                    "Saldo escritural insuficiente. Disponível: %d, solicitado: %d",
                    totalDisponivel, cmd.valor));

        long restante = cmd.valor;
        java.util.List<CreditUsageEntity> usagens = new java.util.ArrayList<>();
        BankReserveEntity master = bankReserveRepo.findMasterForUpdate().orElseThrow();

        for (CreditGrantEntity grant : ativos) {
            if (restante <= 0) break;
            CreditGrantEntity locked = grantRepo.findByIdForUpdate(grant.getId()).orElseThrow();
            long usar = Math.min(restante, locked.getValorDisponivel());
            if (usar <= 0) continue;

            // Lançamento DÉBITO 2.1.1 / CRÉDITO 1.2.2
            LedgerService.AppendEntryCommand ec = LedgerService.AppendEntryCommand.of(
                    "USO",
                    "Uso de crédito — " + cmd.tipo + " (grant=" + locked.getId() + ")",
                    "2.1.1", "1.2.2", usar);
            ec.referenciaTipo = "CreditGrant";
            ec.referenciaId = locked.getId();
            ec.criadoPor = cmd.criadoPor != null ? cmd.criadoPor : "SYSTEM";
            ec.observacao = cmd.observacao;
            LedgerEntryEntity entry = ledgerService.appendEntry(ec);

            long saldoAntes = locked.getValorDisponivel();
            locked.setValorDisponivel(saldoAntes - usar);
            locked.setValorUsado(locked.getValorUsado() + usar);
            grantRepo.save(locked);

            CreditUsageEntity usage = new CreditUsageEntity();
            usage.setCreditGrant(locked);
            usage.setTransactionId(cmd.transactionId);
            usage.setValor(usar);
            usage.setTipo(cmd.tipo);
            usage.setSaldoAntes(saldoAntes);
            usage.setSaldoDepois(saldoAntes - usar);
            usage.setLedgerEntryId(entry.getId());
            usagens.add(usageRepo.save(usage));

            restante -= usar;
        }

        master.setTotalEmCirculacao(master.getTotalEmCirculacao() + cmd.valor);
        bankReserveRepo.save(master);

        log.info("Crédito utilizado: user={} valor={} tipo={} usagens={}",
                cmd.userId, cmd.valor, cmd.tipo, usagens.size());
        return usagens;
    }

    public static class GrantCommand {
        public Long userId;
        public Long aprovadoPorId;
        public String reservaCodigo;   // ex: "PROMOCIONAL"
        public Long valor;             // em centavos
        public String motivo;
        public String regraElegibilidade;
        public BigDecimal taxaJurosAnual;
        public OffsetDateTime dataVencimento;
        public String observacoes;
    }

    public static class UseCommand {
        public Long userId;
        public Long valor;            // em centavos
        public String tipo;           // TRANSFERENCIA_INTERNA, PIX, BOLETO, ...
        public Long transactionId;
        public String criadoPor;
        public String observacao;
    }
}
