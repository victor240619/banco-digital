package com.bravus.bank.external;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.web.client.RestClient;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.Map;

@Service
public class ConfiguredHttpBankingTransferProvider implements BankingTransferProvider {
    private static final MediaType JSON_PATCH = MediaType.valueOf("application/json-patch+json");

    private final RestClient restClient = RestClient.create();
    private final ObjectMapper mapper;

    @Value("${BRAVUS_BANKING_PROVIDER_URL:}")
    private String providerUrl;

    @Value("${BRAVUS_BANKING_PROVIDER_TOKEN:}")
    private String providerToken;

    @Value("${BRAVUS_BANKING_PROVIDER_MODE:SELF}")
    private String providerMode;

    @Value("${BRAVUS_BANKING_PROVIDER_NAME:CONFIGURED_HTTP}")
    private String providerName;

    @Value("${CELCOIN_AUTH_URL:https://sandbox.openfinance.celcoin.dev}")
    private String celcoinAuthUrl;

    @Value("${CELCOIN_BASE_URL:https://sandbox.openfinance.celcoin.dev}")
    private String celcoinBaseUrl;

    @Value("${CELCOIN_DICT_PATH:/pix/v1/dict/v2/key}")
    private String celcoinDictPath;

    @Value("${CELCOIN_PIX_PAYMENT_PATH:/baas/v2/pix/payment}")
    private String celcoinPixPaymentPath;

    @Value("${CELCOIN_CLIENT_ID:}")
    private String celcoinClientId;

    @Value("${CELCOIN_CLIENT_SECRET:}")
    private String celcoinClientSecret;

    @Value("${CELCOIN_DEBIT_ACCOUNT:}")
    private String celcoinDebitAccount;

    @Value("${CELCOIN_DEBIT_BRANCH:}")
    private String celcoinDebitBranch;

    @Value("${CELCOIN_DEBIT_TAX_ID:}")
    private String celcoinDebitTaxId;

    @Value("${CELCOIN_DEBIT_ACCOUNT_TYPE:CACC}")
    private String celcoinDebitAccountType;

    @Value("${CELCOIN_DEBIT_NAME:Bravus Bank}")
    private String celcoinDebitName;

    @Value("${CELCOIN_PAYER_ID:}")
    private String celcoinPayerId;

    public ConfiguredHttpBankingTransferProvider(ObjectMapper mapper) {
        this.mapper = mapper;
    }

    @Override
    public boolean isConfigured() {
        return selfProviderMode()
                || celcoinReady()
                || (providerUrl != null && !providerUrl.isBlank());
    }

    @Override
    public String providerName() {
        if (selfProviderMode()) return "BRAVUS_SELF_PROVIDER";
        if (celcoinProviderMode()) return "CELCOIN_PIX_CASHOUT";
        return providerName;
    }

    @Override
    public ProviderTransferResult submit(ProviderTransferCommand command) {
        if (selfProviderMode()) {
            return acceptOnBravusRail(command);
        }
        if (celcoinProviderMode()) {
            return submitCelcoinPix(command);
        }
        if (!isConfigured()) {
            throw new IllegalStateException(
                    "Configure BRAVUS_BANKING_PROVIDER_URL e BRAVUS_BANKING_PROVIDER_TOKEN para enviar dinheiro real.");
        }
        return submitConfiguredHttp(command);
    }

    private ProviderTransferResult submitConfiguredHttp(ProviderTransferCommand command) {
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
        return resultFromResponse(response, "id", "transferId", "endToEndId", "providerTransferId");
    }

