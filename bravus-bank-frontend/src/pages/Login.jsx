import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authService } from '../services/api';
import { IconShield, IconArrow } from '../components/Icon';

export default function Login() {
  const nav = useNavigate();
  const [form, setForm] = useState({ username: '', password: '' });
  const [err, setErr] = useState('');
  const [debug, setDebug] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr(''); setDebug(''); setLoading(true);
    try {
      const r = await authService.login(form.username.trim(), form.password);
      setDebug(`OK token=${(r?.token||'').slice(0,18)}... roles=${JSON.stringify(r?.roles)}`);
      const admin = (r?.roles || []).includes('ROLE_ADMIN');
      // pequena espera pra garantir que o localStorage está consistente antes de navegar
      setTimeout(() => nav(admin ? '/admin' : '/dashboard', { replace: true }), 200);
    } catch (e2) {
      const status = e2?.response?.status;
      const m = e2?.response?.data;
      const msg = typeof m === 'string' ? m : (m?.message || e2?.message || 'Credenciais inválidas.');
      setErr(`[${status||'NET'}] ${msg}`);
      setDebug(`URL=${e2?.config?.url||'?'} code=${e2?.code||'?'} msg=${e2?.message||'?'}`);
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-bg px-4 py-8">
      <div className="text-center mb-7">
        <div className="logo-tx text-[42px]" style={{ letterSpacing: '7px' }}>BRAVUS</div>
        <div className="text-[10px] tracking-[3px] uppercase text-text2 mt-1">Premium Bank · Cód. 999</div>
      </div>

      <div className="w-full max-w-[420px] card-gold p-7">
        <div className="inline-flex items-center gap-1.5 bg-gold/10 border border-border2 text-gold text-[8px] tracking-[2px] uppercase px-2.5 py-1 rounded-sm mb-4">
          <IconShield size={10} /> Acesso seguro
        </div>
        <h1 className="font-display text-[24px] tracking-[2px]">Bem-vindo de volta</h1>
        <p className="text-[12px] text-text2 mt-1">Acesse sua conta Bravus Premium Bank</p>

        {err && (
          <div className="mt-4 px-3 py-2 rounded text-[11px] bg-red/10 border border-red/30 text-red-l">
            {err}
          </div>
        )}
        {debug && (
          <div className="mt-2 px-3 py-2 rounded text-[10px] font-mono bg-card2 border border-border2 text-text2 break-all">
            {debug}
          </div>
        )}

        <form onSubmit={onSubmit} className="mt-5" autoComplete="off">
          <div className="fg">
            <label className="fl">Usuário</label>
            <input
              className="fi"
              type="text"
              name="bravus_user"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              placeholder="seu.usuario"
              required
              autoFocus
              autoComplete="off"
            />
          </div>
          <div className="fg">
            <label className="fl">Senha</label>
            <input
              className="fi"
              type="password"
              name="bravus_pass"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="••••••••"
              required
              autoComplete="new-password"
            />
          </div>
          <button type="submit" disabled={loading} className="btn-full-gold disabled:opacity-60 flex items-center justify-center gap-2">
            {loading ? 'Entrando…' : <>Entrar <IconArrow size={14} strokeWidth={2.2} /></>}
          </button>
        </form>

        <div className="text-center text-[11px] text-text2 mt-5">
          Ainda não tem conta? <Link to="/register" className="text-gold font-semibold">Abrir conta</Link>
        </div>
      </div>

      <div className="text-[9px] text-text3 tracking-[2px] uppercase mt-6">
        Criptografia TLS 1.3 · JWT + 2FA · © 2026 Bravus Bank
      </div>
    </div>
  );
}
