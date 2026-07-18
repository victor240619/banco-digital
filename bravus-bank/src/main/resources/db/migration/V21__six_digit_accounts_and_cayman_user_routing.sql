-- Standardize internal Bravus accounts as six digits without changing balances,
-- transaction amounts, ledger amounts, or immutable financial entry history.

ALTER TABLE users DROP CONSTRAINT IF EXISTS check_account_number_format;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM users
        WHERE account_number !~ '^[0-9]+$'
    ) THEN
        RAISE EXCEPTION 'Six-digit account migration refused: non-numeric account found';
    END IF;
END $$;

CREATE TEMP TABLE account_number_migration (
    user_id BIGINT PRIMARY KEY,
    old_account_number VARCHAR(20) NOT NULL UNIQUE,
    new_account_number VARCHAR(6) NOT NULL UNIQUE
) ON COMMIT DROP;

INSERT INTO account_number_migration (user_id, old_account_number, new_account_number)
SELECT
    id,
    account_number,
    LPAD(RIGHT(account_number, 6), 6, '0')
FROM users;

DO $$
BEGIN
    IF EXISTS (
        SELECT new_account_number
        FROM account_number_migration
        GROUP BY new_account_number
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION 'Six-digit account migration refused: account suffix collision found';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM account_number_migration
        WHERE new_account_number = '000000'
    ) THEN
        RAISE EXCEPTION 'Six-digit account migration refused: reserved account 000000 found';
    END IF;
END $$;

CREATE TABLE account_number_aliases (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    account_number VARCHAR(20) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT check_account_number_alias_format CHECK (account_number ~ '^[0-9]+$')
);

INSERT INTO account_number_aliases (user_id, account_number)
SELECT user_id, old_account_number
FROM account_number_migration
WHERE old_account_number <> new_account_number;

UPDATE users user_record
SET account_number = 'MIG' || LPAD(user_record.id::TEXT, 12, '0')
FROM account_number_migration mapping
WHERE user_record.id = mapping.user_id
  AND mapping.old_account_number <> mapping.new_account_number;

UPDATE users user_record
SET account_number = mapping.new_account_number
FROM account_number_migration mapping
WHERE user_record.id = mapping.user_id;

ALTER TABLE users
    ADD CONSTRAINT check_account_number_format
    CHECK (account_number ~ '^[0-9]{6}$' AND account_number <> '000000');

ALTER TABLE users ALTER COLUMN ispb DROP DEFAULT;
UPDATE users SET ispb = NULL WHERE ispb IS NOT NULL;

COMMENT ON COLUMN users.ispb IS
    'Legacy compatibility field. Bravus user routing uses Cayman internal routing and SWIFT metadata.';

CREATE OR REPLACE FUNCTION prevent_account_number_alias_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Account number aliases are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER account_number_aliases_immutable
BEFORE UPDATE OR DELETE ON account_number_aliases
FOR EACH ROW EXECUTE FUNCTION prevent_account_number_alias_mutation();
