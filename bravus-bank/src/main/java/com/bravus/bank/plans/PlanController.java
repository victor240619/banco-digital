package com.bravus.bank.plans;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.*;

@RestController
@RequestMapping("/api/plans")
public class PlanController {

    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> list() {
        List<Map<String, Object>> plans = Arrays.stream(PricingPlan.values())
                .map(p -> {
                    Map<String, Object> m = new HashMap<>();
                    m.put("code", p.getCode());
                    m.put("amount", p.getAmountInCents());
                    m.put("currency", "BRL");
                    m.put("description", p.getDescription());
                    return m;
                })
                .toList();
        return ResponseEntity.ok(plans);
    }
}
