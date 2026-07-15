import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { join } from "node:path";
import { tmpdir } from "node:os";

class FakeStatement {
  constructor(database, sql, bindings = []) {
    this.database = database;
    this.sql = sql.replace(/\s+/g, " ").trim();
    this.bindings = bindings;
  }

  bind(...bindings) {
    return new FakeStatement(this.database, this.sql, bindings);
  }

  async first() {
    if (this.sql.startsWith("SELECT revision, payload, payload_hash, updated_at FROM bravus_state")) {
      return this.database.stateRow ? structuredClone(this.database.stateRow) : null;
    }
    if (this.sql.startsWith("SELECT id, kind, mime, ciphertext, iv FROM bravus_biometric_evidence")) {
      const evidence = this.database.biometricEvidence.get(this.bindings[0]);
      return evidence ? structuredClone(evidence) : null;
    }
    if (this.sql.startsWith("SELECT sql FROM sqlite_master") && this.sql.includes("bravus_master_credit_events")) {
      return { sql: "CREATE TABLE bravus_master_credit_events (grant_id TEXT, event_type TEXT, account_username TEXT, amount_centavos TEXT CHECK (amount_centavos <> '0'), idempotency_hash TEXT NOT NULL UNIQUE, UNIQUE (grant_id, event_type), CHECK (event_type = 'RESERVE_ACTIVATED' AND grant_id IS NULL AND account_username IS NULL))" };
    }
    if (this.sql.startsWith("SELECT sql FROM sqlite_master")) {
      return { sql: "CREATE TABLE bravus_biometric_evidence (kind TEXT CHECK (kind IN ('ENROLLED_FACE','PASSWORD_RESET_FACE','KYC_DOCUMENT_FRONT','KYC_DOCUMENT_BACK')))" };
    }
    if (this.sql.startsWith("SELECT COUNT(*) AS count FROM bravus_kyc_audit")) {
      return { count: this.database.kycAudits.size };
    }
    if (this.sql.startsWith("SELECT COUNT(*) AS count FROM bravus_institutional_reserve_audit")) {
      return { count: this.database.institutionalReserveAudits.size };
    }
    if (this.sql.startsWith("SELECT COUNT(*) AS count FROM bravus_account_provisioning_audit")) {
      return { count: this.database.accountProvisioningAudits.size };
    }
    if (this.sql.startsWith("SELECT COUNT(*) AS count FROM bravus_master_credit_events")) {
      return { count: this.database.masterCreditEvents.size };
    }
    if (this.sql.startsWith("SELECT COUNT(*) AS count FROM bravus_account_control_events")) {
      return { count: this.database.accountControlEvents.size };
    }
    if (this.sql.startsWith("SELECT code, currency, amount_centavos, classification, status, customer_funds, transferable, source_reference, policy_version, payload_hash, declared_at FROM bravus_institutional_reserve")) {
      return this.database.institutionalReserve ? structuredClone(this.database.institutionalReserve) : null;
    }
    if (this.sql.startsWith("SELECT code, currency, total_amount_centavos, classification, status, transfer_scope, admin_only, policy_version, payload_hash, activated_at FROM bravus_master_credit_reserve")) {
      return this.database.masterCreditReserve ? structuredClone(this.database.masterCreditReserve) : null;
    }
    throw new Error("Unsupported D1 first(): " + this.sql);
  }

  async all() {
    if (this.sql.startsWith("SELECT grant_id, event_type, account_username, amount_centavos FROM bravus_master_credit_events")) {
      return {
        results: [...this.database.masterCreditEvents.values()].map((event) => ({
          grant_id: event.grantId,
          event_type: event.eventType,
          account_username: event.accountUsername,
          amount_centavos: event.amountCentavos,
        })),
      };
    }
    if (this.sql.startsWith("SELECT id, account_username, event_type, hold_id, amount_centavos, metadata_hash, idempotency_hash FROM bravus_account_control_events")) {
      return {
        results: [...this.database.accountControlEvents.values()].map((event) => ({
          id: event.id,
          account_username: event.username,
          event_type: event.eventType,
          hold_id: event.holdId,
          amount_centavos: event.amountCentavos,
          metadata_hash: event.metadataHash,
          idempotency_hash: event.idempotencyHash,
        })),
      };
    }
    throw new Error("Unsupported D1 all(): " + this.sql);
  }
}

class FakeD1 {
  constructor() {
    this.stateRow = null;
    this.audits = new Map();
    this.ledgerEntries = new Map();
    this.biometricEvidence = new Map();
    this.kycAudits = new Map();
    this.institutionalReserve = null;
    this.institutionalReserveAudits = new Map();
    this.accountProvisioningAudits = new Map();
    this.masterCreditReserve = null;
    this.masterCreditEvents = new Map();
    this.accountControlEvents = new Map();
  }

  prepare(sql) {
    return new FakeStatement(this, sql);
  }

  async batch(statements) {
    const snapshot = structuredClone({
      stateRow: this.stateRow,
      audits: [...this.audits],
      ledgerEntries: [...this.ledgerEntries],
      biometricEvidence: [...this.biometricEvidence],
      kycAudits: [...this.kycAudits],
      institutionalReserve: this.institutionalReserve,
      institutionalReserveAudits: [...this.institutionalReserveAudits],
      accountProvisioningAudits: [...this.accountProvisioningAudits],
      masterCreditReserve: this.masterCreditReserve,
      masterCreditEvents: [...this.masterCreditEvents],
      accountControlEvents: [...this.accountControlEvents],
    });
    try {
      return statements.map((statement) => ({ meta: { changes: this.execute(statement) } }));
    } catch (error) {
      this.stateRow = snapshot.stateRow;
      this.audits = new Map(snapshot.audits);
      this.ledgerEntries = new Map(snapshot.ledgerEntries);
      this.biometricEvidence = new Map(snapshot.biometricEvidence);
      this.kycAudits = new Map(snapshot.kycAudits);
      this.institutionalReserve = snapshot.institutionalReserve;
      this.institutionalReserveAudits = new Map(snapshot.institutionalReserveAudits);
      this.accountProvisioningAudits = new Map(snapshot.accountProvisioningAudits);
      this.masterCreditReserve = snapshot.masterCreditReserve;
      this.masterCreditEvents = new Map(snapshot.masterCreditEvents);
      this.accountControlEvents = new Map(snapshot.accountControlEvents);
      throw error;
    }
  }

