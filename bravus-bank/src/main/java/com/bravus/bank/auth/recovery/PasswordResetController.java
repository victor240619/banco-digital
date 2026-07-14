package com.bravus.bank.auth.recovery;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;
import java.util.UUID;

@RestController
@RequestMapping("/api/auth/password-reset")
public class PasswordResetController {
    private final PasswordResetService service;

    public PasswordResetController(PasswordResetService service) {
        this.service = service;
    }

    @PostMapping("/start")
    public ResponseEntity<?> start(@RequestBody @Valid StartRequest request) {
        PasswordResetService.StartResult result = service.start(new PasswordResetService.StartCommand(
                request.identifier(), request.idempotencyKey(), request.clientSecret()));
        return ResponseEntity.accepted()
                .location(URI.create("/api/auth/password-reset/status"))
                .body(result);
    }

    @PostMapping("/face")
    public ResponseEntity<?> submitFace(@RequestBody @Valid FaceRequest request) {
        return ResponseEntity.accepted().body(service.submitFace(new PasswordResetService.SubmitFaceCommand(
                request.requestId(), request.clientSecret(), request.challenge(), request.faceImage())));
    }

    @PostMapping("/status")
    public ResponseEntity<?> status(@RequestBody @Valid StatusRequest request) {
        return ResponseEntity.ok(service.status(new PasswordResetService.StatusCommand(
                request.requestId(), request.clientSecret())));
    }

    @PostMapping("/complete")
    public ResponseEntity<?> complete(@RequestBody @Valid CompleteRequest request) {
        return ResponseEntity.ok(service.complete(new PasswordResetService.CompleteCommand(
                request.requestId(), request.clientSecret(), request.newPassword())));
    }

    public record StartRequest(
            @NotBlank @Size(max = 150) String identifier,
            @NotBlank @Size(min = 20, max = 128) String idempotencyKey,
            @NotBlank @Size(min = 32, max = 160) String clientSecret
    ) {}

    public record FaceRequest(
            @NotNull UUID requestId,
            @NotBlank @Size(min = 32, max = 160) String clientSecret,
            @NotBlank @Size(max = 120) String challenge,
            @NotBlank @Size(max = 7000000) String faceImage
    ) {}

    public record StatusRequest(
            @NotNull UUID requestId,
            @NotBlank @Size(min = 32, max = 160) String clientSecret
    ) {}

    public record CompleteRequest(
            @NotNull UUID requestId,
            @NotBlank @Size(min = 32, max = 160) String clientSecret,
            @NotBlank @Size(min = 8, max = 128) String newPassword
    ) {}
}
