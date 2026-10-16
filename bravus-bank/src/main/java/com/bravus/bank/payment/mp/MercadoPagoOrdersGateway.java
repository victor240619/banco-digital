package com.bravus.bank.payment.mp;

public interface MercadoPagoOrdersGateway {
    OrderSnapshot createPixOrder(CreatePixOrderCommand command);
    OrderSnapshot getOrder(String providerOrderId);

    record CreatePixOrderCommand(
            long amountCentavos,
            String description,
            String payerEmail,
            String externalReference,
            String idempotencyKey,
            String expirationTime) {}

    record OrderSnapshot(
            String orderId,
            String paymentId,
            String externalReference,
            long amountCentavos,
            Long paidAmountCentavos,
            String currency,
            String paymentMethodId,
            String paymentMethodType,
            String status,
            String statusDetail,
            String qrCode,
            String qrCodeBase64,
            String ticketUrl) {}
}
