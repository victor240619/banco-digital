import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, extname, join, relative, resolve } from "node:path";
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
    return {
      capturedAt: new Date().toISOString(),
      source: snapshotUrl,
      users: usersByUsername,
      transactions: Array.isArray(transactions) ? transactions : [],
      externalTransfers: Array.isArray(externalTransfers) ? externalTransfers : [],
      globalRailParticipants: Array.isArray(globalRailParticipants) ? globalRailParticipants : [],
      ledgerEntries: ledgerList,
    };
  } catch (error) {
    console.warn(`Sites live snapshot unavailable: ${error.message}`);
    return {
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

const entrypoint = `const buildTarget = "bravus-sites-api-v13";
const files = ${JSON.stringify(files)};
const liveSeed = ${JSON.stringify(liveSeed)};
const now = () => new Date().toISOString();
const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, PUT, DELETE, OPTIONS",
  "access-control-allow-headers": "authorization, content-type, x-bravus-client, idempotency-key",
  "access-control-max-age": "86400",
};
const joaoCreditGrant = {
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
const state = globalThis.__bravusState || (globalThis.__bravusState = {
  users: { [joao.username]: joao, [francisca.username]: francisca, [admin.username]: admin, ...(liveSeed.users || {}) },
  transactions: Array.isArray(liveSeed.transactions) ? [...liveSeed.transactions] : [],
  externalTransfers: Array.isArray(liveSeed.externalTransfers) ? [...liveSeed.externalTransfers] : [],
  ledgerEntries: Array.isArray(liveSeed.ledgerEntries) ? [...liveSeed.ledgerEntries] : [],
  ledgerAudit: [],
  documentAnalyses: [],
  kycEvidence: {},
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
});
state.users[joao.username] = { ...joao, ...(state.users[joao.username] || {}) };
state.users[francisca.username] = { ...francisca, ...(state.users[francisca.username] || {}) };
state.users[admin.username] = { ...admin, ...(state.users[admin.username] || {}) };
if (state.users[joao.username] && state.users[joao.username].balance < joaoCreditGrant.valorConcedido) {
  joaoCreditGrant.valorUsado = Math.max(joaoCreditGrant.valorUsado, joaoCreditGrant.valorConcedido - state.users[joao.username].balance);
  joaoCreditGrant.valorDisponivel = Math.max(0, joaoCreditGrant.valorConcedido - joaoCreditGrant.valorUsado);
}
state.documentAnalyses = Array.isArray(state.documentAnalyses) ? state.documentAnalyses : [];
state.kycEvidence = state.kycEvidence || {};
state.ledgerEntries = Array.isArray(state.ledgerEntries) ? state.ledgerEntries : [];
state.ledgerAudit = Array.isArray(state.ledgerAudit) ? state.ledgerAudit : [];

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

function authResponse(user) {
  return {
    token: tokenForUser(user),
    username: user.username,
    email: user.email,
    fullName: user.fullName,
    accountNumber: user.accountNumber,
    balance: user.balance,
    statusKyc: user.statusKyc || "APROVADO_AUTO",
    roles: user.roles,
  };
}

function tokenForUser(user) {
  if (user.roles.includes("ROLE_ADMIN")) return "sites-admin-token";
  if (user.username === joao.username) return "sites-joao-token";
  return "sites-user-" + user.id + "-token";
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
  if (previousOrder) {
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

enforceFinancialConsistency("BOOTSTRAP");

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
  return Object.values(state.users).find((item) => token === tokenForUser(item)) || null;
}

function publicLoginMatches(user, username) {
  const normalized = String(username || "").replace(/\\D/g, "");
  const raw = String(username || "").trim().toLowerCase();
  return raw === user.username.toLowerCase()
    || raw === user.email.toLowerCase()
    || (user.cpf && normalized === user.cpf);
}

function imageEvidence(value, label, minBytes) {
  const raw = String(value || "");
  const match = raw.match(/^data:(image\\/(jpeg|png));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return { label, ok: false, present: Boolean(raw), message: label + " deve ser imagem JPEG ou PNG em base64." };
  const base64 = match[3];
  const bytes = Math.floor((base64.length * 3) / 4);
  return {
    label,
    ok: bytes >= minBytes,
    present: true,
    mime: match[1],
    bytes,
    fingerprint: match[1] + ":" + bytes + ":" + base64.slice(0, 24),
    message: bytes >= minBytes ? null : label + " esta muito pequena para analise.",
  };
}

function buildKycAnalysis(body, user) {
  const documentNumber = digits(body.cpf || body.document || user?.cpf);
  const documentType = documentTypeFor(body.type, documentNumber);
  const front = imageEvidence(body.documentFrontImage, "Frente do documento", 3500);
  const back = imageEvidence(body.documentBackImage, "Verso do documento", 3500);
  const face = imageEvidence(body.faceImage, "Biometria facial", 2500);
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
    status: evidenceOk ? "APROVADO_AUTO" : "REJEITADO_EVIDENCIA_INSUFICIENTE",
    riskLevel: evidenceOk ? "BAIXO" : "ALTO",
    riskScore: evidenceOk ? (documentChecksumOk ? 7 : 18) : 92,
    provider: "BRAVUS_SELF_KYC_SITES",
    subjectName: body.fullName || user?.fullName || "Titular informado",
    registrationStatus: documentChecksumOk ? "DOCUMENTO_COM_EVIDENCIA_KYC" : "DOCUMENTO_COM_EVIDENCIA_PENDENTE_VALIDACAO_OFICIAL",
    biometricStatus: face.ok ? "FACE_CAPTURADA" : "FACE_AUSENTE",
    biometricChallenge: body.biometricChallenge || "FACE_CAMERA_CAPTURE_V1",
    evidence: {
      documentFront: { present: front.present, mime: front.mime || null, bytes: front.bytes || 0 },
      documentBack: { present: back.present, mime: back.mime || null, bytes: back.bytes || 0 },
      face: { present: face.present, mime: face.mime || null, bytes: face.bytes || 0 },
    },
    errorMessage: evidenceOk ? null : messages.join(" "),
    createdAt: now(),
  };
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

async function handleApi(request) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\\/api/, "");

  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  if (request.method === "POST" && path === "/auth/login") {
    const body = await request.json().catch(() => ({}));
    const user = Object.values(state.users).find((item) => publicLoginMatches(item, body.username));
    if (!user || body.password !== "6run0955") {
      return json("Invalid username or password", { status: 400 });
    }
    return json(authResponse(user));
  }

  if (request.method === "POST" && path === "/auth/register") {
    const body = await request.json().catch(() => ({}));
    const client = request.headers.get("x-bravus-client");
    const mobileClient =
      (client === "android-apk" && body.clientChannel === "ANDROID_APK")
      || (client === "ios-app" && body.clientChannel === "IOS_APP")
      || (client === "mobile-app" && body.clientChannel === "MOBILE_APP");
    if (!mobileClient) {
      return json("A abertura de conta esta disponivel somente no app mobile Bravus Bank.", { status: 403 });
    }
    if (String(body.cpf || "").replace(/\\D/g, "").length !== 11) {
      return json("Informe CPF com 11 digitos para abertura de conta.", { status: 400 });
    }
    const normalizedCpf = String(body.cpf || "").replace(/\\D/g, "");
    const kycAnalysis = buildKycAnalysis({ ...body, cpf: normalizedCpf }, null);
    if (kycAnalysis.status !== "APROVADO_AUTO") {
      return json(kycAnalysis.errorMessage || "Envie frente, verso do documento e capture a biometria facial.", { status: 400 });
    }
    const username = String(body.username || "cliente." + normalizedCpf.slice(-4)).trim().toLowerCase();
    const email = String(body.email || "").trim().toLowerCase();
    if (Object.values(state.users).some((item) => item.cpf === normalizedCpf)) {
      return json("CPF ja cadastrado no Bravus.", { status: 400 });
    }
    if (Object.values(state.users).some((item) => item.username.toLowerCase() === username || item.email.toLowerCase() === email)) {
      return json("Usuario ou e-mail ja cadastrado no Bravus.", { status: 400 });
    }
    const user = {
      ...joao,
      id: Math.max(...Object.values(state.users).map((item) => item.id)) + 1,
      username,
      email: email || ("cliente" + normalizedCpf.slice(-4) + "@bravusbank.com"),
      fullName: body.fullName || "Novo Cliente",
      cpf: normalizedCpf,
      phone: String(body.phone || "").replace(/\\D/g, ""),
      accountNumber: accountNumberForDocument(normalizedCpf),
      balance: 0,
      roles: ["ROLE_USER"],
      statusKyc: "APROVADO_AUTO",
      kycAnalysisId: kycAnalysis.id,
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
      createdAt: kycAnalysis.createdAt,
    };
    return json(authResponse(user));
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
  if (request.method === "POST" && path === "/user/external-transfers") {
    const body = await request.json().catch(() => ({}));
    const amount = Number(body.amountCentavos || 0);
    if (!amount || amount <= 0) return json("Digite um valor valido.", { status: 400 });
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
          idempotencyKey: request.headers.get("idempotency-key") || ("sites-bravus-internal-" + Date.now()),
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
    const idempotencyKey = "sites-" + Date.now();
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
    const amount = Number(body.amountCentavos || 0);
    if (!amount || amount <= 0) return json("Digite um valor valido.", { status: 400 });
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
          idempotencyKey: request.headers.get("idempotency-key") || ("sites-admin-bravus-internal-" + Date.now()),
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
    const idempotencyKey = "sites-admin-" + Date.now();
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
      warnings: ["Consulta demonstrativa do ChatGPT Sites; backend Spring continua sendo a fonte local completa."],
      results: matchingUsers.map((item) => ({ source: "USERS", kind: "CLIENTE", title: item.fullName, status: "ATIVO", fields: userSummary(item) })),
    });
  }

  return json({ message: "Endpoint not available in ChatGPT Sites demo" }, { status: 404 });
}

export default {
  fetch(request) {
    if (new URL(request.url).pathname.startsWith("/api/")) return handleApi(request);
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
await tar(["-czf", archivePath, "-C", artifactDir, "."]);

const archive = await stat(archivePath);
console.log(JSON.stringify({
  archive: archivePath,
  archiveName: basename(archivePath),
  files: Object.keys(files).length,
  aliases: Object.values(files).filter((file) => file.alias).length,
  bytes: archive.size,
}, null, 2));
