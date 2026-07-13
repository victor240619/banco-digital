package com.bravus.bank.external;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin/ledger/external-transfers")
@PreAuthorize("hasRole('ADMIN')")
public class ExternalTransferController {
    private final ExternalTransferService transferService;

    public ExternalTransferController(ExternalTransferService transferService) {
        this.transferService = transferService;
    }

    @PostMapping
    public ResponseEntity<ExternalTransferEntity> submit(@Valid @RequestBody ExternalTransferRequest request,
                                                         Authentication auth) {
        ExternalTransferService.ExternalTransferCommand cmd =
                new ExternalTransferService.ExternalTransferCommand();
        cmd.userId = request.userId();
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
        cmd.description = request.description();
        return ResponseEntity.ok(transferService.submit(cmd, auth.getName()));
    }

    @GetMapping
    public ResponseEntity<List<ExternalTransferEntity>> recent(
            @RequestParam(defaultValue = "20") int limit) {
        return ResponseEntity.ok(transferService.recent(limit));
    }

    public record ExternalTransferRequest(
            @NotNull Long userId,
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
            String description
    ) {}
}
