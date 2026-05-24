import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowDownToLine, ArrowUpFromLine, ArrowRightLeft, Wallet, Eye, EyeOff,
  TrendingUp, TrendingDown, Activity, Receipt, CheckCircle2, AlertCircle,
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';
import { userService, authService } from '../services/api';
import {
  formatCurrency, formatDate, getTransactionTypeLabel,
} from '../utils/helpers';
import { cn } from '../lib/cn';

// ============ Helpers ============
const txIcon = (type) => {
  switch (type) {
    case 'DEPOSIT':
    case 'TRANSFER_IN':
      return { Icon: ArrowDownToLine, color: 'text-emerald-300', bg: 'bg-emerald-400/10' };
    case 'WITHDRAWAL':
    case 'TRANSFER_OUT':
      return { Icon: ArrowUpFromLine, color: 'text-red-300', bg: 'bg-red-400/10' };
    case 'PAYMENT':
      return { Icon: Receipt, color: 'text-amber-300', bg: 'bg-amber-400/10' };
    default:
      return { Icon: Activity, color: 'text-ink-300', bg: 'bg-white/5' };
  }
};

const txSignClass = (type) =>
  ['DEPOSIT', 'TRANSFER_IN'].includes(type) ? 'text-emerald-300' : 'text-red-300';
const txSign = (type) =>
  ['DEPOSIT', 'TRANSFER_IN'].includes(type) ? '+' : '-';

