package com.bravus.bank.compliance;

import com.bravus.bank.db.entity.UserEntity;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Base64;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class AccountOpeningKycService {
    private static final Pattern DATA_URL_PATTERN =
            Pattern.compile("^data:(image/(?:jpeg|png));base64,(.+)$", Pattern.CASE_INSENSITIVE);
    private static final int MAX_IMAGE_BYTES = 5 * 1024 * 1024;
    private static final int MIN_DOCUMENT_BYTES = 2 * 1024;
    private static final int MIN_FACE_BYTES = 2 * 1024;

    private final AccountOpeningKycRepository repository;
    private final BiometricMediaCipher biometricMediaCipher;
    private final Path storageDir;

    public AccountOpeningKycService(AccountOpeningKycRepository repository,
                                    BiometricMediaCipher biometricMediaCipher,
                                    @Value("${BRAVUS_KYC_STORAGE_DIR:./data/kyc}") String storageDir) {
        this.repository = repository;
        this.biometricMediaCipher = biometricMediaCipher;
        this.storageDir = Path.of(storageDir);
    }

    public record KycPayload(
            String documentFrontImage,
            String documentBackImage,
            String faceImage,
            String biometricChallenge
    ) {}

    public void validatePayload(KycPayload payload) {
        if (payload == null) {
            throw new IllegalArgumentException("Envie documento frente, verso e biometria facial.");
        }
        StoredImage front = decodeAndValidate(payload.documentFrontImage(),
                "frente do documento", MIN_DOCUMENT_BYTES, 220, 140);
        StoredImage back = decodeAndValidate(payload.documentBackImage(),
                "verso do documento", MIN_DOCUMENT_BYTES, 220, 140);
        StoredImage face = decodeAndValidate(payload.faceImage(),
                "biometria facial", MIN_FACE_BYTES, 180, 180);

        if (front.sha256.equals(back.sha256)) {
            throw new IllegalArgumentException("Envie imagens diferentes para frente e verso do documento.");
        }
        if (front.sha256.equals(face.sha256) || back.sha256.equals(face.sha256)) {
            throw new IllegalArgumentException("A biometria facial deve ser capturada pela camera, separada do documento.");
        }
    }

    @Transactional
    public AccountOpeningKycEntity storeForUser(UserEntity user, KycPayload payload, String documentType, String documentNumber) {
        if (user == null || user.getId() == null) {
            throw new IllegalArgumentException("Usuario salvo e obrigatorio para KYC.");
        }

        StoredImage front = decodeAndValidate(payload.documentFrontImage(),
                "frente do documento", MIN_DOCUMENT_BYTES, 220, 140);
        StoredImage back = decodeAndValidate(payload.documentBackImage(),
                "verso do documento", MIN_DOCUMENT_BYTES, 220, 140);
        StoredImage face = decodeAndValidate(payload.faceImage(),
                "biometria facial", MIN_FACE_BYTES, 180, 180);

        try {
            Files.createDirectories(storageDir);
            StoredFile frontFile = writeImage(user.getId(), "document-front", front);
            StoredFile backFile = writeImage(user.getId(), "document-back", back);
            BiometricMediaCipher.EncryptedMedia encryptedFace = null;
            String faceStorageReference;
            if (biometricMediaCipher.isConfigured()) {
                encryptedFace = biometricMediaCipher.encrypt(face.bytes);
                faceStorageReference = "ENCRYPTED_DATABASE";
            } else {
                faceStorageReference = writeImage(user.getId(), "face-biometric", face).path.toString();
            }

            AccountOpeningKycEntity entity = repository.findByUserId(user.getId())
                    .orElseGet(AccountOpeningKycEntity::new);
            entity.setUser(user);
            entity.setDocumentType(documentType);
            entity.setDocumentNumber(documentNumber);
            entity.setFrontFilePath(frontFile.path.toString());
            entity.setBackFilePath(backFile.path.toString());
            entity.setFaceFilePath(faceStorageReference);
            entity.setFrontSha256(front.sha256);
            entity.setBackSha256(back.sha256);
            entity.setFaceSha256(face.sha256);
            if (encryptedFace != null) {
                entity.setFaceCipher(encryptedFace.cipherBytes());
                entity.setFaceCipherIv(encryptedFace.iv());
                entity.setFaceCipherAlgorithm(encryptedFace.algorithm());
            }
            entity.setFrontMime(front.mime);
            entity.setBackMime(back.mime);
            entity.setFaceMime(face.mime);
            entity.setFrontBytes((long) front.bytes.length);
            entity.setBackBytes((long) back.bytes.length);
            entity.setFaceBytes((long) face.bytes.length);
            entity.setFaceCaptureMethod("CAMERA");
            entity.setBiometricChallenge(cleanChallenge(payload.biometricChallenge()));
            entity.setProvider("BRAVUS_SELF_KYC");
            entity.setStatus("CAPTURADO");
            entity.setRiskScore(10);
            return repository.save(entity);
        } catch (IOException e) {
            throw new IllegalStateException("Falha ao armazenar arquivos KYC.", e);
        }
    }

    public ValidatedFace validateRecoveryFace(String dataUrl) {
        StoredImage face = decodeAndValidate(dataUrl, "biometria facial", MIN_FACE_BYTES, 180, 180);
        return new ValidatedFace(face.mime, face.bytes, face.sha256);
    }

    @Transactional
    public AccountOpeningKycEntity ensureEncryptedFace(AccountOpeningKycEntity entity) {
        if (entity == null || entity.getFaceCipher() != null) return entity;
        if (!biometricMediaCipher.isConfigured()) {
            throw new IllegalStateException("Protecao biometrica indisponivel.");
        }

        try {
            Path base = storageDir.toRealPath();
            Path legacyFace = Path.of(entity.getFaceFilePath()).toRealPath();
            if (!legacyFace.startsWith(base) || !Files.isRegularFile(legacyFace)) {
                throw new IllegalStateException("Arquivo biometrico legado fora do diretorio autorizado.");
            }
            byte[] bytes = Files.readAllBytes(legacyFace);
            if (bytes.length < MIN_FACE_BYTES || bytes.length > MAX_IMAGE_BYTES
                    || !sha256(bytes).equalsIgnoreCase(entity.getFaceSha256())) {
                throw new IllegalStateException("Integridade da biometria legada invalida.");
            }
            BiometricMediaCipher.EncryptedMedia encrypted = biometricMediaCipher.encrypt(bytes);
            entity.setFaceCipher(encrypted.cipherBytes());
            entity.setFaceCipherIv(encrypted.iv());
            entity.setFaceCipherAlgorithm(encrypted.algorithm());
            return repository.save(entity);
        } catch (IOException e) {
            throw new IllegalStateException("Biometria legada indisponivel para migracao protegida.", e);
        }
    }

    private StoredFile writeImage(Long userId, String label, StoredImage image) throws IOException {
        String timestamp = DateTimeFormatter.ofPattern("yyyyMMddHHmmssSSS")
                .format(OffsetDateTime.now());
        String extension = "image/png".equalsIgnoreCase(image.mime) ? ".png" : ".jpg";
        Path target = storageDir.resolve("user-" + userId + "-" + label + "-" + timestamp + extension)
                .normalize();
        if (!target.toAbsolutePath().startsWith(storageDir.toAbsolutePath().normalize())) {
            throw new IOException("Caminho KYC invalido.");
        }
        Files.write(target, image.bytes);
        return new StoredFile(target);
    }

    private StoredImage decodeAndValidate(String dataUrl,
                                          String label,
                                          int minBytes,
                                          int minWidth,
                                          int minHeight) {
        if (dataUrl == null || dataUrl.isBlank()) {
            throw new IllegalArgumentException("Envie a " + label + ".");
        }

        Matcher matcher = DATA_URL_PATTERN.matcher(dataUrl.trim());
        if (!matcher.matches()) {
            throw new IllegalArgumentException("A " + label + " deve ser imagem JPEG ou PNG em base64.");
        }

        String mime = matcher.group(1).toLowerCase(Locale.ROOT);
        byte[] bytes;
        try {
            bytes = Base64.getDecoder().decode(matcher.group(2));
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("A " + label + " esta com base64 invalido.");
        }

        if (bytes.length < minBytes) {
            throw new IllegalArgumentException("A " + label + " esta pequena demais para validacao.");
        }
        if (bytes.length > MAX_IMAGE_BYTES) {
            throw new IllegalArgumentException("A " + label + " excede 5 MB.");
        }

        BufferedImage image;
        try {
            image = ImageIO.read(new ByteArrayInputStream(bytes));
        } catch (IOException e) {
            throw new IllegalArgumentException("A " + label + " nao pode ser lida como imagem.");
        }
        if (image == null) {
            throw new IllegalArgumentException("A " + label + " nao e uma imagem valida.");
        }
        if (image.getWidth() < minWidth || image.getHeight() < minHeight) {
            throw new IllegalArgumentException("A " + label + " precisa ter resolucao minima de "
                    + minWidth + "x" + minHeight + ".");
        }

        return new StoredImage(mime, bytes, sha256(bytes));
    }

    private String sha256(byte[] bytes) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(bytes);
            StringBuilder out = new StringBuilder(hash.length * 2);
            for (byte b : hash) {
                out.append(String.format("%02x", b));
            }
            return out.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 indisponivel.", e);
        }
    }

    private String cleanChallenge(String challenge) {
        if (challenge == null || challenge.isBlank()) return "FACE_CAMERA_CAPTURE_V1";
        return challenge.length() > 120 ? challenge.substring(0, 120) : challenge;
    }

    private record StoredImage(String mime, byte[] bytes, String sha256) {}
    private record StoredFile(Path path) {}
    public record ValidatedFace(String mime, byte[] bytes, String sha256) {}
}
