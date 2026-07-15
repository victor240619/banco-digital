import assert from "node:assert/strict";
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
    throw new Error("Unsupported D1 first(): " + this.sql);
  }
}

class FakeD1 {
  constructor() {
    this.stateRow = null;
    this.audits = new Map();
    this.ledgerEntries = new Map();
    this.biometricEvidence = new Map();
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
    });
    try {
      return statements.map((statement) => ({ meta: { changes: this.execute(statement) } }));
    } catch (error) {
      this.stateRow = snapshot.stateRow;
      this.audits = new Map(snapshot.audits);
      this.ledgerEntries = new Map(snapshot.ledgerEntries);
      this.biometricEvidence = new Map(snapshot.biometricEvidence);
      throw error;
    }
  }

  execute(statement) {
    const sql = statement.sql;
    const values = statement.bindings;
    if (sql.startsWith("CREATE TABLE") || sql.startsWith("CREATE TRIGGER")) return 0;

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
      this.biometricEvidence.set(values[0], {
        id: values[0], kind: values[1], owner_username: values[2], mime: values[3], ciphertext: values[4],
        iv: values[5], sha256: values[6], created_at: values[7],
      });
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
assert.equal(webAvailability.response.status, 403, "web clients must not open mobile-only accounts");

const lowResolutionFace = await call(worker, "POST", "/auth/register/face-check", {
  headers: mobileHeaders,
  body: {
    ...registrationIdentity,
    faceImage: image(33, 3200, 120, 120),
    biometricChallenge: "FACE_CAMERA_CAPTURE_V1",
  },
});
assert.equal(lowResolutionFace.response.status, 400, "low-resolution facial capture must be rejected");

const registrationFace = image(33, 3200);
const faceCheck = await call(worker, "POST", "/auth/register/face-check", {
  headers: mobileHeaders,
  body: {
    ...registrationIdentity,
    faceImage: registrationFace,
    biometricChallenge: "FACE_CAMERA_CAPTURE_V1",
  },
});
assert.equal(faceCheck.response.status, 200, JSON.stringify(faceCheck.data));
assert.equal(faceCheck.data.status, "CAPTURE_VALIDATED");
assert.ok(faceCheck.data.faceVerificationToken);

const missingFaceToken = await call(worker, "POST", "/auth/register", {
  headers: mobileHeaders,
  body: {
    ...registrationIdentity,
    fullName: "Cliente Persistencia D1",
    password: "NovaSenha123",
    documentFrontImage: image(11, 4200),
    documentBackImage: image(22, 4200),
    faceImage: registrationFace,
    biometricChallenge: "FACE_CAMERA_CAPTURE_V1",
  },
});
assert.equal(missingFaceToken.response.status, 400, "facial verification token must be mandatory");

const invalidFaceToken = await call(worker, "POST", "/auth/register", {
  headers: mobileHeaders,
  body: {
    ...registrationIdentity,
    fullName: "Cliente Persistencia D1",
    password: "NovaSenha123",
    documentFrontImage: image(11, 4200),
    documentBackImage: image(22, 4200),
    faceImage: registrationFace,
    biometricChallenge: "FACE_CAMERA_CAPTURE_V1",
    faceVerificationToken: "invalid-face-token",
  },
});
assert.equal(invalidFaceToken.response.status, 400, "unknown facial verification token must fail closed");

const register = await call(worker, "POST", "/auth/register", {
  headers: mobileHeaders,
  body: {
    ...registrationIdentity,
    fullName: "Cliente Persistencia D1",
    password: "NovaSenha123",
    documentFrontImage: image(11, 4200),
    documentBackImage: image(22, 4200),
    faceImage: registrationFace,
    biometricChallenge: "FACE_CAMERA_CAPTURE_V1",
    faceVerificationToken: faceCheck.data.faceVerificationToken,
  },
});
assert.equal(register.response.status, 200, JSON.stringify(register.data));
assert.equal(database.biometricEvidence.size, 3, "documents and enrolled face must be encrypted outside the state payload");
assert.equal(database.stateRow.payload.includes(registrationFace), false, "raw biometric image must not be stored in the JSON state");
assert.equal(JSON.parse(database.stateRow.payload).users[registrationIdentity.username].statusKyc, "PENDENTE_VALIDACAO_IDENTIDADE");
const usersAfterRegister = Object.keys(JSON.parse(database.stateRow.payload).users).length;
const duplicateRegister = await call(worker, "POST", "/auth/register", {
  headers: mobileHeaders,
  body: { ...registrationIdentity, fullName: "Duplicado", password: "NovaSenha123" },
});
assert.equal(duplicateRegister.response.status, 409, "duplicate account must be rejected before requesting biometrics");
assert.equal(Object.keys(JSON.parse(database.stateRow.payload).users).length, usersAfterRegister);

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
const customerBalance = await call(worker, "GET", "/user/balance", { token: register.data.token });
assert.equal(customerBalance.data, 1000, "beneficiary must receive the internal transfer");
const pendingOutgoing = await call(worker, "POST", "/user/transfer", {
  token: register.data.token,
  headers: { "idempotency-key": "pending-kyc-transfer-0001" },
  body: { amount: 100, destinationAccount: "05569161155", description: "Deve bloquear KYC pendente" },
});
assert.equal(pendingOutgoing.response.status, 403, "pending identity must fail closed for outgoing transfers");
assert.equal(pendingOutgoing.data.code, "KYC_IDENTITY_PENDING");
assert.equal((await call(worker, "GET", "/user/balance", { token: register.data.token })).data, 1000);
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
const customerLogin = await call(worker, "POST", "/auth/login", { body: { username: "52998224725", password: "NovaSenha123" } });
assert.equal(customerLogin.response.status, 200, "registered user must survive worker restart");
const persistedBalance = await call(worker, "GET", "/user/balance", { token: customerLogin.data.token });
assert.equal(persistedBalance.data, 1000, "balance must survive worker restart");

const adminLogin = await call(worker, "POST", "/auth/login", { body: { username: "admin@bravusbank.com", password: "6run0955" } });
assert.equal(adminLogin.response.status, 200);
const pendingKyc = await call(worker, "GET", "/admin/kyc/pending", { token: adminLogin.data.token });
assert.equal(pendingKyc.data.some((item) => item.username === registrationIdentity.username), true);
const kycEvidence = await call(worker, "GET", "/admin/kyc/" + registrationIdentity.username + "/evidence", { token: adminLogin.data.token });
assert.equal(kycEvidence.response.status, 200, JSON.stringify(kycEvidence.data));
assert.match(kycEvidence.data.documentFront, /^data:image\/png;base64,/);
assert.match(kycEvidence.data.documentBack, /^data:image\/png;base64,/);
assert.match(kycEvidence.data.face, /^data:image\/png;base64,/);
assert.equal(kycEvidence.response.headers.get("cache-control"), "no-store");
const invalidKycApproval = await call(worker, "POST", "/admin/kyc/" + registrationIdentity.username + "/approve", {
  token: adminLogin.data.token,
  body: { reason: "curto" },
});
assert.equal(invalidKycApproval.response.status, 400, "KYC review must require an auditable reason");
const kycApproval = await call(worker, "POST", "/admin/kyc/" + registrationIdentity.username + "/approve", {
  token: adminLogin.data.token,
  body: { reason: "Documentos e captura facial conferidos manualmente pelo administrador." },
});
assert.equal(kycApproval.response.status, 200, JSON.stringify(kycApproval.data));
assert.equal(kycApproval.data.statusKyc, "APROVADO_IDENTIDADE");
const approvedOutgoing = await call(worker, "POST", "/user/transfer", {
  token: customerLogin.data.token,
  headers: { "idempotency-key": "approved-kyc-transfer-0001" },
  body: { amount: 100, destinationAccount: "05569161155", description: "Transferencia apos aprovacao KYC" },
});
assert.equal(approvedOutgoing.response.status, 200, JSON.stringify(approvedOutgoing.data));
assert.equal((await call(worker, "GET", "/user/balance", { token: customerLogin.data.token })).data, 900);

const clientSecret = "c".repeat(64);
const reset = await call(worker, "POST", "/auth/password-reset/start", {
  body: { identifier: "52998224725", clientSecret, idempotencyKey: "password-reset-d1-idempotency-0001" },
});
assert.equal(reset.response.status, 202, JSON.stringify(reset.data));
const resetReplay = await call(worker, "POST", "/auth/password-reset/start", {
  body: { identifier: "52998224725", clientSecret, idempotencyKey: "password-reset-d1-idempotency-0001" },
});
assert.equal(resetReplay.data.requestId, reset.data.requestId, "reset start must be idempotent");
const face = await call(worker, "POST", "/auth/password-reset/face", {
  body: { requestId: reset.data.requestId, clientSecret, challenge: reset.data.challenge, faceImage: image(44, 3300) },
});
assert.equal(face.data.status, "REVIEW_PENDING", JSON.stringify(face.data));
assert.equal(database.biometricEvidence.size, 4, "submitted face must be encrypted in immutable evidence storage");

const pending = await call(worker, "GET", "/admin/password-reset/requests", { token: adminLogin.data.token });
assert.equal(pending.data.some((item) => item.requestId === reset.data.requestId), true);
const evidence = await call(worker, "GET", "/admin/password-reset/requests/" + reset.data.requestId + "/evidence", { token: adminLogin.data.token });
assert.equal(evidence.response.status, 200, JSON.stringify(evidence.data));
assert.match(evidence.data.enrolledFace, /^data:image\/png;base64,/);
assert.match(evidence.data.submittedFace, /^data:image\/png;base64,/);
assert.equal(evidence.response.headers.get("cache-control"), "no-store");

const approval = await call(worker, "POST", "/admin/password-reset/requests/" + reset.data.requestId + "/approve", {
  token: adminLogin.data.token,
  body: { reason: "Identidade comparada e aprovada em revisao humana." },
});
assert.equal(approval.data.status, "VERIFIED", JSON.stringify(approval.data));
const status = await call(worker, "POST", "/auth/password-reset/status", {
  body: { requestId: reset.data.requestId, clientSecret },
});
assert.equal(status.data.status, "VERIFIED");
const complete = await call(worker, "POST", "/auth/password-reset/complete", {
  body: { requestId: reset.data.requestId, clientSecret, newPassword: "SenhaFinal456" },
});
assert.equal(complete.data.status, "CONSUMED", JSON.stringify(complete.data));
const revoked = await call(worker, "GET", "/user/profile", { token: customerLogin.data.token });
assert.equal(revoked.response.status, 401, "password reset must revoke prior sessions");

worker = await loadWorker("restart-after-password-reset");
const finalLogin = await call(worker, "POST", "/auth/login", { body: { username: "52998224725", password: "SenhaFinal456" } });
assert.equal(finalLogin.response.status, 200, "new password must survive worker restart");
const persistence = await call(worker, "GET", "/admin/persistence/status", { token: (await call(worker, "POST", "/auth/login", { body: { username: "admin@bravusbank.com", password: "6run0955" } })).data.token });
assert.equal(persistence.data.backend, "D1");
assert.equal(persistence.data.durable, true);
assert.equal(persistence.data.ledgerValid, true);
assert.ok(database.audits.size >= 10, "persistent state changes must be audited");

console.log(JSON.stringify({
  result: "ok",
  revision: database.stateRow.revision,
  audits: database.audits.size,
  ledgerEntries: database.ledgerEntries.size,
  biometricEvidence: database.biometricEvidence.size,
  restartVerified: true,
  idempotencyVerified: true,
  passwordResetVerified: true,
  registrationPreflightVerified: true,
  registrationFaceTokenVerified: true,
  pendingKycOutgoingBlocked: true,
  auditedKycApprovalVerified: true,
}, null, 2));
