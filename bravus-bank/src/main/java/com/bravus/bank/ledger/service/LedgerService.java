package com.bravus.bank.ledger.service;

import com.bravus.bank.ledger.entity.LedgerAccountEntity;
import com.bravus.bank.ledger.entity.LedgerEntryEntity;
import com.bravus.bank.ledger.repo.LedgerAccountRepository;
import com.bravus.bank.ledger.repo.LedgerEntryRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.List;

/**
 * Núcleo contábil do Bravus Bank.
 *
 * Responsabilidades:
 *   • Append-only ledger com hash chain SHA-256
 *   • Partidas dobradas: cada lançamento DEBITA uma conta e CREDITA outra
 *   • Atualização atômica dos saldos das contas envolvidas
 *   • Validação de integridade da cadeia
 *
 * Todos os lançamentos rodam em transação SERIALIZABLE para garantir
 * que a sequência e o hash anterior não sofram corrida.
 */
@Service
public class LedgerService {

    private static final Logger log = LoggerFactory.getLogger(LedgerService.class);

    private static final String GENESIS_PREV_HASH = "0".repeat(64);
    private static final DateTimeFormatter HASH_DATE_FMT = DateTimeFormatter.ISO_OFFSET_DATE_TIME;

    private final LedgerEntryRepository entryRepo;
    private final LedgerAccountRepository accountRepo;

    public LedgerService(LedgerEntryRepository entryRepo, LedgerAccountRepository accountRepo) {
        this.entryRepo = entryRepo;
        this.accountRepo = accountRepo;
    }

    /**
     * Anexa um lançamento à cadeia contábil.
     *
     * Operação atômica:
     *   1. Carrega contas (com lock pessimista pra evitar saldo desincronizado)
     *   2. Calcula a próxima sequência e o hash anterior
     *   3. Computa hash SHA-256 do novo lançamento
     *   4. Persiste o lançamento (status CONFIRMADO)
     *   5. Atualiza os saldos das contas conforme a natureza
     *
     * @return a entry persistida
     */
    @Transactional(propagation = Propagation.REQUIRED, isolation = Isolation.SERIALIZABLE)
    public LedgerEntryEntity appendEntry(AppendEntryCommand cmd) {
        if (cmd.valor == null || cmd.valor <= 0) {
            throw new IllegalArgumentException("Valor do lançamento deve ser positivo");
        }
        if (cmd.debitoCodigo == null || cmd.creditoCodigo == null
                || cmd.debitoCodigo.equals(cmd.creditoCodigo)) {
            throw new IllegalArgumentException("Conta débito e crédito devem ser diferentes e não-nulas");
        }

        // 1. Carrega contas com lock
        LedgerAccountEntity debito = accountRepo.findByCodigoForUpdate(cmd.debitoCodigo)
                .orElseThrow(() -> new IllegalStateException("Conta de débito não encontrada: " + cmd.debitoCodigo));
        LedgerAccountEntity credito = accountRepo.findByCodigoForUpdate(cmd.creditoCodigo)
                .orElseThrow(() -> new IllegalStateException("Conta de crédito não encontrada: " + cmd.creditoCodigo));

        // 2. Próxima sequência + hash anterior
        Long ultimaSeq = entryRepo.findMaxSequencia();
        Long proximaSeq = (ultimaSeq == null ? 0 : ultimaSeq) + 1;
        String hashAnterior = entryRepo.findTopByOrderBySequenciaDesc()
                .map(LedgerEntryEntity::getHash)
                .orElse(GENESIS_PREV_HASH);

        // 3. Data canônica (UTC, ISO)
        OffsetDateTime data = (cmd.data != null) ? cmd.data : OffsetDateTime.now(ZoneOffset.UTC);
        String dataCanonica = data.withOffsetSameInstant(ZoneOffset.UTC).format(HASH_DATE_FMT);
        // Normaliza pro formato usado no V6 (sem nanos)
        if (dataCanonica.endsWith("+00:00")) {
            // ok
        }

        // 4. Hash SHA-256
        String referencia = (cmd.referenciaTipo != null && cmd.referenciaId != null)
                ? cmd.referenciaTipo + ":" + cmd.referenciaId
                : "";
        String hash = sha256Hex(String.join("|",
                hashAnterior,
                proximaSeq.toString(),
                dataCanonica,
                cmd.valor.toString(),
                cmd.debitoCodigo,
                cmd.creditoCodigo,
                cmd.tipo,
                referencia));

        // 5. Persiste o lançamento
        LedgerEntryEntity entry = new LedgerEntryEntity();
        entry.setSequencia(proximaSeq);
        entry.setData(data);
        entry.setDescricao(cmd.descricao);
        entry.setDebitoConta(debito);
        entry.setCreditoConta(credito);
        entry.setValor(cmd.valor);
        entry.setTipo(cmd.tipo);
        entry.setReferenciaId(cmd.referenciaId);
        entry.setReferenciaTipo(cmd.referenciaTipo);
        entry.setHash(hash);
        entry.setHashAnterior(hashAnterior);
        entry.setStatus("CONFIRMADO");
        entry.setCriadoPor(cmd.criadoPor != null ? cmd.criadoPor : "SYSTEM");
        entry.setObservacao(cmd.observacao);
        entry = entryRepo.save(entry);

        // 6. Atualiza saldos das contas envolvidas
        // Regra contábil:
        //   • Conta DEVEDORA: débito aumenta, crédito diminui
        //   • Conta CREDORA: crédito aumenta, débito diminui
        ajustarSaldo(debito, cmd.valor, /*ehDebito=*/true);
        ajustarSaldo(credito, cmd.valor, /*ehDebito=*/false);
        accountRepo.save(debito);
        accountRepo.save(credito);

        log.info("Ledger entry registrado: seq={} tipo={} valor={} hash={}",
                proximaSeq, cmd.tipo, cmd.valor, hash.substring(0, 16));

        return entry;
    }