    private ProviderTransferResult submitCelcoinPix(ProviderTransferCommand command) {
        if (!"PIX".equalsIgnoreCase(safe(command.channel))) {
            throw new IllegalArgumentException("O provedor Celcoin configurado neste modulo aceita somente PIX Cash-out.");
        }
        if (!celcoinReady()) {
            throw new IllegalStateException(
                    "Configure CELCOIN_CLIENT_ID, CELCOIN_CLIENT_SECRET, CELCOIN_DEBIT_ACCOUNT, "
                            + "CELCOIN_DEBIT_BRANCH e CELCOIN_DEBIT_TAX_ID.");
        }

        String token = fetchCelcoinAccessToken();
        JsonNode dict = null;
        if (!blank(command.pixKey)) {
            dict = lookupCelcoinDict(command, token);
        }

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("amount", BigDecimal.valueOf(command.amountCentavos, 2));
        body.put("clientCode", command.idempotencyKey);
        body.put("paymentType", "IMMEDIATE");
        body.put("urgency", "HIGH");
        body.put("transactionType", "TRANSFER");
        body.put("debitParty", celcoinDebitParty());

        Map<String, Object> creditParty = celcoinCreditParty(command, dict);
        body.put("creditParty", creditParty);

        if (dict != null) {
            String endToEndId = text(dict, "endtoendid", "endToEndId", "endToEndID");
            if (blank(endToEndId)) {
                throw new IllegalStateException("A consulta DICT da Celcoin nao retornou endToEndId.");
            }
            body.put("endToEndId", endToEndId);
            body.put("initiationType", "DICT");
        } else {
            body.put("initiationType", "MANUAL");
        }
        if (!blank(command.description)) {
            body.put("remittanceInformation", command.description);
        }

        JsonNode response = restClient.post()
                .uri(joinUrl(celcoinBaseUrl, celcoinPixPaymentPath))
                .contentType(JSON_PATCH)
                .accept(MediaType.APPLICATION_JSON)
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                .header("Idempotency-Key", command.idempotencyKey)
                .body(body)
                .retrieve()
                .body(JsonNode.class);

        ProviderTransferResult result = resultFromResponse(response, "transactionId", "id", "endToEndId");
        result.status = normalizeCelcoinStatus(text(response, "code", "status", "state"));
        return result;
    }

    private String fetchCelcoinAccessToken() {
        LinkedMultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("client_id", celcoinClientId);
        form.add("grant_type", "client_credentials");
        form.add("client_secret", celcoinClientSecret);

        JsonNode response = restClient.post()
                .uri(celcoinAuthUrl)
                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                .accept(MediaType.APPLICATION_JSON)
                .body(form)
                .retrieve()
                .body(JsonNode.class);

        String token = text(response, "access_token");
        if (blank(token)) {
            throw new IllegalStateException("A Celcoin nao retornou access_token.");
        }
        return token;
    }

    private JsonNode lookupCelcoinDict(ProviderTransferCommand command, String token) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("payerId", digits(firstNonBlank(celcoinPayerId, celcoinDebitTaxId)));
        body.put("key", command.pixKey);
        if (!blank(command.beneficiaryDocument)) {
            body.put("ownerTaxId", digits(command.beneficiaryDocument));
        }