// ============ Component ============
export default function UserDashboard() {
  const [profile, setProfile] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showBalance, setShowBalance] = useState(true);

  const [tab, setTab] = useState('overview');
  const [form, setForm] = useState({ amount: '', description: '', destinationAccount: '' });
  const [submitting, setSubmitting] = useState(false);

  const user = authService.getCurrentUser();

  useEffect(() => { loadData(); }, []);
  useEffect(() => {
    if (success || error) {
      const t = setTimeout(() => { setSuccess(''); setError(''); }, 4500);
      return () => clearTimeout(t);
    }
  }, [success, error]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [profileRes, txRes] = await Promise.all([
        userService.getProfile(),
        userService.getTransactions(),
      ]);
      setProfile(profileRes.data);
      setTransactions(Array.isArray(txRes.data) ? txRes.data : []);
    } catch (err) {
      setError('Erro ao carregar dados da conta.');
    } finally {
      setLoading(false);
    }
  };

  const cents = (v) => Math.round(parseFloat(v) * 100);

  const submit = async (kind) => {
    if (!form.amount || parseFloat(form.amount) <= 0) return setError('Digite um valor válido.');
    if (kind === 'transfer' && !form.destinationAccount) return setError('Informe a conta de destino.');
    setSubmitting(true);
    try {
      if (kind === 'deposit') await userService.deposit(cents(form.amount), form.description);
      if (kind === 'withdraw') await userService.withdraw(cents(form.amount), form.description);
      if (kind === 'transfer') await userService.transfer(cents(form.amount), form.destinationAccount, form.description);
      setSuccess(
        kind === 'deposit' ? 'Depósito realizado.' :
        kind === 'withdraw' ? 'Saque realizado.' : 'Transferência enviada.'
      );
      setForm({ amount: '', description: '', destinationAccount: '' });
      await loadData();
      setTab('overview');
    } catch (err) {
      const msg = err?.response?.data?.message || err?.response?.data || 'Falha na operação.';
      setError(typeof msg === 'string' ? msg : 'Falha na operação.');
    } finally {
      setSubmitting(false);
    }
  };

  // ====== Computed ======
  const stats = useMemo(() => {
    const inflow = transactions
      .filter((t) => ['DEPOSIT', 'TRANSFER_IN'].includes(t.type))
      .reduce((acc, t) => acc + (t.amount || 0), 0);
    const outflow = transactions
      .filter((t) => ['WITHDRAWAL', 'TRANSFER_OUT', 'PAYMENT'].includes(t.type))
      .reduce((acc, t) => acc + (t.amount || 0), 0);
    return { inflow, outflow, count: transactions.length };
  }, [transactions]);

  const chartData = useMemo(() => {
    // last 7 days running balance approximation
    const days = [...Array(7)].map((_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (6 - i));
      return { key: d.toISOString().slice(0, 10), label: d.toLocaleDateString('pt-BR', { weekday: 'short' }), value: 0 };
    });
    transactions.forEach((t) => {
      const k = (t.createdAt || t.date || '').slice(0, 10);
      const found = days.find((d) => d.key === k);
      if (found) {
        const signed = ['DEPOSIT', 'TRANSFER_IN'].includes(t.type) ? (t.amount || 0) : -(t.amount || 0);
        found.value += signed;
      }
    });
    // running cumulative
    let acc = 0;
    return days.map((d) => { acc += d.value; return { ...d, saldo: acc / 100 }; });
  }, [transactions]);

  // ====== UI ======
  if (loading) {
    return (
      <main className="container-app py-10 space-y-6">
        <div className="skeleton h-32" />
        <div className="grid md:grid-cols-3 gap-5">
          {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-24" />)}
        </div>
        <div className="skeleton h-80" />
      </main>
    );
  }

  const balance = profile?.balance ?? 0;
  const accountNumber = profile?.accountNumber || profile?.customerCode || '0000-0000-00';

  const Tab = ({ id, label, icon: Icon }) => (
    <button
      onClick={() => setTab(id)}
      className={cn(
        'inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition',
        tab === id ? 'bg-white/10 text-white shadow-card' : 'text-ink-300 hover:text-white hover:bg-white/5'
      )}
    >
      <Icon className="h-4 w-4" /> {label}
    </button>
  );

  return (
    <main className="container-app py-10">
      {/* ==== Greeting + Balance ==== */}
      <div className="grid lg:grid-cols-3 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="lg:col-span-2 card-premium p-8 relative overflow-hidden"
        >
          <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-gradient-gold opacity-15 blur-3xl" />
          <div className="text-xs uppercase tracking-widest text-ink-300">
            Olá, <span className="text-white">{user?.fullName || user?.username}</span>
          </div>
          <div className="mt-2 flex items-center gap-3">
            <div className="text-sm text-ink-300">Saldo disponível</div>
            <button onClick={() => setShowBalance((v) => !v)} className="text-ink-400 hover:text-white transition">
              {showBalance ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </button>
          </div>
          <div className="mt-1 font-display tabular-nums text-5xl font-bold">
            {showBalance ? (
              <>R$ <span className="gradient-text">{formatCurrency(balance).replace('R$', '').trim()}</span></>
            ) : (
              <span className="text-ink-400">R$ ••••••</span>
            )}
          </div>
          <div className="mt-2 text-xs text-ink-400 font-mono">Conta {accountNumber}</div>

          <div className="mt-6 flex flex-wrap gap-2">
            <button onClick={() => setTab('deposit')} className="btn-secondary"><ArrowDownToLine className="h-4 w-4" /> Depositar</button>
            <button onClick={() => setTab('withdraw')} className="btn-secondary"><ArrowUpFromLine className="h-4 w-4" /> Sacar</button>
            <button onClick={() => setTab('transfer')} className="btn-primary"><ArrowRightLeft className="h-4 w-4" /> Transferir</button>
          </div>
        </motion.div>

        {/* Stats stack */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-1 gap-4">
          <div className="card-premium p-5 flex items-center gap-4">
            <div className="h-11 w-11 rounded-xl bg-emerald-400/15 text-emerald-300 inline-flex items-center justify-center">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs text-ink-300">Entradas</div>
              <div className="font-display text-lg font-semibold tabular-nums">{formatCurrency(stats.inflow)}</div>
            </div>
          </div>
          <div className="card-premium p-5 flex items-center gap-4">
            <div className="h-11 w-11 rounded-xl bg-red-400/15 text-red-300 inline-flex items-center justify-center">
              <TrendingDown className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs text-ink-300">Saídas</div>
              <div className="font-display text-lg font-semibold tabular-nums">{formatCurrency(stats.outflow)}</div>
            </div>
          </div>
          <div className="card-premium p-5 flex items-center gap-4">
            <div className="h-11 w-11 rounded-xl bg-bravus-400/15 text-bravus-200 inline-flex items-center justify-center">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs text-ink-300">Transações</div>
              <div className="font-display text-lg font-semibold tabular-nums">{stats.count}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Alerts */}
      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-5">
            <div className="alert-error inline-flex items-center gap-2"><AlertCircle className="h-4 w-4" /> {error}</div>
          </motion.div>
        )}
        {success && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-5">
            <div className="alert-success inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> {success}</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tabs */}
      <div className="mt-8 flex flex-wrap gap-2">
        <Tab id="overview" label="Visão geral" icon={Wallet} />
        <Tab id="deposit" label="Depósito" icon={ArrowDownToLine} />
        <Tab id="withdraw" label="Saque" icon={ArrowUpFromLine} />
        <Tab id="transfer" label="Transferência" icon={ArrowRightLeft} />
      </div>

      {/* Content */}
      <div className="mt-6">
        {tab === 'overview' && (
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Chart */}
            <div className="lg:col-span-2 card-premium p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="title-md">Movimentação · 7 dias</h3>
                  <p className="text-xs text-ink-400 mt-0.5">Saldo acumulado por dia</p>
                </div>
              </div>
              <div className="h-64">
                <ResponsiveContainer>
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#eecb54" stopOpacity={0.5} />
                        <stop offset="100%" stopColor="#eecb54" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#ffffff10" vertical={false} />
                    <XAxis dataKey="label" stroke="#8a93ac" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#8a93ac" fontSize={12} tickLine={false} axisLine={false} width={50} />
                    <Tooltip
                      contentStyle={{ background: '#0b0f1c', border: '1px solid #ffffff20', borderRadius: 12 }}
                      labelStyle={{ color: '#fff' }}
                      formatter={(v) => [`R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'Saldo']}
                    />
                    <Area type="monotone" dataKey="saldo" stroke="#eecb54" strokeWidth={2} fill="url(#g1)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Transactions list */}
            <div className="card-premium p-6">
              <h3 className="title-md mb-4">Últimas transações</h3>
              {transactions.length === 0 ? (
                <p className="text-sm text-ink-300">Nenhuma transação ainda.</p>
              ) : (
                <ul className="space-y-3">
                  {transactions.slice(0, 8).map((t, idx) => {
                    const { Icon, color, bg } = txIcon(t.type);
                    return (
                      <li key={t.id || idx} className="flex items-center gap-3">
                        <div className={cn('h-9 w-9 rounded-lg inline-flex items-center justify-center', bg)}>
                          <Icon className={cn('h-4 w-4', color)} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-white truncate">{getTransactionTypeLabel(t.type)}</div>
                          <div className="text-xs text-ink-400">{formatDate(t.createdAt || t.date)}</div>
                        </div>
                        <div className={cn('text-sm font-medium tabular-nums', txSignClass(t.type))}>
                          {txSign(t.type)} {formatCurrency(t.amount)}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        )}

        {/* Forms */}
        {(tab === 'deposit' || tab === 'withdraw' || tab === 'transfer') && (
          <div className="card-premium p-6 max-w-xl">
            <h3 className="title-md mb-1">
              {tab === 'deposit' ? 'Novo depósito' : tab === 'withdraw' ? 'Novo saque' : 'Nova transferência'}
            </h3>
            <p className="text-sm text-ink-300 mb-5">
              {tab === 'transfer' ? 'Envie para outra conta Bravus.' : 'Operação em conta corrente.'}
            </p>

            <div className="space-y-4">
              <div>
                <label className="form-label">Valor (R$)</label>
                <input
                  type="number" step="0.01" min="0"
                  className="form-input"
                  placeholder="0,00"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                />
              </div>

              {tab === 'transfer' && (
                <div>
                  <label className="form-label">Conta de destino</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="0000000000"
                    value={form.destinationAccount}
                    onChange={(e) => setForm({ ...form, destinationAccount: e.target.value })}
                  />
                </div>
              )}

              <div>
                <label className="form-label">Descrição (opcional)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ex: Pagamento aluguel"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>

              <button
                disabled={submitting}
                onClick={() => submit(tab)}
                className="btn-primary w-full"
              >
                {submitting ? 'Processando...' : (
                  tab === 'deposit' ? 'Confirmar depósito' :
                  tab === 'withdraw' ? 'Confirmar saque' : 'Confirmar transferência'
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
