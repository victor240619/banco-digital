package com.bravus.bank.globalrail;

import com.bravus.bank.external.BankingTransferProvider;
import com.bravus.bank.external.ExternalTransferEntity;
import com.bravus.bank.external.ExternalTransferRepository;
import com.bravus.bank.external.ExternalTransferService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Service
public class GlobalRailService {
    public static final String RECEIPT_BRAVUS_OUT = "COMPROVANTE_SAIDA_BRAVUS";
    public static final String RECEIPT_DESTINATION_CONFIRMED = "COMPROVANTE_LIQUIDACAO_CONFIRMADA";

    private final GlobalRailParticipantRepository participantRepo;
    private final ExternalTransferRepository transferRepo;

    public GlobalRailService(GlobalRailParticipantRepository participantRepo,
                             ExternalTransferRepository transferRepo) {
        this.participantRepo = participantRepo;
        this.transferRepo = transferRepo;
    }

    @Transactional(readOnly = true)
    public List<GlobalRailParticipantEntity> participants() {
        return participantRepo.findAllByOrderByCreatedAtDesc();
    }

    @Transactional
    public GlobalRailParticipantEntity createOrUpdateParticipant(ParticipantCommand cmd) {
        String code = upperOrDefault(cmd.participantCode, "");
        if (blank(code)) throw new IllegalArgumentException("Codigo do participante e obrigatorio.");
        if (blank(cmd.legalName)) throw new IllegalArgumentException("Nome legal do participante e obrigatorio.");

        GlobalRailParticipantEntity participant = participantRepo.findByParticipantCode(code)
                .orElseGet(GlobalRailParticipantEntity::new);
        String network = upperOrDefault(cmd.network, "GLOBAL");
        String connectionMode = upperOrDefault(cmd.connectionMode, "MANUAL_CONFIRMATION");
        String endpointUrl = clean(cmd.endpointUrl);
        String status = upperOrDefault(cmd.status, "DRAFT");

        if ("SELF_LEDGER".equals(connectionMode) && !isBravusOwned(code, cmd.bankCode, network)) {
            throw new IllegalArgumentException("SELF_LEDGER so pode ser usado em participante controlado pelo Bravus.");
        }
        if ("ACTIVE".equals(status) && "HTTP_CONNECTOR".equals(connectionMode) && blank(endpointUrl)) {
            throw new IllegalArgumentException("Conector HTTP ativo exige endpoint_url.");
        }

        participant.setParticipantCode(code);
        participant.setLegalName(cmd.legalName.trim());
        participant.setCountry(upperOrDefault(cmd.country, "KY"));
        participant.setNetwork(network);
        participant.setBankCode(clean(cmd.bankCode));
        participant.setIspb(clean(cmd.ispb));
        participant.setSwiftBic(upper(clean(cmd.swiftBic)));
        participant.setRoutingCode(clean(cmd.routingCode));
        participant.setEndpointUrl(endpointUrl);
        participant.setAuthMode(upperOrDefault(cmd.authMode, "NONE"));
        participant.setConnectionMode(connectionMode);
        participant.setSettlementAccount(clean(cmd.settlementAccount));
        participant.setSupportsInstant(Boolean.TRUE.equals(cmd.supportsInstant));
        participant.setStatus(status);
        return participantRepo.save(participant);
    }

    @Transactional(readOnly = true)
    public SettlementDecision settlementFor(ExternalTransferService.ExternalTransferCommand cmd,
                                            String channel,
                                            boolean providerConfigured,
                                            BankingTransferProvider.ProviderTransferResult providerResult,
                                            String idempotencyKey) {
        String destinationNetwork = inferNetwork(cmd.destinationNetwork, channel);
        SettlementDecision decision = new SettlementDecision();
        decision.destinationNetwork = destinationNetwork;
        decision.receiptKind = RECEIPT_BRAVUS_OUT;

        if (!providerConfigured || providerResult == null || !"COMPLETED".equals(providerResult.status)) {
            decision.settlementStatus = "AGUARDANDO_PROVEDOR_BRAVUS";
            decision.settlementMessage = "Ordem registrada. Saida ainda nao foi concluida pelo provedor Bravus.";
            return decision;
        }

        GlobalRailParticipantEntity participant = resolveParticipant(cmd, destinationNetwork);
        if (participant == null) {
            decision.settlementStatus = "DEBITADA_NO_BRAVUS_AGUARDANDO_CONEXAO_DESTINO";
            decision.settlementMessage = "Saida concluida no ledger Bravus. Destino aguarda participante/conector ativo para confirmar liquidacao.";
            return decision;
        }

        decision.destinationParticipantCode = participant.getParticipantCode();
        if (!"ACTIVE".equals(participant.getStatus())) {
            decision.settlementStatus = "DEBITADA_NO_BRAVUS_PARTICIPANTE_INATIVO";
            decision.settlementMessage = "Saida concluida no ledger Bravus. Participante destino nao esta ativo.";
            return decision;
        }

        String mode = upperOrDefault(participant.getConnectionMode(), "MANUAL_CONFIRMATION");
        if ("SELF_LEDGER".equals(mode)) {
            decision.settlementStatus = "LIQUIDADA_CONFIRMADA";
            decision.receiptKind = RECEIPT_DESTINATION_CONFIRMED;
            decision.destinationConfirmationId = "global-self-" + idempotencyKey;
            decision.destinationConfirmedAt = OffsetDateTime.now();
            decision.settlementMessage = "Liquidacao confirmada em participante controlado pelo Bravus.";
            return decision;
        }
        if ("HTTP_CONNECTOR".equals(mode) || "FILE_EXPORT".equals(mode)) {
            decision.settlementStatus = "ENVIADA_A_CONECTOR";
            decision.settlementMessage = "Saida concluida no ledger Bravus e enviada ao conector. Aguardando confirmacao do destino.";
            return decision;
        }

        decision.settlementStatus = "AGUARDANDO_CONFIRMACAO_MANUAL";
        decision.settlementMessage = "Saida concluida no ledger Bravus. Aguardando comprovacao/confirmacao do participante destino.";
        return decision;
    }

