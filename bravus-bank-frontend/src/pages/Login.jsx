import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Loader2, ShieldCheck } from 'lucide-react';
import { authService } from '../services/api';
import Logo from '../components/Logo';

export default function Login() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const canSubmit = form.username.trim().length > 0 && form.password.length > 0 && !loading;

  const onSubmit = async (event) => {
    event.preventDefault();
    if (!canSubmit) return;

    setError('');
    setLoading(true);

    try {
      const response = await authService.login(form.username.trim(), form.password);
      const isAdmin = (response?.roles || []).includes('ROLE_ADMIN');
      navigate(isAdmin ? '/admin' : '/dashboard', { replace: true });
    } catch (err) {
      const status = err?.response?.status;
      const payload = err?.response?.data;
      const message = typeof payload === 'string' ? payload : payload?.message;

      if (status === 400 || status === 401 || status === 403) {
        setError('E-mail/usuario ou senha incorretos.');
      } else if (err?.code === 'ECONNABORTED') {
        setError('A conexão demorou demais. Tente novamente em instantes.');
      } else {
        setError(message || 'Não foi possível entrar agora. Verifique a conexão com a API.');
      }
    } finally {
      setLoading(false);
    }
  };

  const updateField = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
  };

  return (
    <main className="container-app py-12 sm:py-16">
      <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[1fr_420px] lg:items-center">
        <section className="hidden lg:block">
          <div className="pill-gold mb-5">
            <ShieldCheck className="h-3.5 w-3.5" />
            Acesso protegido
          </div>
          <h1 className="title-xl">
            Entre com segurança no seu
            <span className="gradient-text"> Bravus Bank.</span>
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-ink-300">
            Acesse saldo, transferências, extrato e operações bancárias em um ambiente digital com proteção por JWT e auditoria de sessões.
          </p>
        </section>

        <section className="card-premium p-7 sm:p-8">
          <div className="mb-7">
            <Logo />
            <div className="mt-6 inline-flex items-center gap-1.5 rounded-full border border-gold-400/25 bg-gold-400/15 px-3 py-1 text-xs font-medium text-gold-200">
              <ShieldCheck className="h-3.5 w-3.5" />
              Acesso seguro
            </div>
            <h2 className="title-md mt-4">Bem-vindo de volta</h2>
            <p className="mt-1.5 text-sm text-ink-300">Use suas credenciais para acessar sua conta.</p>
          </div>

          {error && (
            <div className="alert-error mb-5" role="alert">
              {error}
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-5">
            <div>
              <label className="form-label" htmlFor="username">E-mail ou usuario</label>
              <input
                id="username"
                className="form-input"
                type="text"
                value={form.username}
                onChange={updateField('username')}
                placeholder="admin@bravusbank.com"
                required
                autoFocus
                autoComplete="username"
              />
            </div>

            <div>
              <label className="form-label" htmlFor="password">Senha</label>
              <input
                id="password"
                className="form-input"
                type="password"
                value={form.password}
                onChange={updateField('password')}
                placeholder="Digite sua senha"
                required
                autoComplete="current-password"
              />
            </div>

            <button type="submit" disabled={!canSubmit} className="btn-primary w-full !py-3">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Entrando...
                </>
              ) : (
                <>
                  Entrar
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-ink-300">
            Ainda não tem conta?{' '}
            <Link to="/register" className="font-medium text-gold-300 hover:text-gold-200">
              Abrir conta
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}
