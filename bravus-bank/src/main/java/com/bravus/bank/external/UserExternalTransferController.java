package com.bravus.bank.external;

import com.bravus.bank.db.entity.UserEntity;
import com.bravus.bank.db.repo.UserRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/user/external-transfers")
public class UserExternalTransferController {
    private final ExternalTransferService transferService;
    private final UserRepository userRepository;

    public UserExternalTransferController(ExternalTransferService transferService,
                                          UserRepository userRepository) {
        this.transferService = transferService;
        this.userRepository = userRepository;
    }

    @PostMapping
    public ResponseEntity<ExternalTransferEntity> submit(@Valid @RequestBody UserExternalTransferRequest request,
                                                         Authentication auth) {
        UserEntity user = authenticatedUser(auth);
        ExternalTransferService.ExternalTransferCommand cmd =
                new ExternalTransferService.ExternalTransferCommand();
        cmd.userId = user.getId();
        cmd.amountCentavos = request.amountCentavos();
        cmd.channel = request.channel();
        cmd.beneficiaryName = request.beneficiaryName();
        cmd.beneficiaryDocument = request.beneficiaryDocument();
        cmd.bankCode = request.bankCode();
        cmd.ispb = request.ispb();
        cmd.agency = request.agency();
        cmd.accountNumber = request.accountNumber();
        cmd.accountDigit = request.accountDigit();
        cmd.accountType = request.accountType();
        cmd.pixKey = request.pixKey();
        cmd.pixKeyType = request.pixKeyType();
        cmd.destinationNetwork = request.destinationNetwork();
        cmd.participantCode = request.participantCode();
        cmd.description = request.description();
        return ResponseEntity.ok(transferService.submit(cmd, auth.getName()));
    }

    @GetMapping
    public ResponseEntity<List<ExternalTransferEntity>> recent(Authentication auth,
                                                               @RequestParam(defaultValue = "20") int limit) {
        UserEntity user = authenticatedUser(auth);
        return ResponseEntity.ok(transferService.recentForUser(user.getId(), limit));
    }

    @GetMapping("/{orderId}/receipt")
    public ResponseEntity<ExternalTransferReceiptResponse> receipt(@PathVariable Long orderId,
                                                                   Authentication auth) {
        UserEntity user = authenticatedUser(auth);
        ExternalTransferEntity order = transferService.findForUser(orderId, user.getId());
        return ResponseEntity.ok(toReceipt(order, user));
    }

    private UserEntity authenticatedUser(Authentication auth) {
        return userRepository.findByUsername(auth.getName())
                .orElseThrow(() -> new IllegalStateException("Usuario autenticado nao encontrado."));
    }

    private ExternalTransferReceiptResponse toReceipt(ExternalTransferEntity order, UserEntity user) {
        UserEntity payer = order.getUser() != null ? order.getUser() : user;
        return new ExternalTransferReceiptResponse(
                "BRAVUS-" + order.getIdempotencyKey(),
                order.getId(),
                order.getTransactionId(),
                order.getProvider(),
                order.getProviderTransferId(),
                order.getIdempotencyKey(),
                order.getStatus(),
                order.getSettlementStatus(),
                order.getReceiptKind(),
                order.getDestinationNetwork(),
                order.getDestinationParticipantCode(),
                order.getDestinationConfirmationId(),
                order.getDestinationConfirmedAt() == null ? null : order.getDestinationConfirmedAt().toString(),
                order.getSettlementMessage(),
                order.getCreatedAt() == null ? null : order.getCreatedAt().toString(),
                order.getAmountCentavos(),
                order.getCurrency(),
                order.getChannel(),
                order.getDescription(),
                new ReceiptParty(
                        payer.getFullName(),
                        payer.getCpf(),
                        payer.getNomeBanco(),
                        payer.getCodigoBanco(),
                        payer.getIspb(),
                        payer.getAgencia(),
                        payer.getAccountNumber(),
                        null,
                        payer.getAccountType(),
                        payer.getChavePix(),
                        payer.getTipoChavePix()
                ),
                new ReceiptParty(
                        order.getBeneficiaryName(),
                        order.getBeneficiaryDocument(),
                        null,
                        order.getBankCode(),
                        order.getIspb(),
                        order.getAgency(),
                        order.getAccountNumber(),
                        order.getAccountDigit(),
                        order.getAccountType(),
                        order.getPixKey(),
                        order.getPixKeyType()
                )
        );
    }

    public record UserExternalTransferRequest(
            @NotNull @Positive Long amountCentavos,
            @NotBlank String channel,
            @NotBlank String beneficiaryName,
            @NotBlank String beneficiaryDocument,
            String bankCode,
            String ispb,
            String agency,
            String accountNumber,
            String accountDigit,
            String accountType,
            String pixKey,
            String pixKeyType,
            String destinationNetwork,
            String participantCode,
            String description
    ) {}

    public record ReceiptParty(
            String name,
            String document,
            String bankName,
            String bankCode,
            String ispb,
            String agency,
            String accountNumber,
            String accountDigit,
            String accountType,
            String pixKey,
            String pixKeyType
    ) {}

    public record ExternalTransferReceiptResponse(
            String receiptId,
            Long orderId,
            Long transactionId,
            String provider,
            String providerTransferId,
            String idempotencyKey,
            String status,
            String settlementStatus,
            String receiptKind,
            String destinationNetwork,
            String destinationParticipantCode,
            String destinationConfirmationId,
            String destinationConfirmedAt,
            String settlementMessage,
            String createdAt,
            Long amountCentavos,
            String currency,
            String channel,
            String description,
            ReceiptParty payer,
            ReceiptParty beneficiary
    ) {}
}
