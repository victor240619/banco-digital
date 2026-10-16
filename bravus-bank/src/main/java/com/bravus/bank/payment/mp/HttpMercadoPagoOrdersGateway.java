package com.bravus.bank.payment.mp;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Component
public class HttpMercadoPagoOrdersGateway implements MercadoPagoOrdersGateway {
    private final MercadoPagoProperties properties;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    public HttpMercadoPagoOrdersGateway(MercadoPagoProperties properties, ObjectMapper objectMapper) {
        this(properties, objectMapper, HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .build());
    }

    HttpMercadoPagoOrdersGateway(
            MercadoPagoProperties properties,
            ObjectMapper objectMapper,
            HttpClient httpClient) {
        this.properties = properties;
        this.objectMapper = objectMapper;
        this.httpClient = httpClient;
    }

    @Override
    public OrderSnapshot createPixOrder(CreatePixOrderCommand command) {
        properties.requireOrdersApi();
        String amount = centsToDecimal(command.amountCentavos());

        Map<String, Object> paymentMethod = new LinkedHashMap<>();
        paymentMethod.put("id", "pix");
        paymentMethod.put("type", "bank_transfer");

        Map<String, Object> payment = new LinkedHashMap<>();
        payment.put("amount", amount);
        payment.put("payment_method", paymentMethod);
        payment.put("expiration_time", command.expirationTime());

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("type", "online");
        body.put("total_amount", amount);
        body.put("external_reference", command.externalReference());
        body.put("processing_mode", "automatic");
        body.put("transactions", Map.of("payments", List.of(payment)));
        body.put("payer", Map.of("email", command.payerEmail()));

        return send("POST", "/v1/orders", command.idempotencyKey(), body);
    }

    @Override
    public OrderSnapshot getOrder(String providerOrderId) {
        properties.requireOrdersApi();
        if (providerOrderId == null || !providerOrderId.matches("[A-Za-z0-9_-]{1,80}")) {
            throw new MercadoPagoIntegrationException("MP_INVALID_ORDER_ID", "Identificador de order inválido.");
        }
        return send("GET", "/v1/orders/" + providerOrderId, null, null);
    }

    private OrderSnapshot send(String method, String path, String idempotencyKey, Object body) {
        try {
            HttpRequest.Builder builder = HttpRequest.newBuilder()
                    .uri(URI.create(properties.getApiBaseUrl() + path))
                    .timeout(Duration.ofSeconds(10))
                    .header("Authorization", "Bearer " + properties.getAccessToken())
                    .header("Accept", "application/json");
            if (idempotencyKey != null) builder.header("X-Idempotency-Key", idempotencyKey);

            if ("POST".equals(method)) {
                builder.header("Content-Type", "application/json")
                        .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(body)));
            } else {
                builder.GET();
            }

            HttpResponse<String> response = httpClient.send(builder.build(), HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new MercadoPagoIntegrationException(
                        "MP_PROVIDER_ERROR",
                        "Mercado Pago recusou a operação (HTTP " + response.statusCode() + ").");
            }
            return parseOrder(objectMapper.readTree(response.body()));
        } catch (MercadoPagoIntegrationException exception) {
            throw exception;
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new MercadoPagoIntegrationException("MP_PROVIDER_INTERRUPTED", "Comunicação com o Mercado Pago interrompida.", exception);
        } catch (Exception exception) {
            throw new MercadoPagoIntegrationException("MP_PROVIDER_UNAVAILABLE", "Mercado Pago indisponível no momento.", exception);
        }
    }

    OrderSnapshot parseOrder(JsonNode order) {
        JsonNode payment = order.path("transactions").path("payments").path(0);
        JsonNode paymentMethod = payment.path("payment_method");
        String amountText = firstText(order, "total_amount");
        if (amountText == null) amountText = firstText(payment, "amount");
        if (amountText == null) {
            throw new MercadoPagoIntegrationException("MP_INVALID_RESPONSE", "Mercado Pago retornou resposta sem valor.");
        }
        long amountCentavos = parseCents(amountText);

        String paidAmountText = firstText(order, "total_paid_amount");
        if (paidAmountText == null) paidAmountText = firstText(payment, "paid_amount");
        Long paidAmountCentavos = paidAmountText == null ? null : parseCents(paidAmountText);

        String currency = firstText(order, "currency", "currency_id");
        if (currency == null) currency = firstText(payment, "currency", "currency_id");
        if (currency == null) {
            throw new MercadoPagoIntegrationException("MP_INVALID_RESPONSE", "Mercado Pago retornou resposta sem moeda.");
        }

        String qrCodeBase64 = firstText(paymentMethod, "qr_code_base64", "qr_code_based64");
        return new OrderSnapshot(
                requiredText(order, "id"),
                payment.path("id").asText(null),
                requiredText(order, "external_reference"),
                amountCentavos,
                paidAmountCentavos,
                currency,
                firstText(paymentMethod, "id"),
                firstText(paymentMethod, "type"),
                requiredText(order, "status"),
                order.path("status_detail").asText(payment.path("status_detail").asText("")),
                paymentMethod.path("qr_code").asText(null),
                qrCodeBase64,
                paymentMethod.path("ticket_url").asText(null));
    }

    private long parseCents(String amount) {
        try {
            return new BigDecimal(amount)
                    .movePointRight(2)
                    .setScale(0, RoundingMode.UNNECESSARY)
                    .longValueExact();
        } catch (ArithmeticException | NumberFormatException exception) {
            throw new MercadoPagoIntegrationException(
                    "MP_INVALID_AMOUNT_RESPONSE",
                    "Mercado Pago retornou valor inválido.",
                    exception);
        }
    }

    private String firstText(JsonNode node, String... fields) {
        for (String field : fields) {
            String value = node.path(field).asText("").trim();
            if (!value.isBlank()) return value;
        }
        return null;
    }

    private String requiredText(JsonNode node, String field) {
        String value = node.path(field).asText("");
        if (value.isBlank()) {
            throw new MercadoPagoIntegrationException("MP_INVALID_RESPONSE", "Mercado Pago retornou resposta incompleta.");
        }
        return value;
    }

    private String centsToDecimal(long cents) {
        return BigDecimal.valueOf(cents, 2).setScale(2, RoundingMode.UNNECESSARY).toPlainString();
    }
}
