package com.bravus.bank.auth.recovery;

import com.bravus.bank.compliance.AccountOpeningKycEntity;
import com.bravus.bank.compliance.AccountOpeningKycRepository;
import com.bravus.bank.compliance.BiometricMediaCipher;
import com.bravus.bank.db.entity.UserEntity;
import com.bravus.bank.db.repo.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.OffsetDateTime;
import java.util.Base64;
import java.util.UUID;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import javax.imageio.ImageIO;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:password-reset-test;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.flyway.enabled=false",
        "jwt.secret=integration-test-secret-key-that-is-long-enough-for-hmac-sha256",
        "BRAVUS_BIOMETRIC_KEY=integration-test-biometric-key-with-high-entropy"
})
@Transactional
class PasswordResetServiceIntegrationTest {
    @Autowired PasswordResetService service;
    @Autowired PasswordResetRequestRepository requestRepository;
    @Autowired UserRepository userRepository;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired AccountOpeningKycRepository kycRepository;
    @Autowired BiometricMediaCipher biometricMediaCipher;

    @Test
    void unknownAccountRemainsIndistinguishableThroughReviewStage() throws Exception {
        String clientSecret = "client-secret-with-at-least-thirty-two-characters";
        PasswordResetService.StartCommand command = new PasswordResetService.StartCommand(
                "missing@example.com", "idem-password-reset-00000001", clientSecret);

        PasswordResetService.StartResult first = service.start(command);
        PasswordResetService.StartResult replay = service.start(command);

        assertEquals(first.requestId(), replay.requestId());
        assertEquals(first.challenge(), replay.challenge());
        assertEquals(PasswordResetStatus.FACE_PENDING,
                requestRepository.findById(first.requestId()).orElseThrow().getStatus());

        PasswordResetService.PublicStatus submitted = service.submitFace(new PasswordResetService.SubmitFaceCommand(
                first.requestId(), clientSecret, first.challenge(), validFaceDataUrl()));
        PasswordResetService.PublicStatus replayedSubmission = service.submitFace(
                new PasswordResetService.SubmitFaceCommand(
                        first.requestId(), clientSecret, first.challenge(), validFaceDataUrl()));

        assertEquals("REVIEW_PENDING", submitted.status());
        assertEquals("REVIEW_PENDING", replayedSubmission.status());
        assertEquals("REVIEW_PENDING", service.status(
                new PasswordResetService.StatusCommand(first.requestId(), clientSecret)).status());
        assertTrue(service.pendingReview().isEmpty());
        PasswordResetException premature = assertThrows(PasswordResetException.class,
                () -> service.complete(new PasswordResetService.CompleteCommand(
                        first.requestId(), clientSecret, "NovaSenha123")));
        assertEquals("NOT_VERIFIED", premature.getCode());
    }

    @Test
    void completeChangesOnlyCredentialsAndConsumesRequestOnce() {
        UserEntity user = createUser("recover.user", "recover@example.com", "31415926590", "FixturePwd123", 456_789L);
        String oldHash = user.getPassword();
        String clientSecret = "another-client-secret-with-thirty-two-characters";

        PasswordResetRequestEntity request = verifiedRequest(user, clientSecret);
        requestRepository.save(request);

        PasswordResetService.PublicStatus result = service.complete(new PasswordResetService.CompleteCommand(
                request.getId(), clientSecret, "NovaSenha123"));

        UserEntity updated = userRepository.findById(user.getId()).orElseThrow();
        assertEquals("CONSUMED", result.status());
        assertEquals(456_789L, updated.getBalance());
        assertEquals(1L, updated.getCredentialsVersion());
        assertNotEquals(oldHash, updated.getPassword());
        assertTrue(passwordEncoder.matches("NovaSenha123", updated.getPassword()));
        assertEquals(PasswordResetStatus.CONSUMED,
                requestRepository.findById(request.getId()).orElseThrow().getStatus());

        PasswordResetService.PublicStatus replay = service.complete(new PasswordResetService.CompleteCommand(
                request.getId(), clientSecret, "OutraSenha123"));
        assertEquals("CONSUMED", replay.status());
        assertTrue(passwordEncoder.matches("NovaSenha123", updated.getPassword()));
    }

