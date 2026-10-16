package com.bravus.bank.payment.mp;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/payments/mp")
public class MercadoPagoController {
    private final MercadoPagoPixOrderService pixOrderService;
    private final MercadoPagoWebhookSignatureVerifier signatureVerifier;
    private final MercadoPagoWebhookService webhookService;

    public MercadoPagoController(
            MercadoPagoPixOrderService pixOrderService,
            MercadoPagoWebhookSignatureVerifier signatureVerifier,
            MercadoPagoWebhookService webhookService) {
        this.pixOrderService = pixOrderService;
        this.signatureVerifier = signatureVerifier;
        this.webhookService = webhookService;
    }

    public record PixRequest(
            @NotNull @Min(1) Long amountCentavos,
            @Size(max = 255) String description) {}

    @PostMapping("/orders/pix")
    public ResponseEntity<MercadoPagoPixOrderService.PixOrderResult> createPixOrder(
            @RequestBody @Valid PixRequest request,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            Authentication authentication) {
        return ResponseEntity.ok(pixOrderService.create(
                authentication.getName(),
                request.amountCentavos(),
                request.description(),
                idempotencyKey));
    }

    @PostMapping("/webhook")
    public ResponseEntity<?> webhook(
            @RequestParam(name = "data.id") String providerOrderId,
            @RequestParam(name = "type", required = false) String queryType,
            @RequestHeader("x-signature") String signature,
            @RequestHeader("x-request-id") String requestId,
            @RequestBody(required = false) Map<String, Object> body) {
        signatureVerifier.verify(signature, requestId, providerOrderId);
        String eventType = body == null
                ? stringValue(queryType, "order")
                : stringValue(body.get("type"), stringValue(queryType, "order"));
        String action = body == null ? null : stringValue(body.get("action"), null);
        MercadoPagoWebhookService.WebhookResult result = webhookService.process(
                providerOrderId, requestId, eventType, action);
        return ResponseEntity.ok(result);
    }

    @ExceptionHandler(MercadoPagoIntegrationException.class)
    public ResponseEntity<Map<String, String>> integrationError(MercadoPagoIntegrationException exception) {
        HttpStatus status = switch (exception.getCode()) {
            case "MP_INVALID_SIGNATURE", "MP_STALE_SIGNATURE" -> HttpStatus.UNAUTHORIZED;
            case "IDEMPOTENCY_CONFLICT", "IDEMPOTENCY_RACE" -> HttpStatus.CONFLICT;
            case "MP_DISABLED", "MP_NOT_CONFIGURED", "MP_WEBHOOK_NOT_CONFIGURED" -> HttpStatus.SERVICE_UNAVAILABLE;
            case "MP_PROVIDER_ERROR", "MP_PROVIDER_UNAVAILABLE", "MP_PROVIDER_INTERRUPTED" -> HttpStatus.BAD_GATEWAY;
            case "ACCOUNT_NOT_FOUND", "MP_LOCAL_ORDER_NOT_FOUND" -> HttpStatus.NOT_FOUND;
            default -> HttpStatus.BAD_REQUEST;
        };
        return ResponseEntity.status(status).body(Map.of(
                "code", exception.getCode(),
                "message", exception.getMessage()));
    }

    private String stringValue(Object value, String fallback) {
        if (value == null) return fallback;
        String normalized = String.valueOf(value).trim();
        return normalized.isBlank() ? fallback : normalized;
    }
}
