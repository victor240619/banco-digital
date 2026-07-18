import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Users, Activity, Banknote, TrendingUp, CheckCircle2, AlertCircle,
  Search, Shield, BarChart3, ListChecks, Coins, Link2, Hash, Vault, PiggyBank,
  Send, RefreshCw, ChevronDown, ChevronUp, Landmark, Globe2, KeyRound, ScanFace, Eye, XCircle, UserPlus,
  ArrowLeft, Save, Lock, Unlock,
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
  adminService, analysisService, caymanRailService,
  externalTransferService, globalRailService, kycAdminService, ledgerAdminService, passwordResetAdminService, unifiedSearchService,
} from '../services/api';
import { formatCurrency, formatCurrencyExact, formatDate, getTransactionTypeLabel, reaisToCentavosExact } from '../utils/helpers';
import { cn } from '../lib/cn';

// ============ Helpers ============
const brl = (cents) => formatCurrency(cents ?? 0);
const brlExact = (cents) => formatCurrencyExact(cents ?? '0');
const pct = (n) => `${(n ?? 0).toFixed(1)}%`;
const chainIsValid = (chain) => chain?.valid ?? chain?.valida ?? false;
const chainCount = (chain) => chain?.checkedTransfers ?? chain?.quantidade ?? 0;
const chainMessage = (chain) => chain?.message ?? chain?.mensagem ?? '';
const apiError = (err, fallback) => {
  if (err?.code === 'ERR_NETWORK' || err?.message === 'Network Error') {
    return 'API local nao esta respondendo em http://localhost:9000. Inicie o backend e tente novamente.';
  }
  if (err?.response?.status === 401 || err?.response?.status === 403) {
    return 'Sessao administrativa expirada ou token invalido. Entre novamente como admin.';
  }
  const data = err?.response?.data;
  return data?.message || data || fallback;
};

const KpiCard = ({ icon: Icon, label, value, accent, hint }) => (
  <div className="card-premium p-5">
    <div className="flex items-start justify-between">
      <div className="min-w-0">
        <div className="text-xs uppercase tracking-widest text-ink-400">{label}</div>
        <div className="mt-2 font-display text-2xl font-bold tabular-nums truncate">{value}</div>
        {hint && <div className="mt-1 text-xs text-ink-400">{hint}</div>}
      </div>
      <div className={cn('h-11 w-11 rounded-xl inline-flex items-center justify-center shrink-0', accent)}>
        <Icon className="h-5 w-5" />
      </div>
    </div>
  </div>
);

const RESERVE_COLORS = ['#d49b1c', '#e2b545', '#a07517', '#7a5712', '#fadf95'];

