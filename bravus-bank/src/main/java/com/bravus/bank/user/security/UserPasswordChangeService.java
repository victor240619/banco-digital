package com.bravus.bank.user.security;

import com.bravus.bank.db.entity.UserEntity;
import com.bravus.bank.db.repo.UserRepository;
import com.bravus.bank.validator.PasswordValidator;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UserPasswordChangeService {
    private final UserRepository userRepository;
    private final UserCredentialAuditRepository auditRepository;
    private final PasswordEncoder passwordEncoder;

    public UserPasswordChangeService(UserRepository userRepository,
                                     UserCredentialAuditRepository auditRepository,
                                     PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.auditRepository = auditRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional
    public UserEntity changePassword(String username, String currentPassword, String newPassword) {
        if (username == null || username.isBlank()) {
            throw new UserPasswordChangeException("AUTHENTICATION_REQUIRED", "Sessao autenticada obrigatoria.");
        }
        if (currentPassword == null || currentPassword.isBlank() || currentPassword.length() > 128) {
            throw new UserPasswordChangeException("CURRENT_PASSWORD_INVALID", "A senha atual nao confere.");
        }
        if (newPassword == null || newPassword.length() > 128 || !PasswordValidator.isValid(newPassword)) {
            throw new UserPasswordChangeException("NEW_PASSWORD_WEAK", PasswordValidator.getRequirements());
        }

        UserEntity reference = userRepository.findByUsername(username)
                .orElseThrow(() -> new UserPasswordChangeException(
                        "AUTHENTICATION_REQUIRED", "Sessao autenticada obrigatoria."));
        UserEntity user = userRepository.findByIdForUpdate(reference.getId())
                .orElseThrow(() -> new UserPasswordChangeException(
                        "AUTHENTICATION_REQUIRED", "Sessao autenticada obrigatoria."));

        if (!Boolean.TRUE.equals(user.getIsActive())) {
            throw new UserPasswordChangeException("ACCOUNT_INACTIVE", "A conta nao esta ativa.");
        }
        if (!passwordEncoder.matches(currentPassword, user.getPassword())) {
            throw new UserPasswordChangeException("CURRENT_PASSWORD_INVALID", "A senha atual nao confere.");
        }
        if (passwordEncoder.matches(newPassword, user.getPassword())) {
            throw new UserPasswordChangeException("PASSWORD_REUSE", "A nova senha deve ser diferente da senha atual.");
        }

        user.setPassword(passwordEncoder.encode(newPassword));
        user.setCredentialsVersion(user.getCredentialsVersion() + 1L);
        UserEntity updated = userRepository.saveAndFlush(user);

        UserCredentialAuditEntity audit = new UserCredentialAuditEntity();
        audit.setUser(updated);
        audit.setActor(updated.getUsername());
        audit.setEventType("PASSWORD_CHANGED");
        audit.setDetail("Senha alterada pelo titular; tokens anteriores revogados.");
        auditRepository.save(audit);

        return updated;
    }
}
