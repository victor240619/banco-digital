-- Recuperacao de senha com captura facial, revisao autorizada e auditoria.
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS credentials_version BIGINT NOT NULL DEFAULT 0;

ALTER TABLE users DROP CONSTRAINT IF EXISTS check_cpf_format;

DO $$
BEGIN
    IF EXISTS (
        SELECT regexp_replace(cpf, '[^0-9]', '', 'g')
        FROM users
        WHERE cpf IS NOT NULL
        GROUP BY regexp_replace(cpf, '[^0-9]', '', 'g')
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION 'CPFs duplicados apos normalizacao; revise os registros antes da migration V14';
    END IF;
END $$;

UPDATE users
SET cpf = regexp_replace(cpf, '[^0-9]', '', 'g')
WHERE cpf IS NOT NULL;

ALTER TABLE users
    ADD CONSTRAINT check_cpf_format
    CHECK (cpf IS NULL OR cpf ~ '^[0-9]{11}$');

ALTER TABLE account_opening_kyc
    ADD COLUMN IF NOT EXISTS face_cipher BYTEA,
    ADD COLUMN IF NOT EXISTS face_cipher_iv BYTEA,
    ADD COLUMN IF NOT EXISTS face_cipher_algorithm VARCHAR(40);

CREATE TABLE IF NOT EXISTS password_reset_requests (
    id UUID PRIMARY KEY,
    user_id BIGINT REFERENCES users(id),
    identifier_hash CHAR(64) NOT NULL,
    idempotency_key VARCHAR(128) NOT NULL UNIQUE,
    client_secret_hash CHAR(64) NOT NULL,
    challenge VARCHAR(120) NOT NULL,
    status VARCHAR(30) NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
    submitted_face_cipher BYTEA,
    submitted_face_iv BYTEA,
    submitted_face_mime VARCHAR(40),
    submitted_face_sha256 CHAR(64),
    reviewed_by VARCHAR(120),
    review_reason VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    reviewed_at TIMESTAMPTZ,
    consumed_at TIMESTAMPTZ,
    version BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT check_password_reset_status CHECK (
        status IN ('FACE_PENDING','REVIEW_PENDING','VERIFIED','CONSUMED','REJECTED','EXPIRED','LOCKED')
    )
);

CREATE INDEX IF NOT EXISTS idx_password_reset_identifier_created
    ON password_reset_requests(identifier_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_password_reset_status_created
    ON password_reset_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_password_reset_user_created
    ON password_reset_requests(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS password_reset_audit (
    id BIGSERIAL PRIMARY KEY,
    request_id UUID NOT NULL REFERENCES password_reset_requests(id),
    event_type VARCHAR(60) NOT NULL,
    actor VARCHAR(120) NOT NULL,
    detail VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_audit_request_created
    ON password_reset_audit(request_id, created_at DESC);
