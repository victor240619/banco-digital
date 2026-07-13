package com.bravus.bank.ledger.service;

import com.bravus.bank.compliance.DocumentAnalysisService;
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

@Service
public class CreditService {

    private static final Logger log = LoggerFactory.getLogger(CreditService.class);

    private final CreditGrantRepository grantRepo;
    private final CreditUsageRepository usageRepo;
    private final InternalReserveRepository reserveRepo;
    private final BankReserveRepository bankReserveRepo;
    private final UserRepository userRepo;
    private final LedgerService ledgerService;
    private final DocumentAnalysisService documentAnalysisService;

    public CreditService(CreditGrantRepository grantRepo,
                         CreditUsageRepository usageRepo,
                         InternalReserveRepository reserveRepo,
                         BankReserveRepository bankReserveRepo,
                         UserRepository userRepo,
                         LedgerService ledgerService,
                         DocumentAnalysisService documentAnalysisService) {
        this.grantRepo = grantRepo;
        this.usageRepo = usageRepo;
        this.reserveRepo = reserveRepo;
        this.bankReserveRepo = bankReserveRepo;
        this.userRepo = userRepo;
        this.ledgerService = ledgerService;
        this.documentAnalysisService = documentAnalysisService;
    }

    @Transactional(isolation = Isolation.SERIALIZABLE)
    public CreditGrantEntity grantCredit(GrantCommand cmd) {
        CreditGrantEntity pending = issuePendingCredit(cmd);
        return releaseCredit(pending.getId(), cmd.aprovadoPorId);
    }

    @Transactional(isolation = Isolation.SERIALIZABLE)
    public CreditGrantEntity issuePendingCredit(GrantCommand cmd) {
        if (cmd.valor == null || cmd.valor <= 0) {
            throw new IllegalArgumentException("Valor deve ser positivo");
        }

        InternalReserveEntity reserve = reserveRepo.findByCodigo(cmd.reservaCodigo)
                .orElseThrow(() -> new IllegalStateException("Reserva interna nao encontrada: " + cmd.reservaCodigo));
        if (!reserve.getAtiva()) {
            throw new IllegalStateException("Reserva " + reserve.getCodigo() + " inativa");
        }

        UserEntity user = userRepo.findById(cmd.userId)
                .orElseThrow(() -> new IllegalArgumentException("Usuario nao encontrado: " + cmd.userId));
        documentAnalysisService.assertApprovedForUser(user);

        UserEntity admin = (cmd.aprovadoPorId != null)
                ? userRepo.findById(cmd.aprovadoPorId).orElse(null) : null;

        CreditGrantEntity grant = new CreditGrantEntity();
        grant.setUser(user);
        grant.setInternalReserve(reserve);
        grant.setValorConcedido(cmd.valor);
        grant.setValorDisponivel(cmd.valor);
        grant.setStatus("PENDENTE");
        grant.setMotivoConcessao(cmd.motivo);
        grant.setRegraElegibilidade(cmd.regraElegibilidade);
        grant.setTaxaJurosAnual(cmd.taxaJurosAnual != null ? cmd.taxaJurosAnual : BigDecimal.ZERO);
        grant.setDataConcessao(OffsetDateTime.now());
        grant.setDataVencimento(cmd.dataVencimento);
        grant.setAprovadoPor(admin);
        grant.setObservacoes(cmd.observacoes);
        grant = grantRepo.save(grant);

        log.info("Credito escritural pendente: grant_id={} user={} valor={} reserva={}",
                grant.getId(), user.getUsername(), cmd.valor, reserve.getCodigo());

        return grant;
    }

