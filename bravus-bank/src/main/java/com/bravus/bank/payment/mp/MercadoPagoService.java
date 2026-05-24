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

    /**
     * Cria uma cobrança PIX no Mercado Pago.
     * Retorna o objeto Payment completo com qr_code e ticket_url.
     */
    public JsonNode createPixPayment(long amountCentavos,
                                     String description,
                                     String payerEmail,
                                     String externalReference) throws Exception {
        if (accessToken == null || accessToken.isBlank()) {
            throw new IllegalStateException("MP_ACCESS_TOKEN não configurado");
        }

        double amount = amountCentavos / 100.0;

        Map<String, Object> body = Map.of(
                "transaction_amount", amount,
                "description", description == null ? "Depósito Bravus Bank" : description,
                "payment_method_id", "pix",
                "payer", Map.of("email", payerEmail == null ? "cliente@bravusbank.com" : payerEmail),
                "external_reference", externalReference == null ? UUID.randomUUID().toString() : externalReference,
                "notification_url", publicUrl + "/api/payments/mp/webhook"
        );

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

    /**
     * Consulta um pagamento por ID. Usado no webhook pra confirmar status.
     */
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
