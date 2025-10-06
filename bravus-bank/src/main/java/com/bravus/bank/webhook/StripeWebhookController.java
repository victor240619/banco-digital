package com.bravus.bank.webhook;

import com.bravus.bank.config.BankProperties;
import com.bravus.bank.db.entity.PaymentEntity;
import com.bravus.bank.db.entity.AccountEntity;
import com.bravus.bank.ledger.LedgerService;
import com.bravus.bank.db.repo.PaymentRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.stripe.exception.SignatureVerificationException;
import com.stripe.model.Event;
import com.stripe.model.PaymentIntent;
import com.stripe.model.checkout.Session;
import com.stripe.net.Webhook;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/stripe/webhook")
public class StripeWebhookController {

    private static final Logger log = LoggerFactory.getLogger(StripeWebhookController.class);

    private final BankProperties properties;
    private final ObjectMapper objectMapper;
    private final PaymentRepository paymentRepository;
    private final LedgerService ledgerService;

    public StripeWebhookController(BankProperties properties, ObjectMapper objectMapper, PaymentRepository paymentRepository, LedgerService ledgerService) {
        this.properties = properties;
        this.objectMapper = objectMapper;
        this.paymentRepository = paymentRepository;
        this.ledgerService = ledgerService;
    }

    @PostMapping
    public ResponseEntity<String> handle(@RequestBody String payload,
                                         @RequestHeader("Stripe-Signature") String sigHeader) {
        String endpointSecret = properties.getWebhookSecret();
        Event event;
        try {
            event = Webhook.constructEvent(payload, sigHeader, endpointSecret);
        } catch (SignatureVerificationException e) {
            log.warn("Invalid Stripe signature: {}", e.getMessage());
            return ResponseEntity.status(400).body("Invalid signature");
        }

        switch (event.getType()) {
            case "checkout.session.completed" -> {
                Session session = (Session) event.getDataObjectDeserializer().getObject().orElse(null);
                if (session != null) {
                    log.info("Checkout completed: {}", session.getId());
                }
            }
            case "invoice.payment_succeeded" -> log.info("Invoice payment succeeded");
            case "payment_intent.succeeded" -> {
                PaymentIntent intent = (PaymentIntent) event.getDataObjectDeserializer().getObject().orElse(null);
                if (intent != null) {
                    log.info("Payment succeeded: {}", intent.getId());
                    paymentRepository.findByStripePaymentIntentId(intent.getId()).ifPresent(pe -> {
                        pe.setStatus(intent.getStatus());
                        paymentRepository.save(pe);
                        // Credit ledger for the associated customer
                        String stripeCustomerId = intent.getCustomer();
                        if (stripeCustomerId != null) {
                            AccountEntity account = ledgerService.ensureAccountForStripeCustomer(stripeCustomerId, properties.getDefaultCurrency());
                            long amount = intent.getAmount() == null ? 0L : intent.getAmount();
                            ledgerService.credit(account, amount, properties.getDefaultCurrency(), "Stripe PaymentIntent succeeded", "PAYMENT_INTENT", intent.getId());
                        }
                    });
                }
            }
            default -> log.info("Unhandled event type: {}", event.getType());
        }
        return ResponseEntity.ok("ok");
    }
}
