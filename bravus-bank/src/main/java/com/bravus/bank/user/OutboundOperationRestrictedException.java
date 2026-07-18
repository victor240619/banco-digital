package com.bravus.bank.user;

public class OutboundOperationRestrictedException extends RuntimeException {
    private final String code;

    public OutboundOperationRestrictedException(String code, String message) {
        super(message);
        this.code = code;
    }

    public String getCode() { return code; }
}
