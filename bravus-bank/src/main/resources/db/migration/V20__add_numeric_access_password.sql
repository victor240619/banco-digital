ALTER TABLE users
    ADD COLUMN IF NOT EXISTS numeric_access_password VARCHAR(255);
