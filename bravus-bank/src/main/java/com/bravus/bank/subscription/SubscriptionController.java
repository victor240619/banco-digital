package com.bravus.bank.subscription;

import com.bravus.bank.config.BankProperties;
import com.bravus.bank.plans.PricingPlan;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.stripe.exception.StripeException;
import com.stripe.model.checkout.Session;
import com.stripe.param.checkout.SessionCreateParams;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Arrays;

@RestController
@RequestMapping("/api/subscriptions")
public class SubscriptionController {

    private final BankProperties properties;

    public SubscriptionController(BankProperties properties) {
        this.properties = properties;
    }

    public record CreateSubscriptionRequest(
            @NotBlank String customerId,
            @NotBlank String planCode
    ) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record CreateSubscriptionResponse(String checkoutSessionId, String url) {}

    @PostMapping
    public ResponseEntity<?> create(@RequestBody @Valid CreateSubscriptionRequest request) throws StripeException {
        PricingPlan plan = Arrays.stream(PricingPlan.values())
                .filter(p -> p.getCode().equals(request.planCode()))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Plano inválido"));

        SessionCreateParams.LineItem.PriceData.Recurring recurring =
                SessionCreateParams.LineItem.PriceData.Recurring.builder()
                        .setInterval(SessionCreateParams.LineItem.PriceData.Recurring.Interval.MONTH)
                        .build();

        SessionCreateParams.LineItem.PriceData priceData =
                SessionCreateParams.LineItem.PriceData.builder()
                        .setCurrency(properties.getDefaultCurrency())
                        .setUnitAmount(plan.getAmountInCents())
                        .setProductData(SessionCreateParams.LineItem.PriceData.ProductData.builder()
                                .setName("Bravus Bank - " + plan.getDescription())
                                .build())
                        .setRecurring(recurring)
                        .build();

        SessionCreateParams.LineItem lineItem = SessionCreateParams.LineItem.builder()
                .setQuantity(1L)
                .setPriceData(priceData)
                .build();

        SessionCreateParams params = SessionCreateParams.builder()
                .setMode(SessionCreateParams.Mode.SUBSCRIPTION)
                .setCustomer(request.customerId())
                .setSuccessUrl(properties.getSuccessUrl() + "?session_id={CHECKOUT_SESSION_ID}")
                .setCancelUrl(properties.getCancelUrl())
                .addLineItem(lineItem)
                .build();

        Session session = Session.create(params);
        return ResponseEntity.ok(new CreateSubscriptionResponse(session.getId(), session.getUrl()));
    }
}
