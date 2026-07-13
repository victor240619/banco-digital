package com.bravus.bank.compliance;

import com.bravus.bank.db.entity.UserEntity;
import com.bravus.bank.db.repo.UserRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;

import java.util.List;

@Service
public class DocumentAnalysisService {
    private static final String PROVIDER_INTERNAL = "BRAVUS_INTERNAL";

    private final DocumentAnalysisRepository analysisRepo;
    private final UserRepository userRepo;
    private final ObjectMapper mapper;
    private final RestClient restClient = RestClient.create();

    @Value("${BRAVUS_DOCUMENT_ANALYSIS_MODE:INTERNAL}")
    private String analysisMode;

    @Value("${BRAVUS_CNPJ_API_URL:}")
    private String cnpjBaseUrl;

    @Value("${BRAVUS_CPF_API_URL:}")
    private String cpfApiUrl;

    @Value("${BRAVUS_CPF_API_TOKEN:}")
    private String cpfApiToken;

    public DocumentAnalysisService(DocumentAnalysisRepository analysisRepo,
                                   UserRepository userRepo,
                                   ObjectMapper mapper) {
        this.analysisRepo = analysisRepo;
        this.userRepo = userRepo;
        this.mapper = mapper;
    }

    @Transactional
    public DocumentAnalysisEntity analyze(AnalysisCommand cmd, String adminUsername) {
        AnalysisCommand safeCmd = cmd != null ? cmd : new AnalysisCommand();
        String type = DocumentUtils.inferType(safeCmd.type, safeCmd.document);
        String digits = DocumentUtils.digits(safeCmd.document);
        boolean validFormat = "CPF".equals(type)
                ? DocumentUtils.validCpf(digits)
                : "CNPJ".equals(type) && DocumentUtils.validCnpj(digits);

        UserEntity admin = adminUsername != null && !adminUsername.isBlank()
                ? userRepo.findByUsername(adminUsername).orElse(null)
                : null;
        DocumentAnalysisEntity entity = new DocumentAnalysisEntity();
        entity.setDocumentType(type);
        entity.setDocumentNumber(digits);
        entity.setRequestedBy(admin);
        entity.setValidFormat(validFormat);
        entity.setSubjectName(safeCmd.subjectName);

        if (!"CPF".equals(type) && !"CNPJ".equals(type)) {
            entity.setProvider(PROVIDER_INTERNAL);
            entity.setStatus("TIPO_INVALIDO");
            entity.setRiskLevel("ALTO");
            entity.setRiskScore(100);
            entity.setErrorMessage("Informe CPF com 11 digitos ou CNPJ com 14 digitos.");
            return analysisRepo.save(entity);
        }

        if (!validFormat) {
            entity.setProvider(PROVIDER_INTERNAL);
            entity.setStatus("DOCUMENTO_INVALIDO");
            entity.setRiskLevel("ALTO");
            entity.setRiskScore(100);
            entity.setErrorMessage(type + " invalido pelo digito verificador.");
            return analysisRepo.save(entity);
        }

        if (usesInternalProvider(type)) {
            applyInternalAnalysis(type, entity);
            return analysisRepo.save(entity);
        }

        try {
            JsonNode payload = "CNPJ".equals(type) ? queryCnpj(digits) : queryCpf(digits);
            entity.setRawResponse(mapper.writeValueAsString(payload));
            String providerName = extractName(type, payload);
            if (providerName != null && !providerName.isBlank()) {
                entity.setSubjectName(providerName);
            }
            entity.setRegistrationStatus(extractRegistrationStatus(type, payload));
            entity.setProvider("CNPJ".equals(type) ? "BRASILAPI" : "CPF_PROVIDER");
            entity.setStatus("CONSULTADO");
            applyRisk(type, entity);
        } catch (ProviderNotConfiguredException e) {
            entity.setProvider("CNPJ".equals(type) ? "BRASILAPI" : "CPF_PROVIDER");
            entity.setStatus("PROVEDOR_NAO_CONFIGURADO");
            entity.setRiskLevel("BLOQUEADO");
            entity.setRiskScore(100);
            entity.setErrorMessage(e.getMessage());
        } catch (Exception e) {
            entity.setProvider("CNPJ".equals(type) ? "BRASILAPI" : "CPF_PROVIDER");
            entity.setStatus("ERRO_CONSULTA");
            entity.setRiskLevel("ALTO");
            entity.setRiskScore(100);
            entity.setErrorMessage(e.getMessage());
        }

        return analysisRepo.save(entity);
    }

    @Transactional
    public DocumentAnalysisEntity analyzeForUser(UserEntity user) {
        if (user == null) {
            throw new IllegalArgumentException("Usuario obrigatorio para analise automatica.");
        }
        AnalysisCommand cmd = new AnalysisCommand();
        cmd.document = user.getCpf();
        cmd.subjectName = user.getFullName();
        cmd.userId = user.getId();
        return analyze(cmd, null);
    }

    @Transactional
    public DocumentAnalysisEntity assertApprovedForUser(UserEntity user) {
        DocumentAnalysisEntity analysis = analyzeForUser(user);
        user.setStatusKyc(kycStatusFor(analysis));
        userRepo.save(user);
        if (isBlockingRisk(analysis)) {
            throw new IllegalStateException("Analise automatica bloqueou a operacao para o usuario "
                    + user.getUsername() + ": " + analysis.getStatus());
        }
        return analysis;
    }

