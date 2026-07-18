package com.bravus.bank.external;

import com.bravus.bank.rail.CaymanRailConfigEntity;
import com.bravus.bank.rail.CaymanRailConfigRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class CaymanTransferRailPolicyTest {
    private CaymanRailConfigRepository configRepository;
    private CaymanTransferRailPolicy policy;

    @BeforeEach
    void setUp() {
        configRepository = mock(CaymanRailConfigRepository.class);
        policy = new CaymanTransferRailPolicy(configRepository);
    }

    @Test
    void rejectsDiscontinuedBrazilianRails() {
        IllegalArgumentException pix = assertThrows(
                IllegalArgumentException.class,
                () -> policy.requireSupported("PIX"));
        IllegalArgumentException ted = assertThrows(
                IllegalArgumentException.class,
                () -> policy.requireSupported("TED"));

        assertEquals(CaymanTransferRailPolicy.UNSUPPORTED_RAIL_MESSAGE, pix.getMessage());
        assertEquals(CaymanTransferRailPolicy.UNSUPPORTED_RAIL_MESSAGE, ted.getMessage());
    }

    @Test
    void mapsCaymanAndInternationalNetworks() {
        assertEquals("ACH", policy.requireSupported("ach"));
        assertEquals("CAYMAN_ACH", policy.destinationNetwork("ACH"));
        assertEquals("CAYMAN_EFT", policy.destinationNetwork("EFT"));
        assertEquals("SWIFT", policy.destinationNetwork("WIRE"));
    }

    @Test
    void blocksMoneyServicesUntilCimaLicenseIsActive() {
        when(configRepository.findById(1L)).thenReturn(Optional.empty());

        IllegalStateException exception = assertThrows(
                IllegalStateException.class,
                () -> policy.requireSupported("MSB_REMITTANCE"));

        assertEquals(CaymanTransferRailPolicy.MSB_LICENSE_REQUIRED_MESSAGE, exception.getMessage());
    }

    @Test
    void allowsMoneyServicesOnlyWithCompleteLicensedConfiguration() {
        CaymanRailConfigEntity config = new CaymanRailConfigEntity();
        config.setRegulatoryStatus("LICENSED");
        config.setSettlementMode("LIVE_LICENSED");
        config.setProductionEnabled(true);
        config.setCimaLicenseNumber("CIMA-MSB-TEST");
        when(configRepository.findById(1L)).thenReturn(Optional.of(config));

        assertEquals("MSB_REMITTANCE", policy.requireSupported("MSB_REMITTANCE"));
        assertEquals("CAYMAN_MSB", policy.destinationNetwork("MSB_REMITTANCE"));
    }
}
