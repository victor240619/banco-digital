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
        List<CreditGrantEntity> all = grantRepo.findByUserIdOrderByDataConcessaoDesc(user.getId());
        for (CreditGrantEntity g : all) {
            totalConcedido += g.getValorConcedido();
            totalUsado += g.getValorUsado();
            totalLiquidado += g.getValorLiquidado();
        }

        Map<String,Object> resp = new HashMap<>();
        resp.put("userId", user.getId());
        resp.put("username", user.getUsername());
        resp.put("balanceCentavos", user.getBalance());
        resp.put("creditoDisponivelCentavos", disponivel);
        resp.put("creditoTotalConcedidoCentavos", totalConcedido);
        resp.put("creditoTotalUsadoCentavos", totalUsado);
        resp.put("creditoTotalLiquidadoCentavos", totalLiquidado);
        resp.put("grants", all);
        return ResponseEntity.ok(resp);
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
