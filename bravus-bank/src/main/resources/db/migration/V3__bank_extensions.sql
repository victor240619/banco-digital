-- Extended banking schema additions
BEGIN;

-- Addresses for KYC and contact
CREATE TABLE IF NOT EXISTS addresses (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    label VARCHAR(50) DEFAULT 'primary',
    line1 VARCHAR(255) NOT NULL,
    line2 VARCHAR(255),
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(2) DEFAULT 'BR',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- KYC verifications
CREATE TABLE IF NOT EXISTS kyc_verifications (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(30) NOT NULL CHECK (status IN ('PENDING','APPROVED','REJECTED')),
    document_type VARCHAR(50),
    document_number VARCHAR(64),
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    notes TEXT
);

-- User devices
CREATE TABLE IF NOT EXISTS user_devices (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_id VARCHAR(100) NOT NULL,
    device_type VARCHAR(50),
    user_agent TEXT,
    ip VARCHAR(64),
    last_seen TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, device_id)
);

-- Session tokens (for refresh or web sessions)
CREATE TABLE IF NOT EXISTS user_sessions (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_token VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    ip VARCHAR(64),
    user_agent TEXT,
    revoked BOOLEAN DEFAULT FALSE,
    UNIQUE(session_token)
);

-- Beneficiaries / saved recipients
CREATE TABLE IF NOT EXISTS beneficiaries (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    alias VARCHAR(100),
    destination_account VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, destination_account)
);

-- Scheduled transactions (standing orders)
CREATE TABLE IF NOT EXISTS scheduled_transactions (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('TRANSFER_OUT','PAYMENT')),
    amount BIGINT NOT NULL,
    destination_account VARCHAR(20),
    description TEXT,
    schedule_cron VARCHAR(100) NOT NULL,
    next_run_at TIMESTAMPTZ,
    status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','PAUSED','CANCELLED')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Account limits
CREATE TABLE IF NOT EXISTS account_limits (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    daily_limit BIGINT DEFAULT 1000000,
    monthly_limit BIGINT DEFAULT 20000000,
    used_today BIGINT DEFAULT 0,
    used_month BIGINT DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50),
    title VARCHAR(255) NOT NULL,
    body TEXT,
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit log
CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    details JSONB,
    ip VARCHAR(64),
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Webhooks log
CREATE TABLE IF NOT EXISTS webhooks_log (
    id BIGSERIAL PRIMARY KEY,
    provider VARCHAR(50) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    received_at TIMESTAMPTZ DEFAULT NOW(),
    processed BOOLEAN DEFAULT FALSE
);

-- helpful indexes
CREATE INDEX IF NOT EXISTS idx_addresses_user_id ON addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_kyc_user_id ON kyc_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_devices_user_id ON user_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_beneficiaries_user_id ON beneficiaries(user_id);
CREATE INDEX IF NOT EXISTS idx_sched_user_id ON scheduled_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_user_id ON audit_logs(user_id);

COMMIT;