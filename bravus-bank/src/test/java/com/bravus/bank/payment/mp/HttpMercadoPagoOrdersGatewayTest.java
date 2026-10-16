package com.bravus.bank.payment.mp;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.net.http.HttpClient;
import java.time.Duration;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.Mockito.mock;

class HttpMercadoPagoOrdersGatewayTest {
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final HttpMercadoPagoOrdersGateway gateway = new HttpMercadoPagoOrdersGateway(
            new MercadoPagoProperties(
                    true, "test-token", "test-secret", "https://api.mercadopago.com",
                    100, 1_000_000, Duration.ofMinutes(30), Duration.ofMinutes(5)),
            objectMapper,
            mock(HttpClient.class));

    @Test
    void parsesOrdersCurrencyIdAndDocumentedQrBase64Alias() throws Exception {
        var snapshot = gateway.parseOrder(objectMapper.readTree("""
                {
                  "id": "ORD01TEST",
                  "external_reference": "vantyx:pix:local",
                  "currency_id": "BRL",
                  "total_amount": "59.90",
                  "total_paid_amount": "0.00",
                  "status": "action_required",
                  "status_detail": "waiting_transfer",
                  "transactions": {
                    "payments": [{
                      "id": "PAY01TEST",
                      "amount": "59.90",
                      "payment_method": {
                        "id": "pix",
                        "type": "bank_transfer",
                        "qr_code": "00020126",
                        "qr_code_based64": "base64-value",
                        "ticket_url": "https://example.test/ticket"
                      }
                    }]
                  }
                }
                """));

        assertEquals("BRL", snapshot.currency());
        assertEquals(5_990L, snapshot.amountCentavos());
        assertEquals(0L, snapshot.paidAmountCentavos());
        assertEquals("pix", snapshot.paymentMethodId());
        assertEquals("bank_transfer", snapshot.paymentMethodType());
        assertEquals("base64-value", snapshot.qrCodeBase64());
        assertEquals("00020126", snapshot.qrCode());
    }

    @Test
    void acceptsDocumentedAsynchronousProcessingResponseWithoutPaymentDetails() throws Exception {
        var snapshot = gateway.parseOrder(objectMapper.readTree("""
                {
                  "id": "ORD01PROCESSING",
                  "external_reference": "vantyx:pix:local",
                  "currency_id": "BRL",
                  "total_amount": "59.90",
                  "status": "processing",
                  "transactions": { "payments": [] }
                }
                """));

        assertEquals("processing", snapshot.status());
        assertNull(snapshot.paymentMethodId());
        assertNull(snapshot.paymentId());
    }
}
