package com.bravus.bank.rail;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/cayman-rail")
@PreAuthorize("hasRole('ADMIN')")
public class CaymanRailController {
    private final CaymanRailService railService;

    public CaymanRailController(CaymanRailService railService) {
        this.railService = railService;
    }

    @GetMapping("/config")
    public ResponseEntity<CaymanRailConfigEntity> config() {
        return ResponseEntity.ok(railService.getConfig());
    }

    @PutMapping("/config")
    public ResponseEntity<CaymanRailConfigEntity> updateConfig(@RequestBody ConfigRequest request) {
        CaymanRailService.ConfigCommand cmd = new CaymanRailService.ConfigCommand();
        cmd.legalEntityName = request.legalEntityName();
        cmd.jurisdiction = request.jurisdiction();
        cmd.registryNumber = request.registryNumber();
        cmd.cimaLicenseNumber = request.cimaLicenseNumber();
        cmd.licenseClass = request.licenseClass();
        cmd.regulatoryStatus = request.regulatoryStatus();
        cmd.productionEnabled = request.productionEnabled();
        cmd.settlementMode = request.settlementMode();
        cmd.amlPolicyVersion = request.amlPolicyVersion();
        return ResponseEntity.ok(railService.updateConfig(cmd));
    }

    @GetMapping("/readiness")
    public ResponseEntity<Map<String, Object>> readiness() {
        return ResponseEntity.ok(railService.readiness());
    }

    @GetMapping("/participants")
    public ResponseEntity<List<CaymanRailParticipantEntity>> participants() {
        return ResponseEntity.ok(railService.participants());
    }

    @PostMapping("/participants")
    public ResponseEntity<CaymanRailParticipantEntity> createParticipant(
            @Valid @RequestBody ParticipantRequest request) {
        CaymanRailService.ParticipantCommand cmd = new CaymanRailService.ParticipantCommand();
        cmd.participantCode = request.participantCode();
        cmd.legalName = request.legalName();
        cmd.institutionType = request.institutionType();
        cmd.country = request.country();
        cmd.swiftBic = request.swiftBic();
        cmd.localRoutingCode = request.localRoutingCode();
        cmd.settlementAccount = request.settlementAccount();
        cmd.directParticipant = request.directParticipant();
        cmd.status = request.status();
        return ResponseEntity.ok(railService.createParticipant(cmd));
    }

    @GetMapping("/instructions")
    public ResponseEntity<List<CaymanRailInstructionEntity>> instructions(
            @RequestParam(defaultValue = "20") int limit) {
        return ResponseEntity.ok(railService.instructions(limit));
    }

    @PostMapping("/instructions")
    public ResponseEntity<CaymanRailInstructionEntity> submitInstruction(
            @Valid @RequestBody InstructionRequest request,
            Authentication auth) {
        CaymanRailService.InstructionCommand cmd = new CaymanRailService.InstructionCommand();
        cmd.userId = request.userId();
        cmd.participantId = request.participantId();
        cmd.amountMinor = request.amountMinor();
        cmd.currency = request.currency();
        cmd.channel = request.channel();
        cmd.beneficiaryName = request.beneficiaryName();
        cmd.beneficiaryDocument = request.beneficiaryDocument();
        cmd.beneficiaryAccount = request.beneficiaryAccount();
        cmd.description = request.description();
        return ResponseEntity.ok(railService.submitInstruction(cmd, auth.getName()));
    }

    public record ConfigRequest(
            String legalEntityName,
            String jurisdiction,
            String registryNumber,
            String cimaLicenseNumber,
            String licenseClass,
            String regulatoryStatus,
            Boolean productionEnabled,
            String settlementMode,
            String amlPolicyVersion
    ) {}

    public record ParticipantRequest(
            @NotBlank String participantCode,
            @NotBlank String legalName,
            String institutionType,
            String country,
            String swiftBic,
            String localRoutingCode,
            String settlementAccount,
            Boolean directParticipant,
            String status
    ) {}

    public record InstructionRequest(
            Long userId,
            Long participantId,
            @NotNull @Positive Long amountMinor,
            String currency,
            String channel,
            @NotBlank String beneficiaryName,
            String beneficiaryDocument,
            @NotBlank String beneficiaryAccount,
            String description
    ) {}
}
