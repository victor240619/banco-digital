package com.bravus.bank.identity;

import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;

class InstitutionRoutingProfileTest {

    @Test
    void exposesInternalRoutingWithoutClaimingSwiftRegistration() {
        Map<String, Object> profile = InstitutionRoutingProfile.publicView();

        assertEquals("BRAV-KY-INTERNAL", profile.get("internalRoutingCode"));
        assertEquals("BRAVKYK0XXX", profile.get("swiftBic"));
        assertEquals("INTERNAL_TEST_ONLY_UNREGISTERED", profile.get("swiftBicStatus"));
        assertFalse((Boolean) profile.get("swiftBicRegistered"));
        assertFalse((Boolean) profile.get("swiftConnected"));
        assertFalse((Boolean) profile.get("swiftExternalRoutingEnabled"));
    }

    @Test
    void acceptsOnlyExternalBicsWithMatchingCountry() {
        assertEquals(
                "CNATKYKYXXX",
                InstitutionRoutingProfile.validateExternalBic("cnatkykyxxx", "KY", false)
        );

        assertThrows(IllegalArgumentException.class,
                () -> InstitutionRoutingProfile.validateExternalBic("CNATKYKYXXX", "US", false));
        assertThrows(IllegalArgumentException.class,
                () -> InstitutionRoutingProfile.validateExternalBic("INVALID", "KY", false));
    }

    @Test
    void rejectsSelfDeclaredBicForBravus() {
        assertThrows(IllegalArgumentException.class,
                () -> InstitutionRoutingProfile.validateExternalBic("BRAVKYKYXXX", "KY", true));
    }
}
