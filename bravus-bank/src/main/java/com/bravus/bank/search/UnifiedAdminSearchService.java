package com.bravus.bank.search;

import com.bravus.bank.compliance.DocumentAnalysisEntity;
import com.bravus.bank.compliance.DocumentAnalysisRepository;
import com.bravus.bank.db.entity.TransactionEntity;
import com.bravus.bank.db.entity.UserEntity;
import com.bravus.bank.db.repo.TransactionRepository;
import com.bravus.bank.db.repo.UserRepository;
import com.bravus.bank.external.ExternalTransferEntity;
import com.bravus.bank.external.ExternalTransferRepository;
import com.bravus.bank.rail.CaymanRailInstructionEntity;
import com.bravus.bank.rail.CaymanRailInstructionRepository;
import com.bravus.bank.rail.CaymanRailParticipantEntity;
import com.bravus.bank.rail.CaymanRailParticipantRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class UnifiedAdminSearchService {
    private final UserRepository userRepo;
    private final TransactionRepository transactionRepo;
    private final DocumentAnalysisRepository analysisRepo;
    private final ExternalTransferRepository externalTransferRepo;
    private final CaymanRailInstructionRepository railInstructionRepo;
    private final CaymanRailParticipantRepository railParticipantRepo;
    private final AdminSearchAuditRepository auditRepo;

    public UnifiedAdminSearchService(UserRepository userRepo,
                                     TransactionRepository transactionRepo,
                                     DocumentAnalysisRepository analysisRepo,
                                     ExternalTransferRepository externalTransferRepo,
                                     CaymanRailInstructionRepository railInstructionRepo,
                                     CaymanRailParticipantRepository railParticipantRepo,
                                     AdminSearchAuditRepository auditRepo) {
        this.userRepo = userRepo;
        this.transactionRepo = transactionRepo;
        this.analysisRepo = analysisRepo;
        this.externalTransferRepo = externalTransferRepo;
        this.railInstructionRepo = railInstructionRepo;
        this.railParticipantRepo = railParticipantRepo;
        this.auditRepo = auditRepo;
    }

    @Transactional
    public UnifiedSearchDtos.SearchResponse search(SearchCommand cmd, String adminUsername) {
        if (cmd == null || blank(cmd.query)) {
            throw new IllegalArgumentException("Informe CPF, CNPJ, nome, placa, e-mail, telefone, conta ou termo.");
        }
        String query = cmd.query.trim();
        String normalized = normalize(query);
        String type = inferType(cmd.type, query);
        int limit = Math.max(1, Math.min(cmd.limit != null ? cmd.limit : 50, 100));

        UnifiedSearchDtos.SearchResponse response = new UnifiedSearchDtos.SearchResponse();
        response.query = query;
        response.queryType = type;
        response.normalizedQuery = normalized;

        searchUsers(response, normalized, limit);
        searchTransactions(response, normalized, limit);
        searchDocumentAnalyses(response, normalized, limit);
        searchExternalTransfers(response, normalized, limit);
        searchCaymanRail(response, normalized, limit);
        addVehicleConnectorResult(response, query, normalized, type);

        if (response.results.size() > limit) {
            response.results = response.results.subList(0, limit);
            response.warnings.add("Resultados limitados a " + limit + " itens.");
        }
        response.resultCount = response.results.size();
        response.results.forEach(r -> response.summary.merge(r.source, 1, Integer::sum));
        audit(query, type, normalized, response.resultCount, adminUsername);
        return response;
    }

    private void searchUsers(UnifiedSearchDtos.SearchResponse response, String normalized, int limit) {
        for (UserEntity user : userRepo.findAll()) {
            if (response.results.size() >= limit) return;
            if (!matches(normalized,
                    user.getUsername(), user.getEmail(), user.getFullName(), user.getCpf(),
                    user.getPhone(), user.getAccountNumber(), user.getChavePix(), user.getAgencia(),
                    user.getCodigoBanco(), user.getNomeBanco(), user.getStatusKyc(), user.getNivelConta())) {
                continue;
            }
            UnifiedSearchDtos.SearchResult r = result("USERS", "CLIENTE", user.getId(), user.getFullName(), user.getEmail(), user.getIsActive() ? "ATIVO" : "INATIVO");
            put(r.fields, "username", user.getUsername());
            put(r.fields, "email", user.getEmail());
            put(r.fields, "cpf", user.getCpf());
            put(r.fields, "phone", user.getPhone());
            put(r.fields, "accountNumber", user.getAccountNumber());
            put(r.fields, "agencia", user.getAgencia());
            put(r.fields, "codigoBanco", user.getCodigoBanco());
            put(r.fields, "nomeBanco", user.getNomeBanco());
            put(r.fields, "chavePix", user.getChavePix());
            put(r.fields, "statusKyc", user.getStatusKyc());
            put(r.fields, "nivelConta", user.getNivelConta());
            put(r.fields, "balanceCentavos", user.getBalance());
            response.results.add(r);
        }
    }

    private void searchTransactions(UnifiedSearchDtos.SearchResponse response, String normalized, int limit) {
        for (TransactionEntity tx : transactionRepo.findAll()) {
            if (response.results.size() >= limit) return;
            UserEntity user = tx.getUser();
            if (!matches(normalized,
                    String.valueOf(tx.getId()), tx.getType(), tx.getStatus(), tx.getDescription(),
                    tx.getDestinationAccount(), user != null ? user.getUsername() : null,
                    user != null ? user.getFullName() : null, user != null ? user.getCpf() : null,
                    user != null ? user.getAccountNumber() : null)) {
                continue;
            }
            UnifiedSearchDtos.SearchResult r = result("TRANSACTIONS", "TRANSACAO", tx.getId(), tx.getType(), tx.getDescription(), tx.getStatus());
            put(r.fields, "amountCentavos", tx.getAmount());
            put(r.fields, "destinationAccount", tx.getDestinationAccount());
            put(r.fields, "createdAt", tx.getCreatedAt());
            if (user != null) {
                put(r.fields, "userId", user.getId());
                put(r.fields, "user", user.getUsername());
                put(r.fields, "accountNumber", user.getAccountNumber());
            }
            response.results.add(r);
        }
    }

    private void searchDocumentAnalyses(UnifiedSearchDtos.SearchResponse response, String normalized, int limit) {
        for (DocumentAnalysisEntity analysis : analysisRepo.findAll()) {
            if (response.results.size() >= limit) return;
            if (!matches(normalized, analysis.getDocumentType(), analysis.getDocumentNumber(),
                    analysis.getProvider(), analysis.getStatus(), analysis.getSubjectName(),
                    analysis.getRegistrationStatus(), analysis.getRiskLevel())) {
                continue;
            }
            UnifiedSearchDtos.SearchResult r = result("DOCUMENT_ANALYSES", "ANALISE_DOCUMENTAL", analysis.getId(),
                    analysis.getDocumentType() + " " + analysis.getDocumentNumber(), analysis.getSubjectName(), analysis.getStatus());
            r.score = analysis.getRiskScore();
            put(r.fields, "provider", analysis.getProvider());
            put(r.fields, "validFormat", analysis.getValidFormat());
            put(r.fields, "riskLevel", analysis.getRiskLevel());
            put(r.fields, "riskScore", analysis.getRiskScore());
            put(r.fields, "registrationStatus", analysis.getRegistrationStatus());
            put(r.fields, "createdAt", analysis.getCreatedAt());
            response.results.add(r);
        }
    }

    private void searchExternalTransfers(UnifiedSearchDtos.SearchResponse response, String normalized, int limit) {
        for (ExternalTransferEntity order : externalTransferRepo.findAll()) {
            if (response.results.size() >= limit) return;
            if (!matches(normalized, String.valueOf(order.getId()), order.getChannel(), order.getStatus(),
                    order.getBeneficiaryName(), order.getBeneficiaryDocument(), order.getBankCode(),
                    order.getIspb(), order.getAgency(), order.getAccountNumber(), order.getPixKey(),
                    order.getProvider(), order.getProviderTransferId(), order.getIdempotencyKey())) {
                continue;
            }
            UnifiedSearchDtos.SearchResult r = result("EXTERNAL_TRANSFERS", "ENVIO_BANCARIO", order.getId(),
                    order.getChannel() + " " + order.getBeneficiaryName(), order.getProvider(), order.getStatus());
            put(r.fields, "amountCentavos", order.getAmountCentavos());
            put(r.fields, "currency", order.getCurrency());
            put(r.fields, "beneficiaryDocument", order.getBeneficiaryDocument());
            put(r.fields, "bankCode", order.getBankCode());
            put(r.fields, "ispb", order.getIspb());
            put(r.fields, "agency", order.getAgency());
            put(r.fields, "accountNumber", order.getAccountNumber());
            put(r.fields, "pixKey", order.getPixKey());
            put(r.fields, "createdAt", order.getCreatedAt());
            response.results.add(r);
        }
    }

    private void searchCaymanRail(UnifiedSearchDtos.SearchResponse response, String normalized, int limit) {
        for (CaymanRailInstructionEntity instruction : railInstructionRepo.findAll()) {
            if (response.results.size() >= limit) return;
            if (!matches(normalized, String.valueOf(instruction.getId()), instruction.getIdempotencyKey(),
                    instruction.getCurrency(), instruction.getChannel(), instruction.getBeneficiaryName(),
                    instruction.getBeneficiaryDocument(), instruction.getBeneficiaryAccount(),
                    instruction.getStatus(), instruction.getComplianceResult(), instruction.getRegulatoryGate())) {
                continue;
            }
            UnifiedSearchDtos.SearchResult r = result("CAYMAN_RAIL", "ORDEM_CAYMAN", instruction.getId(),
                    instruction.getBeneficiaryName(), instruction.getBeneficiaryAccount(), instruction.getStatus());
            put(r.fields, "amountMinor", instruction.getAmountMinor());
            put(r.fields, "currency", instruction.getCurrency());
            put(r.fields, "beneficiaryDocument", instruction.getBeneficiaryDocument());
            put(r.fields, "complianceResult", instruction.getComplianceResult());
            put(r.fields, "regulatoryGate", instruction.getRegulatoryGate());
            put(r.fields, "createdAt", instruction.getCreatedAt());
            response.results.add(r);
        }

        for (CaymanRailParticipantEntity participant : railParticipantRepo.findAll()) {
            if (response.results.size() >= limit) return;
            if (!matches(normalized, participant.getParticipantCode(), participant.getLegalName(),
                    participant.getInstitutionType(), participant.getCountry(), participant.getSwiftBic(),
                    participant.getLocalRoutingCode(), participant.getSettlementAccount(), participant.getStatus())) {
                continue;
            }
            UnifiedSearchDtos.SearchResult r = result("CAYMAN_RAIL", "PARTICIPANTE_CAYMAN", participant.getId(),
                    participant.getParticipantCode(), participant.getLegalName(), participant.getStatus());
            put(r.fields, "institutionType", participant.getInstitutionType());
            put(r.fields, "country", participant.getCountry());
            put(r.fields, "swiftBic", participant.getSwiftBic());
            put(r.fields, "localRoutingCode", participant.getLocalRoutingCode());
            put(r.fields, "settlementAccount", participant.getSettlementAccount());
            response.results.add(r);
        }
    }

    private void addVehicleConnectorResult(UnifiedSearchDtos.SearchResponse response, String query, String normalized, String type) {
        if (!"PLACA".equals(type) && !looksLikePlate(query)) return;
        UnifiedSearchDtos.SearchResult r = result("VEHICLE_PROVIDER", "PLACA_VEICULAR", normalized, "Placa " + normalized,
                "Conector veicular oficial nao configurado", "CONECTOR_NECESSARIO");
        put(r.fields, "plate", normalized);
        put(r.fields, "requiredProvider", "Senatran/Serpro ou fonte oficial autorizada");
        put(r.fields, "reason", "Consulta real de dados veiculares exige acesso autorizado e base legal.");
        response.results.add(r);
        response.warnings.add("Placa reconhecida. O Bravus registrou a consulta, mas nao acessa RENAVAM/Senatran sem conector oficial autorizado.");
    }

    private void audit(String query, String type, String normalized, int resultCount, String adminUsername) {
        AdminSearchAuditEntity audit = new AdminSearchAuditEntity();
        audit.setQueryText(query);
        audit.setQueryType(type);
        audit.setNormalizedQuery(normalized);
        audit.setResultCount(resultCount);
        if (!blank(adminUsername)) {
            userRepo.findByUsername(adminUsername).ifPresent(audit::setRequestedBy);
        }
        auditRepo.save(audit);
    }

    private UnifiedSearchDtos.SearchResult result(String source, String kind, Object id, String title, String subtitle, String status) {
        UnifiedSearchDtos.SearchResult r = new UnifiedSearchDtos.SearchResult();
        r.source = source;
        r.kind = kind;
        r.id = id == null ? null : String.valueOf(id);
        r.title = title;
        r.subtitle = subtitle;
        r.status = status;
        return r;
    }

    private void put(Map<String, Object> fields, String key, Object value) {
        if (value != null) fields.put(key, value);
    }

    private boolean matches(String normalizedQuery, String... values) {
        if (blank(normalizedQuery)) return false;
        String digitsQuery = digits(normalizedQuery);
        for (String value : values) {
            if (blank(value)) continue;
            String normalizedValue = normalize(value);
            if (normalizedValue.contains(normalizedQuery)) return true;
            if (!digitsQuery.isBlank() && digits(normalizedValue).contains(digitsQuery)) return true;
        }
        return false;
    }

    private String inferType(String explicit, String query) {
        if (!blank(explicit) && !"AUTO".equalsIgnoreCase(explicit)) return explicit.trim().toUpperCase(Locale.ROOT);
        String digits = digits(query);
        if (digits.length() == 11) return "CPF";
        if (digits.length() == 14) return "CNPJ";
        if (looksLikePlate(query)) return "PLACA";
        if (query.contains("@")) return "EMAIL";
        if (digits.length() >= 8 && digits.length() <= 13) return "TELEFONE_OU_CONTA";
        return "GERAL";
    }

    private boolean looksLikePlate(String value) {
        String plate = normalize(value).replaceAll("[^A-Z0-9]", "");
        return plate.matches("[A-Z]{3}[0-9][A-Z0-9][0-9]{2}");
    }

    private String normalize(String value) {
        if (value == null) return "";
        return value.trim().toUpperCase(Locale.ROOT)
                .replace("Á", "A").replace("À", "A").replace("Â", "A").replace("Ã", "A")
                .replace("É", "E").replace("Ê", "E")
                .replace("Í", "I")
                .replace("Ó", "O").replace("Ô", "O").replace("Õ", "O")
                .replace("Ú", "U")
                .replace("Ç", "C");
    }

    private String digits(String value) {
        return value == null ? "" : value.replaceAll("\\D", "");
    }

    private boolean blank(String value) {
        return value == null || value.isBlank();
    }

    public static class SearchCommand {
        public String query;
        public String type;
        public Integer limit;
    }
}
