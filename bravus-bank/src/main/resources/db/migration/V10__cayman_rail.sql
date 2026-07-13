-- ============================================================
-- V10 - Bravus Cayman Rail license-gated payment rail
-- ============================================================

CREATE TABLE IF NOT EXISTS cayman_rail_config (
    id BIGINT PRIMARY KEY DEFAULT 1,
    legal_entity_name VARCHAR(255) NOT NULL DEFAULT 'Bravus Bank Cayman Ltd.',
    jurisdiction VARCHAR(80) NOT NULL DEFAULT 'Cayman Islands',
    registry_number VARCHAR(80),
    cima_license_number VARCHAR(80),
    license_class VARCHAR(80),
    regulatory_status VARCHAR(40) NOT NULL DEFAULT 'DRAFT'
        CHECK (regulatory_status IN ('DRAFT','COMPANY_REGISTERED','CIMA_APPLICATION','LICENSED','SUSPENDED')),
    production_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    settlement_mode VARCHAR(40) NOT NULL DEFAULT 'INTERNAL_ONLY'
        CHECK (settlement_mode IN ('INTERNAL_ONLY','LIVE_LICENSED')),
    aml_policy_version VARCHAR(80),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT cayman_rail_config_singleton CHECK (id = 1)
);

INSERT INTO cayman_rail_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS cayman_rail_participants (
    id BIGSERIAL PRIMARY KEY,
    participant_code VARCHAR(40) NOT NULL UNIQUE,
    legal_name VARCHAR(255) NOT NULL,
    institution_type VARCHAR(40) NOT NULL DEFAULT 'INTERNAL'
        CHECK (institution_type IN ('INTERNAL','BANK','MSB','CORRESPONDENT','TEST')),
    country VARCHAR(2) NOT NULL DEFAULT 'KY',
    swift_bic VARCHAR(20),
    local_routing_code VARCHAR(40),
    settlement_account VARCHAR(80),
    direct_participant BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING','ACTIVE','SUSPENDED','CLOSED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cayman_rail_participants_status
    ON cayman_rail_participants(status);

CREATE TABLE IF NOT EXISTS cayman_rail_instructions (
    id BIGSERIAL PRIMARY KEY,
    idempotency_key VARCHAR(80) NOT NULL UNIQUE,
    user_id BIGINT REFERENCES users(id) ON DELETE RESTRICT,
    participant_id BIGINT REFERENCES cayman_rail_participants(id) ON DELETE RESTRICT,
    amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'KYD',
    channel VARCHAR(30) NOT NULL DEFAULT 'CAYMAN_RAIL',
    beneficiary_name VARCHAR(255) NOT NULL,
    beneficiary_document VARCHAR(80),
    beneficiary_account VARCHAR(80) NOT NULL,
    description TEXT,
    status VARCHAR(40) NOT NULL DEFAULT 'RECEIVED'
        CHECK (status IN (
            'RECEIVED',
            'COMPLIANCE_HOLD',
            'READY_FOR_SETTLEMENT',
            'SETTLED_INTERNAL',
            'BLOCKED_LICENSE_REQUIRED',
            'FAILED'
        )),
    compliance_result VARCHAR(80),
    regulatory_gate VARCHAR(80),
    error_message TEXT,
    created_by BIGINT REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cayman_rail_instructions_status
    ON cayman_rail_instructions(status);
CREATE INDEX IF NOT EXISTS idx_cayman_rail_instructions_created
    ON cayman_rail_instructions(created_at DESC);
