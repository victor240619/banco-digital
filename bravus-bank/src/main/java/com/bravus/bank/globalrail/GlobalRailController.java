package com.bravus.bank.globalrail;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin/global-rail")
@PreAuthorize("hasRole('ADMIN')")
public class GlobalRailController {
    private final GlobalRailService globalRailService;

    public GlobalRailController(GlobalRailService globalRailService) {
        this.globalRailService = globalRailService;
    }

    @GetMapping("/participants")
    public ResponseEntity<List<GlobalRailParticipantEntity>> participants() {
        return ResponseEntity.ok(globalRailService.participants());
    }

    @PostMapping("/participants")
    public ResponseEntity<GlobalRailParticipantEntity> createParticipant(
            @Valid @RequestBody ParticipantRequest request) {
        GlobalRailService.ParticipantCommand cmd = new GlobalRailService.ParticipantCommand();
        cmd.participantCode = request.participantCode();
        cmd.legalName = request.legalName();
        cmd.country = request.country();
        cmd.network = request.network();
        cmd.bankCode = request.bankCode();
        cmd.ispb = request.ispb();
        cmd.swiftBic = request.swiftBic();
        cmd.routingCode = request.routingCode();
        cmd.endpointUrl = request.endpointUrl();
        cmd.authMode = request.authMode();
        cmd.connectionMode = request.connectionMode();
        cmd.settlementAccount = request.settlementAccount();
        cmd.supportsInstant = request.supportsInstant();
        cmd.status = request.status();
        return ResponseEntity.ok(globalRailService.createOrUpdateParticipant(cmd));
    }

    @PostMapping("/transfers/{orderId}/confirm")
    public ResponseEntity<?> confirmTransfer(@PathVariable Long orderId,
                                             @RequestBody ConfirmRequest request) {
        GlobalRailService.ConfirmCommand cmd = new GlobalRailService.ConfirmCommand();
        cmd.confirmationId = request.confirmationId();
        cmd.destinationNetwork = request.destinationNetwork();
        cmd.participantCode = request.participantCode();
        cmd.message = request.message();
        return ResponseEntity.ok(globalRailService.confirmTransfer(orderId, cmd));
    }

    public record ParticipantRequest(
            @NotBlank String participantCode,
            @NotBlank String legalName,
            String country,
            String network,
            String bankCode,
            String ispb,
            String swiftBic,
            String routingCode,
            String endpointUrl,
            String authMode,
            String connectionMode,
            String settlementAccount,
            Boolean supportsInstant,
            String status
    ) {}

    public record ConfirmRequest(
            String confirmationId,
            String destinationNetwork,
            String participantCode,
            String message
    ) {}
}
