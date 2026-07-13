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

const files = {};
for (const file of await walk(distDir)) {
  const route = `/${relative(distDir, file).replaceAll("\\", "/")}`;
  const type = contentTypes[extname(file).toLowerCase()] || "application/octet-stream";
  files[route] = { type, body: (await readFile(file)).toString("base64") };
}
files["/"] = files["/index.html"];

const entrypoint = `const buildTarget = "bravus-sites-api-v8";
const files = ${JSON.stringify(files)};
const now = () => new Date().toISOString();
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
  users: { joao, admin },
  transactions: [],
  externalTransfers: [],
  globalRailParticipants: [{
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
    isActive: true,
    createdAt: "2026-07-12T00:00:00-03:00",
  };
}

function authResponse(user) {
  return {
    token: user.roles.includes("ROLE_ADMIN") ? "sites-admin-token" : "sites-joao-token",
    username: user.username,
    email: user.email,
    fullName: user.fullName,
    accountNumber: user.accountNumber,
    balance: user.balance,
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
      statusKyc: "APROVADO_AUTO",
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
    payer: {
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
    },
    beneficiary: {
      name: order.beneficiaryName,
      document: order.beneficiaryDocument,
      bankName: null,
      bankCode: order.bankCode,
      ispb: order.ispb,
      agency: order.agency,
      accountNumber: order.accountNumber,
      accountDigit: order.accountDigit,
      accountType: order.accountType,
      pixKey: order.pixKey,
      pixKeyType: order.pixKeyType,
    },
  };
}

function userFromToken(request) {
  const auth = request.headers.get("authorization") || "";
  if (auth.includes("sites-admin-token")) return state.users.admin;
  if (auth.includes("sites-joao-token")) return state.users.joao;
  return null;
}

function publicLoginMatches(user, username) {
  const normalized = String(username || "").replace(/\\D/g, "");
  const raw = String(username || "").trim().toLowerCase();
  return raw === user.username.toLowerCase()
    || raw === user.email.toLowerCase()
    || (user.cpf && normalized === user.cpf);
}

function hasKycEvidence(body) {
  return Boolean(body.documentFrontImage && body.documentBackImage && body.faceImage);
}

async function handleApi(request) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\\/api/, "");

  if (request.method === "OPTIONS") return new Response(null, { status: 204 });

  if (request.method === "POST" && path === "/auth/login") {
    const body = await request.json().catch(() => ({}));
    const user = [state.users.joao, state.users.admin].find((item) => publicLoginMatches(item, body.username));
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
    if (!hasKycEvidence(body)) {
      return json("Envie frente, verso do documento e capture a biometria facial.", { status: 400 });
    }
    const user = {
      ...joao,
      id: 3,
      username: body.username || "novo.cliente",
      email: body.email || "cliente@bravusbank.com",
      fullName: body.fullName || "Novo Cliente",
      cpf: String(body.cpf || "").replace(/\\D/g, ""),
      accountNumber: "1000000001",
      balance: 0,
      roles: ["ROLE_USER"],
      statusKyc: "VERIFICADO",
    };
    return json(authResponse(user));
  }

  const user = userFromToken(request);
  if (!user) return json({ message: "Unauthorized" }, { status: 401 });

  if (request.method === "GET" && path === "/user/profile") return json(userSummary(user));
  if (request.method === "GET" && path === "/user/me") return json(bankMe(user));
  if (request.method === "GET" && path === "/user/balance") return json(user.balance);
  if (request.method === "GET" && path === "/user/transactions") return json(state.transactions.filter((tx) => tx.username === user.username));
  if (request.method === "GET" && path === "/credit/summary") return json(creditSummary(user));
  if (request.method === "GET" && path.startsWith("/user/external-transfers")) {
    const receiptMatch = path.match(/^\\/user\\/external-transfers\\/(\\d+)\\/receipt$/);
    if (receiptMatch) {
      const order = state.externalTransfers.find((tx) => tx.id === Number(receiptMatch[1]) && tx.username === user.username);
      if (!order) return json("Transferencia nao encontrada para este usuario.", { status: 404 });
      return json(receiptForOrder(order, user));
    }
    return json(state.externalTransfers.filter((tx) => tx.username === user.username));
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
      if (user.balance < amount) return json("Saldo contabil do usuario insuficiente.", { status: 400 });
      user.balance -= amount;
      bravusDestination.balance += amount;
      consumeCreditIfAvailable(user, amount);
      const tx = {
        id: state.transactions.length + 1,
        username: user.username,
        type: "TRANSFER_OUT",
        amount,
        description: body.description || "Transferencia interna Bravus",
        destinationAccount: bravusDestination.accountNumber,
        status: "COMPLETED",
        createdAt: now(),
      };
      state.transactions.unshift(tx);
      state.transactions.unshift({
        id: state.transactions.length + 1,
        username: bravusDestination.username,
        type: "TRANSFER_IN",
        amount,
        description: body.description || "Transferencia recebida Bravus",
        destinationAccount: user.accountNumber,
        status: "COMPLETED",
        createdAt: now(),
      });
      const idempotencyKey = "sites-bravus-internal-" + Date.now();
      const order = {
        id: state.externalTransfers.length + 1,
        username: user.username,
        transactionId: tx.id,
        amountCentavos: amount,
        channel: body.channel || "PIX",
        currency: "BRL",
        beneficiaryName: bravusDestination.fullName,
        beneficiaryDocument: bravusDestination.cpf,
        bankCode: "999",
        ispb: "99999999",
        agency: "0001",
        accountNumber: bravusDestination.accountNumber,
        accountDigit: null,
        accountType: bravusDestination.accountType,
        pixKey: bravusDestination.cpf || bravusDestination.email,
        pixKeyType: bravusDestination.cpf ? "CPF" : "EMAIL",
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
        settlementMessage: "Liquidacao interna confirmada no ledger Bravus, sem uso de Celcoin.",
        errorMessage: null,
        rawResponse: "{\\"provider\\":\\"BRAVUS_INTERNAL_LEDGER\\",\\"status\\":\\"COMPLETED\\",\\"settlement\\":\\"INTERNAL_LEDGER\\"}",
        createdAt: now(),
      };
      state.externalTransfers.unshift(order);
      return json(order);
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
    const order = {
      id: state.externalTransfers.length + 1,
      username: user.username,
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
    state.externalTransfers.unshift(order);
    return json(order);
  }

  if (request.method === "POST" && ["/user/deposit", "/user/withdraw", "/user/transfer"].includes(path)) {
    const body = await request.json().catch(() => ({}));
    const amount = Number(body.amount || body.amountCentavos || 0);
    if (!amount || amount <= 0) return badRequest("Digite um valor valido.", "INVALID_AMOUNT");
    if (path !== "/user/deposit" && user.balance < amount) {
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
        const order = {
          id: state.externalTransfers.length + 1,
          username: user.username,
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
        state.externalTransfers.unshift(order);
        return json(order);
      }
      if (destination.username === user.username) {
        return badRequest("Nao e permitido transferir para a propria conta Bravus.", "SELF_TRANSFER");
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
    if (destination) {
      state.transactions.unshift({
        id: state.transactions.length + 1,
        username: destination.username,
        type: "TRANSFER_IN",
        amount,
        description: body.description || "Transferencia recebida ChatGPT Sites",
        destinationAccount: user.accountNumber,
        status: "COMPLETED",
        createdAt: now(),
      });
    }
    return json({
      message: destination ? "Transferencia interna Bravus liquidada." : "Operacao realizada.",
      status: "COMPLETED",
      provider: destination ? "BRAVUS_INTERNAL_LEDGER" : "BRAVUS_SITES_LEDGER",
      settlementStatus: destination ? "LIQUIDADA_CONFIRMADA" : "COMPLETED",
      balanceCentavos: user.balance,
      transaction: tx,
      destination: destination ? userSummary(destination) : null,
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
  if (request.method === "GET" && path === "/admin/transactions") return json(state.transactions);
  if (request.method === "GET" && path === "/admin/ledger/balance-sheet") return json({ totalAssets: 0, totalLiabilities: 0, equity: 0, reserves: [] });
  if (request.method === "GET" && path === "/admin/ledger/validate-chain") return json({ valid: true, message: "Ledger demonstrativo do ChatGPT Sites." });
  if (request.method === "GET" && path.startsWith("/admin/ledger/entries")) return json({ content: [] });
  if (request.method === "GET" && path.startsWith("/admin/analysis/document")) return json([]);
  if (request.method === "POST" && path === "/admin/analysis/document") return json({ status: "ANALISADO_AUTOMATICAMENTE", provider: "BRAVUS_SITES" });
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
      if (origin.balance < amount) return json("Saldo contabil do usuario insuficiente.", { status: 400 });
      origin.balance -= amount;
      bravusDestination.balance += amount;
      consumeCreditIfAvailable(origin, amount);
      const tx = {
        id: state.transactions.length + 1,
        username: origin.username,
        type: "TRANSFER_OUT",
        amount,
        description: body.description || "Transferencia interna admin Bravus",
        destinationAccount: bravusDestination.accountNumber,
        status: "COMPLETED",
        createdAt: now(),
      };
      state.transactions.unshift(tx);
      state.transactions.unshift({
        id: state.transactions.length + 1,
        username: bravusDestination.username,
        type: "TRANSFER_IN",
        amount,
        description: body.description || "Transferencia recebida Bravus",
        destinationAccount: origin.accountNumber,
        status: "COMPLETED",
        createdAt: now(),
      });
      const idempotencyKey = "sites-admin-bravus-internal-" + Date.now();
      const order = {
        id: state.externalTransfers.length + 1,
        username: origin.username,
        transactionId: tx.id,
        amountCentavos: amount,
        channel: body.channel || "PIX",
        currency: "BRL",
        beneficiaryName: bravusDestination.fullName,
        beneficiaryDocument: bravusDestination.cpf,
        bankCode: "999",
        ispb: "99999999",
        agency: "0001",
        accountNumber: bravusDestination.accountNumber,
        accountDigit: null,
        accountType: bravusDestination.accountType,
        pixKey: bravusDestination.cpf || bravusDestination.email,
        pixKeyType: bravusDestination.cpf ? "CPF" : "EMAIL",
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
        settlementMessage: "Liquidacao interna confirmada no ledger Bravus, sem uso de Celcoin.",
        errorMessage: null,
        rawResponse: "{\\"provider\\":\\"BRAVUS_INTERNAL_LEDGER\\",\\"status\\":\\"COMPLETED\\",\\"settlement\\":\\"INTERNAL_LEDGER\\"}",
        createdAt: now(),
      };
      state.externalTransfers.unshift(order);
      return json(order);
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
    const order = {
      id: state.externalTransfers.length + 1,
      username: origin.username,
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
    return json({
      query,
      queryType: query.replace(/\\D/g, "").length === 11 ? "CPF" : "GERAL",
      normalizedQuery: query.replace(/\\D/g, "") || query,
      resultCount: query.includes("055") || query.toLowerCase().includes("joao") ? 1 : 0,
      summary: { users: 1, transactions: 0, other: 0 },
      warnings: ["Consulta demonstrativa do ChatGPT Sites; backend Spring continua sendo a fonte local completa."],
      results: query.includes("055") || query.toLowerCase().includes("joao") ? [{ source: "USERS", kind: "CLIENTE", title: joao.fullName, status: "ATIVO", fields: userSummary(joao) }] : [],
    });
  }

  return json({ message: "Endpoint not available in ChatGPT Sites demo" }, { status: 404 });
}

export default {
  fetch(request) {
    if (new URL(request.url).pathname.startsWith("/api/")) return handleApi(request);
    const file = files[routePath(request.url)];
    if (!file) return new Response("Not found", { status: 404 });
    return new Response(bytesFromBase64(file.body), { headers: { "content-type": file.type } });
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
  bytes: archive.size,
}, null, 2));
