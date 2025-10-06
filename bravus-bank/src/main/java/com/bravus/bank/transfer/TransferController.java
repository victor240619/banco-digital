package com.bravus.bank.transfer;

import com.bravus.bank.config.BankProperties;
import com.bravus.bank.db.entity.TransferEntity;
import com.bravus.bank.db.entity.AccountEntity;
import com.bravus.bank.ledger.LedgerService;
import com.bravus.bank.db.repo.TransferRepository;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.stripe.exception.StripeException;
import com.stripe.model.Transfer;
import com.stripe.param.TransferCreateParams;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/transfers")
public class TransferController {

    private final BankProperties properties;
    private final TransferRepository transferRepository;
    private final LedgerService ledgerService;

    public TransferController(BankProperties properties, TransferRepository transferRepository, LedgerService ledgerService) {
        this.properties = properties;
        this.transferRepository = transferRepository;
        this.ledgerService = ledgerService;
    }

    public record CreateTransferRequest(
            @NotBlank String destinationAccountId,
            @NotNull @Min(1) Long amountInCents,
            String description,
            String fromStripeCustomerId
    ) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record CreateTransferResponse(String transferId, Long grossAmount, Long feeAmount, Long netAmount) {}

    @PostMapping
    public ResponseEntity<?> create(@RequestBody @Valid CreateTransferRequest request) throws StripeException {
        long gross = request.amountInCents();
        long fee = Math.round(gross * (properties.getFeePercent() / 100.0));
        long net = gross - fee;
        if (net <= 0) throw new IllegalArgumentException("Valor líquido inválido");

        TransferCreateParams params = TransferCreateParams.builder()
                .setAmount(net)
                .setCurrency(properties.getDefaultCurrency())
                .setDestination(request.destinationAccountId())
                .putMetadata("gross_amount", String.valueOf(gross))
                .putMetadata("fee_percent", String.valueOf(properties.getFeePercent()))
                .putMetadata("fee_amount", String.valueOf(fee))
                .putMetadata("description", request.description() == null ? "" : request.description())
                .build();

        Transfer transfer = Transfer.create(params);

        TransferEntity entity = new TransferEntity();
        entity.setStripeTransferId(transfer.getId());
        entity.setDestinationAccountId(request.destinationAccountId());
        entity.setGrossAmount(gross);
        entity.setFeeAmount(fee);
        entity.setNetAmount(net);
        entity.setCurrency(properties.getDefaultCurrency());
        entity.setDescription(request.description());
        transferRepository.save(entity);

        // ledger: debit from customer's account if provided
        if (request.fromStripeCustomerId() != null && !request.fromStripeCustomerId().isBlank()) {
            AccountEntity from = ledgerService.ensureAccountForStripeCustomer(request.fromStripeCustomerId(), properties.getDefaultCurrency());
            // debit gross (including fee). Fee retained by platform implicitly
            ledgerService.debit(from, gross, properties.getDefaultCurrency(), request.description(), "EXTERNAL_TRANSFER", transfer.getId());
        }

        return ResponseEntity.ok(new CreateTransferResponse(
                transfer.getId(), gross, fee, net
        ));
    }
}
