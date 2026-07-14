CREATE TABLE `bravus_state` (
  `id` integer PRIMARY KEY NOT NULL CHECK (`id` = 1),
  `revision` integer NOT NULL CHECK (`revision` >= 1),
  `payload` text NOT NULL,
  `payload_hash` text NOT NULL,
  `source_captured_at` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `bravus_state_audit` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `revision` integer NOT NULL,
  `request_id` text NOT NULL,
  `method` text NOT NULL,
  `path` text NOT NULL,
  `actor` text NOT NULL,
  `previous_hash` text NOT NULL,
  `payload_hash` text NOT NULL,
  `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bravus_state_audit_revision_unique`
  ON `bravus_state_audit` (`revision`);
--> statement-breakpoint
CREATE TABLE `bravus_ledger_entries` (
  `transfer_id` text NOT NULL,
  `entry_type` text NOT NULL CHECK (`entry_type` IN ('debit', 'credit')),
  `order_id` integer,
  `account_username` text,
  `account_number` text NOT NULL,
  `signed_amount_centavos` integer NOT NULL,
  `currency` text NOT NULL DEFAULT 'BRL',
  `reason` text NOT NULL,
  `created_at` text NOT NULL,
  PRIMARY KEY (`transfer_id`, `entry_type`),
  CHECK (
    (`entry_type` = 'debit' AND `signed_amount_centavos` < 0)
    OR (`entry_type` = 'credit' AND `signed_amount_centavos` > 0)
  )
);
--> statement-breakpoint
CREATE TABLE `bravus_biometric_evidence` (
  `id` text PRIMARY KEY NOT NULL,
  `kind` text NOT NULL CHECK (`kind` IN ('ENROLLED_FACE', 'PASSWORD_RESET_FACE')),
  `owner_username` text NOT NULL,
  `mime` text NOT NULL,
  `ciphertext` text NOT NULL,
  `iv` text NOT NULL,
  `sha256` text NOT NULL,
  `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TRIGGER `bravus_ledger_entries_no_update`
BEFORE UPDATE ON `bravus_ledger_entries`
BEGIN
  SELECT RAISE(ABORT, 'Ledger entries are immutable; create a compensating entry');
END;
--> statement-breakpoint
CREATE TRIGGER `bravus_ledger_entries_no_delete`
BEFORE DELETE ON `bravus_ledger_entries`
BEGIN
  SELECT RAISE(ABORT, 'Ledger entries are immutable; create a compensating entry');
END;
--> statement-breakpoint
CREATE TRIGGER `bravus_state_audit_no_update`
BEFORE UPDATE ON `bravus_state_audit`
BEGIN
  SELECT RAISE(ABORT, 'State audit entries are immutable');
END;
--> statement-breakpoint
CREATE TRIGGER `bravus_state_audit_no_delete`
BEFORE DELETE ON `bravus_state_audit`
BEGIN
  SELECT RAISE(ABORT, 'State audit entries are immutable');
END;
--> statement-breakpoint
CREATE TRIGGER `bravus_biometric_evidence_no_update`
BEFORE UPDATE ON `bravus_biometric_evidence`
BEGIN
  SELECT RAISE(ABORT, 'Biometric evidence is immutable');
END;
--> statement-breakpoint
CREATE TRIGGER `bravus_biometric_evidence_no_delete`
BEFORE DELETE ON `bravus_biometric_evidence`
BEGIN
  SELECT RAISE(ABORT, 'Biometric evidence is immutable');
END;
