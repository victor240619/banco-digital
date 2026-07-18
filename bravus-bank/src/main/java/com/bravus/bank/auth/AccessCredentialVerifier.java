package com.bravus.bank.auth;

import com.bravus.bank.db.entity.UserEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AccessCredentialVerifier {
    private final PasswordEncoder passwordEncoder;

    public AccessCredentialVerifier(PasswordEncoder passwordEncoder) {
        this.passwordEncoder = passwordEncoder;
    }

    public boolean matches(UserEntity user, String rawCredential) {
        if (user == null || rawCredential == null) return false;
        if (passwordEncoder.matches(rawCredential, user.getPassword())) return true;
        return user.getNumericAccessPassword() != null
                && passwordEncoder.matches(rawCredential, user.getNumericAccessPassword());
    }
}
