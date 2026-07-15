CREATE TABLE IF NOT EXISTS `bravus_institutional_reserve` (
  `code` text PRIMARY KEY NOT NULL,
  `currency` text NOT NULL CHECK (`currency` = 'BRL'),
  `amount_centavos` text NOT NULL CHECK (
    length(`amount_centavos`) BETWEEN 1 AND 40
    AND `amount_centavos` NOT GLOB '*[^0-9]*'
  ),
  `classification` text NOT NULL CHECK (`classification` = 'INSTITUTIONAL'),
  `status` text NOT NULL CHECK (`status` IN ('DECLARED', 'VERIFIED', 'SUSPENDED')),
  `customer_funds` integer NOT NULL CHECK (`customer_funds` = 0),
  `transferable` integer NOT NULL CHECK (`transferable` = 0),
  `source_reference` text NOT NULL,
  `policy_version` integer NOT NULL CHECK (`policy_version` >= 1),
  `payload_hash` text NOT NULL,
  `declared_at` text NOT NULL
);
--> statement-breakpoint
INSERT OR IGNORE INTO `bravus_institutional_reserve` (
  `code`, `currency`, `amount_centavos`, `classification`, `status`,
  `customer_funds`, `transferable`, `source_reference`, `policy_version`,
  `payload_hash`, `declared_at`
) VALUES (
  'BRAVUS_INSTITUTIONAL_RESERVE', 'BRL', '100000000000000000',
  'INSTITUTIONAL', 'DECLARED', 0, 0, 'OWNER_DECLARATION', 1,
  '15fd35def62b676d26bea6568134e5dd059000d2998edd60ec3a2e0992f3e2fa',
  '2026-07-15T00:00:00-03:00'
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `bravus_institutional_reserve_audit` (
  `id` text PRIMARY KEY NOT NULL,
  `reserve_code` text NOT NULL,
  `event_type` text NOT NULL CHECK (`event_type` IN ('RESERVE_DECLARED', 'RESERVE_VERIFIED', 'RESERVE_SUSPENDED')),
  `amount_centavos` text NOT NULL,
  `status` text NOT NULL,
  `actor` text NOT NULL,
  `reason` text NOT NULL,
  `payload_hash` text NOT NULL,
  `created_at` text NOT NULL,
  FOREIGN KEY (`reserve_code`) REFERENCES `bravus_institutional_reserve` (`code`)
);
--> statement-breakpoint
INSERT OR IGNORE INTO `bravus_institutional_reserve_audit` (
  `id`, `reserve_code`, `event_type`, `amount_centavos`, `status`,
  `actor`, `reason`, `payload_hash`, `created_at`
) VALUES (
  'reserve-declaration-v1', 'BRAVUS_INSTITUTIONAL_RESERVE', 'RESERVE_DECLARED',
  '100000000000000000', 'DECLARED', 'OWNER_CONFIGURATION',
  'Reserva institucional declarada; nao representa saldo de cliente nem prova de lastro externo.',
  '15fd35def62b676d26bea6568134e5dd059000d2998edd60ec3a2e0992f3e2fa',
  '2026-07-15T00:00:00-03:00'
);
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `bravus_institutional_reserve_no_update`
BEFORE UPDATE ON `bravus_institutional_reserve`
BEGIN
  SELECT RAISE(ABORT, 'Institutional reserve is immutable; use an audited migration');
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `bravus_institutional_reserve_no_delete`
BEFORE DELETE ON `bravus_institutional_reserve`
BEGIN
  SELECT RAISE(ABORT, 'Institutional reserve is immutable');
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `bravus_institutional_reserve_audit_no_update`
BEFORE UPDATE ON `bravus_institutional_reserve_audit`
BEGIN
  SELECT RAISE(ABORT, 'Institutional reserve audit is immutable');
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `bravus_institutional_reserve_audit_no_delete`
BEFORE DELETE ON `bravus_institutional_reserve_audit`
BEGIN
  SELECT RAISE(ABORT, 'Institutional reserve audit is immutable');
END;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `bravus_account_provisioning_audit` (
  `id` text PRIMARY KEY NOT NULL,
  `account_username` text NOT NULL,
  `subject_hash` text NOT NULL,
  `actor` text NOT NULL,
  `event_type` text NOT NULL CHECK (`event_type` = 'ACCOUNT_PROVISIONED_PENDING_IDENTITY'),
  `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `bravus_account_provisioning_audit_no_update`
BEFORE UPDATE ON `bravus_account_provisioning_audit`
BEGIN
  SELECT RAISE(ABORT, 'Account provisioning audit is immutable');
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `bravus_account_provisioning_audit_no_delete`
BEFORE DELETE ON `bravus_account_provisioning_audit`
BEGIN
  SELECT RAISE(ABORT, 'Account provisioning audit is immutable');
END;
