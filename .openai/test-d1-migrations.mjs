import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";

const database = new DatabaseSync(":memory:");
const migration = async (path) => {
  const sql = await readFile(path, "utf8");
  for (const statement of sql.split("--> statement-breakpoint")) {
    if (statement.trim()) database.exec(statement);
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
}));
