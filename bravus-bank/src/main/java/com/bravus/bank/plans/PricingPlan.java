package com.bravus.bank.plans;

public enum PricingPlan {
    BASIC_9990("basic", 9990L, "Plano Básico BRL 99,90"),
    STANDARD_13400("standard", 13400L, "Plano Padrão BRL 134,00"),
    PREMIUM_48900("premium", 48900L, "Plano Premium BRL 489,00");

    private final String code;
    private final long amountInCents;
    private final String description;

    PricingPlan(String code, long amountInCents, String description) {
        this.code = code;
        this.amountInCents = amountInCents;
        this.description = description;
    }

    public String getCode() {
        return code;
    }

    public long getAmountInCents() {
        return amountInCents;
    }

    public String getDescription() {
        return description;
    }
}
