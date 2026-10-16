package com.bravus.bank.payment.mp;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.Duration;

@Component
public class MercadoPagoProperties {
    private final boolean enabled;
    private final String accessToken;
    private final String webhookSecret;
    private final String apiBaseUrl;
    private final long minimumAmountCentavos;
    private final long maximumAmountCentavos;
    private final Duration pixExpiration;
    private final Duration webhookTolerance;

    public MercadoPagoProperties(
            @Value("${mercadopago.enabled:false}") boolean enabled,
            @Value("${mercadopago.access-token:}") String accessToken,
            @Value("${mercadopago.webhook-secret:}") String webhookSecret,
            @Value("${mercadopago.api-base-url:https://api.mercadopago.com}") String apiBaseUrl,
            @Value("${mercadopago.minimum-amount-centavos:100}") long minimumAmountCentavos,
            @Value("${mercadopago.maximum-amount-centavos:1000000}") long maximumAmountCentavos,
            @Value("${mercadopago.pix-expiration:PT30M}") Duration pixExpiration,
            @Value("${mercadopago.webhook-tolerance:PT5M}") Duration webhookTolerance) {
        this.enabled = enabled;
        this.accessToken = accessToken == null ? "" : accessToken.trim();
        this.webhookSecret = webhookSecret == null ? "" : webhookSecret.trim();
        this.apiBaseUrl = apiBaseUrl == null ? "" : apiBaseUrl.replaceAll("/+$", "");
        this.minimumAmountCentavos = minimumAmountCentavos;
        this.maximumAmountCentavos = maximumAmountCentavos;
        this.pixExpiration = pixExpiration;
        this.webhookTolerance = webhookTolerance;
    }

    public void requireOrdersApi() {
        if (!enabled) throw new MercadoPagoIntegrationException("MP_DISABLED", "Recebimentos Pix ainda não estão habilitados.");
        if (accessToken.isBlank()) throw new MercadoPagoIntegrationException("MP_NOT_CONFIGURED", "Credencial do Mercado Pago não configurada.");
    }

    public void requireWebhookVerification() {
        requireOrdersApi();
        if (webhookSecret.isBlank()) {
            throw new MercadoPagoIntegrationException("MP_WEBHOOK_NOT_CONFIGURED", "Assinatura do webhook não configurada.");
        }
    }

    public boolean isEnabled() { return enabled; }
    public String getAccessToken() { return accessToken; }
    public String getWebhookSecret() { return webhookSecret; }
    public String getApiBaseUrl() { return apiBaseUrl; }
    public long getMinimumAmountCentavos() { return minimumAmountCentavos; }
    public long getMaximumAmountCentavos() { return maximumAmountCentavos; }
    public Duration getPixExpiration() { return pixExpiration; }
    public Duration getWebhookTolerance() { return webhookTolerance; }
}
