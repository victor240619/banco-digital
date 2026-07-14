import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const bravusState = sqliteTable("bravus_state", {
  id: integer("id").primaryKey(),
  revision: integer("revision").notNull(),
  payload: text("payload").notNull(),
  payloadHash: text("payload_hash").notNull(),
  sourceCapturedAt: text("source_captured_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const bravusStateAudit = sqliteTable("bravus_state_audit", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  revision: integer("revision").notNull(),
  requestId: text("request_id").notNull(),
  method: text("method").notNull(),
  path: text("path").notNull(),
  actor: text("actor").notNull(),
  previousHash: text("previous_hash").notNull(),
  payloadHash: text("payload_hash").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => ({
  revisionUnique: uniqueIndex("bravus_state_audit_revision_unique").on(table.revision),
}));

export const bravusLedgerEntries = sqliteTable("bravus_ledger_entries", {
  transferId: text("transfer_id").notNull(),
  entryType: text("entry_type").notNull(),
  orderId: integer("order_id"),
  accountUsername: text("account_username"),
  accountNumber: text("account_number").notNull(),
  signedAmountCentavos: integer("signed_amount_centavos").notNull(),
  currency: text("currency").notNull(),
  reason: text("reason").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => ({
  transferSideUnique: uniqueIndex("bravus_ledger_transfer_side_unique")
    .on(table.transferId, table.entryType),
}));

export const bravusBiometricEvidence = sqliteTable("bravus_biometric_evidence", {
  id: text("id").primaryKey(),
  kind: text("kind").notNull(),
  ownerUsername: text("owner_username").notNull(),
  mime: text("mime").notNull(),
  ciphertext: text("ciphertext").notNull(),
  iv: text("iv").notNull(),
  sha256: text("sha256").notNull(),
  createdAt: text("created_at").notNull(),
});