  execute(statement) {
    const sql = statement.sql;
    const values = statement.bindings;
    if (sql.startsWith("CREATE TABLE") || sql.startsWith("CREATE INDEX") || sql.startsWith("CREATE TRIGGER")) return 0;

    if (sql.startsWith("INSERT OR IGNORE INTO bravus_state (id, revision")) {
      if (this.stateRow) return 0;
      this.stateRow = {
        revision: 1,
        payload: values[0],
        payload_hash: values[1],
        source_captured_at: values[2],
        created_at: values[3],
        updated_at: values[4],
      };
      return 1;
    }

    if (sql.startsWith("UPDATE bravus_state SET revision")) {
      const [revision, payload, payloadHash, updatedAt, previousRevision, previousHash] = values;
      if (!this.stateRow || this.stateRow.revision !== previousRevision || this.stateRow.payload_hash !== previousHash) return 0;
      this.stateRow = { ...this.stateRow, revision, payload, payload_hash: payloadHash, updated_at: updatedAt };
      return 1;
    }

    if (sql.startsWith("INSERT OR IGNORE INTO bravus_state_audit")) {
      const bootstrap = sql.includes("VALUES (1");
      const revision = bootstrap ? 1 : values[0];
      if (this.audits.has(revision)) return 0;
      if (!bootstrap) {
        const expectedRevision = values[8];
        const expectedHash = values[9];
        if (!this.stateRow || this.stateRow.revision !== expectedRevision || this.stateRow.payload_hash !== expectedHash) return 0;
      }
      this.audits.set(revision, structuredClone(values));
      return 1;
    }

    if (sql.startsWith("INSERT OR IGNORE INTO bravus_ledger_entries")) {
      const expectedRevision = values[9];
      const expectedHash = values[10];
      if (!this.stateRow || this.stateRow.revision !== expectedRevision || this.stateRow.payload_hash !== expectedHash) return 0;
      const key = values[0] + ":" + values[1];
      if (this.ledgerEntries.has(key)) return 0;
      this.ledgerEntries.set(key, {
        transferId: values[0], entryType: values[1], orderId: values[2], accountUsername: values[3],
        accountNumber: values[4], signedAmountCentavos: values[5], currency: values[6], reason: values[7], createdAt: values[8],
      });
      return 1;
    }

    if (sql.startsWith("INSERT OR IGNORE INTO bravus_biometric_evidence")) {
      const expectedRevision = values[8];
      const expectedHash = values[9];
      if (!this.stateRow || this.stateRow.revision !== expectedRevision || this.stateRow.payload_hash !== expectedHash) return 0;
      if (this.biometricEvidence.has(values[0])) return 0;
      if (!["ENROLLED_FACE", "PASSWORD_RESET_FACE", "KYC_DOCUMENT_FRONT", "KYC_DOCUMENT_BACK"].includes(values[1])) {
        throw new Error("CHECK constraint failed: kind");
      }
      this.biometricEvidence.set(values[0], {
        id: values[0], kind: values[1], owner_username: values[2], mime: values[3], ciphertext: values[4],
        iv: values[5], sha256: values[6], created_at: values[7],
      });
      return 1;
    }

    if (sql.startsWith("INSERT OR IGNORE INTO bravus_kyc_audit")) {
      const expectedRevision = values[7];
      const expectedHash = values[8];
      if (!this.stateRow || this.stateRow.revision !== expectedRevision || this.stateRow.payload_hash !== expectedHash) return 0;
      if (this.kycAudits.has(values[0])) return 0;
      this.kycAudits.set(values[0], {
        id: values[0], username: values[1], actor: values[2], fromStatus: values[3],
        toStatus: values[4], reason: values[5], createdAt: values[6],
      });
      return 1;
    }

    if (sql.startsWith("INSERT OR IGNORE INTO bravus_institutional_reserve (")) {
      if (this.institutionalReserve) return 0;
      this.institutionalReserve = {
        code: values[0], currency: values[1], amount_centavos: values[2], classification: values[3],
        status: values[4], customer_funds: 0, transferable: 0, source_reference: values[5],
        policy_version: values[6], payload_hash: values[7], declared_at: values[8],
      };
      return 1;
    }

    if (sql.startsWith("INSERT OR IGNORE INTO bravus_institutional_reserve_audit")) {
      if (this.institutionalReserveAudits.has(values[0])) return 0;
      this.institutionalReserveAudits.set(values[0], structuredClone(values));
      return 1;
    }

    if (sql.startsWith("INSERT OR IGNORE INTO bravus_account_provisioning_audit")) {
      const expectedRevision = values[6];
      const expectedHash = values[7];
      if (!this.stateRow || this.stateRow.revision !== expectedRevision || this.stateRow.payload_hash !== expectedHash) return 0;
      if (this.accountProvisioningAudits.has(values[0])) return 0;
      this.accountProvisioningAudits.set(values[0], {
        id: values[0], accountUsername: values[1], subjectHash: values[2], actor: values[3],
        eventType: values[4], createdAt: values[5],
      });
      return 1;
    }

    if (sql.startsWith("INSERT OR IGNORE INTO bravus_master_credit_reserve")) {
      if (this.masterCreditReserve) return 0;
      this.masterCreditReserve = {
        code: values[0], currency: values[1], total_amount_centavos: values[2], classification: values[3],
        status: values[4], transfer_scope: values[5], admin_only: 1, policy_version: values[6],
        payload_hash: values[7], activated_at: values[8],
      };
      return 1;
    }

    if (sql.startsWith("INSERT OR IGNORE INTO bravus_master_credit_events") || sql.startsWith("INSERT INTO bravus_master_credit_events")) {
      const activation = sql.includes("master-credit-reserve-activation-v1");
      const entry = activation ? {
        id: "master-credit-reserve-activation-v1", reserveCode: values[0], grantId: null,
        eventType: "RESERVE_ACTIVATED", accountUsername: null, amountCentavos: values[1],
        actor: "OWNER_CONFIGURATION", assessmentReason: values[2], eligibilityRule: values[3],
        idempotencyHash: values[4], createdAt: values[5],
      } : {
        id: values[0], reserveCode: values[1], grantId: values[2], eventType: values[3],
        accountUsername: values[4], amountCentavos: values[5], actor: values[6],
        assessmentReason: values[7], eligibilityRule: values[8], idempotencyHash: values[9], createdAt: values[10],
      };
      if (!activation) {
        const expectedRevision = values[11];
        const expectedHash = values[12];
        if (!this.stateRow || this.stateRow.revision !== expectedRevision || this.stateRow.payload_hash !== expectedHash) return 0;
      }
      const invalidAmount = !/^[1-9]\d*$/.test(String(entry.amountCentavos));
      const invalidSubject = entry.eventType === "RESERVE_ACTIVATED"
        ? entry.grantId !== null || entry.accountUsername !== null
        : !entry.grantId || !entry.accountUsername;
      if (invalidAmount || invalidSubject) throw new Error("CHECK constraint failed: master credit event");
      const duplicate = this.masterCreditEvents.has(entry.id)
        || [...this.masterCreditEvents.values()].some((item) => entry.grantId && item.grantId === entry.grantId && item.eventType === entry.eventType)
        || [...this.masterCreditEvents.values()].some((item) => item.idempotencyHash === entry.idempotencyHash);
      if (duplicate) {
        if (activation) return 0;
        throw new Error("UNIQUE constraint failed: master credit event");
      }
      this.masterCreditEvents.set(entry.id, entry);
      return 1;
    }

    if (sql.startsWith("INSERT INTO bravus_account_control_events")) {
      const expectedRevision = values[10];
      const expectedHash = values[11];
      if (!this.stateRow || this.stateRow.revision !== expectedRevision || this.stateRow.payload_hash !== expectedHash) return 0;
      const entry = {
        id: values[0], username: values[1], eventType: values[2], holdId: values[3],
        amountCentavos: values[4], actor: values[5], reason: values[6], metadataHash: values[7],
        idempotencyHash: values[8], createdAt: values[9],
      };
      const holdEvent = ["BALANCE_HOLD_PLACED", "BALANCE_HOLD_RELEASED"].includes(entry.eventType);
      if (!/^\d+$/.test(String(entry.amountCentavos))
          || (String(entry.amountCentavos).length > 1 && String(entry.amountCentavos).startsWith("0"))
          || (holdEvent && (!entry.holdId || entry.amountCentavos === "0"))
          || (!holdEvent && entry.holdId !== null)) {
        throw new Error("CHECK constraint failed: account control event");
      }
      const duplicate = this.accountControlEvents.has(entry.id)
        || [...this.accountControlEvents.values()].some((item) => item.idempotencyHash === entry.idempotencyHash);
      if (duplicate) throw new Error("UNIQUE constraint failed: account control event");
      this.accountControlEvents.set(entry.id, entry);
      return 1;
    }

    throw new Error("Unsupported D1 batch statement: " + sql);
  }
}

const workerPath = process.env.BRAVUS_SITES_WORKER_PATH
  || join(tmpdir(), "bravus-sites-embedded-artifact", "index.mjs");
const database = new FakeD1();
const env = {
  DB: database,
  BRAVUS_BIOMETRIC_KEY: Buffer.alloc(32, 37).toString("base64url"),
  BRAVUS_PASSWORD_PEPPER: "test-only-password-pepper-value",
  BRAVUS_ALLOW_TEST_BOOTSTRAP: "true",
};

async function loadWorker(label) {
  const moduleUrl = pathToFileURL(workerPath);
  moduleUrl.searchParams.set("instance", label + "-" + Date.now());
  return (await import(moduleUrl.href)).default;
}

async function call(worker, method, path, { token, body, headers = {} } = {}) {
  const requestHeaders = new Headers({ "content-type": "application/json", ...headers });
  if (token) requestHeaders.set("authorization", "Bearer " + token);
  const response = await worker.fetch(new Request("https://bravus.test/api" + path, {
    method,
    headers: requestHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
  }), env);
  const text = await response.text();
  let data = text;
  try { data = text ? JSON.parse(text) : null; } catch { /* Keep plain text for assertions. */ }
  return { response, data };
}

function image(byte, length, width = 640, height = 480) {
  const value = Buffer.alloc(length, byte);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(value, 0);
  Buffer.from("IHDR").copy(value, 12);
  value.writeUInt32BE(width, 16);
  value.writeUInt32BE(height, 20);
  return "data:image/png;base64," + value.toString("base64");
}

let worker = await loadWorker("initial");
const unavailable = await worker.fetch(new Request("https://bravus.test/api/auth/login", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ username: "joao.victor", password: "irrelevant" }),
}), {});
assert.equal(unavailable.status, 503, "API must fail closed without D1");

const joaoLogin = await call(worker, "POST", "/auth/login", { body: { username: "joao.victor", password: "6run0955" } });
assert.equal(joaoLogin.response.status, 200, "legacy Joao login must remain valid");
const joaoToken = joaoLogin.data.token;
const joaoBefore = await call(worker, "GET", "/user/balance", { token: joaoToken });
let adminLogin = await call(worker, "POST", "/auth/login", { body: { username: "admin@bravusbank.com", password: "6run0955" } });
assert.equal(adminLogin.response.status, 200);

const mobileHeaders = { "x-bravus-client": "android-apk" };
const registrationIdentity = {
  clientChannel: "ANDROID_APK",
  username: "d1.persistence",
  email: "d1.persistence@bravus.test",
  cpf: "52998224725",
};
const existingAvailability = await call(worker, "POST", "/auth/register/availability", {
  headers: mobileHeaders,
  body: { ...registrationIdentity, username: "novo.usuario", email: "novo.usuario@bravus.test", cpf: "05569161155" },
});
assert.equal(existingAvailability.response.status, 200);
assert.equal(existingAvailability.data.accountExists, true, "existing CPF must be identified before facial capture");
assert.equal(existingAvailability.data.nextAction, "LOGIN_OR_PASSWORD_RESET");

const available = await call(worker, "POST", "/auth/register/availability", {
  headers: mobileHeaders,
  body: registrationIdentity,
});
assert.equal(available.response.status, 200);
assert.equal(available.data.available, true, JSON.stringify(available.data));
const webAvailability = await call(worker, "POST", "/auth/register/availability", { body: registrationIdentity });
assert.equal(webAvailability.response.status, 200, "web clients may submit account opening requests without creating accounts");

const disabledFaceCheck = await call(worker, "POST", "/auth/register/face-check", {
  headers: mobileHeaders,
  body: {
    ...registrationIdentity,
    faceImage: image(33, 3200),
    biometricChallenge: "FACE_CAMERA_CAPTURE_V1",
  },
});
assert.equal(disabledFaceCheck.response.status, 202, "public registration biometrics must be disabled");
assert.equal(disabledFaceCheck.data.code, "REGISTRATION_ADMIN_ONLY");

const register = await call(worker, "POST", "/auth/register", {
  headers: mobileHeaders,
  body: {
    ...registrationIdentity,
    fullName: "Cliente Persistencia D1",
    phone: "11999990000",
    documentFrontImage: image(11, 4200),
    documentBackImage: image(22, 4200),
    idempotencyKey: "public-account-request-d1-0001",
  },
});
assert.equal(register.response.status, 202, JSON.stringify(register.data));
assert.equal(register.data.adminReviewRequired, true);
assert.equal(register.data.accountCreated, false);
assert.equal(JSON.parse(database.stateRow.payload).users[registrationIdentity.username], undefined, "public request must not create an account");
const duplicateRegister = await call(worker, "POST", "/auth/register", {
  headers: mobileHeaders,
  body: {
    ...registrationIdentity,
    fullName: "Cliente Persistencia D1",
    phone: "11999990000",
    documentFrontImage: image(11, 4200),
    documentBackImage: image(22, 4200),
    idempotencyKey: "public-account-request-d1-0001",
  },
});
assert.equal(duplicateRegister.response.status, 202, "duplicate account opening request must be idempotent");
assert.equal(duplicateRegister.data.duplicateRequest, true);
const pendingAccountRequests = await call(worker, "GET", "/admin/account-requests", { token: adminLogin.data.token });
assert.equal(pendingAccountRequests.response.status, 200);
assert.equal(pendingAccountRequests.data.some((item) => item.requestId === register.data.requestId), true);
const accountRequestEvidence = await call(worker, "GET", "/admin/account-requests/" + register.data.requestId + "/evidence", { token: adminLogin.data.token });
assert.equal(accountRequestEvidence.response.status, 200, JSON.stringify(accountRequestEvidence.data));
assert.match(accountRequestEvidence.data.documentFront, /^data:image\/png;base64,/);
assert.match(accountRequestEvidence.data.documentBack, /^data:image\/png;base64,/);
assert.equal(accountRequestEvidence.response.headers.get("cache-control"), "no-store");

