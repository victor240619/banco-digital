package com.bravus.bank.compliance;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.*;

class BiometricMediaCipherTest {
    @Test
    void encryptsAndDecryptsWithoutKeepingPlaintext() {
        BiometricMediaCipher cipher = new BiometricMediaCipher("test-only-high-entropy-biometric-key");
        byte[] plain = "facial-evidence".getBytes(StandardCharsets.UTF_8);

        BiometricMediaCipher.EncryptedMedia encrypted = cipher.encrypt(plain);

        assertNotEquals(new String(plain, StandardCharsets.UTF_8),
                new String(encrypted.cipherBytes(), StandardCharsets.UTF_8));
        assertArrayEquals(plain, cipher.decrypt(encrypted.cipherBytes(), encrypted.iv()));
        assertEquals(BiometricMediaCipher.ALGORITHM, encrypted.algorithm());
    }

    @Test
    void failsClosedWithoutConfiguredKey() {
        BiometricMediaCipher cipher = new BiometricMediaCipher("");
        assertFalse(cipher.isConfigured());
        assertThrows(IllegalStateException.class, () -> cipher.encrypt(new byte[]{1, 2, 3}));
    }
}