// ============ Componente principal ============
export default function AdminDashboard() {
  const [tab, setTab] = useState('bank');
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [txns, setTxns] = useState([]);
  const [balanceSheet, setBalanceSheet] = useState(null);
  const [entries, setEntries] = useState([]);
  const [chain, setChain] = useState(null);
  const [documentAnalyses, setDocumentAnalyses] = useState([]);
  const [externalTransfers, setExternalTransfers] = useState([]);
  const [globalRailParticipants, setGlobalRailParticipants] = useState([]);
  const [passwordResetRequests, setPasswordResetRequests] = useState([]);
  const [accountRequests, setAccountRequests] = useState([]);
  const [caymanRail, setCaymanRail] = useState({
    config: null,
    readiness: null,
    participants: [],
    instructions: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => { loadAll(); }, []);
  useEffect(() => {
    if (success || error) {
      const t = setTimeout(() => { setSuccess(''); setError(''); }, 4500);
      return () => clearTimeout(t);
    }
  }, [success, error]);

  async function loadAll() {
    setLoading(true);
    try {
      const [d, u, t, bs, ch, en, da, et, grParticipants, crConfig, crReady, crParticipants, crInstructions, resetRequests, openingRequests] = await Promise.all([
        adminService.getDashboard().catch(() => ({ data: null })),
        adminService.getAllUsers().catch(() => ({ data: [] })),
        adminService.getAllTransactions().catch(() => ({ data: [] })),
        ledgerAdminService.balanceSheet().catch(() => ({ data: null })),
        ledgerAdminService.validateChain().catch(() => ({ data: null })),
        ledgerAdminService.entries(0, 30).catch(() => ({ data: { content: [] } })),
        analysisService.recentDocuments(20).catch(() => ({ data: [] })),
        externalTransferService.recent(20).catch(() => ({ data: [] })),
        globalRailService.participants().catch(() => ({ data: [] })),
        caymanRailService.config().catch(() => ({ data: null })),
        caymanRailService.readiness().catch(() => ({ data: null })),
        caymanRailService.participants().catch(() => ({ data: [] })),
        caymanRailService.instructions(20).catch(() => ({ data: [] })),
        passwordResetAdminService.pending().catch(() => ({ data: [] })),
        adminService.getAccountRequests().catch(() => ({ data: [] })),
      ]);
      setStats(d.data);
      setUsers(Array.isArray(u.data) ? u.data : []);
      setTxns(Array.isArray(t.data) ? t.data : []);
      setBalanceSheet(bs.data);
      setChain(ch.data);
      setEntries(en.data?.content || en.data || []);
      setDocumentAnalyses(Array.isArray(da.data) ? da.data : []);
      setExternalTransfers(Array.isArray(et.data) ? et.data : []);
      setGlobalRailParticipants(Array.isArray(grParticipants.data) ? grParticipants.data : []);
      setPasswordResetRequests(Array.isArray(resetRequests.data) ? resetRequests.data : []);
      setAccountRequests(Array.isArray(openingRequests.data) ? openingRequests.data : []);
      setCaymanRail({
        config: crConfig.data,
        readiness: crReady.data,
        participants: Array.isArray(crParticipants.data) ? crParticipants.data : [],
        instructions: Array.isArray(crInstructions.data) ? crInstructions.data : [],
      });
    } catch (e) {
      setError('Erro ao carregar dados administrativos.');
    } finally {
      setLoading(false);
    }
  }

  const filteredUsers = useMemo(() => {
    if (!search) return users;
    const q = search.toLowerCase();
    return users.filter((u) =>
      [u.username, u.email, u.fullName, u.cpf, u.accountNumber]
        .filter(Boolean).some((v) => String(v).toLowerCase().includes(q))
    );
  }, [users, search]);

  const Tab = ({ id, label, icon: Icon }) => (
    <button
      onClick={() => setTab(id)}
      className={cn(
        'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition border',
        tab === id
          ? 'bg-gradient-gold text-[#040f2e] border-transparent shadow-lg shadow-amber-500/20'
          : 'border-white/10 bg-white/5 text-ink-200 hover:bg-white/10'
      )}
    >
      <Icon className="h-4 w-4" /> {label}
    </button>
  );

  return (
    <main className="container-app py-10 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-amber-300" />
            <span className="text-xs uppercase tracking-[0.25em] text-amber-300/80">Painel Administrativo</span>
          </div>
          <h1 className="font-display text-3xl md:text-4xl font-bold mt-1">Bravus Bank · Comando</h1>
          <p className="text-sm text-ink-300 mt-1">
            Controle total do banco — emissão escritural, ledger, reservas e usuários.
          </p>
        </div>
        <button onClick={loadAll} className="btn-secondary !py-2 !px-3" disabled={loading}>
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          Atualizar
        </button>
      </div>

      {/* Alerts */}
      {(success || error) && (
        <div className={cn(
          'flex items-center gap-2 px-4 py-3 rounded-xl border text-sm',
          success
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
            : 'bg-red-500/10 border-red-500/30 text-red-200'
        )}>
          {success ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {success || error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        <Tab id="bank"    label="Balanço do Banco" icon={Vault} />
        <Tab id="users"   label="Usuários"         icon={Users} />
        <Tab id="unifiedSearch" label="Consulta Geral" icon={Search} />
        <Tab id="analysis" label="Analise automatica" icon={Shield} />
        <Tab id="passwordReset" label="Recuperacao de senha" icon={KeyRound} />
        <Tab id="credit"  label="Emissão Escritural" icon={Coins} />
        <Tab id="external" label="Envio Bancario" icon={Send} />
        <Tab id="globalRail" label="Trilho Global" icon={Globe2} />
        <Tab id="cayman" label="Trilho Cayman" icon={Landmark} />
        <Tab id="ledger"  label="Livro Razão"      icon={Link2} />
      </div>

      {/* ===== TAB 1: BALANÇO ===== */}
      {tab === 'bank' && <BankView bs={balanceSheet} chain={chain} stats={stats} />}

      {/* ===== TAB 2: USUÁRIOS ===== */}
      {tab === 'users' && (
        <UsersView
          users={filteredUsers}
          accountRequests={accountRequests}
          search={search} setSearch={setSearch}
          onCreated={(account) => {
            setSuccess(`Conta de ${account.fullName || account.username} criada com validacao de identidade pendente.`);
            loadAll();
          }}
          onChanged={(message) => { setSuccess(message); loadAll(); }}
          onError={setError}
        />
      )}

      {tab === 'unifiedSearch' && (
        <UnifiedSearchView onError={setError} />
      )}

      {tab === 'analysis' && (
        <DocumentAnalysisView
          analyses={documentAnalyses}
          users={users}
          onSuccess={(msg) => { setSuccess(msg); loadAll(); }}
          onError={setError}
        />
      )}

      {tab === 'passwordReset' && (
        <PasswordResetReviewView
          requests={passwordResetRequests}
          onRefresh={loadAll}
          onSuccess={setSuccess}
          onError={setError}
        />
      )}

      {/* ===== TAB 3: CRÉDITO ===== */}
      {tab === 'credit' && (
        <CreditView
          users={users}
          bs={balanceSheet}
          onSuccess={(msg) => { setSuccess(msg); loadAll(); }}
          onError={setError}
        />
      )}

      {tab === 'external' && (
        <ExternalTransferView
          users={users}
          transfers={externalTransfers}
          participants={globalRailParticipants}
          onSuccess={(msg) => { setSuccess(msg); loadAll(); }}
          onError={setError}
        />
      )}

      {tab === 'globalRail' && (
        <GlobalRailView
          participants={globalRailParticipants}
          transfers={externalTransfers}
          onSuccess={(msg) => { setSuccess(msg); loadAll(); }}
          onError={setError}
        />
      )}

      {tab === 'cayman' && (
        <CaymanRailView
          rail={caymanRail}
          users={users}
          onSuccess={(msg) => { setSuccess(msg); loadAll(); }}
          onError={setError}
        />
      )}

      {/* ===== TAB 4: LIVRO RAZÃO ===== */}
      {tab === 'ledger' && <LedgerView entries={entries} chain={chain} />}
    </main>
  );
}

// ===========================================================
// 1) Balanço do banco
// ===========================================================
function ExactBankView({ bs, chain, stats }) {
  const reserve = bs.masterCreditReserve;
  const accounting = bs.accounting;
  const ledgerValid = chainIsValid(chain);
  const balanceValid = accounting?.balanced === true && reserve?.balanced === true;

  return (
    <div className="space-y-6">
      <section className="card-premium p-6" aria-labelledby="master-credit-reserve-title">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-amber-300">
              <Vault className="h-5 w-5" />
              <span className="text-xs uppercase tracking-widest">Reserva Mestre</span>
            </div>
            <h2 id="master-credit-reserve-title" className="mt-3 font-display text-2xl font-bold text-white break-words">
              {brlExact(reserve.totalCentavos)}
            </h2>
            <p className="mt-2 text-sm text-ink-300">Crédito escritural interno destinado exclusivamente a concessões administrativas para clientes avaliados.</p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-lg border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-amber-200">{reserve.status}</span>
            <span className="rounded-lg border border-emerald-400/25 bg-emerald-400/10 px-3 py-2 text-emerald-200">Transferível pelo admin</span>
            <span className="rounded-lg border border-sky-400/25 bg-sky-400/10 px-3 py-2 text-sky-200">Precisão inteira</span>
          </div>
        </div>
      </section>

      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard icon={Vault} label="Disponível para concessão" value={brlExact(reserve.availableCentavos)}
                 accent="bg-emerald-400/15 text-emerald-300" hint="Reserva ainda não comprometida" />
        <KpiCard icon={ListChecks} label="Crédito comprometido" value={brlExact(reserve.committedCentavos)}
                 accent="bg-amber-400/15 text-amber-300" hint="Pendente mais liberado" />
        <KpiCard icon={Banknote} label="Crédito liberado" value={brlExact(reserve.releasedCentavos)}
                 accent="bg-sky-400/15 text-sky-300" hint="Já creditado aos clientes" />
        <KpiCard icon={Users} label="Clientes" value={stats?.totalUsers ?? 0}
                 accent="bg-violet-400/15 text-violet-300" hint={brlExact(accounting.totalLiabilitiesCentavos) + ' em saldos'} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <ExactSheetCard
          title="RESERVA DISPONÍVEL"
          total={reserve.availableCentavos}
          color="text-emerald-300"
          lines={[{ code: reserve.code, name: reserve.name, amountCentavos: reserve.availableCentavos }]}
        />
        <ExactSheetCard
          title="CREDITOS COMPROMETIDOS"
          total={reserve.committedCentavos}
          color="text-amber-300"
          lines={[
            { code: 'MASTER_CREDIT_PENDING', name: 'Em avaliação para liberação', amountCentavos: reserve.pendingCentavos },
            { code: 'MASTER_CREDIT_RELEASED', name: 'Liberados aos clientes', amountCentavos: reserve.releasedCentavos },
          ]}
        />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <KpiCard icon={Link2} label="Saldo do ledger" value={brlExact(accounting.ledgerNetCentavos)}
                 accent={ledgerValid ? 'bg-emerald-400/15 text-emerald-300' : 'bg-red-400/15 text-red-300'}
                 hint={`${chainCount(chain)} transferências conferidas`} />
        <KpiCard icon={Coins} label="Crédito pendente" value={brlExact(reserve.pendingCentavos)}
                 accent="bg-orange-400/15 text-orange-300" hint="Ainda não altera o saldo do cliente" />
      </div>

      <div className={cn(
        'card-premium p-5 flex flex-wrap items-center justify-between gap-3',
        ledgerValid ? 'ring-1 ring-emerald-500/30' : 'ring-1 ring-red-500/30'
      )}>
        <div className="flex items-center gap-3">
          <div className={cn(
            'h-10 w-10 rounded-lg inline-flex items-center justify-center',
            ledgerValid ? 'bg-emerald-400/15 text-emerald-300' : 'bg-red-400/15 text-red-300'
          )}>
            <Hash className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm text-ink-300">Integridade do ledger</div>
            <div className="font-semibold">{ledgerValid ? 'Cadeia válida' : 'Cadeia comprometida'}</div>
          </div>
        </div>
        <div className="max-w-xl text-xs text-ink-400">{chainMessage(chain)}</div>
      </div>

      <div className={cn(
        'card-premium p-4 text-sm text-center',
        balanceValid ? 'text-emerald-300' : 'text-red-300'
      )}>
        {balanceValid
          ? `Reserva conciliada: ${brlExact(reserve.availableCentavos)} disponível + ${brlExact(reserve.committedCentavos)} comprometido`
          : 'Reserva Mestre ou ledger desbalanceado; concessões devem permanecer bloqueadas.'}
      </div>
    </div>
  );
}

function ExactSheetCard({ title, total, lines, color }) {
  return (
    <section className="card-premium p-6">
      <div className="mb-4">
        <h3 className={cn('font-display text-lg font-semibold', color)}>{title}</h3>
        <div className="mt-2 font-mono text-xl font-bold tabular-nums break-words">{brlExact(total)}</div>
      </div>
      <div className="space-y-2">
        {lines.map((line) => (
          <div key={line.code} className="flex flex-wrap items-start justify-between gap-2 border-b border-white/5 py-2 text-sm">
            <div className="min-w-0">
              <div className="font-mono text-xs text-ink-400">{line.code}</div>
              <div className="text-white">{line.name}</div>
            </div>
            <div className="max-w-full break-words text-right font-mono tabular-nums text-ink-200">{brlExact(line.amountCentavos)}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function BankView({ bs, chain, stats }) {
  if (!bs) {
    return <div className="card-premium p-8 text-center text-ink-300">Carregando balanço…</div>;
  }
  if (bs.masterCreditReserve && bs.accounting) {
    return <ExactBankView bs={bs} chain={chain} stats={stats} />;
  }
  const reserva = bs.reservaMestre || {};
  const internas = bs.reservasInternas || [];

  const pieData = internas.map((r) => ({ name: r.nome, value: r.valorDisponivel ?? 0 }));

  return (
    <div className="space-y-6">
      {/* KPIs principais */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard icon={Vault} label="Capital base" value={brl(reserva.totalCapital)}
                 accent="bg-amber-400/15 text-amber-300"
                 hint={`Multiplicador ${reserva.fatorMultiplicador}×`} />
        <KpiCard icon={TrendingUp} label="Capacidade total" value={brl(reserva.capacidadeTotalEmissao)}
                 accent="bg-amber-400/15 text-amber-300"
                 hint="Limite máximo de emissão" />
        <KpiCard icon={Coins} label="Emitido" value={brl(reserva.totalEmitido)}
                 accent="bg-emerald-400/15 text-emerald-300"
                 hint={pct(reserva.percentualUtilizado) + ' utilizado'} />
        <KpiCard icon={PiggyBank} label="Disponível" value={brl(reserva.disponivelEmissao)}
                 accent="bg-sky-400/15 text-sky-300"
                 hint="Para nova emissão" />
      </div>

      {/* Status da cadeia */}
      <div className={cn(
        'card-premium p-5 flex flex-wrap items-center justify-between gap-3',
        chain?.valida ? 'ring-1 ring-emerald-500/30' : 'ring-1 ring-red-500/30'
      )}>
        <div className="flex items-center gap-3">
          <div className={cn(
            'h-10 w-10 rounded-xl inline-flex items-center justify-center',
            chain?.valida ? 'bg-emerald-400/15 text-emerald-300' : 'bg-red-400/15 text-red-300'
          )}>
            <Hash className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm text-ink-300">Integridade do Ledger</div>
            <div className="font-semibold">
              {chain?.valida ? '✓ Cadeia válida' : '✗ Cadeia comprometida'} ·
              <span className="text-ink-300 font-normal"> {chain?.quantidade ?? '?'} lançamentos</span>
            </div>
          </div>
        </div>
        <div className="text-xs text-ink-400 font-mono truncate max-w-md">
          {chain?.mensagem}
        </div>
      </div>

      {/* Balanço Ativo × Passivo */}
      <div className="grid lg:grid-cols-2 gap-6">
        <SheetCard title="ATIVO" total={bs.totalAtivo} lines={bs.ativo} color="text-emerald-300" />
        <SheetCard title="PASSIVO + PATRIMÔNIO"
                   total={(bs.totalPassivo ?? 0) + (bs.totalPatrimonio ?? 0)}
                   lines={[...(bs.passivo || []), ...(bs.patrimonio || [])]}
                   color="text-amber-300" />
      </div>

      <div className={cn(
        'card-premium p-4 text-sm text-center',
        bs.balanceado ? 'text-emerald-300' : 'text-red-300'
      )}>
        {bs.balanceado
          ? `✓ Balanço equilibrado — Ativo (${brl(bs.totalAtivo)}) = Passivo + PL (${brl((bs.totalPassivo ?? 0) + (bs.totalPatrimonio ?? 0))})`
          : `⚠ Balanço desbalanceado — Ativo ${brl(bs.totalAtivo)} × Passivo+PL ${brl((bs.totalPassivo ?? 0) + (bs.totalPatrimonio ?? 0))}`}
      </div>

      {/* Reservas Internas */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="card-premium p-6 lg:col-span-2">
          <h3 className="font-display text-lg font-semibold mb-4">Reservas Internas</h3>
          <div className="space-y-3">
            {internas.map((r) => {
              const used = (r.valorAlocado ?? 0);
              const tot = (r.valorTotal ?? 1);
              const pctUsed = (used / tot) * 100;
              return (
                <div key={r.codigo} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium text-white">{r.nome}</div>
                      <div className="text-xs text-ink-400 mt-0.5">{r.finalidade}</div>
                    </div>
                    <div className="text-right text-sm font-mono shrink-0">
                      <div className="text-white">{brl(r.valorDisponivel)}</div>
                      <div className="text-xs text-ink-400">de {brl(r.valorTotal)}</div>
                    </div>
                  </div>
                  <div className="mt-3 h-1.5 rounded-full bg-white/5 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-amber-500 to-amber-300"
                         style={{ width: `${Math.min(pctUsed, 100)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card-premium p-6">
          <h3 className="font-display text-lg font-semibold mb-4">Distribuição</h3>
          <div style={{ width: '100%', height: 240 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={pieData} dataKey="value" cx="50%" cy="50%" innerRadius={45} outerRadius={80}>
                  {pieData.map((_, i) => <Cell key={i} fill={RESERVE_COLORS[i % RESERVE_COLORS.length]} />)}
                </Pie>
                <Tooltip
                  contentStyle={{ background: '#040f2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
                  formatter={(v) => formatCurrency(v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

function SheetCard({ title, total, lines = [], color }) {
  return (
    <div className="card-premium p-6">
      <div className="flex items-baseline justify-between mb-4">
        <h3 className={cn('font-display text-lg font-semibold', color)}>{title}</h3>
        <span className="text-xl font-mono font-bold tabular-nums">{brl(total)}</span>
      </div>
      <div className="space-y-2">
        {lines.length === 0 && <div className="text-sm text-ink-400">Nenhuma conta.</div>}
        {lines.map((l) => (
          <div key={l.codigo} className="flex items-center justify-between text-sm py-1.5 border-b border-white/5">
            <div className="min-w-0">
              <span className="text-ink-400 font-mono mr-2">{l.codigo}</span>
              <span className="text-white">{l.nome}</span>
            </div>
            <span className="font-mono tabular-nums text-ink-200">{brl(l.saldo)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ===========================================================
// 2) Usuários
// ===========================================================
const EMPTY_ACCOUNT_FORM = {
  fullName: '', username: '', email: '', cpf: '', phone: '', initialPassword: '', confirmInitialPassword: '',
};

function AccountProvisionForm({ initialData, onCreated, onError }) {
  const [form, setForm] = useState(EMPTY_ACCOUNT_FORM);
  const [submitting, setSubmitting] = useState(false);
  const attempt = useRef(null);
  const submittingRef = useRef(false);

  useEffect(() => {
    if (!initialData) return;
    setForm((current) => ({
      ...current,
      fullName: initialData.fullName || '',
      username: initialData.username || '',
      email: initialData.email || '',
      cpf: initialData.cpf || '',
      phone: initialData.phone || '',
    }));
    attempt.current = null;
  }, [initialData]);

  async function submit(event) {
    event.preventDefault();
    if (submittingRef.current) return;
    const payload = {
      fullName: form.fullName.trim(),
      username: form.username.trim().toLowerCase(),
      email: form.email.trim().toLowerCase(),
      cpf: form.cpf.replace(/\D/g, ''),
      phone: form.phone.replace(/\D/g, ''),
      initialPassword: form.initialPassword,
    };
    if (payload.fullName.length < 5) return onError('Informe o nome completo do titular.');
    if (!/^[a-z0-9._-]{3,50}$/.test(payload.username)) return onError('Informe um usuario valido com pelo menos 3 caracteres.');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(payload.email)) return onError('Informe um e-mail valido.');
    if (payload.cpf.length !== 11) return onError('Informe um CPF com 11 digitos.');
    if (payload.initialPassword.length < 6) return onError('A senha inicial deve ter pelo menos 6 caracteres.');
    if (payload.initialPassword !== form.confirmInitialPassword) return onError('A confirmacao da senha inicial nao confere.');
    if (!globalThis.crypto?.randomUUID) return onError('Este dispositivo nao oferece geracao segura de identificadores. Atualize o aplicativo.');

    const fingerprint = [payload.cpf, payload.username, payload.email, payload.fullName.toLowerCase()].join('|');
    if (attempt.current?.fingerprint !== fingerprint) {
      attempt.current = { fingerprint, key: `admin-account-${globalThis.crypto.randomUUID()}` };
    }
    submittingRef.current = true;
    setSubmitting(true);
    try {
      const { data } = await adminService.provisionAccount(payload, attempt.current.key);
      setForm(EMPTY_ACCOUNT_FORM);
      attempt.current = null;
      onCreated(data.account);
    } catch (error) {
      onError(apiError(error, 'Falha ao criar a conta manualmente.'));
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="card-premium p-5 sm:p-6 space-y-5" aria-labelledby="manual-account-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-amber-400/15 text-amber-300">
            <UserPlus className="h-5 w-5" />
          </div>
          <div>
            <h2 id="manual-account-title" className="font-display text-lg font-semibold">Criar conta manualmente</h2>
            <div className="mt-1 flex flex-wrap gap-2 text-xs text-ink-400">
              <span>Saldo inicial KYD 0,00</span>
              <span>·</span>
              <span>KYC pendente</span>
              <span>·</span>
              <span>Senha de uso único</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Field label="Nome completo" full>
          <input className="input-premium w-full" value={form.fullName} autoComplete="name" required
                 onChange={(event) => setForm({ ...form, fullName: event.target.value })} />
        </Field>
        <Field label="Usuario">
          <input className="input-premium w-full" value={form.username} autoComplete="off" required
                 onChange={(event) => setForm({ ...form, username: event.target.value })} />
        </Field>
        <Field label="E-mail">
          <input type="email" className="input-premium w-full" value={form.email} autoComplete="email" required
                 onChange={(event) => setForm({ ...form, email: event.target.value })} />
        </Field>
        <Field label="CPF">
          <input className="input-premium w-full" value={form.cpf} inputMode="numeric" maxLength={14} required
                 onChange={(event) => setForm({ ...form, cpf: event.target.value })} />
        </Field>
        <Field label="Telefone (opcional)">
          <input className="input-premium w-full" value={form.phone} inputMode="tel" autoComplete="tel"
                 onChange={(event) => setForm({ ...form, phone: event.target.value })} />
        </Field>
        <Field label="Senha inicial">
          <input type="password" className="input-premium w-full" value={form.initialPassword}
                 autoComplete="new-password" minLength={6} required
                 onChange={(event) => setForm({ ...form, initialPassword: event.target.value })} />
        </Field>
        <Field label="Confirmar senha inicial">
          <input type="password" className="input-premium w-full" value={form.confirmInitialPassword}
                 autoComplete="new-password" minLength={6} required
                 onChange={(event) => setForm({ ...form, confirmInitialPassword: event.target.value })} />
        </Field>
      </div>

      <div className="flex justify-end">
        <button type="submit" className="btn-primary" disabled={submitting}>
          <UserPlus className="h-4 w-4" />
          {submitting ? 'Criando conta...' : 'Criar conta'}
        </button>
      </div>
    </form>
  );
}

function AccountRequestsPanel({ requests = [], onUse, onError }) {
  const [evidence, setEvidence] = useState(null);
  const [loadingEvidence, setLoadingEvidence] = useState('');

  async function openEvidence(request) {
    setLoadingEvidence(request.requestId);
    try {
      const { data } = await adminService.getAccountRequestEvidence(request.requestId);
      setEvidence(data);
    } catch (error) {
      onError(apiError(error, 'Falha ao abrir as fotos do documento.'));
    } finally {
      setLoadingEvidence('');
    }
  }

  return (
    <section className="card-premium p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-amber-400/15 text-amber-300">
            <UserPlus className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-lg font-semibold">Solicitacoes de abertura</h2>
            <p className="mt-1 text-sm text-ink-400">Pedidos enviados pelo cadastro publico. A conta real deve ser criada manualmente pelo admin.</p>
          </div>
        </div>
        <span className="pill-gold">{requests.length} pendente{requests.length === 1 ? '' : 's'}</span>
      </div>

      <div className="mt-4 divide-y divide-white/10 border-y border-white/10">
        {requests.map((request) => (
          <div key={request.requestId} className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div className="min-w-0">
              <div className="font-medium text-white">{request.fullName}</div>
              <div className="mt-1 text-xs text-ink-400">
                @{request.username} · {request.email} · {request.maskedCpf || 'CPF protegido'} · {formatDate(request.createdAt)}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-secondary !py-2 !px-3" onClick={() => openEvidence(request)} disabled={loadingEvidence === request.requestId}>
                <Eye className="h-4 w-4" /> Documentos
              </button>
              <button type="button" className="btn-secondary !py-2 !px-3" onClick={() => onUse(request)}>
                <UserPlus className="h-4 w-4" /> Usar dados
              </button>
            </div>
          </div>
        ))}
        {requests.length === 0 && (
          <div className="py-8 text-center text-sm text-ink-400">Nenhuma solicitacao de abertura pendente.</div>
        )}
      </div>
      {evidence && (
        <div className="mt-5 border-t border-white/10 pt-5">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="font-semibold text-white">{evidence.fullName}</div>
              <div className="text-xs text-ink-400">@{evidence.username} - {evidence.maskedCpf}</div>
            </div>
            <button type="button" className="btn-secondary !p-2" onClick={() => setEvidence(null)} aria-label="Fechar documentos">
              <XCircle className="h-4 w-4" />
            </button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              ['Documento frente', evidence.documentFront],
              ['Documento verso', evidence.documentBack],
            ].map(([label, source]) => (
              <figure key={label}>
                <div className="aspect-[4/3] overflow-hidden rounded-lg border border-white/10 bg-black/30">
                  <img src={source} alt={label} className="h-full w-full object-contain" />
                </div>
                <figcaption className="mt-2 text-xs text-ink-400">{label}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function UsersView({ users, accountRequests, search, setSearch, onCreated, onChanged, onError }) {
  const [selectedUsername, setSelectedUsername] = useState(null);
  const [requestDraft, setRequestDraft] = useState(null);

  if (selectedUsername) {
    return (
      <UserAccountDetail
        username={selectedUsername}
        onBack={() => setSelectedUsername(null)}
        onChanged={onChanged}
        onError={onError}
      />
    );
  }

  return (
    <div className="space-y-6">
      <AccountRequestsPanel
        requests={accountRequests}
        onUse={(request) => setRequestDraft(request)}
        onError={onError}
      />
      <AccountProvisionForm initialData={requestDraft} onCreated={onCreated} onError={onError} />
      <section className="card-premium p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="h-4 w-4 text-ink-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nome, email, CPF ou conta"
              className="input-premium w-full !pl-9"
            />
          </div>
          <span className="text-xs text-ink-400">{users.length} usuario(s)</span>
        </div>

        <div className="mt-4 overflow-x-auto -mx-5 px-5">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b border-white/10 text-left text-xs uppercase text-ink-400">
              <tr>
                <th className="py-3 pr-3">Titular</th>
                <th className="py-3 pr-3">Conta</th>
                <th className="py-3 pr-3">Disponivel</th>
                <th className="py-3 pr-3">Retido</th>
                <th className="py-3 pr-3">Status</th>
                <th className="py-3 text-right">Conta</th>
              </tr>
            </thead>
            <tbody>
              {users.map((account) => (
                <tr key={account.id} className="border-b border-white/5 hover:bg-white/[0.03]">
                  <td className="py-3 pr-3">
                    <button
                      type="button"
                      className="text-left"
                      onClick={() => setSelectedUsername(account.username)}
                    >
                      <span className="block font-medium text-white hover:text-amber-200">
                        {account.fullName || account.username}
                      </span>
                      <span className="block text-xs text-ink-400">@{account.username} · {account.email}</span>
                    </button>
                  </td>
                  <td className="py-3 pr-3 font-mono text-ink-200">{account.accountNumber}</td>
                  <td className="py-3 pr-3 font-mono tabular-nums">{brlExact(account.availableBalanceCentavos)}</td>
                  <td className="py-3 pr-3 font-mono tabular-nums text-amber-200">{brlExact(account.heldBalanceCentavos)}</td>
                  <td className="py-3 pr-3">
                    <span className={cn(
                      'inline-flex px-2 py-1 text-[11px] font-medium',
                      account.isActive
                        ? 'bg-emerald-400/15 text-emerald-300'
                        : 'bg-red-400/15 text-red-300'
                    )}>
                      {account.isActive ? 'Ativa' : 'Bloqueada'}
                    </span>
                  </td>
                  <td className="py-3 text-right">
                    <button
                      type="button"
                      className="btn-secondary !px-3 !py-2"
                      onClick={() => setSelectedUsername(account.username)}
                    >
                      <Eye className="h-4 w-4" /> Abrir
                    </button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr><td colSpan={6} className="py-8 text-center text-ink-400">Nenhum usuario encontrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

const ACCOUNT_DETAIL_TABS = [
  { id: 'profile', label: 'Dados', Icon: Users },
  { id: 'control', label: 'Controle', Icon: Shield },
  { id: 'holds', label: 'Retencoes', Icon: Banknote },
  { id: 'password', label: 'Senha', Icon: KeyRound },
  { id: 'history', label: 'Historico', Icon: Activity },
];

function UserAccountDetail({ username, onBack, onChanged, onError }) {
  const [detail, setDetail] = useState(null);
  const [section, setSection] = useState('profile');
  const [busy, setBusy] = useState('');
  const [profile, setProfile] = useState({ fullName: '', email: '', phone: '', reason: '' });
  const [statusReason, setStatusReason] = useState('');
  const [holdForm, setHoldForm] = useState({ amountReais: '', reason: '' });
  const [releaseForm, setReleaseForm] = useState({ holdId: '', reason: '' });
  const [passwordForm, setPasswordForm] = useState({ password: '', confirm: '', reason: '' });
  const attempts = useRef({});

  const account = detail?.account;
  const manageable = account && !account.roles?.includes('ROLE_ADMIN');

  async function loadDetail() {
    try {
      const { data } = await adminService.getUserAccount(username);
      setDetail(data);
      setProfile({
        fullName: data.account.fullName || '',
        email: data.account.email || '',
        phone: data.account.phone || '',
        reason: '',
      });
    } catch (error) {
      onError(apiError(error, 'Falha ao abrir a conta do usuario.'));
    }
  }

  useEffect(() => { loadDetail(); }, [username]);

  function requestKey(action, fingerprint) {
    if (!globalThis.crypto?.randomUUID) throw new Error('Este dispositivo nao oferece geracao segura de identificadores.');
    if (attempts.current[action]?.fingerprint !== fingerprint) {
      attempts.current[action] = {
        fingerprint,
        key: 'admin-user-' + action + '-' + globalThis.crypto.randomUUID(),
      };
    }
    return attempts.current[action].key;
  }

  async function run(action, fingerprint, request, successMessage) {
    if (busy) return;
    setBusy(action);
    try {
      const key = requestKey(action, fingerprint);
      await request(key);
      delete attempts.current[action];
      await loadDetail();
      onChanged(successMessage);
    } catch (error) {
      onError(apiError(error, 'Nao foi possivel concluir a operacao administrativa.'));
    } finally {
      setBusy('');
    }
  }

  async function saveProfile(event) {
    event.preventDefault();
    if (profile.reason.trim().length < 10) return onError('Registre um motivo com pelo menos 10 caracteres.');
    const payload = {
      fullName: profile.fullName.trim(),
      email: profile.email.trim().toLowerCase(),
      phone: profile.phone.replace(/\D/g, ''),
      reason: profile.reason.trim(),
    };
    await run(
      'profile',
      JSON.stringify(payload),
      (key) => adminService.updateUserProfile(username, payload, key),
      'Dados cadastrais atualizados e auditados.'
    );
  }

  async function changeStatus() {
    const reason = statusReason.trim();
    if (reason.length < 10) return onError('Registre um motivo com pelo menos 10 caracteres.');
    const blocking = account.isActive;
    await run(
      blocking ? 'block' : 'unblock',
      reason,
      (key) => blocking
        ? adminService.blockUser(username, reason, key)
        : adminService.unblockUser(username, reason, key),
      blocking
        ? 'Conta bloqueada e sessoes existentes revogadas.'
        : 'Conta desbloqueada e liberada para novo acesso.'
    );
    setStatusReason('');
  }

  async function placeHold(event) {
    event.preventDefault();
    const amountCentavos = reaisToCentavosExact(holdForm.amountReais);
    const reason = holdForm.reason.trim();
    if (!amountCentavos || amountCentavos === '0') return onError('Informe um valor de retencao valido.');
    if (reason.length < 10) return onError('Registre um motivo com pelo menos 10 caracteres.');
    await run(
      'hold',
      amountCentavos + '|' + reason,
      (key) => adminService.placeBalanceHold(username, { amountCentavos, reason }, key),
      'Retencao aplicada sem alterar o saldo contabil.'
    );
    setHoldForm({ amountReais: '', reason: '' });
  }

  async function releaseHold(event) {
    event.preventDefault();
    const reason = releaseForm.reason.trim();
    if (!releaseForm.holdId || reason.length < 10) return onError('Selecione a retencao e registre o motivo da liberacao.');
    await run(
      'release-' + releaseForm.holdId,
      releaseForm.holdId + '|' + reason,
      (key) => adminService.releaseBalanceHold(username, releaseForm.holdId, reason, key),
      'Retencao liberada e saldo disponivel recalculado.'
    );
    setReleaseForm({ holdId: '', reason: '' });
  }

  async function resetPassword(event) {
    event.preventDefault();
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,128}$/.test(passwordForm.password)) {
      return onError('A senha temporaria precisa de maiuscula, minuscula, numero e 8 caracteres.');
    }
    if (passwordForm.password !== passwordForm.confirm) return onError('A confirmacao da senha nao confere.');
    if (passwordForm.reason.trim().length < 10) return onError('Registre um motivo com pelo menos 10 caracteres.');
    const payload = { temporaryPassword: passwordForm.password, reason: passwordForm.reason.trim() };
    await run(
      'password',
      passwordForm.password + '|' + payload.reason,
      (key) => adminService.resetUserPassword(username, payload, key),
      'Senha temporaria emitida; sessoes revogadas e troca obrigatoria no proximo acesso.'
    );
    setPasswordForm({ password: '', confirm: '', reason: '' });
  }

  if (!detail) {
    return <div className="card-premium p-8 text-center text-ink-300">Carregando conta...</div>;
  }

  return (
    <div className="space-y-6">
      <button type="button" className="btn-secondary !px-3 !py-2" onClick={onBack}>
        <ArrowLeft className="h-4 w-4" /> Voltar para usuarios
      </button>

      <section className="border-y border-white/10 bg-white/[0.03] px-4 py-6 sm:px-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="text-xs uppercase text-amber-300">Conta de usuario</div>
            <h2 className="mt-2 font-display text-2xl font-bold text-white break-words">{account.fullName}</h2>
            <div className="mt-1 text-sm text-ink-400">@{account.username} · Conta {account.accountNumber}</div>
          </div>
          <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-3 xl:min-w-[620px]">
            <AccountMetric label="Saldo contabil" value={brlExact(detail.balances.ledgerBalanceCentavos)} />
            <AccountMetric label="Saldo retido" value={brlExact(detail.balances.heldBalanceCentavos)} accent="text-amber-200" />
            <AccountMetric label="Saldo disponivel" value={brlExact(detail.balances.availableBalanceCentavos)} accent="text-emerald-300" />
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2 text-xs">
          <span className={cn('px-3 py-2', account.isActive ? 'bg-emerald-400/15 text-emerald-300' : 'bg-red-400/15 text-red-300')}>
            {account.isActive ? 'CONTA ATIVA' : 'CONTA BLOQUEADA'}
          </span>
          <span className="bg-white/[0.06] px-3 py-2 text-ink-200">KYC {account.statusKyc}</span>
          <span className="bg-white/[0.06] px-3 py-2 text-ink-200">CREDENCIAL {account.credentialState}</span>
        </div>
      </section>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Gestao da conta">
        {ACCOUNT_DETAIL_TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={section === id}
            onClick={() => setSection(id)}
            className={cn('btn-secondary !px-3 !py-2', section === id && '!border-amber-400/50 !bg-amber-400/15 !text-amber-100')}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {!manageable && (
        <div className="border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
          Contas administrativas sao protegidas contra alteracoes por esta area.
        </div>
      )}

      {section === 'profile' && (
        <form onSubmit={saveProfile} className="card-premium p-5 sm:p-6 space-y-5">
          <SectionTitle icon={Users} title="Dados cadastrais" subtitle="CPF, usuario e numero da conta permanecem imutaveis." />
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Nome completo"><input className="input-premium w-full" value={profile.fullName} disabled={!manageable || busy} onChange={(event) => setProfile({ ...profile, fullName: event.target.value })} /></Field>
            <Field label="E-mail"><input type="email" className="input-premium w-full" value={profile.email} disabled={!manageable || busy} onChange={(event) => setProfile({ ...profile, email: event.target.value })} /></Field>
            <Field label="Telefone"><input className="input-premium w-full" value={profile.phone} disabled={!manageable || busy} onChange={(event) => setProfile({ ...profile, phone: event.target.value })} /></Field>
            <Field label="CPF protegido"><input className="input-premium w-full" value={account.cpf || ''} disabled /></Field>
          </div>
          <Field label="Motivo da alteracao"><textarea className="input-premium min-h-24 w-full resize-y" maxLength={500} value={profile.reason} disabled={!manageable || busy} onChange={(event) => setProfile({ ...profile, reason: event.target.value })} /></Field>
          <div className="flex justify-end"><button type="submit" className="btn-primary" disabled={!manageable || busy || profile.reason.trim().length < 10}><Save className="h-4 w-4" /> Salvar alteracoes</button></div>
        </form>
      )}

      {section === 'control' && (
        <section className="card-premium p-5 sm:p-6 space-y-5">
          <SectionTitle icon={Shield} title="Controle de acesso" subtitle="O bloqueio encerra todas as sessoes e impede novos acessos e saidas." />
          <Field label={account.isActive ? 'Motivo do bloqueio' : 'Motivo do desbloqueio'}>
            <textarea className="input-premium min-h-28 w-full resize-y" maxLength={500} value={statusReason} disabled={!manageable || busy} onChange={(event) => setStatusReason(event.target.value)} />
          </Field>
          <button type="button" className={account.isActive ? 'btn-secondary !text-red-300' : 'btn-primary'} disabled={!manageable || busy || statusReason.trim().length < 10} onClick={changeStatus}>
            {account.isActive ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
            {account.isActive ? 'Bloquear conta e revogar sessoes' : 'Desbloquear conta'}
          </button>
        </section>
      )}

      {section === 'holds' && (
        <div className="grid gap-6 xl:grid-cols-2">
          <form onSubmit={placeHold} className="card-premium p-5 sm:p-6 space-y-4">
            <SectionTitle icon={Banknote} title="Nova retencao" subtitle="Reduz o saldo disponivel sem apagar ou alterar o saldo contabil." />
            <Field label="Valor em KYD"><input className="input-premium w-full" inputMode="decimal" placeholder="0,00" value={holdForm.amountReais} disabled={!manageable || busy} onChange={(event) => setHoldForm({ ...holdForm, amountReais: event.target.value })} /></Field>
            <Field label="Motivo da retencao"><textarea className="input-premium min-h-24 w-full resize-y" maxLength={500} value={holdForm.reason} disabled={!manageable || busy} onChange={(event) => setHoldForm({ ...holdForm, reason: event.target.value })} /></Field>
            <button type="submit" className="btn-primary" disabled={!manageable || busy || holdForm.reason.trim().length < 10}><Lock className="h-4 w-4" /> Reter saldo</button>
          </form>

          <section className="card-premium p-5 sm:p-6">
            <SectionTitle icon={ListChecks} title="Retencoes da conta" subtitle="Liberacoes criam novos eventos; o registro original permanece." />
            <div className="mt-4 divide-y divide-white/10 border-y border-white/10">
              {detail.holds.map((hold) => (
                <div key={hold.id} className="py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-mono text-white">{brlExact(hold.amountCentavos)}</div>
                      <div className="mt-1 text-xs text-ink-400">{hold.reason} · {formatDate(hold.createdAt)}</div>
                    </div>
                    <span className={cn('px-2 py-1 text-xs', hold.status === 'ACTIVE' ? 'bg-amber-400/15 text-amber-200' : 'bg-emerald-400/15 text-emerald-300')}>{hold.status === 'ACTIVE' ? 'ATIVA' : 'LIBERADA'}</span>
                  </div>
                  {hold.status === 'ACTIVE' && manageable && (
                    <button type="button" className="btn-secondary mt-3 !px-3 !py-2" onClick={() => setReleaseForm({ holdId: hold.id, reason: '' })}><Unlock className="h-4 w-4" /> Liberar</button>
                  )}
                </div>
              ))}
              {detail.holds.length === 0 && <div className="py-8 text-center text-sm text-ink-400">Nenhuma retencao registrada.</div>}
            </div>
            {releaseForm.holdId && (
              <form onSubmit={releaseHold} className="mt-5 space-y-3 border-t border-white/10 pt-5">
                <Field label="Motivo da liberacao"><textarea className="input-premium min-h-24 w-full resize-y" maxLength={500} value={releaseForm.reason} onChange={(event) => setReleaseForm({ ...releaseForm, reason: event.target.value })} /></Field>
                <div className="flex gap-2">
                  <button type="button" className="btn-secondary" onClick={() => setReleaseForm({ holdId: '', reason: '' })}>Cancelar</button>
                  <button type="submit" className="btn-primary" disabled={busy || releaseForm.reason.trim().length < 10}>Confirmar liberacao</button>
                </div>
              </form>
            )}
          </section>
        </div>
      )}

      {section === 'password' && (
        <form onSubmit={resetPassword} className="card-premium p-5 sm:p-6 space-y-5">
          <SectionTitle icon={KeyRound} title="Redefinir senha" subtitle="A senha atual nunca e exibida. A nova senha e temporaria e expira em 24 horas." />
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Nova senha temporaria"><input type="password" autoComplete="new-password" className="input-premium w-full" value={passwordForm.password} disabled={!manageable || busy} onChange={(event) => setPasswordForm({ ...passwordForm, password: event.target.value })} /></Field>
            <Field label="Confirmar senha"><input type="password" autoComplete="new-password" className="input-premium w-full" value={passwordForm.confirm} disabled={!manageable || busy} onChange={(event) => setPasswordForm({ ...passwordForm, confirm: event.target.value })} /></Field>
          </div>
          <Field label="Motivo da redefinicao"><textarea className="input-premium min-h-24 w-full resize-y" maxLength={500} value={passwordForm.reason} disabled={!manageable || busy} onChange={(event) => setPasswordForm({ ...passwordForm, reason: event.target.value })} /></Field>
          <button type="submit" className="btn-primary" disabled={!manageable || busy || passwordForm.reason.trim().length < 10}><KeyRound className="h-4 w-4" /> Emitir senha temporaria</button>
        </form>
      )}

      {section === 'history' && (
        <div className="grid gap-6 xl:grid-cols-2">
          <section className="card-premium p-5 sm:p-6">
            <SectionTitle icon={Activity} title="Auditoria administrativa" subtitle="Eventos imutaveis de dados, acesso, senha e retencoes." />
            <div className="mt-4 divide-y divide-white/10">
              {detail.audit.map((event) => (
                <div key={event.id} className="py-3 text-sm">
                  <div className="flex flex-wrap justify-between gap-2"><span className="font-medium text-white">{event.eventType}</span><span className="text-xs text-ink-400">{formatDate(event.createdAt)}</span></div>
                  <div className="mt-1 text-ink-300">{event.reason}</div>
                  <div className="mt-1 text-xs text-ink-500">por {event.actor}</div>
                </div>
              ))}
              {detail.audit.length === 0 && <div className="py-8 text-center text-sm text-ink-400">Nenhum evento administrativo.</div>}
            </div>
          </section>
          <section className="card-premium p-5 sm:p-6">
            <SectionTitle icon={ListChecks} title="Movimentacoes recentes" subtitle="Historico financeiro preservado da conta." />
            <div className="mt-4 divide-y divide-white/10">
              {detail.recentTransactions.map((transaction) => (
                <div key={transaction.id} className="flex items-start justify-between gap-3 py-3 text-sm">
                  <div><div className="font-medium text-white">{getTransactionTypeLabel(transaction.type)}</div><div className="mt-1 text-xs text-ink-400">{formatDate(transaction.createdAt)}</div></div>
                  <div className="font-mono text-white">{brl(transaction.amount)}</div>
                </div>
              ))}
              {detail.recentTransactions.length === 0 && <div className="py-8 text-center text-sm text-ink-400">Nenhuma movimentacao.</div>}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function AccountMetric({ label, value, accent = 'text-white' }) {
  return (
    <div className="min-w-0 border border-white/10 bg-black/10 px-4 py-3">
      <div className="text-xs uppercase text-ink-400">{label}</div>
      <div className={cn('mt-1 break-words font-mono text-lg font-semibold', accent)}>{value}</div>
    </div>
  );
}

function SectionTitle({ icon: Icon, title, subtitle }) {
  return (
    <div className="flex items-start gap-3">
      <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center bg-amber-400/15 text-amber-300"><Icon className="h-5 w-5" /></div>
      <div><h3 className="font-display text-lg font-semibold text-white">{title}</h3><p className="mt-1 text-sm text-ink-400">{subtitle}</p></div>
    </div>
  );
}

function PasswordResetReviewView({ requests, onRefresh, onSuccess, onError }) {
  const [loading, setLoading] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      await onRefresh();
      onSuccess('Solicitacoes de senha atualizadas.');
    } catch (error) {
      onError(apiError(error, 'Falha ao atualizar solicitacoes.'));
    } finally {
      setLoading(false);
    }
  }

  function showInstruction() {
    onError('Abra a aba Usuarios, clique no cliente e emita uma senha temporaria na secao Senha.');
  }

  return (
    <section className="card-premium p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-white">
            <KeyRound className="h-5 w-5 text-gold-300" />
            <h2 className="text-lg font-semibold">Pedidos de senha temporaria</h2>
          </div>
          <p className="mt-1 text-sm text-ink-400">O usuario solicita aqui; o admin emite a senha temporaria no detalhe da conta.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="pill-gold">{requests.length} pendente{requests.length === 1 ? '' : 's'}</span>
          <button type="button" className="btn-secondary !py-2 !px-3" onClick={refresh} disabled={loading}>
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} /> Atualizar
          </button>
        </div>
      </div>

      <div className="mt-5 divide-y divide-white/10 border-y border-white/10">
        {requests.map((request) => (
          <div key={request.requestId} className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div>
              <div className="font-medium text-white">{request.fullName}</div>
              <div className="mt-1 text-xs text-ink-400">
                {request.username ? `@${request.username} - ` : ''}{request.maskedCpf || 'Documento protegido'} - {formatDate(request.createdAt)}
              </div>
              <div className="mt-2 text-xs text-amber-200">Acao: abra Usuarios, clique no cliente e emita uma senha temporaria.</div>
            </div>
            <button type="button" className="btn-secondary !py-2 !px-3" onClick={showInstruction} disabled={loading}>
              <KeyRound className="h-4 w-4" /> Emitir no usuario
            </button>
          </div>
        ))}
        {requests.length === 0 && (
          <div className="py-8 text-center text-sm text-ink-400">Nenhum pedido de senha temporaria pendente.</div>
        )}
      </div>
    </section>
  );
}
function UnifiedSearchView({ onError }) {
  const [form, setForm] = useState({ query: '', type: 'AUTO', limit: 50 });
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState(null);

  async function submit(e) {
    e.preventDefault();
    if (!form.query.trim()) return onError('Informe CPF, placa, nome, conta, e-mail, telefone ou termo.');
    setLoading(true);
    try {
      const { data } = await unifiedSearchService.search({
        query: form.query,
        type: form.type,
        limit: Number(form.limit) || 50,
      });
      setResponse(data);
    } catch (err) {
      onError(apiError(err, 'Falha na consulta geral.'));
    } finally {
      setLoading(false);
    }
  }

  const results = response?.results || [];
  const summary = response?.summary || {};

  return (
    <div className="space-y-6">
      <form onSubmit={submit} className="card-premium p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Search className="h-5 w-5 text-amber-300" />
          <h3 className="font-display text-lg font-semibold">Consulta Geral Administrativa</h3>
        </div>

        <div className="grid md:grid-cols-[1fr_180px_120px] gap-4">
          <Field label="Buscar por CPF, placa, nome, conta, email, telefone, transacao">
            <input
              className="input-premium w-full"
              value={form.query}
              onChange={(e) => setForm({ ...form, query: e.target.value })}
              placeholder="Ex.: 05569161155, ABC1D23, Maria, conta, email"
            />
          </Field>
          <Field label="Tipo">
            <select
              className="input-premium w-full"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
            >
              <option value="AUTO">AUTO</option>
              <option value="CPF">CPF</option>
              <option value="CNPJ">CNPJ</option>
              <option value="NOME">NOME</option>
              <option value="PLACA">PLACA</option>
              <option value="EMAIL">EMAIL</option>
              <option value="TELEFONE">TELEFONE</option>
              <option value="CONTA">CONTA</option>
              <option value="TRANSACAO">TRANSACAO</option>
              <option value="GERAL">GERAL</option>
            </select>
          </Field>
          <Field label="Limite">
            <input
              className="input-premium w-full"
              type="number"
              min="1"
              max="100"
              value={form.limit}
              onChange={(e) => setForm({ ...form, limit: e.target.value })}
            />
          </Field>
        </div>

        <button className="btn-primary w-full" disabled={loading}>
          {loading ? 'Consultando...' : <><Search className="h-4 w-4" /> Consultar tudo</>}
        </button>
      </form>

      {response && (
        <div className="grid md:grid-cols-4 gap-4">
          <KpiCard icon={ListChecks} label="Resultados" value={response.resultCount || 0}
                   accent="bg-amber-400/15 text-amber-300" hint={response.queryType} />
          <KpiCard icon={Users} label="Usuarios" value={summary.USERS || 0}
                   accent="bg-blue-400/15 text-blue-300" />
          <KpiCard icon={Send} label="Operacoes" value={(summary.TRANSACTIONS || 0) + (summary.EXTERNAL_TRANSFERS || 0)}
                   accent="bg-emerald-400/15 text-emerald-300" />
          <KpiCard icon={Landmark} label="Cayman/Outros" value={(summary.CAYMAN_RAIL || 0) + (summary.VEHICLE_PROVIDER || 0)}
                   accent="bg-purple-400/15 text-purple-300" />
        </div>
      )}

      {response?.warnings?.length > 0 && (
        <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100">
          {response.warnings.map((w, i) => <div key={i}>{w}</div>)}
        </div>
      )}

      {response && (
        <div className="grid xl:grid-cols-2 gap-4">
          {results.length === 0 && (
            <div className="card-premium p-6 text-sm text-ink-400">Nenhum dado encontrado para esta consulta.</div>
          )}
          {results.map((r, index) => (
            <div key={`${r.source}-${r.id}-${index}`} className="card-premium p-5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs uppercase tracking-widest text-ink-400">{r.source} · {r.kind}</div>
                  <div className="mt-1 font-semibold text-ink-50 truncate">{r.title || r.id}</div>
                  {r.subtitle && <div className="text-sm text-ink-300 truncate">{r.subtitle}</div>}
                </div>
                <span className={cn(
                  'text-xs px-2 py-1 rounded-full shrink-0',
                  r.status?.includes?.('ATIVO') || r.status?.includes?.('COMPLETED') || r.status?.includes?.('ANALISADO')
                    ? 'bg-emerald-400/15 text-emerald-300'
                    : r.status?.includes?.('NECESSARIO') || r.status?.includes?.('PENDING')
                      ? 'bg-amber-400/15 text-amber-300'
                      : 'bg-white/10 text-ink-300'
                )}>{r.status || 'INFO'}</span>
              </div>
              <div className="grid sm:grid-cols-2 gap-2">
                {Object.entries(r.fields || {}).slice(0, 12).map(([key, value]) => (
                  <Info key={key} label={key} value={String(value)} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DocumentAnalysisView({ analyses, users = [], onSuccess, onError }) {
  const [form, setForm] = useState({ type: 'CPF', document: '' });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [kycReview, setKycReview] = useState({ username: '', evidence: null, reason: '' });
  const [reviewLoading, setReviewLoading] = useState(false);
  const pendingAccounts = users.filter((account) => account.statusKyc === 'PENDENTE_VALIDACAO_IDENTIDADE');

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const { data } = await analysisService.analyzeDocument(form);
      setResult(data);
      onSuccess(`Analise automatica ${data.documentType} concluida: ${data.status}.`);
    } catch (err) {
      onError(apiError(err, 'Falha na analise documental.'));
    } finally {
      setLoading(false);
    }
  }

  async function openKycEvidence(username) {
    setReviewLoading(true);
    try {
      const { data } = await kycAdminService.evidence(username);
      setKycReview({ username, evidence: data, reason: '' });
    } catch (err) {
      onError(apiError(err, 'Falha ao abrir as evidencias protegidas.'));
    } finally {
      setReviewLoading(false);
    }
  }

  async function reviewKyc(decision) {
    const reason = kycReview.reason.trim();
    if (reason.length < 10) {
      onError('Registre um motivo com pelo menos 10 caracteres.');
      return;
    }
    setReviewLoading(true);
    try {
      const action = decision === 'approve' ? kycAdminService.approve : kycAdminService.reject;
      await action(kycReview.username, reason);
      setKycReview({ username: '', evidence: null, reason: '' });
      onSuccess(decision === 'approve' ? 'Identidade aprovada e operacoes de saida liberadas.' : 'Identidade rejeitada e sessoes revogadas.');
    } catch (err) {
      onError(apiError(err, 'Falha ao concluir a revisao de identidade.'));
    } finally {
      setReviewLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="card-premium p-5 sm:p-6" aria-labelledby="kyc-review-title">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 id="kyc-review-title" className="font-display text-lg font-semibold">Validacao de identidade pendente</h3>
            <p className="mt-1 text-sm text-ink-400">Contas pendentes podem consultar e receber, mas nao transferir ou sacar.</p>
          </div>
          <span className="rounded-full bg-amber-400/15 px-3 py-1 text-sm text-amber-200">{pendingAccounts.length} pendente(s)</span>
        </div>

        <div className="mt-4 divide-y divide-white/10 border-y border-white/10">
          {pendingAccounts.length === 0 && <div className="py-4 text-sm text-ink-400">Nenhuma conta aguardando revisao.</div>}
          {pendingAccounts.map((account) => (
            <div key={account.username} className="flex flex-wrap items-center justify-between gap-3 py-4">
              <div className="min-w-0">
                <div className="font-semibold text-ink-50">{account.fullName}</div>
                <div className="text-sm text-ink-400">{account.username} · CPF final {String(account.cpf || '').slice(-4)}</div>
              </div>
              <button type="button" className="btn-secondary !py-2 !px-3" onClick={() => openKycEvidence(account.username)} disabled={reviewLoading}>
                <Eye className="h-4 w-4" /> Revisar evidencias
              </button>
            </div>
          ))}
        </div>

        {kycReview.evidence && (
          <div className="mt-5 space-y-4">
            <div className="text-sm font-semibold text-ink-100">{kycReview.evidence.fullName} · {kycReview.evidence.maskedCpf}</div>
            <div className="grid gap-4 md:grid-cols-3">
              {[
                ['Documento frente', kycReview.evidence.documentFront],
                ['Documento verso', kycReview.evidence.documentBack],
                kycReview.evidence.face ? ['Captura facial', kycReview.evidence.face] : ['Biometria facial', null],
              ].map(([label, source]) => (
                <figure key={label} className="min-w-0">
                  <div className="aspect-[4/3] overflow-hidden rounded-lg border border-white/10 bg-black/30">
                    {source
                      ? <img src={source} alt={label} className="h-full w-full object-contain" />
                      : <div className="flex h-full items-center justify-center px-4 text-center text-sm text-ink-400">Removida por politica administrativa</div>}
                  </div>
                  <figcaption className="mt-2 text-xs text-ink-400">{label}</figcaption>
                </figure>
              ))}
            </div>
            <textarea
              className="input-premium min-h-24 w-full"
              value={kycReview.reason}
              onChange={(event) => setKycReview((current) => ({ ...current, reason: event.target.value }))}
              placeholder="Motivo auditavel da aprovacao ou rejeicao (minimo 10 caracteres)"
              maxLength={500}
            />
            <div className="flex flex-wrap gap-3">
              <button type="button" className="btn-primary" onClick={() => reviewKyc('approve')} disabled={reviewLoading}>
                <CheckCircle2 className="h-4 w-4" /> Aprovar identidade
              </button>
              <button type="button" className="btn-secondary border-red-400/30 text-red-200" onClick={() => reviewKyc('reject')} disabled={reviewLoading}>
                <XCircle className="h-4 w-4" /> Rejeitar identidade
              </button>
            </div>
          </div>
        )}
      </section>

      <div className="grid lg:grid-cols-3 gap-6">
      <form onSubmit={submit} className="card-premium min-w-0 p-6 lg:col-span-2 space-y-4">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-amber-300" />
          <h3 className="font-display text-lg font-semibold">Analise automatica CPF/CNPJ</h3>
        </div>

        <div className="grid md:grid-cols-[160px_1fr] gap-4">
          <Field label="Tipo">
            <select className="input-premium w-full" value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="CPF">CPF</option>
              <option value="CNPJ">CNPJ</option>
            </select>
          </Field>
          <Field label="Documento">
            <input className="input-premium w-full" value={form.document}
                   onChange={(e) => setForm({ ...form, document: e.target.value })}
                   placeholder={form.type === 'CPF' ? '000.000.000-00' : '00.000.000/0000-00'} />
          </Field>
        </div>

        <button className="btn-primary w-full" disabled={loading}>
          {loading ? 'Analisando...' : <><Search className="h-4 w-4" /> Analisar documento</>}
        </button>

        {result && (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm">
            <div className="grid sm:grid-cols-2 gap-3">
              <Info label="Status" value={result.status} />
              <Info label="Risco" value={`${result.riskLevel} (${result.riskScore})`} />
              <Info label="Provedor" value={result.provider} />
              <Info label="Nome/Razao" value={result.subjectName || 'Nao retornado'} />
              <Info label="Situacao" value={result.registrationStatus || 'Nao retornada'} />
            </div>
            {result.errorMessage && <div className="mt-3 text-red-200">{result.errorMessage}</div>}
          </div>
        )}
      </form>

      <div className="card-premium p-5">
        <h4 className="text-xs uppercase tracking-widest text-ink-400 mb-3">Ultimas consultas</h4>
        <div className="space-y-2">
          {analyses.length === 0 && <div className="text-sm text-ink-400">Nenhuma analise ainda.</div>}
          {analyses.slice(0, 8).map((a) => (
            <div key={a.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono">{a.documentType} {a.documentNumber}</span>
                <span className={cn(
                  'text-xs px-2 py-0.5 rounded-full',
                  a.riskLevel === 'BAIXO' ? 'bg-emerald-400/15 text-emerald-300' :
                  a.riskLevel === 'MEDIO' || a.riskLevel === 'BLOQUEADO' ? 'bg-amber-400/15 text-amber-300' :
                  'bg-red-400/15 text-red-300'
                )}>{a.riskLevel}</span>
              </div>
              <div className="text-xs text-ink-400 mt-1 truncate">{a.subjectName || a.status}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
    </div>
  );
}

// ===========================================================
// 3) Emissão de Crédito (escritural)
// ===========================================================
function CreditView({ users, bs, onSuccess, onError }) {
  const [form, setForm] = useState({
    userId: '', reservaCodigo: 'BRAVUS_MASTER_CREDIT_RESERVE', valorReais: '', motivo: '',
    regraElegibilidade: '', observacoes: '', liberarAgora: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [grants, setGrants] = useState([]);
  const submitLock = useRef(false);
  const issueAttempt = useRef(null);
  const releaseAttempts = useRef(new Map());

  const masterReserve = bs?.masterCreditReserve;
  const userOptions = users.filter((u) =>
    !u.roles?.some?.((r) => r.includes?.('ADMIN'))
    && u.active !== false
    && ['APROVADO_AUTO', 'APROVADO_IDENTIDADE'].includes(u.statusKyc)
  );

  useEffect(() => {
    if (!form.userId) {
      setGrants([]);
      return;
    }
    ledgerAdminService.grantsByUser(form.userId)
      .then(({ data }) => setGrants(Array.isArray(data) ? data : []))
      .catch(() => setGrants([]));
  }, [form.userId]);

  async function submit(e) {
    e.preventDefault();
    if (submitLock.current) return;
    if (!form.userId)  return onError('Selecione um usuário.');
    const valorCentavos = reaisToCentavosExact(form.valorReais);
    if (!valorCentavos || BigInt(valorCentavos) <= 0n) return onError('Informe um valor válido com até duas casas decimais.');
    if (form.motivo.trim().length < 10) return onError('Descreva o motivo da avaliação com pelo menos 10 caracteres.');
    if (form.regraElegibilidade.trim().length < 10) return onError('Registre o critério de elegibilidade aplicado.');
    if (!globalThis.crypto?.randomUUID) return onError('Este dispositivo não oferece geração segura de identificadores. Atualize o aplicativo.');
    const payload = {
      userId: parseInt(form.userId),
      reservaCodigo: form.reservaCodigo,
      valorCentavos,
      motivo: form.motivo.trim(),
      regraElegibilidade: form.regraElegibilidade.trim(),
      observacoes: form.observacoes.trim() || null,
      liberarAgora: form.liberarAgora,
    };
    const fingerprint = JSON.stringify(payload);
    if (issueAttempt.current?.fingerprint !== fingerprint) {
      issueAttempt.current = { fingerprint, key: `master-credit-${globalThis.crypto.randomUUID()}` };
    }
    submitLock.current = true;
    setSubmitting(true);
    try {
      await ledgerAdminService.issueCredit(payload, issueAttempt.current.key);
      onSuccess(form.liberarAgora
        ? `Crédito de KYD ${form.valorReais} emitido e liberado.`
        : `Crédito de KYD ${form.valorReais} emitido como pendente.`);
      setForm({ ...form, valorReais: '', motivo: '', observacoes: '' });
      issueAttempt.current = null;
      const { data } = await ledgerAdminService.grantsByUser(form.userId);
      setGrants(Array.isArray(data) ? data : []);
    } catch (err) {
      onError(err?.response?.data?.message || err?.response?.data || 'Falha na concessão.');
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  }

  async function releaseGrant(id) {
    if (submitLock.current) return;
    if (!globalThis.crypto?.randomUUID) return onError('Este dispositivo não oferece geração segura de identificadores. Atualize o aplicativo.');
    if (!releaseAttempts.current.has(id)) releaseAttempts.current.set(id, `master-release-${globalThis.crypto.randomUUID()}`);
    submitLock.current = true;
    setSubmitting(true);
    try {
      await ledgerAdminService.releaseCredit(id, releaseAttempts.current.get(id));
      releaseAttempts.current.delete(id);
      onSuccess(`Crédito escritural #${id} liberado.`);
      const { data } = await ledgerAdminService.grantsByUser(form.userId);
      setGrants(Array.isArray(data) ? data : []);
    } catch (err) {
      onError(err?.response?.data?.message || err?.response?.data || 'Falha ao liberar crédito.');
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  }

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <form onSubmit={submit} className="card-premium p-6 lg:col-span-2 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Coins className="h-5 w-5 text-amber-300" />
          <h3 className="font-display text-lg font-semibold">Emitir crédito escritural</h3>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Usuário">
            <select className="input-premium w-full" value={form.userId}
                    onChange={(e) => setForm({ ...form, userId: e.target.value })}>
              <option value="">— selecionar —</option>
              {userOptions.length === 0 && <option value="" disabled>Nenhum cliente com identidade aprovada</option>}
              {userOptions.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.fullName || u.username} (@{u.username})
                </option>
              ))}
            </select>
          </Field>

          <Field label="Reserva de origem">
            <select className="input-premium w-full" value={form.reservaCodigo} disabled>
              <option value="BRAVUS_MASTER_CREDIT_RESERVE">
                Reserva Mestre — disp. {brlExact(masterReserve?.availableCentavos || '0')}
              </option>
            </select>
          </Field>

          <Field label="Valor (KYD)">
            <input type="number" step="0.01" min="0.01" className="input-premium w-full"
                   value={form.valorReais}
                   onChange={(e) => setForm({ ...form, valorReais: e.target.value })} />
          </Field>

          <div className="rounded-lg border border-sky-400/20 bg-sky-400/10 px-4 py-3 text-sm text-sky-100">
            Concessão escritural sem dívida, parcelas ou juros para o cliente.
          </div>

          <Field label="Motivo" full>
            <input className="input-premium w-full" value={form.motivo} minLength={10} maxLength={500} required
                   onChange={(e) => setForm({ ...form, motivo: e.target.value })}
                   placeholder="Descreva a avaliação e a finalidade da concessão" />
          </Field>

          <Field label="Regra de elegibilidade" full>
            <input className="input-premium w-full" value={form.regraElegibilidade} minLength={10} maxLength={500} required
                   onChange={(e) => setForm({ ...form, regraElegibilidade: e.target.value })}
                   placeholder="Ex.: identidade aprovada, renda conferida e limite avaliado" />
          </Field>

          <Field label="Observações" full>
            <textarea rows="2" className="input-premium w-full" value={form.observacoes}
                      onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
          </Field>

          <label className="md:col-span-2 flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-ink-200">
            <input
              type="checkbox"
              checked={form.liberarAgora}
              onChange={(e) => setForm({ ...form, liberarAgora: e.target.checked })}
            />
            Liberar imediatamente para o saldo do cliente
          </label>
        </div>

        <button type="submit" disabled={submitting} className="btn-primary w-full">
          {submitting ? 'Emitindo...' : <><Send className="h-4 w-4" /> Emitir crédito escritural</>}
        </button>
      </form>

      <div className="min-w-0 space-y-4">
        <div className="card-premium p-5">
          <h4 className="text-xs uppercase tracking-widest text-ink-400 mb-3">Créditos do usuário</h4>
          <div className="space-y-2">
            {grants.length === 0 && <div className="text-sm text-ink-400">Selecione um usuário para ver emissões.</div>}
            {grants.slice(0, 6).map((g) => (
              <div key={g.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-medium" title={g.id}>#{String(g.id).slice(0, 8)} · {g.status}</div>
                    <div className="text-xs text-ink-400">{brlExact(g.amountCentavos || g.valorConcedido)}</div>
                  </div>
                  {g.status === 'PENDENTE' && (
                    <button type="button" className="btn-secondary !py-1.5 !px-2.5" onClick={() => releaseGrant(g.id)} disabled={submitting}>
                      Liberar
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="card-premium p-5">
          <h4 className="text-xs uppercase tracking-widest text-ink-400 mb-3">Regras de emissão</h4>
          <ul className="text-sm text-ink-200 space-y-2">
            <li>• Emissão pendente não altera saldo do cliente</li>
            <li>• Somente clientes ativos com identidade aprovada</li>
            <li>• Liberação debita a reserva e credita o cliente no mesmo commit</li>
            <li>• Toda concessão exige motivo e critério de elegibilidade</li>
            <li>• Repetições usam idempotência e não duplicam o crédito</li>
            <li>• Eventos e partidas contábeis permanecem imutáveis</li>
          </ul>
        </div>
        <div className="card-premium p-5">
          <h4 className="text-xs uppercase tracking-widest text-ink-400 mb-2">Reserva Mestre</h4>
          <div className="text-2xl font-mono font-bold tabular-nums break-words">{brlExact(masterReserve?.availableCentavos || '0')}</div>
          <div className="text-xs text-ink-400 mt-1">disponível para nova emissão</div>
        </div>
      </div>
    </div>
  );
}

function ExternalTransferView({ users, transfers, participants = [], onSuccess, onError }) {
  const [form, setForm] = useState({
    userId: '', amountReais: '', channel: 'PIX',
    beneficiaryName: '', beneficiaryDocument: '',
    pixKey: '', pixKeyType: 'CPF',
    bankCode: '', ispb: '', agency: '', accountNumber: '', accountDigit: '', accountType: 'CORRENTE',
    destinationNetwork: 'PIX_BR', participantCode: '',
    description: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const transferAttempt = useRef(null);
  const userOptions = users.filter((u) => !u.roles?.some?.((r) => r.includes?.('ADMIN')));

  async function submit(e) {
    e.preventDefault();
    if (!form.userId) return onError('Selecione o cliente de origem.');
    if (!form.amountReais || parseFloat(form.amountReais) <= 0) return onError('Informe um valor valido.');
    const fingerprint = JSON.stringify(form);
    if (transferAttempt.current?.fingerprint !== fingerprint) {
      transferAttempt.current = { fingerprint, key: `admin-transfer-${crypto.randomUUID()}` };
    }
    setSubmitting(true);
    try {
      await externalTransferService.submit({
        userId: parseInt(form.userId),
        amountCentavos: Math.round(parseFloat(form.amountReais) * 100),
        channel: form.channel,
        beneficiaryName: form.beneficiaryName,
        beneficiaryDocument: form.beneficiaryDocument,
        pixKey: form.pixKey || null,
        pixKeyType: form.pixKeyType || null,
        bankCode: form.bankCode || null,
        ispb: form.ispb || null,
        agency: form.agency || null,
        accountNumber: form.accountNumber || null,
        accountDigit: form.accountDigit || null,
        accountType: form.accountType || null,
        description: form.description || null,
        destinationNetwork: form.destinationNetwork || null,
        participantCode: form.participantCode || null,
      }, transferAttempt.current.key);
      transferAttempt.current = null;
      onSuccess(`Ordem de KYD ${form.amountReais} registrada no trilho Bravus.`);
      setForm({ ...form, amountReais: '', description: '' });
    } catch (err) {
      onError(err?.response?.data?.message || err?.response?.data || 'Falha no envio bancario externo.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <form onSubmit={submit} className="card-premium p-6 lg:col-span-2 space-y-4">
        <div className="flex items-center gap-2">
          <Send className="h-5 w-5 text-amber-300" />
          <h3 className="font-display text-lg font-semibold">Enviar saldo para conta bancaria</h3>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Cliente de origem">
            <select className="input-premium w-full" value={form.userId}
                    onChange={(e) => setForm({ ...form, userId: e.target.value })}>
              <option value="">selecionar</option>
              {userOptions.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.fullName || u.username} - saldo {brl(u.balance)}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Valor (KYD)">
            <input className="input-premium w-full" type="number" min="0.01" step="0.01"
                   value={form.amountReais}
                   onChange={(e) => setForm({ ...form, amountReais: e.target.value })} />
          </Field>

          <Field label="Canal">
            <select className="input-premium w-full" value={form.channel}
                    onChange={(e) => {
                      const channel = e.target.value;
                      setForm({
                        ...form,
                        channel,
                        destinationNetwork:
                          channel === 'PIX' ? 'PIX_BR'
                          : channel === 'TED' ? 'TED_BR'
                          : channel,
                      });
                    }}>
              <option value="PIX">PIX</option>
              <option value="TED">TED</option>
              <option value="SWIFT">SWIFT</option>
              <option value="ACH">ACH</option>
              <option value="SEPA">SEPA</option>
              <option value="CAYMAN_RAIL">Cayman Rail</option>
              <option value="GLOBAL">Global</option>
            </select>
          </Field>

          <Field label="Rede destino">
            <select className="input-premium w-full" value={form.destinationNetwork}
                    onChange={(e) => setForm({ ...form, destinationNetwork: e.target.value })}>
              <option value="PIX_BR">PIX_BR</option>
              <option value="TED_BR">TED_BR</option>
              <option value="SWIFT">SWIFT</option>
              <option value="ACH">ACH</option>
              <option value="SEPA">SEPA</option>
              <option value="CAYMAN_RAIL">CAYMAN_RAIL</option>
              <option value="GLOBAL">GLOBAL</option>
              <option value="INTERNAL_BRAVUS">INTERNAL_BRAVUS</option>
            </select>
          </Field>

          <Field label="Participante">
            <select className="input-premium w-full" value={form.participantCode}
                    onChange={(e) => setForm({ ...form, participantCode: e.target.value })}>
              <option value="">resolver automaticamente</option>
              {participants.map((p) => (
                <option key={p.id || p.participantCode} value={p.participantCode}>
                  {p.participantCode} - {p.legalName}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Documento favorecido">
            <input className="input-premium w-full" value={form.beneficiaryDocument}
                   onChange={(e) => setForm({ ...form, beneficiaryDocument: e.target.value })}
                   placeholder="CPF ou CNPJ" />
          </Field>

          <Field label="Nome favorecido" full>
            <input className="input-premium w-full" value={form.beneficiaryName}
                   onChange={(e) => setForm({ ...form, beneficiaryName: e.target.value })} />
          </Field>

          {form.channel === 'PIX' ? (
            <>
              <Field label="Tipo chave PIX">
                <select className="input-premium w-full" value={form.pixKeyType}
                        onChange={(e) => setForm({ ...form, pixKeyType: e.target.value })}>
                  <option value="CPF">CPF</option>
                  <option value="CNPJ">CNPJ</option>
                  <option value="EMAIL">Email</option>
                  <option value="PHONE">Telefone</option>
                  <option value="EVP">Aleatoria</option>
                </select>
              </Field>
              <Field label="Chave PIX">
                <input className="input-premium w-full" value={form.pixKey}
                       onChange={(e) => setForm({ ...form, pixKey: e.target.value })} />
              </Field>
            </>
          ) : (
            <>
              <Field label="Banco">
                <input className="input-premium w-full" value={form.bankCode}
                       onChange={(e) => setForm({ ...form, bankCode: e.target.value })} placeholder="001" />
              </Field>
              <Field label="ISPB">
                <input className="input-premium w-full" value={form.ispb}
                       onChange={(e) => setForm({ ...form, ispb: e.target.value })} />
              </Field>
              <Field label="Agencia">
                <input className="input-premium w-full" value={form.agency}
                       onChange={(e) => setForm({ ...form, agency: e.target.value })} />
              </Field>
              <Field label="Conta">
                <input className="input-premium w-full" value={form.accountNumber}
                       onChange={(e) => setForm({ ...form, accountNumber: e.target.value })} />
              </Field>
              <Field label="Digito">
                <input className="input-premium w-full" value={form.accountDigit}
                       onChange={(e) => setForm({ ...form, accountDigit: e.target.value })} />
              </Field>
              <Field label="Tipo conta">
                <select className="input-premium w-full" value={form.accountType}
                        onChange={(e) => setForm({ ...form, accountType: e.target.value })}>
                  <option value="CORRENTE">Corrente</option>
                  <option value="POUPANCA">Poupanca</option>
                  <option value="PAGAMENTO">Pagamento</option>
                </select>
              </Field>
            </>
          )}

          <Field label="Descricao" full>
            <input className="input-premium w-full" value={form.description}
                   onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>
        </div>

        <button className="btn-primary w-full" disabled={submitting}>
          {submitting ? 'Enviando...' : <><Send className="h-4 w-4" /> Enviar via gateway proprio</>}
        </button>
      </form>

      <div className="card-premium p-5">
        <h4 className="text-xs uppercase tracking-widest text-ink-400 mb-3">Ultimas ordens</h4>
        <div className="space-y-2">
          {transfers.length === 0 && <div className="text-sm text-ink-400">Nenhuma ordem externa ainda.</div>}
          {transfers.slice(0, 8).map((t) => (
            <div key={t.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">#{t.id} {t.channel}</span>
                <span className="text-xs text-ink-300">{t.status}</span>
              </div>
              <div className="text-xs text-ink-400 mt-1">{brl(t.amountCentavos)} - {t.beneficiaryName}</div>
              <div className="text-[11px] text-ink-400 mt-1">{t.destinationNetwork || 'GLOBAL'} - {t.settlementStatus || 'SEM_STATUS_DESTINO'}</div>
              {t.destinationParticipantCode && (
                <div className="text-[11px] text-ink-500 mt-1">Participante {t.destinationParticipantCode}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function GlobalRailView({ participants, transfers, onSuccess, onError }) {
  const [form, setForm] = useState({
    participantCode: 'BRAVUS-INTERNAL',
    legalName: 'Bravus Premium Bank',
    country: 'KY',
    network: 'INTERNAL_BRAVUS',
    bankCode: '999',
    ispb: '99999999',
    swiftBic: '',
    routingCode: '',
    endpointUrl: '',
    authMode: 'NONE',
    connectionMode: 'SELF_LEDGER',
    settlementAccount: '',
    supportsInstant: true,
    status: 'ACTIVE',
  });
  const [confirmForm, setConfirmForm] = useState({
    orderId: '',
    confirmationId: '',
    participantCode: '',
    destinationNetwork: '',
    message: '',
  });
  const [submitting, setSubmitting] = useState(false);

  async function saveParticipant(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await globalRailService.createParticipant({
        ...form,
        supportsInstant: Boolean(form.supportsInstant),
      });
      onSuccess(`Participante ${form.participantCode} salvo no Global Rail.`);
    } catch (err) {
      onError(err?.response?.data?.message || err?.response?.data || 'Falha ao salvar participante global.');
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmSettlement(e) {
    e.preventDefault();
    if (!confirmForm.orderId) return onError('Informe a ordem para confirmar.');
    setSubmitting(true);
    try {
      await globalRailService.confirmTransfer(confirmForm.orderId, {
        confirmationId: confirmForm.confirmationId || null,
        participantCode: confirmForm.participantCode || null,
        destinationNetwork: confirmForm.destinationNetwork || null,
        message: confirmForm.message || null,
      });
      onSuccess(`Liquidacao da ordem #${confirmForm.orderId} confirmada.`);
      setConfirmForm({ orderId: '', confirmationId: '', participantCode: '', destinationNetwork: '', message: '' });
    } catch (err) {
      onError(err?.response?.data?.message || err?.response?.data || 'Falha ao confirmar liquidacao.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid xl:grid-cols-3 gap-6">
      <form onSubmit={saveParticipant} className="card-premium p-6 xl:col-span-2 space-y-4">
        <div className="flex items-center gap-2">
          <Globe2 className="h-5 w-5 text-amber-300" />
          <h3 className="font-display text-lg font-semibold">Participante Global Rail</h3>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Codigo">
            <input className="input-premium w-full" value={form.participantCode}
                   onChange={(e) => setForm({ ...form, participantCode: e.target.value })} />
          </Field>
          <Field label="Nome legal">
            <input className="input-premium w-full" value={form.legalName}
                   onChange={(e) => setForm({ ...form, legalName: e.target.value })} />
          </Field>
          <Field label="Pais">
            <input className="input-premium w-full" value={form.country}
                   onChange={(e) => setForm({ ...form, country: e.target.value.toUpperCase().slice(0, 2) })} />
          </Field>
          <Field label="Rede">
            <select className="input-premium w-full" value={form.network}
                    onChange={(e) => setForm({ ...form, network: e.target.value })}>
              <option value="INTERNAL_BRAVUS">INTERNAL_BRAVUS</option>
              <option value="PIX_BR">PIX_BR</option>
              <option value="TED_BR">TED_BR</option>
              <option value="SWIFT">SWIFT</option>
              <option value="ACH">ACH</option>
              <option value="SEPA">SEPA</option>
              <option value="CAYMAN_RAIL">CAYMAN_RAIL</option>
              <option value="GLOBAL">GLOBAL</option>
            </select>
          </Field>
          <Field label="Banco">
            <input className="input-premium w-full" value={form.bankCode}
                   onChange={(e) => setForm({ ...form, bankCode: e.target.value })} />
          </Field>
          <Field label="ISPB">
            <input className="input-premium w-full" value={form.ispb}
                   onChange={(e) => setForm({ ...form, ispb: e.target.value })} />
          </Field>
          <Field label="SWIFT/BIC">
            <input className="input-premium w-full" value={form.swiftBic}
                   onChange={(e) => setForm({ ...form, swiftBic: e.target.value.toUpperCase() })} />
          </Field>
          <Field label="Routing">
            <input className="input-premium w-full" value={form.routingCode}
                   onChange={(e) => setForm({ ...form, routingCode: e.target.value })} />
          </Field>
          <Field label="Modo">
            <select className="input-premium w-full" value={form.connectionMode}
                    onChange={(e) => setForm({ ...form, connectionMode: e.target.value })}>
              <option value="SELF_LEDGER">SELF_LEDGER</option>
              <option value="HTTP_CONNECTOR">HTTP_CONNECTOR</option>
              <option value="FILE_EXPORT">FILE_EXPORT</option>
              <option value="MANUAL_CONFIRMATION">MANUAL_CONFIRMATION</option>
            </select>
          </Field>
          <Field label="Autenticacao">
            <select className="input-premium w-full" value={form.authMode}
                    onChange={(e) => setForm({ ...form, authMode: e.target.value })}>
              <option value="NONE">NONE</option>
              <option value="TOKEN">TOKEN</option>
              <option value="MTLS">MTLS</option>
              <option value="SIGNED_FILE">SIGNED_FILE</option>
              <option value="MANUAL">MANUAL</option>
            </select>
          </Field>
          <Field label="Endpoint" full>
            <input className="input-premium w-full" value={form.endpointUrl}
                   onChange={(e) => setForm({ ...form, endpointUrl: e.target.value })} />
          </Field>
          <Field label="Conta liquidacao">
            <input className="input-premium w-full" value={form.settlementAccount}
                   onChange={(e) => setForm({ ...form, settlementAccount: e.target.value })} />
          </Field>
          <Field label="Status">
            <select className="input-premium w-full" value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="DRAFT">DRAFT</option>
              <option value="MISSING_CREDENTIALS">MISSING_CREDENTIALS</option>
              <option value="READY">READY</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="SUSPENDED">SUSPENDED</option>
              <option value="CLOSED">CLOSED</option>
            </select>
          </Field>
          <label className="flex items-center gap-2 text-sm text-ink-200">
            <input type="checkbox" checked={form.supportsInstant}
                   onChange={(e) => setForm({ ...form, supportsInstant: e.target.checked })} />
            Instantaneo
          </label>
        </div>

        <button className="btn-primary w-full" disabled={submitting}>
          {submitting ? 'Salvando...' : <><Globe2 className="h-4 w-4" /> Salvar participante</>}
        </button>
      </form>

      <div className="space-y-6">
        <form onSubmit={confirmSettlement} className="card-premium p-5 space-y-3">
          <h4 className="text-xs uppercase tracking-widest text-ink-400">Confirmar liquidacao</h4>
          <select className="input-premium w-full" value={confirmForm.orderId}
                  onChange={(e) => {
                    const order = transfers.find((item) => String(item.id) === e.target.value);
                    setConfirmForm({
                      ...confirmForm,
                      orderId: e.target.value,
                      participantCode: order?.destinationParticipantCode || '',
                      destinationNetwork: order?.destinationNetwork || '',
                    });
                  }}>
            <option value="">ordem</option>
            {transfers.slice(0, 20).map((t) => (
              <option key={t.id} value={t.id}>#{t.id} - {t.beneficiaryName} - {t.settlementStatus || t.status}</option>
            ))}
          </select>
          <input className="input-premium w-full" placeholder="ID confirmacao"
                 value={confirmForm.confirmationId}
                 onChange={(e) => setConfirmForm({ ...confirmForm, confirmationId: e.target.value })} />
          <input className="input-premium w-full" placeholder="Participante"
                 value={confirmForm.participantCode}
                 onChange={(e) => setConfirmForm({ ...confirmForm, participantCode: e.target.value })} />
          <input className="input-premium w-full" placeholder="Rede"
                 value={confirmForm.destinationNetwork}
                 onChange={(e) => setConfirmForm({ ...confirmForm, destinationNetwork: e.target.value })} />
          <input className="input-premium w-full" placeholder="Mensagem"
                 value={confirmForm.message}
                 onChange={(e) => setConfirmForm({ ...confirmForm, message: e.target.value })} />
          <button className="btn-secondary w-full" disabled={submitting}>Confirmar</button>
        </form>

        <div className="card-premium p-5">
          <h4 className="text-xs uppercase tracking-widest text-ink-400 mb-3">Participantes</h4>
          <div className="space-y-2">
            {participants.length === 0 && <div className="text-sm text-ink-400">Nenhum participante global.</div>}
            {participants.slice(0, 10).map((p) => (
              <div key={p.id || p.participantCode} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{p.participantCode}</span>
                  <span className="text-xs text-ink-300">{p.status}</span>
                </div>
                <div className="text-xs text-ink-400 mt-1">{p.network} - {p.legalName}</div>
                <div className="text-[11px] text-ink-500 mt-1">{p.connectionMode} - {p.bankCode || p.swiftBic || p.routingCode || '-'}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function CaymanRailView({ rail, users, onSuccess, onError }) {
  const cfg = rail?.config || {};
  const ready = rail?.readiness || {};
  const institution = ready?.institution || cfg?.institution || {
    internalRoutingCode: 'BRAV-KY-INTERNAL',
    swiftBic: 'BRAVKYK0XXX',
    swiftBicStatus: 'INTERNAL_TEST_ONLY_UNREGISTERED',
    swiftConnected: false,
    swiftExternalRoutingEnabled: false,
  };
  const participants = rail?.participants || [];
  const instructions = rail?.instructions || [];
  const userOptions = users.filter((u) => !u.roles?.some?.((r) => r.includes?.('ADMIN')));

  const [configForm, setConfigForm] = useState({
    legalEntityName: 'Bravus Bank Cayman Ltd.',
    jurisdiction: 'Cayman Islands',
    registryNumber: '',
    cimaLicenseNumber: '',
    licenseClass: '',
    regulatoryStatus: 'DRAFT',
    settlementMode: 'INTERNAL_ONLY',
    amlPolicyVersion: '',
    productionEnabled: false,
  });
  const [participantForm, setParticipantForm] = useState({
    participantCode: '', legalName: '', institutionType: 'INTERNAL', country: 'KY',
    swiftBic: '', localRoutingCode: '', settlementAccount: '', directParticipant: false, status: 'PENDING',
  });
  const [instructionForm, setInstructionForm] = useState({
    userId: '', participantId: '', amount: '', currency: 'KYD',
    beneficiaryName: '', beneficiaryDocument: '', beneficiaryAccount: '', description: '',
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!cfg?.id) return;
    setConfigForm({
      legalEntityName: cfg.legalEntityName || 'Bravus Bank Cayman Ltd.',
      jurisdiction: cfg.jurisdiction || 'Cayman Islands',
      registryNumber: cfg.registryNumber || '',
      cimaLicenseNumber: cfg.cimaLicenseNumber || '',
      licenseClass: cfg.licenseClass || '',
      regulatoryStatus: cfg.regulatoryStatus || 'DRAFT',
      settlementMode: cfg.settlementMode || 'INTERNAL_ONLY',
      amlPolicyVersion: cfg.amlPolicyVersion || '',
      productionEnabled: !!cfg.productionEnabled,
    });
  }, [
    cfg?.id, cfg?.legalEntityName, cfg?.jurisdiction, cfg?.registryNumber,
    cfg?.cimaLicenseNumber, cfg?.licenseClass, cfg?.regulatoryStatus,
    cfg?.settlementMode, cfg?.amlPolicyVersion, cfg?.productionEnabled,
  ]);

  async function saveConfig(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { data } = await caymanRailService.updateConfig(configForm);
      onSuccess(`Trilho Cayman atualizado: ${data.regulatoryStatus}.`);
    } catch (err) {
      onError(err?.response?.data?.message || err?.response?.data || 'Falha ao salvar configuracao Cayman.');
    } finally {
      setSubmitting(false);
    }
  }

  async function createParticipant(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { data } = await caymanRailService.createParticipant(participantForm);
      onSuccess(`Participante ${data.participantCode} criado.`);
      setParticipantForm({
        participantCode: '', legalName: '', institutionType: 'INTERNAL', country: 'KY',
        swiftBic: '', localRoutingCode: '', settlementAccount: '', directParticipant: false, status: 'PENDING',
      });
    } catch (err) {
      onError(err?.response?.data?.message || err?.response?.data || 'Falha ao criar participante.');
    } finally {
      setSubmitting(false);
    }
  }

  async function submitInstruction(e) {
    e.preventDefault();
    if (!instructionForm.amount || parseFloat(instructionForm.amount) <= 0) return onError('Informe um valor positivo.');
    setSubmitting(true);
    try {
      const { data } = await caymanRailService.submitInstruction({
        userId: instructionForm.userId ? parseInt(instructionForm.userId) : null,
        participantId: instructionForm.participantId ? parseInt(instructionForm.participantId) : null,
        amountMinor: Math.round(parseFloat(instructionForm.amount) * 100),
        currency: instructionForm.currency,
        channel: 'CAYMAN_RAIL',
        beneficiaryName: instructionForm.beneficiaryName,
        beneficiaryDocument: instructionForm.beneficiaryDocument || null,
        beneficiaryAccount: instructionForm.beneficiaryAccount,
        description: instructionForm.description || null,
      });
      onSuccess(`Ordem Cayman #${data.id} criada: ${data.status}.`);
      setInstructionForm({ ...instructionForm, amount: '', beneficiaryName: '', beneficiaryDocument: '', beneficiaryAccount: '', description: '' });
    } catch (err) {
      onError(err?.response?.data?.message || err?.response?.data || 'Falha ao criar ordem Cayman.');
    } finally {
      setSubmitting(false);
    }
  }

  const moneyMinor = (amount) => {
    const value = ((amount || 0) / 100).toLocaleString('en-KY', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return `KYD ${value}`;
  };

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-4 gap-4">
        <KpiCard icon={Landmark} label="Gate" value={ready.gate || 'LICENSE_REQUIRED'}
                 accent={ready.productionReady ? 'bg-emerald-400/15 text-emerald-300' : 'bg-amber-400/15 text-amber-300'}
                 hint={ready.productionReady ? 'live' : 'bloqueado'} />
        <KpiCard icon={Shield} label="CIMA" value={ready.cimaLicensed ? 'LICENSED' : 'PENDING'}
                 accent="bg-blue-400/15 text-blue-300" hint={cfg.cimaLicenseNumber || 'sem licenca'} />
        <KpiCard icon={Users} label="Participantes" value={ready.activeParticipants ?? 0}
                 accent="bg-purple-400/15 text-purple-300" hint="ativos" />
        <KpiCard icon={AlertCircle} label="Bloqueios" value={ready.blockedInstructions ?? 0}
                 accent="bg-red-400/15 text-red-300" hint="license gate" />
      </div>

      <div className="grid xl:grid-cols-3 gap-6">
        <form onSubmit={saveConfig} className="card-premium p-6 space-y-4 xl:col-span-2">
          <div className="flex items-center gap-2">
            <Landmark className="h-5 w-5 text-amber-300" />
            <h3 className="font-display text-lg font-semibold">Trilho Cayman</h3>
          </div>
          <div className="grid md:grid-cols-2 gap-4 border-y border-white/10 py-4">
            <Field label="Roteamento interno Cayman">
              <input className="input-premium w-full font-mono" value={institution.internalRoutingCode} readOnly />
            </Field>
            <Field label="SWIFT/BIC interno de homologacao">
              <input className="input-premium w-full font-mono" value={institution.swiftBic} readOnly />
            </Field>
            <div className="md:col-span-2 text-xs text-amber-200/80">
              {institution.swiftBicStatus} · rede SWIFT externa {institution.swiftExternalRoutingEnabled ? 'habilitada' : 'bloqueada'}
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Entidade legal">
              <input className="input-premium w-full" value={configForm.legalEntityName}
                     onChange={(e) => setConfigForm({ ...configForm, legalEntityName: e.target.value })} />
            </Field>
            <Field label="Jurisdicao">
              <input className="input-premium w-full" value={configForm.jurisdiction}
                     onChange={(e) => setConfigForm({ ...configForm, jurisdiction: e.target.value })} />
            </Field>
            <Field label="Registro Cayman">
              <input className="input-premium w-full" value={configForm.registryNumber}
                     onChange={(e) => setConfigForm({ ...configForm, registryNumber: e.target.value })} />
            </Field>
            <Field label="Licenca CIMA">
              <input className="input-premium w-full" value={configForm.cimaLicenseNumber}
                     onChange={(e) => setConfigForm({ ...configForm, cimaLicenseNumber: e.target.value })} />
            </Field>
            <Field label="Classe">
              <input className="input-premium w-full" value={configForm.licenseClass}
                     onChange={(e) => setConfigForm({ ...configForm, licenseClass: e.target.value })} />
            </Field>
            <Field label="Status">
              <select className="input-premium w-full" value={configForm.regulatoryStatus}
                      onChange={(e) => setConfigForm({ ...configForm, regulatoryStatus: e.target.value })}>
                <option value="DRAFT">DRAFT</option>
                <option value="COMPANY_REGISTERED">COMPANY_REGISTERED</option>
                <option value="CIMA_APPLICATION">CIMA_APPLICATION</option>
                <option value="LICENSED">LICENSED</option>
                <option value="SUSPENDED">SUSPENDED</option>
              </select>
            </Field>
            <Field label="Liquidacao">
              <select className="input-premium w-full" value={configForm.settlementMode}
                      onChange={(e) => setConfigForm({ ...configForm, settlementMode: e.target.value })}>
                <option value="INTERNAL_ONLY">INTERNAL_ONLY</option>
                <option value="LIVE_LICENSED">LIVE_LICENSED</option>
              </select>
            </Field>
            <Field label="Politica AML">
              <input className="input-premium w-full" value={configForm.amlPolicyVersion}
                     onChange={(e) => setConfigForm({ ...configForm, amlPolicyVersion: e.target.value })}
                     placeholder="AML-2026-001" />
            </Field>
            <label className="md:col-span-2 flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-ink-200">
              <input type="checkbox" checked={configForm.productionEnabled}
                     onChange={(e) => setConfigForm({ ...configForm, productionEnabled: e.target.checked })} />
              Produção habilitada
            </label>
          </div>
          <button className="btn-primary w-full" disabled={submitting}>
            {submitting ? 'Salvando...' : <><CheckCircle2 className="h-4 w-4" /> Salvar gate regulatorio</>}
          </button>
        </form>

        <form onSubmit={createParticipant} className="card-premium p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-amber-300" />
            <h3 className="font-display text-lg font-semibold">Participante</h3>
          </div>
          <Field label="Codigo">
            <input className="input-premium w-full" value={participantForm.participantCode}
                   onChange={(e) => setParticipantForm({ ...participantForm, participantCode: e.target.value })} />
          </Field>
          <Field label="Nome legal">
            <input className="input-premium w-full" value={participantForm.legalName}
                   onChange={(e) => setParticipantForm({ ...participantForm, legalName: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tipo">
              <select className="input-premium w-full" value={participantForm.institutionType}
                      onChange={(e) => setParticipantForm({ ...participantForm, institutionType: e.target.value })}>
                <option value="INTERNAL">INTERNAL</option>
                <option value="BANK">BANK</option>
                <option value="MSB">MSB</option>
                <option value="CORRESPONDENT">CORRESPONDENT</option>
                <option value="TEST">TEST</option>
              </select>
            </Field>
            <Field label="Pais">
              <input className="input-premium w-full" value={participantForm.country}
                     onChange={(e) => setParticipantForm({ ...participantForm, country: e.target.value })} />
            </Field>
          </div>
          <Field label="BIC/SWIFT externo">
            <input className="input-premium w-full" value={participantForm.swiftBic}
                   onChange={(e) => setParticipantForm({ ...participantForm, swiftBic: e.target.value.toUpperCase() })}
                   placeholder="Somente BIC emitido pela SWIFT" />
          </Field>
          <p className="text-xs text-ink-400">Para o Bravus, use BRAVKYK0XXX apenas dentro deste sistema.</p>
          <Field label="Conta settlement">
            <input className="input-premium w-full" value={participantForm.settlementAccount}
                   onChange={(e) => setParticipantForm({ ...participantForm, settlementAccount: e.target.value })} />
          </Field>
          <Field label="Status">
            <select className="input-premium w-full" value={participantForm.status}
                    onChange={(e) => setParticipantForm({ ...participantForm, status: e.target.value })}>
              <option value="PENDING">PENDING</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="SUSPENDED">SUSPENDED</option>
              <option value="CLOSED">CLOSED</option>
            </select>
          </Field>
          <button className="btn-secondary w-full" disabled={submitting}>
            <Users className="h-4 w-4" /> Criar participante
          </button>
        </form>
      </div>

      <div className="grid xl:grid-cols-3 gap-6">
        <form onSubmit={submitInstruction} className="card-premium p-6 space-y-4 xl:col-span-2">
          <div className="flex items-center gap-2">
            <Send className="h-5 w-5 text-amber-300" />
            <h3 className="font-display text-lg font-semibold">Ordem Cayman Rail</h3>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Cliente origem">
              <select className="input-premium w-full" value={instructionForm.userId}
                      onChange={(e) => setInstructionForm({ ...instructionForm, userId: e.target.value })}>
                <option value="">sem cliente</option>
                {userOptions.map((u) => (
                  <option key={u.id} value={u.id}>{u.fullName || u.username}</option>
                ))}
              </select>
            </Field>
            <Field label="Participante">
              <select className="input-premium w-full" value={instructionForm.participantId}
                      onChange={(e) => setInstructionForm({ ...instructionForm, participantId: e.target.value })}>
                <option value="">sem participante</option>
                {participants.map((p) => (
                  <option key={p.id} value={p.id}>{p.participantCode} - {p.legalName}</option>
                ))}
              </select>
            </Field>
            <Field label="Valor">
              <input className="input-premium w-full" type="number" step="0.01" min="0.01"
                     value={instructionForm.amount}
                     onChange={(e) => setInstructionForm({ ...instructionForm, amount: e.target.value })} />
            </Field>
            <Field label="Moeda">
              <select className="input-premium w-full" value={instructionForm.currency}
                      onChange={(e) => setInstructionForm({ ...instructionForm, currency: e.target.value })}>
                <option value="KYD">KYD</option>
              </select>
            </Field>
            <Field label="Beneficiario">
              <input className="input-premium w-full" value={instructionForm.beneficiaryName}
                     onChange={(e) => setInstructionForm({ ...instructionForm, beneficiaryName: e.target.value })} />
            </Field>
            <Field label="Documento">
              <input className="input-premium w-full" value={instructionForm.beneficiaryDocument}
                     onChange={(e) => setInstructionForm({ ...instructionForm, beneficiaryDocument: e.target.value })} />
            </Field>
            <Field label="Conta destino" full>
              <input className="input-premium w-full" value={instructionForm.beneficiaryAccount}
                     onChange={(e) => setInstructionForm({ ...instructionForm, beneficiaryAccount: e.target.value })} />
            </Field>
            <Field label="Descricao" full>
              <input className="input-premium w-full" value={instructionForm.description}
                     onChange={(e) => setInstructionForm({ ...instructionForm, description: e.target.value })} />
            </Field>
          </div>
          <button className="btn-primary w-full" disabled={submitting}>
            {submitting ? 'Criando...' : <><Send className="h-4 w-4" /> Criar ordem license-gated</>}
          </button>
        </form>

        <div className="card-premium p-5">
          <h4 className="text-xs uppercase tracking-widest text-ink-400 mb-3">Participantes</h4>
          <div className="space-y-2">
            {participants.length === 0 && <div className="text-sm text-ink-400">Nenhum participante.</div>}
            {participants.slice(0, 8).map((p) => (
              <div key={p.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono">{p.participantCode}</span>
                  <span className="text-xs text-ink-300">{p.status}</span>
                </div>
                <div className="text-xs text-ink-400 mt-1 truncate">{p.legalName}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card-premium p-5">
        <h4 className="text-xs uppercase tracking-widest text-ink-400 mb-3">Ordens Cayman Rail</h4>
        <div className="grid lg:grid-cols-2 gap-3">
          {instructions.length === 0 && <div className="text-sm text-ink-400">Nenhuma ordem.</div>}
          {instructions.slice(0, 10).map((i) => (
            <div key={i.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">#{i.id} {i.status}</span>
                <span className="text-xs text-ink-300">{i.regulatoryGate}</span>
              </div>
              <div className="text-xs text-ink-400 mt-1">{moneyMinor(i.amountMinor)} - {i.beneficiaryName}</div>
              <div className="text-xs text-ink-500 mt-1 truncate">{i.complianceResult || i.errorMessage}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-ink-400">{label}</div>
      <div className="mt-1 text-sm text-white break-words">{value}</div>
    </div>
  );
}

function Field({ label, children, full }) {
  return (
    <label className={cn('block', full && 'md:col-span-2')}>
      <span className="text-xs uppercase tracking-wider text-ink-400 mb-1.5 block">{label}</span>
      {children}
    </label>
  );
}

// ===========================================================
// 4) Livro Razão (hash chain)
// ===========================================================
function LedgerView({ entries, chain }) {
  const [expanded, setExpanded] = useState(null);
  const valid = chainIsValid(chain);

  return (
    <div className="space-y-4">
      <div className={cn(
        'card-premium p-5 flex flex-wrap items-center justify-between gap-4',
        valid ? 'ring-1 ring-emerald-500/30' : 'ring-1 ring-red-500/30'
      )}>
        <div>
          <div className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-amber-300" />
            <span className="text-sm text-ink-300">Cadeia de hash</span>
          </div>
          <div className="font-display text-xl font-semibold mt-1">
            {chainCount(chain)} transferências · {valid ? '✓ íntegra' : '✗ comprometida'}
          </div>
        </div>
        <div className="text-xs text-ink-400 font-mono break-all max-w-md text-right">
          {chainMessage(chain)}
        </div>
      </div>

      <div className="card-premium p-5">
        <h3 className="font-display text-lg font-semibold mb-4">Últimos lançamentos</h3>
        <div className="space-y-2">
          {entries.length === 0 && <div className="text-sm text-ink-400">Sem lançamentos.</div>}
          {entries.map((e) => {
            const isOpen = expanded === e.id;
            return (
              <div key={e.id} className="rounded-xl border border-white/10 bg-white/[0.02]">
                <button
                  onClick={() => setExpanded(isOpen ? null : e.id)}
                  className="w-full flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-amber-500/15 text-amber-300">
                      #{e.sequencia ?? e.id}
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-white truncate">{e.descricao || e.reason || e.tipo || e.entryType}</div>
                      <div className="text-xs text-ink-400 truncate">
                        {e.contaDebitoCodigo || e.contaCreditoCodigo
                          ? `DR ${e.contaDebitoCodigo || '—'} → CR ${e.contaCreditoCodigo || '—'}`
                          : `${e.entryType || 'entry'} · ${e.accountUsername || e.accountNumber || 'conta'}`}
                        {' · '}{formatDate(e.dataLancamento || e.createdAt)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono tabular-nums text-sm">{brl(e.valor ?? e.signedAmountCentavos)}</span>
                    {isOpen ? <ChevronUp className="h-4 w-4 text-ink-400" /> : <ChevronDown className="h-4 w-4 text-ink-400" />}
                  </div>
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 pt-1 text-xs text-ink-300 space-y-1 border-t border-white/5">
                    {e.hashAtual && <div><b>Hash atual:</b> <span className="font-mono break-all">{e.hashAtual}</span></div>}
                    {e.hashAtual && <div><b>Hash anterior:</b> <span className="font-mono break-all">{e.hashAnterior || '—'}</span></div>}
                    {e.transferId && <div><b>Transferência:</b> <span className="font-mono break-all">{e.transferId}</span></div>}
                    {e.referenciaTipo && <div><b>Referência:</b> {e.referenciaTipo} #{e.referenciaId}</div>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
