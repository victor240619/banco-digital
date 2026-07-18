package com.bravus.bank.auth;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class RegistrationCredentialPolicyTest {
    @Test
    void acceptsExactNumericFormats() {
        assertTrue(RegistrationCredentialPolicy.isValidAccountNumber("0042"));
        assertTrue(RegistrationCredentialPolicy.isValidNumericPassword("12345678"));
        assertTrue(RegistrationCredentialPolicy.isValidAlphanumericPassword("Senha123"));
    }

    @Test
    void rejectsWrongLengthAndNonNumericValues() {
        assertFalse(RegistrationCredentialPolicy.isValidAccountNumber("123"));
        assertFalse(RegistrationCredentialPolicy.isValidAccountNumber("12A4"));
        assertFalse(RegistrationCredentialPolicy.isValidNumericPassword("1234567"));
        assertFalse(RegistrationCredentialPolicy.isValidNumericPassword("1234A678"));
        assertFalse(RegistrationCredentialPolicy.isValidAlphanumericPassword("senha123"));
        assertFalse(RegistrationCredentialPolicy.isValidAlphanumericPassword("SenhaSemNumero"));
    }
}
