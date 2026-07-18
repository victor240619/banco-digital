package com.bravus.bank.auth;

import java.util.regex.Pattern;

public final class RegistrationCredentialPolicy {
    private static final Pattern ACCOUNT_NUMBER = Pattern.compile("^(?!000000)\\d{6}$");
    private static final Pattern NUMERIC_PASSWORD = Pattern.compile("^\\d{8}$");
    private static final Pattern ALPHANUMERIC_PASSWORD = Pattern.compile(
            "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)[A-Za-z\\d]{8,64}$");

    private RegistrationCredentialPolicy() {}

    public static boolean isValidAccountNumber(String value) {
        return value != null && ACCOUNT_NUMBER.matcher(value).matches();
    }

    public static boolean isValidNumericPassword(String value) {
        return value != null && NUMERIC_PASSWORD.matcher(value).matches();
    }

    public static boolean isValidAlphanumericPassword(String value) {
        return value != null && ALPHANUMERIC_PASSWORD.matcher(value).matches();
    }
}
