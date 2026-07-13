import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowDownToLine, ArrowUpFromLine, ArrowRightLeft, Wallet, Eye, EyeOff,
  TrendingUp, TrendingDown, Activity, Receipt, CheckCircle2, AlertCircle,
  Send, Landmark, CreditCard, Percent,
  FileText, Barcode, CalendarDays, LineChart, UserCheck, UsersRound,
  ClipboardCheck, ShieldCheck, Smartphone, Building2, List, Grid3X3,
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
  destinationNetwork: 'PIX_BR',
  pixKey: '',
  pixKeyType: 'CPF',
};

const operationErrorMessage = (err, fallback = 'Falha na operacao.') => {
  const data = err?.response?.data;
  if (typeof data === 'string') return data;
  return data?.message || fallback;
};

const isCreditTransaction = (type) => ['DEPOSIT', 'TRANSFER_IN'].includes(type);

const receiptIdForTransaction = (tx) =>
  tx?.receiptOrderId || tx?.externalOrderId || tx?.orderId || tx?.transferOrderId || null;

const transactionCounterparty = (tx) => {
  const credit = isCreditTransaction(tx?.type);
  const label = credit ? 'De' : 'Para';
  const name =
    (credit ? tx?.senderName : tx?.receiverName)
    || tx?.counterpartyName
    || tx?.beneficiaryName
    || tx?.payerName
    || '';
  const document =
    (credit ? tx?.senderDocument : tx?.receiverDocument)
    || tx?.counterpartyDocument
    || tx?.beneficiaryDocument
    || tx?.payerDocument
    || '';
  const account =
    (credit ? tx?.senderAccountNumber : tx?.receiverAccountNumber)
    || (credit ? tx?.senderAccount : tx?.receiverAccount)
    || tx?.counterpartyAccount
    || tx?.destinationAccount
    || '';
  const bank =
    (credit ? tx?.senderBankName : tx?.receiverBankName)
    || tx?.counterpartyBankName
    || tx?.bankName
    || '';
  const detail = [
    document && `Doc ${document}`,
    account && `Conta ${account}`,
    bank,
  ].filter(Boolean).join(' | ');
  return { label, name, document, account, bank, detail };
};

