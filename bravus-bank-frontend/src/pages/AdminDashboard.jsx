import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Activity, Banknote, TrendingUp, Power, Trash2, CheckCircle2, AlertCircle,
  Search, Shield, BarChart3, ListChecks,
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';
import { adminService } from '../services/api';
import { formatCurrency, formatDate, getTransactionTypeLabel } from '../utils/helpers';
import { cn } from '../lib/cn';

const KpiCard = ({ icon: Icon, label, value, accent, hint }) => (
  <div className="card-premium p-5">
    <div className="flex items-start justify-between">
      <div>
        <div className="text-xs uppercase tracking-widest text-ink-400">{label}</div>
        <div className="mt-2 font-display text-2xl font-bold tabular-nums">{value}</div>
        {hint && <div className="mt-1 text-xs text-ink-400">{hint}</div>}
      </div>
      <div className={cn('h-11 w-11 rounded-xl inline-flex items-center justify-center', accent)}>
        <Icon className="h-5 w-5" />
      </div>
    </div>
  </div>
);

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [tab, setTab] = useState('overview');
  const [search, setSearch] = useState('');

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
      const [s, u, t] = await Promise.all([
        adminService.getDashboard(),
        adminService.getAllUsers(),
        adminService.getAllTransactions(),
      ]);
      setStats(s.data || {});
      setUsers(Array.isArray(u.data) ? u.data : []);
      setTransactions(Array.isArray(t.data) ? t.data : []);
    } catch (err) {
      setError('Erro ao carregar dados do painel admin.');
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      [u.username, u.email, u.fullName, u.cpf].some((f) => (f || '').toLowerCase().includes(q))
    );
  }, [users, search]);

  // tx by day for chart
  const chartData = useMemo(() => {
    const days = [...Array(14)].map((_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (13 - i));
      return { key: d.toISOString().slice(0, 10), label: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }), volume: 0 };
    });
    transactions.forEach((t) => {
      const k = (t.createdAt || t.date || '').slice(0, 10);
      const f = days.find((d) => d.key === k);
      if (f) f.volume += (t.amount || 0) / 100;
    });
    return days;
  }, [transactions]);

  // KPI fallbacks
  const totalUsers = stats?.totalUsers ?? users.length;
  const activeUsers = stats?.activeUsers ?? users.filter((u) => u.active !== false).length;
  const totalTx = stats?.totalTransactions ?? transactions.length;
  const totalVolume = stats?.totalVolume ?? transactions.reduce((a, t) => a + (t.amount || 0), 0);

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

  const onActivate = async (id) => {
    try { await adminService.activateUser(id); setSuccess('Usuário ativado.'); await loadData(); }
    catch { setError('Erro ao ativar usuário.'); }
  };
  const onDeactivate = async (id) => {
    try { await adminService.deactivateUser(id); setSuccess('Usuário desativado.'); await loadData(); }
    catch { setError('Erro ao desativar usuário.'); }
  };
  const onDelete = async (id) => {
    if (!window.confirm('Excluir este usuário? Esta ação não pode ser desfeita.')) return;
    try { await adminService.deleteUser(id); setSuccess('Usuário excluído.'); await loadData(); }
    catch { setError('Erro ao excluir usuário.'); }
  };

  if (loading && !stats) {
    return (
      <main className="container-app py-10 space-y-6">
        <div className="grid md:grid-cols-4 gap-5">
          {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-28" />)}
        </div>
        <div className="skeleton h-80" />
      </main>
    );
  }

  return (
    <main className="container-app py-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="pill-gold mb-2"><Shield className="h-3.5 w-3.5" /> Painel administrativo</div>
          <h1 className="title-lg">Bravus Admin</h1>
          <p className="text-ink-300 text-sm mt-1">Visão executiva da operação e gestão de usuários.</p>
        </div>
      </div>

      {/* KPIs */}
      <motion.div
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5"
      >
        <KpiCard icon={Users} label="Usuários totais" value={totalUsers} accent="bg-bravus-400/15 text-bravus-200" />
        <KpiCard icon={CheckCircle2} label="Usuários ativos" value={activeUsers} accent="bg-emerald-400/15 text-emerald-300" />
        <KpiCard icon={Activity} label="Transações" value={totalTx} accent="bg-amber-400/15 text-amber-300" />
        <KpiCard icon={Banknote} label="Volume total" value={formatCurrency(totalVolume)} accent="bg-gold-400/15 text-gold-300" />
      </motion.div>

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
        <Tab id="overview" label="Visão geral" icon={BarChart3} />
        <Tab id="users" label="Usuários" icon={Users} />
        <Tab id="transactions" label="Transações" icon={ListChecks} />
      </div>

      {/* Content */}
      <div className="mt-6">
        {tab === 'overview' && (
          <div className="card-premium p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="title-md">Volume transacionado · 14 dias</h3>
                <p className="text-xs text-ink-400 mt-0.5">Soma diária em R$</p>
              </div>
              <div className="pill-gold"><TrendingUp className="h-3.5 w-3.5" /> Tendência</div>
            </div>
            <div className="h-72">
              <ResponsiveContainer>
                <BarChart data={chartData}>
                  <defs>
                    <linearGradient id="bar1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#eecb54" stopOpacity={0.95} />
                      <stop offset="100%" stopColor="#d49b1c" stopOpacity={0.55} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#ffffff10" vertical={false} />
                  <XAxis dataKey="label" stroke="#8a93ac" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#8a93ac" fontSize={12} tickLine={false} axisLine={false} width={60} />
                  <Tooltip
                    contentStyle={{ background: '#0b0f1c', border: '1px solid #ffffff20', borderRadius: 12 }}
                    formatter={(v) => [`R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'Volume']}
                  />
                  <Bar dataKey="volume" fill="url(#bar1)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {tab === 'users' && (
          <div className="card-premium p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
              <h3 className="title-md">Usuários</h3>
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400" />
                <input
                  type="text"
                  className="form-input pl-10"
                  placeholder="Buscar por nome, email, CPF..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-ink-400 border-b border-white/10">
                    <th className="py-3 px-3 font-medium">Usuário</th>
                    <th className="py-3 px-3 font-medium">Email</th>
                    <th className="py-3 px-3 font-medium">Nome completo</th>
                    <th className="py-3 px-3 font-medium">Status</th>
                    <th className="py-3 px-3 font-medium text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.length === 0 ? (
                    <tr><td colSpan="5" className="py-10 text-center text-ink-400">Nenhum usuário encontrado.</td></tr>
                  ) : filteredUsers.map((u) => (
                    <tr key={u.id} className="border-b border-white/5 hover:bg-white/[0.03]">
                      <td className="py-3 px-3 font-medium text-white">{u.username}</td>
                      <td className="py-3 px-3 text-ink-200">{u.email}</td>
                      <td className="py-3 px-3 text-ink-200">{u.fullName || '—'}</td>
                      <td className="py-3 px-3">
                        {u.active === false
                          ? <span className="pill-red">Inativo</span>
                          : <span className="pill-green">Ativo</span>}
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center justify-end gap-2">
                          {u.active === false ? (
                            <button onClick={() => onActivate(u.id)} className="btn-ghost !py-1.5 !px-2 text-emerald-300" title="Ativar">
                              <Power className="h-4 w-4" />
                            </button>
                          ) : (
                            <button onClick={() => onDeactivate(u.id)} className="btn-ghost !py-1.5 !px-2 text-amber-300" title="Desativar">
                              <Power className="h-4 w-4" />
                            </button>
                          )}
                          <button onClick={() => onDelete(u.id)} className="btn-ghost !py-1.5 !px-2 text-red-300" title="Excluir">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'transactions' && (
          <div className="card-premium p-6">
            <h3 className="title-md mb-4">Transações</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-ink-400 border-b border-white/10">
                    <th className="py-3 px-3 font-medium">Data</th>
                    <th className="py-3 px-3 font-medium">Tipo</th>
                    <th className="py-3 px-3 font-medium">Descrição</th>
                    <th className="py-3 px-3 font-medium text-right">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.length === 0 ? (
                    <tr><td colSpan="4" className="py-10 text-center text-ink-400">Sem transações.</td></tr>
                  ) : transactions.slice(0, 200).map((t, i) => (
                    <tr key={t.id || i} className="border-b border-white/5 hover:bg-white/[0.03]">
                      <td className="py-3 px-3 text-ink-200">{formatDate(t.createdAt || t.date)}</td>
                      <td className="py-3 px-3">{getTransactionTypeLabel(t.type)}</td>
                      <td className="py-3 px-3 text-ink-300">{t.description || '—'}</td>
                      <td className="py-3 px-3 text-right font-medium tabular-nums">{formatCurrency(t.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
