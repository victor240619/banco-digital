package com.bravus.bank.external;

import com.bravus.bank.rail.CaymanRailConfigEntity;
import com.bravus.bank.rail.CaymanRailConfigRepository;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Locale;
import java.util.Set;

@Component
public class CaymanTransferRailPolicy {
    public static final String UNSUPPORTED_RAIL_MESSAGE =
            "Canal de transfer\u00eancia indispon\u00edvel. Use ACH/EFT para Cayman, Wire/SWIFT para transfer\u00eancias "
                    + "internacionais ou o fluxo licenciado de remessa e c\u00e2mbio.";
    public static final String MSB_LICENSE_REQUIRED_MESSAGE =
            "Remessas e c\u00e2mbio est\u00e3o indispon\u00edveis at\u00e9 a ativa\u00e7\u00e3o da licen\u00e7a de Money Services "
                    + "Business pela CIMA. Nenhum valor foi debitado.";

    private static final Set<String> SUPPORTED_CHANNELS = Set.of(
            "ACH", "EFT", "SWIFT", "WIRE", "MSB_REMITTANCE", "MSB_FX", "CAYMAN_RAIL");
    private static final Set<String> MSB_CHANNELS = Set.of("MSB_REMITTANCE", "MSB_FX");
    private final CaymanRailConfigRepository configRepository;

    public CaymanTransferRailPolicy(CaymanRailConfigRepository configRepository) {
        this.configRepository = configRepository;
    }

    public String requireSupported(String rawChannel) {
        String channel = rawChannel == null ? "" : rawChannel.trim().toUpperCase(Locale.ROOT);
        if (!SUPPORTED_CHANNELS.contains(channel)) {
            throw new IllegalArgumentException(UNSUPPORTED_RAIL_MESSAGE);
        }
        if (MSB_CHANNELS.contains(channel) && !isLicensedMsbEnabled()) {
            throw new IllegalStateException(MSB_LICENSE_REQUIRED_MESSAGE);
        }
        return channel;
    }

    public String destinationNetwork(String channel) {
        return switch (channel) {
            case "ACH" -> "CAYMAN_ACH";
            case "EFT" -> "CAYMAN_EFT";
            case "SWIFT", "WIRE" -> "SWIFT";
            case "MSB_REMITTANCE", "MSB_FX" -> "CAYMAN_MSB";
            default -> "CAYMAN_RAIL";
        };
    }

    public List<String> supportedChannels() {
        return SUPPORTED_CHANNELS.stream().sorted().toList();
    }

    private boolean isLicensedMsbEnabled() {
        CaymanRailConfigEntity config = configRepository.findById(1L).orElse(null);
        return config != null
                && "LICENSED".equals(config.getRegulatoryStatus())
                && "LIVE_LICENSED".equals(config.getSettlementMode())
                && Boolean.TRUE.equals(config.getProductionEnabled())
                && config.getCimaLicenseNumber() != null
                && !config.getCimaLicenseNumber().isBlank();
    }
}
