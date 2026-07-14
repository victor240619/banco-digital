package com.bravus.bank.auth.recovery;

import com.bravus.bank.compliance.AccountOpeningKycEntity;
import com.bravus.bank.compliance.AccountOpeningKycRepository;
import com.bravus.bank.compliance.AccountOpeningKycService;
import com.bravus.bank.compliance.BiometricMediaCipher;
import com.bravus.bank.db.entity.UserEntity;
import com.bravus.bank.db.repo.UserRepository;
import com.bravus.bank.validator.PasswordValidator;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.Base64;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;

@Service
public class PasswordResetService {
    private static final Duration REQUEST_TTL = Duration.ofMinutes(20);
    private static final Duration RATE_WINDOW = Duration.ofMinutes(15);
    private static final int MAX_REQUESTS_PER_WINDOW = 3;
    private static final int MAX_ATTEMPTS = 5;

    private final PasswordResetRequestRepository requestRepository;
    private final PasswordResetAuditRepository auditRepository;
    private final UserRepository userRepository;
    private final AccountOpeningKycRepository kycRepository;
    private final AccountOpeningKycService kycService;
    private final BiometricMediaCipher biometricMediaCipher;
    private final PasswordEncoder passwordEncoder;
    private final int globalRequestLimit;

    public PasswordResetService(PasswordResetRequestRepository requestRepository,
                                PasswordResetAuditRepository auditRepository,
                                UserRepository userRepository,
                                AccountOpeningKycRepository kycRepository,
                                AccountOpeningKycService kycService,
                                BiometricMediaCipher biometricMediaCipher,
                                PasswordEncoder passwordEncoder,
                                @Value("${BRAVUS_PASSWORD_RESET_GLOBAL_LIMIT:300}") int globalRequestLimit) {
        this.requestRepository = requestRepository;
        this.auditRepository = auditRepository;
        this.userRepository = userRepository;
        this.kycRepository = kycRepository;
        this.kycService = kycService;
        this.biometricMediaCipher = biometricMediaCipher;
        this.passwordEncoder = passwordEncoder;
        this.globalRequestLimit = Math.max(10, globalRequestLimit);
    }

    @Transactional
    public StartResult start(StartCommand command) {
        String identifier = normalizeIdentifier(command.identifier());
        String idempotencyKey = requireBounded(command.idempotencyKey(), "idempotencyKey", 20, 128);
        String clientSecret = requireBounded(command.clientSecret(), "clientSecret", 32, 160);
        String clientSecretHash = sha256Hex(clientSecret);

        Optional<PasswordResetRequestEntity> previous = requestRepository.findByIdempotencyKey(idempotencyKey);
        if (previous.isPresent()) {
            PasswordResetRequestEntity existing = previous.get();
            if (!secureEquals(existing.getClientSecretHash(), clientSecretHash)) {
                throw new PasswordResetException("INVALID_RECOVERY_PROOF", "Solicitacao de recuperacao invalida.");
            }
            return toStartResult(existing);
        }

        String identifierHash = sha256Hex(identifier);
        OffsetDateTime rateWindowStart = OffsetDateTime.now().minus(RATE_WINDOW);
        if (requestRepository.countByCreatedAtAfter(rateWindowStart) >= globalRequestLimit) {
            throw new PasswordResetException("RATE_LIMITED", "Muitas tentativas. Aguarde alguns minutos e tente novamente.");
        }
        long recent = requestRepository.countByIdentifierHashAndCreatedAtAfter(
                identifierHash, rateWindowStart);
        if (recent >= MAX_REQUESTS_PER_WINDOW) {
            throw new PasswordResetException("RATE_LIMITED", "Muitas tentativas. Aguarde alguns minutos e tente novamente.");
        }

        PasswordResetRequestEntity request = new PasswordResetRequestEntity();
        request.setId(UUID.randomUUID());
        request.setUser(findUser(identifier).orElse(null));
        request.setIdentifierHash(identifierHash);
        request.setIdempotencyKey(idempotencyKey);
        request.setClientSecretHash(clientSecretHash);
        request.setChallenge("FACE_TURN_RIGHT:" + UUID.randomUUID());
        request.setStatus(PasswordResetStatus.FACE_PENDING);
        request.setAttempts(0);
        request.setCreatedAt(OffsetDateTime.now());
        request.setExpiresAt(request.getCreatedAt().plus(REQUEST_TTL));
        requestRepository.save(request);
        audit(request, "REQUESTED", "PUBLIC", "Solicitacao iniciada");
        return toStartResult(request);
    }