    @Transactional
    public DocumentAnalysisEntity assertApproved(AnalysisCommand cmd, String adminUsername, String label) {
        DocumentAnalysisEntity analysis = analyze(cmd, adminUsername);
        if (isBlockingRisk(analysis)) {
            throw new IllegalStateException("Analise automatica bloqueou " + label + ": " + analysis.getStatus());
        }
        return analysis;
    }

    public String kycStatusFor(DocumentAnalysisEntity analysis) {
        if (analysis == null) return "EM_ANALISE";
        if ("BAIXO".equals(analysis.getRiskLevel())) return "APROVADO_AUTO";
        if ("MEDIO".equals(analysis.getRiskLevel())) return "EM_ANALISE";
        return "BLOQUEADO_ANALISE";
    }

    @Transactional(readOnly = true)
    public List<DocumentAnalysisEntity> recent(int limit) {
        int safeLimit = Math.max(1, Math.min(limit, 50));
        return analysisRepo.findAllByOrderByCreatedAtDesc(PageRequest.of(0, safeLimit));
    }

    private JsonNode queryCnpj(String cnpj) {
        if (cnpjBaseUrl == null || cnpjBaseUrl.isBlank()) {
            throw new ProviderNotConfiguredException(
                    "Configure BRAVUS_CNPJ_API_URL ou use BRAVUS_DOCUMENT_ANALYSIS_MODE=INTERNAL.");
        }
        String url = cnpjBaseUrl.endsWith("/") ? cnpjBaseUrl + cnpj : cnpjBaseUrl + "/" + cnpj;
        return restClient.get().uri(url).retrieve().body(JsonNode.class);
    }

    private JsonNode queryCpf(String cpf) {
        if (cpfApiUrl == null || cpfApiUrl.isBlank()) {
            throw new ProviderNotConfiguredException(
                    "Configure BRAVUS_CPF_API_URL e BRAVUS_CPF_API_TOKEN com um provedor oficial/contratado.");
        }
        String url = cpfApiUrl.contains("{document}")
                ? cpfApiUrl.replace("{document}", cpf)
                : (cpfApiUrl.endsWith("/") ? cpfApiUrl + cpf : cpfApiUrl + "/" + cpf);

        RestClient.RequestHeadersSpec<?> spec = restClient.get().uri(url);
        if (cpfApiToken != null && !cpfApiToken.isBlank()) {
            spec = spec.header(HttpHeaders.AUTHORIZATION, "Bearer " + cpfApiToken);
        }
        return spec.retrieve().body(JsonNode.class);
    }

    private String extractName(String type, JsonNode payload) {
        if (payload == null) return null;
        if ("CNPJ".equals(type)) {
            return text(payload, "razao_social", "nome_fantasia", "name");
        }
        return text(payload, "nome", "nomeCompleto", "name", "fullName");
    }

    private String extractRegistrationStatus(String type, JsonNode payload) {
        if (payload == null) return null;
        if ("CNPJ".equals(type)) {
            return text(payload, "descricao_situacao_cadastral", "situacao_cadastral", "status");
        }
        return text(payload, "situacao", "situacaoCadastral", "status");
    }

    private String text(JsonNode node, String... names) {
        for (String name : names) {
            JsonNode value = node.get(name);
            if (value != null && !value.isNull() && !value.asText().isBlank()) {
                return value.asText();
            }
        }
        return null;
    }

    private void applyRisk(String type, DocumentAnalysisEntity entity) {
        String status = entity.getRegistrationStatus();
        String normalized = status == null ? "" : status.toUpperCase();
        boolean active = normalized.contains("ATIVA")
                || normalized.contains("REGULAR")
                || normalized.equals("2");

        if (active) {
            entity.setRiskLevel("BAIXO");
            entity.setRiskScore("CNPJ".equals(type) ? 15 : 20);
        } else if (status == null || status.isBlank()) {
            entity.setRiskLevel("MEDIO");
            entity.setRiskScore(60);
        } else {
            entity.setRiskLevel("ALTO");
            entity.setRiskScore(90);
        }
    }

    private boolean usesInternalProvider(String type) {
        String mode = analysisMode == null ? "INTERNAL" : analysisMode.trim().toUpperCase();
        if (mode.isBlank() || "INTERNAL".equals(mode) || "SELF".equals(mode) || "BRAVUS_INTERNAL".equals(mode)) {
            return true;
        }
        if ("BRASILAPI".equals(mode)) {
            return !"CNPJ".equals(type);
        }
        return false;
    }

    private void applyInternalAnalysis(String type, DocumentAnalysisEntity entity) {
        int score = "CPF".equals(type) ? 20 : 25;
        if (entity.getSubjectName() == null || entity.getSubjectName().isBlank()) {
            score += 25;
        }

        entity.setProvider(PROVIDER_INTERNAL);
        entity.setStatus("ANALISADO_AUTOMATICAMENTE");
        entity.setRegistrationStatus("FORMATO_VALIDO_VERIFICACAO_INTERNA");
        entity.setRiskScore(score);
        entity.setRiskLevel(score <= 30 ? "BAIXO" : "MEDIO");
        entity.setRawResponse("{\"provider\":\"BRAVUS_INTERNAL\",\"mode\":\"SELF_PROVIDER\",\"formatValid\":true}");
    }

    private boolean isBlockingRisk(DocumentAnalysisEntity analysis) {
        if (analysis == null) return true;
        String risk = analysis.getRiskLevel();
        return "ALTO".equals(risk) || "BLOQUEADO".equals(risk);
    }

    public static class AnalysisCommand {
        public String type;
        public String document;
        public String subjectName;
        public Long userId;
    }

    private static class ProviderNotConfiguredException extends RuntimeException {
        ProviderNotConfiguredException(String message) { super(message); }
    }
}
