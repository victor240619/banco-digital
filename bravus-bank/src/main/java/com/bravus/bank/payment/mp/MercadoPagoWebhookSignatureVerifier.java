package com.bravus.bank.payment.mp;

import org.springframework.stereotype.Component;
import org.springframework.beans.factory.annotation.Autowired;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Locale;

@Component
public class MercadoPagoWebhookSignatureVerifier {
    private final MercadoPagoProperties properties;
    private final Clock clock;

    @Autowired
    public MercadoPagoWebhookSignatureVerifier(MercadoPagoProperties properties) {
        this(properties, Clock.systemUTC());
    }

    MercadoPagoWebhookSignatureVerifier(MercadoPagoProperties properties, Clock clock) {
        this.properties = properties;
        this.clock = clock;
    }

    public void verify(String signatureHeader, String requestId, String dataId) {
        properties.requireWebhookVerification();
        if (isBlank(signatureHeader) || isBlank(requestId) || isBlank(dataId)) {
            throw new MercadoPagoIntegrationException("MP_INVALID_SIGNATURE", "Webhook sem assinatura válida.");
        }

        String timestamp = null;
        String suppliedSignature = null;
        for (String component : signatureHeader.split(",")) {
            String[] pair = component.trim().split("=", 2);
            if (pair.length != 2) continue;
            if ("ts".equals(pair[0])) timestamp = pair[1];
            if ("v1".equals(pair[0])) suppliedSignature = pair[1];
        }
        if (isBlank(timestamp) || isBlank(suppliedSignature) || !suppliedSignature.matches("[0-9a-fA-F]{64}")) {
            throw new MercadoPagoIntegrationException("MP_INVALID_SIGNATURE", "Webhook sem assinatura válida.");
        }

        verifyFreshness(timestamp, properties.getWebhookTolerance());
        String manifest = "id:" + dataId.toLowerCase(Locale.ROOT)
                + ";request-id:" + requestId
                + ";ts:" + timestamp + ";";
        String expected = hmacSha256(properties.getWebhookSecret(), manifest);
        boolean valid = MessageDigest.isEqual(
                expected.getBytes(StandardCharsets.US_ASCII),
                suppliedSignature.toLowerCase(Locale.ROOT).getBytes(StandardCharsets.US_ASCII));
        if (!valid) {
            throw new MercadoPagoIntegrationException("MP_INVALID_SIGNATURE", "Assinatura do webhook inválida.");
        }
    }

    private void verifyFreshness(String timestamp, Duration tolerance) {
        try {
            long raw = Long.parseLong(timestamp);
            Instant receivedAt = timestamp.length() >= 13
                    ? Instant.ofEpochMilli(raw)
                    : Instant.ofEpochSecond(raw);
            Duration age = Duration.between(receivedAt, clock.instant()).abs();
            if (age.compareTo(tolerance) > 0) {
                throw new MercadoPagoIntegrationException("MP_STALE_SIGNATURE", "Assinatura do webhook expirada.");
            }
        } catch (NumberFormatException exception) {
            throw new MercadoPagoIntegrationException("MP_INVALID_SIGNATURE", "Timestamp do webhook inválido.", exception);
        }
    }

    private String hmacSha256(String secret, String message) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return HexFormat.of().formatHex(mac.doFinal(message.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception exception) {
            throw new IllegalStateException("HMAC-SHA256 indisponível", exception);
        }
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
