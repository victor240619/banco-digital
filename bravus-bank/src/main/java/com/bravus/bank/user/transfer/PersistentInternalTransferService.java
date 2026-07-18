package com.bravus.bank.user.transfer;

import com.bravus.bank.db.entity.TransactionEntity;
import com.bravus.bank.db.entity.UserEntity;
import com.bravus.bank.db.repo.TransactionRepository;
import com.bravus.bank.db.repo.UserRepository;
import com.bravus.bank.external.ExternalTransferEntity;
import com.bravus.bank.external.ExternalTransferRepository;
import com.bravus.bank.ledger.repo.CreditGrantRepository;
import com.bravus.bank.ledger.service.CreditService;
import com.bravus.bank.user.OutboundOperationPolicy;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.OffsetDateTime;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class PersistentInternalTransferService {
    private final UserRepository userRepository;
    private final TransactionRepository transactionRepository;
    private final ExternalTransferRepository externalTransferRepository;
    private final InternalTransferRequestRepository requestRepository;
    private final AccountLedgerEntryRepository accountLedgerRepository;
    private final CreditGrantRepository creditGrantRepository;
    private final CreditService creditService;
    private final OutboundOperationPolicy outboundOperationPolicy;

    public PersistentInternalTransferService(
            UserRepository userRepository,
            TransactionRepository transactionRepository,
            ExternalTransferRepository externalTransferRepository,
            InternalTransferRequestRepository requestRepository,
            AccountLedgerEntryRepository accountLedgerRepository,
            CreditGrantRepository creditGrantRepository,
            CreditService creditService,
            OutboundOperationPolicy outboundOperationPolicy) {
        this.userRepository = userRepository;
        this.transactionRepository = transactionRepository;
        this.externalTransferRepository = externalTransferRepository;
        this.requestRepository = requestRepository;
        this.accountLedgerRepository = accountLedgerRepository;
        this.creditGrantRepository = creditGrantRepository;
        this.creditService = creditService;
        this.outboundOperationPolicy = outboundOperationPolicy;
    }

    @Transactional(isolation = Isolation.SERIALIZABLE)
    public TransferResult transfer(
            String username,
            String destination,
            Long amountCentavos,
            String description,
            String suppliedIdempotencyKey) {
        if (amountCentavos == null || amountCentavos <= 0) {
            throw new InternalTransferException("INVALID_AMOUNT", "Digite um valor valido.");
        }

        String idempotencyKey = normalizeIdempotencyKey(suppliedIdempotencyKey);
        UserEntity initialFrom = userRepository.findByUsername(username)
                .orElseThrow(() -> new InternalTransferException("SOURCE_NOT_FOUND", "Conta de origem nao encontrada."));
        outboundOperationPolicy.assertAllowed(initialFrom);
        UserEntity initialTo = findDestination(destination)
                .orElseThrow(() -> new InternalTransferException(
                        "BRAVUS_DESTINATION_NOT_FOUND",
                        "Destino Bravus nao encontrado. Para outros bancos, use ACH/EFT Cayman ou Wire/SWIFT internacional."));

        if (initialFrom.getId().equals(initialTo.getId())) {
            throw new InternalTransferException("SELF_TRANSFER", "Nao e permitido transferir para a propria conta Bravus.");
        }

        Optional<InternalTransferRequestEntity> previous = requestRepository
                .findByUserIdAndIdempotencyKey(initialFrom.getId(), idempotencyKey);
        if (previous.isPresent()) {
            return replay(previous.get(), initialTo.getId(), amountCentavos);
        }

        InternalTransferRequestEntity request = new InternalTransferRequestEntity();
        request.setId(UUID.randomUUID());
        request.setUser(initialFrom);
        request.setDestinationUser(initialTo);
        request.setIdempotencyKey(idempotencyKey);
        request.setAmountCentavos(amountCentavos);
        request.setDescription(normalizeDescription(description));
        request.setStatus("PENDING");
        try {
            request = requestRepository.saveAndFlush(request);
        } catch (DataIntegrityViolationException duplicate) {
            throw new DuplicateInternalTransferRequestException(
                    initialFrom.getId(), initialTo.getId(), amountCentavos, idempotencyKey, duplicate);
        }

        List<UserEntity> locked = userRepository.findAllByIdInOrderByIdForUpdate(
                List.of(initialFrom.getId(), initialTo.getId()));
        if (locked.size() != 2) {
            throw new InternalTransferException("ACCOUNT_LOCK_FAILED", "Nao foi possivel bloquear as duas contas.");
        }
        UserEntity from = locked.stream()
                .filter(user -> user.getId().equals(initialFrom.getId()))
                .findFirst()
                .orElseThrow();
        UserEntity to = locked.stream()
                .filter(user -> user.getId().equals(initialTo.getId()))
                .findFirst()
                .orElseThrow();

        if (!Boolean.TRUE.equals(from.getIsActive()) || !Boolean.TRUE.equals(to.getIsActive())) {
            throw new InternalTransferException("ACCOUNT_INACTIVE", "Conta de origem ou destino esta inativa.");
        }
        if (from.getBalance() == null || from.getBalance() < amountCentavos) {
            throw new InternalTransferException(
                    "INSUFFICIENT_BALANCE",
                    "Saldo contabil insuficiente para concluir a transferencia.");
        }

        from.setBalance(from.getBalance() - amountCentavos);
        to.setBalance(to.getBalance() + amountCentavos);
        userRepository.save(from);
        userRepository.save(to);

        String effectiveDescription = normalizeDescription(description);
        TransactionEntity out = createTransaction(
                from, "TRANSFER_OUT", amountCentavos, effectiveDescription, to.getAccountNumber());
        TransactionEntity in = createTransaction(
                to, "TRANSFER_IN", amountCentavos, effectiveDescription, from.getAccountNumber());

        consumeCreditIfAvailable(from, amountCentavos, out.getId(), username, to.getAccountNumber());

        String transferId = externalIdempotencyKey(from.getId(), idempotencyKey);
        ExternalTransferEntity receipt = createReceipt(
                from, to, out, amountCentavos, effectiveDescription, transferId);

        accountLedgerRepository.saveAll(List.of(
                ledgerSide(request, transferId, out.getId(), receipt.getId(), from,
                        "debit", -amountCentavos),
                ledgerSide(request, transferId, in.getId(), receipt.getId(), to,
                        "credit", amountCentavos)));

        request.setOutTransactionId(out.getId());
        request.setInTransactionId(in.getId());
        request.setReceiptOrderId(receipt.getId());
        request.setStatus("COMPLETED");
        request.setCompletedAt(OffsetDateTime.now());
        requestRepository.save(request);

        return result(request, from.getBalance(), false);
    }

    @Transactional(readOnly = true, propagation = Propagation.REQUIRES_NEW)
    public Optional<TransferResult> findCompletedAfterConcurrentDuplicate(
            Long userId,
            String idempotencyKey,
            Long destinationUserId,
            Long amountCentavos) {
        return requestRepository.findByUserIdAndIdempotencyKey(userId, idempotencyKey)
                .map(request -> replay(request, destinationUserId, amountCentavos));
    }

    private TransferResult replay(
            InternalTransferRequestEntity request,
            Long destinationUserId,
            Long amountCentavos) {
        if (!request.getDestinationUser().getId().equals(destinationUserId)
                || !request.getAmountCentavos().equals(amountCentavos)) {
            throw new InternalTransferException(
                    "IDEMPOTENCY_CONFLICT",
                    "A chave de idempotencia ja foi usada com outra transferencia.");
        }
        if (!"COMPLETED".equals(request.getStatus())) {
            throw new InternalTransferException(
                    "TRANSFER_PENDING_RETRY",
                    "A transferencia ainda esta sendo processada. Tente novamente com a mesma chave.");
        }
        Long balance = request.getUser().getBalance();
        return result(request, balance, true);
    }

    private TransferResult result(
            InternalTransferRequestEntity request,
            Long balanceCentavos,
            boolean replay) {
        return new TransferResult(
                request.getId(),
                request.getOutTransactionId(),
                request.getInTransactionId(),
                request.getReceiptOrderId(),
                request.getDestinationUser().getAccountNumber(),
                request.getAmountCentavos(),
                balanceCentavos,
                replay);
    }

    private TransactionEntity createTransaction(
            UserEntity user,
            String type,
            Long amount,
            String description,
            String destinationAccount) {
        TransactionEntity transaction = new TransactionEntity();
        transaction.setUser(user);
        transaction.setType(type);
        transaction.setAmount(amount);
        transaction.setDescription(description);
        transaction.setDestinationAccount(destinationAccount);
        transaction.setStatus("COMPLETED");
        return transactionRepository.save(transaction);
    }

    private ExternalTransferEntity createReceipt(
            UserEntity from,
            UserEntity to,
            TransactionEntity out,
            Long amount,
            String description,
            String idempotencyKey) {
        ExternalTransferEntity order = new ExternalTransferEntity();
        order.setUser(from);
        order.setRequestedBy(from);
        order.setTransactionId(out.getId());
        order.setAmountCentavos(amount);
        order.setChannel("INTERNAL_BRAVUS");
        order.setCurrency("KYD");
        order.setBeneficiaryName(to.getFullName() != null ? to.getFullName() : to.getUsername());
        order.setBeneficiaryDocument(digits(to.getCpf()));
        order.setBankCode("999");
        order.setIspb("99999999");
        order.setAgency(to.getAgencia() != null ? to.getAgencia() : "0001");
        order.setAccountNumber(to.getAccountNumber());
        order.setAccountType(to.getAccountType() != null ? to.getAccountType() : "CORRENTE");
        order.setPixKey(to.getChavePix() != null ? to.getChavePix() : digits(to.getCpf()));
        order.setPixKeyType(to.getTipoChavePix() != null ? to.getTipoChavePix() : "CPF");
        order.setDescription(description);
        order.setProvider("BRAVUS_INTERNAL_LEDGER");
        order.setProviderTransferId(idempotencyKey);
        order.setIdempotencyKey(idempotencyKey);
        order.setStatus("COMPLETED");
        order.setSettlementStatus("LIQUIDADA_CONFIRMADA");
        order.setReceiptKind("COMPROVANTE_LIQUIDACAO_CONFIRMADA");
        order.setDestinationNetwork("INTERNAL_BRAVUS");
        order.setDestinationParticipantCode("BRAVUS-INTERNAL");
        order.setDestinationConfirmationId(idempotencyKey);
        order.setDestinationConfirmedAt(OffsetDateTime.now());
        order.setSettlementMessage("Liquidacao interna confirmada no ledger Bravus.");
        order.setRawResponse("{\"provider\":\"BRAVUS_INTERNAL_LEDGER\",\"status\":\"COMPLETED\",\"settlement\":\"INTERNAL_LEDGER\"}");
        return externalTransferRepository.save(order);
    }

    private AccountLedgerEntryEntity ledgerSide(
            InternalTransferRequestEntity request,
            String transferId,
            Long transactionId,
            Long orderId,
            UserEntity user,
            String entryType,
            Long signedAmount) {
        AccountLedgerEntryEntity entry = new AccountLedgerEntryEntity();
        entry.setTransferRequest(request);
        entry.setTransferId(transferId);
        entry.setTransactionId(transactionId);
        entry.setExternalOrderId(orderId);
        entry.setUser(user);
        entry.setAccountNumber(user.getAccountNumber());
        entry.setEntryType(entryType);
        entry.setSignedAmountCentavos(signedAmount);
        entry.setCurrency("KYD");
        entry.setReason("INTERNAL_TRANSFER");
        return entry;
    }

    private void consumeCreditIfAvailable(
            UserEntity user,
            Long amount,
            Long transactionId,
            String createdBy,
            String destinationAccount) {
        Long availableCredit = creditGrantRepository.sumAvailableByUser(user.getId());
        if (availableCredit == null || availableCredit <= 0) return;

        CreditService.UseCommand command = new CreditService.UseCommand();
        command.userId = user.getId();
        command.valor = Math.min(amount, availableCredit);
        command.tipo = "TRANSFERENCIA_INTERNA";
        command.transactionId = transactionId;
        command.criadoPor = createdBy;
        command.observacao = "Transferencia interna Bravus para " + destinationAccount;
        creditService.useCredit(command);
    }

    private Optional<UserEntity> findDestination(String destination) {
        if (destination == null || destination.isBlank()) return Optional.empty();
        String raw = destination.trim();
        String onlyDigits = digits(raw);

        Optional<UserEntity> found = userRepository.findByAccountNumber(raw);
        if (found.isPresent()) return found;
        if (!onlyDigits.isBlank()) {
            found = userRepository.findByAccountNumber(onlyDigits);
            if (found.isPresent()) return found;
            if (onlyDigits.length() == 11 || onlyDigits.length() == 14) {
                found = userRepository.findByCpf(onlyDigits);
                if (found.isPresent()) return found;
            }
            found = userRepository.findByChavePix(onlyDigits);
            if (found.isPresent()) return found;
        }
        return userRepository.findByEmail(raw)
                .or(() -> userRepository.findByUsername(raw))
                .or(() -> userRepository.findByChavePix(raw));
    }

    private String normalizeIdempotencyKey(String supplied) {
        if (supplied == null || supplied.isBlank()) {
            return "legacy-" + UUID.randomUUID();
        }
        String key = supplied.trim();
        if (key.length() < 20 || key.length() > 128) {
            throw new InternalTransferException(
                    "INVALID_IDEMPOTENCY_KEY",
                    "Chave de idempotencia invalida.");
        }
        return key;
    }

    private String externalIdempotencyKey(Long userId, String requestKey) {
        return "bravus-internal-" + sha256(userId + ":" + requestKey);
    }

    private String sha256(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 unavailable", exception);
        }
    }

    private String normalizeDescription(String description) {
        if (description == null || description.isBlank()) return "Transferencia interna Bravus";
        String normalized = description.trim();
        return normalized.length() <= 500 ? normalized : normalized.substring(0, 500);
    }

    private String digits(String value) {
        return value == null ? "" : value.replaceAll("\\D", "");
    }

    public record TransferResult(
            UUID requestId,
            Long transactionOutId,
            Long transactionInId,
            Long receiptOrderId,
            String destinationAccount,
            Long amountCentavos,
            Long balanceCentavos,
            boolean idempotentReplay) {}
}