    @Transactional(noRollbackFor = PasswordResetException.class)
    public PublicStatus submitFace(SubmitFaceCommand command) {
        PasswordResetRequestEntity request = locked(command.requestId());
        assertUsable(request, command.clientSecret());

        if (request.getStatus() == PasswordResetStatus.REVIEW_PENDING) {
            return new PublicStatus("REVIEW_PENDING", "Captura recebida e aguardando revisao autorizada.", request.getExpiresAt());
        }
        if (request.getStatus() != PasswordResetStatus.FACE_PENDING) {
            return publicStatus(request);
        }
        if (!secureEquals(request.getChallenge(), command.challenge())) {
            registerFailedAttempt(request, "CHALLENGE_MISMATCH");
            throw new PasswordResetException("INVALID_CHALLENGE", "Desafio facial invalido ou expirado.");
        }

        AccountOpeningKycService.ValidatedFace face;
        try {
            face = kycService.validateRecoveryFace(command.faceImage());
        } catch (IllegalArgumentException e) {
            registerFailedAttempt(request, "INVALID_FACE_IMAGE");
            throw new PasswordResetException("INVALID_FACE_IMAGE", e.getMessage());
        }

        if (!biometricMediaCipher.isConfigured() || request.getUser() == null) {
            deferWithoutEnumeration(request, "RECOVERY_PREREQUISITE_MISSING");
            return new PublicStatus("REVIEW_PENDING", "Captura recebida e encaminhada para verificacao.", request.getExpiresAt());
        }

        AccountOpeningKycEntity enrolled = kycRepository.findByUserId(request.getUser().getId()).orElse(null);
        try {
            if (enrolled != null) enrolled = kycService.ensureEncryptedFace(enrolled);
        } catch (RuntimeException ignored) {
            enrolled = null;
        }
        if (enrolled == null || enrolled.getFaceCipher() == null || enrolled.getFaceCipherIv() == null) {
            deferWithoutEnumeration(request, "ENROLLED_FACE_UNAVAILABLE");
            return new PublicStatus("REVIEW_PENDING", "Captura recebida e encaminhada para verificacao.", request.getExpiresAt());
        }

        BiometricMediaCipher.EncryptedMedia encrypted = biometricMediaCipher.encrypt(face.bytes());
        request.setSubmittedFaceCipher(encrypted.cipherBytes());
        request.setSubmittedFaceIv(encrypted.iv());
        request.setSubmittedFaceMime(face.mime());
        request.setSubmittedFaceSha256(face.sha256());
        request.transitionTo(PasswordResetStatus.REVIEW_PENDING);
        requestRepository.save(request);
        audit(request, "FACE_SUBMITTED", "PUBLIC", "Captura facial protegida e enviada para revisao");
        return new PublicStatus("REVIEW_PENDING", "Captura recebida e aguardando revisao autorizada.", request.getExpiresAt());
    }

    @Transactional(noRollbackFor = PasswordResetException.class)
    public PublicStatus status(StatusCommand command) {
        PasswordResetRequestEntity request = locked(command.requestId());
        assertClientSecret(request, command.clientSecret());
        expireIfNeeded(request);
        return publicStatus(request);
    }

