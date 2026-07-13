package com.bravus.bank.validator;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class PasswordValidatorTest {

    @Test
    void testValidPasswords() {
        assertTrue(PasswordValidator.isValid("Password123"));
        assertTrue(PasswordValidator.isValid("MySecure1"));
        assertTrue(PasswordValidator.isValid("Test123456"));
    }

    @Test
    void testInvalidPasswords() {
        // Too short
        assertFalse(PasswordValidator.isValid("Pass1"));
        
        // No uppercase
        assertFalse(PasswordValidator.isValid("password123"));
        
        // No lowercase
        assertFalse(PasswordValidator.isValid("PASSWORD123"));
        
        // No number
        assertFalse(PasswordValidator.isValid("Password"));
        
        // Null password
        assertFalse(PasswordValidator.isValid(null));
        
        // Empty password
        assertFalse(PasswordValidator.isValid(""));
    }

    @Test
    void testGetRequirements() {
        String requirements = PasswordValidator.getRequirements();
        assertNotNull(requirements);
        assertTrue(requirements.contains("8 caracteres"));
        assertTrue(requirements.contains("maiuscula"));
        assertTrue(requirements.contains("minuscula"));
        assertTrue(requirements.contains("numero"));
    }
}