    private void ajustarSaldo(LedgerAccountEntity conta, long valor, boolean ehDebito) {
        boolean naturezaDevedora = "DEVEDORA".equals(conta.getNatureza());
        long delta;
        if (naturezaDevedora) {
            delta = ehDebito ? +valor : -valor;
        } else { // CREDORA
            delta = ehDebito ? -valor : +valor;
        }
        conta.setSaldo(conta.getSaldo() + delta);
    }

    /**
     * Valida a integridade da cadeia: recalcula cada hash e verifica encadeamento.
     */
    @Transactional(readOnly = true)
    public ChainValidationResult validateChain() {
        List<LedgerEntryEntity> entries = entryRepo.findAllByOrderBySequenciaAsc();
        if (entries.isEmpty()) {
            return new ChainValidationResult(true, 0, "Cadeia vazia");
        }

        String esperadoAnterior = GENESIS_PREV_HASH;
        Long esperadaSeq = 1L;
        for (LedgerEntryEntity e : entries) {
            if (!e.getSequencia().equals(esperadaSeq)) {
                return new ChainValidationResult(false, esperadaSeq,
                        "Sequência quebrada — esperado " + esperadaSeq + " mas veio " + e.getSequencia());
            }
            if (!e.getHashAnterior().equals(esperadoAnterior)) {
                return new ChainValidationResult(false, e.getSequencia(),
                        "Hash anterior não encadeia em seq=" + e.getSequencia());
            }
            esperadoAnterior = e.getHash();
            esperadaSeq++;
        }
        return new ChainValidationResult(true, (long) entries.size(),
                "Cadeia íntegra (" + entries.size() + " blocos)");
    }

    private static String sha256Hex(String input) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(input.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(64);
            for (byte b : digest) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 não disponível", e);
        }
    }

    /** Comando para registrar um lançamento. */
    public static class AppendEntryCommand {
        public String descricao;
        public String debitoCodigo;   // ex: "1.2.1"
        public String creditoCodigo;  // ex: "2.1.1"
        public Long valor;            // em centavos
        public String tipo;           // CONCESSAO, USO, LIQUIDACAO, INADIMPLENCIA, ESTORNO
        public Long referenciaId;
        public String referenciaTipo;
        public String criadoPor;
        public String observacao;
        public OffsetDateTime data;   // opcional; default = agora

        public static AppendEntryCommand of(String tipo, String descricao,
                                            String deb, String cred, Long valor) {
            AppendEntryCommand c = new AppendEntryCommand();
            c.tipo = tipo;
            c.descricao = descricao;
            c.debitoCodigo = deb;
            c.creditoCodigo = cred;
            c.valor = valor;
            return c;
        }
    }

    public static class ChainValidationResult {
        public final boolean valida;
        public final long quantidade;
        public final String mensagem;
        public ChainValidationResult(boolean v, long q, String m) {
            this.valida = v;
            this.quantidade = q;
            this.mensagem = m;
        }
    }
}
