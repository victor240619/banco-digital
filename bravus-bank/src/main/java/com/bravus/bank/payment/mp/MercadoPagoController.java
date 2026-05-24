package com.bravus.bank.payment.mp;

import com.bravus.bank.db.entity.UserEntity;
import com.bravus.bank.db.repo.UserRepository;
import com.bravus.bank.ledger.entity.LedgerEntryEntity;
import com.bravus.bank.ledger.service.LedgerService;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

/**
 * Endpoints de integração com Mercado Pago.
 * - POST /api/payments/mp/pix      → autenticado, gera cobrança PIX para o user logado
 * - POST /api/payments/mp/webhook  → público, recebe notificações do MP
 */
@RestController
@RequestMapping("/api/payments/mp")
public class MercadoPagoController {

    private static final Logger log = LoggerFactory.getLogger(MercadoPagoController.class);

    private final MercadoPagoService mp;
    private final UserRepository userRepo;
    private final LedgerService ledger;

    public MercadoPagoController(MercadoPagoService mp,
                                 UserRepository userRepo,
                                 LedgerService ledger) {
        this.mp = mp;
        this.userRepo = userRepo;
        this.ledger = ledger;
    }

    public static class PixRequest {
        @NotNull @Min(1)
        public Long amountCentavos;
        public String description;
    }

    /**
     * Cria uma cobrança PIX. O user precisa estar autenticado.
     * Retorna o QR Code e o ticket_url pra cliente pagar.
     */
    @PostMapping("/pix")
    public ResponseEntity<?> createPix(@RequestBody PixRequest req, Authentication auth) {
        try {
            UserEntity user = userRepo.findByUsername(auth.getName())
                    .orElseThrow(() -> new IllegalStateException("User não encontrado"));

            String externalRef = "bravus:user:" + user.getId() + ":ts:" + System.currentTimeMillis();

            JsonNode payment = mp.createPixPayment(
                    req.amountCentavos,
                    req.description != null ? req.description : "Depósito Bravus Bank",
                    user.getEmail(),
                    externalRef
            );

            JsonNode poi = payment.path("point_of_interaction").path("transaction_data");

            Map<String, Object> resp = new HashMap<>();
            resp.put("paymentId", payment.path("id").asText());
            resp.put("status", payment.path("status").asText());
            resp.put("amountCentavos", req.amountCentavos);
            resp.put("externalReference", externalRef);
            resp.put("qrCodeBase64", poi.path("qr_code_base64").asText());
            resp.put("qrCode", poi.path("qr_code").asText());
            resp.put("ticketUrl", poi.path("ticket_url").asText());
            resp.put("expiresAt", payment.path("date_of_expiration").asText());

            log.info("PIX criado: paymentId={}, user={}, amount={}c",
                    payment.path("id").asText(), user.getUsername(), req.amountCentavos);

            return ResponseEntity.ok(resp);
        } catch (Exception e) {
            log.error("Erro ao criar PIX", e);
            return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Webhook do Mercado Pago. Chamado quando um pagamento muda de status.
     * O MP manda: { "action": "payment.updated", "data": { "id": "..." } }
     * Buscamos o pagamento completo e creditamos escrituralmente se aprovado.
     */
    @PostMapping("/webhook")
    @Transactional
    public ResponseEntity<?> webhook(@RequestBody(required = false) Map<String, Object> body,
                                     @RequestParam Map<String, String> query) {
        log.info("MP webhook recebido — body={}, query={}", body, query);

        try {
            // ID do pagamento vem em body.data.id ou query string ?id=...&topic=payment
            String paymentId = null;
            if (body != null) {
                Object data = body.get("data");
                if (data instanceof Map) {
                    Object id = ((Map<?, ?>) data).get("id");
                    if (id != null) paymentId = String.valueOf(id);
                }
            }
            if (paymentId == null) paymentId = query.get("id");
            if (paymentId == null) paymentId = query.get("data.id");

            if (paymentId == null) {
                log.warn("Webhook sem paymentId");
                return ResponseEntity.ok(Map.of("ignored", true, "reason", "no paymentId"));
            }

            JsonNode payment = mp.getPayment(paymentId);
            String status = payment.path("status").asText();
            String externalRef = payment.path("external_reference").asText("");
            long amountCentavos = Math.round(payment.path("transaction_amount").asDouble() * 100);

            log.info("MP payment {} status={} ref={} amount={}c",
                    paymentId, status, externalRef, amountCentavos);

            if (!"approved".equals(status)) {
                return ResponseEntity.ok(Map.of("ok", true, "status", status, "credited", false));
            }

            // Extrai userId do external_reference "bravus:user:{id}:ts:{...}"
            if (!externalRef.startsWith("bravus:user:")) {
                log.warn("external_reference inválido: {}", externalRef);
                return ResponseEntity.ok(Map.of("ignored", true, "ref", externalRef));
            }
            String[] parts = externalRef.split(":");
            Long userId = Long.parseLong(parts[2]);

            UserEntity user = userRepo.findById(userId)
                    .orElseThrow(() -> new IllegalStateException("User " + userId + " não existe"));

            // Idempotência: marca pagamento já processado via descrição do ledger
            String paymentTag = "MP:" + paymentId;

            // Se já existir lançamento com essa tag, ignora (evita crédito duplicado)
            // Como não temos query por descrição, usamos o referenciaId do MP
            // (paymentId é numérico no MP)
            Long mpPaymentRef = Long.parseLong(paymentId);

            // Cria lançamento ledger: DEBITO 1.1.1 (Caixa), CREDITO 2.1.1 (Obrigações)
            LedgerService.AppendEntryCommand cmd = new LedgerService.AppendEntryCommand();
            cmd.tipo = "DEPOSITO_EXTERNO";
            cmd.descricao = "Depósito PIX via Mercado Pago - " + paymentTag;
            cmd.debitoCodigo = "1.1.1";    // Caixa/Reserva do Banco aumenta
            cmd.creditoCodigo = "2.1.1";   // Obrigação Escritural ao cliente aumenta
            cmd.valor = amountCentavos;
            cmd.referenciaId = mpPaymentRef;
            cmd.referenciaTipo = "MP_PAYMENT";
            cmd.criadoPor = "MERCADOPAGO_WEBHOOK";
            cmd.observacao = "User " + user.getUsername() + " (id=" + userId + ")";

            LedgerEntryEntity entry = ledger.appendEntry(cmd);

            // Credita saldo do user
            long oldBalance = user.getBalance() == null ? 0L : user.getBalance();
            user.setBalance(oldBalance + amountCentavos);
            userRepo.save(user);

            log.info("✅ Depósito MP creditado: user={} +R${} (novo saldo R${}) ledgerEntry={}",
                    user.getUsername(), amountCentavos / 100.0,
                    user.getBalance() / 100.0, entry.getId());

            return ResponseEntity.ok(Map.of(
                    "ok", true,
                    "credited", true,
                    "userId", userId,
                    "amountCentavos", amountCentavos,
                    "ledgerEntryId", entry.getId(),
                    "newBalance", user.getBalance()
            ));
        } catch (Exception e) {
            log.error("Erro processando webhook MP", e);
            // Devolve 200 mesmo em erro pra MP não ficar retentando infinitamente
            // (logamos pra inspecionar manualmente)
            return ResponseEntity.ok(Map.of("error", e.getMessage()));
        }
    }
}
