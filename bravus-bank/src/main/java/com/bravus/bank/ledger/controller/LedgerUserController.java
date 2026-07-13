package com.bravus.bank.ledger.controller;

import com.bravus.bank.db.entity.UserEntity;
import com.bravus.bank.db.repo.UserRepository;
import com.bravus.bank.ledger.entity.CreditGrantEntity;
import com.bravus.bank.ledger.entity.CreditUsageEntity;
import com.bravus.bank.ledger.repo.CreditGrantRepository;
import com.bravus.bank.ledger.repo.CreditUsageRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Endpoints para o usuário comum consultar seu crédito escritural.
 */
@RestController
@RequestMapping("/api/credit")
public class LedgerUserController {

    private final CreditGrantRepository grantRepo;
    private final CreditUsageRepository usageRepo;
    private final UserRepository userRepo;

    public LedgerUserController(CreditGrantRepository grantRepo,
                                CreditUsageRepository usageRepo,
                                UserRepository userRepo) {
        this.grantRepo = grantRepo;
        this.usageRepo = usageRepo;
        this.userRepo = userRepo;
    }

    /** Resumo do crédito ativo do usuário autenticado. */
    @GetMapping("/summary")
    public ResponseEntity<Map<String,Object>> summary(Authentication auth) {
        UserEntity user = userRepo.findByUsername(auth.getName())
                .orElseThrow(() -> new IllegalStateException("Usuário não encontrado"));

        Long disponivel = grantRepo.sumAvailableByUser(user.getId());

        long totalConcedido = 0, totalUsado = 0, totalLiquidado = 0;
        long dividaPrincipal = 0, jurosAcumulado = 0;
        BigDecimal taxaPonderadaNumerador = BigDecimal.ZERO;
        BigDecimal principalPonderador = BigDecimal.ZERO;
        List<CreditGrantEntity> all = grantRepo.findByUserIdOrderByDataConcessaoDesc(user.getId());
        for (CreditGrantEntity g : all) {
            totalConcedido += g.getValorConcedido();
            totalUsado += g.getValorUsado();
            totalLiquidado += g.getValorLiquidado();

            long principalAberto = principalAberto(g);
            dividaPrincipal += principalAberto;
            jurosAcumulado += jurosAcumulados(g, principalAberto);
            if (principalAberto > 0 && g.getTaxaJurosAnual() != null) {
                BigDecimal peso = BigDecimal.valueOf(principalAberto);
                taxaPonderadaNumerador = taxaPonderadaNumerador.add(g.getTaxaJurosAnual().multiply(peso));
                principalPonderador = principalPonderador.add(peso);
            }
        }
        BigDecimal taxaMediaAnual = principalPonderador.compareTo(BigDecimal.ZERO) == 0
                ? BigDecimal.ZERO
                : taxaPonderadaNumerador.divide(principalPonderador, 2, RoundingMode.HALF_UP);
        BigDecimal taxaMensalEquivalente = taxaMediaAnual.divide(BigDecimal.valueOf(12), 2, RoundingMode.HALF_UP);

        Map<String,Object> resp = new HashMap<>();
        resp.put("userId", user.getId());
        resp.put("username", user.getUsername());
        resp.put("balanceCentavos", user.getBalance());
        resp.put("creditoDisponivelCentavos", disponivel);
        resp.put("creditoTotalConcedidoCentavos", totalConcedido);
        resp.put("creditoTotalUsadoCentavos", totalUsado);
        resp.put("creditoTotalLiquidadoCentavos", totalLiquidado);
        resp.put("dividaPrincipalCentavos", dividaPrincipal);
        resp.put("jurosAcumuladoCentavos", jurosAcumulado);
        resp.put("dividaTotalCentavos", dividaPrincipal + jurosAcumulado);
        resp.put("taxaJurosAnualMedia", taxaMediaAnual);
        resp.put("taxaJurosMensalEquivalente", taxaMensalEquivalente);
        resp.put("criterioJuros", "Juros simples proporcionais ao tempo desde a concessao, sobre o principal em aberto.");
        resp.put("grants", all);
        return ResponseEntity.ok(resp);
    }

    private long principalAberto(CreditGrantEntity grant) {
        long concedido = nullToZero(grant.getValorConcedido());
        long liquidado = nullToZero(grant.getValorLiquidado());
        long inadimplente = nullToZero(grant.getValorInadimplente());
        return Math.max(0L, concedido - liquidado - inadimplente);
    }

    private long jurosAcumulados(CreditGrantEntity grant, long principalAberto) {
        if (principalAberto <= 0 || grant.getTaxaJurosAnual() == null
                || grant.getTaxaJurosAnual().compareTo(BigDecimal.ZERO) <= 0
                || grant.getDataConcessao() == null) {
            return 0L;
        }

        long seconds = Math.max(0L, Duration.between(grant.getDataConcessao(), OffsetDateTime.now()).getSeconds());
        BigDecimal principal = BigDecimal.valueOf(principalAberto);
        BigDecimal annualRate = grant.getTaxaJurosAnual().divide(BigDecimal.valueOf(100), 12, RoundingMode.HALF_UP);
        BigDecimal elapsedYearFraction = BigDecimal.valueOf(seconds)
                .divide(BigDecimal.valueOf(365L * 24L * 60L * 60L), 12, RoundingMode.HALF_UP);
        return principal.multiply(annualRate)
                .multiply(elapsedYearFraction)
                .setScale(0, RoundingMode.HALF_UP)
                .longValue();
    }

    private long nullToZero(Long value) {
        return value == null ? 0L : value;
    }

    /** Histórico de utilização para um grant específico (se for do usuário). */
    @GetMapping("/grants/{grantId}/usages")
    public ResponseEntity<List<CreditUsageEntity>> usages(@PathVariable Long grantId,
                                                          Authentication auth) {
        UserEntity user = userRepo.findByUsername(auth.getName()).orElseThrow();
        CreditGrantEntity grant = grantRepo.findById(grantId)
                .orElseThrow(() -> new IllegalArgumentException("Grant não encontrado"));
        if (!grant.getUser().getId().equals(user.getId())) {
            return ResponseEntity.status(403).build();
        }
        return ResponseEntity.ok(usageRepo.findByCreditGrantIdOrderByCreatedAtDesc(grantId));
    }
}