    @Test
    void wrongClientSecretNeverChangesPasswordOrBalance() {
        UserEntity user = createUser("locked.user", "locked@example.com", "39053344705", "3905334470", 99_900L);
        String oldHash = user.getPassword();
        PasswordResetRequestEntity request = verifiedRequest(
                user, "correct-client-secret-with-thirty-two-characters");
        requestRepository.save(request);

        PasswordResetException error = assertThrows(PasswordResetException.class,
                () -> service.complete(new PasswordResetService.CompleteCommand(
                        request.getId(), "wrong-client-secret-with-thirty-two-characters", "NovaSenha123")));

        UserEntity unchanged = userRepository.findById(user.getId()).orElseThrow();
        assertEquals("INVALID_RECOVERY_PROOF", error.getCode());
        assertEquals(oldHash, unchanged.getPassword());
        assertEquals(99_900L, unchanged.getBalance());
        assertEquals(0L, unchanged.getCredentialsVersion());
        assertEquals(1, requestRepository.findById(request.getId()).orElseThrow().getAttempts());
    }

    @Test
    void facialSubmissionRequiresAdminReviewBeforePasswordCanChange() throws Exception {
        UserEntity user = createUser("facial.user", "facial@example.com", "52998224725", "5299822472", 12_345L);
        storeEnrolledFace(user, "enrolled-face-evidence".getBytes(StandardCharsets.UTF_8));
        String clientSecret = "facial-client-secret-with-at-least-thirty-two-characters";

        PasswordResetService.StartResult started = service.start(new PasswordResetService.StartCommand(
                user.getCpf(), "idem-facial-review-00000001", clientSecret));
        PasswordResetService.PublicStatus submitted = service.submitFace(new PasswordResetService.SubmitFaceCommand(
                started.requestId(), clientSecret, started.challenge(), validFaceDataUrl()));

        assertEquals("REVIEW_PENDING", submitted.status());
        PasswordResetException premature = assertThrows(PasswordResetException.class,
                () -> service.complete(new PasswordResetService.CompleteCommand(
                        started.requestId(), clientSecret, "NovaSenha123")));
        assertEquals("NOT_VERIFIED", premature.getCode());

        PasswordResetService.AdminEvidence evidence = service.evidence(started.requestId(), "admin.qa");
        assertTrue(evidence.enrolledFace().startsWith("data:image/jpeg;base64,"));
        assertTrue(evidence.submittedFace().startsWith("data:image/jpeg;base64,"));

        service.approve(started.requestId(), "admin.qa", "Capturas comparadas em teste controlado.");
        assertEquals("VERIFIED", service.status(new PasswordResetService.StatusCommand(
                started.requestId(), clientSecret)).status());

        service.complete(new PasswordResetService.CompleteCommand(
                started.requestId(), clientSecret, "NovaSenha123"));
        UserEntity updated = userRepository.findById(user.getId()).orElseThrow();
        PasswordResetRequestEntity consumed = requestRepository.findById(started.requestId()).orElseThrow();
        assertTrue(passwordEncoder.matches("NovaSenha123", updated.getPassword()));
        assertEquals(12_345L, updated.getBalance());
        assertNull(consumed.getSubmittedFaceCipher());
        assertNull(consumed.getSubmittedFaceIv());
    }

    @Test
    void expiredAdminReviewIsRejectedAndPurgesSubmittedBiometry() throws Exception {
        UserEntity user = createUser("expired.user", "expired@example.com", "29537983800", "2953798380", 88_000L);
        storeEnrolledFace(user, "expired-enrolled-face".getBytes(StandardCharsets.UTF_8));
        String clientSecret = "expired-client-secret-with-at-least-thirty-two-characters";
        PasswordResetService.StartResult started = service.start(new PasswordResetService.StartCommand(
                user.getCpf(), "idem-expired-review-00000001", clientSecret));
        service.submitFace(new PasswordResetService.SubmitFaceCommand(
                started.requestId(), clientSecret, started.challenge(), validFaceDataUrl()));

        PasswordResetRequestEntity request = requestRepository.findById(started.requestId()).orElseThrow();
        request.setExpiresAt(OffsetDateTime.now().minusSeconds(1));
        requestRepository.saveAndFlush(request);

        PasswordResetException error = assertThrows(PasswordResetException.class,
                () -> service.approve(started.requestId(), "admin.qa", "Revisao executada depois do prazo."));
        assertEquals("INVALID_STATE", error.getCode());

        PasswordResetRequestEntity expired = requestRepository.findById(started.requestId()).orElseThrow();
        assertEquals(PasswordResetStatus.EXPIRED, expired.getStatus());
        assertNull(expired.getSubmittedFaceCipher());
        assertNull(expired.getSubmittedFaceIv());
        assertEquals(88_000L, userRepository.findById(user.getId()).orElseThrow().getBalance());
    }