const registrationProvision = await call(worker, "POST", "/admin/accounts/provision", {
  token: adminLogin.data.token,
  headers: { "idempotency-key": "account-provision-from-public-request-0001" },
  body: {
    ...registrationIdentity,
    fullName: "Cliente Persistencia D1",
    phone: "11999990000",
    initialPassword: "NovaSenha123",
  },
});
assert.equal(registrationProvision.response.status, 201, JSON.stringify(registrationProvision.data));
const registrationInitialLogin = await call(worker, "POST", "/auth/login", {
  body: { username: registrationIdentity.cpf, password: "NovaSenha123" },
});
assert.equal(registrationInitialLogin.response.status, 403, "admin-created account must require password change on first login");
assert.equal(registrationInitialLogin.data.code, "INITIAL_PASSWORD_CHANGE_REQUIRED");
const completedRegistrationInitial = await call(worker, "POST", "/auth/initial-password/complete", {
  body: { initialPasswordChangeToken: registrationInitialLogin.data.initialPasswordChangeToken, newPassword: "PermanentD1123" },
});
assert.equal(completedRegistrationInitial.response.status, 200, JSON.stringify(completedRegistrationInitial.data));
const customerToken = completedRegistrationInitial.data.token;
const transferKey = "d1-idempotency-transfer-0001";
const transferBody = { amount: 1000, destinationAccount: "52998224725", description: "Teste atomico D1" };
const transfer = await call(worker, "POST", "/user/transfer", {
  token: joaoToken,
  headers: { "idempotency-key": transferKey },
  body: transferBody,
});
assert.equal(transfer.response.status, 200, JSON.stringify(transfer.data));
const replay = await call(worker, "POST", "/user/transfer", {
  token: joaoToken,
  headers: { "idempotency-key": transferKey },
  body: transferBody,
});
assert.equal(replay.response.status, 200, JSON.stringify(replay.data));
assert.equal(replay.data.order.idempotencyKey, transferKey);

const joaoAfter = await call(worker, "GET", "/user/balance", { token: joaoToken });
assert.equal(joaoAfter.data, joaoBefore.data - 1000, "duplicate request must debit only once");
const customerBalance = await call(worker, "GET", "/user/balance", { token: customerToken });
assert.equal(customerBalance.data, 1000, "beneficiary must receive the internal transfer");
const pendingOutgoing = await call(worker, "POST", "/user/transfer", {
  token: customerToken,
  headers: { "idempotency-key": "pending-kyc-transfer-0001" },
  body: { amount: 100, destinationAccount: "05569161155", description: "Deve bloquear KYC pendente" },
});
assert.equal(pendingOutgoing.response.status, 403, "pending identity must fail closed for outgoing transfers");
assert.equal(pendingOutgoing.data.code, "KYC_IDENTITY_PENDING");
assert.equal((await call(worker, "GET", "/user/balance", { token: customerToken })).data, 1000);
const transferLedger = [...database.ledgerEntries.values()].filter((entry) => entry.transferId === transferKey);
assert.equal(transferLedger.length, 2, "transfer must have one debit and one credit");
assert.equal(transferLedger.reduce((sum, entry) => sum + entry.signedAmountCentavos, 0), 0, "ledger pair must balance to zero");

const externalKey = "d1-idempotency-external-0001";
const externalBefore = joaoAfter.data;
const externalLedgerBefore = database.ledgerEntries.size;
const externalBody = {
  amountCentavos: 500,
  channel: "PIX",
  beneficiaryName: "Beneficiario Externo",
  beneficiaryDocument: "11144477735",
  pixKey: "externo@example.test",
  pixKeyType: "EMAIL",
  description: "Teste de repeticao externa",
};
const external = await call(worker, "POST", "/user/external-transfers", {
  token: joaoToken,
  headers: { "idempotency-key": externalKey },
  body: externalBody,
});
assert.equal(external.response.status, 200, JSON.stringify(external.data));
const externalReplay = await call(worker, "POST", "/user/external-transfers", {
  token: joaoToken,
  headers: { "idempotency-key": externalKey },
  body: externalBody,
});
assert.equal(externalReplay.response.status, 200, JSON.stringify(externalReplay.data));
assert.equal(externalReplay.data.id, external.data.id, "external retry must return the original order");
const externalAfter = await call(worker, "GET", "/user/balance", { token: joaoToken });
assert.equal(externalAfter.data, externalBefore - 500, "external retry must debit only once");
assert.equal(database.ledgerEntries.size, externalLedgerBefore + 2, "external debit must create a balanced ledger pair");
const externalConflict = await call(worker, "POST", "/user/external-transfers", {
  token: joaoToken,
  headers: { "idempotency-key": externalKey },
  body: { ...externalBody, amountCentavos: 600 },
});
assert.equal(externalConflict.response.status, 400, "reusing a key with different financial data must fail");
assert.equal((await call(worker, "GET", "/user/balance", { token: joaoToken })).data, externalBefore - 500);

worker = await loadWorker("restart-after-transfer");
const customerLogin = await call(worker, "POST", "/auth/login", { body: { username: "52998224725", password: "PermanentD1123" } });
assert.equal(customerLogin.response.status, 200, "registered user must survive worker restart");
const persistedBalance = await call(worker, "GET", "/user/balance", { token: customerLogin.data.token });
assert.equal(persistedBalance.data, 1000, "balance must survive worker restart");