    @Transactional(isolation = Isolation.SERIALIZABLE)
    public CreditGrantEntity releaseCredit(Long grantId, Long aprovadoPorId) {
        CreditGrantEntity grant = grantRepo.findByIdForUpdate(grantId)
                .orElseThrow(() -> new IllegalArgumentException("Credito escritural nao encontrado: " + grantId));

        if ("ATIVO".equals(grant.getStatus())) return grant;
        if (!"PENDENTE".equals(grant.getStatus()) && !"APROVADO".equals(grant.getStatus())) {
            throw new IllegalStateException("Credito escritural nao pode ser liberado no status " + grant.getStatus());
        }

        BankReserveEntity master = bankReserveRepo.findMasterForUpdate()
                .orElseThrow(() -> new IllegalStateException("Reserva mestre nao inicializada"));
        if (!"ATIVA".equals(master.getStatus())) {
            throw new IllegalStateException("Reserva mestre esta " + master.getStatus());
        }

        InternalReserveEntity reserve = reserveRepo.findByCodigoForUpdate(grant.getInternalReserve().getCodigo())
                .orElseThrow(() -> new IllegalStateException("Reserva interna nao encontrada"));
        if (!reserve.getAtiva()) {
            throw new IllegalStateException("Reserva " + reserve.getCodigo() + " inativa");
        }

        long valor = grant.getValorConcedido();
        long disponivelInterna = reserve.getValorDisponivel();
        if (valor > disponivelInterna) {
            throw new IllegalStateException(String.format(
                    "Reserva %s nao tem saldo. Disponivel: %d centavos, solicitado: %d",
                    reserve.getCodigo(), disponivelInterna, valor));
        }

        long capacidadeRestante = master.getCapacidadeTotalEmissao() - master.getTotalEmitido();
        if (valor > capacidadeRestante) {
            throw new IllegalStateException(String.format(
                    "Capacidade de emissao excedida. Restante: %d centavos, solicitado: %d",
                    capacidadeRestante, valor));
        }

        UserEntity user = grant.getUser();
        documentAnalysisService.assertApprovedForUser(user);

        UserEntity admin = (aprovadoPorId != null)
                ? userRepo.findById(aprovadoPorId).orElse(grant.getAprovadoPor())
                : grant.getAprovadoPor();

        LedgerService.AppendEntryCommand ec = LedgerService.AppendEntryCommand.of(
                "CONCESSAO",
                "Liberacao de credito escritural - usuario " + user.getUsername(),
                "1.2.1", "2.1.1",
                valor);
        ec.referenciaTipo = "CreditGrant";
        ec.referenciaId = grant.getId();
        ec.criadoPor = (admin != null ? admin.getUsername() : "SYSTEM");
        ec.observacao = grant.getMotivoConcessao();
        LedgerEntryEntity entry = ledgerService.appendEntry(ec);

        grant.setLedgerEntryId(entry.getId());
        grant.setStatus("ATIVO");
        grant.setAprovadoPor(admin);

        reserve.setValorAlocado(reserve.getValorAlocado() + valor);
        reserve.setValorDisponivel(reserve.getValorDisponivel() - valor);
        reserveRepo.save(reserve);

        master.setTotalEmitido(master.getTotalEmitido() + valor);
        bankReserveRepo.save(master);

        user.setBalance(user.getBalance() + valor);
        userRepo.save(user);

        grant = grantRepo.save(grant);

        log.info("Credito escritural liberado: grant_id={} user={} valor={} reserva={}",
                grant.getId(), user.getUsername(), valor, reserve.getCodigo());

        return grant;
    }

    @Transactional(isolation = Isolation.SERIALIZABLE)
    public List<CreditUsageEntity> useCredit(UseCommand cmd) {
        if (cmd.valor == null || cmd.valor <= 0) {
            throw new IllegalArgumentException("Valor deve ser positivo");
        }

        List<CreditGrantEntity> ativos = grantRepo.findActiveByUser(cmd.userId);
        Long totalDisponivel = ativos.stream().mapToLong(CreditGrantEntity::getValorDisponivel).sum();
        if (cmd.valor > totalDisponivel) {
            throw new IllegalStateException(String.format(
                    "Saldo escritural insuficiente. Disponivel: %d, solicitado: %d",
                    totalDisponivel, cmd.valor));
        }

        long restante = cmd.valor;
        java.util.List<CreditUsageEntity> usagens = new java.util.ArrayList<>();
        BankReserveEntity master = bankReserveRepo.findMasterForUpdate().orElseThrow();

        for (CreditGrantEntity grant : ativos) {
            if (restante <= 0) break;
            CreditGrantEntity locked = grantRepo.findByIdForUpdate(grant.getId()).orElseThrow();
            long usar = Math.min(restante, locked.getValorDisponivel());
            if (usar <= 0) continue;

            LedgerService.AppendEntryCommand ec = LedgerService.AppendEntryCommand.of(
                    "USO",
                    "Uso de credito - " + cmd.tipo + " (grant=" + locked.getId() + ")",
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

        log.info("Credito utilizado: user={} valor={} tipo={} usagens={}",
                cmd.userId, cmd.valor, cmd.tipo, usagens.size());
        return usagens;
    }

    public static class GrantCommand {
        public Long userId;
        public Long aprovadoPorId;
        public String reservaCodigo;
        public Long valor;
        public String motivo;
        public String regraElegibilidade;
        public BigDecimal taxaJurosAnual;
        public OffsetDateTime dataVencimento;
        public String observacoes;
    }

    public static class UseCommand {
        public Long userId;
        public Long valor;
        public String tipo;
        public Long transactionId;
        public String criadoPor;
        public String observacao;
    }
}
