-- KYC de abertura de conta: documento frente/verso e biometria facial.
CREATE TABLE IF NOT EXISTS account_opening_kyc (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    document_type VARCHAR(10),
    document_number VARCHAR(20),
    front_file_path VARCHAR(500) NOT NULL,
    back_file_path VARCHAR(500) NOT NULL,
    face_file_path VARCHAR(500) NOT NULL,
    front_sha256 CHAR(64) NOT NULL,
    back_sha256 CHAR(64) NOT NULL,
    face_sha256 CHAR(64) NOT NULL,
    front_mime VARCHAR(40) NOT NULL,
    back_mime VARCHAR(40) NOT NULL,
    face_mime VARCHAR(40) NOT NULL,
    front_bytes BIGINT NOT NULL,
    back_bytes BIGINT NOT NULL,
    face_bytes BIGINT NOT NULL,
    face_capture_method VARCHAR(30) NOT NULL DEFAULT 'CAMERA',
    biometric_challenge VARCHAR(120),
    provider VARCHAR(80) NOT NULL DEFAULT 'BRAVUS_SELF_KYC',
    status VARCHAR(30) NOT NULL DEFAULT 'CAPTURADO'
        CHECK (status IN ('CAPTURADO','VERIFICADO','REJEITADO')),
    risk_score INTEGER NOT NULL DEFAULT 10,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_account_opening_kyc_document
    ON account_opening_kyc(document_type, document_number);
CREATE INDEX IF NOT EXISTS idx_account_opening_kyc_created
    ON account_opening_kyc(created_at DESC);