adminLogin = await call(worker, "POST", "/auth/login", { body: { username: "admin@bravusbank.com", password: "6run0955" } });
assert.equal(adminLogin.response.status, 200);
const stateBeforeMissingKycCheck = structuredClone(database.stateRow);
const stateWithoutExplicitKyc = JSON.parse(stateBeforeMissingKycCheck.payload);
delete stateWithoutExplicitKyc.users[registrationIdentity.username].statusKyc;
database.stateRow.payload = JSON.stringify(stateWithoutExplicitKyc);
database.stateRow.payload_hash = createHash("sha256").update(database.stateRow.payload).digest("hex");
worker = await loadWorker("missing-kyc-must-fail-closed");
const usersBeforeProvision = await call(worker, "GET", "/admin/users", { token: adminLogin.data.token });
const missingKycUserSummary = usersBeforeProvision.data.find((item) => item.username === registrationIdentity.username);
assert.equal(missingKycUserSummary.statusKyc, "STATUS_NAO_INFORMADO");
const missingKycCreditRejected = await call(worker, "POST", "/admin/ledger/credit/issue", {
  token: adminLogin.data.token,
  headers: { "idempotency-key": "master-credit-missing-kyc-0001" },
  body: {
    userId: missingKycUserSummary.id,
    reservaCodigo: "BRAVUS_MASTER_CREDIT_RESERVE",
    valorCentavos: "1000",
    motivo: "Avaliacao de conta legada sem estado KYC explicito.",
    regraElegibilidade: "Exige estado KYC aprovado registrado explicitamente.",
    liberarAgora: false,
  },
});
assert.equal(missingKycCreditRejected.response.status, 409);
assert.equal(missingKycCreditRejected.data.code, "CUSTOMER_KYC_REQUIRED");
database.stateRow = structuredClone(stateBeforeMissingKycCheck);
worker = await loadWorker("after-missing-kyc-check");
const unauthorizedReserve = await call(worker, "GET", "/admin/ledger/balance-sheet", { token: joaoToken });
assert.equal(unauthorizedReserve.response.status, 403, "institutional reserve must remain admin-only");
const reserveBeforeProvision = await call(worker, "GET", "/admin/ledger/balance-sheet", { token: adminLogin.data.token });
assert.equal(reserveBeforeProvision.response.status, 200);
assert.equal(reserveBeforeProvision.data.masterCreditReserve.totalAmountCentavos, "100000000000000000");
assert.equal(reserveBeforeProvision.data.masterCreditReserve.totalAmountReais, "1000000000000000.00");
assert.equal(reserveBeforeProvision.data.masterCreditReserve.status, "ACTIVE");
assert.equal(reserveBeforeProvision.data.masterCreditReserve.transferScope, "ADMIN_APPROVED_CUSTOMERS");
assert.equal(reserveBeforeProvision.data.masterCreditReserve.adminOnly, true);
assert.equal(reserveBeforeProvision.data.masterCreditReserve.transferable, true);
assert.equal(reserveBeforeProvision.data.masterCreditReserve.availableCentavos, "100000000000000000");
assert.equal(reserveBeforeProvision.data.masterCreditReserve.committedCentavos, "0");
assert.equal(
  BigInt(reserveBeforeProvision.data.masterCreditReserve.totalAmountCentavos) > BigInt(Number.MAX_SAFE_INTEGER),
  true,
  "the reserve test must exercise values above JavaScript's safe integer range",
);
assert.equal(reserveBeforeProvision.data.accounting.precision, "INTEGER_DECIMAL_STRING");
assert.equal(reserveBeforeProvision.data.accounting.balanced, true);
assert.equal(reserveBeforeProvision.data.accounting.ledgerReconciled, true);
assert.equal(
  BigInt(reserveBeforeProvision.data.masterCreditReserve.totalCentavos),
  BigInt(reserveBeforeProvision.data.masterCreditReserve.availableCentavos)
    + BigInt(reserveBeforeProvision.data.masterCreditReserve.committedCentavos),
  "master reserve must equal available plus committed credit without floating-point arithmetic",
);
assert.equal(reserveBeforeProvision.data.accounting.economicClassification, "NON_REPAYABLE_BOOK_CREDIT");
assert.equal(reserveBeforeProvision.data.accounting.createsCustomerDebt, false);
assert.equal(reserveBeforeProvision.data.accounting.externalCashBackingClaimed, false);
const persistenceBeforeProvision = await call(worker, "GET", "/admin/persistence/status", { token: adminLogin.data.token });
assert.equal(persistenceBeforeProvision.data.institutionalReserveReady, true);
assert.equal(persistenceBeforeProvision.data.institutionalReserveAuditCount, 1);
assert.equal(persistenceBeforeProvision.data.masterCreditReserveReady, true);
assert.equal(persistenceBeforeProvision.data.immutableMasterCreditEventCount, 1);
const provisionedIdentity = {
  username: "provisioned.customer",
  email: "provisioned.customer@bravus.test",
  cpf: "31415926590",
  fullName: "Cliente Provisionado Teste",
  initialPassword: "Temporary123",
};
const unauthorizedProvision = await call(worker, "POST", "/admin/accounts/provision", {
  token: joaoToken,
  headers: { "idempotency-key": "account-provision-test-0001" },
  body: provisionedIdentity,
});
assert.equal(unauthorizedProvision.response.status, 403, "only an administrator may provision accounts");
const [provisioned, provisionReplay] = await Promise.all([
  call(worker, "POST", "/admin/accounts/provision", {
    token: adminLogin.data.token,
    headers: { "idempotency-key": "account-provision-test-0001" },
    body: provisionedIdentity,
  }),
  call(worker, "POST", "/admin/accounts/provision", {
    token: adminLogin.data.token,
    headers: { "idempotency-key": "account-provision-test-0001" },
    body: provisionedIdentity,
  }),
]);
assert.equal(provisioned.response.status, 201, JSON.stringify(provisioned.data));
assert.equal(provisioned.data.account.balance, 0);
assert.equal(provisioned.data.account.statusKyc, "PENDENTE_VALIDACAO_IDENTIDADE");
assert.equal(provisioned.data.account.credentialState, "INITIAL_CHANGE_REQUIRED");
assert.equal(provisionReplay.response.status, 200);
assert.equal(provisionReplay.data.idempotentReplay, true);
const provisionPasswordConflict = await call(worker, "POST", "/admin/accounts/provision", {
  token: adminLogin.data.token,
  headers: { "idempotency-key": "account-provision-test-0001" },
  body: { ...provisionedIdentity, initialPassword: "DifferentTemporary123" },
});
assert.equal(provisionPasswordConflict.response.status, 409, "a retry must not silently accept a different initial password");
assert.equal(provisionPasswordConflict.data.code, "IDEMPOTENCY_CONFLICT");
assert.equal(JSON.parse(database.stateRow.payload).users[provisionedIdentity.username].credentialState, "INITIAL_CHANGE_REQUIRED");
const provisionConflict = await call(worker, "POST", "/admin/accounts/provision", {
  token: adminLogin.data.token,
  headers: { "idempotency-key": "account-provision-test-0001" },
  body: { ...provisionedIdentity, fullName: "Outro Titular" },
});
assert.equal(provisionConflict.response.status, 409, "idempotency key reuse with different identity data must fail");
const reserveAfterProvision = await call(worker, "GET", "/admin/ledger/balance-sheet", { token: adminLogin.data.token });
const persistenceAfterProvision = await call(worker, "GET", "/admin/persistence/status", { token: adminLogin.data.token });
assert.equal(
  reserveAfterProvision.data.masterCreditReserve.availableCentavos,
  reserveBeforeProvision.data.masterCreditReserve.availableCentavos,
  "manual account creation must not mutate institutional reserves",
);
assert.equal(
  persistenceAfterProvision.data.ledgerEntryCount,
  persistenceBeforeProvision.data.ledgerEntryCount,
  "manual account creation must not post financial ledger entries",
);
assert.equal(
  persistenceAfterProvision.data.transactionCount,
  persistenceBeforeProvision.data.transactionCount,
  "manual account creation must not create transactions",
);
assert.equal(persistenceAfterProvision.data.userCount, persistenceBeforeProvision.data.userCount + 1);
assert.equal(persistenceAfterProvision.data.immutableAccountProvisioningAuditCount, 2);
assert.equal(database.accountProvisioningAudits.size, 2, "manual account creation must have immutable D1 audit records");
assert.equal(
  JSON.parse(database.stateRow.payload).registrationAudit.some((item) =>
    item.eventType === "ACCOUNT_PROVISIONED_PENDING_IDENTITY"
    && item.actor === "admin@bravusbank.com"
  ),
  true,
  "manual account creation must create an admin audit event",
);
const reissuedInitialPassword = await call(worker, "POST", "/admin/accounts/" + provisionedIdentity.username + "/initial-password/reissue", {
  token: adminLogin.data.token,
  headers: { "idempotency-key": "initial-password-reissue-0001" },
  body: { initialPassword: "Reissued123" },
});
assert.equal(reissuedInitialPassword.response.status, 200, JSON.stringify(reissuedInitialPassword.data));
const oldInitialLogin = await call(worker, "POST", "/auth/login", {
  body: { username: provisionedIdentity.cpf, password: provisionedIdentity.initialPassword },
});
assert.equal(oldInitialLogin.response.status, 400, "reissuing the initial password must invalidate the previous one");
const initialLogin = await call(worker, "POST", "/auth/login", {
  body: { username: provisionedIdentity.cpf, password: "Reissued123" },
});
assert.equal(initialLogin.response.status, 403);
assert.equal(initialLogin.data.code, "INITIAL_PASSWORD_CHANGE_REQUIRED");
assert.equal(Boolean(initialLogin.data.token), false, "an initial password must never create a banking session");
const weakInitialChange = await call(worker, "POST", "/auth/initial-password/complete", {
  body: { initialPasswordChangeToken: initialLogin.data.initialPasswordChangeToken, newPassword: "weak" },
});
assert.equal(weakInitialChange.response.status, 400, "the permanent password policy must remain enforced");
const reusedInitialPassword = await call(worker, "POST", "/auth/initial-password/complete", {
  body: { initialPasswordChangeToken: initialLogin.data.initialPasswordChangeToken, newPassword: "Reissued123" },
});
assert.equal(reusedInitialPassword.response.status, 400, "the permanent password must differ from the administrator-known initial password");
assert.equal(reusedInitialPassword.data.code, "INITIAL_PASSWORD_REUSE");
const completedInitialChange = await call(worker, "POST", "/auth/initial-password/complete", {
  body: { initialPasswordChangeToken: initialLogin.data.initialPasswordChangeToken, newPassword: "Permanent123" },
});
assert.equal(completedInitialChange.response.status, 200, JSON.stringify(completedInitialChange.data));
assert.equal(Boolean(completedInitialChange.data.token), true);
assert.equal(completedInitialChange.data.identityEvidenceRequired, true);
assert.equal(database.stateRow.payload.includes("Temporary123"), false, "initial passwords must never be persisted in plaintext or unsalted fingerprints");
assert.equal(database.stateRow.payload.includes("Reissued123"), false, "reissued passwords must never be persisted in plaintext or unsalted fingerprints");
const reusedInitialChange = await call(worker, "POST", "/auth/initial-password/complete", {
  body: { initialPasswordChangeToken: initialLogin.data.initialPasswordChangeToken, newPassword: "AnotherPassword123" },
});
assert.equal(reusedInitialChange.response.status, 400, "the initial password challenge must be single-use");
const provisionedOutgoing = await call(worker, "POST", "/user/withdraw", {
  token: completedInitialChange.data.token,
  body: { amount: 1 },
});
assert.equal(provisionedOutgoing.response.status, 403, "pending identity accounts must not perform outgoing operations");
const creditAssessmentBody = {
  userId: provisioned.data.account.id,
  reservaCodigo: "BRAVUS_MASTER_CREDIT_RESERVE",
  valorCentavos: "12345",
  motivo: "Credito escritural aprovado apos avaliacao individual do cliente.",
  regraElegibilidade: "Identidade aprovada, conta ativa e analise administrativa registrada.",
  taxaJurosAnual: 0,
  observacoes: "Concessao de teste da reserva mestre.",
  liberarAgora: false,
};
const unauthorizedCreditIssue = await call(worker, "POST", "/admin/ledger/credit/issue", {
  token: completedInitialChange.data.token,
  headers: { "idempotency-key": "master-credit-unauthorized-test-0001" },
  body: creditAssessmentBody,
});
assert.equal(unauthorizedCreditIssue.response.status, 403, "only an administrator may grant master credit");
const creditBlockedBeforeKyc = await call(worker, "POST", "/admin/ledger/credit/issue", {
  token: adminLogin.data.token,
  headers: { "idempotency-key": "master-credit-kyc-block-test-0001" },
  body: creditAssessmentBody,
});
assert.equal(creditBlockedBeforeKyc.response.status, 409, "master credit requires approved identity");
assert.equal(creditBlockedBeforeKyc.data.code, "CUSTOMER_KYC_REQUIRED");
const approveWithoutEvidence = await call(worker, "POST", "/admin/kyc/" + provisionedIdentity.username + "/approve", {
  token: adminLogin.data.token,
  body: { reason: "Tentativa de aprovacao sem documento e biometria enviados." },
});
assert.equal(approveWithoutEvidence.response.status, 400);
assert.equal(approveWithoutEvidence.data.code, "KYC_EVIDENCE_REQUIRED");
const provisionedFaceImage = image(71, 3600);
const provisionedFaceCheck = await call(worker, "POST", "/user/kyc/face-check", {
  token: completedInitialChange.data.token,
  body: { faceImage: provisionedFaceImage, biometricChallenge: "FACE_CAMERA_CAPTURE_V1" },
});
assert.equal(provisionedFaceCheck.response.status, 200, JSON.stringify(provisionedFaceCheck.data));
const enrollmentBody = {
  documentFrontImage: image(72, 4300),
  documentBackImage: image(73, 4300),
  faceImage: provisionedFaceImage,
  biometricChallenge: "FACE_CAMERA_CAPTURE_V1",
  faceVerificationToken: provisionedFaceCheck.data.faceVerificationToken,
};
const provisionedEnrollment = await call(worker, "POST", "/user/kyc/enroll", {
  token: completedInitialChange.data.token,
  headers: { "idempotency-key": "provisioned-kyc-enrollment-0001" },
  body: enrollmentBody,
});
assert.equal(provisionedEnrollment.response.status, 201, JSON.stringify(provisionedEnrollment.data));
assert.equal(provisionedEnrollment.data.identityEvidenceRequired, false);
const provisionedEnrollmentReplay = await call(worker, "POST", "/user/kyc/enroll", {
  token: completedInitialChange.data.token,
  headers: { "idempotency-key": "provisioned-kyc-enrollment-0001" },
  body: enrollmentBody,
});
assert.equal(provisionedEnrollmentReplay.response.status, 200);
assert.equal(provisionedEnrollmentReplay.data.idempotentReplay, true);
const approveProvisionedIdentity = await call(worker, "POST", "/admin/kyc/" + provisionedIdentity.username + "/approve", {
  token: adminLogin.data.token,
  body: { reason: "Documento e captura facial da conta provisionada conferidos." },
});
assert.equal(approveProvisionedIdentity.response.status, 200, JSON.stringify(approveProvisionedIdentity.data));
assert.equal(approveProvisionedIdentity.data.statusKyc, "APROVADO_IDENTIDADE");
const interestBearingCreditRejected = await call(worker, "POST", "/admin/ledger/credit/issue", {
  token: adminLogin.data.token,
  headers: { "idempotency-key": "master-credit-interest-reject-0001" },
  body: { ...creditAssessmentBody, taxaJurosAnual: 1 },
});
assert.equal(interestBearingCreditRejected.response.status, 400);
assert.equal(interestBearingCreditRejected.data.code, "MASTER_CREDIT_NON_REPAYABLE");
const balanceBeforeMasterCredit = await call(worker, "GET", "/admin/ledger/balance-sheet", { token: adminLogin.data.token });
const persistenceBeforeMasterCredit = await call(worker, "GET", "/admin/persistence/status", { token: adminLogin.data.token });
const stateBeforeAuditConflict = structuredClone(database.stateRow);
const reserveActivationEvent = structuredClone(database.masterCreditEvents.get("master-credit-reserve-activation-v1"));
database.masterCreditEvents.set("master-credit-reserve-activation-v1", {
  ...reserveActivationEvent,
  idempotencyHash: createHash("sha256").update("master-credit-pending-test-0001").digest("hex"),
});
await assert.rejects(
  () => call(worker, "POST", "/admin/ledger/credit/issue", {
    token: adminLogin.data.token,
    headers: { "idempotency-key": "master-credit-pending-test-0001" },
    body: creditAssessmentBody,
  }),
  /UNIQUE constraint failed/,
  "a missing immutable credit event must abort the entire financial commit",
);
assert.equal(database.stateRow.payload, stateBeforeAuditConflict.payload, "audit failure must roll back the grant state");
database.masterCreditEvents.set("master-credit-reserve-activation-v1", reserveActivationEvent);
const [pendingCreditIssue, pendingCreditReplay] = await Promise.all([
  call(worker, "POST", "/admin/ledger/credit/issue", {
    token: adminLogin.data.token,
    headers: { "idempotency-key": "master-credit-pending-test-0001" },
    body: creditAssessmentBody,
  }),
  call(worker, "POST", "/admin/ledger/credit/issue", {
    token: adminLogin.data.token,
    headers: { "idempotency-key": "master-credit-pending-test-0001" },
    body: creditAssessmentBody,
  }),
]);
assert.equal(pendingCreditIssue.response.status, 201, JSON.stringify(pendingCreditIssue.data));
assert.equal(pendingCreditIssue.data.grant.status, "PENDENTE");
assert.equal(pendingCreditReplay.response.status, 200);
assert.equal(pendingCreditReplay.data.idempotentReplay, true);
assert.equal(JSON.parse(database.stateRow.payload).users[provisionedIdentity.username].balance, 0, "pending credit must not change customer balance");
const balanceWithPendingCredit = await call(worker, "GET", "/admin/ledger/balance-sheet", { token: adminLogin.data.token });
assert.equal(balanceWithPendingCredit.data.masterCreditReserve.committedCentavos, "12345");
assert.equal(balanceWithPendingCredit.data.masterCreditReserve.pendingCentavos, "12345");
assert.equal(balanceWithPendingCredit.data.masterCreditReserve.availableCentavos, "99999999999987655");
assert.equal(database.masterCreditEvents.size, 2, "pending grant must append one immutable reserve event");
const releasedCredit = await call(worker, "POST", "/admin/ledger/credit/" + pendingCreditIssue.data.grant.id + "/release", {
  token: adminLogin.data.token,
  headers: { "idempotency-key": "master-credit-release-test-0001" },
});
assert.equal(releasedCredit.response.status, 200, JSON.stringify(releasedCredit.data));
assert.equal(releasedCredit.data.grant.status, "LIBERADO");
assert.equal(releasedCredit.data.grant.repayable, false);
assert.equal(releasedCredit.data.grant.interestBearing, false);
assert.equal(JSON.parse(database.stateRow.payload).users[provisionedIdentity.username].balance, 12345);
const releasedCreditReplay = await call(worker, "POST", "/admin/ledger/credit/" + pendingCreditIssue.data.grant.id + "/release", {
  token: adminLogin.data.token,
  headers: { "idempotency-key": "master-credit-release-test-0001" },
});
assert.equal(releasedCreditReplay.response.status, 200);
assert.equal(releasedCreditReplay.data.idempotentReplay, true);
const stateBeforeEligibilityChange = structuredClone(database.stateRow);
const changedEligibilityState = JSON.parse(stateBeforeEligibilityChange.payload);
changedEligibilityState.users[provisionedIdentity.username].active = false;
database.stateRow.payload = JSON.stringify(changedEligibilityState);
database.stateRow.payload_hash = createHash("sha256").update(database.stateRow.payload).digest("hex");
worker = await loadWorker("idempotent-replay-after-eligibility-change");
const issueReplayAfterEligibilityChange = await call(worker, "POST", "/admin/ledger/credit/issue", {
  token: adminLogin.data.token,
  headers: { "idempotency-key": "master-credit-pending-test-0001" },
  body: creditAssessmentBody,
});
assert.equal(issueReplayAfterEligibilityChange.response.status, 200, "issue replay must return the original result after eligibility changes");
assert.equal(issueReplayAfterEligibilityChange.data.idempotentReplay, true);
const releaseReplayAfterEligibilityChange = await call(worker, "POST", "/admin/ledger/credit/" + pendingCreditIssue.data.grant.id + "/release", {
  token: adminLogin.data.token,
  headers: { "idempotency-key": "master-credit-release-test-0001" },
});
assert.equal(releaseReplayAfterEligibilityChange.response.status, 200, "release replay must return the original result after eligibility changes");
assert.equal(releaseReplayAfterEligibilityChange.data.idempotentReplay, true);
database.stateRow = stateBeforeEligibilityChange;
worker = await loadWorker("after-idempotent-eligibility-replay");
const auditStateAfterReplay = JSON.parse(database.stateRow.payload);
const actualAuditSignaturesAfterReplay = [...database.masterCreditEvents.values()].map((event) => [
  event.grantId || "", event.eventType || "", event.accountUsername || "", String(event.amountCentavos || ""),
].join("|")).sort();
const expectedAuditSignaturesAfterReplay = [{ grantId: null, eventType: "RESERVE_ACTIVATED", accountUsername: null, amountCentavos: "100000000000000000" }]
  .concat(auditStateAfterReplay.masterCreditGrants.flatMap((grant) => [
    { grantId: grant.id, eventType: "GRANT_CREATED", accountUsername: grant.username, amountCentavos: grant.amountCentavos },
    ...(grant.status === "LIBERADO" ? [{ grantId: grant.id, eventType: "GRANT_RELEASED", accountUsername: grant.username, amountCentavos: grant.amountCentavos }] : []),
  ]))
  .map((event) => [event.grantId || "", event.eventType, event.accountUsername || "", String(event.amountCentavos)].join("|"))
  .sort();
