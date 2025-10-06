package com.bravus.bank.plans;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Arrays;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/plans")
public class PlanController {

    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> list() {
        List<Map<String, Object>> plans = Arrays.stream(PricingPlan.values())
                .map(p -> Map.of(
                        "code", p.getCode(),
                        "amount", p.getAmountInCents(),
                        "currency", "BRL",
                        "description", p.getDescription()
                )).toList();
        return ResponseEntity.ok(plans);
    }
}
