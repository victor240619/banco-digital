CREATE TABLE IF NOT EXISTS accounts (
    id BIGSERIAL PRIMARY KEY,
    customer_id BIGINT REFERENCES customers(id) ON DELETE CASCADE,
    currency VARCHAR(8) NOT NULL DEFAULT 'brl',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_accounts_customer ON accounts(customer_id);

CREATE TABLE IF NOT EXISTS ledger_entries (
    id BIGSERIAL PRIMARY KEY,
    account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    type VARCHAR(8) NOT NULL CHECK (type IN ('CREDIT','DEBIT')),
    amount BIGINT NOT NULL CHECK (amount > 0),
    currency VARCHAR(8) NOT NULL,
    description TEXT,
    reference_type VARCHAR(64),
    reference_id VARCHAR(128),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ledger_account ON ledger_entries(account_id);
CREATE INDEX IF NOT EXISTS idx_ledger_ref ON ledger_entries(reference_type, reference_id);
