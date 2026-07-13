package com.bravus.bank.external;

public interface BankingTransferProvider {
    boolean isConfigured();
    String providerName();
    ProviderTransferResult submit(ProviderTransferCommand command);

    class ProviderTransferCommand {
        public String idempotencyKey;
        public String channel;
        public Long amountCentavos;
        public String currency;
        public String beneficiaryName;
        public String beneficiaryDocument;
        public String bankCode;
        public String ispb;
        public String agency;
        public String accountNumber;
        public String accountDigit;
        public String accountType;
        public String pixKey;
        public String pixKeyType;
        public String description;
    }

    class ProviderTransferResult {
        public String providerTransferId;
        public String status;
        public String rawResponse;
    }
}
