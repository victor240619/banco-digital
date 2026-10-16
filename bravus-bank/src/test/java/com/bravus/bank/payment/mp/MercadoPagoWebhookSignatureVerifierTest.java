package com.bravus.bank.payment.mp;

import org.junit.jupiter.api.Test;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.HexFormat;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class MercadoPagoWebhookSignatureVerifierTest {
    private static final Instant NOW = Instant.parse("2026-10-16T12:00:00Z");
    private static final String SECRET = "test-webhook-secret";

    @Test
    void acceptsValidOrderSignatureAndNormalizesOrderIdToLowercase() {
        MercadoPagoWebhookSignatureVerifier verifier = verifier(Duration.ofMinutes(5));
        String orderId = "ORD01ABCDEF";
        String requestId = "request-123";
        String timestamp = String.valueOf(NOW.toEpochMilli());
        String manifest = "id:" + orderId.toLowerCase() + ";request-id:" + requestId + ";ts:" + timestamp + ";";
        String signature = "ts=" + timestamp + ",v1=" + hmac(SECRET, manifest);

        assertDoesNotThrow(() -> verifier.verify(signature, requestId, orderId));
    }

    @Test
    void rejectsTamperedSignature() {
        MercadoPagoWebhookSignatureVerifier verifier = verifier(Duration.ofMinutes(5));
        String timestamp = String.valueOf(NOW.toEpochMilli());

        MercadoPagoIntegrationException exception = assertThrows(
                MercadoPagoIntegrationException.class,
                () -> verifier.verify("ts=" + timestamp + ",v1=" + "0".repeat(64), "request-123", "ORD01ABC"));

        assertEquals("MP_INVALID_SIGNATURE", exception.getCode());
    }

    @Test
    void rejectsStaleSignatureBeforeProviderLookup() {
        MercadoPagoWebhookSignatureVerifier verifier = verifier(Duration.ofMinutes(5));
        String timestamp = String.valueOf(NOW.minus(Duration.ofMinutes(6)).toEpochMilli());
        String manifest = "id:ord01abc;request-id:request-123;ts:" + timestamp + ";";
        String signature = "ts=" + timestamp + ",v1=" + hmac(SECRET, manifest);

        MercadoPagoIntegrationException exception = assertThrows(
                MercadoPagoIntegrationException.class,
                () -> verifier.verify(signature, "request-123", "ORD01ABC"));

        assertEquals("MP_STALE_SIGNATURE", exception.getCode());
    }

    private MercadoPagoWebhookSignatureVerifier verifier(Duration tolerance) {
        MercadoPagoProperties properties = new MercadoPagoProperties(
                true, "test-token", SECRET, "https://api.mercadopago.com",
                100, 1_000_000, Duration.ofMinutes(30), tolerance);
        return new MercadoPagoWebhookSignatureVerifier(properties, Clock.fixed(NOW, ZoneOffset.UTC));
    }

    private String hmac(String secret, String message) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return HexFormat.of().formatHex(mac.doFinal(message.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception exception) {
            throw new IllegalStateException(exception);
        }
    }
}