assert.deepEqual(actualAuditSignaturesAfterReplay, expectedAuditSignaturesAfterReplay);
const duplicateRelease = await call(worker, "POST", "/admin/ledger/credit/" + pendingCreditIssue.data.grant.id + "/release", {
  token: adminLogin.data.token,
  headers: { "idempotency-key": "master-credit-release-other-0001" },
});
assert.equal(duplicateRelease.response.status, 409, "a released grant cannot credit the customer twice");
const grantsByUser = await call(worker, "GET", "/admin/ledger/credit/by-user/" + provisioned.data.account.id, { token: adminLogin.data.token });
assert.equal(grantsByUser.data.length, 1);
assert.equal(grantsByUser.data[0].status, "LIBERADO");
const balanceAfterMasterCredit = await call(worker, "GET", "/admin/ledger/balance-sheet", { token: adminLogin.data.token });
const persistenceAfterMasterCredit = await call(worker, "GET", "/admin/persistence/status", { token: adminLogin.data.token });
assert.equal(balanceAfterMasterCredit.data.masterCreditReserve.releasedCentavos, "12345");
assert.equal(balanceAfterMasterCredit.data.masterCreditReserve.pendingCentavos, "0");
assert.equal(balanceAfterMasterCredit.data.masterCreditReserve.availableCentavos, balanceWithPendingCredit.data.masterCreditReserve.availableCentavos);
assert.equal(balanceAfterMasterCredit.data.accounting.ledgerReconciled, true);
assert.equal(persistenceAfterMasterCredit.data.transactionCount, persistenceBeforeMasterCredit.data.transactionCount + 1);
assert.equal(persistenceAfterMasterCredit.data.ledgerEntryCount, persistenceBeforeMasterCredit.data.ledgerEntryCount + 2);
assert.equal(database.masterCreditEvents.size, 3, "release must append one immutable reserve event");
const releasedAuditEvent = [...database.masterCreditEvents.values()].find((event) => event.eventType === "GRANT_RELEASED");
const releasedAuditEventOriginal = structuredClone(releasedAuditEvent);
database.masterCreditEvents.set(releasedAuditEvent.id, { ...releasedAuditEvent, amountCentavos: "12346" });
await assert.rejects(
  () => call(worker, "GET", "/admin/ledger/balance-sheet", { token: adminLogin.data.token }),
  /D1_MASTER_CREDIT_AUDIT_MISMATCH/,
  "event content mismatch must fail closed before returning a balance sheet",
);
database.masterCreditEvents.set(releasedAuditEventOriginal.id, releasedAuditEventOriginal);

