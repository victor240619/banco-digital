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
  if (extname(file).toLowerCase() === ".apk" && basename(file) === "bravus-bank.apk") {
    files[route] = { type, alias: "/downloads/bravus-bank-mobile.apk" };
    continue;
  }
  files[route] = { type, body: (await readFile(file)).toString("base64") };
}
files["/"] = files["/index.html"];

const entrypoint = `const buildTarget = "bravus-sites-api-d1-v1";
const files = ${JSON.stringify(files)};
const liveSeed = ${JSON.stringify(liveSeed)};
const now = () => new Date().toISOString();
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
    swiftBic: "",
    routingCode: "",
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
let persistenceMeta = { backend: "D1", revision: 0, payloadHash: null, updatedAt: null };

function normalizeState(candidate) {
  const next = candidate && typeof candidate === "object" ? candidate : {};
  next.users = next.users && typeof next.users === "object" ? next.users : {};
  next.users[joao.username] = { ...joao, ...(next.users[joao.username] || {}) };
  next.users[francisca.username] = { ...francisca, ...(next.users[francisca.username] || {}) };
  next.users[admin.username] = { ...admin, ...(next.users[admin.username] || {}) };
  for (const user of Object.values(next.users)) {
    user.roles = Array.isArray(user.roles) && user.roles.length ? user.roles : ["ROLE_USER"];
    if (!user.passwordCredential || user.passwordCredential.hash === legacyPasswordV0Hash) {
      user.passwordCredential = { ...legacyPasswordCredential };
    }
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
  next.loginAttempts = Array.isArray(next.loginAttempts) ? next.loginAttempts : [];
  next.creditGrant = next.creditGrant && typeof next.creditGrant === "object"
    ? { ...joaoCreditGrantSeed, ...next.creditGrant }
    : { ...joaoCreditGrantSeed };
  next.globalRailParticipants = Array.isArray(next.globalRailParticipants) && next.globalRailParticipants.length
    ? next.globalRailParticipants
    : structuredClone(initialStateSeed.globalRailParticipants);
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

function createSession(user) {
  const token = randomToken(32);
  state.sessions[token] = {
    username: user.username,
    createdAt: now(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };
  return token;
}

function revokeUserSessions(username) {
  for (const [token, session] of Object.entries(state.sessions)) {
    if (session?.username === username) delete state.sessions[token];
  }
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

function userSummary(user) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    fullName: user.fullName,
    cpf: user.cpf,
    phone: user.phone,
    accountNumber: user.accountNumber,
    accountType: user.accountType,
    balance: user.balance,
    statusKyc: user.statusKyc || "APROVADO_AUTO",
    isActive: true,
    createdAt: "2026-07-12T00:00:00-03:00",
  };
}

function authResponse(user, token) {
  return {
    token,
    username: user.username,
    email: user.email,
    fullName: user.fullName,
    accountNumber: user.accountNumber,
    balance: user.balance,
    statusKyc: user.statusKyc || "APROVADO_AUTO",
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
    balanceCentavos: user.balance,
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

function partyForUser(user) {
  return {
    name: user.fullName,
    document: user.cpf,
    bankName: "Bravus Premium Bank",
    bankCode: "999",
    ispb: "99999999",
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
    agency: party.agency,
    accountNumber: party.accountNumber,
    accountDigit: party.accountDigit,
    accountType: party.accountType,
    pixKey: party.pixKey,
    pixKeyType: party.pixKeyType,
    statusKyc: user.statusKyc || "APROVADO_AUTO",
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
    currency: "BRL",
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
    currency: "BRL",
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
    channel: channel || "PIX",
    currency: "BRL",
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
  const fingerprint = [payer.username, beneficiary.username, value, String(description || "").trim(), String(channel || "PIX")].join("|");
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
  if (payer.balance < value) throw new Error("INSUFFICIENT_BALANCE");

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
    if (payer.balance < amount) {
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
  const transferId = "sites-transaction-" + tx.id + "-" + tx.type;
  if (hasBalancedLedger(transferId)) return;
  const amount = Number(tx.amount || 0);
  const user = state.users[tx.username];
  if (!user || !amount || amount <= 0) return;
  const bank = { username: "BRAVUS_LEDGER", accountNumber: "BRAVUS-LEDGER" };
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
      reason: "TRANSACTION_RECONCILIATION",
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
      reason: "TRANSACTION_RECONCILIATION",
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
  const channel = String(body.channel || "GLOBAL").toUpperCase();
  if (channel === "PIX") return "PIX_BR";
  if (channel === "TED") return "TED_BR";
  return channel;
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
  return {
    ...userSummary(user),
    phoneFormatted: user.phone || null,
    dadosBancarios: {
      nomeBanco: "Bravus Premium Bank",
      codigoBanco: "999",
      ispb: "99999999",
      agencia: "0001",
      conta: user.accountNumber,
      contaFormatada: user.accountNumber.slice(0, -1) + "-" + user.accountNumber.slice(-1),
      tipoConta: user.accountType,
      chavePix: user.cpf || user.email,
      tipoChavePix: user.cpf ? "CPF" : "EMAIL",
    },
    saldos: {
      saldoDisponivelCentavos: user.balance,
      saldoDisponivel: user.balance / 100,
      limiteCreditoCentavos: 0,
      limiteCredito: 0,
      limitePixDiarioCentavos: 1000000,
      limitePixDiario: 10000,
      totalDisponivelCentavos: user.balance,
      totalDisponivel: user.balance / 100,
    },
    conta: {
      nivel: "PREMIUM",
      statusKyc: user.statusKyc || "APROVADO_AUTO",
      ativa: true,
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
  if (new Date(session.expiresAt).getTime() <= Date.now()) {
    delete state.sessions[token];
    return null;
  }
  return state.users[session.username] || null;
}

function publicLoginMatches(user, username) {
  const normalized = String(username || "").replace(/\\D/g, "");
  const raw = String(username || "").trim().toLowerCase();
  return raw === user.username.toLowerCase()
    || raw === user.email.toLowerCase()
    || (user.cpf && normalized === user.cpf);
}

function canUseOutgoingBanking(user) {
  const status = user.statusKyc || "APROVADO_AUTO";
  return status === "APROVADO_AUTO" || status === "APROVADO_IDENTIDADE";
}

function outgoingKycBlocked(user) {
  return json({
    message: "Sua conta pode consultar e receber valores, mas operacoes de saida aguardam a validacao de identidade.",
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
  const face = imageEvidence(body.faceImage, "Biometria facial", 2500, 240, 240);
  const duplicateEvidence =
    front.fingerprint
    && (front.fingerprint === back.fingerprint || front.fingerprint === face.fingerprint || back.fingerprint === face.fingerprint);
  const checks = [front, back, face];
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
    biometricStatus: face.ok ? "CAPTURA_QUALIDADE_VALIDADA" : "FACE_AUSENTE",
    biometricChallenge: body.biometricChallenge || "FACE_CAMERA_CAPTURE_V1",
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
    message = "Revise os dados antes de continuar.";
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
  if (state.registrationChecks.filter((item) => item.actorHash === actorHash).length >= 15) {
    return { rateLimited: true, actorHash };
  }
  const subjectHash = await registrationSubjectHash(availability.identity);
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

async function validatedRegistrationFaceCheck(body) {
  const tokenHash = await sha256Text(String(body.faceVerificationToken || ""));
  const subjectHash = await registrationSubjectHash(registrationIdentity(body));
  const faceSha256 = await sha256Text(String(body.faceImage || ""));
  const check = state.registrationFaceChecks.find((item) => item.tokenHash === tokenHash) || null;
  if (!check || check.status !== "VALIDATED" || check.subjectHash !== subjectHash || check.faceSha256 !== faceSha256) return null;
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
    registrationStatus: knownUser ? (knownUser.statusKyc || "APROVADO_AUTO") : "DOCUMENTO_NAO_VINCULADO_A_CONTA_BRAVUS",
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

async function ensureD1Schema(db) {
  if (d1SchemaReady) return;
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS bravus_state (id INTEGER PRIMARY KEY NOT NULL CHECK (id = 1), revision INTEGER NOT NULL CHECK (revision >= 1), payload TEXT NOT NULL, payload_hash TEXT NOT NULL, source_captured_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)"),
    db.prepare("CREATE TABLE IF NOT EXISTS bravus_state_audit (id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, revision INTEGER NOT NULL UNIQUE, request_id TEXT NOT NULL, method TEXT NOT NULL, path TEXT NOT NULL, actor TEXT NOT NULL, previous_hash TEXT NOT NULL, payload_hash TEXT NOT NULL, created_at TEXT NOT NULL)"),
    db.prepare("CREATE TABLE IF NOT EXISTS bravus_ledger_entries (transfer_id TEXT NOT NULL, entry_type TEXT NOT NULL CHECK (entry_type IN ('debit','credit')), order_id INTEGER, account_username TEXT, account_number TEXT NOT NULL, signed_amount_centavos INTEGER NOT NULL, currency TEXT NOT NULL DEFAULT 'BRL', reason TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY (transfer_id, entry_type), CHECK ((entry_type = 'debit' AND signed_amount_centavos < 0) OR (entry_type = 'credit' AND signed_amount_centavos > 0)))"),
    db.prepare("CREATE TABLE IF NOT EXISTS bravus_biometric_evidence (id TEXT PRIMARY KEY NOT NULL, kind TEXT NOT NULL CHECK (kind IN ('ENROLLED_FACE','PASSWORD_RESET_FACE','KYC_DOCUMENT_FRONT','KYC_DOCUMENT_BACK')), owner_username TEXT NOT NULL, mime TEXT NOT NULL, ciphertext TEXT NOT NULL, iv TEXT NOT NULL, sha256 TEXT NOT NULL, created_at TEXT NOT NULL)"),
    db.prepare("CREATE TABLE IF NOT EXISTS bravus_kyc_audit (id TEXT PRIMARY KEY NOT NULL, username TEXT NOT NULL, actor TEXT NOT NULL, from_status TEXT NOT NULL, to_status TEXT NOT NULL, reason TEXT NOT NULL, created_at TEXT NOT NULL)"),
    db.prepare("CREATE INDEX IF NOT EXISTS bravus_kyc_audit_username_created_idx ON bravus_kyc_audit (username, created_at)"),
    db.prepare("CREATE TRIGGER IF NOT EXISTS bravus_ledger_entries_no_update BEFORE UPDATE ON bravus_ledger_entries BEGIN SELECT RAISE(ABORT, 'Ledger entries are immutable; create a compensating entry'); END"),
    db.prepare("CREATE TRIGGER IF NOT EXISTS bravus_ledger_entries_no_delete BEFORE DELETE ON bravus_ledger_entries BEGIN SELECT RAISE(ABORT, 'Ledger entries are immutable; create a compensating entry'); END"),
    db.prepare("CREATE TRIGGER IF NOT EXISTS bravus_state_audit_no_update BEFORE UPDATE ON bravus_state_audit BEGIN SELECT RAISE(ABORT, 'State audit entries are immutable'); END"),
    db.prepare("CREATE TRIGGER IF NOT EXISTS bravus_state_audit_no_delete BEFORE DELETE ON bravus_state_audit BEGIN SELECT RAISE(ABORT, 'State audit entries are immutable'); END"),
    db.prepare("CREATE TRIGGER IF NOT EXISTS bravus_biometric_evidence_no_update BEFORE UPDATE ON bravus_biometric_evidence BEGIN SELECT RAISE(ABORT, 'Biometric evidence is immutable'); END"),
    db.prepare("CREATE TRIGGER IF NOT EXISTS bravus_biometric_evidence_no_delete BEFORE DELETE ON bravus_biometric_evidence BEGIN SELECT RAISE(ABORT, 'Biometric evidence is immutable'); END"),
    db.prepare("CREATE TRIGGER IF NOT EXISTS bravus_kyc_audit_no_update BEFORE UPDATE ON bravus_kyc_audit BEGIN SELECT RAISE(ABORT, 'KYC audit entries are immutable'); END"),
    db.prepare("CREATE TRIGGER IF NOT EXISTS bravus_kyc_audit_no_delete BEFORE DELETE ON bravus_kyc_audit BEGIN SELECT RAISE(ABORT, 'KYC audit entries are immutable'); END"),
  ]);
  d1SchemaReady = true;
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
      persistenceMeta = {
        backend: "D1",
        revision: Number(previous.revision),
        payloadHash: previous.payload_hash,
        updatedAt: previous.updated_at || null,
      };
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
    if (!user || !await verifyPassword(body.password, user.passwordCredential)) {
      state.loginAttempts.unshift({ identifierHash: loginIdentifierHash, createdAt: now() });
      return json("Invalid username or password", { status: 400 });
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
    const token = createSession(user);
    return json(authResponse(user, token));
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
      challenge: randomToken(24),
      instruction: "Olhe para a camera, vire levemente o rosto para a direita e mantenha os olhos abertos.",
      status: "FACE_PENDING",
      attempts: 0,
      createdAt,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    };
    state.passwordResetRequests.unshift(resetRequest);
    state.passwordResetAudit.unshift({
      id: crypto.randomUUID(), requestId: resetRequest.requestId, eventType: "STARTED", actor: "PUBLIC",
      detail: "Solicitacao criada sem expor a existencia da conta.", createdAt,
    });
    return json({
      requestId: resetRequest.requestId,
      challenge: resetRequest.challenge,
      instruction: resetRequest.instruction,
      expiresAt: resetRequest.expiresAt,
      status: "FACE_PENDING",
    }, { status: 202 });
  }

  if (request.method === "POST" && path === "/auth/password-reset/face") {
    const body = await request.json().catch(() => ({}));
    let resetRequest;
    try {
      resetRequest = await passwordResetRequestForClient(body);
    } catch {
      return badRequest("Solicitacao indisponivel.", "PASSWORD_RESET_UNAVAILABLE");
    }
    if (resetRequest.status !== "FACE_PENDING") {
      return json({ status: passwordResetPublicStatus(resetRequest.status) }, { status: 202 });
    }
    resetRequest.attempts += 1;
    if (String(body.challenge || "") !== resetRequest.challenge) {
      if (resetRequest.attempts >= 3) transitionPasswordReset(resetRequest, "LOCKED", "PUBLIC", "Limite de desafios invalidos excedido.");
      return badRequest("Desafio facial invalido.", "PASSWORD_RESET_CHALLENGE_INVALID");
    }
    const face = imageEvidence(body.faceImage, "Biometria facial", 2500);
    if (!face.ok) {
      if (resetRequest.attempts >= 3) transitionPasswordReset(resetRequest, "LOCKED", "PUBLIC", "Limite de capturas invalidas excedido.");
      return badRequest(face.message, "PASSWORD_RESET_FACE_INVALID");
    }
    const enrolled = resetRequest.username ? state.kycEvidence[resetRequest.username] : null;
    if (!resetRequest.username || !enrolled?.faceEvidenceId) {
      transitionPasswordReset(resetRequest, "REJECTED", "SYSTEM", "Conta ou biometria de abertura indisponivel.");
      return json({ status: "UNAVAILABLE" }, { status: 202 });
    }
    const submitted = await stageBiometricEvidence({
      value: body.faceImage,
      kind: "PASSWORD_RESET_FACE",
      username: resetRequest.username,
    });
    resetRequest.submittedFaceEvidenceId = submitted.id;
    resetRequest.submittedFaceSha256 = submitted.sha256;
    transitionPasswordReset(resetRequest, "REVIEW_PENDING", "PUBLIC", "Captura facial recebida para revisao humana.");
    return json({ status: "REVIEW_PENDING" }, { status: 202 });
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
    const body = await request.json().catch(() => ({}));
    let resetRequest;
    try {
      resetRequest = await passwordResetRequestForClient(body);
    } catch {
      return badRequest("Solicitacao indisponivel.", "PASSWORD_RESET_UNAVAILABLE");
    }
    if (resetRequest.status !== "VERIFIED") {
      return badRequest("A verificacao facial ainda nao foi aprovada.", "PASSWORD_RESET_NOT_VERIFIED");
    }
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).{8,128}$/.test(String(body.newPassword || ""))) {
      return badRequest("Use no minimo 8 caracteres, com letra maiuscula, minuscula e numero.", "WEAK_PASSWORD");
    }
    const account = state.users[resetRequest.username];
    if (!account) return badRequest("Solicitacao indisponivel.", "PASSWORD_RESET_UNAVAILABLE");
    account.passwordCredential = await createPasswordCredential(body.newPassword);
    revokeUserSessions(account.username);
    resetRequest.consumedAt = now();
    transitionPasswordReset(resetRequest, "CONSUMED", account.username, "Senha substituida e sessoes anteriores revogadas.");
    return json({ status: "CONSUMED" });
  }

  if (request.method === "POST" && path === "/auth/register/availability") {
    const body = await request.json().catch(() => ({}));
    if (!isMobileRegistrationClient(request, body)) {
      return json({ message: "A abertura de conta esta disponivel somente no app mobile Bravus Bank.", code: "MOBILE_APP_REQUIRED" }, { status: 403 });
    }
    const availability = registrationAvailability(body);
    const recorded = await recordRegistrationCheck(request, availability);
    if (recorded.rateLimited) {
      return json({ message: "Muitas verificacoes. Aguarde antes de tentar novamente.", code: "RATE_LIMITED" }, { status: 429 });
    }
    const { identity, ...publicAvailability } = availability;
    return json(publicAvailability, { headers: { "cache-control": "no-store" } });
  }

  if (request.method === "POST" && path === "/auth/register/face-check") {
    const body = await request.json().catch(() => ({}));
    if (!isMobileRegistrationClient(request, body)) {
      return json({ message: "A abertura de conta esta disponivel somente no app mobile Bravus Bank.", code: "MOBILE_APP_REQUIRED" }, { status: 403 });
    }
    const availability = registrationAvailability(body);
    const recorded = await recordRegistrationCheck(request, availability);
    if (recorded.rateLimited) {
      return json({ message: "Muitas verificacoes. Aguarde antes de tentar novamente.", code: "RATE_LIMITED" }, { status: 429 });
    }
    if (!availability.available) {
      const { identity, ...publicAvailability } = availability;
      return json(publicAvailability, { status: 409, headers: { "cache-control": "no-store" } });
    }
    if (String(body.biometricChallenge || "") !== "FACE_CAMERA_CAPTURE_V1") {
      return badRequest("Desafio de captura facial invalido.", "REGISTRATION_FACE_CHALLENGE_INVALID");
    }
    const face = imageEvidence(body.faceImage, "Biometria facial", 2500, 240, 240);
    if (!face.ok) return badRequest(face.message, "REGISTRATION_FACE_INVALID");

    const token = randomToken(32);
    const tokenHash = await sha256Text(token);
    const faceSha256 = await sha256Text(String(body.faceImage));
    const createdAt = now();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    state.registrationFaceChecks = state.registrationFaceChecks
      .filter((item) => new Date(item.expiresAt).getTime() > Date.now())
      .slice(0, 199);
    state.registrationFaceChecks.unshift({
      id: crypto.randomUUID(), tokenHash, subjectHash: recorded.subjectHash, faceSha256,
      status: "VALIDATED", createdAt, expiresAt,
      quality: { mime: face.mime, bytes: face.bytes, width: face.width, height: face.height },
    });
    state.registrationAudit.unshift({
      id: crypto.randomUUID(), eventType: "FACE_CAPTURE_VALIDATED", actor: "PUBLIC_MOBILE",
      subjectHash: recorded.subjectHash, detail: "Captura e resolucao validadas automaticamente.", createdAt,
    });
    state.registrationAudit = state.registrationAudit.slice(0, 500);
    return json({
      status: "CAPTURE_VALIDATED",
      faceVerificationToken: token,
      expiresAt,
      message: "Captura facial validada automaticamente.",
    }, { headers: { "cache-control": "no-store" } });
  }

  if (request.method === "POST" && path === "/auth/register") {
    const body = await request.json().catch(() => ({}));
    if (!isMobileRegistrationClient(request, body)) {
      return json({ message: "A abertura de conta esta disponivel somente no app mobile Bravus Bank.", code: "MOBILE_APP_REQUIRED" }, { status: 403 });
    }
    const availability = registrationAvailability(body);
    const recorded = await recordRegistrationCheck(request, availability);
    if (recorded.rateLimited) {
      return json({ message: "Muitas verificacoes. Aguarde antes de tentar novamente.", code: "RATE_LIMITED" }, { status: 429 });
    }
    if (!availability.available) {
      const { identity, ...publicAvailability } = availability;
      return json(publicAvailability, { status: 409, headers: { "cache-control": "no-store" } });
    }
    const { cpf: normalizedCpf, username, email } = availability.identity;
    const fullName = String(body.fullName || "").trim();
    if (fullName.length < 5) {
      return badRequest("Informe o nome completo do titular.", "REGISTRATION_FULL_NAME_REQUIRED");
    }
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).{8,128}$/.test(String(body.password || ""))) {
      return badRequest(
        "Use no minimo 8 caracteres, com letra maiuscula, minuscula e numero.",
        "WEAK_PASSWORD",
      );
    }
    if (!body.faceVerificationToken) {
      return badRequest("Valide a captura facial antes de concluir o cadastro.", "REGISTRATION_FACE_VERIFICATION_REQUIRED");
    }
    const faceCheck = await validatedRegistrationFaceCheck(body);
    if (!faceCheck) {
      return badRequest("A validacao facial expirou ou nao corresponde a este cadastro. Capture novamente.", "REGISTRATION_FACE_VERIFICATION_INVALID");
    }
    const kycAnalysis = buildKycAnalysis({ ...body, cpf: normalizedCpf }, null);
    if (kycAnalysis.status !== "EVIDENCIA_CAPTURADA_AUTO") {
      return badRequest(kycAnalysis.errorMessage || "Envie frente, verso do documento e capture a biometria facial.", "REGISTRATION_EVIDENCE_INVALID");
    }
    let documentFront;
    let documentBack;
    let enrolledFace;
    try {
      documentFront = await stageBiometricEvidence({ value: body.documentFrontImage, kind: "KYC_DOCUMENT_FRONT", username });
      documentBack = await stageBiometricEvidence({ value: body.documentBackImage, kind: "KYC_DOCUMENT_BACK", username });
      enrolledFace = await stageBiometricEvidence({ value: body.faceImage, kind: "ENROLLED_FACE", username });
    } catch (error) {
      pendingBiometricWrites = [];
      return json({ message: "Nao foi possivel proteger as evidencias de abertura.", code: error.message }, { status: 503 });
    }
    const user = {
      ...joao,
      id: Math.max(...Object.values(state.users).map((item) => item.id)) + 1,
      username,
      email: email || ("cliente" + normalizedCpf.slice(-4) + "@bravusbank.com"),
      fullName,
      cpf: normalizedCpf,
      phone: String(body.phone || "").replace(/\\D/g, ""),
      accountNumber: accountNumberForDocument(normalizedCpf),
      balance: 0,
      roles: ["ROLE_USER"],
      statusKyc: "PENDENTE_VALIDACAO_IDENTIDADE",
      kycAnalysisId: kycAnalysis.id,
      passwordCredential: await createPasswordCredential(body.password),
    };
    kycAnalysis.subjectName = user.fullName;
    state.users[user.username] = user;
    state.documentAnalyses.unshift(kycAnalysis);
    state.kycEvidence[user.username] = {
      analysisId: kycAnalysis.id,
      documentType: kycAnalysis.documentType,
      documentNumber: kycAnalysis.documentNumber,
      biometricStatus: kycAnalysis.biometricStatus,
      evidence: kycAnalysis.evidence,
      documentFrontEvidenceId: documentFront.id,
      documentBackEvidenceId: documentBack.id,
      faceEvidenceId: enrolledFace.id,
      faceSha256: enrolledFace.sha256,
      createdAt: kycAnalysis.createdAt,
    };
    faceCheck.status = "CONSUMED";
    faceCheck.consumedAt = now();
    state.registrationAudit.unshift({
      id: crypto.randomUUID(), eventType: "ACCOUNT_CREATED", actor: user.username,
      subjectHash: recorded.subjectHash, detail: "Conta criada apos disponibilidade e captura validadas.", createdAt: now(),
    });
    state.registrationAudit = state.registrationAudit.slice(0, 500);
    const token = createSession(user);
    return json(authResponse(user, token));
  }

  const user = userFromToken(request);
  if (!user) return json({ message: "Unauthorized" }, { status: 401 });

  enforceFinancialConsistency("AUTHENTICATED_REQUEST");

  if (request.method === "GET" && path === "/user/profile") return json(userSummary(user));
  if (request.method === "GET" && path === "/user/me") return json(bankMe(user));
  if (request.method === "GET" && path === "/user/balance") return json(user.balance);
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
    const idempotencyKey = String(request.headers.get("idempotency-key") || body.idempotencyKey || "").trim();
    if (idempotencyKey.length < 16 || idempotencyKey.length > 150) {
      return badRequest("Informe uma chave de idempotencia valida para a transferencia.", "IDEMPOTENCY_KEY_REQUIRED");
    }
    const idempotencyFingerprint = [
      user.username, amount, body.channel || "PIX", body.beneficiaryDocument || "", body.pixKey || "",
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
          channel: body.channel || "PIX",
          idempotencyKey,
          source: "USER_EXTERNAL_TRANSFER",
        });
        return json(result.order);
      } catch (error) {
        if (error.message === "INSUFFICIENT_BALANCE") return json("Saldo contabil do usuario insuficiente.", { status: 400 });
        return json(error.message, { status: 400 });
      }
    }
    if (availableCreditFor(user) < amount) return json("Saldo escritural liberado insuficiente.", { status: 400 });
    if (user.balance < amount) return json("Saldo contabil do usuario insuficiente.", { status: 400 });
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
      channel: body.channel || "PIX",
      currency: "BRL",
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
    if (path === "/user/withdraw" && user.balance < amount) {
      return badRequest("Saldo contabil insuficiente para concluir a operacao.", "INSUFFICIENT_BALANCE", { balanceCentavos: user.balance });
    }
    let destination = null;
    if (path === "/user/transfer") {
      const destinationRaw = body.destinationAccount || body.pixKey || body.accountNumber || "";
      destination = findTransferDestination(destinationRaw);
      if (!destination) {
        const raw = String(destinationRaw || "").trim();
        const rawDigits = digits(raw);
        const pixKeyType = body.pixKeyType || (raw.includes("@") ? "EMAIL" : rawDigits.length === 11 ? "CPF" : rawDigits.length === 14 ? "CNPJ" : "EVP");
        const externalBody = {
          ...body,
          channel: body.channel || "PIX",
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
          channel: body.channel || "PIX",
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
        if (error.message === "INSUFFICIENT_BALANCE") {
          return badRequest("Saldo contabil insuficiente para concluir a transferencia.", "INSUFFICIENT_BALANCE", { balanceCentavos: user.balance });
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
        channel: body.channel || "PIX",
        currency: "BRL",
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

  if (request.method === "GET" && path === "/admin/persistence/status") {
    const ledger = validateSitesLedger();
    return json({
      ...persistenceMeta,
      buildTarget,
      durable: true,
      userCount: Object.keys(state.users).length,
      transactionCount: state.transactions.length,
      ledgerEntryCount: state.ledgerEntries.length,
      ledgerValid: ledger.valid,
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
    if (!account || !evidence?.documentFrontEvidenceId || !evidence?.documentBackEvidenceId || !evidence?.faceEvidenceId) {
      return json({ message: "Evidencias de abertura indisponiveis." }, { status: 404 });
    }
    try {
      const [documentFront, documentBack, face] = await Promise.all([
        decryptBiometricEvidence(evidence.documentFrontEvidenceId, "KYC_DOCUMENT_FRONT"),
        decryptBiometricEvidence(evidence.documentBackEvidenceId, "KYC_DOCUMENT_BACK"),
        decryptBiometricEvidence(evidence.faceEvidenceId, "ENROLLED_FACE"),
      ]);
      return json({
        username: account.username,
        fullName: account.fullName,
        maskedCpf: maskCpf(account.cpf),
        statusKyc: account.statusKyc,
        documentFront,
        documentBack,
        face,
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
      .filter((item) => item.status === "REVIEW_PENDING" && new Date(item.expiresAt).getTime() > Date.now())
      .map((item) => {
        const account = state.users[item.username];
        return {
          requestId: item.requestId,
          fullName: account?.fullName || "Cliente protegido",
          maskedCpf: maskCpf(account?.cpf),
          status: item.status,
          attempts: item.attempts,
          createdAt: item.createdAt,
          expiresAt: item.expiresAt,
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
    if (!resetRequest || resetRequest.status !== "REVIEW_PENDING") {
      return badRequest("Solicitacao nao esta aguardando revisao.", "PASSWORD_RESET_INVALID_STATE");
    }
    if (reason.length < 10 || reason.length > 500) {
      return badRequest("Registre um motivo entre 10 e 500 caracteres.", "PASSWORD_RESET_REASON_INVALID");
    }
    const next = resetReviewMatch[2] === "approve" ? "VERIFIED" : "REJECTED";
    resetRequest.reviewedBy = user.username;
    resetRequest.reviewReason = reason;
    resetRequest.reviewedAt = now();
    transitionPasswordReset(resetRequest, next, user.username, reason);
    return json({ requestId: resetRequest.requestId, status: passwordResetPublicStatus(resetRequest.status) });
  }

  if (request.method === "GET" && path === "/admin/dashboard") {
    const users = Object.values(state.users);
    return json({ totalUsers: users.length, activeUsers: users.length, totalTransactions: state.transactions.length, totalBalance: users.reduce((sum, item) => sum + item.balance, 0) });
  }
  if (request.method === "GET" && path === "/admin/users") return json(Object.values(state.users).map(userSummary));
  if (request.method === "GET" && path === "/admin/transactions") {
    return json(state.transactions.map((tx) => hydrateTransaction(tx, state.users[tx.username] || user)));
  }
  if (request.method === "GET" && path === "/admin/ledger/balance-sheet") {
    const totalClientBalances = Object.values(state.users).reduce((sum, item) => sum + Number(item.balance || 0), 0);
    const ledgerNet = state.ledgerEntries.reduce((sum, entry) => sum + Number(entry.signedAmountCentavos || 0), 0);
    return json({ totalAssets: totalClientBalances, totalLiabilities: totalClientBalances, equity: 0, ledgerNet, reserves: [] });
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
    const idempotencyKey = String(request.headers.get("idempotency-key") || body.idempotencyKey || "").trim();
    if (idempotencyKey.length < 16 || idempotencyKey.length > 150) {
      return badRequest("Informe uma chave de idempotencia valida para a transferencia.", "IDEMPOTENCY_KEY_REQUIRED");
    }
    const idempotencyFingerprint = [
      origin.username, amount, body.channel || "PIX", body.beneficiaryDocument || "", body.pixKey || "",
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
          channel: body.channel || "PIX",
          idempotencyKey,
          source: "ADMIN",
        });
        return json(result.order);
      } catch (error) {
        if (error.message === "INSUFFICIENT_BALANCE") return json("Saldo contabil do usuario insuficiente.", { status: 400 });
        return json(error.message, { status: 400 });
      }
    }
    if (availableCreditFor(origin) < amount) return json("Saldo escritural liberado insuficiente.", { status: 400 });
    if (origin.balance < amount) return json("Saldo contabil do usuario insuficiente.", { status: 400 });
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
      channel: body.channel || "PIX",
      currency: "BRL",
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
      country: String(body.country || "KY").toUpperCase().slice(0, 2),
      network,
      bankCode: body.bankCode || null,
      ispb: body.ispb || null,
      swiftBic: body.swiftBic || null,
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
  if (request.method === "GET" && path === "/admin/cayman-rail/config") return json({ enabled: false, jurisdiction: "Cayman Islands" });
  if (request.method === "GET" && path === "/admin/cayman-rail/readiness") return json({ ready: false, message: "Conector real nao configurado no ChatGPT Sites." });
  if (request.method === "GET" && path === "/admin/cayman-rail/participants") return json([]);
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
