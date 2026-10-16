package com.bravus.bank.payment.mp;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
public class MercadoPagoPixOrderService {
    private final MercadoPagoProperties properties;
    private final MercadoPagoOrdersGateway gateway;
    private final MercadoPagoPixOrderStore store;

    public MercadoPagoPixOrderService(
            MercadoPagoProperties properties,
            MercadoPagoOrdersGateway gateway,
            MercadoPagoPixOrderStore store) {
        this.properties = properties;
        this.gateway = gateway;
        this.store = store;
    }

    public PixOrderResult create(
            String username,
            long amountCentavos,
            String description,
            String clientIdempotencyKey) {
        properties.requireOrdersApi();
        validateAmount(amountCentavos);
        String key = normalizeIdempotencyKey(clientIdempotencyKey);
        String safeDescription = normalizeDescription(description);

        MercadoPagoPixOrderStore.PreparedOrder prepared;
        try {
            prepared = store.prepare(username, amountCentavos, safeDescription, key);
        } catch (DataIntegrityViolationException duplicate) {
            prepared = store.findAfterConcurrentDuplicate(username, key, amountCentavos)
                    .orElseThrow(() -> new MercadoPagoIntegrationException(
                            "IDEMPOTENCY_RACE",
                            "A solicitação concorrente ainda está sendo persistida. Tente novamente com a mesma chave.",
                            duplicate));
        }
        MercadoPagoPixOrderEntity localOrder = prepared.order();

        if (localOrder.getProviderOrderId() != null) return toResult(localOrder, true);

        MercadoPagoOrdersGateway.OrderSnapshot providerOrder = gateway.createPixOrder(
                new MercadoPagoOrdersGateway.CreatePixOrderCommand(
                        localOrder.getAmountCentavos(),
                        localOrder.getDescription(),
                        prepared.payerEmail(),
                        localOrder.getExternalReference(),
                        localOrder.getProviderIdempotencyKey(),
                        properties.getPixExpiration().toString()));
        MercadoPagoPixOrderEntity completed = store.completeCreation(localOrder.getId(), providerOrder);
        return toResult(completed, false);
    }

    public PixOrderResult toResult(MercadoPagoPixOrderEntity order, boolean replay) {
        return new PixOrderResult(
                order.getId(),
                order.getProviderOrderId(),
                order.getStatus(),
                order.getStatusDetail(),
                order.getAmountCentavos(),
                order.getCurrency(),
                order.getQrCode(),
                order.getQrCodeBase64(),
                order.getTicketUrl(),
                replay);
    }

    private void validateAmount(long amountCentavos) {
        if (amountCentavos < properties.getMinimumAmountCentavos()) {
            throw new MercadoPagoIntegrationException("INVALID_AMOUNT", "O valor está abaixo do mínimo permitido.");
        }
        if (amountCentavos > properties.getMaximumAmountCentavos()) {
            throw new MercadoPagoIntegrationException("AMOUNT_LIMIT_EXCEEDED", "O valor excede o limite permitido para Pix.");
        }
    }

    private String normalizeIdempotencyKey(String supplied) {
        if (supplied == null || supplied.isBlank()) {
            throw new MercadoPagoIntegrationException("IDEMPOTENCY_REQUIRED", "Envie o cabeçalho Idempotency-Key.");
        }
        String key = supplied.trim();
        if (key.length() < 20 || key.length() > 128 || !key.matches("[A-Za-z0-9._:-]+")) {
            throw new MercadoPagoIntegrationException("INVALID_IDEMPOTENCY_KEY", "Chave de idempotência inválida.");
        }
        return key;
    }

    private String normalizeDescription(String description) {
        if (description == null || description.isBlank()) return "Depósito Pix Vantyx Bank";
        String normalized = description.trim();
        return normalized.length() <= 255 ? normalized : normalized.substring(0, 255);
    }

    public record PixOrderResult(
            UUID requestId,
            String providerOrderId,
            String status,
            String statusDetail,
            long amountCentavos,
            String currency,
            String qrCode,
            String qrCodeBase64,
            String ticketUrl,
            boolean idempotentReplay) {}
}