// ============ Component ============
export default function UserDashboard() {
  const [profile, setProfile] = useState(null);
  const [me, setMe] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [creditSummary, setCreditSummary] = useState(null);
  const [externalOrders, setExternalOrders] = useState([]);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [receiptLoading, setReceiptLoading] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showBalance, setShowBalance] = useState(true);
  const [portalView, setPortalView] = useState('icons');
  const [activeModule, setActiveModule] = useState('balances');

  const [tab, setTab] = useState('overview');
  const [form, setForm] = useState(EMPTY_FORM);
  const [resolvedRecipient, setResolvedRecipient] = useState(null);
  const [resolveLoading, setResolveLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const user = authService.getCurrentUser();

  useEffect(() => { loadData(); }, []);
  useEffect(() => {
    if (success || error) {
      const t = setTimeout(() => { setSuccess(''); setError(''); }, 4500);
      return () => clearTimeout(t);
    }
  }, [success, error]);

  useEffect(() => {
    const destination = form.destinationAccount.trim();
    if (tab !== 'transfer' || form.transferMode !== 'internal' || destination.length < 3) {
      setResolvedRecipient(null);
      setResolveLoading(false);
      return undefined;
    }
    let active = true;
    setResolveLoading(true);
    const timer = setTimeout(async () => {
      try {
        const { data } = await userService.resolveTransferDestination(destination);
        if (active) setResolvedRecipient(data);
      } catch {
        if (active) setResolvedRecipient(null);
      } finally {
        if (active) setResolveLoading(false);
      }
    }, 350);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [tab, form.transferMode, form.destinationAccount]);

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
      if (kind === 'transfer' && form.transferMode === 'external' && !['PIX', 'TED'].includes(form.channel) && !form.accountNumber) {
        return setError('Informe a conta beneficiaria para o canal selecionado.');
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
        const { data } = await userService.transfer(amountCentavos, form.destinationAccount, form.description);
        if (data?.provider === 'BRAVUS_INTERNAL_LEDGER') {
          message = 'Transferencia Bravus liquidada na hora.';
        }
        if (data?.provider === 'BRAVUS_SELF_PROVIDER') {
          message = data?.settlementStatus === 'LIQUIDADA_CONFIRMADA'
            ? 'Pagamento liquidado pelo provedor Bravus.'
            : 'Pagamento debitado no Bravus. Aguardando confirmacao do destino.';
        }
        const receiptOrderId = data?.receiptOrderId || data?.externalOrderId || data?.orderId || data?.id;
        if (receiptOrderId) {
          const receiptRes = await userService.getExternalTransferReceipt(receiptOrderId).catch(() => ({ data: null }));
          if (receiptRes?.data) setSelectedReceipt(receiptRes.data);
        }
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
          destinationNetwork: form.destinationNetwork,
          pixKey: form.pixKey,
          pixKeyType: form.pixKeyType,
          description: form.description,
        });
        message = data?.status === 'PENDING_PROVIDER'
          ? 'Ordem registrada. Aguardando configuração do provedor Bravus.'
          : 'Transferência aceita pelo provedor Bravus e valor debitado.';
        if (data?.status !== 'PENDING_PROVIDER') {
          message = data?.settlementStatus === 'LIQUIDADA_CONFIRMADA'
            ? 'Transferencia liquidada no destino confirmado.'
            : 'Transferencia debitada no Bravus. Aguardando confirmacao do destino.';
        }
        const receiptOrderId = data?.receiptOrderId || data?.externalOrderId || data?.orderId || data?.id;
        if (receiptOrderId) {
          const receiptRes = await userService.getExternalTransferReceipt(receiptOrderId).catch(() => ({ data: null }));
          if (receiptRes?.data) setSelectedReceipt(receiptRes.data);
        }
      }

      setSuccess(message);
      setForm(EMPTY_FORM);
      setResolvedRecipient(null);
      await loadData();
      setTab('overview');
    } catch (err) {
      setError(operationErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const openReceipt = async (orderId) => {
    setReceiptLoading(orderId);
    setError('');
    try {
      const { data } = await userService.getExternalTransferReceipt(orderId);
      setSelectedReceipt(data);
    } catch (err) {
      setError(operationErrorMessage(err, 'Falha ao carregar comprovante.'));
    } finally {
      setReceiptLoading(null);
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

  const openTransferMode = (transferMode = 'internal', channel = 'PIX') => {
    setForm({
      ...EMPTY_FORM,
      transferMode,
      channel,
      destinationNetwork:
        channel === 'PIX' ? 'PIX_BR'
        : channel === 'TED' ? 'TED_BR'
        : channel,
    });
    setTab('transfer');
  };

  const bankingModules = [
    { id: 'balances', label: 'Saldos e Extratos', Icon: FileText, badge: `${transactions.length} movs` },
    { id: 'payments', label: 'Pagamentos', Icon: Barcode, badge: 'PIX e contas', accent: true },
    { id: 'transfers', label: 'Transferencias', Icon: ArrowRightLeft, badge: 'Bravus e bancos' },
    { id: 'dda', label: 'DDA Boletos Registrados', Icon: ClipboardCheck, badge: '0 pendentes' },
    { id: 'cards', label: 'Cartoes', Icon: CreditCard, badge: 'Conta ativa' },
    { id: 'credit', label: 'Emprestimos e Recebiveis', Icon: Landmark, badge: showBalance ? formatCurrency(creditAvailable) : 'R$ ******', accent: true },
    { id: 'deposit-check', label: 'Deposito de Cheque', Icon: ArrowDownToLine, badge: 'Digital' },
    { id: 'checks', label: 'Cheques', Icon: FileText, badge: '0 folhas' },
    { id: 'schedules', label: 'Agendamentos', Icon: CalendarDays, badge: '0 hoje' },
    { id: 'investments', label: 'Investimentos', Icon: LineChart, badge: 'Carteira' },
    { id: 'pending', label: 'Pendencias', Icon: UserCheck, badge: me?.conta?.statusKyc || 'Conta' },
    { id: 'beneficiaries', label: 'Favorecidos', Icon: UsersRound, badge: `${externalOrders.length} recentes` },
    { id: 'pix', label: 'Pix', Icon: Send, badge: me?.dadosBancarios?.tipoChavePix || 'Chave' },
    { id: 'receipts', label: 'Comprovantes', Icon: Receipt, badge: `${externalOrders.length} ordens` },
    { id: 'limits', label: 'Limites', Icon: Smartphone, badge: showBalance ? formatCurrency(me?.saldos?.limitePixDiarioCentavos ?? 0) : 'R$ ******' },
    { id: 'security', label: 'Seguranca', Icon: ShieldCheck, badge: 'Ativa' },
  ];

  const handleModuleClick = (moduleId) => {
    setActiveModule(moduleId);
    if (moduleId === 'balances') setTab('overview');
    if (moduleId === 'payments' || moduleId === 'pix') openTransferMode('external', 'PIX');
    if (moduleId === 'transfers') openTransferMode('internal', 'PIX');
    if (moduleId === 'deposit-check') setTab('deposit');
    if (moduleId === 'credit') openTransferMode('external', 'PIX');
    if (moduleId === 'receipts') setTab('overview');
  };

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

      <BankingAccessPanel
        user={user}
        me={me}
        profile={profile}
        modules={bankingModules}
        view={portalView}
        setView={setPortalView}
        activeModule={activeModule}
        onModuleClick={handleModuleClick}
        transactions={transactions}
        externalOrders={externalOrders}
        creditSummary={creditSummary}
        showBalance={showBalance}
        openReceipt={openReceipt}
        receiptLoading={receiptLoading}
        openTransferMode={openTransferMode}
        setTab={setTab}
      />

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
                    return (
                      <TransactionListItem
                        key={t.id || idx}
                        tx={t}
                        openReceipt={openReceipt}
                        receiptLoading={receiptLoading}
                      />
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
                        }}
                      >
                        <option value="PIX">PIX</option>
                        <option value="TED">TED</option>
                        <option value="SWIFT">SWIFT</option>
                        <option value="ACH">ACH</option>
                        <option value="SEPA">SEPA</option>
                        <option value="CAYMAN_RAIL">Cayman Rail</option>
                        <option value="GLOBAL">Global</option>
                      </select>
                    </div>
                    <div>
                      <label className="form-label">Rede destino</label>
                      <select
                        className="form-input"
                        value={form.destinationNetwork}
                        onChange={(e) => setForm({ ...form, destinationNetwork: e.target.value })}
                      >
                        <option value="PIX_BR">PIX_BR</option>
                        <option value="TED_BR">TED_BR</option>
                        <option value="SWIFT">SWIFT</option>
                        <option value="ACH">ACH</option>
                        <option value="SEPA">SEPA</option>
                        <option value="CAYMAN_RAIL">CAYMAN_RAIL</option>
                        <option value="GLOBAL">GLOBAL</option>
                        <option value="INTERNAL_BRAVUS">INTERNAL_BRAVUS</option>
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

              {tab === 'transfer' && (
                <TransferRecipientPreview
                  form={form}
                  resolvedRecipient={resolvedRecipient}
                  resolveLoading={resolveLoading}
                />
              )}

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
                        <span className="shrink-0 text-ink-300">{formatCurrency(order.amountCentavos)} - {order.settlementStatus || order.status}</span>
                        <button
                          type="button"
                          className="btn-secondary !py-1.5 !px-2.5"
                          disabled={receiptLoading === order.id}
                          onClick={() => openReceipt(order.id)}
                        >
                          <Receipt className="h-4 w-4" />
                          Comprovante
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {selectedReceipt && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="w-full max-w-2xl rounded-2xl border border-white/15 bg-ink-950 p-6 shadow-2xl"
              initial={{ scale: 0.96, y: 12 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 12 }}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="pill-gold mb-2">
                    <Receipt className="h-3.5 w-3.5" />
                    Comprovante Bravus
                  </div>
                  <h3 className="title-md">{formatCurrency(selectedReceipt.amountCentavos)}</h3>
                  <p className="mt-1 text-sm text-ink-300">
                    {selectedReceipt.channel} · {selectedReceipt.status} · {selectedReceipt.settlementStatus}
                  </p>
                </div>
                <button type="button" className="btn-secondary !py-2 !px-3" onClick={() => setSelectedReceipt(null)}>
                  Fechar
                </button>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <ReceiptBlock title="Pagador" party={selectedReceipt.payer} />
                <ReceiptBlock title="Recebedor" party={selectedReceipt.beneficiary} />
              </div>

              <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm">
                <ReceiptLine label="Comprovante" value={selectedReceipt.receiptId} />
                <ReceiptLine label="Tipo" value={selectedReceipt.receiptKind} />
                <ReceiptLine label="Transação" value={selectedReceipt.transactionId} />
                <ReceiptLine label="Provedor" value={selectedReceipt.provider} />
                <ReceiptLine label="ID provedor" value={selectedReceipt.providerTransferId} />
                <ReceiptLine label="Rede destino" value={selectedReceipt.destinationNetwork} />
                <ReceiptLine label="Participante" value={selectedReceipt.destinationParticipantCode} />
                <ReceiptLine label="Confirmacao destino" value={selectedReceipt.destinationConfirmationId} />
                <ReceiptLine label="Confirmado em" value={formatDate(selectedReceipt.destinationConfirmedAt)} />
                <ReceiptLine label="Liquidacao" value={selectedReceipt.settlementMessage} />
                <ReceiptLine label="Idempotência" value={selectedReceipt.idempotencyKey} />
                <ReceiptLine label="Data" value={formatDate(selectedReceipt.createdAt)} />
                <ReceiptLine label="Descrição" value={selectedReceipt.description || 'Transferência Bravus'} />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

function BankingAccessPanel({
  user, me, profile, modules, view, setView, activeModule, onModuleClick,
  transactions, externalOrders, creditSummary, showBalance, openReceipt,
  receiptLoading, openTransferMode, setTab,
}) {
  const active = modules.find((module) => module.id === activeModule) || modules[0];
  const account = me?.dadosBancarios || {};
  const companyName = profile?.fullName || user?.fullName || user?.username || 'Cliente Bravus';
  const document = profile?.cpf || user?.cpf || me?.cpf;

  return (
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
      <div className="grid lg:grid-cols-[1fr_auto] gap-4 border-b border-white/10 bg-white/[0.06] px-5 py-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-amber-300/80">
            <Building2 className="h-4 w-4" />
            Acesso bancario
          </div>
          <div className="mt-3 text-2xl font-display font-semibold">
            Ola, <span className="text-amber-200">{companyName}</span>
          </div>
          <div className="mt-3 grid gap-1 text-sm text-ink-300 sm:grid-cols-2 lg:grid-cols-4">
            <span>Banco {account.codigoBanco || profile?.codigoBanco || '999'}</span>
            <span>Agencia {account.agencia || profile?.agencia || '0001'}</span>
            <span>Conta {account.contaFormatada || account.conta || profile?.accountNumber || '-'}</span>
            <span>CPF/CNPJ {document || '-'}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start rounded-xl border border-white/10 bg-black/20 p-1">
          <button
            type="button"
            className={cn('inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm transition',
              view === 'list' ? 'bg-white/12 text-white' : 'text-ink-300 hover:text-white')}
            onClick={() => setView('list')}
          >
            <List className="h-4 w-4" />
            Lista
          </button>
          <button
            type="button"
            className={cn('inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm transition',
              view === 'icons' ? 'bg-gradient-gold text-[#05122f]' : 'text-ink-300 hover:text-white')}
            onClick={() => setView('icons')}
          >
            <Grid3X3 className="h-4 w-4" />
            Icones
          </button>
        </div>
      </div>

      <div className="p-5">
        {view === 'icons' ? (
          <div className="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 lg:grid-cols-8">
            {modules.map((module) => (
              <ModuleIconButton
                key={module.id}
                module={module}
                active={module.id === activeModule}
                onClick={() => onModuleClick(module.id)}
              />
            ))}
          </div>
        ) : (
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            {modules.map((module) => (
              <ModuleListButton
                key={module.id}
                module={module}
                active={module.id === activeModule}
                onClick={() => onModuleClick(module.id)}
              />
            ))}
          </div>
        )}

        <PortalModuleDetail
          module={active}
          activeModule={activeModule}
          transactions={transactions}
          externalOrders={externalOrders}
          creditSummary={creditSummary}
          showBalance={showBalance}
          openReceipt={openReceipt}
          receiptLoading={receiptLoading}
          openTransferMode={openTransferMode}
          setTab={setTab}
          me={me}
        />
      </div>
    </section>
  );
}

function ModuleIconButton({ module, active, onClick }) {
  const Icon = module.Icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-h-[138px] flex-col items-center text-center"
    >
      <span className={cn(
        'inline-flex h-16 w-16 items-center justify-center rounded-full border shadow-lg transition',
        active || module.accent
          ? 'border-amber-300/40 bg-gradient-gold text-[#05122f] shadow-amber-500/20'
          : 'border-white/10 bg-white/[0.07] text-amber-200 group-hover:bg-white/[0.12]'
      )}>
        <Icon className="h-7 w-7" />
      </span>
      <span className="mt-3 flex min-h-[34px] max-w-[104px] items-center justify-center text-xs font-semibold leading-tight text-ink-100">
        {module.label}
      </span>
      <span className="mt-1 max-w-[112px] truncate text-[11px] text-ink-400">{module.badge}</span>
    </button>
  );
}

function ModuleListButton({ module, active, onClick }) {
  const Icon = module.Icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex min-h-[68px] items-center gap-3 rounded-xl border px-3 text-left transition',
        active
          ? 'border-amber-300/40 bg-amber-300/12'
          : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.07]'
      )}
    >
      <span className={cn(
        'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full',
        active || module.accent ? 'bg-gradient-gold text-[#05122f]' : 'bg-white/[0.08] text-amber-200'
      )}>
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-ink-100">{module.label}</span>
        <span className="block truncate text-xs text-ink-400">{module.badge}</span>
      </span>
    </button>
  );
}

