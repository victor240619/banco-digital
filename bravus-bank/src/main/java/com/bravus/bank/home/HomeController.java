package com.bravus.bank.home;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ResponseBody;

import java.util.HashMap;
import java.util.Map;

@Controller
public class HomeController {

    @GetMapping("/")
    @ResponseBody
    public Map<String, Object> home() {
        Map<String, Object> response = new HashMap<>();
        response.put("service", "Bravus CyberBank API");
        response.put("version", "2.0.0");
        response.put("status", "online");
        response.put("message", "Banco Digital do Futuro - API funcionando corretamente");
        
        Map<String, String> endpoints = new HashMap<>();
        endpoints.put("auth", "/api/auth/*");
        endpoints.put("customers", "/api/customers");
        endpoints.put("payments", "/api/payments");
        endpoints.put("transfers", "/api/transfers");
        endpoints.put("frontend", "http://localhost:3000");
        
        response.put("endpoints", endpoints);
        return response;
    }

    @GetMapping("/health")
    @ResponseBody
    public Map<String, String> health() {
        Map<String, String> response = new HashMap<>();
        response.put("status", "UP");
        response.put("service", "Bravus CyberBank");
        return response;
    }
}