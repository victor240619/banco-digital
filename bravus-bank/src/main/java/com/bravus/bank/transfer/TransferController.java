package com.bravus.bank.transfer;

import com.bravus.bank.config.BankProperties;
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

    public TransferController(BankProperties properties) {
        this.properties = properties;
    }

    public record CreateTransferRequest(
            @NotBlank String destinationAccountId,
            @NotNull @Min(1) Long amountInCents,
            String description
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

        return ResponseEntity.ok(new CreateTransferResponse(
                transfer.getId(), gross, fee, net
        ));
    }
}
