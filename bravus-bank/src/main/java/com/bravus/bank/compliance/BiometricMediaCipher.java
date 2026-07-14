package com.bravus.bank.compliance;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;

@Service
public class BiometricMediaCipher {
    public static final String ALGORITHM = "AES-256-GCM";
    private static final int GCM_TAG_BITS = 128;
    private static final int IV_BYTES = 12;

    private final byte[] key;
    private final SecureRandom secureRandom = new SecureRandom();

    public BiometricMediaCipher(@Value("${BRAVUS_BIOMETRIC_KEY:}") String configuredSecret) {
        this.key = configuredSecret == null || configuredSecret.isBlank()
                ? null
                : sha256(configuredSecret.getBytes(StandardCharsets.UTF_8));
    }

    public boolean isConfigured() {
        return key != null;
    }

    public EncryptedMedia encrypt(byte[] plainBytes) {
        requireConfigured();
        try {
            byte[] iv = new byte[IV_BYTES];
            secureRandom.nextBytes(iv);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(key, "AES"), new GCMParameterSpec(GCM_TAG_BITS, iv));
            return new EncryptedMedia(cipher.doFinal(plainBytes), iv, ALGORITHM);
        } catch (Exception e) {
            throw new IllegalStateException("Falha ao proteger evidencia biometrica.", e);
        }
    }

    public byte[] decrypt(byte[] cipherBytes, byte[] iv) {
        requireConfigured();
        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, new SecretKeySpec(key, "AES"), new GCMParameterSpec(GCM_TAG_BITS, iv));
            return cipher.doFinal(cipherBytes);
        } catch (Exception e) {
            throw new IllegalStateException("Falha ao abrir evidencia biometrica.", e);
        }
    }

    private void requireConfigured() {
        if (!isConfigured()) {
            throw new IllegalStateException("Verificacao facial indisponivel: configure BRAVUS_BIOMETRIC_KEY.");
        }
    }

    private static byte[] sha256(byte[] value) {
        try {
            return MessageDigest.getInstance("SHA-256").digest(value);
        } catch (Exception e) {
            throw new IllegalStateException("SHA-256 indisponivel.", e);
        }
    }

    public record EncryptedMedia(byte[] cipherBytes, byte[] iv, String algorithm) {}
}