    @Transactional(noRollbackFor = PasswordResetException.class)
    public PublicStatus complete(CompleteCommand command) {
        PasswordResetRequestEntity request = locked(command.requestId());
        assertClientSecret(request, command.clientSecret());
        if (request.getStatus() == PasswordResetStatus.CONSUMED) {
            return publicStatus(request);
        }
        assertUsable(request, command.clientSecret());
        if (request.getStatus() != PasswordResetStatus.VERIFIED || request.getUser() == null) {
            throw new PasswordResetException("NOT_VERIFIED", "A verificacao facial ainda nao foi aprovada.");
        }
        if (!PasswordValidator.isValid(command.newPassword())) {
            throw new PasswordResetException("WEAK_PASSWORD", PasswordValidator.getRequirements());
        }

        UserEntity user = request.getUser();
        user.setPassword(passwordEncoder.encode(command.newPassword()));
        user.setCredentialsVersion(user.getCredentialsVersion() + 1L);
        userRepository.save(user);

        request.transitionTo(PasswordResetStatus.CONSUMED);
        request.setConsumedAt(OffsetDateTime.now());
        clearSubmittedFace(request);
        requestRepository.save(request);
        audit(request, "PASSWORD_CHANGED", user.getUsername(), "Senha alterada; sessoes anteriores revogadas");
        return new PublicStatus("CONSUMED", "Senha redefinida com sucesso.", request.getExpiresAt());
    }

    @Transactional(readOnly = true)
    public List<AdminSummary> pendingReview() {
        return requestRepository.findTop100ByStatusAndSubmittedFaceCipherIsNotNullAndExpiresAtAfterOrderByCreatedAtDesc(
                        PasswordResetStatus.REVIEW_PENDING, OffsetDateTime.now())
                .stream()
                .map(this::toAdminSummary)
                .toList();
    }

    @Transactional(noRollbackFor = PasswordResetException.class)
    public AdminEvidence evidence(UUID requestId, String actor) {
        PasswordResetRequestEntity request = locked(requestId);
        expireIfNeeded(request);
        if (request.getStatus() != PasswordResetStatus.REVIEW_PENDING || request.getUser() == null) {
            throw new PasswordResetException("INVALID_STATE", "Solicitacao nao esta pronta para revisao.");
        }
        AccountOpeningKycEntity enrolled = kycRepository.findByUserId(request.getUser().getId())
                .orElseThrow(() -> new PasswordResetException("KYC_NOT_FOUND", "Evidencia de abertura nao encontrada."));
        if (enrolled.getFaceCipher() == null || request.getSubmittedFaceCipher() == null) {
            throw new PasswordResetException("EVIDENCE_UNAVAILABLE", "Evidencia facial protegida indisponivel.");
        }

        byte[] enrolledBytes = biometricMediaCipher.decrypt(enrolled.getFaceCipher(), enrolled.getFaceCipherIv());
        byte[] submittedBytes = biometricMediaCipher.decrypt(request.getSubmittedFaceCipher(), request.getSubmittedFaceIv());
        audit(request, "FACE_EVIDENCE_VIEWED", actor, "Evidencias abertas para revisao autorizada");
        return new AdminEvidence(
                dataUrl(enrolled.getFaceMime(), enrolledBytes),
                dataUrl(request.getSubmittedFaceMime(), submittedBytes),
                request.getChallenge(),
                request.getUser().getFullName(),
                maskCpf(request.getUser().getCpf())
        );
    }

    @Transactional(noRollbackFor = PasswordResetException.class)
    public AdminSummary approve(UUID requestId, String actor, String reason) {
        PasswordResetRequestEntity request = locked(requestId);
        expireIfNeeded(request);
        if (request.getStatus() != PasswordResetStatus.REVIEW_PENDING || request.getUser() == null) {
            throw new PasswordResetException("INVALID_STATE", "Solicitacao nao esta pronta para aprovacao.");
        }
        request.transitionTo(PasswordResetStatus.VERIFIED);
        request.setReviewedBy(actor);
        request.setReviewReason(cleanReason(reason, "Comparacao facial aprovada em revisao autorizada."));
        request.setReviewedAt(OffsetDateTime.now());
        requestRepository.save(request);
        audit(request, "FACE_REVIEW_APPROVED", actor, request.getReviewReason());
        return toAdminSummary(request);
    }

    @Transactional(noRollbackFor = PasswordResetException.class)
    public AdminSummary reject(UUID requestId, String actor, String reason) {
        PasswordResetRequestEntity request = locked(requestId);
        expireIfNeeded(request);
        if (request.getStatus() != PasswordResetStatus.REVIEW_PENDING) {
            throw new PasswordResetException("INVALID_STATE", "Solicitacao nao esta pronta para rejeicao.");
        }
        request.transitionTo(PasswordResetStatus.REJECTED);
        request.setReviewedBy(actor);
        request.setReviewReason(cleanReason(reason, "Evidencias faciais nao confirmadas."));
        request.setReviewedAt(OffsetDateTime.now());
        clearSubmittedFace(request);
        requestRepository.save(request);
        audit(request, "FACE_REVIEW_REJECTED", actor, request.getReviewReason());
        return toAdminSummary(request);
    }

