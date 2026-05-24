import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Users, Activity, Banknote, TrendingUp, Power, Trash2, CheckCircle2, AlertCircle,
  Search, Shield, BarChart3, ListChecks, Coins, Link2, Hash, Vault, PiggyBank,
  Send, RefreshCw, ChevronDown, ChevronUp,
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { adminService, ledgerAdminService } from '../services/api';
import { formatCurrency, formatDate, getTransactionTypeLabel } from '../utils/helpers';
import { cn } from '../lib/cn';

// ============ Helpers ============
const brl = (cents) => formatCurrency((cents ?? 0) / 100);
const pct = (n) => `${(n ?? 0).toFixed(1)}%`;

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
      const [d, u, t, bs, ch, en] = await Promise.all([
        adminService.getDashboard().catch(() => ({ data: null })),
        adminService.getAllUsers().catch(() => ({ data: [] })),
        adminService.getAllTransactions().catch(() => ({ data: [] })),
        ledgerAdminService.balanceSheet().catch(() => ({ data: null })),
        ledgerAdminService.validateChain().catch(() => ({ data: null })),
        ledgerAdminService.entries(0, 30).catch(() => ({ data: { content: [] } })),
      ]);
      setStats(d.data);
      setUsers(Array.isArray(u.data) ? u.data : []);
      setTxns(Array.isArray(t.data) ? t.data : []);
      setBalanceSheet(bs.data);
      setChain(ch.data);
      setEntries(en.data?.content || en.data || []);
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

  // ===== Ações =====
  async function toggleActive(u) {
    try {
      if (u.isActive) await adminService.deactivateUser(u.id);
      else await adminService.activateUser(u.id);
      setSuccess(`Usuário ${u.username} ${u.isActive ? 'desativado' : 'ativado'}.`);
      loadAll();
    } catch (e) { setError('Falha ao atualizar usuário.'); }
  }

  async function removeUser(u) {
    if (!confirm(`Excluir o usuário "${u.username}"? Esta ação é irreversível.`)) return;
    try {
      await adminService.deleteUser(u.id);
      setSuccess(`Usuário ${u.username} excluído.`);
      loadAll();
    } catch (e) { setError('Falha ao excluir usuário.'); }
  }

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
        <Tab id="credit"  label="Emissão Escritural" icon={Coins} />
        <Tab id="ledger"  label="Livro Razão"      icon={Link2} />
      </div>

      {/* ===== TAB 1: BALANÇO ===== */}
      {tab === 'bank' && <BankView bs={balanceSheet} chain={chain} stats={stats} />}

      {/* ===== TAB 2: USUÁRIOS ===== */}
      {tab === 'users' && (
        <UsersView
          users={filteredUsers}
          search={search} setSearch={setSearch}
          onToggle={toggleActive}
          onDelete={removeUser}
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

      {/* ===== TAB 4: LIVRO RAZÃO ===== */}
      {tab === 'ledger' && <LedgerView entries={entries} chain={chain} />}
    </main>
  );
}

