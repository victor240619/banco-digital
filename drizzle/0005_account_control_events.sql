CREATE TABLE IF NOT EXISTS bravus_account_control_events (
  id text PRIMARY KEY NOT NULL,
  account_username text NOT NULL,
  event_type text NOT NULL CHECK (event_type IN (
    'PROFILE_UPDATED',
    'ACCOUNT_BLOCKED',
    'ACCOUNT_UNBLOCKED',
    'BALANCE_HOLD_PLACED',
    'BALANCE_HOLD_RELEASED',
    'PASSWORD_RESET_BY_ADMIN'
  )),
  hold_id text,
  amount_centavos text NOT NULL CHECK (
    length(amount_centavos) BETWEEN 1 AND 40
    AND amount_centavos NOT GLOB '*[^0-9]*'
    AND (amount_centavos = '0' OR substr(amount_centavos, 1, 1) <> '0')
  ),
  actor text NOT NULL,
  reason text NOT NULL,
  metadata_hash text NOT NULL,
  idempotency_hash text NOT NULL UNIQUE,
  created_at text NOT NULL,
  CHECK (
    (event_type IN ('BALANCE_HOLD_PLACED', 'BALANCE_HOLD_RELEASED')
      AND hold_id IS NOT NULL
      AND amount_centavos <> '0')
    OR
    (event_type NOT IN ('BALANCE_HOLD_PLACED', 'BALANCE_HOLD_RELEASED')
      AND hold_id IS NULL)
  )
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS bravus_account_control_events_username_created_idx
ON bravus_account_control_events (account_username, created_at);
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS bravus_account_control_events_no_update
BEFORE UPDATE ON bravus_account_control_events
BEGIN
  SELECT RAISE(ABORT, 'Account control events are immutable');
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS bravus_account_control_events_no_delete
BEFORE DELETE ON bravus_account_control_events
BEGIN
  SELECT RAISE(ABORT, 'Account control events are immutable');
END;