const unauthorizedAccountDetail = await call(worker, "GET", "/admin/users/" + provisionedIdentity.username, {
  token: completedInitialChange.data.token,
});
assert.equal(unauthorizedAccountDetail.response.status, 403, "customer must not open administrative account details");
const accountDetailBeforeControl = await call(worker, "GET", "/admin/users/" + provisionedIdentity.username, {
  token: adminLogin.data.token,
});
assert.equal(accountDetailBeforeControl.response.status, 200, JSON.stringify(accountDetailBeforeControl.data));
assert.equal(accountDetailBeforeControl.data.balances.ledgerBalanceCentavos, "12345");
assert.equal(accountDetailBeforeControl.data.balances.availableBalanceCentavos, "12345");

const profileUpdateBody = {
  fullName: provisioned.data.account.fullName,
  email: provisionedIdentity.email,
  phone: "11987654321",
  reason: "Telefone atualizado apos confirmacao administrativa do titular.",
};
const profileUpdate = await call(worker, "PUT", "/admin/users/" + provisionedIdentity.username + "/profile", {
  token: adminLogin.data.token,
  headers: { "idempotency-key": "account-profile-update-test-0001" },
  body: profileUpdateBody,
});
assert.equal(profileUpdate.response.status, 200, JSON.stringify(profileUpdate.data));
assert.equal(profileUpdate.data.account.phone, "11987654321");
const profileUpdateReplay = await call(worker, "PUT", "/admin/users/" + provisionedIdentity.username + "/profile", {
  token: adminLogin.data.token,
  headers: { "idempotency-key": "account-profile-update-test-0001" },
  body: profileUpdateBody,
});
assert.equal(profileUpdateReplay.response.status, 200);
assert.equal(profileUpdateReplay.data.idempotentReplay, true);
const profileUpdateConflict = await call(worker, "PUT", "/admin/users/" + provisionedIdentity.username + "/profile", {
  token: adminLogin.data.token,
  headers: { "idempotency-key": "account-profile-update-test-0001" },
  body: { ...profileUpdateBody, phone: "11911112222" },
});
assert.equal(profileUpdateConflict.response.status, 409, "same idempotency key must reject different profile data");

const holdBody = {
  amountCentavos: "12000",
  reason: "Retencao preventiva autorizada para revisao administrativa da conta.",
};
const holdPlaced = await call(worker, "POST", "/admin/users/" + provisionedIdentity.username + "/holds", {
  token: adminLogin.data.token,
  headers: { "idempotency-key": "account-balance-hold-test-0001" },
  body: holdBody,
});
assert.equal(holdPlaced.response.status, 201, JSON.stringify(holdPlaced.data));
assert.equal(holdPlaced.data.detail.balances.ledgerBalanceCentavos, "12345", "hold must not mutate booked balance");
assert.equal(holdPlaced.data.detail.balances.heldBalanceCentavos, "12000");
assert.equal(holdPlaced.data.detail.balances.availableBalanceCentavos, "345");
const holdReplay = await call(worker, "POST", "/admin/users/" + provisionedIdentity.username + "/holds", {
  token: adminLogin.data.token,
  headers: { "idempotency-key": "account-balance-hold-test-0001" },
  body: holdBody,
});
assert.equal(holdReplay.response.status, 200);
assert.equal(holdReplay.data.idempotentReplay, true);
assert.equal(JSON.parse(database.stateRow.payload).balanceHolds.length, 1, "hold replay must not duplicate retention");
const transferBlockedByHold = await call(worker, "POST", "/user/transfer", {
  token: completedInitialChange.data.token,
  headers: { "idempotency-key": "account-held-transfer-test-0001" },
  body: { amount: 500, destinationAccount: "52998224725", description: "Teste de saldo retido" },
});
assert.equal(transferBlockedByHold.response.status, 400, "active holds must reduce every outgoing balance check");
assert.equal(transferBlockedByHold.data.code, "INSUFFICIENT_AVAILABLE_BALANCE");
const withdrawalBlockedByHold = await call(worker, "POST", "/user/withdraw", {
  token: completedInitialChange.data.token,
  body: { amount: 500, description: "Teste de saque com saldo retido" },
});
assert.equal(withdrawalBlockedByHold.response.status, 400, "holds must block withdrawals above available balance");
assert.equal(withdrawalBlockedByHold.data.code, "INSUFFICIENT_AVAILABLE_BALANCE");
const externalBlockedByHold = await call(worker, "POST", "/user/external-transfers", {
  token: completedInitialChange.data.token,
  headers: { "idempotency-key": "account-held-external-test-0001" },
  body: {
    amountCentavos: 500,
    channel: "PIX",
    pixKey: "external.receiver@bravus.test",
    pixKeyType: "EMAIL",
    beneficiaryName: "Recebedor Externo",
    beneficiaryDocument: "11144477735",
    description: "Teste externo com saldo retido",
  },
});
assert.equal(externalBlockedByHold.response.status, 400, "holds must block dedicated external transfers");
assert.equal(externalBlockedByHold.data.code, "INSUFFICIENT_AVAILABLE_BALANCE");
const legacyExternalBlockedByHold = await call(worker, "POST", "/user/transfer", {
  token: completedInitialChange.data.token,
  headers: { "idempotency-key": "account-held-legacy-external-0001" },
  body: { amount: 500, destinationAccount: "unknown.receiver@external.test", description: "Teste legado externo com saldo retido" },
});
assert.equal(legacyExternalBlockedByHold.response.status, 400, "holds must block legacy external transfers");
assert.equal(legacyExternalBlockedByHold.data.code, "INSUFFICIENT_AVAILABLE_BALANCE");
const adminExternalBlockedByHold = await call(worker, "POST", "/admin/ledger/external-transfers", {
  token: adminLogin.data.token,
  headers: { "idempotency-key": "account-held-admin-external-0001" },
  body: {
    userId: provisioned.data.account.id,
    amountCentavos: 500,
    channel: "PIX",
    pixKey: "admin.external.receiver@bravus.test",
    pixKeyType: "EMAIL",
    beneficiaryName: "Recebedor Admin Externo",
    beneficiaryDocument: "11144477735",
  },
});
assert.equal(adminExternalBlockedByHold.response.status, 400, "holds must block administrative outgoing transfers");
assert.equal(adminExternalBlockedByHold.data.code, "INSUFFICIENT_AVAILABLE_BALANCE");
assert.equal((await call(worker, "GET", "/user/balance", { token: completedInitialChange.data.token })).data, 345);

const blockReason = "Bloqueio administrativo de teste com revogacao imediata de sessoes.";
const blockedAccount = await call(worker, "POST", "/admin/users/" + provisionedIdentity.username + "/block", {
  token: adminLogin.data.token,
  headers: { "idempotency-key": "account-block-test-0001" },
  body: { reason: blockReason },
});
assert.equal(blockedAccount.response.status, 200, JSON.stringify(blockedAccount.data));
assert.equal(blockedAccount.data.account.isActive, false);
const blockedSession = await call(worker, "GET", "/user/profile", { token: completedInitialChange.data.token });
assert.equal(blockedSession.response.status, 401, "blocking must revoke an already authenticated session");
const blockedLogin = await call(worker, "POST", "/auth/login", {
  body: { username: provisionedIdentity.username, password: "Permanent123" },
});
assert.equal(blockedLogin.response.status, 403);
assert.equal(blockedLogin.data.code, "ACCOUNT_BLOCKED");
const blockedReplay = await call(worker, "POST", "/admin/users/" + provisionedIdentity.username + "/block", {
  token: adminLogin.data.token,
  headers: { "idempotency-key": "account-block-test-0001" },
  body: { reason: blockReason },
});
assert.equal(blockedReplay.response.status, 200);
assert.equal(blockedReplay.data.idempotentReplay, true);

const unblockReason = "Desbloqueio autorizado apos conclusao da revisao administrativa.";
const unblockedAccount = await call(worker, "POST", "/admin/users/" + provisionedIdentity.username + "/unblock", {
  token: adminLogin.data.token,
  headers: { "idempotency-key": "account-unblock-test-0001" },
  body: { reason: unblockReason },
});
assert.equal(unblockedAccount.response.status, 200, JSON.stringify(unblockedAccount.data));
assert.equal(unblockedAccount.data.account.isActive, true);
const oldSessionAfterUnblock = await call(worker, "GET", "/user/profile", { token: completedInitialChange.data.token });
assert.equal(oldSessionAfterUnblock.response.status, 401, "a session revoked by blocking must stay revoked after unblock");
const loginAfterUnblock = await call(worker, "POST", "/auth/login", {
  body: { username: provisionedIdentity.username, password: "Permanent123" },
});
assert.equal(loginAfterUnblock.response.status, 200, "unblocked account must create a fresh session");

const releaseReason = "Liberacao integral apos encerramento da revisao administrativa.";
const holdReleased = await call(worker, "POST", "/admin/users/" + provisionedIdentity.username + "/holds/" + holdPlaced.data.hold.id + "/release", {
  token: adminLogin.data.token,
  headers: { "idempotency-key": "account-balance-release-test-0001" },
  body: { reason: releaseReason },
});
assert.equal(holdReleased.response.status, 200, JSON.stringify(holdReleased.data));
assert.equal(holdReleased.data.detail.balances.availableBalanceCentavos, "12345");
assert.equal(holdReleased.data.detail.balances.ledgerBalanceCentavos, "12345");

