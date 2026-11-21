package com.bravus.bank.auth;

import com.bravus.bank.compliance.AccountOpeningKycService;
import com.bravus.bank.compliance.DocumentAnalysisService;
import com.bravus.bank.db.entity.RoleEntity;
import com.bravus.bank.db.entity.UserEntity;
import com.bravus.bank.db.repo.RoleRepository;
import com.bravus.bank.db.repo.UserRepository;
import com.bravus.bank.security.JwtService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class AuthControllerLoginTest {
    private final UserRepository users = mock(UserRepository.class);
    private final UserDetailsService details = mock(UserDetailsService.class);
    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder(4);
    private final JwtService jwt = new JwtService();
    private AuthController controller;
    private UserEntity user;

    @BeforeEach
    void setup() {
        ReflectionTestUtils.setField(jwt, "secretKey", "synthetic-test-key-long-enough-for-hmac-sha256-only");
        controller = new AuthController(users, mock(RoleRepository.class), encoder,
                new AccessCredentialVerifier(encoder), jwt, details,
                mock(DocumentAnalysisService.class), mock(AccountOpeningKycService.class));
        user = new UserEntity();
        user.setUsername("fixture");
        user.setPassword(encoder.encode("Synthetic-Only-83"));
        user.setNumericAccessPassword(encoder.encode("83917502"));
        user.setIsActive(true);
        RoleEntity role = new RoleEntity();
        role.setName("ROLE_ADMIN");
        user.setRoles(Set.of(role));
        when(users.findByUsername("fixture")).thenReturn(Optional.of(user));
        when(details.loadUserByUsername("fixture")).thenReturn(
                User.withUsername("fixture").password("unused").roles("ADMIN").build());
    }

    @Test
    void authenticatesAdminAndNumericCredentialWithoutChangingAccount() {
        for (String password : new String[]{"Synthetic-Only-83", "83917502"}) {
            var result = controller.login(new AuthController.LoginRequest("fixture", password));
            assertEquals(200, result.getStatusCode().value());
            var response = (AuthController.AuthResponse) result.getBody();
            assertNotNull(response);
            assertTrue(response.roles().contains("ROLE_ADMIN"));
            assertEquals("fixture", jwt.extractUsername(response.token()));
        }
        verify(users, never()).save(any());
    }

    @Test
    void rejectsWrongPasswordAndInactiveAccountWithoutIssuingSession() {
        assertEquals(400, controller.login(new AuthController.LoginRequest("fixture", "wrong")).getStatusCode().value());
        user.setIsActive(false);
        assertEquals(400, controller.login(new AuthController.LoginRequest("fixture", "Synthetic-Only-83")).getStatusCode().value());
        verifyNoInteractions(details);
    }

    @Test
    void doesNotDisguiseDatabaseFailureAsWrongPasswordOrExposeDetails() {
        when(users.findByUsername("fixture")).thenThrow(new DataAccessResourceFailureException("sensitive diagnostic fixture"));
        var response = controller.login(new AuthController.LoginRequest("fixture", "Synthetic-Only-83"));
        assertEquals(503, response.getStatusCode().value());
        assertFalse(String.valueOf(response.getBody()).contains("sensitive diagnostic fixture"));
        verifyNoInteractions(details);
    }

    @Test
    void doesNotDisguiseSigningConfigurationFailureAsWrongPassword() {
        ReflectionTestUtils.setField(jwt, "secretKey", "short");
        var response = controller.login(new AuthController.LoginRequest("fixture", "Synthetic-Only-83"));
        assertEquals(503, response.getStatusCode().value());
        assertFalse(String.valueOf(response.getBody()).contains("short"));
    }
}
