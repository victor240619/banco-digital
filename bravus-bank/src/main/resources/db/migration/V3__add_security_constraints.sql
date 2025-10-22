-- Add version columns for optimistic locking
ALTER TABLE users ADD COLUMN IF NOT EXISTS version BIGINT DEFAULT 0;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS version BIGINT DEFAULT 0;
ALTER TABLE transfers ADD COLUMN IF NOT EXISTS version BIGINT DEFAULT 0;

-- Add balance check constraint to ensure balance is never negative
ALTER TABLE users ADD CONSTRAINT check_balance_non_negative CHECK (balance >= 0);

-- Add amount check constraints to ensure positive amounts
ALTER TABLE transactions ADD CONSTRAINT check_amount_positive CHECK (amount > 0);
ALTER TABLE transfers ADD CONSTRAINT check_gross_amount_positive CHECK (gross_amount > 0);
ALTER TABLE transfers ADD CONSTRAINT check_net_amount_positive CHECK (net_amount > 0);
ALTER TABLE payments ADD CONSTRAINT check_gross_amount_positive CHECK (gross_amount > 0);

-- Add additional security constraints
ALTER TABLE users ADD CONSTRAINT check_account_number_format CHECK (account_number ~ '^[0-9]{10}$');
ALTER TABLE users ADD CONSTRAINT check_cpf_format CHECK (cpf IS NULL OR cpf ~ '^[0-9]{3}\.[0-9]{3}\.[0-9]{3}-[0-9]{2}$');

-- Add indexes for version columns
CREATE INDEX IF NOT EXISTS idx_users_version ON users(version);
CREATE INDEX IF NOT EXISTS idx_transactions_version ON transactions(version);
CREATE INDEX IF NOT EXISTS idx_transfers_version ON transfers(version);

-- Add comment for documentation
COMMENT ON CONSTRAINT check_balance_non_negative ON users IS 'Ensures user balance cannot be negative';
COMMENT ON COLUMN users.version IS 'Version column for optimistic locking';
COMMENT ON COLUMN transactions.version IS 'Version column for optimistic locking';
COMMENT ON COLUMN transfers.version IS 'Version column for optimistic locking';