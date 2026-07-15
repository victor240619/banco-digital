DROP TRIGGER IF EXISTS `bravus_biometric_evidence_no_update`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `bravus_biometric_evidence_no_delete`;
--> statement-breakpoint
CREATE TABLE `bravus_biometric_evidence_v2` (
  `id` text PRIMARY KEY NOT NULL,
  `kind` text NOT NULL CHECK (`kind` IN (
    'ENROLLED_FACE',
    'PASSWORD_RESET_FACE',
    'KYC_DOCUMENT_FRONT',
    'KYC_DOCUMENT_BACK'
  )),
  `owner_username` text NOT NULL,
  `mime` text NOT NULL,
  `ciphertext` text NOT NULL,
  `iv` text NOT NULL,
  `sha256` text NOT NULL,
  `created_at` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `bravus_biometric_evidence_v2` (
  `id`, `kind`, `owner_username`, `mime`, `ciphertext`, `iv`, `sha256`, `created_at`
)
SELECT `id`, `kind`, `owner_username`, `mime`, `ciphertext`, `iv`, `sha256`, `created_at`
FROM `bravus_biometric_evidence`;
--> statement-breakpoint
DROP TABLE `bravus_biometric_evidence`;
--> statement-breakpoint
ALTER TABLE `bravus_biometric_evidence_v2` RENAME TO `bravus_biometric_evidence`;
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
--> statement-breakpoint
CREATE TABLE `bravus_kyc_audit` (
  `id` text PRIMARY KEY NOT NULL,
  `username` text NOT NULL,
  `actor` text NOT NULL,
  `from_status` text NOT NULL,
  `to_status` text NOT NULL,
  `reason` text NOT NULL,
  `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `bravus_kyc_audit_username_created_idx`
  ON `bravus_kyc_audit` (`username`, `created_at`);
--> statement-breakpoint
CREATE TRIGGER `bravus_kyc_audit_no_update`
BEFORE UPDATE ON `bravus_kyc_audit`
BEGIN
  SELECT RAISE(ABORT, 'KYC audit entries are immutable');
END;
--> statement-breakpoint
CREATE TRIGGER `bravus_kyc_audit_no_delete`
BEFORE DELETE ON `bravus_kyc_audit`
BEGIN
  SELECT RAISE(ABORT, 'KYC audit entries are immutable');
END;
