-- Prevent ambiguous routing between current six-digit accounts and immutable legacy aliases.

CREATE OR REPLACE FUNCTION prevent_account_number_cross_collision()
RETURNS TRIGGER AS $$
BEGIN
    -- Serialize the same routing number across both tables, including concurrent transactions.
    PERFORM pg_advisory_xact_lock(hashtextextended('bravus-account:' || NEW.account_number, 0));

    IF TG_TABLE_NAME = 'users' THEN
        IF EXISTS (
            SELECT 1
            FROM account_number_aliases alias
            WHERE alias.account_number = NEW.account_number
        ) THEN
            RAISE EXCEPTION 'Account number is already reserved as a legacy alias';
        END IF;
    ELSE
        IF EXISTS (
            SELECT 1
            FROM users user_record
            WHERE user_record.account_number = NEW.account_number
        ) THEN
            RAISE EXCEPTION 'Legacy alias conflicts with a current account number';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_account_number_cross_collision
BEFORE INSERT OR UPDATE OF account_number ON users
FOR EACH ROW EXECUTE FUNCTION prevent_account_number_cross_collision();

CREATE TRIGGER account_number_aliases_cross_collision
BEFORE INSERT ON account_number_aliases
FOR EACH ROW EXECUTE FUNCTION prevent_account_number_cross_collision();
