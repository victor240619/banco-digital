package com.bravus.bank.external;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.LinkedHashMap;
import java.util.Map;

@Service
public class ConfiguredHttpBankingTransferProvider implements BankingTransferProvider {
    private final RestClient restClient = RestClient.create();
    private final ObjectMapper mapper;

    @Value("${BRAVUS_BANKING_PROVIDER_URL:}")
    private String providerUrl;

    @Value("${BRAVUS_BANKING_PROVIDER_TOKEN:}")
    private String providerToken;

    @Value("${BRAVUS_BANKING_PROVIDER_NAME:CONFIGURED_HTTP}")
    private String providerName;

    public ConfiguredHttpBankingTransferProvider(ObjectMapper mapper) {
        this.mapper = mapper;
    }

    @Override
    public boolean isConfigured() {
        return providerUrl != null && !providerUrl.isBlank();
    }

    @Override
    public String providerName() {
        return providerName;
    }

    @Override
    public ProviderTransferResult submit(ProviderTransferCommand command) {
        if (!isConfigured()) {
            throw new IllegalStateException(
                    "Configure BRAVUS_BANKING_PROVIDER_URL e BRAVUS_BANKING_PROVIDER_TOKEN para enviar dinheiro real.");
        }

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("idempotencyKey", command.idempotencyKey);
        body.put("channel", command.channel);
        body.put("amountCentavos", command.amountCentavos);
        body.put("currency", command.currency);
        body.put("description", command.description);
        body.put("beneficiary", Map.of(
                "name", safe(command.beneficiaryName),
                "document", safe(command.beneficiaryDocument),
                "bankCode", safe(command.bankCode),
                "ispb", safe(command.ispb),
                "agency", safe(command.agency),
                "accountNumber", safe(command.accountNumber),
                "accountDigit", safe(command.accountDigit),
                "accountType", safe(command.accountType),
                "pixKey", safe(command.pixKey),
                "pixKeyType", safe(command.pixKeyType)
        ));

        RestClient.RequestBodySpec spec = restClient.post()
                .uri(providerUrl)
                .header("Idempotency-Key", command.idempotencyKey);
        if (providerToken != null && !providerToken.isBlank()) {
            spec = spec.header(HttpHeaders.AUTHORIZATION, "Bearer " + providerToken);
        }

        JsonNode response = spec.body(body).retrieve().body(JsonNode.class);
        ProviderTransferResult result = new ProviderTransferResult();
        result.providerTransferId = text(response, "id", "transferId", "endToEndId", "providerTransferId");
        result.status = normalizeStatus(text(response, "status", "state"));
        try {
            result.rawResponse = mapper.writeValueAsString(response);
        } catch (Exception e) {
            result.rawResponse = String.valueOf(response);
        }
        return result;
    }

    private String safe(String value) {
        return value == null ? "" : value;
    }

    private String text(JsonNode node, String... names) {
        if (node == null) return null;
        for (String name : names) {
            JsonNode value = node.get(name);
            if (value != null && !value.isNull() && !value.asText().isBlank()) {
                return value.asText();
            }
        }
        return null;
    }

    private String normalizeStatus(String status) {
        if (status == null || status.isBlank()) return "PROCESSING";
        String s = status.toUpperCase();
        if (s.contains("FAIL") || s.contains("ERROR") || s.contains("REJECT")) return "FAILED";
        if (s.contains("COMPLETE") || s.contains("CONFIRM") || s.contains("SUCCESS") || s.contains("SETTLED")) {
            return "COMPLETED";
        }
        return "PROCESSING";
    }
}