function PortalModuleDetail({
  module, activeModule, transactions, externalOrders, creditSummary, showBalance,
  openReceipt, receiptLoading, openTransferMode, setTab, me,
}) {
  const latestTx = transactions.slice(0, 4);
  const latestOrders = externalOrders.slice(0, 4);

  return (
    <div className="mt-6 rounded-xl border border-white/10 bg-black/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-widest text-ink-400">Modulo selecionado</div>
          <div className="mt-1 text-lg font-display font-semibold text-white">{module?.label}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          {(activeModule === 'payments' || activeModule === 'pix') && (
            <button type="button" className="btn-primary !py-2 !px-3" onClick={() => openTransferMode('external', 'PIX')}>
              <Send className="h-4 w-4" />
              Pagar
            </button>
          )}
          {activeModule === 'transfers' && (
            <>
              <button type="button" className="btn-secondary !py-2 !px-3" onClick={() => openTransferMode('internal', 'PIX')}>Bravus</button>
              <button type="button" className="btn-primary !py-2 !px-3" onClick={() => openTransferMode('external', 'PIX')}>Outros bancos</button>
            </>
          )}
          {activeModule === 'deposit-check' && (
            <button type="button" className="btn-primary !py-2 !px-3" onClick={() => setTab('deposit')}>
              <ArrowDownToLine className="h-4 w-4" />
              Depositar
            </button>
          )}
        </div>
      </div>

      {activeModule === 'balances' && (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <div className="text-xs text-ink-400">Ultimas movimentacoes</div>
            <div className="mt-3 space-y-2">
              {latestTx.length === 0 && <div className="text-sm text-ink-400">Sem movimentacoes recentes.</div>}
              {latestTx.map((tx) => (
                <TransactionCompactLine
                  key={tx.id}
                  tx={tx}
                  showBalance={showBalance}
                  openReceipt={openReceipt}
                  receiptLoading={receiptLoading}
                />
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <div className="text-xs text-ink-400">Conta</div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <ReceiptLine label="Banco" value={me?.dadosBancarios?.nomeBanco || 'Bravus Premium Bank'} />
              <ReceiptLine label="Agencia" value={me?.dadosBancarios?.agencia} />
              <ReceiptLine label="Conta" value={me?.dadosBancarios?.contaFormatada || me?.accountNumber} />
              <ReceiptLine label="Tipo" value={me?.dadosBancarios?.tipoConta || me?.accountType} />
            </div>
          </div>
        </div>
      )}

      {activeModule === 'credit' && (
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <Metric label="Credito disponivel" value={showBalance ? formatCurrency(creditSummary?.creditoDisponivelCentavos ?? 0) : 'R$ ******'} />
          <Metric label="Divida total" value={showBalance ? formatCurrency(creditSummary?.dividaTotalCentavos ?? 0) : 'R$ ******'} />
          <Metric label="Taxa anual" value={`${Number(creditSummary?.taxaJurosAnualMedia ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`} />
        </div>
      )}

      {activeModule === 'receipts' && (
        <div className="mt-4 space-y-2">
          {latestOrders.length === 0 && <div className="text-sm text-ink-400">Nenhum comprovante externo recente.</div>}
          {latestOrders.map((order) => (
            <div key={order.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm">
              <span className="min-w-0 truncate text-ink-200">#{order.id} {order.channel} - {order.beneficiaryName}</span>
              <span className="text-xs text-ink-400">{order.settlementStatus || order.status}</span>
              <button
                type="button"
                className="btn-secondary !py-1.5 !px-2.5"
                disabled={receiptLoading === order.id}
                onClick={() => openReceipt(order.id)}
              >
                <Receipt className="h-4 w-4" />
                Abrir
              </button>
            </div>
          ))}
        </div>
      )}

      {!['balances', 'credit', 'receipts'].includes(activeModule) && (
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <Metric label="Status" value={module?.badge || 'Ativo'} />
          <Metric label="Conta" value={me?.dadosBancarios?.contaFormatada || me?.accountNumber || '-'} />
          <Metric label="Ultima atualizacao" value={formatDate(new Date().toISOString())} />
        </div>
      )}
    </div>
  );
}

function TransactionListItem({ tx, openReceipt, receiptLoading }) {
  const { Icon, color, bg } = txIcon(tx.type);
  const counterparty = transactionCounterparty(tx);
  const receiptOrderId = receiptIdForTransaction(tx);

  return (
    <li className="flex items-start gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3">
      <div className={cn('mt-0.5 h-9 w-9 shrink-0 rounded-lg inline-flex items-center justify-center', bg)}>
        <Icon className={cn('h-4 w-4', color)} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-white">{getTransactionTypeLabel(tx.type)}</div>
            {counterparty.name && (
              <div className="truncate text-xs text-ink-200">
                {counterparty.label}: {counterparty.name}
              </div>
            )}
            {counterparty.detail && (
              <div className="truncate text-[11px] text-ink-400">{counterparty.detail}</div>
            )}
            <div className="text-[11px] text-ink-500">{formatDate(tx.createdAt || tx.date)}</div>
          </div>
          <div className={cn('shrink-0 text-sm font-medium tabular-nums', txSignClass(tx.type))}>
            {txSign(tx.type)} {formatCurrency(tx.amount)}
          </div>
        </div>
        {receiptOrderId && (
          <button
            type="button"
            className="btn-secondary mt-2 !py-1.5 !px-2.5 text-xs"
            disabled={receiptLoading === receiptOrderId}
            onClick={() => openReceipt(receiptOrderId)}
          >
            <Receipt className="h-3.5 w-3.5" />
            Comprovante
          </button>
        )}
      </div>
    </li>
  );
}

function TransactionCompactLine({ tx, showBalance, openReceipt, receiptLoading }) {
  const counterparty = transactionCounterparty(tx);
  const receiptOrderId = receiptIdForTransaction(tx);

  return (
    <div className="rounded-lg border border-white/5 bg-black/15 p-3 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-ink-100">{getTransactionTypeLabel(tx.type)}</div>
          {counterparty.name && (
            <div className="truncate text-xs text-ink-300">{counterparty.label}: {counterparty.name}</div>
          )}
          {counterparty.detail && (
            <div className="truncate text-[11px] text-ink-500">{counterparty.detail}</div>
          )}
        </div>
        <span className={cn('shrink-0 font-mono', txSignClass(tx.type))}>
          {txSign(tx.type)} {showBalance ? formatCurrency(tx.amount) : 'R$ ******'}
        </span>
      </div>
      {receiptOrderId && (
        <button
          type="button"
          className="btn-secondary mt-2 !py-1 !px-2 text-xs"
          disabled={receiptLoading === receiptOrderId}
          onClick={() => openReceipt(receiptOrderId)}
        >
          <Receipt className="h-3.5 w-3.5" />
          Comprovante
        </button>
      )}
    </div>
  );
}

function TransferRecipientPreview({ form, resolvedRecipient, resolveLoading }) {
  if (form.transferMode === 'internal') {
    const destination = form.destinationAccount.trim();
    if (!destination) return null;
    const name = resolvedRecipient?.name || resolvedRecipient?.fullName;
    const detail = resolvedRecipient
      ? [
          resolvedRecipient.document && `Doc ${resolvedRecipient.document}`,
          resolvedRecipient.accountNumber && `Conta ${resolvedRecipient.accountNumber}`,
          resolvedRecipient.bankName || 'Bravus Premium Bank',
        ].filter(Boolean).join(' | ')
      : `Chave/conta informada: ${destination}`;

    return (
      <div className="rounded-xl border border-amber-300/20 bg-amber-300/[0.06] p-4 text-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="font-semibold text-white">Recebedor Bravus</div>
            <div className="mt-1 text-ink-200">
              {resolveLoading ? 'Consultando destinatario...' : name || 'Destinatario ainda nao localizado'}
            </div>
            <div className="mt-1 text-xs text-ink-400">{detail}</div>
          </div>
          <span className={resolvedRecipient ? 'pill-green' : 'pill-gold'}>
            {resolvedRecipient ? 'Localizado' : 'Validar'}
          </span>
        </div>
      </div>
    );
  }

  const hasExternalData =
    form.beneficiaryName || form.beneficiaryDocument || form.pixKey || form.accountNumber || form.bankCode;
  if (!hasExternalData) return null;

  const account = form.channel === 'PIX'
    ? form.pixKey
    : [form.bankCode, form.agency, form.accountNumber, form.accountDigit].filter(Boolean).join(' / ');

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm">
      <div className="font-semibold text-white">Recebedor informado</div>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <ReceiptLine label="Nome" value={form.beneficiaryName} />
        <ReceiptLine label="Documento" value={form.beneficiaryDocument} />
        <ReceiptLine label="Canal" value={form.channel} />
        <ReceiptLine label="Destino" value={account} />
      </div>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="text-xs uppercase tracking-widest text-ink-400">{label}</div>
      <div className="mt-2 truncate font-display text-lg font-semibold text-white">{value || '-'}</div>
    </div>
  );
}

function ReceiptBlock({ title, party }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm">
      <div className="mb-3 font-semibold text-white">{title}</div>
      <ReceiptLine label="Nome" value={party?.name} />
      <ReceiptLine label="Documento" value={party?.document} />
      <ReceiptLine label="Banco" value={party?.bankName || party?.bankCode} />
      <ReceiptLine label="Código" value={party?.bankCode} />
      <ReceiptLine label="ISPB" value={party?.ispb} />
      <ReceiptLine label="Agência" value={party?.agency} />
      <ReceiptLine label="Conta" value={[party?.accountNumber, party?.accountDigit].filter(Boolean).join('-')} />
      <ReceiptLine label="Tipo" value={party?.accountType} />
      <ReceiptLine label="Chave Pix" value={party?.pixKey} />
      <ReceiptLine label="Tipo chave" value={party?.pixKeyType} />
    </div>
  );
}

function ReceiptLine({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-white/5 py-1.5 last:border-0">
      <span className="text-ink-400">{label}</span>
      <span className="max-w-[65%] break-words text-right font-mono text-ink-100">{value || '-'}</span>
    </div>
  );
}
