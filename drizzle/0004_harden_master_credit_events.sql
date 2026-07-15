DROP TABLE IF EXISTS `bravus_master_credit_events_v2`;
--> statement-breakpoint
CREATE TABLE `bravus_master_credit_events_v2` (
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
INSERT INTO `bravus_master_credit_events_v2` (
  `id`, `reserve_code`, `grant_id`, `event_type`, `account_username`,
  `amount_centavos`, `actor`, `assessment_reason`, `eligibility_rule`,
  `idempotency_hash`, `created_at`
)
SELECT
  `id`, `reserve_code`, `grant_id`, `event_type`, `account_username`,
  `amount_centavos`, `actor`, `assessment_reason`, `eligibility_rule`,
  `idempotency_hash`, `created_at`
FROM `bravus_master_credit_events`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `bravus_master_credit_events_no_update`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `bravus_master_credit_events_no_delete`;
--> statement-breakpoint
DROP TABLE `bravus_master_credit_events`;
--> statement-breakpoint
ALTER TABLE `bravus_master_credit_events_v2` RENAME TO `bravus_master_credit_events`;
--> statement-breakpoint
CREATE TRIGGER `bravus_master_credit_events_no_update`
BEFORE UPDATE ON `bravus_master_credit_events`
BEGIN
  SELECT RAISE(ABORT, 'Master credit events are immutable');
END;
--> statement-breakpoint
CREATE TRIGGER `bravus_master_credit_events_no_delete`
BEFORE DELETE ON `bravus_master_credit_events`
BEGIN
  SELECT RAISE(ABORT, 'Master credit events are immutable');
END;
