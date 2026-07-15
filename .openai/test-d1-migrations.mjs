import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";

const database = new DatabaseSync(":memory:");
const migration = async (path, target = database) => {
  const sql = await readFile(path, "utf8");
  for (const statement of sql.split("--> statement-breakpoint")) {
    if (statement.trim()) target.exec(statement);
  }
};

await migration("drizzle/0000_bravus_durable_state.sql");
database.prepare(`
  INSERT INTO bravus_biometric_evidence
    (id, kind, owner_username, mime, ciphertext, iv, sha256, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`).run("legacy-face", "ENROLLED_FACE", "legacy.user", "image/png", "cipher", "iv", "sha", "2026-01-01T00:00:00Z");

await migration("drizzle/0001_expand_kyc_evidence.sql");
assert.equal(database.prepare("SELECT COUNT(*) AS count FROM bravus_biometric_evidence").get().count, 1);
database.prepare(`
  INSERT INTO bravus_biometric_evidence
    (id, kind, owner_username, mime, ciphertext, iv, sha256, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`).run("document-front", "KYC_DOCUMENT_FRONT", "new.user", "image/png", "cipher2", "iv2", "sha2", "2026-01-02T00:00:00Z");
database.prepare(`
  INSERT INTO bravus_biometric_evidence
    (id, kind, owner_username, mime, ciphertext, iv, sha256, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`).run("document-back", "KYC_DOCUMENT_BACK", "new.user", "image/png", "cipher3", "iv3", "sha3", "2026-01-02T00:00:00Z");

database.prepare(`
  INSERT INTO bravus_kyc_audit
    (id, username, actor, from_status, to_status, reason, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`).run("audit-1", "new.user", "admin", "PENDENTE_VALIDACAO_IDENTIDADE", "APROVADO_IDENTIDADE", "Revisao documental concluida.", "2026-01-02T00:00:00Z");

assert.throws(() => database.prepare("DELETE FROM bravus_biometric_evidence WHERE id = ?").run("legacy-face"), /immutable/i);
assert.throws(() => database.prepare("UPDATE bravus_kyc_audit SET reason = ? WHERE id = ?").run("alterado", "audit-1"), /immutable/i);
assert.equal(database.prepare("SELECT COUNT(*) AS count FROM bravus_kyc_audit").get().count, 1);

const journal = JSON.parse(await readFile("drizzle/meta/_journal.json", "utf8"));
assert.equal(journal.entries.some((entry) => entry.tag === "0002_institutional_reserve"), true);
await migration("drizzle/0002_institutional_reserve.sql");
await migration("drizzle/0002_institutional_reserve.sql");
const reserve = database.prepare("SELECT * FROM bravus_institutional_reserve WHERE code = ?")
  .get("BRAVUS_INSTITUTIONAL_RESERVE");
assert.equal(reserve.amount_centavos, "100000000000000000");
assert.equal(reserve.status, "DECLARED");
assert.equal(reserve.customer_funds, 0);
assert.equal(reserve.transferable, 0);
assert.equal(BigInt(reserve.amount_centavos) > BigInt(Number.MAX_SAFE_INTEGER), true);
assert.equal(database.prepare("SELECT COUNT(*) AS count FROM bravus_institutional_reserve_audit").get().count, 1);
assert.throws(
  () => database.prepare("UPDATE bravus_institutional_reserve SET amount_centavos = ? WHERE code = ?")
    .run("1", "BRAVUS_INSTITUTIONAL_RESERVE"),
  /immutable/i,
);
assert.throws(
  () => database.prepare("DELETE FROM bravus_institutional_reserve_audit WHERE id = ?").run("reserve-declaration-v1"),
  /immutable/i,
);
database.prepare(`
  INSERT INTO bravus_account_provisioning_audit
    (id, account_username, subject_hash, actor, event_type, created_at)
  VALUES (?, ?, ?, ?, ?, ?)
`).run("provision-audit-1", "new.user", "subject-hash", "admin", "ACCOUNT_PROVISIONED_PENDING_IDENTITY", "2026-01-02T00:00:00Z");
assert.throws(
  () => database.prepare("DELETE FROM bravus_account_provisioning_audit WHERE id = ?").run("provision-audit-1"),
  /immutable/i,
);