const unauthorizedPasswordReset = await call(worker, "POST", "/admin/users/" + provisionedIdentity.username + "/password-reset", {
  token: loginAfterUnblock.data.token,
  headers: { "idempotency-key": "account-password-unauthorized-0001" },
  body: { temporaryPassword: "Temporary789", reason: "Tentativa nao autorizada de redefinicao administrativa." },
});
assert.equal(unauthorizedPasswordReset.response.status, 403);
const adminPasswordReset = await call(worker, "POST", "/admin/users/" + provisionedIdentity.username + "/password-reset", {
  token: adminLogin.data.token,
  headers: { "idempotency-key": "account-password-reset-test-0001" },
  body: { temporaryPassword: "Temporary789", reason: "Redefinicao solicitada e validada pelo atendimento administrativo." },
});
assert.equal(adminPasswordReset.response.status, 200, JSON.stringify(adminPasswordReset.data));
assert.equal(adminPasswordReset.data.passwordChangeRequired, true);
assert.equal(database.stateRow.payload.includes("Temporary789"), false, "temporary admin password must never be persisted in plaintext");
const revokedByAdminPassword = await call(worker, "GET", "/user/profile", { token: loginAfterUnblock.data.token });
assert.equal(revokedByAdminPassword.response.status, 401, "admin password reset must revoke every old session");
const temporaryLogin = await call(worker, "POST", "/auth/login", {
  body: { username: provisionedIdentity.username, password: "Temporary789" },
});
assert.equal(temporaryLogin.response.status, 403);
assert.equal(temporaryLogin.data.code, "INITIAL_PASSWORD_CHANGE_REQUIRED");
const completedAdminReset = await call(worker, "POST", "/auth/initial-password/complete", {
  body: { initialPasswordChangeToken: temporaryLogin.data.initialPasswordChangeToken, newPassword: "ControlFinal789" },
});
assert.equal(completedAdminReset.response.status, 200, JSON.stringify(completedAdminReset.data));
assert.equal(database.accountControlEvents.size, 6, "every administrative account action must have one immutable event");
assert.equal(JSON.parse(database.stateRow.payload).accountControlAudit.length, 6);
const firstControlEvent = structuredClone([...database.accountControlEvents.values()][0]);
database.accountControlEvents.set(firstControlEvent.id, { ...firstControlEvent, amountCentavos: "1" });
await assert.rejects(
  () => call(worker, "GET", "/admin/users/" + provisionedIdentity.username, { token: adminLogin.data.token }),
  /D1_ACCOUNT_CONTROL_AUDIT_MISMATCH/,
  "account control event content must reconcile before any request is served",
);
database.accountControlEvents.set(firstControlEvent.id, firstControlEvent);
worker = await loadWorker("after-account-control-audit-check");

worker = await loadWorker("restart-after-provision");
const reserveAfterRestart = await call(worker, "GET", "/admin/ledger/balance-sheet", { token: adminLogin.data.token });
assert.equal(reserveAfterRestart.response.status, 200);
assert.equal(reserveAfterRestart.data.masterCreditReserve.totalAmountCentavos, "100000000000000000");
assert.equal(database.masterCreditReserve.total_amount_centavos, "100000000000000000");
assert.equal(reserveAfterRestart.data.masterCreditReserve.availableCentavos, "99999999999987655");
assert.equal(JSON.parse(database.stateRow.payload).users[provisionedIdentity.username].balance, 12345);
assert.equal(database.institutionalReserveAudits.size, 1, "restart must not duplicate reserve audit events");
const provisionedLoginAfterRestart = await call(worker, "POST", "/auth/login", {
  body: { username: provisionedIdentity.email, password: "ControlFinal789" },
});
assert.equal(provisionedLoginAfterRestart.response.status, 200, "provisioned account and changed password must survive restart");
const signedOut = await call(worker, "POST", "/auth/logout", { token: provisionedLoginAfterRestart.data.token });
assert.equal(signedOut.response.status, 200);
const revokedByLogout = await call(worker, "GET", "/user/profile", { token: provisionedLoginAfterRestart.data.token });
assert.equal(revokedByLogout.response.status, 401, "logout must revoke the server-side session");
const pendingKyc = await call(worker, "GET", "/admin/kyc/pending", { token: adminLogin.data.token });
assert.equal(pendingKyc.data.some((item) => item.username === registrationIdentity.username), true);
const registrationKycEnrollment = await call(worker, "POST", "/user/kyc/enroll", {
  token: customerLogin.data.token,
  headers: { "idempotency-key": "registration-kyc-documents-only-0001" },
  body: {
    documentFrontImage: image(11, 4200),
    documentBackImage: image(22, 4200),
  },
});
assert.equal(registrationKycEnrollment.response.status, 201, JSON.stringify(registrationKycEnrollment.data));
const kycEvidence = await call(worker, "GET", "/admin/kyc/" + registrationIdentity.username + "/evidence", { token: adminLogin.data.token });
assert.equal(kycEvidence.response.status, 200, JSON.stringify(kycEvidence.data));
assert.match(kycEvidence.data.documentFront, /^data:image\/png;base64,/);
assert.match(kycEvidence.data.documentBack, /^data:image\/png;base64,/);
assert.equal(kycEvidence.data.face, null, "post-login KYC no longer captures facial biometrics");
assert.equal(kycEvidence.data.faceRemovedByPolicy, true);
assert.equal(kycEvidence.response.headers.get("cache-control"), "no-store");
const invalidKycApproval = await call(worker, "POST", "/admin/kyc/" + registrationIdentity.username + "/approve", {
  token: adminLogin.data.token,
  body: { reason: "curto" },
});
assert.equal(invalidKycApproval.response.status, 400, "KYC review must require an auditable reason");
const kycApproval = await call(worker, "POST", "/admin/kyc/" + registrationIdentity.username + "/approve", {
  token: adminLogin.data.token,
  body: { reason: "Frente e verso do documento conferidos manualmente pelo administrador." },
});
assert.equal(kycApproval.response.status, 200, JSON.stringify(kycApproval.data));
assert.equal(kycApproval.data.statusKyc, "APROVADO_IDENTIDADE");
assert.equal(database.kycAudits.size, 2, "KYC decisions must be mirrored to immutable audit storage");
const approvedEvidence = await call(worker, "GET", "/admin/kyc/" + registrationIdentity.username + "/evidence", { token: adminLogin.data.token });
assert.equal(approvedEvidence.response.status, 200, "KYC evidence must remain reviewable after a decision");
const approvedOutgoing = await call(worker, "POST", "/user/transfer", {
  token: customerLogin.data.token,
  headers: { "idempotency-key": "approved-kyc-transfer-0001" },
  body: { amount: 100, destinationAccount: "05569161155", description: "Transferencia apos aprovacao KYC" },
});
assert.equal(approvedOutgoing.response.status, 200, JSON.stringify(approvedOutgoing.data));
assert.equal((await call(worker, "GET", "/user/balance", { token: customerLogin.data.token })).data, 900);

const rejectedIdentity = {
  clientChannel: "ANDROID_APK",
  username: "rejected.identity",
  email: "rejected.identity@bravus.test",
  cpf: "11144477735",
};
const rejectedProvision = await call(worker, "POST", "/admin/accounts/provision", {
  token: adminLogin.data.token,
  headers: { "idempotency-key": "account-provision-rejected-identity-0001" },
  body: {
    ...rejectedIdentity,
    fullName: "Cliente Identidade Rejeitada",
    initialPassword: "NovaSenha123",
  },
});
assert.equal(rejectedProvision.response.status, 201, JSON.stringify(rejectedProvision.data));
const rejectedInitialLogin = await call(worker, "POST", "/auth/login", {
  body: { username: rejectedIdentity.username, password: "NovaSenha123" },
});
assert.equal(rejectedInitialLogin.response.status, 403);
const rejectedInitialChange = await call(worker, "POST", "/auth/initial-password/complete", {
  body: { initialPasswordChangeToken: rejectedInitialLogin.data.initialPasswordChangeToken, newPassword: "RejectedFinal123" },
});
assert.equal(rejectedInitialChange.response.status, 200, JSON.stringify(rejectedInitialChange.data));
const rejectedEnrollment = await call(worker, "POST", "/user/kyc/enroll", {
  token: rejectedInitialChange.data.token,
  headers: { "idempotency-key": "rejected-kyc-documents-only-0001" },
  body: {
    documentFrontImage: image(56, 4200),
    documentBackImage: image(57, 4200),
  },
});
assert.equal(rejectedEnrollment.response.status, 201, JSON.stringify(rejectedEnrollment.data));
const clientSecret = "c".repeat(64);
const reset = await call(worker, "POST", "/auth/password-reset/start", {
  body: { identifier: "52998224725", clientSecret, idempotencyKey: "password-reset-d1-idempotency-0001" },
});
assert.equal(reset.response.status, 202, JSON.stringify(reset.data));
assert.equal(reset.data.status, "ADMIN_PENDING", "forgot password must create an admin-only request");
const resetReplay = await call(worker, "POST", "/auth/password-reset/start", {
  body: { identifier: "52998224725", clientSecret, idempotencyKey: "password-reset-d1-idempotency-0001" },
});
assert.equal(resetReplay.data.requestId, reset.data.requestId, "reset start must be idempotent");
const face = await call(worker, "POST", "/auth/password-reset/face", {
  body: { requestId: reset.data.requestId, clientSecret, challenge: reset.data.challenge, faceImage: image(44, 3300) },
});
assert.equal(face.data.code, "PASSWORD_RESET_ADMIN_ONLY", JSON.stringify(face.data));

