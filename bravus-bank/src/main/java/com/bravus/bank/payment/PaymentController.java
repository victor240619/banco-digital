package com.bravus.bank.payment;

import com.bravus.bank.config.BankProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.stripe.exception.StripeException;
import com.stripe.model.PaymentIntent;
import com.stripe.param.PaymentIntentCreateParams;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/payments")
public class PaymentController {

    private final BankProperties properties;

    public PaymentController(BankProperties properties) {
        this.properties = properties;
    }

    public record CreatePaymentRequest(
            @NotBlank String customerId,
            @NotNull @Min(1) Long amountInCents,
            String description,
            String destinationAccountId
    ) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record CreatePaymentResponse(String paymentIntentId, String clientSecret, Long grossAmount, Long applicationFeeAmount) {}

    @PostMapping
    public ResponseEntity<?> create(@RequestBody @Valid CreatePaymentRequest request) throws StripeException {
        long gross = request.amountInCents();
        long fee = Math.round(gross * (properties.getFeePercent() / 100.0));

        PaymentIntentCreateParams.Builder builder = PaymentIntentCreateParams.builder()
                .setAmount(gross)
                .setCurrency(properties.getDefaultCurrency())
                .setCustomer(request.customerId())
                .setDescription(request.description())
                .putMetadata("fee_percent", String.valueOf(properties.getFeePercent()))
                .putMetadata("fee_amount", String.valueOf(fee));

        if (Boolean.TRUE.equals(properties.getConnect()) && request.destinationAccountId() != null && !request.destinationAccountId().isBlank()) {
            builder
                .setApplicationFeeAmount(fee)
                .setTransferData(
                        PaymentIntentCreateParams.TransferData.builder()
                                .setDestination(request.destinationAccountId())
                                .build()
                );
        }

        PaymentIntentCreateParams params = builder.build();

        PaymentIntent intent = PaymentIntent.create(params);

        return ResponseEntity.ok(new CreatePaymentResponse(
                intent.getId(), intent.getClientSecret(), gross, fee
        ));
    }
}
