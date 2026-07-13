-- ============================================================
-- V9 - Analise CPF/CNPJ e ordens de transferencia externa
-- ============================================================

ALTER TABLE transactions
    ALTER COLUMN destination_account TYPE VARCHAR(180);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'transactions_type_check'
    ) THEN
        ALTER TABLE transactions DROP CONSTRAINT transactions_type_check;
    END IF;
END $$;

ALTER TABLE transactions
    ADD CONSTRAINT transactions_type_check
    CHECK (type IN ('DEPOSIT', 'WITHDRAWAL', 'TRANSFER_OUT', 'TRANSFER_IN', 'PAYMENT', 'TRANSFER_EXTERNAL'));

CREATE TABLE IF NOT EXISTS document_analyses (
    id BIGSERIAL PRIMARY KEY,
    document_type VARCHAR(10) NOT NULL CHECK (document_type IN ('CPF','CNPJ')),
    document_number VARCHAR(20) NOT NULL,
    provider VARCHAR(80) NOT NULL,
    status VARCHAR(40) NOT NULL,
    valid_format BOOLEAN NOT NULL DEFAULT FALSE,
    subject_name VARCHAR(255),
    registration_status VARCHAR(120),
    risk_level VARCHAR(20) NOT NULL DEFAULT 'NAO_ANALISADO',
    risk_score INTEGER NOT NULL DEFAULT 100,
    raw_response TEXT,
    error_message TEXT,
    requested_by BIGINT REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_document_analyses_document
    ON document_analyses(document_type, document_number);
CREATE INDEX IF NOT EXISTS idx_document_analyses_created
    ON document_analyses(created_at DESC);

CREATE TABLE IF NOT EXISTS external_transfer_orders (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    requested_by BIGINT REFERENCES users(id),
    transaction_id BIGINT REFERENCES transactions(id),
    amount_centavos BIGINT NOT NULL CHECK (amount_centavos > 0),
    channel VARCHAR(20) NOT NULL CHECK (channel IN ('PIX','TED')),
    currency VARCHAR(3) NOT NULL DEFAULT 'BRL',
    beneficiary_name VARCHAR(255) NOT NULL,
    beneficiary_document VARCHAR(20) NOT NULL,
    bank_code VARCHAR(10),
    ispb VARCHAR(20),
    agency VARCHAR(20),
    account_number VARCHAR(40),
    account_digit VARCHAR(10),
    account_type VARCHAR(30),
    pix_key VARCHAR(180),
    pix_key_type VARCHAR(30),
    description TEXT,
    provider VARCHAR(80) NOT NULL,
    provider_transfer_id VARCHAR(160),
    idempotency_key VARCHAR(80) NOT NULL UNIQUE,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING','PROCESSING','COMPLETED','FAILED')),
    error_message TEXT,
    raw_response TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_external_transfer_orders_user
    ON external_transfer_orders(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_external_transfer_orders_status
    ON external_transfer_orders(status);