// ===========================================================
// 1) Balanço do banco
// ===========================================================
function BankView({ bs, chain, stats }) {
  if (!bs) {
    return <div className="card-premium p-8 text-center text-ink-300">Carregando balanço…</div>;
  }
  const reserva = bs.reservaMestre || {};
  const internas = bs.reservasInternas || [];

  const pieData = internas.map((r) => ({ name: r.nome, value: (r.valorDisponivel ?? 0) / 100 }));

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
function UsersView({ users, search, setSearch, onToggle, onDelete }) {
  return (
    <div className="card-premium p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="h-4 w-4 text-ink-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, email, CPF ou conta…"
            className="input-premium w-full !pl-9"
          />
        </div>
        <span className="text-xs text-ink-400">{users.length} usuário(s)</span>
      </div>
      <div className="overflow-x-auto -mx-5 px-5">
        <table className="w-full text-sm min-w-[640px]">
          <thead className="text-left text-xs uppercase tracking-wider text-ink-400 border-b border-white/10">
            <tr>
              <th className="py-2 pr-3">Usuário</th>
              <th className="py-2 pr-3">Conta</th>
              <th className="py-2 pr-3">Saldo</th>
              <th className="py-2 pr-3">Status</th>
              <th className="py-2 pr-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                <td className="py-2 pr-3">
                  <div className="font-medium text-white">{u.fullName || u.username}</div>
                  <div className="text-xs text-ink-400">@{u.username} · {u.email}</div>
                </td>
                <td className="py-2 pr-3 font-mono text-ink-200">{u.accountNumber}</td>
                <td className="py-2 pr-3 font-mono tabular-nums">{brl(u.balance)}</td>
                <td className="py-2 pr-3">
                  <span className={cn(
                    'px-2 py-0.5 rounded-full text-[11px] font-medium',
                    u.isActive
                      ? 'bg-emerald-400/15 text-emerald-300'
                      : 'bg-red-400/15 text-red-300'
                  )}>
                    {u.isActive ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
                <td className="py-2 pr-3 text-right">
                  <button onClick={() => onToggle(u)} className="btn-secondary !py-1.5 !px-2.5 mr-2">
                    <Power className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => onDelete(u)} className="btn-secondary !py-1.5 !px-2.5 !text-red-300">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr><td colSpan={5} className="py-6 text-center text-ink-400">Nenhum usuário encontrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ===========================================================
// 3) Emissão de Crédito (escritural)
// ===========================================================
function CreditView({ users, bs, onSuccess, onError }) {
  const [form, setForm] = useState({
    userId: '', reservaCodigo: 'RES-PERSONAL', valorReais: '', motivo: '',
    regraElegibilidade: '', taxaJurosAnual: '', observacoes: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const reservas = bs?.reservasInternas || [];
  const userOptions = users.filter((u) => !u.roles?.some?.((r) => r.includes?.('ADMIN')));

  async function submit(e) {
    e.preventDefault();
    if (!form.userId)  return onError('Selecione um usuário.');
    if (!form.valorReais || parseFloat(form.valorReais) <= 0) return onError('Informe um valor válido.');
    if (!form.motivo) return onError('Informe o motivo da concessão.');
    setSubmitting(true);
    try {
      await ledgerAdminService.grantCredit({
        userId: parseInt(form.userId),
        reservaCodigo: form.reservaCodigo,
        valorCentavos: Math.round(parseFloat(form.valorReais) * 100),
        motivo: form.motivo,
        regraElegibilidade: form.regraElegibilidade || null,
        taxaJurosAnual: form.taxaJurosAnual ? parseFloat(form.taxaJurosAnual) : 0,
        observacoes: form.observacoes || null,
      });
      onSuccess(`Crédito de R$ ${form.valorReais} concedido com sucesso.`);
      setForm({ ...form, valorReais: '', motivo: '', observacoes: '' });
    } catch (err) {
      onError(err?.response?.data?.message || err?.response?.data || 'Falha na concessão.');
    } finally { setSubmitting(false); }
  }

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <form onSubmit={submit} className="card-premium p-6 lg:col-span-2 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Coins className="h-5 w-5 text-amber-300" />
          <h3 className="font-display text-lg font-semibold">Conceder Crédito Escritural</h3>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Usuário">
            <select className="input-premium w-full" value={form.userId}
                    onChange={(e) => setForm({ ...form, userId: e.target.value })}>
              <option value="">— selecionar —</option>
              {userOptions.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.fullName || u.username} (@{u.username})
                </option>
              ))}
            </select>
          </Field>

          <Field label="Reserva de origem">
            <select className="input-premium w-full" value={form.reservaCodigo}
                    onChange={(e) => setForm({ ...form, reservaCodigo: e.target.value })}>
              {reservas.map((r) => (
                <option key={r.codigo} value={r.codigo}>
                  {r.nome} — disp. {brl(r.valorDisponivel)}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Valor (R$)">
            <input type="number" step="0.01" min="0.01" className="input-premium w-full"
                   value={form.valorReais}
                   onChange={(e) => setForm({ ...form, valorReais: e.target.value })} />
          </Field>

          <Field label="Taxa de juros anual (%)">
            <input type="number" step="0.01" min="0" className="input-premium w-full"
                   value={form.taxaJurosAnual}
                   onChange={(e) => setForm({ ...form, taxaJurosAnual: e.target.value })}
                   placeholder="0.00" />
          </Field>

          <Field label="Motivo" full>
            <input className="input-premium w-full" value={form.motivo}
                   onChange={(e) => setForm({ ...form, motivo: e.target.value })}
                   placeholder="Ex.: Linha de crédito promocional — abertura de conta" />
          </Field>

          <Field label="Regra de elegibilidade" full>
            <input className="input-premium w-full" value={form.regraElegibilidade}
                   onChange={(e) => setForm({ ...form, regraElegibilidade: e.target.value })}
                   placeholder="Ex.: KYC verificado + nível PREMIUM" />
          </Field>

          <Field label="Observações" full>
            <textarea rows="2" className="input-premium w-full" value={form.observacoes}
                      onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
          </Field>
        </div>

        <button type="submit" disabled={submitting} className="btn-primary w-full">
          {submitting ? 'Emitindo…' : <><Send className="h-4 w-4" /> Conceder crédito</>}
        </button>
      </form>

      <div className="space-y-4">
        <div className="card-premium p-5">
          <h4 className="text-xs uppercase tracking-widest text-ink-400 mb-3">Regras de emissão</h4>
          <ul className="text-sm text-ink-200 space-y-2">
            <li>• Gera <b>LedgerEntry</b> com hash encadeado SHA-256</li>
            <li>• Débito 1.2.1 / Crédito 2.1.1 (partidas dobradas)</li>
            <li>• Bloqueia se a reserva escolhida não tiver saldo</li>
            <li>• Limita pela capacidade total (10× capital base)</li>
            <li>• Cria <b>CreditGrant</b> rastreável por usuário</li>
          </ul>
        </div>
        <div className="card-premium p-5">
          <h4 className="text-xs uppercase tracking-widest text-ink-400 mb-2">Reserva Mestre</h4>
          <div className="text-2xl font-mono font-bold tabular-nums">{brl(bs?.reservaMestre?.disponivelEmissao)}</div>
          <div className="text-xs text-ink-400 mt-1">disponível para nova emissão</div>
        </div>
      </div>
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

  return (
    <div className="space-y-4">
      <div className={cn(
        'card-premium p-5 flex flex-wrap items-center justify-between gap-4',
        chain?.valida ? 'ring-1 ring-emerald-500/30' : 'ring-1 ring-red-500/30'
      )}>
        <div>
          <div className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-amber-300" />
            <span className="text-sm text-ink-300">Cadeia de hash</span>
          </div>
          <div className="font-display text-xl font-semibold mt-1">
            {chain?.quantidade ?? '?'} lançamentos · {chain?.valida ? '✓ íntegra' : '✗ comprometida'}
          </div>
        </div>
        <div className="text-xs text-ink-400 font-mono break-all max-w-md text-right">
          {chain?.mensagem}
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
                      #{e.sequencia}
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-white truncate">{e.descricao || e.tipo}</div>
                      <div className="text-xs text-ink-400 truncate">
                        DR {e.contaDebitoCodigo} → CR {e.contaCreditoCodigo} · {formatDate(e.dataLancamento || e.createdAt)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono tabular-nums text-sm">{brl(e.valor)}</span>
                    {isOpen ? <ChevronUp className="h-4 w-4 text-ink-400" /> : <ChevronDown className="h-4 w-4 text-ink-400" />}
                  </div>
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 pt-1 text-xs text-ink-300 space-y-1 border-t border-white/5">
                    <div><b>Hash atual:</b> <span className="font-mono break-all">{e.hashAtual}</span></div>
                    <div><b>Hash anterior:</b> <span className="font-mono break-all">{e.hashAnterior || '—'}</span></div>
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
