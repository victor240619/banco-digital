import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, extname, join, relative, resolve } from "node:path";
import { spawn } from "node:child_process";

const root = resolve(new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const distDir = join(root, "bravus-bank-frontend", "dist");
const artifactDir = join(tmpdir(), "bravus-sites-embedded-artifact");
const archivePath = join(tmpdir(), `bravus-bank-sites-${Date.now()}.tar.gz`);

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".apk": "application/vnd.android.package-archive",
  ".ico": "image/x-icon",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".webp": "image/webp",
};

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walk(fullPath));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

function tar(args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn("tar", args, { stdio: "inherit" });
    child.on("exit", (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`tar exited with ${code}`));
    });
  });
}

function command(file, args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(file, args, { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("exit", (code) => {
      if (code === 0) resolvePromise(stdout.trim());
      else reject(new Error(`${file} ${args.join(" ")} exited with ${code}: ${stderr}`));
    });
  });
}

const snapshotUrl = process.env.BRAVUS_SITES_SNAPSHOT_URL || "https://bravus-bank-240619.victor2406.chatgpt.site";

async function fetchLiveJson(path, token = "sites-admin-token") {
  const url = new URL(path, snapshotUrl).toString();
  try {
    const response = await fetch(url, {
      headers: { authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      throw new Error(`snapshot ${path} returned ${response.status}`);
    }
    return response.json();
  } catch (error) {
    const curl = process.platform === "win32" ? "curl.exe" : "curl";
    const tlsArgs = process.platform === "win32" ? ["--ssl-no-revoke"] : [];
    const body = await command(curl, ["-fsSL", ...tlsArgs, "-H", `authorization: Bearer ${token}`, url]);
    return JSON.parse(body);
  }
}

function rolesForSnapshotUser(user) {
  return String(user.username || "").includes("admin")
    ? ["ROLE_ADMIN"]
    : ["ROLE_USER"];
}

async function loadLiveSeed() {
  if (process.env.BRAVUS_SITES_TEST_BUILD === "1") {
    const createdAt = "2026-01-01T00:00:00.000Z";
    return {
      verified: "TEST_ONLY",
      capturedAt: createdAt,
      source: "local-test-fixture",
      users: {},
      transactions: [{
        id: 1,
        username: "joao.victor",
        type: "WITHDRAWAL",
        amount: 100000,
        description: "Fixture contabil D1",
        status: "COMPLETED",
        createdAt,
      }],
      externalTransfers: [],
      globalRailParticipants: [],
      ledgerEntries: [
        {
          id: 1, transferId: "sites-transaction-1-WITHDRAWAL", transactionId: 1,
          accountUsername: "joao.victor", accountNumber: "0556916115", entryType: "debit",
          signedAmountCentavos: -100000, currency: "BRL", reason: "TEST_FIXTURE", createdAt,
        },
        {
          id: 2, transferId: "sites-transaction-1-WITHDRAWAL", transactionId: 1,
          accountUsername: "BRAVUS_LEDGER", accountNumber: "BRAVUS-LEDGER", entryType: "credit",
          signedAmountCentavos: 100000, currency: "BRL", reason: "TEST_FIXTURE", createdAt,
        },
      ],
    };
  }
  try {
    const [users, transactions, externalTransfers, globalRailParticipants, ledgerEntries] = await Promise.all([
      fetchLiveJson("/api/admin/users"),
      fetchLiveJson("/api/admin/transactions"),
      fetchLiveJson("/api/admin/ledger/external-transfers"),
      fetchLiveJson("/api/admin/global-rail/participants"),
      fetchLiveJson("/api/admin/ledger/entries").catch(() => ({ content: [] })),
    ]);
    const ledgerList = Array.isArray(ledgerEntries)
      ? ledgerEntries
      : Array.isArray(ledgerEntries?.content)
        ? ledgerEntries.content
        : [];
    const usersByUsername = {};
    for (const user of Array.isArray(users) ? users : []) {
      if (!user?.username) continue;
      usersByUsername[user.username] = {
        ...user,
        active: typeof user.active === "boolean" ? user.active : user.isActive !== false,
        roles: Array.isArray(user.roles) ? user.roles : rolesForSnapshotUser(user),
      };
    }
    const requiredUsers = ["admin@bravusbank.com", "joao.victor", "francisca.reis"];
    const missingUsers = requiredUsers.filter((username) => !usersByUsername[username]);
    const ledgerNet = ledgerList.reduce(
      (sum, entry) => sum + Number(entry?.signedAmountCentavos || 0),
      0,
    );
    if (missingUsers.length) {
      throw new Error(`snapshot missing required users: ${missingUsers.join(", ")}`);
    }
    if (!Array.isArray(transactions) || transactions.length === 0) {
      throw new Error("snapshot has no financial transactions");
    }
    if (!Array.isArray(externalTransfers) || externalTransfers.length === 0) {
      throw new Error("snapshot has no transfer receipts");
    }
    if (ledgerList.length === 0 || ledgerNet !== 0) {
      throw new Error(`snapshot ledger is unavailable or unbalanced: net=${ledgerNet}`);
    }
    return {
      verified: true,
      capturedAt: new Date().toISOString(),
      source: snapshotUrl,
      users: usersByUsername,
      transactions: Array.isArray(transactions) ? transactions : [],
      externalTransfers: Array.isArray(externalTransfers) ? externalTransfers : [],
      globalRailParticipants: Array.isArray(globalRailParticipants) ? globalRailParticipants : [],
      ledgerEntries: ledgerList,
    };
  } catch (error) {
    console.warn(`Sites live snapshot unavailable; the worker will require an existing D1 state: ${error.message}`);
    return {
      verified: false,
      capturedAt: null,
      source: snapshotUrl,
      users: {},
      transactions: [],
      externalTransfers: [],
      globalRailParticipants: [],
      ledgerEntries: [],
    };
  }
}

const liveSeed = await loadLiveSeed();

const files = {};
for (const file of await walk(distDir)) {
  const route = `/${relative(distDir, file).replaceAll("\\", "/")}`;
  const type = contentTypes[extname(file).toLowerCase()] || "application/octet-stream";
  if (extname(file).toLowerCase() === ".apk") {
    files[route] = {
      type,
      externalUrl: "https://raw.githubusercontent.com/victor240619/banco-digital/codex/master-live-apk/bravus-bank-frontend/public/downloads/" + basename(file),
    };
    continue;
  }
  files[route] = { type, body: (await readFile(file)).toString("base64") };
}
files["/"] = files["/index.html"];

const entrypoint = `const buildTarget = "bravus-sites-api-d1-v2";
const files = ${JSON.stringify(files)};
const liveSeed = ${JSON.stringify(liveSeed)};
const now = () => new Date().toISOString();
const bravusInstitutionProfile = Object.freeze({
  institutionName: "Bravus Premium Bank",
  countryCode: "KY",
  currency: "KYD",
  internalRoutingCode: "BRAV-KY-INTERNAL",
  swiftBic: "BRAVKYK0XXX",
  swiftBicStatus: "INTERNAL_TEST_ONLY_UNREGISTERED",
  swiftBicRegistered: false,
  swiftConnected: false,
  swiftExternalRoutingEnabled: false,
});
const registrationCheckDeduplicationMs = 30 * 1000;
const institutionalReserveSeed = Object.freeze({
  code: "BRAVUS_INSTITUTIONAL_RESERVE",
  name: "Reserva Institucional Bravus",
  amountCentavos: "100000000000000000",
  currency: "BRL",
  classification: "INSTITUTIONAL",
  status: "DECLARED",
  customerFunds: false,
  transferable: false,
  sourceReference: "OWNER_DECLARATION",
  policyVersion: 1,
  payloadHash: "15fd35def62b676d26bea6568134e5dd059000d2998edd60ec3a2e0992f3e2fa",
  declaredAt: "2026-07-15T00:00:00-03:00",
});
const masterCreditReserveSeed = Object.freeze({
  code: "BRAVUS_MASTER_CREDIT_RESERVE",
  name: "Reserva Mestre de Credito Escritural",
  totalAmountCentavos: "100000000000000000",
  currency: "BRL",
  classification: "MASTER_BOOK_CREDIT",
  status: "ACTIVE",
  transferScope: "ADMIN_APPROVED_CUSTOMERS",
  adminOnly: true,
  policyVersion: 1,
  payloadHash: "9b210dda96d850f85bcd09a80d5e6b988b66593860b141d4bb688195c0abd022",
  activatedAt: "2026-07-15T00:00:00-03:00",
});
const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, PUT, DELETE, OPTIONS",
  "access-control-allow-headers": "authorization, content-type, x-bravus-client, idempotency-key",
  "access-control-max-age": "86400",
};
const legacyPasswordCredential = Object.freeze({
  algorithm: "PBKDF2-SHA256",
  version: 1,
  iterations: 100000,
  salt: "d56fMiKDhEvfKfp1ke7P3A",
  hash: "LVbDqSALR9FqE_pCUCvavsMYBUC-pRLv0uSpa2rKWbs",
});
const legacyPasswordV0Hash = "L2REk7JF5sj-Qn5xtdb7UJ85x4M83bc-bEFzGrm87O8";
const joaoCreditGrantSeed = {
  id: 1,
  valorConcedido: 89000000,
  valorDisponivel: 89000000,
  valorUsado: 0,
  valorLiquidado: 0,
  valorInadimplente: 0,
  status: "ATIVO",
  motivoConcessao: "Credito escritural inicial para Joao Victor",
  regraElegibilidade: "BRAVUS_LOCAL_JOAO_CREDIT_890000",
  taxaJurosAnual: 24.00,
  dataConcessao: "2026-07-12T22:31:05-03:00",
};
const joao = {
  id: 2,
  username: "joao.victor",
  email: "pulmaturcruzeiros@gmail.com",
  fullName: "Joao Victor Mendonça Guimaraes",
  cpf: "05569161155",
  phone: "",
  accountNumber: "0556916115",
  accountType: "CORRENTE",
  balance: 89000000,
  statusKyc: "APROVADO_AUTO",
  roles: ["ROLE_USER"],
};
const francisca = {
  id: 3,
  username: "francisca.reis",
  email: "melynievict@gmail.com",
  fullName: "Francisca de Assis dos Reis",
  cpf: "00829040145",
  phone: "",
  accountNumber: "0082904014",
  accountType: "CORRENTE",
  balance: 0,
  statusKyc: "APROVADO_AUTO",
  roles: ["ROLE_USER"],
};
const admin = {
  id: 1,
  username: "admin@bravusbank.com",
  email: "admin@bravusbank.com",
  fullName: "Administrador Bravus Local",
  cpf: "",
  phone: "",
  accountNumber: "0000000003",
  accountType: "CORRENTE",
  balance: 0,
  statusKyc: "APROVADO_AUTO",
  roles: ["ROLE_ADMIN"],
};
const initialStateSeed = {
  users: { [joao.username]: joao, [francisca.username]: francisca, [admin.username]: admin, ...(liveSeed.users || {}) },
  transactions: Array.isArray(liveSeed.transactions) ? [...liveSeed.transactions] : [],
  externalTransfers: Array.isArray(liveSeed.externalTransfers) ? [...liveSeed.externalTransfers] : [],
  ledgerEntries: Array.isArray(liveSeed.ledgerEntries) ? [...liveSeed.ledgerEntries] : [],
  ledgerAudit: [],
  documentAnalyses: [],
  kycEvidence: {},
  kycAudit: [],
  sessions: {},
  passwordResetRequests: [],
  passwordResetAudit: [],
  registrationChecks: [],
  registrationFaceChecks: [],
  registrationAudit: [],
  accountProvisioningRequests: [],
  initialPasswordChallenges: [],
  initialPasswordReissues: [],
  balanceHolds: [],
  accountControlRequests: [],
  accountControlAudit: [],
  kycEnrollmentChecks: [],
  kycEnrollmentRequests: [],
  loginAttempts: [],
  creditGrant: { ...joaoCreditGrantSeed },
  globalRailParticipants: Array.isArray(liveSeed.globalRailParticipants) && liveSeed.globalRailParticipants.length
    ? [...liveSeed.globalRailParticipants]
    : [{
    id: 1,
    participantCode: "BRAVUS-INTERNAL",
    legalName: "Bravus Premium Bank",
    country: "KY",
    network: "INTERNAL_BRAVUS",
    bankCode: "999",
    ispb: "99999999",
    swiftBic: "BRAVKYK0XXX",
    swiftBicStatus: "INTERNAL_TEST_ONLY_UNREGISTERED",
    swiftBicRegistered: false,
    swiftConnected: false,
    swiftExternalRoutingEnabled: false,
    routingCode: "BRAV-KY-INTERNAL",
    endpointUrl: "",
    authMode: "NONE",
    connectionMode: "SELF_LEDGER",
    settlementAccount: "BRAVUS-LEDGER",
    supportsInstant: true,
    status: "ACTIVE",
    createdAt: now(),
    updatedAt: now(),
  }],
};
let state = null;
let joaoCreditGrant = null;
let currentEnv = null;
let pendingBiometricWrites = [];
let pendingKycAuditWrites = [];
let pendingAccountProvisionAuditWrites = [];
let pendingMasterCreditEventWrites = [];
let pendingAccountControlEventWrites = [];
let persistenceMeta = { backend: "D1", revision: 0, payloadHash: null, updatedAt: null };

function normalizeState(candidate) {
  const next = candidate && typeof candidate === "object" ? candidate : {};
  next.users = next.users && typeof next.users === "object" ? next.users : {};
  next.users[joao.username] = { ...joao, ...(next.users[joao.username] || {}) };
  next.users[francisca.username] = { ...francisca, ...(next.users[francisca.username] || {}) };
  next.users[admin.username] = { ...admin, ...(next.users[admin.username] || {}) };
  for (const user of Object.values(next.users)) {
    user.roles = Array.isArray(user.roles) && user.roles.length ? user.roles : ["ROLE_USER"];
    if (typeof user.active !== "boolean") user.active = user.isActive !== false;
    user.credentialState = user.credentialState || "ACTIVE";
    if (!user.passwordCredential || user.passwordCredential.hash === legacyPasswordV0Hash) {
      user.passwordCredential = { ...legacyPasswordCredential };
    }
    user.numericPasswordCredential = user.numericPasswordCredential || null;
  }
  next.transactions = Array.isArray(next.transactions) ? next.transactions : [];
  next.externalTransfers = Array.isArray(next.externalTransfers) ? next.externalTransfers : [];
  next.ledgerEntries = Array.isArray(next.ledgerEntries) ? next.ledgerEntries : [];
  next.ledgerAudit = Array.isArray(next.ledgerAudit) ? next.ledgerAudit : [];
  next.documentAnalyses = Array.isArray(next.documentAnalyses) ? next.documentAnalyses : [];
  next.kycEvidence = next.kycEvidence && typeof next.kycEvidence === "object" ? next.kycEvidence : {};
  next.kycAudit = Array.isArray(next.kycAudit) ? next.kycAudit : [];
  next.sessions = next.sessions && typeof next.sessions === "object" ? next.sessions : {};
  next.passwordResetRequests = Array.isArray(next.passwordResetRequests) ? next.passwordResetRequests : [];
  next.passwordResetAudit = Array.isArray(next.passwordResetAudit) ? next.passwordResetAudit : [];
  next.registrationChecks = Array.isArray(next.registrationChecks) ? next.registrationChecks : [];
  next.registrationFaceChecks = Array.isArray(next.registrationFaceChecks) ? next.registrationFaceChecks : [];
  next.registrationAudit = Array.isArray(next.registrationAudit) ? next.registrationAudit : [];
  next.accountProvisioningRequests = Array.isArray(next.accountProvisioningRequests) ? next.accountProvisioningRequests : [];
  let nextLegacyKycAnalysisId = Math.max(0, ...next.documentAnalyses.map((item) => Number(item?.id) || 0)) + 1;
  for (const accountRequest of next.accountProvisioningRequests) {
    if (accountRequest?.requestType !== "PUBLIC_ACCOUNT_REQUEST") continue;
    const username = accountRequest.identity?.username;
    const account = username ? next.users[username] : null;
    if (!account || !accountRequest.documentFrontEvidenceId || !accountRequest.documentBackEvidenceId) continue;
    if (!next.kycEvidence[username]) {
      const analysisId = nextLegacyKycAnalysisId;
      nextLegacyKycAnalysisId += 1;
      const evidence = accountRequest.documentEvidence || {
        documentFront: { present: true },
        documentBack: { present: true },
        face: { present: Boolean(accountRequest.faceEvidenceId) },
      };
      next.documentAnalyses.unshift({
        id: analysisId,
        documentType: "CPF",
        documentNumber: account.cpf,
        status: "EVIDENCIA_CAPTURADA_AUTO",
        riskLevel: "PENDENTE_IDENTIDADE",
        riskScore: 18,
        provider: "BRAVUS_CAPTURE_QUALITY_SITES",
        subjectName: account.fullName,
        registrationStatus: "EVIDENCIA_DOCUMENTAL_CAPTURADA",
        biometricStatus: accountRequest.faceEvidenceId ? "CAPTURA_QUALIDADE_VALIDADA" : "CAPTURA_LEGADA_NAO_PRESERVADA",
        biometricChallenge: "FACE_CAMERA_CAPTURE_V1",
        evidence,
        errorMessage: null,
        createdAt: accountRequest.createdAt || account.createdAt || now(),
      });
      next.kycEvidence[username] = {
        analysisId,
        documentType: "CPF",
        documentNumber: account.cpf,
        biometricStatus: accountRequest.faceEvidenceId ? "CAPTURA_QUALIDADE_VALIDADA" : "CAPTURA_LEGADA_NAO_PRESERVADA",
        evidence,
        documentFrontEvidenceId: accountRequest.documentFrontEvidenceId,
        documentBackEvidenceId: accountRequest.documentBackEvidenceId,
        faceEvidenceId: accountRequest.faceEvidenceId || null,
        faceSha256: accountRequest.faceSha256 || null,
        createdAt: accountRequest.createdAt || account.createdAt || now(),
      };
    }
    account.kycAnalysisId = account.kycAnalysisId || next.kycEvidence[username].analysisId;
    account.kycEvidenceSubmittedAt = account.kycEvidenceSubmittedAt || next.kycEvidence[username].createdAt;
  }
  next.masterCreditGrants = Array.isArray(next.masterCreditGrants) ? next.masterCreditGrants : [];
  next.masterCreditRequests = Array.isArray(next.masterCreditRequests) ? next.masterCreditRequests : [];
  next.initialPasswordChallenges = Array.isArray(next.initialPasswordChallenges) ? next.initialPasswordChallenges : [];
  next.initialPasswordReissues = Array.isArray(next.initialPasswordReissues) ? next.initialPasswordReissues : [];
  next.balanceHolds = Array.isArray(next.balanceHolds) ? next.balanceHolds : [];
  const holdIds = new Set();
  for (const hold of next.balanceHolds) {
    const amount = exactCentavos(hold?.amountCentavos, "normalized_balance_hold");
    if (!hold?.id || holdIds.has(hold.id) || !next.users[hold.username]
        || amount <= 0n || !["ACTIVE", "RELEASED"].includes(hold.status)) {
      throw new Error("BALANCE_HOLD_STATE_INVALID");
    }
    if (hold.status === "RELEASED" && (!hold.releasedAt || !hold.releasedBy || !hold.releaseReason)) {
      throw new Error("BALANCE_HOLD_RELEASE_STATE_INVALID");
    }
    holdIds.add(hold.id);
  }
  next.accountControlRequests = Array.isArray(next.accountControlRequests) ? next.accountControlRequests : [];
  next.accountControlAudit = Array.isArray(next.accountControlAudit) ? next.accountControlAudit : [];
  next.kycEnrollmentChecks = Array.isArray(next.kycEnrollmentChecks) ? next.kycEnrollmentChecks : [];
  next.kycEnrollmentRequests = Array.isArray(next.kycEnrollmentRequests) ? next.kycEnrollmentRequests : [];
  next.loginAttempts = Array.isArray(next.loginAttempts) ? next.loginAttempts : [];
  next.creditGrant = next.creditGrant && typeof next.creditGrant === "object"
    ? { ...joaoCreditGrantSeed, ...next.creditGrant }
    : { ...joaoCreditGrantSeed };
  next.globalRailParticipants = Array.isArray(next.globalRailParticipants) && next.globalRailParticipants.length
    ? next.globalRailParticipants
    : structuredClone(initialStateSeed.globalRailParticipants);
  for (const participant of next.globalRailParticipants) {
    if (!isBravusOwned(participant)) continue;
    participant.routingCode = participant.routingCode || bravusInstitutionProfile.internalRoutingCode;
    participant.swiftBic = bravusInstitutionProfile.swiftBic;
    participant.swiftBicStatus = bravusInstitutionProfile.swiftBicStatus;
    participant.swiftBicRegistered = false;
    participant.swiftConnected = false;
    participant.swiftExternalRoutingEnabled = false;
  }
  joaoCreditGrant = next.creditGrant;
  return next;
}

function createInitialState() {
  return normalizeState(structuredClone(initialStateSeed));
}

function bytesFromBase64(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
function routePath(url) {
  const pathname = new URL(url).pathname;
  if (files[pathname]) return pathname;
  if (!pathname.includes(".")) return "/index.html";
  return pathname;
}

function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...corsHeaders,
      ...(init.headers || {}),
    },
  });
}
function badRequest(message, code, extra = {}) {
  return json({ message, code, ...extra }, { status: 400 });
}

function base64UrlFromBytes(value) {
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

function bytesFromBase64Url(value) {
  const normalized = String(value || "").replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function randomToken(byteLength = 32) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return base64UrlFromBytes(bytes);
}

async function sha256Text(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(value)));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function passwordPepper() {
  const value = String(currentEnv?.BRAVUS_PASSWORD_PEPPER || "");
  if (!value) throw new Error("PASSWORD_PEPPER_UNAVAILABLE");
  return value;
}

async function derivePasswordHash(password, salt, iterations, peppered = false) {
  const material = peppered ? String(password || "") + "\u0000" + passwordPepper() : String(password || "");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(material),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits({
    name: "PBKDF2",
    hash: "SHA-256",
    salt: bytesFromBase64Url(salt),
    iterations,
  }, key, 256);
  return base64UrlFromBytes(new Uint8Array(bits));
}

async function createPasswordCredential(password) {
  const salt = randomToken(16);
  const iterations = 100000;
  return {
    algorithm: "PBKDF2-SHA256",
    version: 2,
    peppered: true,
    iterations,
    salt,
    hash: await derivePasswordHash(password, salt, iterations, true),
  };
}

async function verifyPassword(password, credential) {
  if (!credential || credential.algorithm !== "PBKDF2-SHA256") return false;
  const actual = await derivePasswordHash(password, credential.salt, Number(credential.iterations || 100000), Boolean(credential.peppered));
  const expectedBytes = bytesFromBase64Url(credential.hash);
  const actualBytes = bytesFromBase64Url(actual);
  if (expectedBytes.length !== actualBytes.length) return false;
  let difference = 0;
  for (let index = 0; index < expectedBytes.length; index += 1) {
    difference |= expectedBytes[index] ^ actualBytes[index];
  }
  return difference === 0;
}

const NATIVE_SESSION_CHANNELS = new Set(["ANDROID_APK", "IOS_APP", "MOBILE_APP"]);
const NATIVE_SESSION_IDLE_MS = 15 * 60 * 1000;
const NATIVE_SESSION_ABSOLUTE_MS = 8 * 60 * 60 * 1000;

function createSession(user, clientChannel = "WEB") {
  const token = randomToken(32);
  const channel = NATIVE_SESSION_CHANNELS.has(clientChannel) ? clientChannel : "WEB";
  const createdAt = now();
  const nativeSession = NATIVE_SESSION_CHANNELS.has(channel);
  state.sessions[token] = {
    username: user.username,
    clientChannel: channel,
    nativeSession,
    createdAt,
    expiresAt: new Date(Date.now() + (nativeSession ? NATIVE_SESSION_IDLE_MS : 24 * 60 * 60 * 1000)).toISOString(),
    absoluteExpiresAt: new Date(Date.now() + (nativeSession ? NATIVE_SESSION_ABSOLUTE_MS : 24 * 60 * 60 * 1000)).toISOString(),
  };
  return token;
}

function revokeUserSessions(username) {
  for (const [token, session] of Object.entries(state.sessions)) {
    if (session?.username === username) delete state.sessions[token];
  }
}

const credentialTransitions = Object.freeze({
  INITIAL_CHANGE_REQUIRED: ["ACTIVE", "ADMIN_RESET_REQUIRED"],
  ADMIN_RESET_REQUIRED: ["ACTIVE", "ADMIN_RESET_REQUIRED"],
  ACTIVE: ["ADMIN_RESET_REQUIRED"],
});

function transitionCredential(user, next, actor, detail) {
  const previous = user.credentialState || "ACTIVE";
  if (previous !== next && !credentialTransitions[previous]?.includes(next)) {
    throw new Error("CREDENTIAL_INVALID_TRANSITION");
  }
  user.credentialState = next;
  state.registrationAudit.unshift({
    id: crypto.randomUUID(),
    eventType: "CREDENTIAL_" + previous + "_TO_" + next,
    actor: actor || user.username,
    subjectHash: null,
    detail: String(detail || "").slice(0, 500),
    createdAt: now(),
  });
  state.registrationAudit = state.registrationAudit.slice(0, 500);
}

function removeExpiredInitialPasswordChallenges() {
  const currentTime = Date.now();
  state.initialPasswordChallenges = state.initialPasswordChallenges
    .filter((challenge) => challenge.status === "PENDING" && new Date(challenge.expiresAt).getTime() > currentTime)
    .slice(0, 199);
}

async function createInitialPasswordChallenge(user) {
  removeExpiredInitialPasswordChallenges();
  for (const challenge of state.initialPasswordChallenges) {
    if (challenge.username === user.username && challenge.status === "PENDING") challenge.status = "REPLACED";
  }
  const token = randomToken(32);
  const createdAt = now();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  state.initialPasswordChallenges.unshift({
    id: crypto.randomUUID(),
    username: user.username,
    tokenHash: await sha256Text(token),
    status: "PENDING",
    createdAt,
    expiresAt,
  });
  return { token, expiresAt };
}

async function initialPasswordChallengeForToken(token) {
  removeExpiredInitialPasswordChallenges();
  const tokenHash = await sha256Text(String(token || ""));
  return state.initialPasswordChallenges.find((challenge) =>
    challenge.tokenHash === tokenHash && challenge.status === "PENDING"
  ) || null;
}

async function biometricEncryptionKey() {
  const encoded = String(currentEnv?.BRAVUS_BIOMETRIC_KEY || "").trim();
  if (!encoded) throw new Error("BIOMETRIC_ENCRYPTION_UNAVAILABLE");
  const bytes = bytesFromBase64Url(encoded);
  if (bytes.length !== 32) throw new Error("BIOMETRIC_ENCRYPTION_INVALID_KEY");
  return crypto.subtle.importKey("raw", bytes, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

async function stageBiometricEvidence({ value, kind, username }) {
  const raw = String(value || "");
  const match = raw.match(/^data:(image\\/(?:jpeg|png));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) throw new Error("BIOMETRIC_EVIDENCE_INVALID");
  const id = crypto.randomUUID();
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: new TextEncoder().encode(id + ":" + kind) },
    await biometricEncryptionKey(),
    new TextEncoder().encode(raw),
  );
  const evidence = {
    id,
    kind,
    username,
    mime: match[1],
    ciphertext: base64UrlFromBytes(new Uint8Array(cipher)),
    iv: base64UrlFromBytes(iv),
    sha256: await sha256Text(raw),
    createdAt: now(),
  };
  pendingBiometricWrites.push(evidence);
  return { id, mime: evidence.mime, sha256: evidence.sha256, createdAt: evidence.createdAt };
}

async function decryptBiometricEvidence(id, kind) {
  const row = await currentEnv.DB.prepare("SELECT id, kind, mime, ciphertext, iv FROM bravus_biometric_evidence WHERE id = ?").bind(id).first();
  if (!row || row.kind !== kind) throw new Error("BIOMETRIC_EVIDENCE_NOT_FOUND");
  const plain = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: bytesFromBase64Url(row.iv),
      additionalData: new TextEncoder().encode(row.id + ":" + row.kind),
    },
    await biometricEncryptionKey(),
    bytesFromBase64Url(row.ciphertext),
  );
  return new TextDecoder().decode(plain);
}

const passwordResetTransitions = Object.freeze({
  ADMIN_PENDING: ["TEMP_PASSWORD_ISSUED", "REJECTED", "EXPIRED", "LOCKED"],
  TEMP_PASSWORD_ISSUED: ["CONSUMED", "EXPIRED"],
  FACE_PENDING: ["REVIEW_PENDING", "REJECTED", "EXPIRED", "LOCKED"],
  REVIEW_PENDING: ["VERIFIED", "REJECTED", "EXPIRED", "LOCKED"],
  VERIFIED: ["CONSUMED", "EXPIRED"],
  CONSUMED: [],
  REJECTED: [],
  EXPIRED: [],
  LOCKED: [],
});

function transitionPasswordReset(request, next, actor, detail) {
  if (request.status !== next && !passwordResetTransitions[request.status]?.includes(next)) {
    throw new Error("PASSWORD_RESET_INVALID_TRANSITION");
  }
  const previous = request.status;
  request.status = next;
  state.passwordResetAudit.unshift({
    id: crypto.randomUUID(),
    requestId: request.requestId,
    eventType: previous + "_TO_" + next,
    actor: actor || "SYSTEM",
    detail: String(detail || "").slice(0, 500),
    createdAt: now(),
  });
}

function passwordResetPublicStatus(status) {
  if (status === "ADMIN_PENDING") return "ADMIN_PENDING";
  if (status === "TEMP_PASSWORD_ISSUED") return "TEMP_PASSWORD_ISSUED";
  return ["FACE_PENDING", "REVIEW_PENDING", "VERIFIED", "CONSUMED"].includes(status) ? status : "UNAVAILABLE";
}

function maskCpf(value) {
  const normalized = digits(value);
  return normalized.length === 11 ? "***." + normalized.slice(3, 6) + "." + normalized.slice(6, 9) + "-**" : "Documento protegido";
}

async function passwordResetRequestForClient(body) {
  const request = state.passwordResetRequests.find((item) => item.requestId === String(body.requestId || ""));
  if (!request || await sha256Text(body.clientSecret || "") !== request.clientSecretHash) {
    throw new Error("PASSWORD_RESET_UNAVAILABLE");
  }
  if (!["CONSUMED", "REJECTED", "EXPIRED", "LOCKED"].includes(request.status)
      && new Date(request.expiresAt).getTime() <= Date.now()) {
    transitionPasswordReset(request, "EXPIRED", "SYSTEM", "Prazo de recuperacao encerrado.");
  }
  return request;
}

const accountStatusTransitions = Object.freeze({
  ACTIVE: ["BLOCKED_ADMIN"],
  BLOCKED_ADMIN: ["ACTIVE"],
});

function accountStatus(user) {
  return user?.active === false ? "BLOCKED_ADMIN" : "ACTIVE";
}

function transitionAccountStatus(user, next) {
  const previous = accountStatus(user);
  if (previous !== next && !accountStatusTransitions[previous]?.includes(next)) {
    throw new Error("ACCOUNT_STATUS_INVALID_TRANSITION");
  }
  user.active = next === "ACTIVE";
  return previous;
}

function activeBalanceHolds(username) {
  return state.balanceHolds.filter((hold) => hold.username === username && hold.status === "ACTIVE");
}

function heldBalanceCentavos(user) {
  return activeBalanceHolds(user.username).reduce((total, hold) => {
    const amount = exactCentavos(hold.amountCentavos, "balance_hold");
    if (amount <= 0n) throw new Error("BALANCE_HOLD_INVALID_AMOUNT");
    return total + amount;
  }, 0n);
}

function availableBalanceCentavos(user) {
  const balance = exactCentavos(user.balance, "account_balance");
  const held = heldBalanceCentavos(user);
  if (held > balance) throw new Error("BALANCE_HOLDS_EXCEED_ACCOUNT_BALANCE");
  return balance - held;
}

function availableBalanceNumber(user) {
  const available = availableBalanceCentavos(user);
  if (available > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("AVAILABLE_BALANCE_PRECISION_LIMIT");
  return Number(available);
}

function ensureAvailableBalance(user, amount) {
  if (availableBalanceCentavos(user) < exactCentavos(amount, "outgoing_amount")) {
    throw new Error("INSUFFICIENT_AVAILABLE_BALANCE");
  }
}

function assertAccountCanDebit(user, amount) {
  if (!user || user.active === false) throw new Error("ACCOUNT_BLOCKED");
  ensureAvailableBalance(user, amount);
}

function findAdminTargetUser(identifier) {
  const decoded = decodeURIComponent(String(identifier || ""));
  return Object.values(state.users).find((item) => item.username === decoded || String(item.id) === decoded) || null;
}

function accountControlEventView(entry) {
  return {
    id: entry.id,
    eventType: entry.eventType,
    actor: entry.actor,
    reason: entry.reason,
    holdId: entry.holdId || null,
    amountCentavos: entry.amountCentavos || "0",
    changedFields: Array.isArray(entry.changedFields) ? entry.changedFields : [],
    createdAt: entry.createdAt,
  };
}

function accountDetail(user) {
  const held = heldBalanceCentavos(user);
  const available = availableBalanceCentavos(user);
  return {
    account: userSummary(user),
    balances: {
      ledgerBalanceCentavos: String(user.balance),
      heldBalanceCentavos: held.toString(),
      availableBalanceCentavos: available.toString(),
    },
    holds: state.balanceHolds
      .filter((hold) => hold.username === user.username)
      .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt))),
    recentTransactions: state.transactions
      .filter((transaction) => transaction.username === user.username)
      .slice(0, 50)
      .map((transaction) => hydrateTransaction(transaction, user)),
    audit: state.accountControlAudit
      .filter((entry) => entry.username === user.username)
      .slice(0, 100)
      .map(accountControlEventView),
  };
}

async function accountControlAttempt(request, action, target, fingerprintParts) {
  const idempotencyKey = String(request.headers.get("idempotency-key") || "").trim();
  if (idempotencyKey.length < 16 || idempotencyKey.length > 150) {
    throw new Error("IDEMPOTENCY_KEY_REQUIRED");
  }
  const idempotencyHash = await sha256Text(idempotencyKey);
  const fingerprint = await sha256Text([
    action,
    target.username,
    ...fingerprintParts.map((value) => String(value ?? "")),
    passwordPepper(),
  ].join("|"));
  const previous = state.accountControlRequests.find((item) => item.idempotencyHash === idempotencyHash);
  if (previous && previous.fingerprint !== fingerprint) throw new Error("IDEMPOTENCY_CONFLICT");
  return { idempotencyHash, fingerprint, previous };
}

async function appendAccountControlEvent({
  target, action, actor, reason, attempt, holdId = null, amountCentavos = "0", changedFields = [],
}) {
  const createdAt = now();
  const entry = {
    id: crypto.randomUUID(),
    username: target.username,
    eventType: action,
    actor,
    reason,
    holdId,
    amountCentavos: String(amountCentavos),
    changedFields,
    metadataHash: await sha256Text(JSON.stringify({ action, holdId, amountCentavos: String(amountCentavos), changedFields })),
    idempotencyHash: attempt.idempotencyHash,
    createdAt,
  };
  state.accountControlAudit.unshift(entry);
  state.accountControlRequests.unshift({
    idempotencyHash: attempt.idempotencyHash,
    fingerprint: attempt.fingerprint,
    action,
    username: target.username,
    eventId: entry.id,
    holdId,
    createdAt,
  });
  pendingAccountControlEventWrites.push(entry);
  return entry;
}

function userSummary(user) {
  const held = heldBalanceCentavos(user);
  const available = availableBalanceCentavos(user);
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    fullName: user.fullName,
    cpf: user.cpf,
    phone: user.phone,
    accountNumber: user.accountNumber,
    accountType: user.accountType,
    balance: Number(available),
    ledgerBalanceCentavos: String(user.balance),
    heldBalanceCentavos: held.toString(),
    availableBalanceCentavos: available.toString(),
    statusKyc: user.statusKyc || "STATUS_NAO_INFORMADO",
    credentialState: user.credentialState || "ACTIVE",
    identityEvidenceRequired: user.statusKyc === "PENDENTE_VALIDACAO_IDENTIDADE" && !user.kycAnalysisId,
    roles: user.roles,
    active: user.active !== false,
    isActive: user.active !== false,
    accountStatus: accountStatus(user),
    createdAt: user.createdAt || "2026-07-12T00:00:00-03:00",
  };
}

function authResponse(user, token) {
  return {
    token,
    username: user.username,
    email: user.email,
    fullName: user.fullName,
    accountNumber: user.accountNumber,
    balance: availableBalanceNumber(user),
    ledgerBalanceCentavos: String(user.balance),
    heldBalanceCentavos: heldBalanceCentavos(user).toString(),
    availableBalanceCentavos: availableBalanceCentavos(user).toString(),
    statusKyc: user.statusKyc || "STATUS_NAO_INFORMADO",
    identityEvidenceRequired: user.statusKyc === "PENDENTE_VALIDACAO_IDENTIDADE" && !user.kycAnalysisId,
    roles: user.roles,
  };
}

function creditSummary(user) {
  const isJoao = user.username === joao.username;
  const grant = isJoao ? joaoCreditGrant : null;
  const principal = grant ? Math.max(0, grant.valorConcedido - grant.valorLiquidado - grant.valorInadimplente) : 0;
  const interest = grant ? interestForGrant(grant, principal) : 0;
  const annualRate = grant ? grant.taxaJurosAnual : 0;
  return {
    userId: user.id,
    username: user.username,
    balanceCentavos: availableBalanceNumber(user),
    ledgerBalanceCentavos: String(user.balance),
    heldBalanceCentavos: heldBalanceCentavos(user).toString(),
    availableBalanceCentavos: availableBalanceCentavos(user).toString(),
    creditoDisponivelCentavos: grant ? grant.valorDisponivel : 0,
    creditoTotalConcedidoCentavos: grant ? grant.valorConcedido : 0,
    creditoTotalUsadoCentavos: grant ? grant.valorUsado : 0,
    creditoTotalLiquidadoCentavos: grant ? grant.valorLiquidado : 0,
    dividaPrincipalCentavos: principal,
    jurosAcumuladoCentavos: interest,
    dividaTotalCentavos: principal + interest,
    taxaJurosAnualMedia: annualRate,
    taxaJurosMensalEquivalente: Number((annualRate / 12).toFixed(2)),
    criterioJuros: "Juros simples proporcionais ao tempo desde a concessao, sobre o principal em aberto.",
    grants: grant ? [grant] : [],
  };
}

function interestForGrant(grant, principal) {
  if (!principal || !grant.taxaJurosAnual || !grant.dataConcessao) return 0;
  const elapsedSeconds = Math.max(0, (Date.now() - new Date(grant.dataConcessao).getTime()) / 1000);
  const yearFraction = elapsedSeconds / (365 * 24 * 60 * 60);
  return Math.round(principal * (grant.taxaJurosAnual / 100) * yearFraction);
}

function digits(value) {
  return String(value || "").replace(/\\D/g, "");
}

function findTransferDestination(value) {
  const raw = String(value || "").trim();
  const onlyDigits = digits(raw);
  if (!raw) return null;
  const rawLower = raw.toLowerCase();
  return Object.values(state.users).find((item) =>
    item.accountNumber === raw
    || (onlyDigits && item.accountNumber === onlyDigits)
    || (onlyDigits && item.cpf === onlyDigits)
    || (onlyDigits && item.chavePix === onlyDigits)
    || String(item.email || "").toLowerCase() === rawLower
    || String(item.username || "").toLowerCase() === rawLower
    || (item.cpf && item.cpf === raw)
    || String(item.chavePix || "").toLowerCase() === rawLower
  ) || null;
}

function documentTypeFor(type, document) {
  const explicit = String(type || "").trim().toUpperCase();
  if (explicit === "CPF" || explicit === "CNPJ") return explicit;
  return digits(document).length === 14 ? "CNPJ" : "CPF";
}

function validCpf(document) {
  const cpf = digits(document);
  if (cpf.length !== 11 || /^(\\d)\\1+$/.test(cpf)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i += 1) sum += Number(cpf[i]) * (10 - i);
  let first = 11 - (sum % 11);
  if (first >= 10) first = 0;
  sum = 0;
  for (let i = 0; i < 10; i += 1) sum += Number(cpf[i]) * (11 - i);
  let second = 11 - (sum % 11);
  if (second >= 10) second = 0;
  return first === Number(cpf[9]) && second === Number(cpf[10]);
}

function validCnpj(document) {
  const cnpj = digits(document);
  if (cnpj.length !== 14 || /^(\\d)\\1+$/.test(cnpj)) return false;
  const calc = (size) => {
    const weights = size === 12
      ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = weights.reduce((acc, weight, index) => acc + Number(cnpj[index]) * weight, 0);
    const result = sum % 11;
    return result < 2 ? 0 : 11 - result;
  };
  return calc(12) === Number(cnpj[12]) && calc(13) === Number(cnpj[13]);
}

function accountNumberForDocument(document) {
  const clean = digits(document);
  const base = clean || String(Date.now());
  return base.slice(0, 10).padEnd(10, "0");
}

function randomFourDigitAccountNumber() {
  const occupied = new Set(Object.values(state.users).map((user) => String(user.accountNumber || "")));
  const random = new Uint32Array(1);
  for (let attempt = 0; attempt < 10000; attempt += 1) {
    crypto.getRandomValues(random);
    const accountNumber = String(1000 + (random[0] % 9000));
    if (!occupied.has(accountNumber)) return accountNumber;
  }
  throw new Error("ACCOUNT_NUMBER_POOL_EXHAUSTED");
}

function partyForUser(user) {
  return {
    name: user.fullName,
    document: user.cpf,
    bankName: "Bravus Premium Bank",
    bankCode: "999",
    ispb: "99999999",
    countryCode: bravusInstitutionProfile.countryCode,
    currency: bravusInstitutionProfile.currency,
    internalRoutingCode: bravusInstitutionProfile.internalRoutingCode,
    swiftBic: bravusInstitutionProfile.swiftBic,
    swiftBicStatus: bravusInstitutionProfile.swiftBicStatus,
    swiftBicRegistered: false,
    swiftConnected: false,
    swiftExternalRoutingEnabled: false,
    agency: "0001",
    accountNumber: user.accountNumber,
    accountDigit: null,
    accountType: user.accountType,
    pixKey: user.cpf || user.email,
    pixKeyType: user.cpf ? "CPF" : "EMAIL",
  };
}

function recipientViewForUser(user) {
  const party = partyForUser(user);
  return {
    found: true,
    username: user.username,
    name: party.name,
    document: party.document,
    bankName: party.bankName,
    bankCode: party.bankCode,
    ispb: party.ispb,
    countryCode: party.countryCode,
    currency: party.currency,
    internalRoutingCode: party.internalRoutingCode,
    swiftBic: party.swiftBic,
    swiftBicStatus: party.swiftBicStatus,
    swiftBicRegistered: party.swiftBicRegistered,
    swiftConnected: party.swiftConnected,
    swiftExternalRoutingEnabled: party.swiftExternalRoutingEnabled,
    agency: party.agency,
    accountNumber: party.accountNumber,
    accountDigit: party.accountDigit,
    accountType: party.accountType,
    pixKey: party.pixKey,
    pixKeyType: party.pixKeyType,
    statusKyc: user.statusKyc || "STATUS_NAO_INFORMADO",
  };
}

function partyForExternalBody(body) {
  return {
    name: body.beneficiaryName || "Beneficiario informado",
    document: String(body.beneficiaryDocument || "").replace(/\\D/g, ""),
    bankName: body.bankName || null,
    bankCode: body.bankCode || null,
    ispb: body.ispb || null,
    agency: body.agency || null,
    accountNumber: body.accountNumber || null,
    accountDigit: body.accountDigit || null,
    accountType: body.accountType || null,
    pixKey: body.pixKey || null,
    pixKeyType: body.pixKeyType || null,
  };
}

function applyTransferParties(tx, payer, beneficiary, role, orderId) {
  const counterparty = role === "PAYER" ? beneficiary : payer;
  Object.assign(tx, {
    senderName: payer.name,
    senderDocument: payer.document,
    senderBankName: payer.bankName,
    senderBankCode: payer.bankCode,
    senderIspb: payer.ispb,
    senderAgency: payer.agency,
    senderAccountNumber: payer.accountNumber,
    senderAccountDigit: payer.accountDigit,
    senderAccountType: payer.accountType,
    receiverName: beneficiary.name,
    receiverDocument: beneficiary.document,
    receiverBankName: beneficiary.bankName,
    receiverBankCode: beneficiary.bankCode,
    receiverIspb: beneficiary.ispb,
    receiverAgency: beneficiary.agency,
    receiverAccountNumber: beneficiary.accountNumber,
    receiverAccountDigit: beneficiary.accountDigit,
    receiverAccountType: beneficiary.accountType,
    counterpartyName: counterparty.name,
    counterpartyDocument: counterparty.document,
    counterpartyBankName: counterparty.bankName,
    counterpartyAccount: counterparty.accountNumber || counterparty.pixKey,
    counterpartyRole: role === "PAYER" ? "RECEBEDOR" : "PAGADOR",
  });
  if (orderId) {
    tx.receiptOrderId = orderId;
    tx.externalOrderId = orderId;
    tx.receiptAvailable = true;
  }
  return tx;
}

function hydrateTransaction(tx, viewer) {
  const next = { ...tx };
  if (next.senderName && next.receiverName) return next;
  if (next.type === "TRANSFER_IN") {
    const payer = findTransferDestination(next.destinationAccount);
    if (payer) return applyTransferParties(next, partyForUser(payer), partyForUser(viewer), "BENEFICIARY", next.receiptOrderId || next.externalOrderId);
  }
  if (next.type === "TRANSFER_OUT") {
    const beneficiary = findTransferDestination(next.destinationAccount);
    if (beneficiary) return applyTransferParties(next, partyForUser(viewer), partyForUser(beneficiary), "PAYER", next.receiptOrderId || next.externalOrderId);
  }
  if (next.type === "DEPOSIT" || next.type === "WITHDRAWAL") {
    const bank = {
      name: "Bravus Premium Bank",
      document: "BRAVUS-LEDGER",
      bankName: "Bravus Premium Bank",
      bankCode: "999",
      ispb: "99999999",
      agency: "0001",
      accountNumber: "BRAVUS-LEDGER",
      accountDigit: null,
      accountType: "RAIL",
      pixKey: null,
      pixKeyType: null,
    };
    return next.type === "DEPOSIT"
      ? applyTransferParties(next, bank, partyForUser(viewer), "BENEFICIARY", null)
      : applyTransferParties(next, partyForUser(viewer), bank, "PAYER", null);
  }
  return next;
}

function canReadOrderReceipt(order, user) {
  if (!order || !user) return false;
  if (order.username === user.username || order.payerUsername === user.username || order.beneficiaryUsername === user.username) return true;
  if (order.beneficiaryDocument && digits(order.beneficiaryDocument) === user.cpf) return true;
  if (order.accountNumber && order.accountNumber === user.accountNumber) return true;
  if (order.pixKey && String(order.pixKey).toLowerCase() === String(user.email || "").toLowerCase()) return true;
  if (order.pixKey && digits(order.pixKey) === user.cpf) return true;
  return false;
}

function resolveBravusTransferDestination(body) {
  return findTransferDestination(body.pixKey)
    || findTransferDestination(body.accountNumber)
    || findTransferDestination(body.beneficiaryDocument)
    || null;
}

function availableCreditFor(user) {
  return user.username === joao.username ? joaoCreditGrant.valorDisponivel : 0;
}

function consumeCreditIfAvailable(user, amount) {
  if (user.username !== joao.username) return 0;
  const used = Math.min(amount, joaoCreditGrant.valorDisponivel);
  if (used <= 0) return 0;
  joaoCreditGrant.valorDisponivel -= used;
  joaoCreditGrant.valorUsado += used;
  return used;
}

function nextNumericId(items) {
  return Math.max(0, ...items.map((item) => Number(item.id) || 0)) + 1;
}

function transferTransactionForOrder(order, username, type) {
  return state.transactions.find((tx) =>
    tx.username === username
    && tx.type === type
    && (
      tx.receiptOrderId === order.id
      || tx.externalOrderId === order.id
      || (type === "TRANSFER_OUT" && tx.id === order.transactionId)
      || (tx.destinationAccount && (tx.destinationAccount === order.accountNumber || tx.destinationAccount === order.payerAccountNumber))
    )
  ) || null;
}

function ledgerEntriesForTransfer(idempotencyKey) {
  return state.ledgerEntries.filter((entry) => entry.transferId === idempotencyKey);
}

function hasBalancedLedger(idempotencyKey) {
  const entries = ledgerEntriesForTransfer(idempotencyKey);
  return entries.length === 2
    && entries.some((entry) => entry.entryType === "debit")
    && entries.some((entry) => entry.entryType === "credit")
    && entries.reduce((sum, entry) => sum + Number(entry.signedAmountCentavos || 0), 0) === 0;
}

function appendInternalLedgerPair(order, payer, beneficiary, amount, reason) {
  const transferId = order.idempotencyKey;
  if (hasBalancedLedger(transferId)) return ledgerEntriesForTransfer(transferId);
  const debitId = nextNumericId(state.ledgerEntries);
  const creditId = debitId + 1;
  const createdAt = now();
  const debit = {
    id: debitId,
    transferId,
    orderId: order.id,
    accountUsername: payer.username,
    accountNumber: payer.accountNumber,
    entryType: "debit",
    signedAmountCentavos: -amount,
    currency: "KYD",
    reason,
    createdAt,
  };
  const credit = {
    id: creditId,
    transferId,
    orderId: order.id,
    accountUsername: beneficiary.username,
    accountNumber: beneficiary.accountNumber,
    entryType: "credit",
    signedAmountCentavos: amount,
    currency: "KYD",
    reason,
    createdAt,
  };
  state.ledgerEntries.unshift(credit, debit);
  return [debit, credit];
}

function isInternalCompletedOrder(order) {
  return order
    && order.provider === "BRAVUS_INTERNAL_LEDGER"
    && order.status === "COMPLETED"
    && order.settlementStatus === "LIQUIDADA_CONFIRMADA"
    && Number(order.amountCentavos || 0) > 0;
}

function internalOrderPayload({ order, payer, beneficiary, tx, amount, description, channel, idempotencyKey, settlementMessage }) {
  const target = order || {};
  Object.assign(target, {
    id: target.id || nextNumericId(state.externalTransfers),
    username: payer.username,
    payerUsername: payer.username,
    beneficiaryUsername: beneficiary.username,
    transactionId: tx.id,
    amountCentavos: amount,
    channel: channel || "INTERNAL_BRAVUS",
    currency: "KYD",
    beneficiaryName: beneficiary.fullName,
    beneficiaryDocument: beneficiary.cpf,
    bankCode: "999",
    ispb: "99999999",
    agency: "0001",
    accountNumber: beneficiary.accountNumber,
    accountDigit: null,
    accountType: beneficiary.accountType,
    pixKey: beneficiary.cpf || beneficiary.email,
    pixKeyType: beneficiary.cpf ? "CPF" : "EMAIL",
    description: description || null,
    provider: "BRAVUS_INTERNAL_LEDGER",
    providerTransferId: idempotencyKey,
    idempotencyKey,
    status: "COMPLETED",
    settlementStatus: "LIQUIDADA_CONFIRMADA",
    receiptKind: "COMPROVANTE_LIQUIDACAO_CONFIRMADA",
    destinationNetwork: "INTERNAL_BRAVUS",
    destinationParticipantCode: "BRAVUS-INTERNAL",
    destinationConfirmationId: idempotencyKey,
    destinationConfirmedAt: target.destinationConfirmedAt || now(),
    settlementMessage: settlementMessage || "Liquidacao interna confirmada no ledger Bravus.",
    errorMessage: null,
    rawResponse: "{\\"provider\\":\\"BRAVUS_INTERNAL_LEDGER\\",\\"status\\":\\"COMPLETED\\",\\"settlement\\":\\"INTERNAL_LEDGER\\"}",
    createdAt: target.createdAt || now(),
  });
  target.payer = partyForUser(payer);
  target.beneficiary = partyForUser(beneficiary);
  return target;
}

function commitInternalTransfer({ payer, beneficiary, amount, description, channel, idempotencyKey, existingOrder, source }) {
  const value = Number(amount || 0);
  if (!payer || !beneficiary) throw new Error("INTERNAL_TRANSFER_ACCOUNT_NOT_FOUND");
  if (!value || value <= 0) throw new Error("INVALID_AMOUNT");
  if (payer.username === beneficiary.username) throw new Error("SELF_TRANSFER");
  const transferKey = idempotencyKey || existingOrder?.idempotencyKey || ("sites-internal-" + Date.now());
  const previousOrder = state.externalTransfers.find((order) => order.idempotencyKey === transferKey && order.ledgerSettledAt);
  const fingerprint = [payer.username, beneficiary.username, value, String(description || "").trim(), String(channel || "INTERNAL_BRAVUS")].join("|");
  if (previousOrder) {
    if (previousOrder.idempotencyFingerprint && previousOrder.idempotencyFingerprint !== fingerprint) {
      throw new Error("IDEMPOTENCY_CONFLICT");
    }
    return {
      tx: transferTransactionForOrder(previousOrder, payer.username, "TRANSFER_OUT"),
      incomingTx: transferTransactionForOrder(previousOrder, beneficiary.username, "TRANSFER_IN"),
      order: previousOrder,
      replayed: true,
    };
  }
  assertAccountCanDebit(payer, value);

  const tx = {
    id: nextNumericId(state.transactions),
    username: payer.username,
    type: "TRANSFER_OUT",
    amount: value,
    description: description || "Transferencia interna Bravus",
    destinationAccount: beneficiary.accountNumber,
    status: "COMPLETED",
    createdAt: now(),
  };
  const incomingTx = {
    id: tx.id + 1,
    username: beneficiary.username,
    type: "TRANSFER_IN",
    amount: value,
    description: description || "Transferencia recebida Bravus",
    destinationAccount: payer.accountNumber,
    status: "COMPLETED",
    createdAt: now(),
  };
  const order = internalOrderPayload({
    order: existingOrder,
    payer,
    beneficiary,
    tx,
    amount: value,
    description,
    channel,
    idempotencyKey: transferKey,
    settlementMessage: source === "ADMIN"
      ? "Liquidacao interna confirmada no ledger Bravus, sem uso de Celcoin."
      : "Liquidacao interna confirmada no ledger Bravus.",
  });
  order.idempotencyFingerprint = fingerprint;
  applyTransferParties(tx, partyForUser(payer), partyForUser(beneficiary), "PAYER", order.id);
  applyTransferParties(incomingTx, partyForUser(payer), partyForUser(beneficiary), "BENEFICIARY", order.id);

  payer.balance -= value;
  beneficiary.balance += value;
  consumeCreditIfAvailable(payer, value);
  state.transactions.unshift(tx, incomingTx);
  if (!state.externalTransfers.includes(order)) state.externalTransfers.unshift(order);
  appendInternalLedgerPair(order, payer, beneficiary, value, source || "INTERNAL_TRANSFER");
  order.ledgerSettledAt = now();
  order.ledgerStatus = "BALANCED";
  return { tx, incomingTx, order, replayed: false };
}

function reconcileInternalOrder(order) {
  if (!isInternalCompletedOrder(order) || order.ledgerSettledAt || hasBalancedLedger(order.idempotencyKey)) {
    if (isInternalCompletedOrder(order) && hasBalancedLedger(order.idempotencyKey)) {
      order.ledgerSettledAt = order.ledgerSettledAt || now();
      order.ledgerStatus = "BALANCED";
    }
    return;
  }
  const payer = state.users[order.payerUsername || order.username];
  const beneficiary = state.users[order.beneficiaryUsername]
    || findTransferDestination(order.accountNumber)
    || findTransferDestination(order.beneficiaryDocument)
    || findTransferDestination(order.pixKey);
  const amount = Number(order.amountCentavos || 0);
  if (!payer || !beneficiary || !amount || amount <= 0 || payer.username === beneficiary.username) {
    order.ledgerStatus = "RECONCILIATION_BLOCKED";
    order.reconciliationError = "INVALID_INTERNAL_ORDER";
    state.ledgerAudit.unshift({ orderId: order.id, status: order.ledgerStatus, createdAt: now() });
    return;
  }
  const outTx = transferTransactionForOrder(order, payer.username, "TRANSFER_OUT");
  const inTx = transferTransactionForOrder(order, beneficiary.username, "TRANSFER_IN");
  if (!outTx && !inTx) {
    try {
      commitInternalTransfer({
        payer,
        beneficiary,
        amount,
        description: order.description || "Transferencia interna reconciliada",
        channel: order.channel || "PIX",
        idempotencyKey: order.idempotencyKey,
        existingOrder: order,
        source: "RECONCILIATION",
      });
      order.reconciledFromLegacyOrder = true;
      state.ledgerAudit.unshift({ orderId: order.id, status: "RECONCILED_FULL_TRANSFER", createdAt: now() });
    } catch (error) {
      order.ledgerStatus = "RECONCILIATION_BLOCKED";
      order.reconciliationError = error.message;
      state.ledgerAudit.unshift({ orderId: order.id, status: order.ledgerStatus, error: error.message, createdAt: now() });
    }
    return;
  }

  const payerParty = partyForUser(payer);
  const beneficiaryParty = partyForUser(beneficiary);
  let txOut = outTx;
  let txIn = inTx;
  if (!txOut) {
    if (payer.active === false || availableBalanceCentavos(payer) < exactCentavos(amount, "reconciliation_amount")) {
      order.ledgerStatus = "RECONCILIATION_BLOCKED";
      order.reconciliationError = "PAYER_BALANCE_TOO_LOW_FOR_MISSING_DEBIT";
      state.ledgerAudit.unshift({ orderId: order.id, status: order.ledgerStatus, error: order.reconciliationError, createdAt: now() });
      return;
    }
    txOut = {
      id: nextNumericId(state.transactions),
      username: payer.username,
      type: "TRANSFER_OUT",
      amount,
      description: order.description || "Transferencia interna reconciliada",
      destinationAccount: beneficiary.accountNumber,
      status: "COMPLETED",
      createdAt: order.createdAt || now(),
    };
    applyTransferParties(txOut, payerParty, beneficiaryParty, "PAYER", order.id);
    payer.balance -= amount;
    consumeCreditIfAvailable(payer, amount);
    state.transactions.unshift(txOut);
  }
  if (!txIn) {
    txIn = {
      id: nextNumericId(state.transactions),
      username: beneficiary.username,
      type: "TRANSFER_IN",
      amount,
      description: order.description || "Transferencia recebida Bravus",
      destinationAccount: payer.accountNumber,
      status: "COMPLETED",
      createdAt: order.createdAt || now(),
    };
    applyTransferParties(txIn, payerParty, beneficiaryParty, "BENEFICIARY", order.id);
    beneficiary.balance += amount;
    state.transactions.unshift(txIn);
  }
  order.transactionId = txOut.id;
  order.payer = payerParty;
  order.beneficiary = beneficiaryParty;
  order.ledgerSettledAt = now();
  order.ledgerStatus = "BALANCED";
  appendInternalLedgerPair(order, payer, beneficiary, amount, "RECONCILIATION");
  state.ledgerAudit.unshift({ orderId: order.id, status: "RECONCILED_PARTIAL_TRANSFER", createdAt: now() });
}

function reconcileInternalOrders() {
  for (const order of state.externalTransfers) {
    reconcileInternalOrder(order);
  }
}

function completedFinancialTransactions() {
  return state.transactions.filter((tx) =>
    tx
    && String(tx.status || "COMPLETED").toUpperCase() === "COMPLETED"
    && Number(tx.amount || 0) > 0
  );
}

function transactionAmountSign(tx) {
  const amount = Number(tx.amount || 0);
  if (["DEPOSIT", "TRANSFER_IN"].includes(tx.type)) return amount;
  if (["WITHDRAWAL", "TRANSFER_OUT", "TRANSFER_EXTERNAL", "PAYMENT"].includes(tx.type)) return -amount;
  return 0;
}

function openingBalanceForUser(user) {
  if (!user) return 0;
  if (user.username === joao.username) return joao.balance;
  if (user.username === francisca.username) return francisca.balance;
  if (user.username === admin.username) return admin.balance;
  return Number(user.openingBalanceCentavos || user.initialBalanceCentavos || 0);
}

function expectedBalancesFromTransactions() {
  const expected = {};
  for (const user of Object.values(state.users)) {
    expected[user.username] = openingBalanceForUser(user);
  }
  for (const tx of completedFinancialTransactions()) {
    if (!tx.username || expected[tx.username] === undefined) continue;
    expected[tx.username] += transactionAmountSign(tx);
  }
  return expected;
}

function materializeBalancesFromTransactions(reason) {
  const expected = expectedBalancesFromTransactions();
  for (const user of Object.values(state.users)) {
    if (expected[user.username] === undefined) continue;
    const current = Number(user.balance || 0);
    const next = expected[user.username];
    if (current !== next) {
      state.ledgerAudit.unshift({
        status: "BALANCE_MATERIALIZED_FROM_TRANSACTIONS",
        username: user.username,
        previousBalanceCentavos: current,
        correctedBalanceCentavos: next,
        reason,
        createdAt: now(),
      });
      user.balance = next;
    }
  }
}

function syncJoaoCreditGrantFromBalance() {
  const current = state.users[joao.username];
  if (!current) return;
  const used = Math.max(0, joaoCreditGrant.valorConcedido - Number(current.balance || 0));
  joaoCreditGrant.valorUsado = used;
  joaoCreditGrant.valorDisponivel = Math.max(0, joaoCreditGrant.valorConcedido - used);
}

function ledgerPairForTransaction(tx) {
  const transferId = tx.masterCreditGrantId
    ? "master-credit-grant-" + tx.masterCreditGrantId
    : "sites-transaction-" + tx.id + "-" + tx.type;
  if (hasBalancedLedger(transferId)) return;
  const amount = Number(tx.amount || 0);
  const user = state.users[tx.username];
  if (!user || !amount || amount <= 0) return;
  const bank = tx.masterCreditGrantId
    ? { username: masterCreditReserveSeed.code, accountNumber: "MASTER-CREDIT-RESERVE" }
    : { username: "BRAVUS_LEDGER", accountNumber: "BRAVUS-LEDGER" };
  const isCreditToUser = tx.type === "DEPOSIT";
  const debitUser = isCreditToUser ? bank : user;
  const creditUser = isCreditToUser ? user : bank;
  const debitId = nextNumericId(state.ledgerEntries);
  const creditId = debitId + 1;
  const createdAt = tx.createdAt || now();
  state.ledgerEntries.unshift(
    {
      id: creditId,
      transferId,
      transactionId: tx.id,
      accountUsername: creditUser.username,
      accountNumber: creditUser.accountNumber,
      entryType: "credit",
      signedAmountCentavos: amount,
      currency: "BRL",
      reason: tx.masterCreditGrantId ? "MASTER_CREDIT_GRANT" : "TRANSACTION_RECONCILIATION",
      createdAt,
    },
    {
      id: debitId,
      transferId,
      transactionId: tx.id,
      accountUsername: debitUser.username,
      accountNumber: debitUser.accountNumber,
      entryType: "debit",
      signedAmountCentavos: -amount,
      currency: "BRL",
      reason: tx.masterCreditGrantId ? "MASTER_CREDIT_GRANT" : "TRANSACTION_RECONCILIATION",
      createdAt,
    }
  );
  state.ledgerAudit.unshift({ transactionId: tx.id, status: "LEDGER_PAIR_CREATED_FOR_TRANSACTION", transferId, createdAt: now() });
}

function sameReceipt(outTx, inTx) {
  const outReceipt = outTx.receiptOrderId || outTx.externalOrderId || null;
  const inReceipt = inTx.receiptOrderId || inTx.externalOrderId || null;
  return outReceipt && inReceipt && outReceipt === inReceipt;
}

function sameMoment(outTx, inTx) {
  if (!outTx.createdAt || !inTx.createdAt) return false;
  return Math.abs(new Date(outTx.createdAt).getTime() - new Date(inTx.createdAt).getTime()) <= 2000;
}

function existingOrderForOutTransaction(outTx) {
  return state.externalTransfers.find((order) =>
    order.transactionId === outTx.id
    || order.id === outTx.receiptOrderId
    || order.id === outTx.externalOrderId
  ) || null;
}

function reconcileOrphanInternalTransactionPairs() {
  const usedIncoming = new Set();
  const outgoing = completedFinancialTransactions().filter((tx) => tx.type === "TRANSFER_OUT");
  const incoming = completedFinancialTransactions().filter((tx) => tx.type === "TRANSFER_IN");
  for (const outTx of outgoing) {
    const payer = state.users[outTx.username];
    const beneficiary = findTransferDestination(outTx.destinationAccount);
    if (!payer || !beneficiary || payer.username === beneficiary.username) continue;
    const existingOrder = existingOrderForOutTransaction(outTx);
    if (existingOrder && hasBalancedLedger(existingOrder.idempotencyKey)) continue;
    const inTx = incoming.find((candidate) =>
      !usedIncoming.has(candidate.id)
      && candidate.username === beneficiary.username
      && Number(candidate.amount || 0) === Number(outTx.amount || 0)
      && findTransferDestination(candidate.destinationAccount)?.username === payer.username
      && (sameReceipt(outTx, candidate) || sameMoment(outTx, candidate))
    );
    if (!inTx) {
      state.ledgerAudit.unshift({
        transactionId: outTx.id,
        status: "ORPHAN_TRANSFER_OUT_WITHOUT_MATCHING_INCOMING",
        createdAt: now(),
      });
      continue;
    }
    usedIncoming.add(inTx.id);
    const orderId = outTx.receiptOrderId || outTx.externalOrderId || inTx.receiptOrderId || inTx.externalOrderId || nextNumericId(state.externalTransfers);
    const transferKey = existingOrder?.idempotencyKey || outTx.idempotencyKey || inTx.idempotencyKey || ("sites-orphan-internal-" + outTx.id + "-" + inTx.id);
    const order = internalOrderPayload({
      order: existingOrder || { id: orderId, createdAt: outTx.createdAt || inTx.createdAt || now() },
      payer,
      beneficiary,
      tx: outTx,
      amount: Number(outTx.amount || 0),
      description: outTx.description || inTx.description || "Transferencia interna reconciliada",
      channel: "PIX",
      idempotencyKey: transferKey,
      settlementMessage: "Transferencia concluida encontrada no extrato e reconciliada no ledger Bravus.",
    });
    applyTransferParties(outTx, partyForUser(payer), partyForUser(beneficiary), "PAYER", order.id);
    applyTransferParties(inTx, partyForUser(payer), partyForUser(beneficiary), "BENEFICIARY", order.id);
    outTx.receiptOrderId = order.id;
    outTx.externalOrderId = order.id;
    outTx.receiptAvailable = true;
    inTx.receiptOrderId = order.id;
    inTx.externalOrderId = order.id;
    inTx.receiptAvailable = true;
    if (!state.externalTransfers.includes(order)) state.externalTransfers.unshift(order);
    appendInternalLedgerPair(order, payer, beneficiary, Number(outTx.amount || 0), "TRANSACTION_PAIR_RECONCILIATION");
    order.ledgerSettledAt = order.ledgerSettledAt || now();
    order.ledgerStatus = "BALANCED";
    state.ledgerAudit.unshift({ orderId: order.id, status: "ORPHAN_INTERNAL_TRANSFER_RECONCILED", createdAt: now() });
  }
}

function reconcileStandaloneTransactions() {
  for (const tx of completedFinancialTransactions()) {
    if (["DEPOSIT", "WITHDRAWAL", "TRANSFER_EXTERNAL", "PAYMENT"].includes(tx.type)) {
      ledgerPairForTransaction(tx);
    }
  }
}

function balanceMismatches() {
  const expected = expectedBalancesFromTransactions();
  return Object.values(state.users)
    .map((user) => ({
      username: user.username,
      currentBalanceCentavos: Number(user.balance || 0),
      expectedBalanceCentavos: expected[user.username] ?? Number(user.balance || 0),
    }))
    .filter((item) => item.currentBalanceCentavos !== item.expectedBalanceCentavos);
}

function enforceFinancialConsistency(reason) {
  reconcileInternalOrders();
  reconcileOrphanInternalTransactionPairs();
  reconcileStandaloneTransactions();
  materializeBalancesFromTransactions(reason);
  syncJoaoCreditGrantFromBalance();
  for (const user of Object.values(state.users)) availableBalanceCentavos(user);
}

function validateSitesLedger() {
  const groups = {};
  for (const entry of state.ledgerEntries) {
    const key = entry.transferId || "unknown";
    groups[key] = groups[key] || { transferId: key, entryCount: 0, netAmount: 0 };
    groups[key].entryCount += 1;
    groups[key].netAmount += Number(entry.signedAmountCentavos || 0);
  }
  const broken = Object.values(groups).filter((item) => item.entryCount !== 2 || item.netAmount !== 0);
  const mismatches = balanceMismatches();
  return {
    valid: broken.length === 0 && mismatches.length === 0,
    checkedTransfers: Object.keys(groups).length,
    brokenTransfers: broken,
    balanceMismatches: mismatches,
    message: broken.length === 0 && mismatches.length === 0
      ? "Ledger Sites balanceado: debito e credito pareados, saldos materializados pela historia financeira."
      : "Ledger Sites possui divergencias contabeis ou saldo materializado fora da historia financeira.",
  };
}

function inferNetwork(body) {
  if (body.destinationNetwork) return String(body.destinationNetwork).toUpperCase();
  const channel = String(body.channel || "ACH").toUpperCase();
  if (channel === "ACH") return "CAYMAN_ACH";
  if (channel === "EFT") return "CAYMAN_EFT";
  if (channel === "WIRE") return "SWIFT";
  if (["MSB_REMITTANCE", "MSB_FX"].includes(channel)) return "CAYMAN_MSB";
  return channel === "SWIFT" ? "SWIFT" : "CAYMAN_RAIL";
}

const supportedCaymanTransferChannels = new Set([
  "ACH", "EFT", "SWIFT", "WIRE", "MSB_REMITTANCE", "MSB_FX", "CAYMAN_RAIL",
]);

function validateCaymanTransferBody(body) {
  const channel = String(body.channel || "").trim().toUpperCase();
  if (!supportedCaymanTransferChannels.has(channel)) {
    return {
      code: "TRANSFER_RAIL_UNSUPPORTED",
      message: "Canal de transferencia indisponivel. Use ACH/EFT para Cayman, Wire/SWIFT para transferencias internacionais ou o fluxo licenciado de remessa e cambio.",
    };
  }
  if (["MSB_REMITTANCE", "MSB_FX"].includes(channel)) {
    return {
      code: "MSB_LICENSE_REQUIRED",
      message: "Remessas e cambio estao indisponiveis ate a ativacao da licenca de Money Services Business pela CIMA. Nenhum valor foi debitado.",
    };
  }
  if (!String(body.accountNumber || "").trim()) {
    return {
      code: "DESTINATION_ACCOUNT_REQUIRED",
      message: "Informe a conta beneficiaria para o canal selecionado.",
    };
  }
  body.channel = channel;
  body.destinationNetwork = inferNetwork(body);
  return null;
}

function normalizeExternalBic(value) {
  return String(value || "").trim().toUpperCase();
}

function externalBicValidationError(value, country, bravusOwned) {
  const bic = normalizeExternalBic(value);
  if (!bic) return null;
  if (bravusOwned) {
    return "O BIC " + bravusInstitutionProfile.swiftBic
      + " e interno e nao registrado. Use " + bravusInstitutionProfile.internalRoutingCode
      + " ate a emissao oficial pela SWIFT.";
  }
  if (!/^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}(?:[A-Z0-9]{3})?$/.test(bic)) {
    return "BIC externo invalido. Informe 8 ou 11 caracteres no formato ISO 9362.";
  }
  const normalizedCountry = String(country || "").trim().toUpperCase();
  if (normalizedCountry.length === 2 && bic.slice(4, 6) !== normalizedCountry) {
    return "O pais do BIC externo deve corresponder ao pais do participante.";
  }
  return null;
}

function isBravusOwned(participant) {
  if (!participant) return false;
  return String(participant.participantCode || "").startsWith("BRAVUS")
    || participant.bankCode === "999"
    || participant.network === "INTERNAL_BRAVUS";
}

function resolveGlobalParticipant(body, network) {
  const explicit = String(body.participantCode || "").trim().toUpperCase();
  if (explicit) return state.globalRailParticipants.find((p) => p.participantCode === explicit) || null;
  return state.globalRailParticipants.find((p) =>
    p.network === network
    && ((body.bankCode && p.bankCode === body.bankCode) || (body.ispb && p.ispb === body.ispb))
  ) || null;
}

function settlementFor(body, idempotencyKey) {
  const destinationNetwork = inferNetwork(body);
  const participant = resolveGlobalParticipant(body, destinationNetwork);
  if (!participant) {
    return {
      destinationNetwork,
      destinationParticipantCode: null,
      settlementStatus: "DEBITADA_NO_BRAVUS_AGUARDANDO_CONEXAO_DESTINO",
      receiptKind: "COMPROVANTE_SAIDA_BRAVUS",
      settlementMessage: "Saida concluida no ledger Bravus. Destino aguarda participante/conector ativo para confirmar liquidacao.",
    };
  }
  if (participant.status !== "ACTIVE") {
    return {
      destinationNetwork,
      destinationParticipantCode: participant.participantCode,
      settlementStatus: "DEBITADA_NO_BRAVUS_PARTICIPANTE_INATIVO",
      receiptKind: "COMPROVANTE_SAIDA_BRAVUS",
      settlementMessage: "Saida concluida no ledger Bravus. Participante destino nao esta ativo.",
    };
  }
  if (participant.connectionMode === "SELF_LEDGER" && isBravusOwned(participant)) {
    return {
      destinationNetwork,
      destinationParticipantCode: participant.participantCode,
      destinationConfirmationId: "global-self-" + idempotencyKey,
      destinationConfirmedAt: now(),
      settlementStatus: "LIQUIDADA_CONFIRMADA",
      receiptKind: "COMPROVANTE_LIQUIDACAO_CONFIRMADA",
      settlementMessage: "Liquidacao confirmada em participante controlado pelo Bravus.",
    };
  }
  return {
    destinationNetwork,
    destinationParticipantCode: participant.participantCode,
    settlementStatus: participant.connectionMode === "MANUAL_CONFIRMATION" ? "AGUARDANDO_CONFIRMACAO_MANUAL" : "ENVIADA_A_CONECTOR",
    receiptKind: "COMPROVANTE_SAIDA_BRAVUS",
    settlementMessage: "Saida concluida no ledger Bravus. Aguardando confirmacao do participante destino.",
  };
}

function bankMe(user) {
  const availableBalance = availableBalanceNumber(user);
  const heldBalance = Number(heldBalanceCentavos(user));
  return {
    ...userSummary(user),
    phoneFormatted: user.phone || null,
    dadosBancarios: {
      nomeBanco: "Bravus Premium Bank",
      codigoBanco: "999",
      ispb: "99999999",
      countryCode: bravusInstitutionProfile.countryCode,
      currency: bravusInstitutionProfile.currency,
      internalRoutingCode: bravusInstitutionProfile.internalRoutingCode,
      swiftBic: bravusInstitutionProfile.swiftBic,
      swiftBicStatus: bravusInstitutionProfile.swiftBicStatus,
      swiftBicRegistered: false,
      swiftConnected: false,
      swiftExternalRoutingEnabled: false,
      agencia: "0001",
      conta: user.accountNumber,
      contaFormatada: user.accountNumber.slice(0, -1) + "-" + user.accountNumber.slice(-1),
      tipoConta: user.accountType,
      chavePix: user.cpf || user.email,
      tipoChavePix: user.cpf ? "CPF" : "EMAIL",
    },
    saldos: {
      saldoDisponivelCentavos: availableBalance,
      saldoDisponivel: availableBalance / 100,
      saldoContabilCentavos: user.balance,
      saldoContabil: user.balance / 100,
      saldoRetidoCentavos: heldBalance,
      saldoRetido: heldBalance / 100,
      limiteCreditoCentavos: 0,
      limiteCredito: 0,
      limitePixDiarioCentavos: 1000000,
      limitePixDiario: 10000,
      totalDisponivelCentavos: availableBalance,
      totalDisponivel: availableBalance / 100,
    },
    conta: {
      nivel: "PREMIUM",
      statusKyc: user.statusKyc || "STATUS_NAO_INFORMADO",
      ativa: user.active !== false,
      abertura: "2026-07-12T00:00:00-03:00",
    },
    endereco: { cep: null, rua: null, numero: null, cidade: null, uf: null },
    dataNascimento: null,
    nomeMae: null,
    profissao: null,
  };
}

function receiptForOrder(order, user) {
  const payerUser = state.users[order.payerUsername || order.username] || user;
  const payer = order.payer || partyForUser(payerUser);
  const beneficiary = order.beneficiary || {
    name: order.beneficiaryName,
    document: order.beneficiaryDocument,
    bankName: order.beneficiaryBankName || null,
    bankCode: order.bankCode,
    ispb: order.ispb,
    agency: order.agency,
    accountNumber: order.accountNumber,
    accountDigit: order.accountDigit,
    accountType: order.accountType,
    pixKey: order.pixKey,
    pixKeyType: order.pixKeyType,
  };
  return {
    receiptId: "BRAVUS-" + order.idempotencyKey,
    orderId: order.id,
    transactionId: order.transactionId,
    provider: order.provider,
    providerTransferId: order.providerTransferId,
    idempotencyKey: order.idempotencyKey,
    status: order.status,
    settlementStatus: order.settlementStatus,
    receiptKind: order.receiptKind,
    destinationNetwork: order.destinationNetwork,
    destinationParticipantCode: order.destinationParticipantCode,
    destinationConfirmationId: order.destinationConfirmationId,
    destinationConfirmedAt: order.destinationConfirmedAt,
    settlementMessage: order.settlementMessage,
    createdAt: order.createdAt,
    amountCentavos: order.amountCentavos,
    currency: order.currency,
    channel: order.channel,
    description: order.description,
    payer,
    beneficiary,
  };
}

function userFromToken(request) {
  const auth = request.headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\\s+/i, "").trim();
  const session = state.sessions[token];
  if (!session) return null;
  const expiresAt = new Date(session.expiresAt).getTime();
  const absoluteExpiresAt = new Date(session.absoluteExpiresAt || session.expiresAt).getTime();
  if (expiresAt <= Date.now() || absoluteExpiresAt <= Date.now()) {
    delete state.sessions[token];
    return null;
  }
  if (session.nativeSession) {
    session.expiresAt = new Date(Math.min(Date.now() + NATIVE_SESSION_IDLE_MS, absoluteExpiresAt)).toISOString();
  }
  const user = state.users[session.username] || null;
  if (!user || user.active === false) return null;
  return user;
}

function publicLoginMatches(user, username) {
  const normalized = String(username || "").replace(/\\D/g, "");
  const raw = String(username || "").trim().toLowerCase();
  return raw === user.username.toLowerCase()
    || raw === user.email.toLowerCase()
    || (user.cpf && normalized === user.cpf);
}

function canUseOutgoingBanking(user) {
  return user?.active !== false && hasExplicitApprovedKyc(user);
}

function hasExplicitApprovedKyc(user) {
  return user?.statusKyc === "APROVADO_AUTO" || user?.statusKyc === "APROVADO_IDENTIDADE";
}

function outgoingKycBlocked(user) {
  return json({
    message: "N\u00e3o foi poss\u00edvel concluir esta opera\u00e7\u00e3o. Sua conta est\u00e1 passando por uma an\u00e1lise interna de seguran\u00e7a e valida\u00e7\u00e3o cadastral. Esse processo pode levar at\u00e9 15 dias corridos. Enquanto isso, a conta permanece habilitada para receber valores normalmente.",
    code: "KYC_IDENTITY_PENDING",
    statusKyc: user.statusKyc || "PENDENTE_VALIDACAO_IDENTIDADE",
  }, { status: 403 });
}

function imageDimensions(mime, base64) {
  let binary;
  try {
    binary = atob(base64);
  } catch {
    return null;
  }
  const byte = (index) => binary.charCodeAt(index);
  if (mime === "image/png" && binary.length >= 24
    && byte(0) === 0x89 && binary.slice(1, 4) === "PNG") {
    const width = ((byte(16) << 24) | (byte(17) << 16) | (byte(18) << 8) | byte(19)) >>> 0;
    const height = ((byte(20) << 24) | (byte(21) << 16) | (byte(22) << 8) | byte(23)) >>> 0;
    return width && height ? { width, height } : null;
  }
  if (mime !== "image/jpeg" || binary.length < 12 || byte(0) !== 0xff || byte(1) !== 0xd8) return null;
  const startOfFrame = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
  let offset = 2;
  while (offset + 8 < binary.length) {
    if (byte(offset) !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = byte(offset + 1);
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    const segmentLength = (byte(offset + 2) << 8) | byte(offset + 3);
    if (segmentLength < 2 || offset + segmentLength + 2 > binary.length) break;
    if (startOfFrame.has(marker)) {
      const height = (byte(offset + 5) << 8) | byte(offset + 6);
      const width = (byte(offset + 7) << 8) | byte(offset + 8);
      return width && height ? { width, height } : null;
    }
    offset += segmentLength + 2;
  }
  return null;
}

function imageEvidence(value, label, minBytes, minWidth = 1, minHeight = 1) {
  const raw = String(value || "");
  const match = raw.match(/^data:(image\\/(jpeg|png));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return { label, ok: false, present: Boolean(raw), message: label + " deve ser imagem JPEG ou PNG em base64." };
  const base64 = match[3];
  const bytes = Math.floor((base64.length * 3) / 4);
  if (bytes > 5 * 1024 * 1024) {
    return { label, ok: false, present: true, mime: match[1], bytes, message: label + " excede o limite de 5 MB." };
  }
  const dimensions = imageDimensions(match[1], base64);
  const sizeOk = bytes >= minBytes;
  const dimensionsOk = Boolean(dimensions && dimensions.width >= minWidth && dimensions.height >= minHeight);
  const ok = sizeOk && dimensionsOk;
  return {
    label,
    ok,
    present: true,
    mime: match[1],
    bytes,
    width: dimensions?.width || 0,
    height: dimensions?.height || 0,
    fingerprint: match[1] + ":" + bytes + ":" + base64.slice(0, 32) + ":" + base64.slice(-32),
    message: !sizeOk
      ? label + " esta muito pequena para analise."
      : (!dimensionsOk ? label + " nao possui resolucao valida para analise." : null),
  };
}

function buildKycAnalysis(body, user) {
  const documentNumber = digits(body.cpf || body.document || user?.cpf);
  const documentType = documentTypeFor(body.type, documentNumber);
  const front = imageEvidence(body.documentFrontImage, "Frente do documento", 3500, 220, 140);
  const back = imageEvidence(body.documentBackImage, "Verso do documento", 3500, 220, 140);
  const requireFace = body.requireFace !== false;
  const face = requireFace
    ? imageEvidence(body.faceImage, "Biometria facial", 2500, 240, 240)
    : { ok: true, present: false, mime: null, bytes: 0, width: 0, height: 0, fingerprint: null };
  const duplicateEvidence =
    front.fingerprint
    && (front.fingerprint === back.fingerprint || (face.fingerprint && (front.fingerprint === face.fingerprint || back.fingerprint === face.fingerprint)));
  const checks = requireFace ? [front, back, face] : [front, back];
  const messages = checks.filter((item) => !item.ok).map((item) => item.message);
  if (duplicateEvidence) messages.push("As imagens de documento e face devem ser capturas diferentes.");
  const evidenceOk = messages.length === 0;
  const documentChecksumOk = documentType === "CNPJ" ? validCnpj(documentNumber) : validCpf(documentNumber);
  return {
    id: state.documentAnalyses.length + 1,
    documentType,
    documentNumber,
    status: evidenceOk ? "EVIDENCIA_CAPTURADA_AUTO" : "REJEITADO_EVIDENCIA_INSUFICIENTE",
    riskLevel: evidenceOk ? "PENDENTE_IDENTIDADE" : "ALTO",
    riskScore: evidenceOk ? (documentChecksumOk ? 18 : 35) : 92,
    provider: "BRAVUS_CAPTURE_QUALITY_SITES",
    subjectName: body.fullName || user?.fullName || "Titular informado",
    registrationStatus: documentChecksumOk ? "EVIDENCIA_DOCUMENTAL_CAPTURADA" : "DOCUMENTO_PENDENTE_VALIDACAO_OFICIAL",
    biometricStatus: requireFace ? (face.ok ? "CAPTURA_QUALIDADE_VALIDADA" : "FACE_AUSENTE") : "BIOMETRIA_NAO_SOLICITADA",
    biometricChallenge: requireFace ? (body.biometricChallenge || "FACE_CAMERA_CAPTURE_V1") : "DISABLED_ADMIN_POLICY",
    evidence: {
      documentFront: { present: front.present, mime: front.mime || null, bytes: front.bytes || 0, width: front.width || 0, height: front.height || 0 },
      documentBack: { present: back.present, mime: back.mime || null, bytes: back.bytes || 0, width: back.width || 0, height: back.height || 0 },
      face: { present: face.present, mime: face.mime || null, bytes: face.bytes || 0, width: face.width || 0, height: face.height || 0 },
    },
    errorMessage: evidenceOk ? null : messages.join(" "),
    createdAt: now(),
  };
}

function isMobileRegistrationClient(request, body) {
  const client = request.headers.get("x-bravus-client");
  return (client === "android-apk" && body.clientChannel === "ANDROID_APK")
    || (client === "ios-app" && body.clientChannel === "IOS_APP")
    || (client === "mobile-app" && body.clientChannel === "MOBILE_APP");
}

function registrationIdentity(body) {
  const cpf = String(body.cpf || "").replace(/\\D/g, "");
  return {
    cpf,
    username: String(body.username || "").trim().toLowerCase(),
    email: String(body.email || "").trim().toLowerCase(),
  };
}

function registrationAvailability(body) {
  const identity = registrationIdentity(body);
  const fieldErrors = {};
  if (identity.cpf.length !== 11) fieldErrors.cpf = "Informe CPF com 11 digitos.";
  else if (!validCpf(identity.cpf)) fieldErrors.cpf = "Informe um CPF valido.";
  if (identity.username.length < 3) fieldErrors.username = "Informe um usuario com pelo menos 3 caracteres.";
  if (!/^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test(identity.email)) fieldErrors.email = "Informe um e-mail valido.";

  const users = Object.values(state.users);
  const cpfConflict = identity.cpf.length === 11 && users.some((item) => item.cpf === identity.cpf);
  const usernameConflict = identity.username.length >= 3
    && users.some((item) => item.username.toLowerCase() === identity.username);
  const emailConflict = Boolean(identity.email)
    && users.some((item) => item.email.toLowerCase() === identity.email);
  const conflict = cpfConflict || usernameConflict || emailConflict;
  let code = "REGISTRATION_AVAILABLE";
  let message = "Dados disponiveis para abertura da conta.";
  if (cpfConflict) {
    code = "ACCOUNT_ALREADY_EXISTS";
    message = "Este CPF ja possui conta no Bravus. Entre na conta ou redefina a senha.";
  } else if (usernameConflict) {
    code = "USERNAME_ALREADY_EXISTS";
    message = "Este usuario ja esta em uso. Escolha outro usuario.";
  } else if (emailConflict) {
    code = "EMAIL_ALREADY_EXISTS";
    message = "Este e-mail ja esta vinculado a uma conta. Entre ou redefina a senha.";
  } else if (Object.keys(fieldErrors).length) {
    code = "REGISTRATION_INVALID_INPUT";
    message = Object.values(fieldErrors).join(" ");
  }
  return {
    available: !conflict && Object.keys(fieldErrors).length === 0,
    accountExists: cpfConflict,
    code,
    message,
    fieldErrors,
    nextAction: cpfConflict || emailConflict ? "LOGIN_OR_PASSWORD_RESET" : (usernameConflict ? "EDIT_USERNAME" : "CONTINUE"),
    identity,
  };
}

async function registrationSubjectHash(identity) {
  return sha256Text([identity.username, identity.email, identity.cpf].join("|"));
}

async function recordRegistrationCheck(request, availability) {
  const cutoff = Date.now() - 15 * 60 * 1000;
  state.registrationChecks = state.registrationChecks
    .filter((item) => new Date(item.createdAt).getTime() >= cutoff)
    .slice(0, 299);
  const actorHash = await sha256Text(request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "mobile-client");
  const subjectHash = await registrationSubjectHash(availability.identity);
  const repeatedCheck = state.registrationChecks.find((item) =>
    item.actorHash === actorHash
    && item.subjectHash === subjectHash
    && item.outcome === availability.code
    && Date.now() - new Date(item.createdAt).getTime() < registrationCheckDeduplicationMs
  );
  if (repeatedCheck) {
    return { rateLimited: false, actorHash, subjectHash, idempotentReplay: true };
  }
  if (state.registrationChecks.filter((item) => item.actorHash === actorHash).length >= 15) {
    return { rateLimited: true, actorHash };
  }
  state.registrationChecks.unshift({
    id: crypto.randomUUID(), actorHash, subjectHash, outcome: availability.code, createdAt: now(),
  });
  state.registrationAudit.unshift({
    id: crypto.randomUUID(), eventType: "AVAILABILITY_CHECKED", actor: "PUBLIC_MOBILE",
    subjectHash, detail: availability.code, createdAt: now(),
  });
  state.registrationAudit = state.registrationAudit.slice(0, 500);
  return { rateLimited: false, actorHash, subjectHash };
}

function publicAccountRequests() {
  return state.accountProvisioningRequests.filter((item) => item.requestType === "PUBLIC_ACCOUNT_REQUEST");
}

async function createPublicAccountRequest(body, recorded, availability) {
  const identity = availability.identity;
  const fullName = String(body.fullName || "").trim();
  const phone = String(body.phone || "").replace(/\\D/g, "");
  const idempotencyKey = String(body.idempotencyKey || "").trim();
  const idempotentRequest = publicAccountRequests().find((item) => item.idempotencyKey === idempotencyKey);
  if (idempotencyKey && idempotentRequest) {
    const sameIdentity = idempotentRequest.identity?.cpf === identity.cpf
      && idempotentRequest.identity?.email === identity.email
      && idempotentRequest.identity?.username === identity.username;
    if (!sameIdentity) {
      return { error: json({ message: "Chave de cadastro reutilizada com dados diferentes.", code: "REGISTRATION_REQUEST_IDEMPOTENCY_CONFLICT" }, { status: 409 }) };
    }
    return {
      response: json({
        status: idempotentRequest.status,
        requestId: idempotentRequest.id,
        message: "Esta conta ja foi criada e permanece em analise.",
        adminReviewRequired: true,
        accountCreated: true,
        accountNumber: state.users[idempotentRequest.identity.username]?.accountNumber || idempotentRequest.accountNumber,
        duplicateRequest: true,
      }, { status: 202, headers: { "cache-control": "no-store" } }),
    };
  }
  if (!availability.available) {
    const { identity: privateIdentity, ...publicAvailability } = availability;
    return { error: json(publicAvailability, { status: 409, headers: { "cache-control": "no-store" } }) };
  }
  if (fullName.length < 5 || fullName.length > 120) {
    return { error: badRequest("Informe o nome completo do titular.", "REGISTRATION_FULL_NAME_REQUIRED") };
  }
  const password = String(body.password || "");
  const numericPassword = String(body.numericPassword || "");
  if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)[A-Za-z\\d]{8,64}$/.test(password)) {
    return { error: badRequest("A senha alfanumerica deve ter de 8 a 64 caracteres, com letra maiuscula, minuscula e numero.", "REGISTRATION_PASSWORD_INVALID") };
  }
  if (!/^\\d{8}$/.test(numericPassword)) {
    return { error: badRequest("A senha numerica deve conter exatamente 8 digitos.", "REGISTRATION_NUMERIC_PASSWORD_INVALID") };
  }
  const evidenceAnalysis = buildKycAnalysis({ ...body, cpf: identity.cpf, fullName, requireFace: true }, null);
  if (evidenceAnalysis.status !== "EVIDENCIA_CAPTURADA_AUTO") {
    return { error: badRequest(evidenceAnalysis.errorMessage || "Envie frente e verso do documento.", "REGISTRATION_DOCUMENT_EVIDENCE_REQUIRED") };
  }
  const [documentFrontHash, documentBackHash] = await Promise.all([
    sha256Text(String(body.documentFrontImage || "")),
    sha256Text(String(body.documentBackImage || "")),
  ]);
  const [passwordRequestHash, numericPasswordRequestHash] = await Promise.all([
    sha256Text(password + "|" + passwordPepper()),
    sha256Text(numericPassword + "|" + passwordPepper()),
  ]);
  const fingerprintMaterial = [
    identity.cpf, identity.username, identity.email, fullName.toLowerCase(), phone,
    documentFrontHash, documentBackHash, passwordRequestHash, numericPasswordRequestHash,
  ].map((value) => String(value).length + ":" + String(value)).join("|");
  const fingerprint = await sha256Text(fingerprintMaterial);
  const previous = publicAccountRequests().find((item) =>
    item.idempotencyKey === idempotencyKey
    || item.fingerprint === fingerprint
    || item.identity?.cpf === identity.cpf
    || item.identity?.email === identity.email
    || item.identity?.username === identity.username
  );
  if (previous) {
    if (previous.idempotencyKey && idempotencyKey && previous.idempotencyKey === idempotencyKey && previous.fingerprint !== fingerprint) {
      return { error: json({ message: "Chave de cadastro reutilizada com dados diferentes.", code: "REGISTRATION_REQUEST_IDEMPOTENCY_CONFLICT" }, { status: 409 }) };
    }
    return {
      response: json({
        status: previous.status,
        requestId: previous.id,
        message: "Esta conta ja foi criada e permanece em analise.",
        adminReviewRequired: true,
        accountCreated: true,
        accountNumber: state.users[previous.identity?.username]?.accountNumber || previous.accountNumber,
        duplicateRequest: true,
      }, { status: 202, headers: { "cache-control": "no-store" } }),
    };
  }
  let documentFront;
  let documentBack;
  let face;
  try {
    documentFront = await stageBiometricEvidence({ value: body.documentFrontImage, kind: "KYC_DOCUMENT_FRONT", username: identity.username });
    documentBack = await stageBiometricEvidence({ value: body.documentBackImage, kind: "KYC_DOCUMENT_BACK", username: identity.username });
    face = await stageBiometricEvidence({ value: body.faceImage, kind: "ENROLLED_FACE", username: identity.username });
  } catch (error) {
    pendingBiometricWrites = [];
    return { error: json({ message: "Nao foi possivel proteger as evidencias de identidade.", code: error.message }, { status: 503 }) };
  }
  const createdAt = now();
  const accountNumber = randomFourDigitAccountNumber();
  evidenceAnalysis.subjectName = fullName;
  state.documentAnalyses.unshift(evidenceAnalysis);
  const createdAccount = {
    ...joao,
    id: Math.max(0, ...Object.values(state.users).map((item) => Number(item.id) || 0)) + 1,
    username: identity.username,
    email: identity.email,
    fullName,
    cpf: identity.cpf,
    phone,
    accountNumber,
    balance: 0,
    roles: ["ROLE_USER"],
    statusKyc: "PENDENTE_VALIDACAO_IDENTIDADE",
    kycAnalysisId: evidenceAnalysis.id,
    kycEvidenceSubmittedAt: createdAt,
    credentialState: "ACTIVE",
    initialCredentialExpiresAt: null,
    passwordCredential: await createPasswordCredential(password),
    numericPasswordCredential: await createPasswordCredential(numericPassword),
    active: true,
    createdAt,
  };
  state.users[createdAccount.username] = createdAccount;
  state.kycEvidence[createdAccount.username] = {
    analysisId: evidenceAnalysis.id,
    documentType: evidenceAnalysis.documentType,
    documentNumber: evidenceAnalysis.documentNumber,
    biometricStatus: evidenceAnalysis.biometricStatus,
    evidence: evidenceAnalysis.evidence,
    documentFrontEvidenceId: documentFront.id,
    documentBackEvidenceId: documentBack.id,
    faceEvidenceId: face.id,
    faceSha256: face.sha256,
    createdAt,
  };
  const requestEntry = {
    id: crypto.randomUUID(),
    requestType: "PUBLIC_ACCOUNT_REQUEST",
    idempotencyKey: idempotencyKey || "public-account-" + crypto.randomUUID(),
    fingerprint,
    status: "PENDING_ADMIN_REVIEW",
    identity,
    fullName,
    phone,
    documentFrontEvidenceId: documentFront.id,
    documentBackEvidenceId: documentBack.id,
    faceEvidenceId: face.id,
    faceSha256: face.sha256,
    documentEvidence: evidenceAnalysis.evidence,
    subjectHash: recorded.subjectHash,
    actor: "PUBLIC",
    accountNumber,
    createdAt,
  };
  state.accountProvisioningRequests.unshift(requestEntry);
  state.registrationAudit.unshift({
    id: crypto.randomUUID(), eventType: "PUBLIC_ACCOUNT_REQUESTED", actor: "PUBLIC",
    subjectHash: recorded.subjectHash, detail: "Conta criada com operacoes de saida bloqueadas e enviada para analise do administrador.", createdAt,
  });
  state.registrationAudit = state.registrationAudit.slice(0, 500);
  return {
    response: json({
      status: requestEntry.status,
      requestId: requestEntry.id,
      message: "Conta criada e enviada para analise. Ela ja pode receber valores.",
      adminReviewRequired: true,
      accountCreated: true,
      accountNumber,
      documentEvidenceReceived: true,
      faceEvidenceReceived: true,
    }, { status: 202, headers: { "cache-control": "no-store" } }),
  };
}

async function validatedRegistrationFaceCheck(body) {
  const tokenHash = await sha256Text(String(body.faceVerificationToken || ""));
  const subjectHash = await registrationSubjectHash(registrationIdentity(body));
  const faceSha256 = await sha256Text(String(body.faceImage || ""));
  const check = state.registrationFaceChecks.find((item) => item.tokenHash === tokenHash) || null;
  if (!check || check.status !== "VALIDATED" || check.subjectHash !== subjectHash || check.faceSha256 !== faceSha256) return null;
  if (new Date(check.expiresAt).getTime() <= Date.now()) return null;
  return check;
}

async function validatedKycEnrollmentCheck(body, user) {
  const tokenHash = await sha256Text(String(body.faceVerificationToken || ""));
  const faceSha256 = await sha256Text(String(body.faceImage || ""));
  const check = state.kycEnrollmentChecks.find((item) => item.tokenHash === tokenHash) || null;
  if (!check || check.status !== "VALIDATED" || check.username !== user.username || check.faceSha256 !== faceSha256) return null;
  if (new Date(check.expiresAt).getTime() <= Date.now()) return null;
  return check;
}

function analyzeDocumentRequest(body) {
  const documentNumber = digits(body.document || body.cpf || "");
  const documentType = documentTypeFor(body.type, documentNumber);
  const knownUser = Object.values(state.users).find((item) => item.cpf === documentNumber) || null;
  const existing = state.documentAnalyses.find((item) => item.documentNumber === documentNumber);
  if (existing) return { ...existing, subjectName: knownUser?.fullName || existing.subjectName };
  const checksumOk = documentType === "CNPJ" ? validCnpj(documentNumber) : validCpf(documentNumber);
  const analysis = {
    id: state.documentAnalyses.length + 1,
    documentType,
    documentNumber,
    status: checksumOk ? "ANALISADO_AUTOMATICAMENTE" : "REVISAO_NECESSARIA",
    riskLevel: checksumOk ? "BAIXO" : "MEDIO",
    riskScore: checksumOk ? 12 : 55,
    provider: "BRAVUS_SELF_KYC_SITES",
    subjectName: knownUser?.fullName || null,
    registrationStatus: knownUser ? (knownUser.statusKyc || "STATUS_NAO_INFORMADO") : "DOCUMENTO_NAO_VINCULADO_A_CONTA_BRAVUS",
    biometricStatus: knownUser ? "KYC_BRAVUS_LOCALIZADO" : "SEM_BIOMETRIA_BRAVUS",
    errorMessage: checksumOk ? null : "Digito verificador nao passou na validacao local.",
    createdAt: now(),
  };
  state.documentAnalyses.unshift(analysis);
  return analysis;
}

let d1SchemaReady = false;
let apiQueue = Promise.resolve();

function enqueueApi(task) {
  const run = apiQueue.then(task, task);
  apiQueue = run.then(() => undefined, () => undefined);
  return run;
}

function masterCreditEventSchemaReady(sql) {
  const normalized = String(sql || "")
    .split(String.fromCharCode(96)).join("")
    .replace(/\"/g, "")
    .replace(/\\s+/g, " ")
    .toLowerCase();
  const uniqueIdempotency = normalized.includes("idempotency_hash text not null unique")
    || normalized.includes("unique (idempotency_hash)");
  return uniqueIdempotency
    && normalized.includes("amount_centavos <> '0'")
    && normalized.includes("grant_id is null and account_username is null")
    && normalized.includes("unique (grant_id, event_type)");
}

async function ensureD1Schema(db) {
  if (d1SchemaReady) return;
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS bravus_state (id INTEGER PRIMARY KEY NOT NULL CHECK (id = 1), revision INTEGER NOT NULL CHECK (revision >= 1), payload TEXT NOT NULL, payload_hash TEXT NOT NULL, source_captured_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)"),
    db.prepare("CREATE TABLE IF NOT EXISTS bravus_state_audit (id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, revision INTEGER NOT NULL UNIQUE, request_id TEXT NOT NULL, method TEXT NOT NULL, path TEXT NOT NULL, actor TEXT NOT NULL, previous_hash TEXT NOT NULL, payload_hash TEXT NOT NULL, created_at TEXT NOT NULL)"),
    db.prepare("CREATE TABLE IF NOT EXISTS bravus_ledger_entries (transfer_id TEXT NOT NULL, entry_type TEXT NOT NULL CHECK (entry_type IN ('debit','credit')), order_id INTEGER, account_username TEXT, account_number TEXT NOT NULL, signed_amount_centavos INTEGER NOT NULL, currency TEXT NOT NULL DEFAULT 'BRL', reason TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY (transfer_id, entry_type), CHECK ((entry_type = 'debit' AND signed_amount_centavos < 0) OR (entry_type = 'credit' AND signed_amount_centavos > 0)))"),
    db.prepare("CREATE TABLE IF NOT EXISTS bravus_biometric_evidence (id TEXT PRIMARY KEY NOT NULL, kind TEXT NOT NULL CHECK (kind IN ('ENROLLED_FACE','PASSWORD_RESET_FACE','KYC_DOCUMENT_FRONT','KYC_DOCUMENT_BACK')), owner_username TEXT NOT NULL, mime TEXT NOT NULL, ciphertext TEXT NOT NULL, iv TEXT NOT NULL, sha256 TEXT NOT NULL, created_at TEXT NOT NULL)"),
    db.prepare("CREATE TABLE IF NOT EXISTS bravus_kyc_audit (id TEXT PRIMARY KEY NOT NULL, username TEXT NOT NULL, actor TEXT NOT NULL, from_status TEXT NOT NULL, to_status TEXT NOT NULL, reason TEXT NOT NULL, created_at TEXT NOT NULL)"),
    db.prepare("CREATE TABLE IF NOT EXISTS bravus_institutional_reserve (code TEXT PRIMARY KEY NOT NULL, currency TEXT NOT NULL CHECK (currency = 'BRL'), amount_centavos TEXT NOT NULL CHECK (length(amount_centavos) BETWEEN 1 AND 40 AND amount_centavos NOT GLOB '*[^0-9]*'), classification TEXT NOT NULL CHECK (classification = 'INSTITUTIONAL'), status TEXT NOT NULL CHECK (status IN ('DECLARED','VERIFIED','SUSPENDED')), customer_funds INTEGER NOT NULL CHECK (customer_funds = 0), transferable INTEGER NOT NULL CHECK (transferable = 0), source_reference TEXT NOT NULL, policy_version INTEGER NOT NULL CHECK (policy_version >= 1), payload_hash TEXT NOT NULL, declared_at TEXT NOT NULL)"),
    db.prepare("CREATE TABLE IF NOT EXISTS bravus_institutional_reserve_audit (id TEXT PRIMARY KEY NOT NULL, reserve_code TEXT NOT NULL, event_type TEXT NOT NULL CHECK (event_type IN ('RESERVE_DECLARED','RESERVE_VERIFIED','RESERVE_SUSPENDED')), amount_centavos TEXT NOT NULL, status TEXT NOT NULL, actor TEXT NOT NULL, reason TEXT NOT NULL, payload_hash TEXT NOT NULL, created_at TEXT NOT NULL, FOREIGN KEY (reserve_code) REFERENCES bravus_institutional_reserve(code))"),
    db.prepare("CREATE TABLE IF NOT EXISTS bravus_account_provisioning_audit (id TEXT PRIMARY KEY NOT NULL, account_username TEXT NOT NULL, subject_hash TEXT NOT NULL, actor TEXT NOT NULL, event_type TEXT NOT NULL CHECK (event_type = 'ACCOUNT_PROVISIONED_PENDING_IDENTITY'), created_at TEXT NOT NULL)"),
    db.prepare("CREATE TABLE IF NOT EXISTS bravus_master_credit_reserve (code TEXT PRIMARY KEY NOT NULL, currency TEXT NOT NULL CHECK (currency = 'BRL'), total_amount_centavos TEXT NOT NULL CHECK (length(total_amount_centavos) BETWEEN 1 AND 40 AND total_amount_centavos NOT GLOB '*[^0-9]*'), classification TEXT NOT NULL CHECK (classification = 'MASTER_BOOK_CREDIT'), status TEXT NOT NULL CHECK (status = 'ACTIVE'), transfer_scope TEXT NOT NULL CHECK (transfer_scope = 'ADMIN_APPROVED_CUSTOMERS'), admin_only INTEGER NOT NULL CHECK (admin_only = 1), policy_version INTEGER NOT NULL CHECK (policy_version >= 1), payload_hash TEXT NOT NULL, activated_at TEXT NOT NULL)"),
    db.prepare("CREATE TABLE IF NOT EXISTS bravus_master_credit_events (id TEXT PRIMARY KEY NOT NULL, reserve_code TEXT NOT NULL, grant_id TEXT, event_type TEXT NOT NULL CHECK (event_type IN ('RESERVE_ACTIVATED','GRANT_CREATED','GRANT_RELEASED')), account_username TEXT, amount_centavos TEXT NOT NULL CHECK (length(amount_centavos) BETWEEN 1 AND 40 AND amount_centavos NOT GLOB '*[^0-9]*' AND amount_centavos <> '0' AND (amount_centavos = '0' OR substr(amount_centavos, 1, 1) <> '0')), actor TEXT NOT NULL, assessment_reason TEXT NOT NULL, eligibility_rule TEXT, idempotency_hash TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL, FOREIGN KEY (reserve_code) REFERENCES bravus_master_credit_reserve(code), UNIQUE (grant_id, event_type), CHECK ((event_type = 'RESERVE_ACTIVATED' AND grant_id IS NULL AND account_username IS NULL) OR (event_type IN ('GRANT_CREATED','GRANT_RELEASED') AND grant_id IS NOT NULL AND account_username IS NOT NULL)))"),
    db.prepare("CREATE TABLE IF NOT EXISTS bravus_account_control_events (id TEXT PRIMARY KEY NOT NULL, account_username TEXT NOT NULL, event_type TEXT NOT NULL CHECK (event_type IN ('PROFILE_UPDATED','ACCOUNT_BLOCKED','ACCOUNT_UNBLOCKED','BALANCE_HOLD_PLACED','BALANCE_HOLD_RELEASED','PASSWORD_RESET_BY_ADMIN')), hold_id TEXT, amount_centavos TEXT NOT NULL CHECK (length(amount_centavos) BETWEEN 1 AND 40 AND amount_centavos NOT GLOB '*[^0-9]*' AND (amount_centavos = '0' OR substr(amount_centavos, 1, 1) <> '0')), actor TEXT NOT NULL, reason TEXT NOT NULL, metadata_hash TEXT NOT NULL, idempotency_hash TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL, CHECK ((event_type IN ('BALANCE_HOLD_PLACED','BALANCE_HOLD_RELEASED') AND hold_id IS NOT NULL AND amount_centavos <> '0') OR (event_type NOT IN ('BALANCE_HOLD_PLACED','BALANCE_HOLD_RELEASED') AND hold_id IS NULL)))"),
    db.prepare("CREATE INDEX IF NOT EXISTS bravus_kyc_audit_username_created_idx ON bravus_kyc_audit (username, created_at)"),
    db.prepare("CREATE INDEX IF NOT EXISTS bravus_account_control_events_username_created_idx ON bravus_account_control_events (account_username, created_at)"),
    db.prepare("CREATE TRIGGER IF NOT EXISTS bravus_ledger_entries_no_update BEFORE UPDATE ON bravus_ledger_entries BEGIN SELECT RAISE(ABORT, 'Ledger entries are immutable; create a compensating entry'); END"),
    db.prepare("CREATE TRIGGER IF NOT EXISTS bravus_ledger_entries_no_delete BEFORE DELETE ON bravus_ledger_entries BEGIN SELECT RAISE(ABORT, 'Ledger entries are immutable; create a compensating entry'); END"),
    db.prepare("CREATE TRIGGER IF NOT EXISTS bravus_state_audit_no_update BEFORE UPDATE ON bravus_state_audit BEGIN SELECT RAISE(ABORT, 'State audit entries are immutable'); END"),
    db.prepare("CREATE TRIGGER IF NOT EXISTS bravus_state_audit_no_delete BEFORE DELETE ON bravus_state_audit BEGIN SELECT RAISE(ABORT, 'State audit entries are immutable'); END"),
    db.prepare("CREATE TRIGGER IF NOT EXISTS bravus_biometric_evidence_no_update BEFORE UPDATE ON bravus_biometric_evidence BEGIN SELECT RAISE(ABORT, 'Biometric evidence is immutable'); END"),
    db.prepare("CREATE TRIGGER IF NOT EXISTS bravus_biometric_evidence_no_delete BEFORE DELETE ON bravus_biometric_evidence BEGIN SELECT RAISE(ABORT, 'Biometric evidence is immutable'); END"),
    db.prepare("CREATE TRIGGER IF NOT EXISTS bravus_kyc_audit_no_update BEFORE UPDATE ON bravus_kyc_audit BEGIN SELECT RAISE(ABORT, 'KYC audit entries are immutable'); END"),
    db.prepare("CREATE TRIGGER IF NOT EXISTS bravus_kyc_audit_no_delete BEFORE DELETE ON bravus_kyc_audit BEGIN SELECT RAISE(ABORT, 'KYC audit entries are immutable'); END"),
    db.prepare("CREATE TRIGGER IF NOT EXISTS bravus_institutional_reserve_no_update BEFORE UPDATE ON bravus_institutional_reserve BEGIN SELECT RAISE(ABORT, 'Institutional reserve is immutable; use an audited migration'); END"),
    db.prepare("CREATE TRIGGER IF NOT EXISTS bravus_institutional_reserve_no_delete BEFORE DELETE ON bravus_institutional_reserve BEGIN SELECT RAISE(ABORT, 'Institutional reserve is immutable'); END"),
    db.prepare("CREATE TRIGGER IF NOT EXISTS bravus_institutional_reserve_audit_no_update BEFORE UPDATE ON bravus_institutional_reserve_audit BEGIN SELECT RAISE(ABORT, 'Institutional reserve audit is immutable'); END"),
    db.prepare("CREATE TRIGGER IF NOT EXISTS bravus_institutional_reserve_audit_no_delete BEFORE DELETE ON bravus_institutional_reserve_audit BEGIN SELECT RAISE(ABORT, 'Institutional reserve audit is immutable'); END"),
    db.prepare("CREATE TRIGGER IF NOT EXISTS bravus_account_provisioning_audit_no_update BEFORE UPDATE ON bravus_account_provisioning_audit BEGIN SELECT RAISE(ABORT, 'Account provisioning audit is immutable'); END"),
    db.prepare("CREATE TRIGGER IF NOT EXISTS bravus_account_provisioning_audit_no_delete BEFORE DELETE ON bravus_account_provisioning_audit BEGIN SELECT RAISE(ABORT, 'Account provisioning audit is immutable'); END"),
    db.prepare("CREATE TRIGGER IF NOT EXISTS bravus_master_credit_reserve_no_update BEFORE UPDATE ON bravus_master_credit_reserve BEGIN SELECT RAISE(ABORT, 'Master credit reserve is immutable; use audited grant events'); END"),
    db.prepare("CREATE TRIGGER IF NOT EXISTS bravus_master_credit_reserve_no_delete BEFORE DELETE ON bravus_master_credit_reserve BEGIN SELECT RAISE(ABORT, 'Master credit reserve is immutable'); END"),
    db.prepare("CREATE TRIGGER IF NOT EXISTS bravus_master_credit_events_no_update BEFORE UPDATE ON bravus_master_credit_events BEGIN SELECT RAISE(ABORT, 'Master credit events are immutable'); END"),
    db.prepare("CREATE TRIGGER IF NOT EXISTS bravus_master_credit_events_no_delete BEFORE DELETE ON bravus_master_credit_events BEGIN SELECT RAISE(ABORT, 'Master credit events are immutable'); END"),
    db.prepare("CREATE TRIGGER IF NOT EXISTS bravus_account_control_events_no_update BEFORE UPDATE ON bravus_account_control_events BEGIN SELECT RAISE(ABORT, 'Account control events are immutable'); END"),
    db.prepare("CREATE TRIGGER IF NOT EXISTS bravus_account_control_events_no_delete BEFORE DELETE ON bravus_account_control_events BEGIN SELECT RAISE(ABORT, 'Account control events are immutable'); END"),
  ]);
  await db.batch([
    db.prepare("INSERT OR IGNORE INTO bravus_institutional_reserve (code, currency, amount_centavos, classification, status, customer_funds, transferable, source_reference, policy_version, payload_hash, declared_at) VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?)")
      .bind(
        institutionalReserveSeed.code,
        institutionalReserveSeed.currency,
        institutionalReserveSeed.amountCentavos,
        institutionalReserveSeed.classification,
        institutionalReserveSeed.status,
        institutionalReserveSeed.sourceReference,
        institutionalReserveSeed.policyVersion,
        institutionalReserveSeed.payloadHash,
        institutionalReserveSeed.declaredAt,
      ),
    db.prepare("INSERT OR IGNORE INTO bravus_institutional_reserve_audit (id, reserve_code, event_type, amount_centavos, status, actor, reason, payload_hash, created_at) VALUES (?, ?, 'RESERVE_DECLARED', ?, ?, 'OWNER_CONFIGURATION', ?, ?, ?)")
      .bind(
        "reserve-declaration-v1",
        institutionalReserveSeed.code,
        institutionalReserveSeed.amountCentavos,
        institutionalReserveSeed.status,
        "Reserva institucional declarada; nao representa saldo de cliente nem prova de lastro externo.",
        institutionalReserveSeed.payloadHash,
        institutionalReserveSeed.declaredAt,
      ),
    db.prepare("INSERT OR IGNORE INTO bravus_master_credit_reserve (code, currency, total_amount_centavos, classification, status, transfer_scope, admin_only, policy_version, payload_hash, activated_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)")
      .bind(
        masterCreditReserveSeed.code,
        masterCreditReserveSeed.currency,
        masterCreditReserveSeed.totalAmountCentavos,
        masterCreditReserveSeed.classification,
        masterCreditReserveSeed.status,
        masterCreditReserveSeed.transferScope,
        masterCreditReserveSeed.policyVersion,
        masterCreditReserveSeed.payloadHash,
        masterCreditReserveSeed.activatedAt,
      ),
    db.prepare("INSERT OR IGNORE INTO bravus_master_credit_events (id, reserve_code, grant_id, event_type, account_username, amount_centavos, actor, assessment_reason, eligibility_rule, idempotency_hash, created_at) VALUES ('master-credit-reserve-activation-v1', ?, NULL, 'RESERVE_ACTIVATED', NULL, ?, 'OWNER_CONFIGURATION', ?, ?, ?, ?)")
      .bind(
        masterCreditReserveSeed.code,
        masterCreditReserveSeed.totalAmountCentavos,
        "Reserva mestre de credito escritural ativada para concessoes administrativas avaliadas.",
        "KYC aprovado e avaliacao administrativa registrada.",
        masterCreditReserveSeed.payloadHash,
        masterCreditReserveSeed.activatedAt,
      ),
  ]);
  let evidenceSchema = await db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'bravus_biometric_evidence'").first();
  let evidenceSchemaSql = String(evidenceSchema?.sql || "");
  if (!evidenceSchemaSql.includes("KYC_DOCUMENT_FRONT") || !evidenceSchemaSql.includes("KYC_DOCUMENT_BACK")) {
    await db.batch([
      db.prepare("DROP TRIGGER IF EXISTS bravus_biometric_evidence_no_update"),
      db.prepare("DROP TRIGGER IF EXISTS bravus_biometric_evidence_no_delete"),
      db.prepare("DROP TABLE IF EXISTS bravus_biometric_evidence_v2"),
      db.prepare("CREATE TABLE bravus_biometric_evidence_v2 (id TEXT PRIMARY KEY NOT NULL, kind TEXT NOT NULL CHECK (kind IN ('ENROLLED_FACE','PASSWORD_RESET_FACE','KYC_DOCUMENT_FRONT','KYC_DOCUMENT_BACK')), owner_username TEXT NOT NULL, mime TEXT NOT NULL, ciphertext TEXT NOT NULL, iv TEXT NOT NULL, sha256 TEXT NOT NULL, created_at TEXT NOT NULL)"),
      db.prepare("INSERT INTO bravus_biometric_evidence_v2 (id, kind, owner_username, mime, ciphertext, iv, sha256, created_at) SELECT id, kind, owner_username, mime, ciphertext, iv, sha256, created_at FROM bravus_biometric_evidence"),
      db.prepare("DROP TABLE bravus_biometric_evidence"),
      db.prepare("ALTER TABLE bravus_biometric_evidence_v2 RENAME TO bravus_biometric_evidence"),
      db.prepare("CREATE TRIGGER bravus_biometric_evidence_no_update BEFORE UPDATE ON bravus_biometric_evidence BEGIN SELECT RAISE(ABORT, 'Biometric evidence is immutable'); END"),
      db.prepare("CREATE TRIGGER bravus_biometric_evidence_no_delete BEFORE DELETE ON bravus_biometric_evidence BEGIN SELECT RAISE(ABORT, 'Biometric evidence is immutable'); END"),
    ]);
    evidenceSchema = await db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'bravus_biometric_evidence'").first();
    evidenceSchemaSql = String(evidenceSchema?.sql || "");
  }
  if (!evidenceSchemaSql.includes("KYC_DOCUMENT_FRONT") || !evidenceSchemaSql.includes("KYC_DOCUMENT_BACK")) {
    throw new Error("D1_KYC_EVIDENCE_SCHEMA_NOT_READY");
  }
  let masterEventSchema = await db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'bravus_master_credit_events'").first();
  if (!masterCreditEventSchemaReady(masterEventSchema?.sql)) {
    await db.batch([
      db.prepare("DROP TRIGGER IF EXISTS bravus_master_credit_events_no_update"),
      db.prepare("DROP TRIGGER IF EXISTS bravus_master_credit_events_no_delete"),
      db.prepare("DROP TABLE IF EXISTS bravus_master_credit_events_v2"),
      db.prepare("CREATE TABLE bravus_master_credit_events_v2 (id TEXT PRIMARY KEY NOT NULL, reserve_code TEXT NOT NULL, grant_id TEXT, event_type TEXT NOT NULL CHECK (event_type IN ('RESERVE_ACTIVATED','GRANT_CREATED','GRANT_RELEASED')), account_username TEXT, amount_centavos TEXT NOT NULL CHECK (length(amount_centavos) BETWEEN 1 AND 40 AND amount_centavos NOT GLOB '*[^0-9]*' AND amount_centavos <> '0' AND substr(amount_centavos, 1, 1) <> '0'), actor TEXT NOT NULL, assessment_reason TEXT NOT NULL, eligibility_rule TEXT, idempotency_hash TEXT NOT NULL, created_at TEXT NOT NULL, FOREIGN KEY (reserve_code) REFERENCES bravus_master_credit_reserve(code), UNIQUE (grant_id, event_type), UNIQUE (idempotency_hash), CHECK ((event_type = 'RESERVE_ACTIVATED' AND grant_id IS NULL AND account_username IS NULL) OR (event_type IN ('GRANT_CREATED','GRANT_RELEASED') AND grant_id IS NOT NULL AND account_username IS NOT NULL)))"),
      db.prepare("INSERT INTO bravus_master_credit_events_v2 (id, reserve_code, grant_id, event_type, account_username, amount_centavos, actor, assessment_reason, eligibility_rule, idempotency_hash, created_at) SELECT id, reserve_code, grant_id, event_type, account_username, amount_centavos, actor, assessment_reason, eligibility_rule, idempotency_hash, created_at FROM bravus_master_credit_events"),
      db.prepare("DROP TABLE bravus_master_credit_events"),
      db.prepare("ALTER TABLE bravus_master_credit_events_v2 RENAME TO bravus_master_credit_events"),
      db.prepare("CREATE TRIGGER bravus_master_credit_events_no_update BEFORE UPDATE ON bravus_master_credit_events BEGIN SELECT RAISE(ABORT, 'Master credit events are immutable'); END"),
      db.prepare("CREATE TRIGGER bravus_master_credit_events_no_delete BEFORE DELETE ON bravus_master_credit_events BEGIN SELECT RAISE(ABORT, 'Master credit events are immutable'); END"),
    ]);
    masterEventSchema = await db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'bravus_master_credit_events'").first();
  }
  if (!masterCreditEventSchemaReady(masterEventSchema?.sql)) {
    throw new Error("D1_MASTER_CREDIT_EVENT_SCHEMA_NOT_READY");
  }
  d1SchemaReady = true;
}

function centavosToReaisString(amountCentavos) {
  const value = BigInt(String(amountCentavos));
  const whole = value / 100n;
  const fraction = String(value % 100n).padStart(2, "0");
  return whole.toString() + "." + fraction;
}

function exactCentavos(value, fieldName) {
  if (typeof value === "number" && !Number.isSafeInteger(value)) {
    throw new Error("UNSAFE_MONEY_NUMBER_" + fieldName);
  }
  const raw = String(value ?? 0).trim();
  if (!/^-?\\d+$/.test(raw)) throw new Error("INVALID_MONEY_INTEGER_" + fieldName);
  return BigInt(raw);
}

async function loadInstitutionalReserve(db) {
  const row = await db.prepare("SELECT code, currency, amount_centavos, classification, status, customer_funds, transferable, source_reference, policy_version, payload_hash, declared_at FROM bravus_institutional_reserve WHERE code = ?")
    .bind(institutionalReserveSeed.code)
    .first();
  if (!row) throw new Error("D1_INSTITUTIONAL_RESERVE_NOT_FOUND");
  const canonical = [
    row.code, row.currency, row.amount_centavos, row.classification, row.status,
    row.source_reference, row.policy_version,
  ].join("|");
  const payloadHash = await sha256Text(canonical);
  if (payloadHash !== row.payload_hash) throw new Error("D1_INSTITUTIONAL_RESERVE_HASH_MISMATCH");
  if (Number(row.customer_funds) !== 0 || Number(row.transferable) !== 0) {
    throw new Error("D1_INSTITUTIONAL_RESERVE_CLASSIFICATION_INVALID");
  }
  return {
    code: row.code,
    name: institutionalReserveSeed.name,
    amountCentavos: String(row.amount_centavos),
    amountReais: centavosToReaisString(row.amount_centavos),
    currency: row.currency,
    classification: row.classification,
    status: row.status,
    customerFunds: false,
    transferable: false,
    sourceReference: row.source_reference,
    policyVersion: Number(row.policy_version),
    payloadHash: row.payload_hash,
    declaredAt: row.declared_at,
  };
}

async function loadMasterCreditReserve(db) {
  const row = await db.prepare("SELECT code, currency, total_amount_centavos, classification, status, transfer_scope, admin_only, policy_version, payload_hash, activated_at FROM bravus_master_credit_reserve WHERE code = ?")
    .bind(masterCreditReserveSeed.code)
    .first();
  if (!row) throw new Error("D1_MASTER_CREDIT_RESERVE_NOT_FOUND");
  const canonical = [
    row.code, row.currency, row.total_amount_centavos, row.classification, row.status,
    row.transfer_scope, row.policy_version,
  ].join("|");
  const payloadHash = await sha256Text(canonical);
  if (payloadHash !== row.payload_hash) throw new Error("D1_MASTER_CREDIT_RESERVE_HASH_MISMATCH");
  if (Number(row.admin_only) !== 1) throw new Error("D1_MASTER_CREDIT_RESERVE_SCOPE_INVALID");
  return {
    code: row.code,
    name: masterCreditReserveSeed.name,
    currency: row.currency,
    totalAmountCentavos: String(row.total_amount_centavos),
    totalAmountReais: centavosToReaisString(row.total_amount_centavos),
    classification: row.classification,
    status: row.status,
    transferScope: row.transfer_scope,
    adminOnly: true,
    transferable: true,
    transferMode: "ADMIN_CREDIT_GRANT_ONLY",
    policyVersion: Number(row.policy_version),
    payloadHash: row.payload_hash,
    activatedAt: row.activated_at,
  };
}

function masterCreditAllocation(reserve) {
  const total = exactCentavos(reserve.totalAmountCentavos, "master_credit_total");
  let committed = 0n;
  let released = 0n;
  for (const grant of state.masterCreditGrants) {
    validateMasterCreditGrantPolicy(grant);
    const amount = exactCentavos(grant.amountCentavos, "master_credit_grant");
    committed += amount;
    if (grant.status === "LIBERADO") released += amount;
  }
  const available = total - committed;
  if (available < 0n || released > committed) throw new Error("MASTER_CREDIT_RESERVE_INCONSISTENT");
  return {
    totalCentavos: total.toString(),
    availableCentavos: available.toString(),
    committedCentavos: committed.toString(),
    releasedCentavos: released.toString(),
    pendingCentavos: (committed - released).toString(),
    balanced: total === available + committed,
  };
}

function validateMasterCreditGrantPolicy(grant) {
  if (grant?.productType !== "NON_REPAYABLE_BOOK_CREDIT"
    || grant.repayable !== false
    || grant.interestBearing !== false
    || Number(grant.policyVersion) !== 1) {
    throw new Error("MASTER_CREDIT_GRANT_POLICY_INVALID");
  }
}

function masterCreditEventSignature(event) {
  return [
    event.grantId ?? event.grant_id ?? "",
    event.eventType ?? event.event_type ?? "",
    event.accountUsername ?? event.account_username ?? "",
    String(event.amountCentavos ?? event.amount_centavos ?? ""),
  ].join("|");
}

async function validateMasterCreditAudit(db, pendingEvents = []) {
  const result = await db.prepare("SELECT grant_id, event_type, account_username, amount_centavos FROM bravus_master_credit_events").all();
  const persistedEvents = Array.isArray(result?.results) ? result.results : [];
  const expectedEvents = [{
    grantId: null,
    eventType: "RESERVE_ACTIVATED",
    accountUsername: null,
    amountCentavos: masterCreditReserveSeed.totalAmountCentavos,
  }];
  for (const grant of state.masterCreditGrants) {
    validateMasterCreditGrantPolicy(grant);
    expectedEvents.push({
      grantId: grant.id,
      eventType: "GRANT_CREATED",
      accountUsername: grant.username,
      amountCentavos: grant.amountCentavos,
    });
    if (grant.status === "LIBERADO") {
      expectedEvents.push({
        grantId: grant.id,
        eventType: "GRANT_RELEASED",
        accountUsername: grant.username,
        amountCentavos: grant.amountCentavos,
      });
    }
  }
  const actualSignatures = [...persistedEvents, ...pendingEvents].map(masterCreditEventSignature).sort();
  const expectedSignatures = expectedEvents.map(masterCreditEventSignature).sort();
  return {
    actual: persistedEvents.length,
    expected: expectedEvents.length,
    pendingEventCount: pendingEvents.length,
    valid: actualSignatures.length === expectedSignatures.length
      && actualSignatures.every((signature, index) => signature === expectedSignatures[index]),
  };
}

function masterCreditGrantView(grant) {
  validateMasterCreditGrantPolicy(grant);
  return {
    id: grant.id,
    userId: grant.userId,
    username: grant.username,
    reserveCode: grant.reserveCode,
    amountCentavos: grant.amountCentavos,
    valorConcedido: grant.amountCentavos,
    valorDisponivel: grant.status === "PENDENTE" ? grant.amountCentavos : "0",
    status: grant.status,
    assessmentReason: grant.assessmentReason,
    eligibilityRule: grant.eligibilityRule,
    notes: grant.notes,
    productType: grant.productType,
    repayable: grant.repayable,
    interestBearing: grant.interestBearing,
    policyVersion: grant.policyVersion,
    assessedBy: grant.assessedBy,
    assessedAt: grant.assessedAt,
    releasedAt: grant.releasedAt || null,
    transactionId: grant.transactionId || null,
  };
}

async function releaseMasterCreditGrant(grant, beneficiary, actor, idempotencyKey) {
  const releaseRequestHash = await sha256Text(idempotencyKey + "|" + grant.id + "|release");
  if (grant.status === "LIBERADO") {
    if (grant.releaseRequestHash === releaseRequestHash) return { grant, idempotentReplay: true };
    throw new Error("MASTER_CREDIT_ALREADY_RELEASED");
  }
  const amount = exactCentavos(grant.amountCentavos, "master_credit_release");
  const nextBalance = exactCentavos(beneficiary.balance, "beneficiary_balance") + amount;
  if (nextBalance > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("CUSTOMER_BALANCE_PRECISION_LIMIT");
  const createdAt = now();
  const transaction = {
    id: nextNumericId(state.transactions),
    username: beneficiary.username,
    type: "DEPOSIT",
    amount: Number(amount),
    description: "Credito escritural concedido pela Reserva Mestre Bravus",
    destinationAccount: beneficiary.accountNumber,
    status: "COMPLETED",
    createdAt,
    masterCreditGrantId: grant.id,
    reserveCode: masterCreditReserveSeed.code,
  };
  beneficiary.balance = Number(nextBalance);
  state.transactions.unshift(transaction);
  ledgerPairForTransaction(transaction);
  grant.status = "LIBERADO";
  grant.releasedAt = createdAt;
  grant.releasedBy = actor;
  grant.transactionId = transaction.id;
  grant.releaseRequestHash = releaseRequestHash;
  pendingMasterCreditEventWrites.push({
    id: crypto.randomUUID(),
    grantId: grant.id,
    eventType: "GRANT_RELEASED",
    accountUsername: beneficiary.username,
    amountCentavos: grant.amountCentavos,
    actor,
    assessmentReason: grant.assessmentReason,
    eligibilityRule: grant.eligibilityRule,
    idempotencyHash: releaseRequestHash,
    createdAt,
  });
  state.ledgerAudit.unshift({
    status: "MASTER_CREDIT_GRANT_RELEASED",
    grantId: grant.id,
    transactionId: transaction.id,
    actor,
    createdAt,
  });
  return { grant, idempotentReplay: false };
}

function ledgerMirrorStatement(db, entry, revision, payloadHash) {
  return db.prepare("INSERT OR IGNORE INTO bravus_ledger_entries (transfer_id, entry_type, order_id, account_username, account_number, signed_amount_centavos, currency, reason, created_at) SELECT ?, ?, ?, ?, ?, ?, ?, ?, ? FROM bravus_state WHERE id = 1 AND revision = ? AND payload_hash = ?")
    .bind(
      String(entry.transferId || ""),
      String(entry.entryType || ""),
      entry.orderId == null ? null : Number(entry.orderId),
      entry.accountUsername || null,
      String(entry.accountNumber || "BRAVUS-LEDGER"),
      Number(entry.signedAmountCentavos || 0),
      String(entry.currency || "BRL"),
      String(entry.reason || "D1_STATE_MIRROR"),
      String(entry.createdAt || now()),
      revision,
      payloadHash,
    );
}

function biometricWriteStatement(db, evidence, revision, payloadHash) {
  return db.prepare("INSERT OR IGNORE INTO bravus_biometric_evidence (id, kind, owner_username, mime, ciphertext, iv, sha256, created_at) SELECT ?, ?, ?, ?, ?, ?, ?, ? FROM bravus_state WHERE id = 1 AND revision = ? AND payload_hash = ?")
    .bind(
      evidence.id,
      evidence.kind,
      evidence.username,
      evidence.mime,
      evidence.ciphertext,
      evidence.iv,
      evidence.sha256,
      evidence.createdAt,
      revision,
      payloadHash,
    );
}

function kycAuditWriteStatement(db, entry, revision, payloadHash) {
  return db.prepare("INSERT OR IGNORE INTO bravus_kyc_audit (id, username, actor, from_status, to_status, reason, created_at) SELECT ?, ?, ?, ?, ?, ?, ? FROM bravus_state WHERE id = 1 AND revision = ? AND payload_hash = ?")
    .bind(
      entry.id,
      entry.username,
      entry.actor,
      entry.fromStatus,
      entry.toStatus,
      entry.reason,
      entry.createdAt,
      revision,
      payloadHash,
    );
}

function accountProvisionAuditWriteStatement(db, entry, revision, payloadHash) {
  return db.prepare("INSERT OR IGNORE INTO bravus_account_provisioning_audit (id, account_username, subject_hash, actor, event_type, created_at) SELECT ?, ?, ?, ?, ?, ? FROM bravus_state WHERE id = 1 AND revision = ? AND payload_hash = ?")
    .bind(
      entry.id,
      entry.accountUsername,
      entry.subjectHash,
      entry.actor,
      entry.eventType,
      entry.createdAt,
      revision,
      payloadHash,
    );
}

function masterCreditEventWriteStatement(db, entry, revision, payloadHash) {
  return db.prepare("INSERT INTO bravus_master_credit_events (id, reserve_code, grant_id, event_type, account_username, amount_centavos, actor, assessment_reason, eligibility_rule, idempotency_hash, created_at) SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? FROM bravus_state WHERE id = 1 AND revision = ? AND payload_hash = ?")
    .bind(
      entry.id,
      masterCreditReserveSeed.code,
      entry.grantId,
      entry.eventType,
      entry.accountUsername,
      entry.amountCentavos,
      entry.actor,
      entry.assessmentReason,
      entry.eligibilityRule || null,
      entry.idempotencyHash,
      entry.createdAt,
      revision,
      payloadHash,
    );
}

function accountControlEventWriteStatement(db, entry, revision, payloadHash) {
  return db.prepare("INSERT INTO bravus_account_control_events (id, account_username, event_type, hold_id, amount_centavos, actor, reason, metadata_hash, idempotency_hash, created_at) SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ? FROM bravus_state WHERE id = 1 AND revision = ? AND payload_hash = ?")
    .bind(
      entry.id,
      entry.username,
      entry.eventType,
      entry.holdId || null,
      String(entry.amountCentavos || "0"),
      entry.actor,
      entry.reason,
      entry.metadataHash,
      entry.idempotencyHash,
      entry.createdAt,
      revision,
      payloadHash,
    );
}

function accountControlEventSignature(entry) {
  return [
    entry.id || "",
    entry.username ?? entry.account_username ?? "",
    entry.eventType ?? entry.event_type ?? "",
    entry.holdId ?? entry.hold_id ?? "",
    String(entry.amountCentavos ?? entry.amount_centavos ?? "0"),
    entry.metadataHash ?? entry.metadata_hash ?? "",
    entry.idempotencyHash ?? entry.idempotency_hash ?? "",
  ].join("|");
}

function accountControlLifecycleValid() {
  const holdsById = new Map(state.balanceHolds.map((hold) => [hold.id, hold]));
  for (const hold of state.balanceHolds) {
    const holdEvents = state.accountControlAudit.filter((entry) => entry.holdId === hold.id);
    const placed = holdEvents.filter((entry) => entry.eventType === "BALANCE_HOLD_PLACED");
    const released = holdEvents.filter((entry) => entry.eventType === "BALANCE_HOLD_RELEASED");
    if (placed.length !== 1 || placed[0].username !== hold.username
        || String(placed[0].amountCentavos) !== String(hold.amountCentavos)) return false;
    if (hold.status === "ACTIVE" && released.length !== 0) return false;
    if (hold.status === "RELEASED" && (released.length !== 1
        || released[0].username !== hold.username
        || String(released[0].amountCentavos) !== String(hold.amountCentavos))) return false;
  }
  for (const entry of state.accountControlAudit) {
    if (["BALANCE_HOLD_PLACED", "BALANCE_HOLD_RELEASED"].includes(entry.eventType)
        && !holdsById.has(entry.holdId)) return false;
  }
  for (const account of Object.values(state.users)) {
    const lastStatusEvent = state.accountControlAudit.find((entry) =>
      entry.username === account.username && ["ACCOUNT_BLOCKED", "ACCOUNT_UNBLOCKED"].includes(entry.eventType)
    );
    if (lastStatusEvent) {
      const expectedActive = lastStatusEvent.eventType === "ACCOUNT_UNBLOCKED";
      if ((account.active !== false) !== expectedActive) return false;
    }
  }
  return true;
}

async function validateAccountControlAudit(db, pendingEvents = []) {
  const result = await db.prepare("SELECT id, account_username, event_type, hold_id, amount_centavos, metadata_hash, idempotency_hash FROM bravus_account_control_events").all();
  const persistedEvents = Array.isArray(result?.results) ? result.results : [];
  const actual = [...persistedEvents, ...pendingEvents].map(accountControlEventSignature).sort();
  const expected = state.accountControlAudit.map(accountControlEventSignature).sort();
  return {
    actual: persistedEvents.length,
    expected: expected.length,
    pendingEventCount: pendingEvents.length,
    valid: accountControlLifecycleValid()
      && actual.length === expected.length
      && actual.every((signature, index) => signature === expected[index]),
  };
}

async function loadOrCreateD1State(db) {
  await ensureD1Schema(db);
  let row = await db.prepare("SELECT revision, payload, payload_hash, updated_at FROM bravus_state WHERE id = 1").first();
  if (row) return row;
  const testBootstrap = liveSeed.verified === "TEST_ONLY" && currentEnv?.BRAVUS_ALLOW_TEST_BOOTSTRAP === "true";
  if (liveSeed.verified !== true && !testBootstrap) throw new Error("D1_INITIAL_IMPORT_REQUIRES_VERIFIED_SNAPSHOT");

  state = createInitialState();
  enforceFinancialConsistency("D1_INITIAL_IMPORT");
  const payload = JSON.stringify(state);
  const payloadHash = await sha256Text(payload);
  const createdAt = now();
  const statements = [
    db.prepare("INSERT OR IGNORE INTO bravus_state (id, revision, payload, payload_hash, source_captured_at, created_at, updated_at) VALUES (1, 1, ?, ?, ?, ?, ?)")
      .bind(payload, payloadHash, liveSeed.capturedAt || null, createdAt, createdAt),
    db.prepare("INSERT OR IGNORE INTO bravus_state_audit (revision, request_id, method, path, actor, previous_hash, payload_hash, created_at) VALUES (1, ?, 'IMPORT', '/d1/bootstrap', 'SYSTEM', ?, ?, ?)")
      .bind("d1-bootstrap-" + buildTarget, "GENESIS", payloadHash, createdAt),
    ...state.ledgerEntries.map((entry) => ledgerMirrorStatement(db, entry, 1, payloadHash)),
  ];
  await db.batch(statements);
  row = await db.prepare("SELECT revision, payload, payload_hash, updated_at FROM bravus_state WHERE id = 1").first();
  if (!row) throw new Error("D1_STATE_INITIALIZATION_FAILED");
  return row;
}

async function persistD1State(db, previous, request, actor) {
  enforceFinancialConsistency("D1_PRE_COMMIT");
  const validation = validateSitesLedger();
  if (!validation.valid) {
    throw new Error("D1_FINANCIAL_VALIDATION_FAILED");
  }
  const masterReserve = await loadMasterCreditReserve(db);
  const masterAllocation = masterCreditAllocation(masterReserve);
  if (!masterAllocation.balanced) throw new Error("D1_MASTER_CREDIT_ALLOCATION_FAILED");
  const masterAudit = await validateMasterCreditAudit(db, pendingMasterCreditEventWrites);
  if (!masterAudit.valid) throw new Error("D1_MASTER_CREDIT_AUDIT_MISMATCH");
  const accountControlAudit = await validateAccountControlAudit(db, pendingAccountControlEventWrites);
  if (!accountControlAudit.valid) throw new Error("D1_ACCOUNT_CONTROL_AUDIT_MISMATCH");

  const payload = JSON.stringify(state);
  const payloadHash = await sha256Text(payload);
  if (payloadHash === previous.payload_hash) {
    persistenceMeta = {
      backend: "D1",
      revision: Number(previous.revision),
      payloadHash,
      updatedAt: previous.updated_at || null,
    };
    return true;
  }

  const nextRevision = Number(previous.revision) + 1;
  const updatedAt = now();
  const requestId = request.headers.get("idempotency-key") || request.headers.get("x-request-id") || crypto.randomUUID();
  const path = new URL(request.url).pathname;
  const statements = [
    db.prepare("UPDATE bravus_state SET revision = ?, payload = ?, payload_hash = ?, updated_at = ? WHERE id = 1 AND revision = ? AND payload_hash = ?")
      .bind(nextRevision, payload, payloadHash, updatedAt, Number(previous.revision), previous.payload_hash),
    db.prepare("INSERT OR IGNORE INTO bravus_state_audit (revision, request_id, method, path, actor, previous_hash, payload_hash, created_at) SELECT ?, ?, ?, ?, ?, ?, ?, ? FROM bravus_state WHERE id = 1 AND revision = ? AND payload_hash = ?")
      .bind(nextRevision, requestId, request.method, path, actor || "PUBLIC", previous.payload_hash, payloadHash, updatedAt, nextRevision, payloadHash),
    ...state.ledgerEntries.map((entry) => ledgerMirrorStatement(db, entry, nextRevision, payloadHash)),
    ...pendingBiometricWrites.map((evidence) => biometricWriteStatement(db, evidence, nextRevision, payloadHash)),
    ...pendingKycAuditWrites.map((entry) => kycAuditWriteStatement(db, entry, nextRevision, payloadHash)),
    ...pendingAccountProvisionAuditWrites.map((entry) => accountProvisionAuditWriteStatement(db, entry, nextRevision, payloadHash)),
    ...pendingMasterCreditEventWrites.map((entry) => masterCreditEventWriteStatement(db, entry, nextRevision, payloadHash)),
    ...pendingAccountControlEventWrites.map((entry) => accountControlEventWriteStatement(db, entry, nextRevision, payloadHash)),
  ];
  const results = await db.batch(statements);
  const changed = Number(results?.[0]?.meta?.changes || 0);
  if (changed !== 1) return false;
  persistenceMeta = { backend: "D1", revision: nextRevision, payloadHash, updatedAt };
  return true;
}

function cloneRequestFactory(request, bodyBytes) {
  return () => new Request(request.url, {
    method: request.method,
    headers: new Headers(request.headers),
    body: bodyBytes == null ? undefined : bodyBytes.slice(0),
  });
}

async function handlePersistedApi(request, env) {
  if (!env?.DB) {
    return json({ message: "Banco persistente D1 indisponivel.", code: "D1_UNAVAILABLE" }, { status: 503 });
  }
  const bodyBytes = ["GET", "HEAD", "OPTIONS"].includes(request.method)
    ? null
    : await request.clone().arrayBuffer();
  const makeRequest = cloneRequestFactory(request, bodyBytes);

  return enqueueApi(async () => {
    currentEnv = env;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const previous = await loadOrCreateD1State(env.DB);
      state = normalizeState(JSON.parse(String(previous.payload)));
      pendingBiometricWrites = [];
      pendingKycAuditWrites = [];
      pendingAccountProvisionAuditWrites = [];
      pendingMasterCreditEventWrites = [];
      pendingAccountControlEventWrites = [];
      persistenceMeta = {
        backend: "D1",
        revision: Number(previous.revision),
        payloadHash: previous.payload_hash,
        updatedAt: previous.updated_at || null,
      };
      const accountControlAudit = await validateAccountControlAudit(env.DB);
      if (!accountControlAudit.valid) throw new Error("D1_ACCOUNT_CONTROL_AUDIT_MISMATCH");
      const attemptRequest = makeRequest();
      const actor = userFromToken(attemptRequest)?.username || "PUBLIC";
      const response = await handleApi(attemptRequest);
      if (await persistD1State(env.DB, previous, attemptRequest, actor)) return response;
    }
    return json({
      message: "A operacao concorreu com outra atualizacao. Tente novamente com a mesma chave.",
      code: "D1_SERIALIZATION_RETRY",
    }, { status: 409 });
  });
}

async function handleApi(request) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\\/api/, "");

  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  if (request.method === "POST" && path === "/auth/login") {
    const body = await request.json().catch(() => ({}));
    const loginIdentifierHash = await sha256Text(String(body.username || "").trim().toLowerCase());
    const cutoff = Date.now() - 15 * 60 * 1000;
    state.loginAttempts = state.loginAttempts.filter((attempt) => new Date(attempt.createdAt).getTime() >= cutoff).slice(0, 200);
    if (state.loginAttempts.filter((attempt) => attempt.identifierHash === loginIdentifierHash).length >= 5) {
      return json({ message: "Muitas tentativas. Aguarde antes de tentar novamente.", code: "RATE_LIMITED" }, { status: 429 });
    }
    const user = Object.values(state.users).find((item) => publicLoginMatches(item, body.username));
    const passwordMatches = user && (
      await verifyPassword(body.password, user.passwordCredential)
      || (user.numericPasswordCredential && await verifyPassword(body.password, user.numericPasswordCredential))
    );
    if (!user || !passwordMatches) {
      state.loginAttempts.unshift({ identifierHash: loginIdentifierHash, createdAt: now() });
      return json("Invalid username or password", { status: 400 });
    }
    if (user.active === false) {
      return json({
        message: "Esta conta esta bloqueada administrativamente. Procure o suporte Bravus.",
        code: "ACCOUNT_BLOCKED",
      }, { status: 403, headers: { "cache-control": "no-store" } });
    }
    if (user.statusKyc === "REJEITADO_IDENTIDADE") {
      return json({
        message: "A abertura desta conta foi rejeitada. Procure o suporte Bravus.",
        code: "ACCOUNT_IDENTITY_REJECTED",
      }, { status: 403 });
    }
    state.loginAttempts = state.loginAttempts.filter((attempt) => attempt.identifierHash !== loginIdentifierHash);
    if (!user.passwordCredential.peppered) {
      user.passwordCredential = await createPasswordCredential(body.password);
    }
    if (["INITIAL_CHANGE_REQUIRED", "ADMIN_RESET_REQUIRED"].includes(user.credentialState)) {
      if (!user.initialCredentialExpiresAt || new Date(user.initialCredentialExpiresAt).getTime() <= Date.now()) {
        return json({
          message: "A senha inicial expirou. Solicite uma nova senha inicial ao administrador.",
          code: "INITIAL_PASSWORD_EXPIRED",
        }, { status: 403, headers: { "cache-control": "no-store" } });
      }
      revokeUserSessions(user.username);
      const challenge = await createInitialPasswordChallenge(user);
      return json({
        message: "Defina uma senha forte antes de acessar sua conta.",
        code: "INITIAL_PASSWORD_CHANGE_REQUIRED",
        initialPasswordChangeToken: challenge.token,
        expiresAt: challenge.expiresAt,
      }, { status: 403, headers: { "cache-control": "no-store" } });
    }
    const token = createSession(user, body.clientChannel);
    return json(authResponse(user, token));
  }

  if (request.method === "POST" && path === "/auth/initial-password/complete") {
    const body = await request.json().catch(() => ({}));
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).{8,128}$/.test(String(body.newPassword || ""))) {
      return badRequest("Use no minimo 8 caracteres, com letra maiuscula, minuscula e numero.", "WEAK_PASSWORD");
    }
    const challenge = await initialPasswordChallengeForToken(body.initialPasswordChangeToken);
    const account = challenge ? state.users[challenge.username] : null;
    if (!challenge || !account || !["INITIAL_CHANGE_REQUIRED", "ADMIN_RESET_REQUIRED"].includes(account.credentialState)) {
      return badRequest("A troca da senha inicial expirou. Entre novamente.", "INITIAL_PASSWORD_CHANGE_INVALID");
    }
    if (await verifyPassword(body.newPassword, account.passwordCredential)) {
      return badRequest("A senha definitiva deve ser diferente da senha inicial.", "INITIAL_PASSWORD_REUSE");
    }
    account.passwordCredential = await createPasswordCredential(body.newPassword);
    account.initialCredentialExpiresAt = null;
    challenge.status = "CONSUMED";
    challenge.consumedAt = now();
    transitionCredential(account, "ACTIVE", account.username, "Senha forte definida no primeiro acesso.");
    revokeUserSessions(account.username);
    const token = createSession(account, body.clientChannel);
    return json(authResponse(account, token), { headers: { "cache-control": "no-store" } });
  }

  if (request.method === "POST" && path === "/auth/password-reset/start") {
    const body = await request.json().catch(() => ({}));
    const identifier = String(body.identifier || "").trim();
    const idempotencyKey = String(body.idempotencyKey || "").trim();
    const clientSecret = String(body.clientSecret || "");
    if (!identifier || idempotencyKey.length < 20 || clientSecret.length < 32) {
      return badRequest("Dados de recuperacao invalidos.", "PASSWORD_RESET_INVALID_INPUT");
    }
    const identifierHash = await sha256Text(identifier.toLowerCase());
    const clientSecretHash = await sha256Text(clientSecret);
    const previous = state.passwordResetRequests.find((item) => item.idempotencyKey === idempotencyKey);
    if (previous) {
      if (previous.identifierHash !== identifierHash || previous.clientSecretHash !== clientSecretHash) {
        return badRequest("Chave de recuperacao ja utilizada.", "PASSWORD_RESET_IDEMPOTENCY_CONFLICT");
      }
      return json({
        requestId: previous.requestId,
        challenge: previous.challenge,
        instruction: previous.instruction,
        expiresAt: previous.expiresAt,
        status: passwordResetPublicStatus(previous.status),
      }, { status: 202 });
    }
    const recentCount = state.passwordResetRequests.filter((item) =>
      item.identifierHash === identifierHash
      && Date.now() - new Date(item.createdAt).getTime() < 15 * 60 * 1000
    ).length;
    if (recentCount >= 5) {
      return json({ message: "Muitas tentativas. Aguarde antes de tentar novamente.", code: "RATE_LIMITED" }, { status: 429 });
    }
    const found = Object.values(state.users).find((item) => publicLoginMatches(item, identifier)) || null;
    const createdAt = now();
    const resetRequest = {
      requestId: crypto.randomUUID(),
      username: found?.username || null,
      identifierHash,
      idempotencyKey,
      clientSecretHash,
      challenge: null,
      instruction: "Solicitacao enviada ao administrador. O admin deve emitir uma senha temporaria para o usuario entrar e trocar dentro da conta.",
      status: "ADMIN_PENDING",
      attempts: 0,
      createdAt,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };
    state.passwordResetRequests.unshift(resetRequest);
    state.passwordResetAudit.unshift({
      id: crypto.randomUUID(), requestId: resetRequest.requestId, eventType: "STARTED", actor: "PUBLIC",
      detail: "Solicitacao criada sem expor a existencia da conta.", createdAt,
    });
    return json({
      requestId: resetRequest.requestId,
      instruction: resetRequest.instruction,
      expiresAt: resetRequest.expiresAt,
      status: "ADMIN_PENDING",
    }, { status: 202 });
  }

  if (request.method === "POST" && path === "/auth/password-reset/face") {
    return json({
      status: "ADMIN_PENDING",
      message: "Recuperacao por biometria foi desativada. Aguarde o administrador emitir uma senha temporaria.",
      code: "PASSWORD_RESET_ADMIN_ONLY",
    }, { status: 202, headers: { "cache-control": "no-store" } });
  }

  if (request.method === "POST" && path === "/auth/password-reset/status") {
    const body = await request.json().catch(() => ({}));
    try {
      const resetRequest = await passwordResetRequestForClient(body);
      return json({ status: passwordResetPublicStatus(resetRequest.status), expiresAt: resetRequest.expiresAt });
    } catch {
      return json({ status: "UNAVAILABLE" });
    }
  }

  if (request.method === "POST" && path === "/auth/password-reset/complete") {
    return badRequest(
      "A troca publica de senha foi desativada. O administrador deve emitir uma senha temporaria; depois o usuario troca a senha dentro da conta.",
      "PASSWORD_RESET_ADMIN_ONLY",
    );
  }

  if (request.method === "POST" && path === "/auth/register/availability") {
    const body = await request.json().catch(() => ({}));
    const availability = registrationAvailability(body);
    const recorded = await recordRegistrationCheck(request, availability);
    if (recorded.rateLimited) {
      return json({ message: "Muitas verificacoes. Aguarde antes de tentar novamente.", code: "RATE_LIMITED" }, { status: 429 });
    }
    const { identity, ...publicAvailability } = availability;
    return json(publicAvailability, { headers: { "cache-control": "no-store" } });
  }

  if (request.method === "POST" && path === "/auth/register/face-check") {
    return json({
      status: "DISABLED",
      message: "Biometria removida do cadastro publico. Envie a solicitacao para analise do administrador.",
      code: "REGISTRATION_ADMIN_ONLY",
    }, { status: 202, headers: { "cache-control": "no-store" } });
  }

  if (request.method === "POST" && path === "/auth/register") {
    const body = await request.json().catch(() => ({}));
    const availability = registrationAvailability(body);
    const recorded = await recordRegistrationCheck(request, availability);
    if (recorded.rateLimited) {
      return json({ message: "Muitas verificacoes. Aguarde antes de tentar novamente.", code: "RATE_LIMITED" }, { status: 429 });
    }
    const result = await createPublicAccountRequest(body, recorded, availability);
    return result.error || result.response;
  }

  const user = userFromToken(request);
  if (!user) return json({ message: "Unauthorized" }, { status: 401 });

  if (request.method === "POST" && path === "/auth/logout") {
    const body = await request.json().catch(() => ({}));
    const auth = request.headers.get("authorization") || "";
    const token = auth.replace(/^Bearer\\s+/i, "").trim();
    if (token) delete state.sessions[token];
    const reason = ["MANUAL", "APP_BACKGROUND"].includes(body.reason) ? body.reason : "MANUAL";
    state.registrationAudit.unshift({
      id: crypto.randomUUID(),
      eventType: "SESSION_ENDED",
      actor: user.username,
      subjectHash: null,
      detail: reason,
      createdAt: now(),
    });
    state.registrationAudit = state.registrationAudit.slice(0, 500);
    return json({ status: "SIGNED_OUT" }, { headers: { "cache-control": "no-store" } });
  }

  if (request.method === "POST" && path === "/user/password/change") {
    const body = await request.json().catch(() => ({}));
    const currentPassword = String(body.currentPassword || "");
    const newPassword = String(body.newPassword || "");
    if (!currentPassword) {
      return badRequest("Informe a senha atual.", "CURRENT_PASSWORD_REQUIRED");
    }
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).{8,128}$/.test(newPassword)) {
      return badRequest("Use no minimo 8 caracteres, com letra maiuscula, minuscula e numero.", "WEAK_PASSWORD");
    }
    if (!await verifyPassword(currentPassword, user.passwordCredential)) {
      return badRequest("A senha atual esta incorreta.", "CURRENT_PASSWORD_INVALID");
    }
    if (await verifyPassword(newPassword, user.passwordCredential)) {
      return badRequest("A nova senha deve ser diferente da senha atual.", "PASSWORD_REUSE");
    }

    user.passwordCredential = await createPasswordCredential(newPassword);
    user.credentialUpdatedAt = now();
    user.initialCredentialExpiresAt = null;
    state.registrationAudit.unshift({
      id: crypto.randomUUID(),
      eventType: "CREDENTIAL_PASSWORD_CHANGED_IN_ACCOUNT",
      actor: user.username,
      subjectHash: null,
      detail: "Senha alterada pelo usuario autenticado dentro da propria conta.",
      createdAt: now(),
    });
    state.registrationAudit = state.registrationAudit.slice(0, 500);

    const auth = request.headers.get("authorization") || "";
    const currentToken = auth.replace(/^Bearer\\s+/i, "").trim();
    for (const [token, session] of Object.entries(state.sessions)) {
      if (session?.username === user.username && token !== currentToken) delete state.sessions[token];
    }
    return json({ status: "PASSWORD_CHANGED" }, { headers: { "cache-control": "no-store" } });
  }

  if (request.method === "POST" && path === "/user/kyc/face-check") {
    return json({
      status: "DISABLED",
      message: "Biometria removida apos o login. Envie somente os documentos para analise administrativa.",
      code: "KYC_FACE_DISABLED",
    }, { headers: { "cache-control": "no-store" } });
  }

  if (request.method === "POST" && path === "/user/kyc/enroll") {
    const body = await request.json().catch(() => ({}));
    const idempotencyKey = String(request.headers.get("idempotency-key") || "").trim();
    if (idempotencyKey.length < 16 || idempotencyKey.length > 150) {
      return badRequest("Informe uma chave de idempotencia valida.", "IDEMPOTENCY_KEY_REQUIRED");
    }
    const imageHashes = await Promise.all([
      sha256Text(String(body.documentFrontImage || "")),
      sha256Text(String(body.documentBackImage || "")),
    ]);
    const fingerprint = await sha256Text([user.username, ...imageHashes].join("|"));
    const previousEnrollment = state.kycEnrollmentRequests.find((item) => item.idempotencyKey === idempotencyKey);
    if (previousEnrollment) {
      if (previousEnrollment.username !== user.username || previousEnrollment.fingerprint !== fingerprint) {
        return json({ message: "Chave de idempotencia reutilizada com evidencias diferentes.", code: "IDEMPOTENCY_CONFLICT" }, { status: 409 });
      }
      return json({
        statusKyc: user.statusKyc,
        identityEvidenceRequired: false,
        analysisId: previousEnrollment.analysisId,
        idempotentReplay: true,
      });
    }
    if (user.statusKyc !== "PENDENTE_VALIDACAO_IDENTIDADE") {
      return badRequest("A conta nao esta aguardando validacao de identidade.", "KYC_INVALID_STATE");
    }
    if (state.kycEvidence[user.username]?.documentFrontEvidenceId) {
      return badRequest("As evidencias de identidade ja foram enviadas.", "KYC_EVIDENCE_ALREADY_SUBMITTED");
    }
    const kycAnalysis = buildKycAnalysis({ ...body, cpf: user.cpf, fullName: user.fullName, requireFace: false }, user);
    if (kycAnalysis.status !== "EVIDENCIA_CAPTURADA_AUTO") {
      return badRequest(kycAnalysis.errorMessage || "Envie frente e verso do documento.", "KYC_EVIDENCE_INVALID");
    }
    let documentFront;
    let documentBack;
    try {
      documentFront = await stageBiometricEvidence({ value: body.documentFrontImage, kind: "KYC_DOCUMENT_FRONT", username: user.username });
      documentBack = await stageBiometricEvidence({ value: body.documentBackImage, kind: "KYC_DOCUMENT_BACK", username: user.username });
    } catch (error) {
      pendingBiometricWrites = [];
      return json({ message: "Nao foi possivel proteger as evidencias de identidade.", code: error.message }, { status: 503 });
    }
    kycAnalysis.subjectName = user.fullName;
    state.documentAnalyses.unshift(kycAnalysis);
    state.kycEvidence[user.username] = {
      analysisId: kycAnalysis.id,
      documentType: kycAnalysis.documentType,
      documentNumber: kycAnalysis.documentNumber,
      biometricStatus: kycAnalysis.biometricStatus,
      evidence: kycAnalysis.evidence,
      documentFrontEvidenceId: documentFront.id,
      documentBackEvidenceId: documentBack.id,
      faceEvidenceId: null,
      faceSha256: null,
      createdAt: kycAnalysis.createdAt,
    };
    user.kycAnalysisId = kycAnalysis.id;
    user.kycEvidenceSubmittedAt = now();
    state.kycEnrollmentRequests.unshift({
      id: crypto.randomUUID(), idempotencyKey, fingerprint, username: user.username,
      analysisId: kycAnalysis.id, createdAt: user.kycEvidenceSubmittedAt,
    });
    state.registrationAudit.unshift({
      id: crypto.randomUUID(), eventType: "KYC_EVIDENCE_SUBMITTED", actor: user.username,
      subjectHash: await sha256Text(user.username), detail: "Documentos protegidos para revisao administrativa; biometria removida por politica.", createdAt: user.kycEvidenceSubmittedAt,
    });
    state.registrationAudit = state.registrationAudit.slice(0, 500);
    return json({
      statusKyc: user.statusKyc,
      identityEvidenceRequired: false,
      analysisId: kycAnalysis.id,
      idempotentReplay: false,
    }, { status: 201, headers: { "cache-control": "no-store" } });
  }

  enforceFinancialConsistency("AUTHENTICATED_REQUEST");

  if (request.method === "GET" && path === "/user/profile") return json(userSummary(user));
  if (request.method === "GET" && path === "/user/me") return json(bankMe(user));
  if (request.method === "GET" && path === "/user/balance") return json(availableBalanceNumber(user));
  if (request.method === "GET" && path === "/user/transactions") {
    return json(state.transactions.filter((tx) => tx.username === user.username).map((tx) => hydrateTransaction(tx, user)));
  }
  if (request.method === "GET" && path === "/user/transfer/resolve") {
    const destination = url.searchParams.get("destination") || "";
    const found = findTransferDestination(destination);
    if (!found) return json({ found: false, message: "Destinatario Bravus nao localizado." });
    if (found.username === user.username) return json({ found: false, code: "SELF_TRANSFER", message: "Nao e permitido transferir para a propria conta." });
    return json(recipientViewForUser(found));
  }
  if (request.method === "GET" && path === "/credit/summary") return json(creditSummary(user));
  if (request.method === "GET" && path.startsWith("/user/external-transfers")) {
    const receiptMatch = path.match(/^\\/user\\/external-transfers\\/(\\d+)\\/receipt$/);
    if (receiptMatch) {
      const order = state.externalTransfers.find((tx) => tx.id === Number(receiptMatch[1]) && canReadOrderReceipt(tx, user));
      if (!order) return json("Transferencia nao encontrada para este usuario.", { status: 404 });
      return json(receiptForOrder(order, user));
    }
    return json(state.externalTransfers.filter((tx) => canReadOrderReceipt(tx, user)));
  }
  if (request.method === "POST"
      && ["/user/withdraw", "/user/transfer", "/user/external-transfers"].includes(path)
      && !canUseOutgoingBanking(user)) {
    return outgoingKycBlocked(user);
  }
  if (request.method === "POST" && path === "/user/external-transfers") {
    const body = await request.json().catch(() => ({}));
    const amount = Number(body.amountCentavos || 0);
    if (!amount || amount <= 0) return json("Digite um valor valido.", { status: 400 });
    const railError = validateCaymanTransferBody(body);
    if (railError) return badRequest(railError.message, railError.code);
    const idempotencyKey = String(request.headers.get("idempotency-key") || body.idempotencyKey || "").trim();
    if (idempotencyKey.length < 16 || idempotencyKey.length > 150) {
      return badRequest("Informe uma chave de idempotencia valida para a transferencia.", "IDEMPOTENCY_KEY_REQUIRED");
    }
    const idempotencyFingerprint = [
      user.username, amount, body.channel, body.beneficiaryDocument || "", body.pixKey || "",
      body.bankCode || "", body.ispb || "", body.agency || "", body.accountNumber || "", body.accountDigit || "",
    ].join("|");
    const previousOrder = state.externalTransfers.find((order) => order.idempotencyKey === idempotencyKey);
    if (previousOrder) {
      if (previousOrder.username !== user.username || (previousOrder.idempotencyFingerprint && previousOrder.idempotencyFingerprint !== idempotencyFingerprint)) {
        return badRequest("A chave de idempotencia ja foi usada com outros dados.", "IDEMPOTENCY_CONFLICT");
      }
      return json(previousOrder);
    }
    const bravusDestination = resolveBravusTransferDestination(body);
    if (bravusDestination) {
      if (bravusDestination.username === user.username) {
        return json("Nao e permitido transferir para a propria conta Bravus.", { status: 400 });
      }
      try {
        const result = commitInternalTransfer({
          payer: user,
          beneficiary: bravusDestination,
          amount,
          description: body.description || "Transferencia interna Bravus",
          channel: "INTERNAL_BRAVUS",
          idempotencyKey,
          source: "USER_EXTERNAL_TRANSFER",
        });
        return json(result.order);
      } catch (error) {
        if (["INSUFFICIENT_BALANCE", "INSUFFICIENT_AVAILABLE_BALANCE"].includes(error.message)) {
          return badRequest("Saldo disponivel insuficiente por saldo contabil ou retencoes ativas.", "INSUFFICIENT_AVAILABLE_BALANCE", {
            availableBalanceCentavos: availableBalanceNumber(user),
          });
        }
        return json(error.message, { status: 400 });
      }
    }
    if (availableBalanceCentavos(user) < exactCentavos(amount, "external_transfer_amount")) {
      return badRequest("Saldo disponivel insuficiente por saldo contabil ou retencoes ativas.", "INSUFFICIENT_AVAILABLE_BALANCE", {
        availableBalanceCentavos: availableBalanceNumber(user),
      });
    }
    if (availableCreditFor(user) < amount) return json("Saldo escritural liberado insuficiente.", { status: 400 });
    user.balance -= amount;
    consumeCreditIfAvailable(user, amount);
    const tx = {
      id: state.transactions.length + 1,
      username: user.username,
      type: "TRANSFER_EXTERNAL",
      amount,
      description: body.description || "Transferencia via provedor Bravus",
      destinationAccount: body.pixKey || [body.bankCode, body.agency, body.accountNumber].filter(Boolean).join(" "),
      status: "COMPLETED",
      createdAt: now(),
    };
    state.transactions.unshift(tx);
    const settlement = settlementFor(body, idempotencyKey);
    const payer = partyForUser(user);
    const beneficiary = partyForExternalBody(body);
    const order = {
      id: state.externalTransfers.length + 1,
      username: user.username,
      payerUsername: user.username,
      transactionId: tx.id,
      amountCentavos: amount,
      channel: body.channel,
      currency: "KYD",
      beneficiaryName: body.beneficiaryName || "Beneficiario externo",
      beneficiaryDocument: String(body.beneficiaryDocument || "").replace(/\\D/g, ""),
      bankCode: body.bankCode || null,
      ispb: body.ispb || null,
      agency: body.agency || null,
      accountNumber: body.accountNumber || null,
      accountDigit: body.accountDigit || null,
      accountType: body.accountType || null,
      pixKey: body.pixKey || null,
      pixKeyType: body.pixKeyType || null,
      description: body.description || null,
      provider: "BRAVUS_SELF_PROVIDER",
      providerTransferId: "bravus-self-sites-" + Date.now(),
      idempotencyKey,
      idempotencyFingerprint,
      status: "COMPLETED",
      settlementStatus: settlement.settlementStatus,
      receiptKind: settlement.receiptKind,
      destinationNetwork: settlement.destinationNetwork,
      destinationParticipantCode: settlement.destinationParticipantCode || null,
      destinationConfirmationId: settlement.destinationConfirmationId || null,
      destinationConfirmedAt: settlement.destinationConfirmedAt || null,
      settlementMessage: settlement.settlementMessage,
      errorMessage: null,
      rawResponse: "{\\"provider\\":\\"BRAVUS_SELF_PROVIDER\\",\\"status\\":\\"COMPLETED\\",\\"settlement\\":\\"INTERNAL_LEDGER\\"}",
      createdAt: now(),
    };
    order.payer = payer;
    order.beneficiary = beneficiary;
    applyTransferParties(tx, payer, beneficiary, "PAYER", order.id);
    state.externalTransfers.unshift(order);
    return json(order);
  }

  if (request.method === "POST" && ["/user/deposit", "/user/withdraw", "/user/transfer"].includes(path)) {
    const body = await request.json().catch(() => ({}));
    const amount = Number(body.amount || body.amountCentavos || 0);
    if (!amount || amount <= 0) return badRequest("Digite um valor valido.", "INVALID_AMOUNT");
    if (path === "/user/withdraw" && availableBalanceCentavos(user) < exactCentavos(amount, "withdraw_amount")) {
      return badRequest("Saldo disponivel insuficiente para concluir a operacao.", "INSUFFICIENT_AVAILABLE_BALANCE", {
        balanceCentavos: user.balance,
        availableBalanceCentavos: availableBalanceNumber(user),
      });
    }
    let destination = null;
    if (path === "/user/transfer") {
      const destinationRaw = body.destinationAccount || body.pixKey || body.accountNumber || "";
      destination = findTransferDestination(destinationRaw);
      if (!destination) {
        return badRequest(
          "Destino Bravus nao encontrado. Para outros bancos, use ACH/EFT Cayman ou Wire/SWIFT internacional.",
          "BRAVUS_DESTINATION_NOT_FOUND"
        );
        /* Legacy external fallback intentionally remains unreachable so historical snapshots can still be parsed. */
        const raw = String(destinationRaw || "").trim();
        const rawDigits = digits(raw);
        const pixKeyType = body.pixKeyType || (raw.includes("@") ? "EMAIL" : rawDigits.length === 11 ? "CPF" : rawDigits.length === 14 ? "CNPJ" : "EVP");
        const externalBody = {
          ...body,
          channel: "INTERNAL_BRAVUS",
          destinationNetwork: body.destinationNetwork || "PIX_BR",
          pixKey: body.pixKey || raw || null,
          pixKeyType,
          beneficiaryName: body.beneficiaryName || "Beneficiario informado",
          beneficiaryDocument: body.beneficiaryDocument || rawDigits || "00000000000",
          description: body.description || "Pagamento via Bravus",
        };
        if (!externalBody.pixKey && !externalBody.accountNumber) {
          return badRequest(
            "Informe conta, CPF, e-mail ou chave Pix. Para outros bancos, use Pagamentos/Pix ou Outros bancos.",
            "DESTINATION_REQUIRED"
          );
        }
        if (availableBalanceCentavos(user) < exactCentavos(amount, "legacy_external_transfer_amount")) {
          return badRequest("Saldo disponivel insuficiente por retencoes ativas.", "INSUFFICIENT_AVAILABLE_BALANCE", {
            availableBalanceCentavos: availableBalanceNumber(user),
          });
        }
        if (availableCreditFor(user) < amount) {
          return badRequest("Saldo escritural liberado insuficiente.", "INSUFFICIENT_CREDIT", { availableCreditCentavos: availableCreditFor(user) });
        }
        user.balance -= amount;
        consumeCreditIfAvailable(user, amount);
        const tx = {
          id: state.transactions.length + 1,
          username: user.username,
          type: "TRANSFER_EXTERNAL",
          amount,
          description: externalBody.description,
          destinationAccount: externalBody.pixKey || [externalBody.bankCode, externalBody.agency, externalBody.accountNumber].filter(Boolean).join(" "),
          status: "COMPLETED",
          createdAt: now(),
        };
        state.transactions.unshift(tx);
        const idempotencyKey = "legacy-transfer-" + Date.now();
        const settlement = settlementFor(externalBody, idempotencyKey);
        const payer = partyForUser(user);
        const beneficiary = partyForExternalBody(externalBody);
        const order = {
          id: state.externalTransfers.length + 1,
          username: user.username,
          payerUsername: user.username,
          transactionId: tx.id,
          amountCentavos: amount,
          channel: externalBody.channel,
          currency: "BRL",
          beneficiaryName: externalBody.beneficiaryName,
          beneficiaryDocument: String(externalBody.beneficiaryDocument || "").replace(/\\D/g, ""),
          bankCode: externalBody.bankCode || null,
          ispb: externalBody.ispb || null,
          agency: externalBody.agency || null,
          accountNumber: externalBody.accountNumber || null,
          accountDigit: externalBody.accountDigit || null,
          accountType: externalBody.accountType || null,
          pixKey: externalBody.pixKey || null,
          pixKeyType: externalBody.pixKeyType || null,
          description: externalBody.description,
          provider: "BRAVUS_SELF_PROVIDER",
          providerTransferId: "bravus-self-legacy-" + Date.now(),
          idempotencyKey,
          status: "COMPLETED",
          settlementStatus: settlement.settlementStatus,
          receiptKind: settlement.receiptKind,
          destinationNetwork: settlement.destinationNetwork,
          destinationParticipantCode: settlement.destinationParticipantCode || null,
          destinationConfirmationId: settlement.destinationConfirmationId || null,
          destinationConfirmedAt: settlement.destinationConfirmedAt || null,
          settlementMessage: "Endpoint legado /user/transfer processado como pagamento Pix pelo provedor Bravus. " + settlement.settlementMessage,
          errorMessage: null,
          rawResponse: "{\\"provider\\":\\"BRAVUS_SELF_PROVIDER\\",\\"status\\":\\"COMPLETED\\",\\"legacyEndpoint\\":\\"/api/user/transfer\\"}",
          createdAt: now(),
        };
        order.payer = payer;
        order.beneficiary = beneficiary;
        applyTransferParties(tx, payer, beneficiary, "PAYER", order.id);
        state.externalTransfers.unshift(order);
        return json(order);
      }
      if (destination.username === user.username) {
        return badRequest("Nao e permitido transferir para a propria conta Bravus.", "SELF_TRANSFER");
      }
      try {
        const result = commitInternalTransfer({
          payer: user,
          beneficiary: destination,
          amount,
          description: body.description || "Transferencia interna Bravus",
          channel: "INTERNAL_BRAVUS",
          idempotencyKey: request.headers.get("idempotency-key") || ("sites-legacy-internal-" + Date.now()),
          source: "LEGACY_USER_TRANSFER",
        });
        return json({
          message: "Transferencia interna Bravus liquidada.",
          status: "COMPLETED",
          provider: "BRAVUS_INTERNAL_LEDGER",
          settlementStatus: "LIQUIDADA_CONFIRMADA",
          balanceCentavos: user.balance,
          transaction: result.tx,
          destination: userSummary(destination),
          receiptOrderId: result.order.id,
          externalOrderId: result.order.id,
          order: result.order,
        });
      } catch (error) {
        if (["INSUFFICIENT_BALANCE", "INSUFFICIENT_AVAILABLE_BALANCE"].includes(error.message)) {
          return badRequest("Saldo disponivel insuficiente para concluir a transferencia.", "INSUFFICIENT_AVAILABLE_BALANCE", {
            balanceCentavos: user.balance,
            availableBalanceCentavos: availableBalanceNumber(user),
          });
        }
        return badRequest(error.message, error.message);
      }
    }
    if (path === "/user/deposit") {
      user.balance += amount;
    } else {
      user.balance -= amount;
      consumeCreditIfAvailable(user, amount);
    }
    if (destination) destination.balance += amount;
    const tx = {
      id: state.transactions.length + 1,
      username: user.username,
      type: path === "/user/deposit" ? "DEPOSIT" : path === "/user/withdraw" ? "WITHDRAWAL" : "TRANSFER_OUT",
      amount,
      description: body.description || "Operacao ChatGPT Sites",
      destinationAccount: destination?.accountNumber || body.destinationAccount || null,
      status: "COMPLETED",
      createdAt: now(),
    };
    state.transactions.unshift(tx);
    let order = null;
    if (destination) {
      const incomingTx = {
        id: state.transactions.length + 1,
        username: destination.username,
        type: "TRANSFER_IN",
        amount,
        description: body.description || "Transferencia recebida ChatGPT Sites",
        destinationAccount: user.accountNumber,
        status: "COMPLETED",
        createdAt: now(),
      };
      state.transactions.unshift(incomingTx);
      const idempotencyKey = "sites-legacy-internal-" + Date.now();
      const payer = partyForUser(user);
      const beneficiary = partyForUser(destination);
      order = {
        id: state.externalTransfers.length + 1,
        username: user.username,
        payerUsername: user.username,
        beneficiaryUsername: destination.username,
        transactionId: tx.id,
        amountCentavos: amount,
        channel: "INTERNAL_BRAVUS",
        currency: "KYD",
        beneficiaryName: destination.fullName,
        beneficiaryDocument: destination.cpf,
        bankCode: "999",
        ispb: "99999999",
        agency: "0001",
        accountNumber: destination.accountNumber,
        accountDigit: null,
        accountType: destination.accountType,
        pixKey: destination.cpf || destination.email,
        pixKeyType: destination.cpf ? "CPF" : "EMAIL",
        description: body.description || null,
        provider: "BRAVUS_INTERNAL_LEDGER",
        providerTransferId: idempotencyKey,
        idempotencyKey,
        status: "COMPLETED",
        settlementStatus: "LIQUIDADA_CONFIRMADA",
        receiptKind: "COMPROVANTE_LIQUIDACAO_CONFIRMADA",
        destinationNetwork: "INTERNAL_BRAVUS",
        destinationParticipantCode: "BRAVUS-INTERNAL",
        destinationConfirmationId: idempotencyKey,
        destinationConfirmedAt: now(),
        settlementMessage: "Liquidacao interna confirmada no ledger Bravus.",
        errorMessage: null,
        rawResponse: "{\\"provider\\":\\"BRAVUS_INTERNAL_LEDGER\\",\\"status\\":\\"COMPLETED\\",\\"settlement\\":\\"INTERNAL_LEDGER\\"}",
        createdAt: now(),
      };
      order.payer = payer;
      order.beneficiary = beneficiary;
      applyTransferParties(tx, payer, beneficiary, "PAYER", order.id);
      applyTransferParties(incomingTx, payer, beneficiary, "BENEFICIARY", order.id);
      state.externalTransfers.unshift(order);
    }
    return json({
      message: destination ? "Transferencia interna Bravus liquidada." : "Operacao realizada.",
      status: "COMPLETED",
      provider: destination ? "BRAVUS_INTERNAL_LEDGER" : "BRAVUS_SITES_LEDGER",
      settlementStatus: destination ? "LIQUIDADA_CONFIRMADA" : "COMPLETED",
      balanceCentavos: user.balance,
      transaction: tx,
      destination: destination ? userSummary(destination) : null,
      receiptOrderId: order?.id || null,
      externalOrderId: order?.id || null,
      order,
    });
  }

  if (!user.roles.includes("ROLE_ADMIN") && path.startsWith("/admin/")) {
    return json({ message: "Forbidden" }, { status: 403 });
  }

  const adminUserDetailMatch = path.match(/^\\/admin\\/users\\/([^/]+)$/);
  if (request.method === "GET" && adminUserDetailMatch) {
    const target = findAdminTargetUser(adminUserDetailMatch[1]);
    if (!target) return json({ message: "Usuario nao encontrado.", code: "ACCOUNT_NOT_FOUND" }, { status: 404 });
    return json(accountDetail(target), { headers: { "cache-control": "no-store" } });
  }

  const adminUserProfileMatch = path.match(/^\\/admin\\/users\\/([^/]+)\\/profile$/);
  if (request.method === "PUT" && adminUserProfileMatch) {
    const target = findAdminTargetUser(adminUserProfileMatch[1]);
    if (!target || target.roles?.includes("ROLE_ADMIN")) {
      return json({ message: "Conta indisponivel para edicao.", code: "ACCOUNT_NOT_FOUND" }, { status: 404 });
    }
    const body = await request.json().catch(() => ({}));
    const fullName = String(body.fullName || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const phone = digits(body.phone || "");
    const reason = String(body.reason || "").trim();
    if (fullName.length < 5 || fullName.length > 120) {
      return badRequest("Informe o nome completo entre 5 e 120 caracteres.", "PROFILE_FULL_NAME_INVALID");
    }
    if (!/^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test(email) || email.length > 160) {
      return badRequest("Informe um e-mail valido.", "PROFILE_EMAIL_INVALID");
    }
    if (phone && (phone.length < 10 || phone.length > 15)) {
      return badRequest("Informe um telefone valido com DDD.", "PROFILE_PHONE_INVALID");
    }
    if (reason.length < 10 || reason.length > 500) {
      return badRequest("Registre um motivo entre 10 e 500 caracteres.", "ACCOUNT_CONTROL_REASON_INVALID");
    }
    const emailConflict = Object.values(state.users).some((item) =>
      item.username !== target.username && String(item.email || "").toLowerCase() === email
    );
    if (emailConflict) return json({ message: "E-mail ja utilizado por outra conta.", code: "EMAIL_ALREADY_EXISTS" }, { status: 409 });
    const changedFields = [
      target.fullName !== fullName ? "fullName" : null,
      String(target.email || "").toLowerCase() !== email ? "email" : null,
      digits(target.phone || "") !== phone ? "phone" : null,
    ].filter(Boolean);
    let attempt;
    try {
      attempt = await accountControlAttempt(request, "PROFILE_UPDATED", target, [fullName, email, phone, reason]);
    } catch (error) {
      if (error.message === "IDEMPOTENCY_KEY_REQUIRED") return badRequest("Informe uma chave de idempotencia valida.", error.message);
      if (error.message === "IDEMPOTENCY_CONFLICT") return json({ message: "Chave de idempotencia reutilizada com outros dados.", code: error.message }, { status: 409 });
      throw error;
    }
    if (attempt.previous) return json({ ...accountDetail(target), idempotentReplay: true });
    if (!changedFields.length) return badRequest("Nenhum dado editavel foi alterado.", "PROFILE_NO_CHANGES");
    target.fullName = fullName;
    target.email = email;
    target.phone = phone;
    await appendAccountControlEvent({
      target, action: "PROFILE_UPDATED", actor: user.username, reason, attempt, changedFields,
    });
    return json({ ...accountDetail(target), idempotentReplay: false });
  }

  const adminUserStatusMatch = path.match(/^\\/admin\\/users\\/([^/]+)\\/(block|unblock)$/);
  if (request.method === "POST" && adminUserStatusMatch) {
    const target = findAdminTargetUser(adminUserStatusMatch[1]);
    if (!target || target.roles?.includes("ROLE_ADMIN")) {
      return json({ message: "Conta indisponivel para controle.", code: "ACCOUNT_NOT_FOUND" }, { status: 404 });
    }
    const body = await request.json().catch(() => ({}));
    const reason = String(body.reason || "").trim();
    if (reason.length < 10 || reason.length > 500) {
      return badRequest("Registre um motivo entre 10 e 500 caracteres.", "ACCOUNT_CONTROL_REASON_INVALID");
    }
    const blocking = adminUserStatusMatch[2] === "block";
    const action = blocking ? "ACCOUNT_BLOCKED" : "ACCOUNT_UNBLOCKED";
    const nextStatus = blocking ? "BLOCKED_ADMIN" : "ACTIVE";
    let attempt;
    try {
      attempt = await accountControlAttempt(request, action, target, [reason]);
    } catch (error) {
      if (error.message === "IDEMPOTENCY_KEY_REQUIRED") return badRequest("Informe uma chave de idempotencia valida.", error.message);
      if (error.message === "IDEMPOTENCY_CONFLICT") return json({ message: "Chave de idempotencia reutilizada com outros dados.", code: error.message }, { status: 409 });
      throw error;
    }
    if (attempt.previous) return json({ ...accountDetail(target), idempotentReplay: true });
    if (accountStatus(target) === nextStatus) {
      return json({ message: blocking ? "A conta ja esta bloqueada." : "A conta ja esta ativa.", code: "ACCOUNT_STATUS_UNCHANGED" }, { status: 409 });
    }
    transitionAccountStatus(target, nextStatus);
    if (blocking) revokeUserSessions(target.username);
    await appendAccountControlEvent({ target, action, actor: user.username, reason, attempt });
    return json({ ...accountDetail(target), idempotentReplay: false });
  }

  const adminUserHoldMatch = path.match(/^\\/admin\\/users\\/([^/]+)\\/holds$/);
  if (request.method === "POST" && adminUserHoldMatch) {
    const target = findAdminTargetUser(adminUserHoldMatch[1]);
    if (!target || target.roles?.includes("ROLE_ADMIN")) {
      return json({ message: "Conta indisponivel para retencao.", code: "ACCOUNT_NOT_FOUND" }, { status: 404 });
    }
    const body = await request.json().catch(() => ({}));
    const reason = String(body.reason || "").trim();
    let amount;
    try {
      amount = exactCentavos(body.amountCentavos, "balance_hold_amount");
    } catch {
      return badRequest("Informe o valor em centavos inteiros.", "BALANCE_HOLD_AMOUNT_INVALID");
    }
    if (amount <= 0n || amount > BigInt(Number.MAX_SAFE_INTEGER)) {
      return badRequest("Informe um valor de retencao valido.", "BALANCE_HOLD_AMOUNT_INVALID");
    }
    if (reason.length < 10 || reason.length > 500) {
      return badRequest("Registre um motivo entre 10 e 500 caracteres.", "ACCOUNT_CONTROL_REASON_INVALID");
    }
    let attempt;
    try {
      attempt = await accountControlAttempt(request, "BALANCE_HOLD_PLACED", target, [amount.toString(), reason]);
    } catch (error) {
      if (error.message === "IDEMPOTENCY_KEY_REQUIRED") return badRequest("Informe uma chave de idempotencia valida.", error.message);
      if (error.message === "IDEMPOTENCY_CONFLICT") return json({ message: "Chave de idempotencia reutilizada com outros dados.", code: error.message }, { status: 409 });
      throw error;
    }
    if (attempt.previous) {
      const previousHold = state.balanceHolds.find((hold) => hold.id === attempt.previous.holdId);
      return json({ hold: previousHold || null, detail: accountDetail(target), idempotentReplay: true });
    }
    if (amount > availableBalanceCentavos(target)) {
      return json({
        message: "A retencao excede o saldo atualmente disponivel.",
        code: "BALANCE_HOLD_EXCEEDS_AVAILABLE",
        availableBalanceCentavos: availableBalanceCentavos(target).toString(),
      }, { status: 409 });
    }
    const hold = {
      id: crypto.randomUUID(),
      username: target.username,
      amountCentavos: amount.toString(),
      status: "ACTIVE",
      reason,
      createdBy: user.username,
      createdAt: now(),
      releasedBy: null,
      releasedAt: null,
      releaseReason: null,
    };
    state.balanceHolds.unshift(hold);
    await appendAccountControlEvent({
      target, action: "BALANCE_HOLD_PLACED", actor: user.username, reason, attempt,
      holdId: hold.id, amountCentavos: hold.amountCentavos,
    });
    return json({ hold, detail: accountDetail(target), idempotentReplay: false }, { status: 201 });
  }

  const adminUserHoldReleaseMatch = path.match(/^\\/admin\\/users\\/([^/]+)\\/holds\\/([^/]+)\\/release$/);
  if (request.method === "POST" && adminUserHoldReleaseMatch) {
    const target = findAdminTargetUser(adminUserHoldReleaseMatch[1]);
    const hold = target ? state.balanceHolds.find((item) => item.id === decodeURIComponent(adminUserHoldReleaseMatch[2]) && item.username === target.username) : null;
    if (!target || target.roles?.includes("ROLE_ADMIN") || !hold) {
      return json({ message: "Retencao nao encontrada.", code: "BALANCE_HOLD_NOT_FOUND" }, { status: 404 });
    }
    const body = await request.json().catch(() => ({}));
    const reason = String(body.reason || "").trim();
    if (reason.length < 10 || reason.length > 500) {
      return badRequest("Registre um motivo entre 10 e 500 caracteres.", "ACCOUNT_CONTROL_REASON_INVALID");
    }
    let attempt;
    try {
      attempt = await accountControlAttempt(request, "BALANCE_HOLD_RELEASED", target, [hold.id, hold.amountCentavos, reason]);
    } catch (error) {
      if (error.message === "IDEMPOTENCY_KEY_REQUIRED") return badRequest("Informe uma chave de idempotencia valida.", error.message);
      if (error.message === "IDEMPOTENCY_CONFLICT") return json({ message: "Chave de idempotencia reutilizada com outros dados.", code: error.message }, { status: 409 });
      throw error;
    }
    if (attempt.previous) return json({ hold, detail: accountDetail(target), idempotentReplay: true });
    if (hold.status !== "ACTIVE") {
      return json({ message: "A retencao ja foi liberada.", code: "BALANCE_HOLD_ALREADY_RELEASED" }, { status: 409 });
    }
    hold.status = "RELEASED";
    hold.releasedBy = user.username;
    hold.releasedAt = now();
    hold.releaseReason = reason;
    await appendAccountControlEvent({
      target, action: "BALANCE_HOLD_RELEASED", actor: user.username, reason, attempt,
      holdId: hold.id, amountCentavos: hold.amountCentavos,
    });
    return json({ hold, detail: accountDetail(target), idempotentReplay: false });
  }

  const adminUserPasswordMatch = path.match(/^\\/admin\\/users\\/([^/]+)\\/password-reset$/);
  if (request.method === "POST" && adminUserPasswordMatch) {
    const target = findAdminTargetUser(adminUserPasswordMatch[1]);
    if (!target || target.roles?.includes("ROLE_ADMIN")) {
      return json({ message: "Conta indisponivel para redefinicao.", code: "ACCOUNT_NOT_FOUND" }, { status: 404 });
    }
    const body = await request.json().catch(() => ({}));
    const temporaryPassword = String(body.temporaryPassword || "");
    const reason = String(body.reason || "").trim();
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).{8,128}$/.test(temporaryPassword)) {
      return badRequest("Use no minimo 8 caracteres, com letra maiuscula, minuscula e numero.", "WEAK_PASSWORD");
    }
    if (reason.length < 10 || reason.length > 500) {
      return badRequest("Registre um motivo entre 10 e 500 caracteres.", "ACCOUNT_CONTROL_REASON_INVALID");
    }
    let attempt;
    try {
      attempt = await accountControlAttempt(request, "PASSWORD_RESET_BY_ADMIN", target, [temporaryPassword, reason]);
    } catch (error) {
      if (error.message === "IDEMPOTENCY_KEY_REQUIRED") return badRequest("Informe uma chave de idempotencia valida.", error.message);
      if (error.message === "IDEMPOTENCY_CONFLICT") return json({ message: "Chave de idempotencia reutilizada com outros dados.", code: error.message }, { status: 409 });
      throw error;
    }
    if (attempt.previous) return json({ account: userSummary(target), idempotentReplay: true });
    target.passwordCredential = await createPasswordCredential(temporaryPassword);
    transitionCredential(target, "ADMIN_RESET_REQUIRED", user.username, "Senha temporaria administrativa emitida; troca obrigatoria no proximo acesso.");
    target.initialCredentialExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    revokeUserSessions(target.username);
    state.initialPasswordChallenges = state.initialPasswordChallenges.filter((challenge) => challenge.username !== target.username);
    for (const resetRequest of state.passwordResetRequests) {
      if (resetRequest.username === target.username && resetRequest.status === "ADMIN_PENDING") {
        resetRequest.reviewedBy = user.username;
        resetRequest.reviewReason = reason;
        resetRequest.reviewedAt = now();
        transitionPasswordReset(resetRequest, "TEMP_PASSWORD_ISSUED", user.username, "Senha temporaria emitida pelo administrador.");
      }
    }
    await appendAccountControlEvent({
      target, action: "PASSWORD_RESET_BY_ADMIN", actor: user.username, reason, attempt,
    });
    return json({
      account: userSummary(target),
      passwordChangeRequired: true,
      temporaryPasswordExpiresAt: target.initialCredentialExpiresAt,
      idempotentReplay: false,
    }, { headers: { "cache-control": "no-store" } });
  }

  const grantsByUserMatch = path.match(/^\\/admin\\/ledger\\/credit\\/by-user\\/(\\d+)$/);
  if (request.method === "GET" && grantsByUserMatch) {
    const userId = Number(grantsByUserMatch[1]);
    return json(state.masterCreditGrants
      .filter((grant) => Number(grant.userId) === userId)
      .map(masterCreditGrantView));
  }

  if (request.method === "POST" && path === "/admin/ledger/credit/issue") {
    const body = await request.json().catch(() => ({}));
    const idempotencyKey = String(request.headers.get("idempotency-key") || "").trim();
    if (idempotencyKey.length < 16 || idempotencyKey.length > 150) {
      return badRequest("Informe uma chave de idempotencia valida.", "IDEMPOTENCY_KEY_REQUIRED");
    }
    const requestedUserId = Number(body.userId);
    if (String(body.reservaCodigo || masterCreditReserveSeed.code) !== masterCreditReserveSeed.code) {
      return badRequest("Reserva mestre de origem invalida.", "MASTER_CREDIT_RESERVE_INVALID");
    }
    let amount;
    try {
      amount = exactCentavos(body.valorCentavos ?? body.amountCentavos, "master_credit_issue");
    } catch {
      return badRequest("Informe o valor em centavos inteiros.", "MASTER_CREDIT_AMOUNT_INVALID");
    }
    if (amount <= 0n || amount > BigInt(Number.MAX_SAFE_INTEGER)) {
      return badRequest("Valor fora do limite de precisao por concessao.", "MASTER_CREDIT_AMOUNT_INVALID");
    }
    const assessmentReason = String(body.motivo || body.assessmentReason || "").trim();
    const eligibilityRule = String(body.regraElegibilidade || body.eligibilityRule || "").trim();
    const notes = String(body.observacoes || body.notes || "").trim();
    const annualInterestRate = Number(body.taxaJurosAnual ?? body.annualInterestRate ?? 0);
    const releaseNow = body.liberarAgora === true || body.releaseNow === true;
    if (assessmentReason.length < 10 || assessmentReason.length > 500) {
      return badRequest("Registre o motivo detalhado da avaliacao.", "MASTER_CREDIT_ASSESSMENT_REQUIRED");
    }
    if (eligibilityRule.length < 10 || eligibilityRule.length > 500) {
      return badRequest("Registre o criterio de elegibilidade aplicado.", "MASTER_CREDIT_ELIGIBILITY_REQUIRED");
    }
    if (!Number.isFinite(annualInterestRate) || annualInterestRate !== 0) {
      return badRequest("Esta concessao escritural nao gera divida nem juros.", "MASTER_CREDIT_NON_REPAYABLE");
    }
    const fingerprint = await sha256Text([
      String(requestedUserId), amount.toString(), assessmentReason, eligibilityRule,
      notes, releaseNow ? "1" : "0", passwordPepper(),
    ].join("|"));
    const previousRequest = state.masterCreditRequests.find((item) => item.idempotencyKey === idempotencyKey);
    if (previousRequest) {
      if (previousRequest.fingerprint !== fingerprint) {
        return json({ message: "Chave de idempotencia reutilizada com dados diferentes.", code: "IDEMPOTENCY_CONFLICT" }, { status: 409 });
      }
      const previousGrant = state.masterCreditGrants.find((grant) => grant.id === previousRequest.grantId);
      if (!previousGrant) return json({ message: "Concessao anterior inconsistente.", code: "MASTER_CREDIT_INCONSISTENT" }, { status: 409 });
      return json({ grant: masterCreditGrantView(previousGrant), idempotentReplay: true });
    }
    const beneficiary = Object.values(state.users).find((item) => Number(item.id) === requestedUserId);
    if (!beneficiary || beneficiary.roles?.includes("ROLE_ADMIN")) {
      return json({ message: "Cliente nao encontrado.", code: "CUSTOMER_NOT_FOUND" }, { status: 404 });
    }
    if (beneficiary.active === false) {
      return json({ message: "A conta do cliente esta inativa.", code: "CUSTOMER_INACTIVE" }, { status: 409 });
    }
    if (!hasExplicitApprovedKyc(beneficiary)) {
      return json({ message: "A concessao exige identidade aprovada.", code: "CUSTOMER_KYC_REQUIRED" }, { status: 409 });
    }
    if (releaseNow && exactCentavos(beneficiary.balance, "beneficiary_balance") + amount > BigInt(Number.MAX_SAFE_INTEGER)) {
      return badRequest("O saldo resultante excederia o limite de precisao da conta.", "CUSTOMER_BALANCE_PRECISION_LIMIT");
    }
    const reserve = await loadMasterCreditReserve(currentEnv.DB);
    const allocation = masterCreditAllocation(reserve);
    if (amount > exactCentavos(allocation.availableCentavos, "master_credit_available")) {
      return json({ message: "Saldo insuficiente na Reserva Mestre.", code: "MASTER_CREDIT_RESERVE_INSUFFICIENT" }, { status: 409 });
    }
    const createdAt = now();
    const grant = {
      id: crypto.randomUUID(),
      userId: beneficiary.id,
      username: beneficiary.username,
      reserveCode: masterCreditReserveSeed.code,
      amountCentavos: amount.toString(),
      status: "PENDENTE",
      assessmentReason,
      eligibilityRule,
      notes: notes || null,
      productType: "NON_REPAYABLE_BOOK_CREDIT",
      repayable: false,
      interestBearing: false,
      policyVersion: 1,
      assessedBy: user.username,
      assessedAt: createdAt,
      createdAt,
    };
    state.masterCreditGrants.unshift(grant);
    state.masterCreditRequests.unshift({ idempotencyKey, fingerprint, grantId: grant.id, actor: user.username, createdAt });
    pendingMasterCreditEventWrites.push({
      id: crypto.randomUUID(),
      grantId: grant.id,
      eventType: "GRANT_CREATED",
      accountUsername: beneficiary.username,
      amountCentavos: grant.amountCentavos,
      actor: user.username,
      assessmentReason,
      eligibilityRule,
      idempotencyHash: await sha256Text(idempotencyKey),
      createdAt,
    });
    if (releaseNow) {
      try {
        await releaseMasterCreditGrant(grant, beneficiary, user.username, idempotencyKey);
      } catch (error) {
        return json({ message: "Nao foi possivel liberar o credito.", code: error.message }, { status: 409 });
      }
    }
    return json({ grant: masterCreditGrantView(grant), idempotentReplay: false }, { status: 201, headers: { "cache-control": "no-store" } });
  }

  const releaseMasterCreditMatch = path.match(/^\\/admin\\/ledger\\/credit\\/([^/]+)\\/release$/);
  if (request.method === "POST" && releaseMasterCreditMatch) {
    const idempotencyKey = String(request.headers.get("idempotency-key") || "").trim();
    if (idempotencyKey.length < 16 || idempotencyKey.length > 150) {
      return badRequest("Informe uma chave de idempotencia valida.", "IDEMPOTENCY_KEY_REQUIRED");
    }
    const grant = state.masterCreditGrants.find((item) => item.id === decodeURIComponent(releaseMasterCreditMatch[1]));
    if (!grant) return json({ message: "Concessao nao encontrada.", code: "MASTER_CREDIT_GRANT_NOT_FOUND" }, { status: 404 });
    const releaseRequestHash = await sha256Text(idempotencyKey + "|" + grant.id + "|release");
    if (grant.status === "LIBERADO") {
      if (grant.releaseRequestHash === releaseRequestHash) {
        return json({ grant: masterCreditGrantView(grant), idempotentReplay: true }, { headers: { "cache-control": "no-store" } });
      }
      return json({ message: "A concessao ja foi liberada por outra solicitacao.", code: "MASTER_CREDIT_ALREADY_RELEASED" }, { status: 409 });
    }
    const beneficiary = state.users[grant.username];
    if (!beneficiary || beneficiary.active === false || !hasExplicitApprovedKyc(beneficiary)) {
      return json({ message: "O cliente precisa estar ativo e com identidade aprovada.", code: "CUSTOMER_NOT_ELIGIBLE" }, { status: 409 });
    }
    try {
      const result = await releaseMasterCreditGrant(grant, beneficiary, user.username, idempotencyKey);
      return json({ grant: masterCreditGrantView(result.grant), idempotentReplay: result.idempotentReplay }, { headers: { "cache-control": "no-store" } });
    } catch (error) {
      return json({ message: "A concessao ja foi liberada por outra solicitacao.", code: error.message }, { status: 409 });
    }
  }

  if (request.method === "POST" && path === "/admin/accounts/provision") {
    const body = await request.json().catch(() => ({}));
    const idempotencyKey = String(request.headers.get("idempotency-key") || "").trim();
    if (idempotencyKey.length < 16 || idempotencyKey.length > 150) {
      return badRequest("Informe uma chave de idempotencia valida.", "IDEMPOTENCY_KEY_REQUIRED");
    }
    const identity = registrationIdentity(body);
    const fullName = String(body.fullName || "").trim();
    const initialPassword = String(body.initialPassword || "");
    if (fullName.length < 5 || fullName.length > 120) {
      return badRequest("Informe o nome completo do titular.", "ACCOUNT_FULL_NAME_INVALID");
    }
    if (!/^[a-z0-9._-]{3,50}$/.test(identity.username)) {
      return badRequest("Informe um usuario valido.", "ACCOUNT_USERNAME_INVALID");
    }
    if (initialPassword.length < 6 || initialPassword.length > 128) {
      return badRequest("A senha inicial deve ter entre 6 e 128 caracteres.", "INITIAL_PASSWORD_INVALID");
    }
    const phone = String(body.phone || "").replace(/\\D/g, "");
    const fingerprintMaterial = [
      identity.cpf, identity.username, identity.email, fullName.toLowerCase(), phone, initialPassword,
    ].map((value) => String(value).length + ":" + String(value)).join("|");
    const fingerprint = await sha256Text(fingerprintMaterial + "|" + passwordPepper());
    const previousProvision = state.accountProvisioningRequests.find((item) => item.idempotencyKey === idempotencyKey);
    if (previousProvision) {
      if (previousProvision.fingerprint !== fingerprint) {
        return json({ message: "Chave de idempotencia reutilizada com dados diferentes.", code: "IDEMPOTENCY_CONFLICT" }, { status: 409 });
      }
      const previousAccount = state.users[previousProvision.username];
      if (!previousAccount) {
        return json({ message: "Provisionamento anterior inconsistente.", code: "ACCOUNT_PROVISION_INCONSISTENT" }, { status: 409 });
      }
      return json({ account: userSummary(previousAccount), passwordChangeRequired: previousAccount.credentialState === "INITIAL_CHANGE_REQUIRED", idempotentReplay: true });
    }
    const availability = registrationAvailability(identity);
    if (!availability.available) {
      const { identity: privateIdentity, ...publicAvailability } = availability;
      return json(publicAvailability, { status: 409, headers: { "cache-control": "no-store" } });
    }
    const createdAt = now();
    const provisionedAccount = {
      ...joao,
      id: Math.max(...Object.values(state.users).map((item) => item.id)) + 1,
      username: identity.username,
      email: identity.email,
      fullName,
      cpf: identity.cpf,
      phone,
      accountNumber: accountNumberForDocument(identity.cpf),
      balance: 0,
      roles: ["ROLE_USER"],
      statusKyc: "PENDENTE_VALIDACAO_IDENTIDADE",
      kycAnalysisId: null,
      credentialState: "INITIAL_CHANGE_REQUIRED",
      initialCredentialExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      passwordCredential: await createPasswordCredential(initialPassword),
      createdAt,
    };
    state.users[provisionedAccount.username] = provisionedAccount;
    state.accountProvisioningRequests.unshift({
      id: crypto.randomUUID(), idempotencyKey, fingerprint, username: provisionedAccount.username,
      actor: user.username, createdAt,
    });
    const provisionAuditEntry = {
      id: crypto.randomUUID(), eventType: "ACCOUNT_PROVISIONED_PENDING_IDENTITY", actor: user.username,
      accountUsername: provisionedAccount.username, subjectHash: await registrationSubjectHash(identity),
      detail: "Conta provisionada com senha inicial de uso unico e validacao de identidade pendente.", createdAt,
    };
    state.registrationAudit.unshift(provisionAuditEntry);
    state.registrationAudit = state.registrationAudit.slice(0, 500);
    pendingAccountProvisionAuditWrites.push(provisionAuditEntry);
    return json({
      account: userSummary(provisionedAccount),
      passwordChangeRequired: true,
      identityVerificationRequired: true,
      idempotentReplay: false,
    }, { status: 201, headers: { "cache-control": "no-store" } });
  }

  const initialPasswordReissueMatch = path.match(/^\\/admin\\/accounts\\/([^/]+)\\/initial-password\\/reissue$/);
  if (request.method === "POST" && initialPasswordReissueMatch) {
    const account = state.users[decodeURIComponent(initialPasswordReissueMatch[1])];
    const body = await request.json().catch(() => ({}));
    const idempotencyKey = String(request.headers.get("idempotency-key") || "").trim();
    const initialPassword = String(body.initialPassword || "");
    if (idempotencyKey.length < 16 || idempotencyKey.length > 150) {
      return badRequest("Informe uma chave de idempotencia valida.", "IDEMPOTENCY_KEY_REQUIRED");
    }
    if (!account || account.roles.includes("ROLE_ADMIN")) {
      return json({ message: "Conta indisponivel para reemissao.", code: "ACCOUNT_NOT_FOUND" }, { status: 404 });
    }
    if (account.credentialState !== "INITIAL_CHANGE_REQUIRED") {
      return badRequest("A conta ja concluiu o primeiro acesso.", "INITIAL_PASSWORD_REISSUE_INVALID_STATE");
    }
    if (initialPassword.length < 6 || initialPassword.length > 128) {
      return badRequest("A senha inicial deve ter entre 6 e 128 caracteres.", "INITIAL_PASSWORD_INVALID");
    }
    const fingerprint = await sha256Text(account.username + "|INITIAL_PASSWORD_REISSUE");
    const previousReissue = state.initialPasswordReissues.find((item) => item.idempotencyKey === idempotencyKey);
    if (previousReissue) {
      if (previousReissue.username !== account.username || previousReissue.fingerprint !== fingerprint) {
        return json({ message: "Chave de idempotencia reutilizada para outra conta.", code: "IDEMPOTENCY_CONFLICT" }, { status: 409 });
      }
      return json({ account: userSummary(account), idempotentReplay: true });
    }
    account.passwordCredential = await createPasswordCredential(initialPassword);
    account.initialCredentialExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    revokeUserSessions(account.username);
    state.initialPasswordChallenges = state.initialPasswordChallenges.filter((challenge) => challenge.username !== account.username);
    state.initialPasswordReissues.unshift({
      id: crypto.randomUUID(), idempotencyKey, fingerprint, username: account.username,
      actor: user.username, createdAt: now(),
    });
    state.registrationAudit.unshift({
      id: crypto.randomUUID(), eventType: "INITIAL_PASSWORD_REISSUED", actor: user.username,
      subjectHash: await sha256Text(account.username), detail: "Senha inicial reemitida; desafios e sessoes anteriores revogados.", createdAt: now(),
    });
    state.registrationAudit = state.registrationAudit.slice(0, 500);
    return json({ account: userSummary(account), idempotentReplay: false }, { headers: { "cache-control": "no-store" } });
  }

  if (request.method === "GET" && path === "/admin/persistence/status") {
    const ledger = validateSitesLedger();
    let kycEvidenceSchemaReady = false;
    let immutableKycAuditCount = null;
    let institutionalReserveReady = false;
    let institutionalReserveAuditCount = null;
    let immutableAccountProvisioningAuditCount = null;
    let masterCreditReserveReady = false;
    let immutableMasterCreditEventCount = null;
    let immutableAccountControlEventCount = null;
    let accountControlAuditReconciled = false;
    let masterCreditAuditReconciled = false;
    let masterCreditExpectedEventCount = null;
    try {
      const evidenceSchema = await currentEnv.DB.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'bravus_biometric_evidence'").first();
      const kycAuditCount = await currentEnv.DB.prepare("SELECT COUNT(*) AS count FROM bravus_kyc_audit").first();
      const reserve = await loadInstitutionalReserve(currentEnv.DB);
      const reserveAuditCount = await currentEnv.DB.prepare("SELECT COUNT(*) AS count FROM bravus_institutional_reserve_audit").first();
      const provisioningAuditCount = await currentEnv.DB.prepare("SELECT COUNT(*) AS count FROM bravus_account_provisioning_audit").first();
      const masterReserve = await loadMasterCreditReserve(currentEnv.DB);
      const masterEventCount = await currentEnv.DB.prepare("SELECT COUNT(*) AS count FROM bravus_master_credit_events").first();
      const accountControlEventCount = await currentEnv.DB.prepare("SELECT COUNT(*) AS count FROM bravus_account_control_events").first();
      const accountControlAudit = await validateAccountControlAudit(currentEnv.DB);
      const masterAudit = await validateMasterCreditAudit(currentEnv.DB);
      const schemaSql = String(evidenceSchema?.sql || "");
      kycEvidenceSchemaReady = schemaSql.includes("KYC_DOCUMENT_FRONT") && schemaSql.includes("KYC_DOCUMENT_BACK");
      immutableKycAuditCount = Number(kycAuditCount?.count || 0);
      institutionalReserveReady = reserve.amountCentavos === "100000000000000000" && reserve.status === "DECLARED";
      institutionalReserveAuditCount = Number(reserveAuditCount?.count || 0);
      immutableAccountProvisioningAuditCount = Number(provisioningAuditCount?.count || 0);
      masterCreditReserveReady = masterReserve.totalAmountCentavos === "100000000000000000" && masterReserve.status === "ACTIVE";
      immutableMasterCreditEventCount = Number(masterEventCount?.count || 0);
      immutableAccountControlEventCount = Number(accountControlEventCount?.count || 0);
      accountControlAuditReconciled = accountControlAudit.valid;
      masterCreditAuditReconciled = masterAudit.valid;
      masterCreditExpectedEventCount = masterAudit.expected;
    } catch {
      kycEvidenceSchemaReady = false;
      institutionalReserveReady = false;
    }
    return json({
      ...persistenceMeta,
      buildTarget,
      durable: true,
      userCount: Object.keys(state.users).length,
      transactionCount: state.transactions.length,
      ledgerEntryCount: state.ledgerEntries.length,
      ledgerValid: ledger.valid,
      kycEvidenceSchemaReady,
      immutableKycAuditCount,
      institutionalReserveReady,
      institutionalReserveAuditCount,
      immutableAccountProvisioningAuditCount,
      masterCreditReserveReady,
      immutableMasterCreditEventCount,
      immutableAccountControlEventCount,
      accountControlAuditReconciled,
      masterCreditAuditReconciled,
      masterCreditExpectedEventCount,
    });
  }

  if (request.method === "GET" && path === "/admin/kyc/pending") {
    return json(Object.values(state.users)
      .filter((account) => account.statusKyc === "PENDENTE_VALIDACAO_IDENTIDADE")
      .map((account) => ({
        username: account.username,
        fullName: account.fullName,
        maskedCpf: maskCpf(account.cpf),
        statusKyc: account.statusKyc,
        analysisId: account.kycAnalysisId,
      })));
  }

  const kycEvidenceMatch = path.match(/^\\/admin\\/kyc\\/([^/]+)\\/evidence$/);
  if (request.method === "GET" && kycEvidenceMatch) {
    const account = state.users[decodeURIComponent(kycEvidenceMatch[1])];
    const evidence = account ? state.kycEvidence[account.username] : null;
    if (!account || !evidence?.documentFrontEvidenceId || !evidence?.documentBackEvidenceId) {
      return json({ message: "Evidencias de abertura indisponiveis." }, { status: 404 });
    }
    try {
      const [documentFront, documentBack, face] = await Promise.all([
        decryptBiometricEvidence(evidence.documentFrontEvidenceId, "KYC_DOCUMENT_FRONT"),
        decryptBiometricEvidence(evidence.documentBackEvidenceId, "KYC_DOCUMENT_BACK"),
        evidence.faceEvidenceId
          ? decryptBiometricEvidence(evidence.faceEvidenceId, "ENROLLED_FACE")
          : Promise.resolve(null),
      ]);
      return json({
        username: account.username,
        fullName: account.fullName,
        maskedCpf: maskCpf(account.cpf),
        statusKyc: account.statusKyc,
        documentFront,
        documentBack,
        face,
        faceRemovedByPolicy: !evidence.faceEvidenceId,
      }, { headers: { "cache-control": "no-store", pragma: "no-cache" } });
    } catch {
      return json({ message: "Nao foi possivel abrir as evidencias protegidas." }, { status: 503 });
    }
  }

  const kycReviewMatch = path.match(/^\\/admin\\/kyc\\/([^/]+)\\/(approve|reject)$/);
  if (request.method === "POST" && kycReviewMatch) {
    const account = state.users[decodeURIComponent(kycReviewMatch[1])];
    const body = await request.json().catch(() => ({}));
    const reason = String(body.reason || "").trim();
    if (!account || account.statusKyc !== "PENDENTE_VALIDACAO_IDENTIDADE") {
      return badRequest("A conta nao esta aguardando validacao de identidade.", "KYC_INVALID_STATE");
    }
    const evidence = state.kycEvidence[account.username];
    if (kycReviewMatch[2] === "approve"
        && (!evidence?.documentFrontEvidenceId || !evidence?.documentBackEvidenceId)) {
      return badRequest("A conta ainda nao enviou frente e verso do documento para aprovacao.", "KYC_EVIDENCE_REQUIRED");
    }
    if (reason.length < 10 || reason.length > 500) {
      return badRequest("Registre um motivo entre 10 e 500 caracteres.", "KYC_REASON_INVALID");
    }
    const previousStatus = account.statusKyc;
    const approved = kycReviewMatch[2] === "approve";
    account.statusKyc = approved ? "APROVADO_IDENTIDADE" : "REJEITADO_IDENTIDADE";
    account.kycReviewedBy = user.username;
    account.kycReviewReason = reason;
    account.kycReviewedAt = now();
    const analysis = state.documentAnalyses.find((item) => item.id === account.kycAnalysisId);
    if (analysis) {
      analysis.status = approved ? "APROVADO_REVISAO_HUMANA" : "REJEITADO_REVISAO_HUMANA";
      analysis.reviewedBy = user.username;
      analysis.reviewReason = reason;
      analysis.reviewedAt = account.kycReviewedAt;
    }
    const accountRequest = publicAccountRequests().find((item) =>
      item.identity?.username === account.username && item.status === "PENDING_ADMIN_REVIEW"
    );
    if (accountRequest) {
      accountRequest.status = approved ? "APPROVED" : "REJECTED";
      accountRequest.reviewedBy = user.username;
      accountRequest.reviewReason = reason;
      accountRequest.reviewedAt = account.kycReviewedAt;
    }
    const auditEntry = {
      id: crypto.randomUUID(), username: account.username, actor: user.username,
      fromStatus: previousStatus, toStatus: account.statusKyc, reason, createdAt: account.kycReviewedAt,
    };
    state.kycAudit.unshift(auditEntry);
    state.kycAudit = state.kycAudit.slice(0, 500);
    pendingKycAuditWrites.push(auditEntry);
    if (!approved) revokeUserSessions(account.username);
    return json(userSummary(account));
  }

  if (request.method === "GET" && path === "/admin/password-reset/requests") {
    return json(state.passwordResetRequests
      .filter((item) => item.status === "ADMIN_PENDING" && new Date(item.expiresAt).getTime() > Date.now())
      .map((item) => {
        const account = state.users[item.username];
        return {
          requestId: item.requestId,
          username: account?.username || null,
          email: account?.email || null,
          fullName: account?.fullName || "Cliente protegido",
          maskedCpf: maskCpf(account?.cpf),
          status: item.status,
          attempts: item.attempts,
          createdAt: item.createdAt,
          expiresAt: item.expiresAt,
          instruction: item.instruction,
        };
      }));
  }

  const resetEvidenceMatch = path.match(/^\\/admin\\/password-reset\\/requests\\/([^/]+)\\/evidence$/);
  if (request.method === "GET" && resetEvidenceMatch) {
    const resetRequest = state.passwordResetRequests.find((item) => item.requestId === resetEvidenceMatch[1]);
    const account = resetRequest ? state.users[resetRequest.username] : null;
    const enrolled = account ? state.kycEvidence[account.username] : null;
    if (!resetRequest || !account || !enrolled?.faceEvidenceId || !resetRequest.submittedFaceEvidenceId) {
      return json({ message: "Evidencia facial indisponivel." }, { status: 404 });
    }
    try {
      const [enrolledFace, submittedFace] = await Promise.all([
        decryptBiometricEvidence(enrolled.faceEvidenceId, "ENROLLED_FACE"),
        decryptBiometricEvidence(resetRequest.submittedFaceEvidenceId, "PASSWORD_RESET_FACE"),
      ]);
      return json({
        requestId: resetRequest.requestId,
        fullName: account.fullName,
        maskedCpf: maskCpf(account.cpf),
        challenge: resetRequest.instruction,
        enrolledFace,
        submittedFace,
      }, { headers: { "cache-control": "no-store", pragma: "no-cache" } });
    } catch {
      return json({ message: "Nao foi possivel abrir a evidencia protegida." }, { status: 503 });
    }
  }

  const resetReviewMatch = path.match(/^\\/admin\\/password-reset\\/requests\\/([^/]+)\\/(approve|reject)$/);
  if (request.method === "POST" && resetReviewMatch) {
    const resetRequest = state.passwordResetRequests.find((item) => item.requestId === resetReviewMatch[1]);
    const body = await request.json().catch(() => ({}));
    const reason = String(body.reason || "").trim();
    if (!resetRequest || resetRequest.status !== "ADMIN_PENDING") {
      return badRequest("Solicitacao nao esta aguardando revisao.", "PASSWORD_RESET_INVALID_STATE");
    }
    if (reason.length < 10 || reason.length > 500) {
      return badRequest("Registre um motivo entre 10 e 500 caracteres.", "PASSWORD_RESET_REASON_INVALID");
    }
    const next = resetReviewMatch[2] === "approve" ? "TEMP_PASSWORD_ISSUED" : "REJECTED";
    resetRequest.reviewedBy = user.username;
    resetRequest.reviewReason = reason;
    resetRequest.reviewedAt = now();
    transitionPasswordReset(resetRequest, next, user.username, reason);
    return json({ requestId: resetRequest.requestId, status: passwordResetPublicStatus(resetRequest.status) });
  }

  if (request.method === "GET" && path === "/admin/account-requests") {
    return json(publicAccountRequests()
      .filter((item) => item.status === "PENDING_ADMIN_REVIEW")
      .map((item) => ({
        requestId: item.id,
        status: item.status,
        fullName: item.fullName,
        username: item.identity?.username || "",
        email: item.identity?.email || "",
        cpf: item.identity?.cpf || "",
        maskedCpf: maskCpf(item.identity?.cpf),
        phone: item.phone || "",
        documentEvidenceReceived: Boolean(item.documentFrontEvidenceId && item.documentBackEvidenceId),
        faceEvidenceReceived: Boolean(item.faceEvidenceId),
        createdAt: item.createdAt,
      })));
  }

  const accountRequestEvidenceMatch = path.match(/^\\/admin\\/account-requests\\/([^/]+)\\/evidence$/);
  if (request.method === "GET" && accountRequestEvidenceMatch) {
    const accountRequest = publicAccountRequests().find((item) => item.id === decodeURIComponent(accountRequestEvidenceMatch[1]));
    if (!accountRequest || !accountRequest.documentFrontEvidenceId || !accountRequest.documentBackEvidenceId) {
      return json({ message: "Fotos do documento indisponiveis para esta solicitacao." }, { status: 404 });
    }
    try {
      const [documentFront, documentBack, face] = await Promise.all([
        decryptBiometricEvidence(accountRequest.documentFrontEvidenceId, "KYC_DOCUMENT_FRONT"),
        decryptBiometricEvidence(accountRequest.documentBackEvidenceId, "KYC_DOCUMENT_BACK"),
        accountRequest.faceEvidenceId
          ? decryptBiometricEvidence(accountRequest.faceEvidenceId, "ENROLLED_FACE")
          : Promise.resolve(null),
      ]);
      return json({
        requestId: accountRequest.id,
        fullName: accountRequest.fullName,
        username: accountRequest.identity?.username || "",
        email: accountRequest.identity?.email || "",
        maskedCpf: maskCpf(accountRequest.identity?.cpf),
        documentFront,
        documentBack,
        face,
        faceEvidenceMissingFromLegacyRegistration: !accountRequest.faceEvidenceId,
      }, { headers: { "cache-control": "no-store", pragma: "no-cache" } });
    } catch {
      return json({ message: "Nao foi possivel abrir as fotos protegidas do documento." }, { status: 503 });
    }
  }

  if (request.method === "GET" && path === "/admin/dashboard") {
    const users = Object.values(state.users);
    return json({ totalUsers: users.length, activeUsers: users.filter((item) => item.active !== false).length, totalTransactions: state.transactions.length, totalBalance: users.reduce((sum, item) => sum + item.balance, 0) });
  }
  if (request.method === "GET" && path === "/admin/users") return json(Object.values(state.users).map(userSummary));
  if (request.method === "GET" && path === "/admin/transactions") {
    return json(state.transactions.map((tx) => hydrateTransaction(tx, state.users[tx.username] || user)));
  }
  if (request.method === "GET" && path === "/admin/ledger/balance-sheet") {
    const reserve = await loadMasterCreditReserve(currentEnv.DB);
    const allocation = masterCreditAllocation(reserve);
    const masterReserve = { ...reserve, ...allocation };
    const ledgerValidation = validateSitesLedger();
    const masterAudit = await validateMasterCreditAudit(currentEnv.DB);
    const clientLiabilitiesCentavos = Object.values(state.users).reduce(
      (sum, item) => sum + exactCentavos(item.balance, "client_balance"),
      0n,
    );
    const ledgerNetCentavos = state.ledgerEntries.reduce(
      (sum, entry) => sum + exactCentavos(entry.signedAmountCentavos, "ledger_entry"),
      0n,
    );
    const accounting = {
      amountUnit: "CENTAVOS",
      precision: "INTEGER_DECIMAL_STRING",
      totalLiabilitiesCentavos: clientLiabilitiesCentavos.toString(),
      ledgerNetCentavos: ledgerNetCentavos.toString(),
      ledgerReconciled: ledgerValidation.valid && ledgerNetCentavos === 0n,
      masterAllocationBalanced: allocation.balanced,
      masterCreditAuditReconciled: masterAudit.valid,
      economicClassification: "NON_REPAYABLE_BOOK_CREDIT",
      createsCustomerDebt: false,
      externalCashBackingClaimed: false,
      balanced: allocation.balanced && masterAudit.valid && ledgerValidation.valid && ledgerNetCentavos === 0n,
    };
    return json({
      contractVersion: 3,
      amountUnit: "CENTAVOS",
      totalLiabilities: accounting.totalLiabilitiesCentavos,
      ledgerNet: accounting.ledgerNetCentavos,
      reserves: [masterReserve],
      masterCreditReserve: masterReserve,
      reservaMestre: {
        codigo: masterReserve.code,
        nome: masterReserve.name,
        saldoTotalCentavos: masterReserve.totalCentavos,
        disponivelEmissaoCentavos: masterReserve.availableCentavos,
        comprometidoCentavos: masterReserve.committedCentavos,
        liberadoCentavos: masterReserve.releasedCentavos,
      },
      reservasInternas: [{
        codigo: masterReserve.code,
        nome: masterReserve.name,
        valorDisponivelCentavos: masterReserve.availableCentavos,
      }],
      accounting,
    }, { headers: { "cache-control": "no-store" } });
  }
  if (request.method === "GET" && path === "/admin/ledger/validate-chain") return json(validateSitesLedger());
  if (request.method === "GET" && path.startsWith("/admin/ledger/entries")) return json({ content: state.ledgerEntries, audit: state.ledgerAudit });
  if (request.method === "GET" && path.startsWith("/admin/analysis/document")) return json(state.documentAnalyses);
  if (request.method === "POST" && path === "/admin/analysis/document") {
    const body = await request.json().catch(() => ({}));
    return json(analyzeDocumentRequest(body));
  }
  if (request.method === "GET" && path.startsWith("/admin/ledger/external-transfers")) return json(state.externalTransfers);
  if (request.method === "POST" && path === "/admin/ledger/external-transfers") {
    const body = await request.json().catch(() => ({}));
    const origin = Object.values(state.users).find((item) => item.id === Number(body.userId));
    if (!origin) return json("Usuario nao encontrado.", { status: 400 });
    if (!canUseOutgoingBanking(origin)) return outgoingKycBlocked(origin);
    const amount = Number(body.amountCentavos || 0);
    if (!amount || amount <= 0) return json("Digite um valor valido.", { status: 400 });
    const railError = validateCaymanTransferBody(body);
    if (railError) return badRequest(railError.message, railError.code);
    const idempotencyKey = String(request.headers.get("idempotency-key") || body.idempotencyKey || "").trim();
    if (idempotencyKey.length < 16 || idempotencyKey.length > 150) {
      return badRequest("Informe uma chave de idempotencia valida para a transferencia.", "IDEMPOTENCY_KEY_REQUIRED");
    }
    const idempotencyFingerprint = [
      origin.username, amount, body.channel, body.beneficiaryDocument || "", body.pixKey || "",
      body.bankCode || "", body.ispb || "", body.agency || "", body.accountNumber || "", body.accountDigit || "",
    ].join("|");
    const previousOrder = state.externalTransfers.find((order) => order.idempotencyKey === idempotencyKey);
    if (previousOrder) {
      if (previousOrder.username !== origin.username || (previousOrder.idempotencyFingerprint && previousOrder.idempotencyFingerprint !== idempotencyFingerprint)) {
        return badRequest("A chave de idempotencia ja foi usada com outros dados.", "IDEMPOTENCY_CONFLICT");
      }
      return json(previousOrder);
    }
    const bravusDestination = resolveBravusTransferDestination(body);
    if (bravusDestination) {
      if (bravusDestination.username === origin.username) {
        return json("Nao e permitido transferir para a propria conta Bravus.", { status: 400 });
      }
      try {
        const result = commitInternalTransfer({
          payer: origin,
          beneficiary: bravusDestination,
          amount,
          description: body.description || "Transferencia interna admin Bravus",
          channel: "INTERNAL_BRAVUS",
          idempotencyKey,
          source: "ADMIN",
        });
        return json(result.order);
      } catch (error) {
        if (["INSUFFICIENT_BALANCE", "INSUFFICIENT_AVAILABLE_BALANCE"].includes(error.message)) {
          return badRequest("Saldo disponivel insuficiente por saldo contabil ou retencoes ativas.", "INSUFFICIENT_AVAILABLE_BALANCE", {
            availableBalanceCentavos: availableBalanceNumber(origin),
          });
        }
        return json(error.message, { status: 400 });
      }
    }
    if (availableBalanceCentavos(origin) < exactCentavos(amount, "admin_external_transfer_amount")) {
      return badRequest("Saldo disponivel insuficiente por saldo contabil ou retencoes ativas.", "INSUFFICIENT_AVAILABLE_BALANCE", {
        availableBalanceCentavos: availableBalanceNumber(origin),
      });
    }
    if (availableCreditFor(origin) < amount) return json("Saldo escritural liberado insuficiente.", { status: 400 });
    origin.balance -= amount;
    consumeCreditIfAvailable(origin, amount);
    const tx = {
      id: state.transactions.length + 1,
      username: origin.username,
      type: "TRANSFER_EXTERNAL",
      amount,
      description: body.description || "Transferencia via admin Bravus",
      destinationAccount: body.pixKey || [body.bankCode, body.agency, body.accountNumber].filter(Boolean).join(" "),
      status: "COMPLETED",
      createdAt: now(),
    };
    state.transactions.unshift(tx);
    const settlement = settlementFor(body, idempotencyKey);
    const payer = partyForUser(origin);
    const beneficiary = partyForExternalBody(body);
    const order = {
      id: state.externalTransfers.length + 1,
      username: origin.username,
      payerUsername: origin.username,
      transactionId: tx.id,
      amountCentavos: amount,
      channel: body.channel,
      currency: "KYD",
      beneficiaryName: body.beneficiaryName || "Beneficiario externo",
      beneficiaryDocument: String(body.beneficiaryDocument || "").replace(/\\D/g, ""),
      bankCode: body.bankCode || null,
      ispb: body.ispb || null,
      agency: body.agency || null,
      accountNumber: body.accountNumber || null,
      accountDigit: body.accountDigit || null,
      accountType: body.accountType || null,
      pixKey: body.pixKey || null,
      pixKeyType: body.pixKeyType || null,
      description: body.description || null,
      provider: "BRAVUS_SELF_PROVIDER",
      providerTransferId: "bravus-self-sites-admin-" + Date.now(),
      idempotencyKey,
      idempotencyFingerprint,
      status: "COMPLETED",
      settlementStatus: settlement.settlementStatus,
      receiptKind: settlement.receiptKind,
      destinationNetwork: settlement.destinationNetwork,
      destinationParticipantCode: settlement.destinationParticipantCode || null,
      destinationConfirmationId: settlement.destinationConfirmationId || null,
      destinationConfirmedAt: settlement.destinationConfirmedAt || null,
      settlementMessage: settlement.settlementMessage,
      errorMessage: null,
      rawResponse: "{\\"provider\\":\\"BRAVUS_SELF_PROVIDER\\",\\"status\\":\\"COMPLETED\\",\\"settlement\\":\\"INTERNAL_LEDGER\\"}",
      createdAt: now(),
    };
    order.payer = payer;
    order.beneficiary = beneficiary;
    applyTransferParties(tx, payer, beneficiary, "PAYER", order.id);
    state.externalTransfers.unshift(order);
    return json(order);
  }
  if (request.method === "GET" && path === "/admin/global-rail/participants") return json(state.globalRailParticipants);
  if (request.method === "POST" && path === "/admin/global-rail/participants") {
    const body = await request.json().catch(() => ({}));
    const participantCode = String(body.participantCode || "").trim().toUpperCase();
    if (!participantCode || !body.legalName) return json("Codigo e nome legal sao obrigatorios.", { status: 400 });
    const network = String(body.network || "GLOBAL").trim().toUpperCase();
    const connectionMode = String(body.connectionMode || "MANUAL_CONFIRMATION").trim().toUpperCase();
    const country = String(body.country || "KY").toUpperCase().slice(0, 2);
    const swiftBic = normalizeExternalBic(body.swiftBic);
    const bicError = externalBicValidationError(swiftBic, country, isBravusOwned({
      participantCode,
      bankCode: body.bankCode,
      network,
    }));
    if (bicError) return json({ message: bicError, code: "SWIFT_BIC_NOT_EXTERNAL" }, { status: 400 });
    if (connectionMode === "SELF_LEDGER" && !participantCode.startsWith("BRAVUS") && body.bankCode !== "999" && network !== "INTERNAL_BRAVUS") {
      return json("SELF_LEDGER so pode ser usado em participante controlado pelo Bravus.", { status: 400 });
    }
    let participant = state.globalRailParticipants.find((item) => item.participantCode === participantCode);
    if (!participant) {
      participant = { id: state.globalRailParticipants.length + 1, createdAt: now() };
      state.globalRailParticipants.unshift(participant);
    }
    Object.assign(participant, {
      participantCode,
      legalName: String(body.legalName),
      country,
      network,
      bankCode: body.bankCode || null,
      ispb: body.ispb || null,
      swiftBic: swiftBic || null,
      swiftBicStatus: swiftBic ? "EXTERNAL_DECLARED_UNVERIFIED" : "NOT_PROVIDED",
      swiftBicRegistered: false,
      swiftConnected: false,
      swiftExternalRoutingEnabled: false,
      routingCode: body.routingCode || null,
      endpointUrl: body.endpointUrl || null,
      authMode: String(body.authMode || "NONE").toUpperCase(),
      connectionMode,
      settlementAccount: body.settlementAccount || null,
      supportsInstant: Boolean(body.supportsInstant),
      status: String(body.status || "DRAFT").toUpperCase(),
      updatedAt: now(),
    });
    return json(participant);
  }
  const confirmMatch = path.match(/^\\/admin\\/global-rail\\/transfers\\/(\\d+)\\/confirm$/);
  if (request.method === "POST" && confirmMatch) {
    const body = await request.json().catch(() => ({}));
    const order = state.externalTransfers.find((item) => item.id === Number(confirmMatch[1]));
    if (!order) return json("Transferencia nao encontrada.", { status: 404 });
    order.settlementStatus = "LIQUIDADA_CONFIRMADA";
    order.receiptKind = "COMPROVANTE_LIQUIDACAO_CONFIRMADA";
    order.destinationConfirmationId = body.confirmationId || ("global-confirm-" + Date.now());
    order.destinationNetwork = body.destinationNetwork || order.destinationNetwork;
    order.destinationParticipantCode = body.participantCode || order.destinationParticipantCode;
    order.destinationConfirmedAt = now();
    order.settlementMessage = body.message || "Liquidacao externa confirmada por participante/conector.";
    return json(order);
  }
  if (request.method === "GET" && path === "/admin/cayman-rail/config") return json({
    id: 1,
    enabled: true,
    legalEntityName: "Bravus Premium Bank",
    jurisdiction: "Cayman Islands",
    regulatoryStatus: "DRAFT",
    settlementMode: "INTERNAL_ONLY",
    productionEnabled: false,
    institution: bravusInstitutionProfile,
  });
  if (request.method === "GET" && path === "/admin/cayman-rail/readiness") return json({
    ready: false,
    productionReady: false,
    companyRegistered: false,
    cimaLicensed: false,
    liveSettlement: false,
    activeParticipants: state.globalRailParticipants.filter((item) => item.status === "ACTIVE").length,
    blockedInstructions: 0,
    gate: "LICENSE_REQUIRED",
    institution: bravusInstitutionProfile,
    message: "BIC interno configurado. Rede SWIFT externa bloqueada ate registro e habilitacao oficiais.",
  });
  if (request.method === "GET" && path === "/admin/cayman-rail/participants") return json(
    state.globalRailParticipants.filter((item) => item.country === "KY")
  );
  if (request.method === "GET" && path.startsWith("/admin/cayman-rail/instructions")) return json([]);
  if (request.method === "POST" && path === "/admin/search/unified") {
    const body = await request.json().catch(() => ({}));
    const query = String(body.query || "");
    const queryLower = query.toLowerCase();
    const queryDigits = query.replace(/\\D/g, "");
    const matchingUsers = Object.values(state.users).filter((item) =>
      (queryDigits && (item.cpf === queryDigits || item.accountNumber === queryDigits))
      || item.username.toLowerCase().includes(queryLower)
      || item.email.toLowerCase().includes(queryLower)
      || item.fullName.toLowerCase().includes(queryLower)
    );
    return json({
      query,
      queryType: queryDigits.length === 11 ? "CPF" : "GERAL",
      normalizedQuery: queryDigits || query,
      resultCount: matchingUsers.length,
      summary: { users: matchingUsers.length, transactions: 0, other: 0 },
      warnings: [],
      results: matchingUsers.map((item) => ({ source: "USERS", kind: "CLIENTE", title: item.fullName, status: "ATIVO", fields: userSummary(item) })),
    });
  }

  return json({ message: "Endpoint nao disponivel." }, { status: 404 });
}

export default {
  async fetch(request, env) {
    if (new URL(request.url).pathname.startsWith("/api/")) return handlePersistedApi(request, env);
    const requestedPath = routePath(request.url);
    const file = files[requestedPath];
    if (!file) return new Response("Not found", { status: 404 });
    if (file.externalUrl) {
      return Response.redirect(file.externalUrl, 302);
    }
    const servedFile = file.alias ? files[file.alias] : file;
    if (!servedFile?.body) return new Response("Not found", { status: 404 });
    const headers = { "content-type": file.type };
    if (file.type === "application/vnd.android.package-archive") {
      headers["content-disposition"] = 'attachment; filename="' + (requestedPath.split("/").pop() || "bravus-bank.apk") + '"';
      headers["x-content-type-options"] = "nosniff";
    }
    return new Response(bytesFromBase64(servedFile.body), { headers });
  },
};
`;

await rm(artifactDir, { recursive: true, force: true });
await mkdir(join(artifactDir, ".openai"), { recursive: true });
await writeFile(join(artifactDir, "index.mjs"), entrypoint);
await writeFile(join(artifactDir, ".openai", "hosting.json"), await readFile(join(root, ".openai", "hosting.json")));
const migrationFiles = await walk(join(root, "drizzle"));
for (const migrationFile of migrationFiles) {
  const destination = join(artifactDir, ".openai", "drizzle", relative(join(root, "drizzle"), migrationFile));
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, await readFile(migrationFile));
}
await tar(["-czf", archivePath, "-C", artifactDir, "."]);

const archive = await stat(archivePath);
console.log(JSON.stringify({
  archive: archivePath,
  archiveName: basename(archivePath),
  files: Object.keys(files).length,
  aliases: Object.values(files).filter((file) => file.alias).length,
  migrations: migrationFiles.length,
  bytes: archive.size,
}, null, 2));
