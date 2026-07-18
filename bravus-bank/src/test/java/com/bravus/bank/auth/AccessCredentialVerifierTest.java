package com.bravus.bank.auth;

import com.bravus.bank.db.entity.UserEntity;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AccessCredentialVerifierTest {
    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder(4);
    private final AccessCredentialVerifier verifier = new AccessCredentialVerifier(encoder);

    @Test
    void acceptsAlphanumericOrNumericCredential() {
        UserEntity user = userWithCredentials();
        assertTrue(verifier.matches(user, "Senha123"));
        assertTrue(verifier.matches(user, "12345678"));
    }

    @Test
    void preservesLegacyPasswordAndRejectsUnknownCredential() {
        UserEntity legacy = new UserEntity();
        legacy.setPassword(encoder.encode("SenhaAntiga123"));
        assertTrue(verifier.matches(legacy, "SenhaAntiga123"));
        assertFalse(verifier.matches(legacy, "12345678"));
        assertFalse(verifier.matches(legacy, "incorreta"));
    }

    private UserEntity userWithCredentials() {
        UserEntity user = new UserEntity();
        user.setPassword(encoder.encode("Senha123"));
        user.setNumericAccessPassword(encoder.encode("12345678"));
        return user;
    }
}
