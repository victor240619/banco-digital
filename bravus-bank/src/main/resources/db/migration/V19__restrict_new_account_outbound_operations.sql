-- Preserve existing accounts and require review for accounts created after this migration.
ALTER TABLE users ADD COLUMN outbound_operations_enabled BOOLEAN;
UPDATE users SET outbound_operations_enabled = TRUE;
ALTER TABLE users ALTER COLUMN outbound_operations_enabled SET DEFAULT FALSE;
ALTER TABLE users ALTER COLUMN outbound_operations_enabled SET NOT NULL;
