package com.bravus.bank.ledger.controller;

import com.bravus.bank.db.entity.UserEntity;
import com.bravus.bank.db.repo.UserRepository;
import com.bravus.bank.ledger.dto.BalanceSheetDto;
import com.bravus.bank.ledger.entity.CreditGrantEntity;
import com.bravus.bank.ledger.entity.LedgerEntryEntity;
import com.bravus.bank.ledger.repo.CreditGrantRepository;
import com.bravus.bank.ledger.repo.LedgerEntryRepository;
import com.bravus.bank.ledger.service.BalanceSheetService;
import com.bravus.bank.ledger.service.CreditService;
import com.bravus.bank.ledger.service.LedgerService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/ledger")
@PreAuthorize("hasRole('ADMIN')")
public class LedgerAdminController {

    private final BalanceSheetService balanceSheetService;
    private final CreditService creditService;
    private final LedgerService ledgerService;
    private final LedgerEntryRepository entryRepo;
    private final CreditGrantRepository grantRepo;
    private final UserRepository userRepo;

    public LedgerAdminController(BalanceSheetService balanceSheetService,
                                 CreditService creditService,
                                 LedgerService ledgerService,
                                 LedgerEntryRepository entryRepo,
                                 CreditGrantRepository grantRepo,
                                 UserRepository userRepo) {
        this.balanceSheetService = balanceSheetService;
        this.creditService = creditService;
        this.ledgerService = ledgerService;
        this.entryRepo = entryRepo;
        this.grantRepo = grantRepo;
        this.userRepo = userRepo;
    }

    /** Balanço completo do banco em tempo real. */
    @GetMapping("/balance-sheet")
    public ResponseEntity<BalanceSheetDto> balanceSheet() {
        return ResponseEntity.ok(balanceSheetService.build());
    }

    /** Livro razão paginado (entries mais recentes primeiro). */
    @GetMapping("/entries")
    public ResponseEntity<Page<LedgerEntryEntity>> listEntries(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        return ResponseEntity.ok(
                entryRepo.findAllByOrderBySequenciaDesc(PageRequest.of(page, size)));
    }

    /** Valida a integridade da hash chain. */
    @GetMapping("/validate-chain")
    public ResponseEntity<Map<String,Object>> validateChain() {
        LedgerService.ChainValidationResult r = ledgerService.validateChain();
        Map<String,Object> resp = new HashMap<>();
        resp.put("valida", r.valida);
        resp.put("quantidade", r.quantidade);
        resp.put("mensagem", r.mensagem);
        return ResponseEntity.ok(resp);
    }

    /** Concede crédito escritural a um usuário. */
    @PostMapping("/credit/grant")
    public ResponseEntity<CreditGrantEntity> grantCredit(@Valid @RequestBody GrantRequest req,
                                                         Authentication auth) {
        CreditGrantEntity grant = creditService.grantCredit(toGrantCommand(req, auth));
        return ResponseEntity.ok(grant);
    }

    /** Emite credito escritural pendente, sem liberar saldo ao usuario. */
    @PostMapping("/credit/issue")
    public ResponseEntity<CreditGrantEntity> issueCredit(@Valid @RequestBody GrantRequest req,
                                                         Authentication auth) {
        CreditGrantEntity grant = creditService.issuePendingCredit(toGrantCommand(req, auth));
        if (Boolean.TRUE.equals(req.liberarAgora)) {
            UserEntity admin = userRepo.findByUsername(auth.getName()).orElse(null);
            grant = creditService.releaseCredit(grant.getId(), admin != null ? admin.getId() : null);
        }
        return ResponseEntity.ok(grant);
    }

    /** Libera credito escritural pendente para saldo utilizavel. */
    @PostMapping("/credit/{grantId}/release")
    public ResponseEntity<CreditGrantEntity> releaseCredit(@PathVariable Long grantId,
                                                           Authentication auth) {
        UserEntity admin = userRepo.findByUsername(auth.getName()).orElse(null);
        CreditGrantEntity grant = creditService.releaseCredit(grantId, admin != null ? admin.getId() : null);
        return ResponseEntity.ok(grant);
    }

    /** Lista créditos concedidos a um usuário. */
    @GetMapping("/credit/by-user/{userId}")
    public ResponseEntity<List<CreditGrantEntity>> grantsByUser(@PathVariable Long userId) {
        return ResponseEntity.ok(grantRepo.findByUserIdOrderByDataConcessaoDesc(userId));
    }

    /** DTO de requisição de concessão. */
    public static class GrantRequest {
        @NotNull public Long userId;
        @NotNull public String reservaCodigo;
        @NotNull @Positive public Long valorCentavos;
        public String motivo;
        public String regraElegibilidade;
        public BigDecimal taxaJurosAnual;
        public OffsetDateTime dataVencimento;
        public String observacoes;
        public Boolean liberarAgora;
    }

    private CreditService.GrantCommand toGrantCommand(GrantRequest req, Authentication auth) {
        UserEntity admin = userRepo.findByUsername(auth.getName()).orElse(null);

        CreditService.GrantCommand cmd = new CreditService.GrantCommand();
        cmd.userId = req.userId;
        cmd.aprovadoPorId = admin != null ? admin.getId() : null;
        cmd.reservaCodigo = req.reservaCodigo;
        cmd.valor = req.valorCentavos;
        cmd.motivo = req.motivo;
        cmd.regraElegibilidade = req.regraElegibilidade;
        cmd.taxaJurosAnual = req.taxaJurosAnual != null ? req.taxaJurosAnual : BigDecimal.ZERO;
        cmd.dataVencimento = req.dataVencimento;
        cmd.observacoes = req.observacoes;
        return cmd;
    }
}
