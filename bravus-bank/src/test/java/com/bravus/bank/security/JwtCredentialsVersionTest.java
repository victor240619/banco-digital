package com.bravus.bank.security;

import org.junit.jupiter.api.Test;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.*;

class JwtCredentialsVersionTest {
    @Test
    void passwordResetVersionInvalidatesPreviouslyIssuedToken() {
        JwtService service = new JwtService();
        ReflectionTestUtils.setField(service, "secretKey",
                "jwt-test-secret-key-that-is-long-enough-for-hmac-sha256");
        UserDetails user = User.withUsername("recover.user")
                .password("unused")
                .roles("USER")
                .build();

        String oldToken = service.generateToken(user, 0L);
        String newToken = service.generateToken(user, 1L);

        assertTrue(service.isTokenValid(oldToken, user, 0L));
        assertFalse(service.isTokenValid(oldToken, user, 1L));
        assertTrue(service.isTokenValid(newToken, user, 1L));
    }
}