        return restClient.post()
                .uri(joinUrl(celcoinBaseUrl, celcoinDictPath))
                .contentType(JSON_PATCH)
                .accept(MediaType.APPLICATION_JSON)
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                .header("includeStatistics", "false")
                .body(body)
                .retrieve()
                .body(JsonNode.class);
    }

    private Map<String, Object> celcoinDebitParty() {
        Map<String, Object> debitParty = new LinkedHashMap<>();
        debitParty.put("account", celcoinDebitAccount);
        debitParty.put("branch", numberOrString(celcoinDebitBranch));
        debitParty.put("taxId", digits(celcoinDebitTaxId));
        debitParty.put("accountType", celcoinDebitAccountType);
        debitParty.put("name", celcoinDebitName);
        return debitParty;
    }

    private Map<String, Object> celcoinCreditParty(ProviderTransferCommand command, JsonNode dict) {
        Map<String, Object> creditParty = new LinkedHashMap<>();
        if (!blank(command.pixKey)) {
            creditParty.put("key", command.pixKey);
        }

        JsonNode account = dict == null ? null : dict.path("account");
        JsonNode owner = dict == null ? null : dict.path("owner");

        putIfPresent(creditParty, "bank",
                firstNonBlank(text(account, "participant"), command.ispb, command.bankCode));
        putIfPresent(creditParty, "name",
                firstNonBlank(command.beneficiaryName, text(owner, "name")));
        putIfPresent(creditParty, "branch",
                numberOrString(firstNonBlank(command.agency, text(account, "branch"))));
        putIfPresent(creditParty, "account",
                firstNonBlank(command.accountNumber, text(account, "accountNumber", "account")));
        putIfPresent(creditParty, "accountType",
                celcoinAccountType(firstNonBlank(command.accountType, text(account, "accountType"))));
        putIfPresent(creditParty, "taxId",
                digits(firstNonBlank(command.beneficiaryDocument, text(owner, "taxIdNumber"))));

        if (!blank(command.pixKey) && blank((String) creditParty.get("bank"))) {
            throw new IllegalStateException("A consulta DICT da Celcoin nao retornou o ISPB/banco recebedor.");
        }
        if (blank(command.pixKey) && (blank(command.bankCode) || blank(command.agency) || blank(command.accountNumber))) {
            throw new IllegalArgumentException("Informe banco, agencia e conta para Pix manual via Celcoin.");
        }
        return creditParty;
    }

    private ProviderTransferResult acceptOnBravusRail(ProviderTransferCommand command) {
        ProviderTransferResult result = new ProviderTransferResult();
        result.providerTransferId = "bravus-self-" + command.idempotencyKey;
        result.status = "COMPLETED";
        result.rawResponse = "{\"provider\":\"BRAVUS_SELF_PROVIDER\",\"status\":\"COMPLETED\",\"settlement\":\"INTERNAL_LEDGER\"}";
        return result;
    }

    private boolean selfProviderMode() {
        String mode = providerMode == null ? "SELF" : providerMode.trim().toUpperCase();
        return mode.isBlank() || "SELF".equals(mode) || "BRAVUS_SELF".equals(mode)
                || "BRAVUS_SELF_PROVIDER".equals(mode);
    }

    private boolean celcoinProviderMode() {
        String mode = providerMode == null ? "" : providerMode.trim().toUpperCase();
        return "CELCOIN".equals(mode) || "CELCOIN_PIX".equals(mode) || "CELCOIN_PIX_CASHOUT".equals(mode);
    }

    private boolean celcoinReady() {
        return celcoinProviderMode()
                && !blank(celcoinClientId)
                && !blank(celcoinClientSecret)
                && !blank(celcoinDebitAccount)
                && !blank(celcoinDebitBranch)
                && !blank(celcoinDebitTaxId);
    }

    private ProviderTransferResult resultFromResponse(JsonNode response, String... idFields) {
        ProviderTransferResult result = new ProviderTransferResult();
        result.providerTransferId = text(response, idFields);
        result.status = normalizeStatus(text(response, "status", "state", "code"));
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

    private boolean blank(String value) {
        return value == null || value.isBlank();
    }

    private String text(JsonNode node, String... names) {
        if (node == null || node.isMissingNode() || node.isNull()) return null;
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

    private String normalizeCelcoinStatus(String status) {
        if (status == null || status.isBlank()) return "PROCESSING";
        String s = status.toUpperCase();
        if ("SUCCESS".equals(s) || "SUCCESSFUL_WITH_ERROR".equals(s)
                || "ALREADY_PAID".equals(s) || "ALREADY_PAYD_WITH_ERROR".equals(s)) {
            return "COMPLETED";
        }
        return normalizeStatus(status);
    }

    private String digits(String value) {
        return value == null ? "" : value.replaceAll("\\D", "");
    }

    private String firstNonBlank(String... values) {
        if (values == null) return "";
        for (String value : values) {
            if (!blank(value)) return value;
        }
        return "";
    }

    private String joinUrl(String base, String path) {
        String cleanBase = base == null ? "" : base.replaceAll("/+$", "");
        String cleanPath = path == null ? "" : path.replaceAll("^/+", "");
        return cleanBase + "/" + cleanPath;
    }

    private Object numberOrString(String value) {
        if (blank(value)) return "";
        String digits = digits(value);
        if (digits.equals(value) && digits.length() <= 9) {
            try {
                return Integer.parseInt(digits);
            } catch (NumberFormatException ignored) {
                return value;
            }
        }
        return value;
    }

    private String celcoinAccountType(String accountType) {
        if (blank(accountType)) return "";
        String normalized = accountType.trim().toUpperCase();
        return switch (normalized) {
            case "CORRENTE", "CHECKING", "CC" -> "CACC";
            case "POUPANCA", "POUPANÇA", "SAVINGS", "CP" -> "SVGS";
            case "SALARIO", "SALÁRIO", "SALARY" -> "SLRY";
            case "PAGAMENTO", "PAYMENT" -> "TRAN";
            default -> normalized;
        };
    }

    private void putIfPresent(Map<String, Object> target, String key, Object value) {
        if (value == null) return;
        if (value instanceof String stringValue && stringValue.isBlank()) return;
        target.put(key, value);
    }
}