assert.equal(journal.entries.some((entry) => entry.tag === "0003_master_credit_reserve"), true);
await migration("drizzle/0003_master_credit_reserve.sql");
await migration("drizzle/0003_master_credit_reserve.sql");
assert.equal(journal.entries.some((entry) => entry.tag === "0004_harden_master_credit_events"), true);
await migration("drizzle/0004_harden_master_credit_events.sql");
await migration("drizzle/0004_harden_master_credit_events.sql");
const masterReserve = database.prepare("SELECT * FROM bravus_master_credit_reserve WHERE code = ?")
  .get("BRAVUS_MASTER_CREDIT_RESERVE");
assert.equal(masterReserve.total_amount_centavos, "100000000000000000");
assert.equal(masterReserve.classification, "MASTER_BOOK_CREDIT");
assert.equal(masterReserve.status, "ACTIVE");
assert.equal(masterReserve.transfer_scope, "ADMIN_APPROVED_CUSTOMERS");
assert.equal(masterReserve.admin_only, 1);
assert.equal(database.prepare("SELECT COUNT(*) AS count FROM bravus_master_credit_events").get().count, 1);
const insertMasterEvent = database.prepare(`
  INSERT INTO bravus_master_credit_events
    (id, reserve_code, grant_id, event_type, account_username, amount_centavos, actor,
     assessment_reason, eligibility_rule, idempotency_hash, created_at)
  VALUES (?, 'BRAVUS_MASTER_CREDIT_RESERVE', ?, ?, ?, ?, 'admin', 'avaliacao', 'regra', ?, '2026-01-02T00:00:00Z')
`);
assert.throws(
  () => insertMasterEvent.run("invalid-zero", "grant-zero", "GRANT_CREATED", "new.user", "0", "hash-zero"),
  /constraint/i,
);
assert.throws(
  () => insertMasterEvent.run("invalid-activation", "grant-linked", "RESERVE_ACTIVATED", "new.user", "1", "hash-activation"),
  /constraint/i,
);
assert.throws(
  () => insertMasterEvent.run(
    "invalid-idempotency", "grant-duplicate-hash", "GRANT_CREATED", "new.user", "1",
    "9b210dda96d850f85bcd09a80d5e6b988b66593860b141d4bb688195c0abd022",
  ),
  /unique/i,
);
assert.throws(
  () => database.prepare("UPDATE bravus_master_credit_reserve SET total_amount_centavos = ? WHERE code = ?")
    .run("1", "BRAVUS_MASTER_CREDIT_RESERVE"),
  /immutable/i,
);
assert.throws(
  () => database.prepare("DELETE FROM bravus_master_credit_events WHERE id = ?").run("master-credit-reserve-activation-v1"),
  /immutable/i,
);

function createLegacyMasterDatabase(amountCentavos) {
  const target = new DatabaseSync(":memory:");
  target.exec(`
    CREATE TABLE bravus_master_credit_reserve (
      code TEXT PRIMARY KEY NOT NULL
    );
    INSERT INTO bravus_master_credit_reserve (code) VALUES ('BRAVUS_MASTER_CREDIT_RESERVE');
    CREATE TABLE bravus_master_credit_events (
      id TEXT PRIMARY KEY NOT NULL,
      reserve_code TEXT NOT NULL,
      grant_id TEXT,
      event_type TEXT NOT NULL CHECK (event_type IN ('RESERVE_ACTIVATED', 'GRANT_CREATED', 'GRANT_RELEASED')),
      account_username TEXT,
      amount_centavos TEXT NOT NULL CHECK (
        length(amount_centavos) BETWEEN 1 AND 40
        AND amount_centavos NOT GLOB '*[^0-9]*'
      ),
      actor TEXT NOT NULL,
      assessment_reason TEXT NOT NULL,
      eligibility_rule TEXT,
      idempotency_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TRIGGER bravus_master_credit_events_no_update
    BEFORE UPDATE ON bravus_master_credit_events
    BEGIN SELECT RAISE(ABORT, 'Master credit events are immutable'); END;
    CREATE TRIGGER bravus_master_credit_events_no_delete
    BEFORE DELETE ON bravus_master_credit_events
    BEGIN SELECT RAISE(ABORT, 'Master credit events are immutable'); END;
  `);
  target.prepare(`
    INSERT INTO bravus_master_credit_events (
      id, reserve_code, grant_id, event_type, account_username, amount_centavos,
      actor, assessment_reason, eligibility_rule, idempotency_hash, created_at
    ) VALUES (
      'legacy-activation', 'BRAVUS_MASTER_CREDIT_RESERVE', NULL, 'RESERVE_ACTIVATED', NULL,
      ?, 'OWNER_CONFIGURATION', 'ativacao legada', 'regra legada',
      'legacy-activation-hash', '2026-01-01T00:00:00Z'
    )
  `).run(amountCentavos);
  return target;
}