    @Transactional
    public ExternalTransferEntity confirmTransfer(Long orderId, ConfirmCommand cmd) {
        ExternalTransferEntity order = transferRepo.findById(orderId)
                .orElseThrow(() -> new IllegalArgumentException("Transferencia nao encontrada."));
        if (!"COMPLETED".equals(order.getStatus())) {
            throw new IllegalStateException("A transferencia precisa estar COMPLETED no Bravus antes de confirmar liquidacao externa.");
        }

        String confirmationId = clean(cmd.confirmationId);
        if (blank(confirmationId)) confirmationId = "global-confirm-" + UUID.randomUUID();
        order.setSettlementStatus("LIQUIDADA_CONFIRMADA");
        order.setReceiptKind(RECEIPT_DESTINATION_CONFIRMED);
        order.setDestinationConfirmationId(confirmationId);
        order.setDestinationConfirmedAt(OffsetDateTime.now());
        order.setDestinationNetwork(upperOrDefault(cmd.destinationNetwork, order.getDestinationNetwork()));
        order.setDestinationParticipantCode(upperOrDefault(cmd.participantCode, order.getDestinationParticipantCode()));
        order.setSettlementMessage(blank(cmd.message)
                ? "Liquidacao externa confirmada por participante/conector."
                : cmd.message.trim());
        return transferRepo.save(order);
    }

    private GlobalRailParticipantEntity resolveParticipant(ExternalTransferService.ExternalTransferCommand cmd,
                                                           String destinationNetwork) {
        String participantCode = upper(clean(cmd.participantCode));
        if (!blank(participantCode)) {
            return participantRepo.findByParticipantCode(participantCode).orElse(null);
        }
        String network = upperOrDefault(destinationNetwork, "GLOBAL");
        if (!blank(cmd.bankCode)) {
            GlobalRailParticipantEntity byBank = participantRepo
                    .findFirstByNetworkAndBankCodeOrderByUpdatedAtDesc(network, cmd.bankCode.trim())
                    .orElse(null);
            if (byBank != null) return byBank;
        }
        if (!blank(cmd.ispb)) {
            return participantRepo
                    .findFirstByNetworkAndIspbOrderByUpdatedAtDesc(network, cmd.ispb.trim())
                    .orElse(null);
        }
        return null;
    }

    private String inferNetwork(String explicitNetwork, String channel) {
        if (!blank(explicitNetwork)) return upper(explicitNetwork);
        String c = upperOrDefault(channel, "GLOBAL");
        if ("PIX".equals(c)) return "PIX_BR";
        if ("TED".equals(c)) return "TED_BR";
        if ("CAYMAN_RAIL".equals(c)) return "CAYMAN_RAIL";
        return c;
    }

    private boolean isBravusOwned(String participantCode, String bankCode, String network) {
        String code = upperOrDefault(participantCode, "");
        String bank = clean(bankCode);
        String net = upperOrDefault(network, "");
        return code.startsWith("BRAVUS") || "999".equals(bank) || "INTERNAL_BRAVUS".equals(net);
    }

    private String upperOrDefault(String value, String fallback) {
        return blank(value) ? fallback : value.trim().toUpperCase();
    }

    private String upper(String value) {
        return value == null ? null : value.trim().toUpperCase();
    }

    private String clean(String value) {
        return blank(value) ? null : value.trim();
    }

    private boolean blank(String value) {
        return value == null || value.isBlank();
    }

    public static class ParticipantCommand {
        public String participantCode;
        public String legalName;
        public String country;
        public String network;
        public String bankCode;
        public String ispb;
        public String swiftBic;
        public String routingCode;
        public String endpointUrl;
        public String authMode;
        public String connectionMode;
        public String settlementAccount;
        public Boolean supportsInstant;
        public String status;
    }

    public static class ConfirmCommand {
        public String confirmationId;
        public String destinationNetwork;
        public String participantCode;
        public String message;
    }

    public static class SettlementDecision {
        public String settlementStatus;
        public String receiptKind;
        public String destinationNetwork;
        public String destinationParticipantCode;
        public String destinationConfirmationId;
        public OffsetDateTime destinationConfirmedAt;
        public String settlementMessage;
    }
}
