package com.bravus.bank.payment.mp;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Cliente leve para a API REST do Mercado Pago.
 * Sem SDK pesado — chama direto api.mercadopago.com via HttpClient nativo do Java 17+.
 */
@Service
public class MercadoPagoService {

    private static final String API_BASE = "https://api.mercadopago.com";

    @Value("${MP_ACCESS_TOKEN:}")
    private String accessToken;

    @Value("${BRAVUS_PUBLIC_URL:https://bravus-bank-api.onrender.com}")
    private String publicUrl;

    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    private final ObjectMapper mapper = new ObjectMapper();

    public static class PayerInfo {
        public String email;
        public String firstName;
        public String lastName;
        public String cpf;        // só números ou com pontuação
        public String phoneArea;  // ex: "62"
        public String phoneNumber; // ex: "999875592"
    }

    /**
     * Cria uma cobrança PIX no Mercado Pago.
     * Em produção (live_mode=true), o MP exige payer completo (nome, CPF, email real)
     * pra não rejeitar com rejected_high_risk.
     */
    public JsonNode createPixPayment(long amountCentavos,
                                     String description,
                                     PayerInfo payer,
                                     String externalReference) throws Exception {
        if (accessToken == null || accessToken.isBlank()) {
            throw new IllegalStateException("MP_ACCESS_TOKEN não configurado");
        }

        double amount = amountCentavos / 100.0;

        // Monta payer completo
        Map<String, Object> payerMap = new LinkedHashMap<>();
        payerMap.put("email", payer.email != null && !payer.email.isBlank()
                ? payer.email : "cliente@bravusbank.com");

        if (payer.firstName != null && !payer.firstName.isBlank()) {
            payerMap.put("first_name", payer.firstName);
        }
        if (payer.lastName != null && !payer.lastName.isBlank()) {
            payerMap.put("last_name", payer.lastName);
        }
        if (payer.cpf != null && !payer.cpf.isBlank()) {
            String cpfDigits = payer.cpf.replaceAll("[^0-9]", "");
            Map<String, Object> ident = new HashMap<>();
            ident.put("type", "CPF");
            ident.put("number", cpfDigits);
            payerMap.put("identification", ident);
        }

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("transaction_amount", amount);
        body.put("description", description == null ? "Depósito Bravus Bank" : description);
        body.put("payment_method_id", "pix");
        body.put("payer", payerMap);
        body.put("external_reference", externalReference == null ? UUID.randomUUID().toString() : externalReference);
        body.put("notification_url", publicUrl + "/api/payments/mp/webhook");
        body.put("statement_descriptor", "BRAVUSBANK");

        String json = mapper.writeValueAsString(body);
        String idempotencyKey = UUID.randomUUID().toString();

        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(API_BASE + "/v1/payments"))
                .timeout(Duration.ofSeconds(30))
                .header("Authorization", "Bearer " + accessToken)
                .header("Content-Type", "application/json")
                .header("X-Idempotency-Key", idempotencyKey)
                .POST(HttpRequest.BodyPublishers.ofString(json))
                .build();

        HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());

        if (resp.statusCode() >= 400) {
            throw new RuntimeException("Mercado Pago retornou " + resp.statusCode() + ": " + resp.body());
        }

        return mapper.readTree(resp.body());
    }

    /** Consulta um pagamento por ID. Usado no webhook pra confirmar status. */
    public JsonNode getPayment(String paymentId) throws Exception {
        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(API_BASE + "/v1/payments/" + paymentId))
                .timeout(Duration.ofSeconds(30))
                .header("Authorization", "Bearer " + accessToken)
                .GET()
                .build();

        HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());

        if (resp.statusCode() >= 400) {
            throw new RuntimeException("MP getPayment falhou " + resp.statusCode() + ": " + resp.body());
        }

        return mapper.readTree(resp.body());
    }
}
