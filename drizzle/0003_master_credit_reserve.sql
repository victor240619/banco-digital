CREATE TABLE IF NOT EXISTS `bravus_master_credit_reserve` (
  `code` text PRIMARY KEY NOT NULL,
  `currency` text NOT NULL CHECK (`currency` = 'BRL'),
  `total_amount_centavos` text NOT NULL CHECK (
    length(`total_amount_centavos`) BETWEEN 1 AND 40
    AND `total_amount_centavos` NOT GLOB '*[^0-9]*'
  ),
  `classification` text NOT NULL CHECK (`classification` = 'MASTER_BOOK_CREDIT'),
  `status` text NOT NULL CHECK (`status` = 'ACTIVE'),
  `transfer_scope` text NOT NULL CHECK (`transfer_scope` = 'ADMIN_APPROVED_CUSTOMERS'),
  `admin_only` integer NOT NULL CHECK (`admin_only` = 1),
  `policy_version` integer NOT NULL CHECK (`policy_version` >= 1),
  `payload_hash` text NOT NULL,
  `activated_at` text NOT NULL
);
--> statement-breakpoint
INSERT OR IGNORE INTO `bravus_master_credit_reserve` (
  `code`, `currency`, `total_amount_centavos`, `classification`, `status`,
  `transfer_scope`, `admin_only`, `policy_version`, `payload_hash`, `activated_at`
) VALUES (
  'BRAVUS_MASTER_CREDIT_RESERVE', 'BRL', '100000000000000000',
  'MASTER_BOOK_CREDIT', 'ACTIVE', 'ADMIN_APPROVED_CUSTOMERS', 1, 1,
  '9b210dda96d850f85bcd09a80d5e6b988b66593860b141d4bb688195c0abd022',
  '2026-07-15T00:00:00-03:00'
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `bravus_master_credit_events` (
  `id` text PRIMARY KEY NOT NULL,
  `reserve_code` text NOT NULL,
  `grant_id` text,
  `event_type` text NOT NULL CHECK (`event_type` IN ('RESERVE_ACTIVATED', 'GRANT_CREATED', 'GRANT_RELEASED')),
  `account_username` text,
  `amount_centavos` text NOT NULL CHECK (
    length(`amount_centavos`) BETWEEN 1 AND 40
    AND `amount_centavos` NOT GLOB '*[^0-9]*'
    AND `amount_centavos` <> '0'
    AND substr(`amount_centavos`, 1, 1) <> '0'
  ),
  `actor` text NOT NULL,
  `assessment_reason` text NOT NULL,
  `eligibility_rule` text,
  `idempotency_hash` text NOT NULL,
  `created_at` text NOT NULL,
  FOREIGN KEY (`reserve_code`) REFERENCES `bravus_master_credit_reserve` (`code`),
  UNIQUE (`grant_id`, `event_type`),
  UNIQUE (`idempotency_hash`),
  CHECK (
    (`event_type` = 'RESERVE_ACTIVATED' AND `grant_id` IS NULL AND `account_username` IS NULL)
    OR
    (`event_type` IN ('GRANT_CREATED', 'GRANT_RELEASED') AND `grant_id` IS NOT NULL AND `account_username` IS NOT NULL)
  )
);
--> statement-breakpoint
INSERT OR IGNORE INTO `bravus_master_credit_events` (
  `id`, `reserve_code`, `grant_id`, `event_type`, `account_username`,
  `amount_centavos`, `actor`, `assessment_reason`, `eligibility_rule`,
  `idempotency_hash`, `created_at`
) VALUES (
  'master-credit-reserve-activation-v1', 'BRAVUS_MASTER_CREDIT_RESERVE', NULL,
  'RESERVE_ACTIVATED', NULL, '100000000000000000', 'OWNER_CONFIGURATION',
  'Reserva mestre de credito escritural ativada para concessoes administrativas avaliadas.',
  'KYC aprovado e avaliacao administrativa registrada.',
  '9b210dda96d850f85bcd09a80d5e6b988b66593860b141d4bb688195c0abd022',
  '2026-07-15T00:00:00-03:00'
);
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `bravus_master_credit_reserve_no_update`
BEFORE UPDATE ON `bravus_master_credit_reserve`
BEGIN
  SELECT RAISE(ABORT, 'Master credit reserve is immutable; use audited grant events');
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `bravus_master_credit_reserve_no_delete`
BEFORE DELETE ON `bravus_master_credit_reserve`
BEGIN
  SELECT RAISE(ABORT, 'Master credit reserve is immutable');
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `bravus_master_credit_events_no_update`
BEFORE UPDATE ON `bravus_master_credit_events`
BEGIN
  SELECT RAISE(ABORT, 'Master credit events are immutable');
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `bravus_master_credit_events_no_delete`
BEFORE DELETE ON `bravus_master_credit_events`
BEGIN
  SELECT RAISE(ABORT, 'Master credit events are immutable');
END;
