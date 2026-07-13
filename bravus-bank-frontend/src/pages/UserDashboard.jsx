import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowDownToLine, ArrowUpFromLine, ArrowRightLeft, Wallet, Eye, EyeOff,
  TrendingUp, TrendingDown, Activity, Receipt, CheckCircle2, AlertCircle,
  Send, Landmark, CreditCard, Percent,
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';
import { userService, authService } from '../services/api';
import BankIdentityCard from '../components/BankIdentityCard';
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
    case 'TRANSFER_EXTERNAL':
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

const EMPTY_FORM = {
  amount: '',
  description: '',
  destinationAccount: '',
  transferMode: 'internal',
  channel: 'PIX',
  beneficiaryName: '',
  beneficiaryDocument: '',
  bankCode: '',
  ispb: '',
  agency: '',
  accountNumber: '',
  accountDigit: '',
  accountType: 'CORRENTE',
  pixKey: '',
  pixKeyType: 'CPF',
};

// ============ Component ============
export default function UserDashboard() {
  const [profile, setProfile] = useState(null);
  const [me, setMe] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [creditSummary, setCreditSummary] = useState(null);
  const [externalOrders, setExternalOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showBalance, setShowBalance] = useState(true);

  const [tab, setTab] = useState('overview');
  const [form, setForm] = useState(EMPTY_FORM);
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
      const [profileRes, meRes, txRes, creditRes, externalRes] = await Promise.all([
        userService.getProfile(),
        userService.getMe().catch(() => ({ data: null })),
        userService.getTransactions(),
        userService.getCreditSummary().catch(() => ({ data: null })),
        userService.getExternalTransfers(8).catch(() => ({ data: [] })),
      ]);
      setProfile(profileRes.data);
      setMe(meRes?.data || null);
      setTransactions(Array.isArray(txRes.data) ? txRes.data : []);
      setCreditSummary(creditRes?.data || null);
      setExternalOrders(Array.isArray(externalRes?.data) ? externalRes.data : []);
    } catch (err) {
      setError('Erro ao carregar dados da conta.');
    } finally {
      setLoading(false);
    }
  };

  const cents = (v) => Math.round(parseFloat(v) * 100);

  const submit = async (kind) => {
    if (!form.amount || parseFloat(form.amount) <= 0) return setError('Digite um valor válido.');
    if (kind === 'transfer' && form.transferMode === 'internal' && !form.destinationAccount) {
      return setError('Informe conta, CPF, e-mail ou chave Pix Bravus de destino.');
    }
    if (kind === 'transfer' && form.transferMode === 'external') {
      if (!form.beneficiaryName || !form.beneficiaryDocument) {
        return setError('Informe nome e documento do beneficiário.');
      }
      if (form.channel === 'PIX' && !form.pixKey) {
        return setError('Informe a chave PIX do beneficiário.');
      }
      if (form.channel === 'TED' && (!form.bankCode || !form.agency || !form.accountNumber)) {
        return setError('Informe banco, agência e conta para TED.');
      }
    }
    setSubmitting(true);
    try {
      const amountCentavos = cents(form.amount);
      let message =
        kind === 'deposit' ? 'Depósito realizado.' :
        kind === 'withdraw' ? 'Saque realizado.' : 'Transferência enviada.';

      if (kind === 'deposit') await userService.deposit(amountCentavos, form.description);
      if (kind === 'withdraw') await userService.withdraw(amountCentavos, form.description);
      if (kind === 'transfer' && form.transferMode === 'internal') {
        await userService.transfer(amountCentavos, form.destinationAccount, form.description);
      }
      if (kind === 'transfer' && form.transferMode === 'external') {
        const { data } = await userService.externalTransfer({
          amountCentavos,
          channel: form.channel,
          beneficiaryName: form.beneficiaryName,
          beneficiaryDocument: form.beneficiaryDocument,
          bankCode: form.bankCode,
          ispb: form.ispb,
          agency: form.agency,
          accountNumber: form.accountNumber,
          accountDigit: form.accountDigit,
          accountType: form.accountType,
          pixKey: form.pixKey,
          pixKeyType: form.pixKeyType,
          description: form.description,
        });
        message = data?.status === 'PENDING_PROVIDER'
          ? 'Ordem registrada. Aguardando configuração do provedor Bravus.'
          : 'Transferência aceita pelo provedor Bravus e valor debitado.';
      }

      setSuccess(message);
      setForm(EMPTY_FORM);
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
      .filter((t) => ['WITHDRAWAL', 'TRANSFER_OUT', 'TRANSFER_EXTERNAL', 'PAYMENT'].includes(t.type))
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
  const creditAvailable = creditSummary?.creditoDisponivelCentavos ?? 0;
  const creditGranted = creditSummary?.creditoTotalConcedidoCentavos ?? 0;
  const creditUsed = creditSummary?.creditoTotalUsadoCentavos ?? 0;
  const creditLiquidated = creditSummary?.creditoTotalLiquidadoCentavos ?? 0;
  const creditDebtPrincipal = creditSummary?.dividaPrincipalCentavos ?? Math.max(0, creditGranted - creditLiquidated);
  const interestAccrued = creditSummary?.jurosAcumuladoCentavos ?? 0;
  const creditDebt = creditSummary?.dividaTotalCentavos ?? (creditDebtPrincipal + interestAccrued);
  const annualInterestRate = Number(creditSummary?.taxaJurosAnualMedia ?? 0);
  const monthlyInterestRate = Number(creditSummary?.taxaJurosMensalEquivalente ?? 0);

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
    <main className="container-app py-10 space-y-6">
      {/* ==== Bank Identity Card ==== */}
      {me && <BankIdentityCard me={me} />}

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

          <div className="mt-5 grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <div className="flex items-center gap-2 text-xs text-ink-300">
                <CreditCard className="h-4 w-4 text-bravus-200" /> Crédito disponível
              </div>
              <div className="mt-1 font-display text-lg font-semibold tabular-nums">
                {showBalance ? formatCurrency(creditAvailable) : 'R$ ••••••'}
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <div className="flex items-center gap-2 text-xs text-ink-300">
                <Landmark className="h-4 w-4 text-red-200" /> Dívida total
              </div>
              <div className="mt-1 font-display text-lg font-semibold tabular-nums text-red-100">
                {showBalance ? formatCurrency(creditDebt) : 'R$ ••••••'}
              </div>
              <div className="mt-1 text-[11px] text-ink-400">
                Principal {showBalance ? formatCurrency(creditDebtPrincipal) : 'R$ •••'} + juros
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <div className="flex items-center gap-2 text-xs text-ink-300">
                <Activity className="h-4 w-4 text-emerald-200" /> Juros acumulados
              </div>
              <div className="mt-1 font-display text-lg font-semibold tabular-nums">
                {showBalance ? formatCurrency(interestAccrued) : 'R$ ••••••'}
              </div>
              <div className="mt-1 text-[11px] text-ink-400">
                Usado {showBalance ? formatCurrency(creditUsed) : 'R$ •••'}
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <div className="flex items-center gap-2 text-xs text-ink-300">
                <Percent className="h-4 w-4 text-amber-200" /> Taxa do crédito
              </div>
              <div className="mt-1 font-display text-lg font-semibold tabular-nums">
                {annualInterestRate.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}% a.a.
              </div>
              <div className="mt-1 text-[11px] text-ink-400">
                {monthlyInterestRate.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}% a.m. simples
              </div>
            </div>
          </div>

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
          <div className="card-premium p-6 max-w-3xl">
            <h3 className="title-md mb-1">
              {tab === 'deposit' ? 'Novo depósito' : tab === 'withdraw' ? 'Novo saque' : 'Nova transferência'}
            </h3>
            <p className="text-sm text-ink-300 mb-5">
              {tab === 'transfer' ? 'Envie para conta Bravus ou registre PIX/TED pelo provedor Bravus.' : 'Operação em conta corrente.'}
            </p>

            <div className="space-y-4">
              {tab === 'transfer' && (
                <div>
                  <label className="form-label">Destino</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, transferMode: 'internal' })}
                      className={cn(
                        'btn-secondary justify-center',
                        form.transferMode === 'internal' && '!bg-white/15 !text-white'
                      )}
                    >
                      <ArrowRightLeft className="h-4 w-4" /> Conta Bravus
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, transferMode: 'external' })}
                      className={cn(
                        'btn-secondary justify-center',
                        form.transferMode === 'external' && '!bg-white/15 !text-white'
                      )}
                    >
                      <Send className="h-4 w-4" /> PIX/TED Bravus
                    </button>
                  </div>
                </div>
              )}

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

              {tab === 'transfer' && form.transferMode === 'internal' && (
                <div>
                  <label className="form-label">Destino Bravus</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Conta, CPF, e-mail, usuário ou chave Pix"
                    value={form.destinationAccount}
                    onChange={(e) => setForm({ ...form, destinationAccount: e.target.value })}
                  />
                </div>
              )}

              {tab === 'transfer' && form.transferMode === 'external' && (
                <div className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="form-label">Canal</label>
                      <select
                        className="form-input"
                        value={form.channel}
                        onChange={(e) => setForm({ ...form, channel: e.target.value })}
                      >
                        <option value="PIX">PIX</option>
                        <option value="TED">TED</option>
                      </select>
                    </div>
                    <div>
                      <label className="form-label">Documento do beneficiário</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="CPF ou CNPJ"
                        value={form.beneficiaryDocument}
                        onChange={(e) => setForm({ ...form, beneficiaryDocument: e.target.value })}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="form-label">Nome do beneficiário</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Nome completo ou razão social"
                      value={form.beneficiaryName}
                      onChange={(e) => setForm({ ...form, beneficiaryName: e.target.value })}
                    />
                  </div>

                  {form.channel === 'PIX' ? (
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <label className="form-label">Tipo de chave PIX</label>
                        <select
                          className="form-input"
                          value={form.pixKeyType}
                          onChange={(e) => setForm({ ...form, pixKeyType: e.target.value })}
                        >
                          <option value="CPF">CPF</option>
                          <option value="CNPJ">CNPJ</option>
                          <option value="EMAIL">E-mail</option>
                          <option value="PHONE">Telefone</option>
                          <option value="EVP">Chave aleatória</option>
                        </select>
                      </div>
                      <div>
                        <label className="form-label">Chave PIX</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="Chave do beneficiário"
                          value={form.pixKey}
                          onChange={(e) => setForm({ ...form, pixKey: e.target.value })}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="grid sm:grid-cols-3 gap-4">
                      <div>
                        <label className="form-label">Banco</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="001"
                          value={form.bankCode}
                          onChange={(e) => setForm({ ...form, bankCode: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="form-label">Agência</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="0001"
                          value={form.agency}
                          onChange={(e) => setForm({ ...form, agency: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="form-label">Conta</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="12345678"
                          value={form.accountNumber}
                          onChange={(e) => setForm({ ...form, accountNumber: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="form-label">Dígito</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="9"
                          value={form.accountDigit}
                          onChange={(e) => setForm({ ...form, accountDigit: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="form-label">Tipo de conta</label>
                        <select
                          className="form-input"
                          value={form.accountType}
                          onChange={(e) => setForm({ ...form, accountType: e.target.value })}
                        >
                          <option value="CORRENTE">Corrente</option>
                          <option value="POUPANCA">Poupança</option>
                          <option value="PAGAMENTO">Pagamento</option>
                        </select>
                      </div>
                      <div>
                        <label className="form-label">ISPB (opcional)</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="00000000"
                          value={form.ispb}
                          onChange={(e) => setForm({ ...form, ispb: e.target.value })}
                        />
                      </div>
                    </div>
                  )}
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

              {tab === 'transfer' && externalOrders.length > 0 && (
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                  <div className="text-sm font-semibold text-white mb-3">Ordens Bravus recentes</div>
                  <ul className="space-y-2">
                    {externalOrders.slice(0, 4).map((order) => (
                      <li key={order.id} className="flex items-center justify-between gap-3 text-sm">
                        <span className="min-w-0 truncate text-ink-200">
                          {order.channel} · {order.beneficiaryName}
                        </span>
                        <span className="shrink-0 text-ink-300">
                          {formatCurrency(order.amountCentavos)} · {order.status}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
