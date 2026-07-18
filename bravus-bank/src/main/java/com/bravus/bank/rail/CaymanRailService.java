package com.bravus.bank.rail;

import com.bravus.bank.compliance.DocumentAnalysisEntity;
import com.bravus.bank.compliance.DocumentAnalysisService;
import com.bravus.bank.db.entity.UserEntity;
import com.bravus.bank.db.repo.UserRepository;
import com.bravus.bank.identity.InstitutionRoutingProfile;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class CaymanRailService {
    private static final long CONFIG_ID = 1L;

    private final CaymanRailConfigRepository configRepo;
    private final CaymanRailParticipantRepository participantRepo;
    private final CaymanRailInstructionRepository instructionRepo;
    private final UserRepository userRepo;
    private final DocumentAnalysisService documentAnalysisService;

    public CaymanRailService(CaymanRailConfigRepository configRepo,
                             CaymanRailParticipantRepository participantRepo,
                             CaymanRailInstructionRepository instructionRepo,
                             UserRepository userRepo,
                             DocumentAnalysisService documentAnalysisService) {
        this.configRepo = configRepo;
        this.participantRepo = participantRepo;
        this.instructionRepo = instructionRepo;
        this.userRepo = userRepo;
        this.documentAnalysisService = documentAnalysisService;
    }

    @Transactional(readOnly = true)
    public CaymanRailConfigEntity getConfig() {
        return configRepo.findById(CONFIG_ID).orElseGet(CaymanRailConfigEntity::new);
    }

    @Transactional
    public CaymanRailConfigEntity updateConfig(ConfigCommand cmd) {
        CaymanRailConfigEntity config = configRepo.findById(CONFIG_ID).orElseGet(CaymanRailConfigEntity::new);
        if (!blank(cmd.legalEntityName)) config.setLegalEntityName(cmd.legalEntityName.trim());
        if (!blank(cmd.jurisdiction)) config.setJurisdiction(cmd.jurisdiction.trim());
        config.setRegistryNumber(clean(cmd.registryNumber));
        config.setCimaLicenseNumber(clean(cmd.cimaLicenseNumber));
        config.setLicenseClass(clean(cmd.licenseClass));
        config.setRegulatoryStatus(upperOrDefault(cmd.regulatoryStatus, "DRAFT"));
        config.setProductionEnabled(Boolean.TRUE.equals(cmd.productionEnabled));
        config.setSettlementMode(upperOrDefault(cmd.settlementMode, "INTERNAL_ONLY"));
        config.setAmlPolicyVersion(clean(cmd.amlPolicyVersion));
        enforceProductionGate(config);
        return configRepo.save(config);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> readiness() {
        CaymanRailConfigEntity config = getConfig();
        long activeParticipants = participantRepo.countByStatus("ACTIVE");
        long blockedInstructions = instructionRepo.countByStatus("BLOCKED_LICENSE_REQUIRED");

        boolean companyRegistered = !blank(config.getRegistryNumber());
        boolean cimaLicensed = "LICENSED".equals(config.getRegulatoryStatus())
                && !blank(config.getCimaLicenseNumber());
        boolean liveSettlement = "LIVE_LICENSED".equals(config.getSettlementMode());
        boolean productionReady = companyRegistered
                && cimaLicensed
                && liveSettlement
                && Boolean.TRUE.equals(config.getProductionEnabled())
                && activeParticipants > 0;

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("companyRegistered", companyRegistered);
        result.put("cimaLicensed", cimaLicensed);
        result.put("liveSettlement", liveSettlement);
        result.put("activeParticipants", activeParticipants);
        result.put("blockedInstructions", blockedInstructions);
        result.put("productionReady", productionReady);
        result.put("gate", productionReady ? "READY" : "LICENSE_REQUIRED");
        result.put("institution", InstitutionRoutingProfile.publicView());
        result.put("message", productionReady
                ? "Trilho Cayman liberado para liquidacao licenciada."
                : "Trilho Cayman bloqueado para dinheiro real ate registro, licenca CIMA, modo LIVE_LICENSED e participante ativo.");
        return result;
    }

    @Transactional(readOnly = true)
    public List<CaymanRailParticipantEntity> participants() {
        return participantRepo.findAllByOrderByCreatedAtDesc();
    }

    @Transactional
    public CaymanRailParticipantEntity createParticipant(ParticipantCommand cmd) {
        String code = upperOrDefault(cmd.participantCode, "");
        if (blank(code)) throw new IllegalArgumentException("Codigo do participante e obrigatorio.");
        participantRepo.findByParticipantCode(code).ifPresent(existing -> {
            throw new IllegalArgumentException("Participante ja existe: " + code);
        });
        if (blank(cmd.legalName)) throw new IllegalArgumentException("Nome legal do participante e obrigatorio.");

        CaymanRailParticipantEntity participant = new CaymanRailParticipantEntity();
        participant.setParticipantCode(code);
        participant.setLegalName(cmd.legalName.trim());
        String country = upperOrDefault(cmd.country, "KY");
        String institutionType = upperOrDefault(cmd.institutionType, "INTERNAL");
        boolean bravusOwned = code.startsWith("BRAVUS") || "INTERNAL".equals(institutionType);
        participant.setInstitutionType(institutionType);
        participant.setCountry(country);
        participant.setSwiftBic(InstitutionRoutingProfile.validateExternalBic(cmd.swiftBic, country, bravusOwned));
        participant.setLocalRoutingCode(clean(cmd.localRoutingCode));
        participant.setSettlementAccount(clean(cmd.settlementAccount));
        participant.setDirectParticipant(Boolean.TRUE.equals(cmd.directParticipant));
        participant.setStatus(upperOrDefault(cmd.status, "PENDING"));
        return participantRepo.save(participant);
    }

    @Transactional(readOnly = true)
    public List<CaymanRailInstructionEntity> instructions(int limit) {
        int safeLimit = Math.max(1, Math.min(limit, 50));
        return instructionRepo.findAllByOrderByCreatedAtDesc(PageRequest.of(0, safeLimit));
    }

    @Transactional
    public CaymanRailInstructionEntity submitInstruction(InstructionCommand cmd, String adminUsername) {
        if (cmd.amountMinor == null || cmd.amountMinor <= 0) {
            throw new IllegalArgumentException("Valor deve ser positivo.");
        }
        if (blank(cmd.beneficiaryName)) throw new IllegalArgumentException("Beneficiario obrigatorio.");
        if (blank(cmd.beneficiaryAccount)) throw new IllegalArgumentException("Conta beneficiaria obrigatoria.");

        UserEntity admin = !blank(adminUsername) ? userRepo.findByUsername(adminUsername).orElse(null) : null;
        UserEntity user = cmd.userId != null
                ? userRepo.findById(cmd.userId).orElseThrow(() -> new IllegalArgumentException("Usuario nao encontrado."))
                : null;
        if (user != null) {
            documentAnalysisService.assertApprovedForUser(user);
        }

        CaymanRailParticipantEntity participant = null;
        if (cmd.participantId != null) {
            participant = participantRepo.findById(cmd.participantId)
                    .orElseThrow(() -> new IllegalArgumentException("Participante nao encontrado."));
            if (!"ACTIVE".equals(participant.getStatus())) {
                throw new IllegalStateException("Participante nao esta ativo no trilho.");
            }
        }

        CaymanRailInstructionEntity instruction = new CaymanRailInstructionEntity();
        instruction.setIdempotencyKey("cayman-" + UUID.randomUUID());
        instruction.setUser(user);
        instruction.setParticipant(participant);
        instruction.setAmountMinor(cmd.amountMinor);
        instruction.setCurrency(upperOrDefault(cmd.currency, "KYD"));
        instruction.setChannel(upperOrDefault(cmd.channel, "CAYMAN_RAIL"));
        instruction.setBeneficiaryName(cmd.beneficiaryName.trim());
        instruction.setBeneficiaryDocument(cleanDigitsOrText(cmd.beneficiaryDocument));
        instruction.setBeneficiaryAccount(cmd.beneficiaryAccount.trim());
        instruction.setDescription(clean(cmd.description));
        instruction.setCreatedBy(admin);

        applyCompliance(cmd, adminUsername, instruction);
        applyRegulatoryGate(instruction, participant);
        return instructionRepo.save(instruction);
    }

    private void applyCompliance(InstructionCommand cmd, String adminUsername, CaymanRailInstructionEntity instruction) {
        String digits = digits(cmd.beneficiaryDocument);
        if (digits.length() == 11 || digits.length() == 14) {
            DocumentAnalysisService.AnalysisCommand analysis = new DocumentAnalysisService.AnalysisCommand();
            analysis.document = digits;
            analysis.subjectName = cmd.beneficiaryName;
            DocumentAnalysisEntity result = documentAnalysisService.assertApproved(
                    analysis, adminUsername, "o beneficiario do Cayman Rail");
            instruction.setComplianceResult("DOCUMENT_OK_" + result.getRiskLevel());
        } else {
            instruction.setComplianceResult("MANUAL_REVIEW_REQUIRED");
        }
    }

    private void applyRegulatoryGate(CaymanRailInstructionEntity instruction, CaymanRailParticipantEntity participant) {
        Map<String, Object> ready = readiness();
        boolean productionReady = Boolean.TRUE.equals(ready.get("productionReady"));
        if (!productionReady) {
            instruction.setStatus("BLOCKED_LICENSE_REQUIRED");
            instruction.setRegulatoryGate("LICENSE_REQUIRED");
            instruction.setErrorMessage(String.valueOf(ready.get("message")));
            return;
        }
        if ("MANUAL_REVIEW_REQUIRED".equals(instruction.getComplianceResult())) {
            instruction.setStatus("COMPLIANCE_HOLD");
            instruction.setRegulatoryGate("MANUAL_REVIEW");
            return;
        }
        if (participant != null && "INTERNAL".equals(participant.getInstitutionType())) {
            instruction.setStatus("SETTLED_INTERNAL");
            instruction.setRegulatoryGate("INTERNAL_SETTLEMENT");
            return;
        }
        instruction.setStatus("READY_FOR_SETTLEMENT");
        instruction.setRegulatoryGate("LIVE_LICENSED");
    }

    private void enforceProductionGate(CaymanRailConfigEntity config) {
        boolean registered = !blank(config.getRegistryNumber());
        boolean licensed = "LICENSED".equals(config.getRegulatoryStatus()) && !blank(config.getCimaLicenseNumber());
        if (!registered || !licensed) {
            config.setProductionEnabled(false);
            if ("LIVE_LICENSED".equals(config.getSettlementMode())) {
                config.setSettlementMode("INTERNAL_ONLY");
            }
        }
    }

    private String upperOrDefault(String value, String fallback) {
        return blank(value) ? fallback : value.trim().toUpperCase();
    }

    private String upper(String value) {
        return value == null ? null : value.trim().toUpperCase();
    }

    private String clean(String value) {
        return blank(value) ? null : value.trim();
    }

    private String cleanDigitsOrText(String value) {
        if (blank(value)) return null;
        String digits = digits(value);
        return digits.isBlank() ? value.trim() : digits;
    }

    private String digits(String value) {
        return value == null ? "" : value.replaceAll("\\D", "");
    }

    private boolean blank(String value) {
        return value == null || value.isBlank();
    }

    public static class ConfigCommand {
        public String legalEntityName;
        public String jurisdiction;
        public String registryNumber;
        public String cimaLicenseNumber;
        public String licenseClass;
        public String regulatoryStatus;
        public Boolean productionEnabled;
        public String settlementMode;
        public String amlPolicyVersion;
    }

    public static class ParticipantCommand {
        public String participantCode;
        public String legalName;
        public String institutionType;
        public String country;
        public String swiftBic;
        public String localRoutingCode;
        public String settlementAccount;
        public Boolean directParticipant;
        public String status;
    }

    public static class InstructionCommand {
        public Long userId;
        public Long participantId;
        public Long amountMinor;
        public String currency;
        public String channel;
        public String beneficiaryName;
        public String beneficiaryDocument;
        public String beneficiaryAccount;
        public String description;
    }
}
