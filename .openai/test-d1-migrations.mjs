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

database.close();
console.log(JSON.stringify({
  result: "ok",
  legacyEvidencePreserved: true,
  expandedEvidenceKindsAccepted: true,
  immutableKycAuditVerified: true,
}));
