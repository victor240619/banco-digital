package com.bravus.bank.ledger.controller;

import com.bravus.bank.db.entity.UserEntity;
import com.bravus.bank.db.repo.UserRepository;
import com.bravus.bank.ledger.service.InternalTransferService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

/**
 * Transferência escritural entre clientes Bravus.
 *
 *   POST /api/internal-transfers
 *     { destinationAccountNumber, amountCentavos, description }
 *
 * Usa o saldo escritural do remetente (concedido via admin).
 */
@RestController
@RequestMapping("/api/internal-transfers")
public class InternalTransferController {

    private final InternalTransferService transferService;
    private final UserRepository userRepo;

    public InternalTransferController(InternalTransferService transferService, UserRepository userRepo) {
        this.transferService = transferService;
        this.userRepo = userRepo;
    }

    @PostMapping
    public ResponseEntity<InternalTransferService.TransferResult> transfer(
            @Valid @RequestBody Request req, Authentication auth) {

        UserEntity from = userRepo.findByUsername(auth.getName())
                .orElseThrow(() -> new IllegalStateException("Usuário autenticado não encontrado"));

        UserEntity to = userRepo.findByCurrentOrLegacyAccountNumber(req.destinationAccountNumber)
                .orElseThrow(() -> new IllegalArgumentException(
                        "Conta destinatária não encontrada: " + req.destinationAccountNumber));

        InternalTransferService.TransferResult r = transferService.transfer(
                from.getId(), to.getId(), req.amountCentavos, req.description);
        return ResponseEntity.ok(r);
    }

    public static class Request {
        @NotBlank public String destinationAccountNumber;
        @NotNull @Positive public Long amountCentavos;
        public String description;
    }
}