    private UserEntity createUser(String username, String email, String cpf, String account, long balance) {
        UserEntity user = new UserEntity();
        user.setUsername(username);
        user.setEmail(email);
        user.setPassword(passwordEncoder.encode("SenhaAntiga123"));
        user.setFullName("Cliente Recuperacao");
        user.setCpf(cpf);
        user.setAccountNumber(account);
        user.setBalance(balance);
        user.setIsActive(true);
        return userRepository.saveAndFlush(user);
    }

    private PasswordResetRequestEntity verifiedRequest(UserEntity user, String clientSecret) {
        PasswordResetRequestEntity request = new PasswordResetRequestEntity();
        request.setId(UUID.randomUUID());
        request.setUser(user);
        request.setIdentifierHash(sha256(user.getCpf()));
        request.setIdempotencyKey("idem-" + UUID.randomUUID());
        request.setClientSecretHash(sha256(clientSecret));
        request.setChallenge("FACE_TURN_RIGHT:" + UUID.randomUUID());
        request.setStatus(PasswordResetStatus.VERIFIED);
        request.setAttempts(0);
        request.setCreatedAt(OffsetDateTime.now());
        request.setExpiresAt(OffsetDateTime.now().plusMinutes(20));
        return request;
    }

    private void storeEnrolledFace(UserEntity user, byte[] faceBytes) {
        BiometricMediaCipher.EncryptedMedia encrypted = biometricMediaCipher.encrypt(faceBytes);
        AccountOpeningKycEntity kyc = new AccountOpeningKycEntity();
        kyc.setUser(user);
        kyc.setDocumentType("CPF");
        kyc.setDocumentNumber(user.getCpf());
        kyc.setFrontFilePath("db://front");
        kyc.setBackFilePath("db://back");
        kyc.setFaceFilePath("db://face");
        kyc.setFrontSha256("a".repeat(64));
        kyc.setBackSha256("b".repeat(64));
        kyc.setFaceSha256(sha256(new String(faceBytes, StandardCharsets.UTF_8)));
        kyc.setFrontMime("image/jpeg");
        kyc.setBackMime("image/jpeg");
        kyc.setFaceMime("image/jpeg");
        kyc.setFrontBytes(4096L);
        kyc.setBackBytes(4096L);
        kyc.setFaceBytes((long) faceBytes.length);
        kyc.setFaceCaptureMethod("CAMERA");
        kyc.setBiometricChallenge("FACE_CAMERA_CAPTURE_V1");
        kyc.setProvider("BRAVUS_TEST_KYC");
        kyc.setStatus("CAPTURADO");
        kyc.setRiskScore(10);
        kyc.setFaceCipher(encrypted.cipherBytes());
        kyc.setFaceCipherIv(encrypted.iv());
        kyc.setFaceCipherAlgorithm(encrypted.algorithm());
        kycRepository.saveAndFlush(kyc);
    }

    private String validFaceDataUrl() throws Exception {
        BufferedImage image = new BufferedImage(220, 220, BufferedImage.TYPE_INT_RGB);
        for (int y = 0; y < image.getHeight(); y++) {
            for (int x = 0; x < image.getWidth(); x++) {
                int red = (x * 255) / image.getWidth();
                int green = (y * 255) / image.getHeight();
                image.setRGB(x, y, (red << 16) | (green << 8) | 80);
            }
        }
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        ImageIO.write(image, "jpg", output);
        return "data:image/jpeg;base64," + Base64.getEncoder().encodeToString(output.toByteArray());
    }

    private String sha256(String value) {
        try {
            byte[] hash = MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder out = new StringBuilder();
            for (byte b : hash) out.append(String.format("%02x", b));
            return out.toString();
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }
}
