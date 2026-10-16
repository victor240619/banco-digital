package com.bravus.bank.user.security;

import com.bravus.bank.db.entity.UserEntity;
import com.bravus.bank.db.repo.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UserPasswordChangeServiceTest {
    @Mock
    private UserRepository userRepository;
    @Mock
    private UserCredentialAuditRepository auditRepository;

    private final PasswordEncoder passwordEncoder = new BCryptPasswordEncoder(4);
    private UserPasswordChangeService service;
    private UserEntity user;

    @BeforeEach
    void setUp() {
        service = new UserPasswordChangeService(userRepository, auditRepository, passwordEncoder);
        user = new UserEntity();
        user.setId(7L);
        user.setUsername("admin.test");
        user.setPassword(passwordEncoder.encode("SenhaAtual123"));
        user.setCredentialsVersion(3L);
        user.setIsActive(true);
    }

    @Test
    void changesPasswordRevokesOldTokensAndAuditsWithoutSecrets() {
        when(userRepository.findByUsername("admin.test")).thenReturn(Optional.of(user));
        when(userRepository.findByIdForUpdate(7L)).thenReturn(Optional.of(user));
        when(userRepository.saveAndFlush(user)).thenReturn(user);

        UserEntity updated = service.changePassword("admin.test", "SenhaAtual123", "NovaSenha456");

        assertTrue(passwordEncoder.matches("NovaSenha456", updated.getPassword()));
        assertFalse(passwordEncoder.matches("SenhaAtual123", updated.getPassword()));
        assertEquals(4L, updated.getCredentialsVersion());

        ArgumentCaptor<UserCredentialAuditEntity> audit = ArgumentCaptor.forClass(UserCredentialAuditEntity.class);
        verify(auditRepository).save(audit.capture());
        assertEquals("PASSWORD_CHANGED", audit.getValue().getEventType());
        assertEquals("admin.test", audit.getValue().getActor());
        assertFalse(audit.getValue().getDetail().contains("SenhaAtual123"));
        assertFalse(audit.getValue().getDetail().contains("NovaSenha456"));
    }

    @Test
    void rejectsWrongCurrentPasswordWithoutMutationOrAudit() {
        when(userRepository.findByUsername("admin.test")).thenReturn(Optional.of(user));
        when(userRepository.findByIdForUpdate(7L)).thenReturn(Optional.of(user));

        UserPasswordChangeException error = assertThrows(UserPasswordChangeException.class,
                () -> service.changePassword("admin.test", "SenhaErrada123", "NovaSenha456"));

        assertEquals("CURRENT_PASSWORD_INVALID", error.getCode());
        assertEquals(3L, user.getCredentialsVersion());
        verify(userRepository, never()).saveAndFlush(any());
        verify(auditRepository, never()).save(any());
    }

    @Test
    void rejectsWeakOrReusedPassword() {
        UserPasswordChangeException weak = assertThrows(UserPasswordChangeException.class,
                () -> service.changePassword("admin.test", "SenhaAtual123", "fraca"));
        assertEquals("NEW_PASSWORD_WEAK", weak.getCode());

        when(userRepository.findByUsername("admin.test")).thenReturn(Optional.of(user));
        when(userRepository.findByIdForUpdate(7L)).thenReturn(Optional.of(user));
        UserPasswordChangeException reused = assertThrows(UserPasswordChangeException.class,
                () -> service.changePassword("admin.test", "SenhaAtual123", "SenhaAtual123"));
        assertEquals("PASSWORD_REUSE", reused.getCode());
        verify(userRepository, never()).saveAndFlush(any());
        verify(auditRepository, never()).save(any());
    }
}
