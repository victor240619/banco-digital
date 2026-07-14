package com.bravus.bank.auth.recovery;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/admin/password-reset")
@PreAuthorize("hasRole('ADMIN')")
public class AdminPasswordResetController {
    private final PasswordResetService service;

    public AdminPasswordResetController(PasswordResetService service) {
        this.service = service;
    }

    @GetMapping("/requests")
    public ResponseEntity<?> pendingRequests() {
        return ResponseEntity.ok(service.pendingReview());
    }

    @GetMapping("/requests/{requestId}/evidence")
    public ResponseEntity<?> evidence(@PathVariable UUID requestId, Authentication authentication) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .header("Pragma", "no-cache")
                .body(service.evidence(requestId, authentication.getName()));
    }

    @PostMapping("/requests/{requestId}/approve")
    public ResponseEntity<?> approve(@PathVariable UUID requestId,
                                     @RequestBody @Valid ReviewRequest request,
                                     Authentication authentication) {
        return ResponseEntity.ok(service.approve(requestId, authentication.getName(), request.reason()));
    }

    @PostMapping("/requests/{requestId}/reject")
    public ResponseEntity<?> reject(@PathVariable UUID requestId,
                                    @RequestBody @Valid ReviewRequest request,
                                    Authentication authentication) {
        return ResponseEntity.ok(service.reject(requestId, authentication.getName(), request.reason()));
    }

    public record ReviewRequest(@NotBlank @Size(min = 10, max = 500) String reason) {}
}