    private PasswordResetRequestEntity locked(UUID id) {
        return requestRepository.findLockedById(id)
                .orElseThrow(() -> new PasswordResetException("INVALID_REQUEST", "Solicitacao de recuperacao invalida."));
    }

    private void assertUsable(PasswordResetRequestEntity request, String clientSecret) {
        assertClientSecret(request, clientSecret);
        expireIfNeeded(request);
        if (request.getStatus() == PasswordResetStatus.EXPIRED
                || request.getStatus() == PasswordResetStatus.LOCKED
                || request.getStatus() == PasswordResetStatus.REJECTED
                || request.getStatus() == PasswordResetStatus.CONSUMED) {
            throw new PasswordResetException("RECOVERY_UNAVAILABLE", "Nao foi possivel concluir esta recuperacao.");
        }
    }

    private void assertClientSecret(PasswordResetRequestEntity request, String clientSecret) {
        if (!secureEquals(request.getClientSecretHash(), sha256Hex(clientSecret == null ? "" : clientSecret))) {
            registerFailedAttempt(request, "CLIENT_SECRET_MISMATCH");
            throw new PasswordResetException("INVALID_RECOVERY_PROOF", "Solicitacao de recuperacao invalida.");
        }
    }

    private void registerFailedAttempt(PasswordResetRequestEntity request, String detail) {
        int attempts = Math.min(MAX_ATTEMPTS, request.getAttempts() + 1);
        request.setAttempts(attempts);
        if (attempts >= MAX_ATTEMPTS && request.getStatus().canTransitionTo(PasswordResetStatus.LOCKED)) {
            request.transitionTo(PasswordResetStatus.LOCKED);
            clearSubmittedFace(request);
        }
        requestRepository.save(request);
        audit(request, "RECOVERY_ATTEMPT_FAILED", "PUBLIC", detail);
    }

    private void expireIfNeeded(PasswordResetRequestEntity request) {
        if (OffsetDateTime.now().isAfter(request.getExpiresAt())
                && request.getStatus().canTransitionTo(PasswordResetStatus.EXPIRED)) {
            request.transitionTo(PasswordResetStatus.EXPIRED);
            clearSubmittedFace(request);
            requestRepository.save(request);
            audit(request, "REQUEST_EXPIRED", "SYSTEM", "Prazo de recuperacao encerrado");
        }
    }

    private void deferWithoutEnumeration(PasswordResetRequestEntity request, String detail) {
        request.transitionTo(PasswordResetStatus.REVIEW_PENDING);
        requestRepository.save(request);
        audit(request, "RECOVERY_PREREQUISITE_DEFERRED", "SYSTEM", detail);
    }

    private void clearSubmittedFace(PasswordResetRequestEntity request) {
        request.setSubmittedFaceCipher(null);
        request.setSubmittedFaceIv(null);
        request.setSubmittedFaceMime(null);
    }

    private PublicStatus publicStatus(PasswordResetRequestEntity request) {
        return switch (request.getStatus()) {
            case FACE_PENDING -> new PublicStatus("FACE_PENDING", "Capture sua face para continuar.", request.getExpiresAt());
            case REVIEW_PENDING -> new PublicStatus("REVIEW_PENDING", "Captura em revisao autorizada.", request.getExpiresAt());
            case VERIFIED -> new PublicStatus("VERIFIED", "Identidade confirmada. Defina a nova senha.", request.getExpiresAt());
            case CONSUMED -> new PublicStatus("CONSUMED", "Senha redefinida com sucesso.", request.getExpiresAt());
            default -> new PublicStatus("UNAVAILABLE", "Nao foi possivel confirmar a identidade nesta solicitacao.", request.getExpiresAt());
        };
    }

    private Optional<UserEntity> findUser(String identifier) {
        String digits = identifier.replaceAll("\\D", "");
        if (digits.length() == 11) return userRepository.findByCpf(digits);
        return userRepository.findByUsername(identifier).or(() -> userRepository.findByEmail(identifier));
    }