const invalidLegacyMasterDatabase = createLegacyMasterDatabase("0");
await assert.rejects(
  () => migration("drizzle/0004_harden_master_credit_events.sql", invalidLegacyMasterDatabase),
  /constraint/i,
);
assert.equal(invalidLegacyMasterDatabase.prepare("SELECT COUNT(*) AS count FROM bravus_master_credit_events").get().count, 1);
assert.throws(
  () => invalidLegacyMasterDatabase.prepare("UPDATE bravus_master_credit_events SET actor = 'changed'").run(),
  /immutable/i,
);
assert.throws(
  () => invalidLegacyMasterDatabase.prepare("DELETE FROM bravus_master_credit_events").run(),
  /immutable/i,
);
invalidLegacyMasterDatabase.close();

const legacyMasterDatabase = createLegacyMasterDatabase("100000000000000000");
await migration("drizzle/0004_harden_master_credit_events.sql", legacyMasterDatabase);
await migration("drizzle/0004_harden_master_credit_events.sql", legacyMasterDatabase);
assert.equal(legacyMasterDatabase.prepare("SELECT COUNT(*) AS count FROM bravus_master_credit_events").get().count, 1);
const legacyInsertMasterEvent = legacyMasterDatabase.prepare(`
  INSERT INTO bravus_master_credit_events
    (id, reserve_code, grant_id, event_type, account_username, amount_centavos, actor,
     assessment_reason, eligibility_rule, idempotency_hash, created_at)
  VALUES (?, 'BRAVUS_MASTER_CREDIT_RESERVE', ?, 'GRANT_CREATED', 'legacy.user', ?,
    'admin', 'avaliacao', 'regra', ?, '2026-01-02T00:00:00Z')
`);
assert.throws(
  () => legacyInsertMasterEvent.run("legacy-invalid-zero", "legacy-zero", "0", "legacy-zero-hash"),
  /constraint/i,
);
legacyInsertMasterEvent.run("legacy-valid", "legacy-valid-grant", "1", "legacy-unique-hash");
assert.throws(
  () => legacyInsertMasterEvent.run("legacy-duplicate", "legacy-duplicate-grant", "1", "legacy-unique-hash"),
  /unique/i,
);
assert.throws(
  () => legacyMasterDatabase.prepare("UPDATE bravus_master_credit_events SET actor = 'changed' WHERE id = 'legacy-valid'").run(),
  /immutable/i,
);
legacyMasterDatabase.close();

database.close();
console.log(JSON.stringify({
  result: "ok",
  legacyEvidencePreserved: true,
  expandedEvidenceKindsAccepted: true,
  immutableKycAuditVerified: true,
  institutionalReservePersistedAsText: true,
  immutableInstitutionalReserveAuditVerified: true,
  journalDiscoveryVerified: true,
  idempotentMigrationVerified: true,
  immutableAccountProvisioningAuditVerified: true,
  masterCreditReserveVerified: true,
  immutableMasterCreditEventsVerified: true,
  masterCreditEventConstraintsVerified: true,
  legacyMasterCreditSchemaUpgradeVerified: true,
  invalidLegacyUpgradePreservesImmutability: true,
}));
