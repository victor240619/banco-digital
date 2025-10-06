CREATE TABLE IF NOT EXISTS customers (
    id BIGSERIAL PRIMARY KEY,
    stripe_customer_id VARCHAR(64) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    type VARCHAR(2) NOT NULL CHECK (type IN ('PF','PJ')),
    document VARCHAR(64),
    phone VARCHAR(64),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payments (
    id BIGSERIAL PRIMARY KEY,
    stripe_payment_intent_id VARCHAR(64) UNIQUE NOT NULL,
    customer_id BIGINT REFERENCES customers(id) ON DELETE SET NULL,
    gross_amount BIGINT NOT NULL,
    fee_amount BIGINT NOT NULL,
    currency VARCHAR(8) NOT NULL,
    description TEXT,
    status VARCHAR(32) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transfers (
    id BIGSERIAL PRIMARY KEY,
    stripe_transfer_id VARCHAR(64) UNIQUE NOT NULL,
    destination_account_id VARCHAR(64) NOT NULL,
    gross_amount BIGINT NOT NULL,
    fee_amount BIGINT NOT NULL,
    net_amount BIGINT NOT NULL,
    currency VARCHAR(8) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