    private StartResult toStartResult(PasswordResetRequestEntity request) {
        return new StartResult(request.getId(), request.getChallenge(),
                "Vire levemente o rosto para a direita e capture a selfie.", request.getExpiresAt());
    }

    private AdminSummary toAdminSummary(PasswordResetRequestEntity request) {
        UserEntity user = request.getUser();
        return new AdminSummary(
                request.getId(),
                request.getStatus().name(),
                user == null ? "Conta nao localizada" : user.getFullName(),
                user == null ? null : maskCpf(user.getCpf()),
                request.getAttempts(),
                request.getCreatedAt(),
                request.getExpiresAt(),
                request.getReviewedBy(),
                request.getReviewReason()
        );
    }

    private void audit(PasswordResetRequestEntity request, String eventType, String actor, String detail) {
        PasswordResetAuditEntity entry = new PasswordResetAuditEntity();
        entry.setRequest(request);
        entry.setEventType(eventType);
        entry.setActor(actor == null || actor.isBlank() ? "SYSTEM" : actor);
        entry.setDetail(detail == null ? null : detail.substring(0, Math.min(detail.length(), 500)));
        auditRepository.save(entry);
    }

    private String normalizeIdentifier(String raw) {
        String value = raw == null ? "" : raw.trim().toLowerCase(Locale.ROOT);
        if (value.isBlank() || value.length() > 150) {
            throw new PasswordResetException("INVALID_IDENTIFIER", "Informe CPF, e-mail ou usuario valido.");
        }
        String digits = value.replaceAll("\\D", "");
        return digits.length() == 11 ? digits : value;
    }

    private String requireBounded(String value, String field, int min, int max) {
        String clean = value == null ? "" : value.trim();
        if (clean.length() < min || clean.length() > max) {
            throw new PasswordResetException("INVALID_" + field.toUpperCase(Locale.ROOT), "Solicitacao de recuperacao invalida.");
        }
        return clean;
    }

    private String cleanReason(String reason, String fallback) {
        String clean = reason == null || reason.isBlank() ? fallback : reason.trim();
        return clean.substring(0, Math.min(clean.length(), 500));
    }

    private String dataUrl(String mime, byte[] bytes) {
        String safeMime = mime == null || mime.isBlank() ? "image/jpeg" : mime;
        return "data:" + safeMime + ";base64," + Base64.getEncoder().encodeToString(bytes);
    }

    private String maskCpf(String cpf) {
        String digits = cpf == null ? "" : cpf.replaceAll("\\D", "");
        if (digits.length() != 11) return "***";
        return "***." + digits.substring(3, 6) + "." + digits.substring(6, 9) + "-**";
    }

    private String sha256Hex(String value) {
        try {
            byte[] hash = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder out = new StringBuilder(hash.length * 2);
            for (byte b : hash) out.append(String.format("%02x", b));
            return out.toString();
        } catch (Exception e) {
            throw new IllegalStateException("SHA-256 indisponivel.", e);
        }
    }

    private boolean secureEquals(String expected, String actual) {
        if (expected == null || actual == null) return false;
        return MessageDigest.isEqual(expected.getBytes(StandardCharsets.UTF_8), actual.getBytes(StandardCharsets.UTF_8));
    }

    public record StartCommand(String identifier, String idempotencyKey, String clientSecret) {}
    public record StartResult(UUID requestId, String challenge, String instruction, OffsetDateTime expiresAt) {}
    public record SubmitFaceCommand(UUID requestId, String clientSecret, String challenge, String faceImage) {}
    public record StatusCommand(UUID requestId, String clientSecret) {}
    public record CompleteCommand(UUID requestId, String clientSecret, String newPassword) {}
    public record PublicStatus(String status, String message, OffsetDateTime expiresAt) {}
    public record AdminSummary(UUID requestId, String status, String fullName, String maskedCpf, Integer attempts,
                               OffsetDateTime createdAt, OffsetDateTime expiresAt, String reviewedBy, String reviewReason) {}
    public record AdminEvidence(String enrolledFace, String submittedFace, String challenge, String fullName, String maskedCpf) {}
}
