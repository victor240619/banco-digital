package com.bravus.bank.user.transfer;

public class DuplicateInternalTransferRequestException extends RuntimeException {
    private final Long userId;
    private final Long destinationUserId;
    private final Long amountCentavos;
    private final String idempotencyKey;

    public DuplicateInternalTransferRequestException(
            Long userId,
            Long destinationUserId,
            Long amountCentavos,
            String idempotencyKey,
            Throwable cause) {
        super("Concurrent transfer request", cause);
        this.userId = userId;
        this.destinationUserId = destinationUserId;
        this.amountCentavos = amountCentavos;
        this.idempotencyKey = idempotencyKey;
    }

    public Long getUserId() { return userId; }
    public Long getDestinationUserId() { return destinationUserId; }
    public Long getAmountCentavos() { return amountCentavos; }
    public String getIdempotencyKey() { return idempotencyKey; }
}
