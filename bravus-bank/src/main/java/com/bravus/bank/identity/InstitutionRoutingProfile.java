package com.bravus.bank.identity;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * Public routing identity for Bravus. The internal code is not a SWIFT-issued BIC.
 */
public final class InstitutionRoutingProfile {
    public static final String INSTITUTION_NAME = "Bravus Premium Bank";
    public static final String COUNTRY_CODE = "KY";
    public static final String CURRENCY = "KYD";
    public static final String INTERNAL_ROUTING_CODE = "BRAV-KY-INTERNAL";
    public static final String INTERNAL_SWIFT_BIC = "BRAVKYK0XXX";
    public static final String SWIFT_BIC_STATUS = "INTERNAL_TEST_ONLY_UNREGISTERED";

    private static final Pattern BIC_PATTERN = Pattern.compile(
            "^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}(?:[A-Z0-9]{3})?$"
    );

    private InstitutionRoutingProfile() {
    }

    public static Map<String, Object> publicView() {
        Map<String, Object> profile = new LinkedHashMap<>();
        profile.put("institutionName", INSTITUTION_NAME);
        profile.put("countryCode", COUNTRY_CODE);
        profile.put("currency", CURRENCY);
        profile.put("internalRoutingCode", INTERNAL_ROUTING_CODE);
        profile.put("swiftBic", INTERNAL_SWIFT_BIC);
        profile.put("swiftBicStatus", SWIFT_BIC_STATUS);
        profile.put("swiftBicRegistered", false);
        profile.put("swiftConnected", false);
        profile.put("swiftExternalRoutingEnabled", false);
        return profile;
    }

    public static String validateExternalBic(String value, String participantCountry, boolean bravusOwned) {
        if (value == null || value.isBlank()) return null;

        String bic = value.trim().toUpperCase();
        if (bravusOwned) {
            throw new IllegalArgumentException(
                    "O BIC " + INTERNAL_SWIFT_BIC + " e interno e nao registrado. Use o roteamento interno "
                            + INTERNAL_ROUTING_CODE + " ate a emissao oficial pela SWIFT."
            );
        }
        if (!BIC_PATTERN.matcher(bic).matches()) {
            throw new IllegalArgumentException("BIC externo invalido. Informe 8 ou 11 caracteres no formato ISO 9362.");
        }

        String country = participantCountry == null ? "" : participantCountry.trim().toUpperCase();
        if (country.length() == 2 && !bic.substring(4, 6).equals(country)) {
            throw new IllegalArgumentException("O pais do BIC externo deve corresponder ao pais do participante.");
        }
        return bic;
    }
}