const pending = await call(worker, "GET", "/admin/password-reset/requests", { token: adminLogin.data.token });
assert.equal(pending.data.some((item) => item.requestId === reset.data.requestId), true);
const publicComplete = await call(worker, "POST", "/auth/password-reset/complete", {
  body: { requestId: reset.data.requestId, clientSecret, newPassword: "SenhaFinal456" },
});
assert.equal(publicComplete.response.status, 400, "public password reset completion must be disabled");
assert.equal(publicComplete.data.code, "PASSWORD_RESET_ADMIN_ONLY");
const adminPasswordFromForgot = await call(worker, "POST", "/admin/users/" + registrationIdentity.username + "/password-reset", {
  token: adminLogin.data.token,
  headers: { "idempotency-key": "forgot-admin-temp-password-0001" },
  body: { temporaryPassword: "SenhaTemp789", reason: "Solicitacao de esqueci minha senha recebida no login." },
});
assert.equal(adminPasswordFromForgot.response.status, 200, JSON.stringify(adminPasswordFromForgot.data));
const pendingAfterAdminReset = await call(worker, "GET", "/admin/password-reset/requests", { token: adminLogin.data.token });
assert.equal(pendingAfterAdminReset.data.some((item) => item.requestId === reset.data.requestId), false, "admin temporary password must close pending reset request");
const tempLogin = await call(worker, "POST", "/auth/login", {
  body: { username: "52998224725", password: "SenhaTemp789" },
});
assert.equal(tempLogin.response.status, 403, "admin temporary password must require in-app change");
assert.equal(tempLogin.data.code, "INITIAL_PASSWORD_CHANGE_REQUIRED");
const complete = await call(worker, "POST", "/auth/initial-password/complete", {
  body: { initialPasswordChangeToken: tempLogin.data.initialPasswordChangeToken, newPassword: "SenhaFinal456" },
});
assert.equal(complete.response.status, 200, JSON.stringify(complete.data));
const revoked = await call(worker, "GET", "/user/profile", { token: customerLogin.data.token });
assert.equal(revoked.response.status, 401, "admin password reset must revoke prior sessions");
worker = await loadWorker("restart-after-password-reset");
const finalLogin = await call(worker, "POST", "/auth/login", { body: { username: "52998224725", password: "SenhaFinal456" } });
assert.equal(finalLogin.response.status, 200, "new password must survive worker restart");
const secondFinalLogin = await call(worker, "POST", "/auth/login", { body: { username: "52998224725", password: "SenhaFinal456" } });
assert.equal(secondFinalLogin.response.status, 200, "user must be able to hold a second active session before changing the password");
const unauthorizedInAccountPasswordChange = await call(worker, "POST", "/user/password/change", {
  body: { currentPassword: "SenhaFinal456", newPassword: "SenhaInterna789" },
});
assert.equal(unauthorizedInAccountPasswordChange.response.status, 401, "in-account password change must require authentication");
const weakInAccountPasswordChange = await call(worker, "POST", "/user/password/change", {
  token: finalLogin.data.token,
  body: { currentPassword: "SenhaFinal456", newPassword: "fraca" },
});
assert.equal(weakInAccountPasswordChange.response.status, 400);
assert.equal(weakInAccountPasswordChange.data.code, "WEAK_PASSWORD");
const wrongCurrentPasswordChange = await call(worker, "POST", "/user/password/change", {
  token: finalLogin.data.token,
  body: { currentPassword: "SenhaErrada456", newPassword: "SenhaInterna789" },
});
assert.equal(wrongCurrentPasswordChange.response.status, 400);
assert.equal(wrongCurrentPasswordChange.data.code, "CURRENT_PASSWORD_INVALID");
const reusedInAccountPassword = await call(worker, "POST", "/user/password/change", {
  token: finalLogin.data.token,
  body: { currentPassword: "SenhaFinal456", newPassword: "SenhaFinal456" },
});
assert.equal(reusedInAccountPassword.response.status, 400);
assert.equal(reusedInAccountPassword.data.code, "PASSWORD_REUSE");
const changedInAccountPassword = await call(worker, "POST", "/user/password/change", {
  token: finalLogin.data.token,
  body: { currentPassword: "SenhaFinal456", newPassword: "SenhaInterna789" },
});
assert.equal(changedInAccountPassword.response.status, 200, JSON.stringify(changedInAccountPassword.data));
assert.equal(changedInAccountPassword.data.status, "PASSWORD_CHANGED");
assert.equal((await call(worker, "GET", "/user/profile", { token: finalLogin.data.token })).response.status, 200, "current session must survive its own password change");
assert.equal((await call(worker, "GET", "/user/profile", { token: secondFinalLogin.data.token })).response.status, 401, "other sessions must be revoked after a password change");
const rejectedOldPassword = await call(worker, "POST", "/auth/login", { body: { username: "52998224725", password: "SenhaFinal456" } });
assert.equal(rejectedOldPassword.response.status, 400, "old password must stop working immediately");
assert.equal(database.stateRow.payload.includes("SenhaInterna789"), false, "the new user password must never be persisted in plaintext");
worker = await loadWorker("restart-after-in-account-password-change");
const changedPasswordLogin = await call(worker, "POST", "/auth/login", { body: { username: "52998224725", password: "SenhaInterna789" } });
assert.equal(changedPasswordLogin.response.status, 200, "in-account password change must survive worker restart");
const finalAdminLogin = await call(worker, "POST", "/auth/login", { body: { username: "admin@bravusbank.com", password: "6run0955" } });
const finalAdminToken = finalAdminLogin.data.token;
const persistence = await call(worker, "GET", "/admin/persistence/status", { token: finalAdminToken });
assert.equal(persistence.data.backend, "D1");
assert.equal(persistence.data.durable, true);
assert.equal(persistence.data.ledgerValid, true);
assert.equal(persistence.data.kycEvidenceSchemaReady, true);
assert.equal(persistence.data.immutableKycAuditCount, 2);
assert.equal(persistence.data.immutableAccountControlEventCount, 7);
assert.equal(persistence.data.accountControlAuditReconciled, true);
assert.ok(database.audits.size >= 10, "persistent state changes must be audited");

const validStateRow = structuredClone(database.stateRow);
const corruptedState = JSON.parse(validStateRow.payload);
corruptedState.ledgerEntries.push({
  transferId: "corrupted-ledger-test",
  entryType: "debit",
  accountNumber: "000000000",
  signedAmountCentavos: -1,
  currency: "BRL",
  reason: "TEST_ONLY_CORRUPTION",
  createdAt: new Date().toISOString(),
});
database.stateRow.payload = JSON.stringify(corruptedState);
database.stateRow.payload_hash = createHash("sha256").update(database.stateRow.payload).digest("hex");
worker = await loadWorker("corrupted-ledger-must-fail-closed");
await assert.rejects(
  () => call(worker, "GET", "/admin/ledger/balance-sheet", { token: finalAdminToken }),
  /D1_FINANCIAL_VALIDATION_FAILED/,
  "an unbalanced ledger must fail closed instead of reporting a healthy balance sheet",
);
database.stateRow = validStateRow;

const validReserve = structuredClone(database.masterCreditReserve);
database.masterCreditReserve.total_amount_centavos = "100000000000000001";
worker = await loadWorker("tampered-reserve-must-fail-closed");
await assert.rejects(
  () => call(worker, "GET", "/admin/ledger/balance-sheet", { token: finalAdminToken }),
  /D1_MASTER_CREDIT_RESERVE_HASH_MISMATCH/,
  "a reserve value that does not match its immutable declaration must fail closed",
);
database.masterCreditReserve = validReserve;
const validStateBeforeOverAllocation = structuredClone(database.stateRow);
const unsupportedPolicyState = JSON.parse(validStateBeforeOverAllocation.payload);
unsupportedPolicyState.masterCreditGrants.push({
  id: "unsupported-policy-test",
  userId: 2,
  username: "joao.victor",
  reserveCode: "BRAVUS_MASTER_CREDIT_RESERVE",
  amountCentavos: "1",
  status: "PENDENTE",
  annualInterestRate: 1,
  assessmentReason: "TEST_ONLY",
  eligibilityRule: "TEST_ONLY",
  assessedBy: "TEST_ONLY",
  assessedAt: new Date().toISOString(),
});
database.stateRow.payload = JSON.stringify(unsupportedPolicyState);
database.stateRow.payload_hash = createHash("sha256").update(database.stateRow.payload).digest("hex");
worker = await loadWorker("unsupported-master-credit-policy-must-fail-closed");
await assert.rejects(
  () => call(worker, "GET", "/admin/ledger/balance-sheet", { token: finalAdminToken }),
  /MASTER_CREDIT_GRANT_POLICY_INVALID/,
  "an intermediate or interest-bearing grant must not be silently reclassified",
);
database.stateRow = structuredClone(validStateBeforeOverAllocation);
const overAllocatedState = JSON.parse(validStateBeforeOverAllocation.payload);
overAllocatedState.masterCreditGrants.push({
  id: "over-allocation-test",
  userId: 1,
  username: "joao.victor",
  reserveCode: "BRAVUS_MASTER_CREDIT_RESERVE",
  amountCentavos: "100000000000000001",
  status: "PENDENTE",
  productType: "NON_REPAYABLE_BOOK_CREDIT",
  repayable: false,
  interestBearing: false,
  policyVersion: 1,
  assessmentReason: "TEST_ONLY",
  eligibilityRule: "TEST_ONLY",
  assessedBy: "TEST_ONLY",
  assessedAt: new Date().toISOString(),
});
database.stateRow.payload = JSON.stringify(overAllocatedState);
database.stateRow.payload_hash = createHash("sha256").update(database.stateRow.payload).digest("hex");
worker = await loadWorker("over-allocated-reserve-must-fail-closed");
await assert.rejects(
  () => call(worker, "GET", "/admin/ledger/balance-sheet", { token: finalAdminToken }),
  /MASTER_CREDIT_RESERVE_INCONSISTENT/,
  "master credit commitments above the reserve must fail closed",
);
database.stateRow = structuredClone(validStateBeforeOverAllocation);
worker = await loadWorker("restart-after-corruption-tests");
const healthyAfterCorruptionTests = await call(worker, "GET", "/admin/ledger/balance-sheet", { token: finalAdminToken });
assert.equal(healthyAfterCorruptionTests.data.accounting.balanced, true);
assert.equal(healthyAfterCorruptionTests.data.accounting.ledgerReconciled, true);

console.log(JSON.stringify({
  result: "ok",
  revision: database.stateRow.revision,
  audits: database.audits.size,
  ledgerEntries: database.ledgerEntries.size,
  biometricEvidence: database.biometricEvidence.size,
  restartVerified: true,
  idempotencyVerified: true,
  passwordResetVerified: true,
  inAccountPasswordChangeVerified: true,
  masterCreditReserveVerified: true,
  masterCreditGrantLifecycleVerified: true,
  masterCreditKycAuthorizationVerified: true,
  masterCreditMissingKycBlocked: true,
  masterCreditEventContentReconciled: true,
  masterCreditOverAllocationRejected: true,
  unsupportedMasterCreditPolicyRejected: true,
  corruptedLedgerRejected: true,
  tamperedReserveRejected: true,
  manualAdminAccountCreationVerified: true,
  provisionedAccountVerified: true,
  initialPasswordReissueVerified: true,
  provisionedKycEnrollmentVerified: true,
  serverLogoutVerified: true,
  registrationPreflightVerified: true,
  registrationFaceTokenVerified: true,
  pendingKycOutgoingBlocked: true,
  auditedKycApprovalVerified: true,
  rejectedIdentityLoginBlocked: true,
  immutableKycAuditVerified: true,
  accountControlLifecycleVerified: true,
  accountControlAuditReconciled: true,
  balanceHoldEnforcedAcrossOutgoingFlows: true,
  adminPasswordResetVerified: true,
}, null, 2));
