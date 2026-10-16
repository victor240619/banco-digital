package com.bravus.bank.user.security;

public class UserPasswordChangeException extends RuntimeException {
    private final String code;

    public UserPasswordChangeException(String code, String message) {
        super(message);
        this.code = code;
    }

    public String getCode() {
        return code;
    }
}
