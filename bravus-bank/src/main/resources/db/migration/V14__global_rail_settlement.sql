-- ============================================================
-- V14 - Global Rail participants and external settlement proof
-- ============================================================

DO $$
DECLARE
    channel_constraint TEXT;
BEGIN
    SELECT conname
      INTO channel_constraint
      FROM pg_constraint
     WHERE conrelid = 'external_transfer_orders'::regclass
       AND contype = 'c'
       AND pg_get_constraintdef(oid) LIKE '%channel%'
     LIMIT 1;

    IF channel_constraint IS NOT NULL THEN
        EXECUTE format('ALTER TABLE external_transfer_orders DROP CONSTRAINT %I', channel_constraint);
    END IF;
END $$;

ALTER TABLE external_transfer_orders
    ADD CONSTRAINT external_transfer_orders_channel_check
    CHECK (channel IN ('PIX','TED','SWIFT','ACH','SEPA','CAYMAN_RAIL','GLOBAL'));

ALTER TABLE external_transfer_orders
    ADD COLUMN IF NOT EXISTS settlement_status VARCHAR(80) NOT NULL DEFAULT 'DEBITADA_NO_BRAVUS_AGUARDANDO_CONEXAO_DESTINO',
    ADD COLUMN IF NOT EXISTS receipt_kind VARCHAR(80) NOT NULL DEFAULT 'COMPROVANTE_SAIDA_BRAVUS',
    ADD COLUMN IF NOT EXISTS destination_network VARCHAR(40),
    ADD COLUMN IF NOT EXISTS destination_participant_code VARCHAR(80),
    ADD COLUMN IF NOT EXISTS destination_confirmation_id VARCHAR(160),
    ADD COLUMN IF NOT EXISTS destination_confirmed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS settlement_message TEXT;

CREATE INDEX IF NOT EXISTS idx_external_transfer_orders_settlement
    ON external_transfer_orders(settlement_status);
CREATE INDEX IF NOT EXISTS idx_external_transfer_orders_destination_participant
    ON external_transfer_orders(destination_participant_code);

CREATE TABLE IF NOT EXISTS global_rail_participants (
    id BIGSERIAL PRIMARY KEY,
    participant_code VARCHAR(80) NOT NULL UNIQUE,
    legal_name VARCHAR(255) NOT NULL,
    country VARCHAR(2) NOT NULL DEFAULT 'KY',
    network VARCHAR(40) NOT NULL DEFAULT 'GLOBAL',
    bank_code VARCHAR(20),
    ispb VARCHAR(20),
    swift_bic VARCHAR(20),
    routing_code VARCHAR(80),
    endpoint_url VARCHAR(500),
    auth_mode VARCHAR(40) NOT NULL DEFAULT 'NONE'
        CHECK (auth_mode IN ('NONE','TOKEN','MTLS','SIGNED_FILE','MANUAL')),
    connection_mode VARCHAR(40) NOT NULL DEFAULT 'MANUAL_CONFIRMATION'
        CHECK (connection_mode IN ('SELF_LEDGER','HTTP_CONNECTOR','FILE_EXPORT','MANUAL_CONFIRMATION')),
    settlement_account VARCHAR(120),
    supports_instant BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(40) NOT NULL DEFAULT 'DRAFT'
        CHECK (status IN ('DRAFT','MISSING_CREDENTIALS','READY','ACTIVE','SUSPENDED','CLOSED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_global_rail_participants_network
    ON global_rail_participants(network);
CREATE INDEX IF NOT EXISTS idx_global_rail_participants_bank
    ON global_rail_participants(network, bank_code);
CREATE INDEX IF NOT EXISTS idx_global_rail_participants_ispb
    ON global_rail_participants(network, ispb);
CREATE INDEX IF NOT EXISTS idx_global_rail_participants_status
    ON global_rail_participants(status);
