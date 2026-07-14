-- Durable, idempotent internal transfers and immutable account-level ledger.
CREATE TABLE internal_transfer_requests (
    id UUID PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    destination_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    idempotency_key VARCHAR(128) NOT NULL,
    amount_centavos BIGINT NOT NULL CHECK (amount_centavos > 0),
    description VARCHAR(500),
    status VARCHAR(20) NOT NULL
        CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED')),
    out_transaction_id BIGINT REFERENCES transactions(id) ON DELETE RESTRICT,
    in_transaction_id BIGINT REFERENCES transactions(id) ON DELETE RESTRICT,
    receipt_order_id BIGINT REFERENCES external_transfer_orders(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    version BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT uq_internal_transfer_request UNIQUE (user_id, idempotency_key),
    CONSTRAINT check_internal_transfer_accounts CHECK (user_id <> destination_user_id)
);

CREATE INDEX idx_internal_transfer_status_created
    ON internal_transfer_requests(status, created_at DESC);

CREATE TABLE account_ledger_entries (
    id BIGSERIAL PRIMARY KEY,
    transfer_request_id UUID REFERENCES internal_transfer_requests(id) ON DELETE RESTRICT,
    transfer_id VARCHAR(160) NOT NULL,
    transaction_id BIGINT REFERENCES transactions(id) ON DELETE RESTRICT,
    external_order_id BIGINT REFERENCES external_transfer_orders(id) ON DELETE RESTRICT,
    user_id BIGINT REFERENCES users(id) ON DELETE RESTRICT,
    account_number VARCHAR(40) NOT NULL,
    entry_type VARCHAR(10) NOT NULL CHECK (entry_type IN ('debit', 'credit')),
    signed_amount_centavos BIGINT NOT NULL,
    currency CHAR(3) NOT NULL DEFAULT 'BRL',
    reason VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_account_ledger_side UNIQUE (transfer_id, account_number, entry_type),
    CONSTRAINT check_account_ledger_sign CHECK (
        (entry_type = 'debit' AND signed_amount_centavos < 0)
        OR (entry_type = 'credit' AND signed_amount_centavos > 0)
    )
);

CREATE INDEX idx_account_ledger_user_created
    ON account_ledger_entries(user_id, created_at DESC);
CREATE INDEX idx_account_ledger_transfer
    ON account_ledger_entries(transfer_id);

CREATE OR REPLACE FUNCTION prevent_account_ledger_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Account ledger entries are immutable; create a compensating entry';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER account_ledger_entries_immutable
BEFORE UPDATE OR DELETE ON account_ledger_entries
FOR EACH ROW
EXECUTE FUNCTION prevent_account_ledger_mutation();
