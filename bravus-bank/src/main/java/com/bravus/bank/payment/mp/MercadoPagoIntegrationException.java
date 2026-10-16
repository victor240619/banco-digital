package com.bravus.bank.payment.mp;

public class MercadoPagoIntegrationException extends RuntimeException {
    private final String code;

    public MercadoPagoIntegrationException(String code, String message) {
        super(message);
        this.code = code;
    }

    public MercadoPagoIntegrationException(String code, String message, Throwable cause) {
        super(message, cause);
        this.code = code;
    }

    public String getCode() { return code; }
}
