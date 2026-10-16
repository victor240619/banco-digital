CREATE TABLE IF NOT EXISTS user_credential_audit (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id),
    event_type VARCHAR(60) NOT NULL,
    actor VARCHAR(120) NOT NULL,
    detail VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_credential_audit_user_created
    ON user_credential_audit(user_id, created_at DESC);
