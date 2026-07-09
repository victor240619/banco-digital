package com.bravus.bank.validator;

import java.util.regex.Pattern;

public class PasswordValidator {
    // Regex: Minimum 8 characters, at least one uppercase letter, one lowercase letter and one number
    private static final String REGEX_STRONG_PASSWORD = 
        "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)[a-zA-Z\\d\\W]{8,}$";
    private static final Pattern PATTERN = Pattern.compile(REGEX_STRONG_PASSWORD);

    public static boolean isValid(String password) {
        return password != null && PATTERN.matcher(password).matches();
    }
    
    public static String getRequirements() {
        return "A senha deve ter pelo menos 8 caracteres e conter pelo menos uma letra maiuscula, uma letra minuscula e um numero.";
    }
}
