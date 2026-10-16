package com.bravus.bank.payment.mp;

import com.bravus.bank.db.entity.UserEntity;
import com.bravus.bank.db.repo.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;
import java.util.UUID;

@Service
public class MercadoPagoPixOrderStore {
    private final MercadoPagoPixOrderRepository orderRepository;
    private final UserRepository userRepository;

    public MercadoPagoPixOrderStore(
            MercadoPagoPixOrderRepository orderRepository,
            UserRepository userRepository) {
        this.orderRepository = orderRepository;
        this.userRepository = userRepository;
    }

    @Transactional(isolation = Isolation.SERIALIZABLE)
    public PreparedOrder prepare(
            String username,
            long amountCentavos,
            String description,
            String clientIdempotencyKey) {
        UserEntity user = userRepository.findByUsername(username)
                .orElseThrow(() -> new MercadoPagoIntegrationException("ACCOUNT_NOT_FOUND", "Conta não encontrada."));
        if (!Boolean.TRUE.equals(user.getIsActive())) {
            throw new MercadoPagoIntegrationException("ACCOUNT_INACTIVE", "Conta inativa.");
        }
        if (user.getEmail() == null || user.getEmail().isBlank()) {
            throw new MercadoPagoIntegrationException("ACCOUNT_EMAIL_REQUIRED", "Atualize o e-mail da conta antes de gerar o Pix.");
        }

        Optional<MercadoPagoPixOrderEntity> existing = orderRepository
                .findByUserIdAndClientIdempotencyKey(user.getId(), clientIdempotencyKey);
        if (existing.isPresent()) {
            ensureSameRequest(existing.get(), amountCentavos);
            return new PreparedOrder(existing.get(), user.getEmail());
        }

        UUID id = UUID.randomUUID();
        MercadoPagoPixOrderEntity order = new MercadoPagoPixOrderEntity();
        order.setId(id);
        order.setUser(user);
        order.setClientIdempotencyKey(clientIdempotencyKey);
        order.setProviderIdempotencyKey(UUID.randomUUID().toString());
        order.setExternalReference("vantyx:pix:" + id);
        order.setAmountCentavos(amountCentavos);
        order.setCurrency("BRL");
        order.setDescription(description);
        order.setStatus("CREATING");
        return new PreparedOrder(orderRepository.saveAndFlush(order), user.getEmail());
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW, readOnly = true)
    public Optional<PreparedOrder> findAfterConcurrentDuplicate(
            String username,
            String idempotencyKey,
            long amountCentavos) {
        return userRepository.findByUsername(username)
                .flatMap(user -> orderRepository.findByUserIdAndClientIdempotencyKey(user.getId(), idempotencyKey))
                .map(order -> {
                    ensureSameRequest(order, amountCentavos);
                    return new PreparedOrder(order, order.getUser().getEmail());
                });
    }

    @Transactional(isolation = Isolation.SERIALIZABLE)
    public MercadoPagoPixOrderEntity completeCreation(
            UUID localOrderId,
            MercadoPagoOrdersGateway.OrderSnapshot providerOrder) {
        MercadoPagoPixOrderEntity order = orderRepository.findByIdForUpdate(localOrderId)
                .orElseThrow(() -> new MercadoPagoIntegrationException("MP_LOCAL_ORDER_NOT_FOUND", "Solicitação Pix não encontrada."));
        validateProviderOrder(order, providerOrder);
        applyProviderSnapshot(order, providerOrder);
        if (order.getCreditedAt() != null) order.setStatus("CREDITED");
        return orderRepository.save(order);
    }

    public void ensureSameRequest(MercadoPagoPixOrderEntity order, long amountCentavos) {
        if (!order.getAmountCentavos().equals(amountCentavos)) {
            throw new MercadoPagoIntegrationException(
                    "IDEMPOTENCY_CONFLICT",
                    "A chave de idempotência já foi usada com outro valor.");
        }
    }

    public void validateProviderOrder(
            MercadoPagoPixOrderEntity order,
            MercadoPagoOrdersGateway.OrderSnapshot providerOrder) {
        if (!order.getExternalReference().equals(providerOrder.externalReference())) {
            throw new MercadoPagoIntegrationException("MP_REFERENCE_MISMATCH", "Referência da order não confere.");
        }
        if (!order.getAmountCentavos().equals(providerOrder.amountCentavos())) {
            throw new MercadoPagoIntegrationException("MP_AMOUNT_MISMATCH", "Valor confirmado pelo Mercado Pago não confere.");
        }
        if (!"BRL".equals(providerOrder.currency())) {
            throw new MercadoPagoIntegrationException("MP_CURRENCY_MISMATCH", "Moeda confirmada pelo Mercado Pago não confere.");
        }
        boolean paymentMethodPresent = hasText(providerOrder.paymentMethodId())
                || hasText(providerOrder.paymentMethodType());
        if ((paymentMethodPresent || isAccredited(providerOrder))
                && (!"pix".equals(providerOrder.paymentMethodId())
                || !"bank_transfer".equals(providerOrder.paymentMethodType()))) {
            throw new MercadoPagoIntegrationException(
                    "MP_PAYMENT_METHOD_MISMATCH",
                    "Meio de pagamento confirmado pelo Mercado Pago não é Pix.");
        }
        if (isAccredited(providerOrder)) {
            if (!hasText(providerOrder.paymentId())) {
                throw new MercadoPagoIntegrationException(
                        "MP_PAYMENT_ID_REQUIRED",
                        "Mercado Pago não retornou o identificador do pagamento liquidado.");
            }
            if (providerOrder.paidAmountCentavos() == null
                    || !order.getAmountCentavos().equals(providerOrder.paidAmountCentavos())) {
                throw new MercadoPagoIntegrationException(
                        "MP_PAID_AMOUNT_MISMATCH",
                        "Valor liquidado pelo Mercado Pago não confere.");
            }
        }
    }

    public void applyProviderSnapshot(
            MercadoPagoPixOrderEntity order,
            MercadoPagoOrdersGateway.OrderSnapshot providerOrder) {
        order.setProviderOrderId(providerOrder.orderId());
        if (hasText(providerOrder.paymentId())) order.setProviderPaymentId(providerOrder.paymentId());
        order.setStatus(mapStatus(providerOrder.status(), providerOrder.statusDetail()));
        order.setStatusDetail(providerOrder.statusDetail());
        if (hasText(providerOrder.qrCode())) order.setQrCode(providerOrder.qrCode());
        if (hasText(providerOrder.qrCodeBase64())) order.setQrCodeBase64(providerOrder.qrCodeBase64());
        if (hasText(providerOrder.ticketUrl())) order.setTicketUrl(providerOrder.ticketUrl());
    }

    public String mapStatus(String status, String detail) {
        if ("processed".equals(status) && "accredited".equals(detail)) return "PROCESSED";
        if ("processed".equals(status) || "refunded".equals(status) || "charged_back".equals(status)) {
            return "REVIEW_REQUIRED";
        }
        return switch (status == null ? "" : status) {
            case "created" -> "CREATING";
            case "action_required" -> "ACTION_REQUIRED";
            case "processing" -> "PROCESSING";
            case "failed" -> "FAILED";
            case "canceled", "cancelled" -> "CANCELED";
            case "expired" -> "EXPIRED";
            default -> "REVIEW_REQUIRED";
        };
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private boolean isAccredited(MercadoPagoOrdersGateway.OrderSnapshot order) {
        return "processed".equals(order.status()) && "accredited".equals(order.statusDetail());
    }

    public record PreparedOrder(MercadoPagoPixOrderEntity order, String payerEmail) {}
}
