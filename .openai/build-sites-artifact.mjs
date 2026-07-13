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

const entrypoint = `const files = ${JSON.stringify(files)};
const now = () => new Date().toISOString();
const joao = {
  id: 2,
  username: "joao.victor",
  email: "pulmaturcruzeiros@gmail.com",
  fullName: "Joao Victor Mendonça Guimaraes",
  cpf: "05569161155",
  phone: "",
  accountNumber: "0556916115",
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
  users: { joao, admin },
  transactions: [],
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
    };
    return json(authResponse(user));
  }

  const user = userFromToken(request);
  if (!user) return json({ message: "Unauthorized" }, { status: 401 });

  if (request.method === "GET" && path === "/user/profile") return json(userSummary(user));
  if (request.method === "GET" && path === "/user/me") return json(bankMe(user));
  if (request.method === "GET" && path === "/user/balance") return json(user.balance);
  if (request.method === "GET" && path === "/user/transactions") return json(state.transactions.filter((tx) => tx.username === user.username));

  if (request.method === "POST" && ["/user/deposit", "/user/withdraw", "/user/transfer"].includes(path)) {
    const body = await request.json().catch(() => ({}));
    const amount = Number(body.amount || 0);
    if (!amount || amount <= 0) return json("Digite um valor valido.", { status: 400 });
    if (path !== "/user/deposit" && user.balance < amount) return json("Insufficient balance", { status: 400 });
    if (path === "/user/deposit") user.balance += amount;
    if (path !== "/user/deposit") user.balance -= amount;
    const tx = {
      id: state.transactions.length + 1,
      username: user.username,
      type: path === "/user/deposit" ? "DEPOSIT" : path === "/user/withdraw" ? "WITHDRAWAL" : "TRANSFER_OUT",
      amount,
      description: body.description || "Operacao ChatGPT Sites",
      destinationAccount: body.destinationAccount || null,
      status: "COMPLETED",
      createdAt: now(),
    };
    state.transactions.unshift(tx);
    return json("Operacao realizada. New balance: " + user.balance);
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
  if (request.method === "GET" && path.startsWith("/admin/ledger/external-transfers")) return json([]);
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
