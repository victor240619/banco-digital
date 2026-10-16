-- Mercado Pago Orders integration for inbound Pix deposits.
-- This migration only adds isolated tables; it does not rewrite existing balances.

CREATE TABLE mercado_pago_pix_orders (
    id UUID PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    client_idempotency_key VARCHAR(128) NOT NULL,
    provider_idempotency_key VARCHAR(64) NOT NULL,
    external_reference VARCHAR(100) NOT NULL,
    provider_order_id VARCHAR(80),
    provider_payment_id VARCHAR(80),
    amount_centavos BIGINT NOT NULL CHECK (amount_centavos > 0),
    currency CHAR(3) NOT NULL DEFAULT 'BRL' CHECK (currency = 'BRL'),
    description VARCHAR(255),
    status VARCHAR(32) NOT NULL CHECK (status IN (
        'CREATING', 'ACTION_REQUIRED', 'PROCESSING', 'PROCESSED', 'CREDITED',
        'FAILED', 'CANCELED', 'EXPIRED', 'REFUNDED', 'REVIEW_REQUIRED'
    )),
    status_detail VARCHAR(80),
    qr_code TEXT,
    qr_code_base64 TEXT,
    ticket_url TEXT,
    transaction_id BIGINT REFERENCES transactions(id) ON DELETE RESTRICT,
    credited_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    version BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT uq_mp_pix_user_idempotency UNIQUE (user_id, client_idempotency_key),
    CONSTRAINT uq_mp_pix_provider_idempotency UNIQUE (provider_idempotency_key),
    CONSTRAINT uq_mp_pix_external_reference UNIQUE (external_reference),
    CONSTRAINT uq_mp_pix_provider_order UNIQUE (provider_order_id),
    CONSTRAINT uq_mp_pix_provider_payment UNIQUE (provider_payment_id),
    CONSTRAINT check_mp_pix_credit_consistency CHECK (
        (status = 'CREDITED' AND credited_at IS NOT NULL AND transaction_id IS NOT NULL)
        OR status <> 'CREDITED'
    )
);

CREATE INDEX idx_mp_pix_orders_user_created
    ON mercado_pago_pix_orders(user_id, created_at DESC);
CREATE INDEX idx_mp_pix_orders_status_updated
    ON mercado_pago_pix_orders(status, updated_at DESC);

CREATE TABLE mercado_pago_webhook_events (
    id BIGSERIAL PRIMARY KEY,
    request_id VARCHAR(100) NOT NULL UNIQUE,
    provider_order_id VARCHAR(80) NOT NULL,
    event_type VARCHAR(40) NOT NULL,
    action VARCHAR(80),
    processing_status VARCHAR(20) NOT NULL
        CHECK (processing_status IN ('RECEIVED', 'PROCESSED', 'IGNORED', 'FAILED')),
    error_code VARCHAR(80),
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

CREATE INDEX idx_mp_webhook_order_received
    ON mercado_pago_webhook_events(provider_order_id, received_at DESC);
