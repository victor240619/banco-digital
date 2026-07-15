import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, KeyRound, Loader2, ShieldCheck } from 'lucide-react';
import { authService } from '../services/api';
import Logo from '../components/Logo';
import { isMobileApp } from '../lib/appChannel';

export default function Login() {
  const navigate = useNavigate();
  const nativeApp = isMobileApp();
  const [form, setForm] = useState({ username: '', password: '' });
  const [passwordChange, setPasswordChange] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
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
      navigate(isAdmin ? '/admin' : (response?.identityEvidenceRequired ? '/completar-identidade' : '/dashboard'), { replace: true });
    } catch (err) {
      const status = err?.response?.status;
      const payload = err?.response?.data;
      const message = typeof payload === 'string' ? payload : payload?.message;

      if (payload?.code === 'INITIAL_PASSWORD_CHANGE_REQUIRED' && payload?.initialPasswordChangeToken) {
        setPasswordChange({ token: payload.initialPasswordChangeToken, expiresAt: payload.expiresAt });
        setForm((current) => ({ ...current, password: '' }));
        setError('A senha inicial foi validada. Defina agora sua senha definitiva.');
        return;
      }

      if (status === 400 || status === 401 || status === 403) {
        setError(message || 'CPF, e-mail/usuario ou senha incorretos.');
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

  const completeInitialPassword = async (event) => {
    event.preventDefault();
    if (!passwordChange || loading) return;
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(newPassword)) {
      setError('Use no minimo 8 caracteres, com letra maiuscula, minuscula e numero.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('A confirmacao da nova senha nao confere.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await authService.completeInitialPassword(passwordChange.token, newPassword);
      navigate(response?.identityEvidenceRequired ? '/completar-identidade' : '/dashboard', { replace: true });
    } catch (err) {
      const payload = err?.response?.data;
      setError(payload?.message || 'A troca da senha inicial expirou. Entre novamente.');
      if (payload?.code === 'INITIAL_PASSWORD_CHANGE_INVALID') {
        setPasswordChange(null);
        setNewPassword('');
        setConfirmPassword('');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className={nativeApp ? 'container-app flex min-h-[100dvh] items-center py-4 native-safe-bottom' : 'container-app py-12 sm:py-16'}>
      <div className={nativeApp ? 'mx-auto grid w-full max-w-md gap-6' : 'mx-auto grid max-w-5xl gap-8 lg:grid-cols-[1fr_420px] lg:items-center'}>
        <section className={nativeApp ? 'hidden' : 'hidden lg:block'}>
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

        <section className="card-premium p-5 sm:p-8">
          <div className="mb-7">
            <Logo />
            <div className="mt-6 inline-flex items-center gap-1.5 rounded-full border border-gold-400/25 bg-gold-400/15 px-3 py-1 text-xs font-medium text-gold-200">
              <ShieldCheck className="h-3.5 w-3.5" />
              Acesso seguro
            </div>
            <h2 className="title-md mt-4">{passwordChange ? 'Crie sua senha definitiva' : 'Bem-vindo de volta'}</h2>
            <p className="mt-1.5 text-sm text-ink-300">
              {passwordChange
                ? 'A senha inicial nao libera o painel. Defina uma senha forte para concluir o primeiro acesso.'
                : 'Use suas credenciais para acessar sua conta.'}
            </p>
          </div>

          {error && (
            <div className="alert-error mb-5" role="alert">
              {error}
            </div>
          )}

          {passwordChange ? (
            <form onSubmit={completeInitialPassword} className="space-y-5">
              <div className="rounded-xl border border-gold-400/25 bg-gold-400/10 p-4 text-sm text-gold-100">
                <div className="flex items-center gap-2 font-medium">
                  <KeyRound className="h-4 w-4" /> Primeiro acesso protegido
                </div>
                <p className="mt-2 text-xs leading-relaxed text-ink-200">
                  Use no minimo 8 caracteres, incluindo maiuscula, minuscula e numero.
                </p>
              </div>
              <div>
                <label className="form-label" htmlFor="new-password">Nova senha</label>
                <input
                  id="new-password"
                  className="form-input"
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  autoFocus
                />
              </div>
              <div>
                <label className="form-label" htmlFor="confirm-new-password">Confirmar nova senha</label>
                <input
                  id="confirm-new-password"
                  className="form-input"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full !py-3">
                {loading
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Protegendo conta...</>
                  : <><ShieldCheck className="h-4 w-4" /> Salvar e entrar</>}
              </button>
              <button
                type="button"
                className="btn-ghost w-full"
                onClick={() => {
                  setPasswordChange(null);
                  setNewPassword('');
                  setConfirmPassword('');
                  setError('');
                }}
              >
                <ArrowLeft className="h-4 w-4" /> Voltar ao login
              </button>
            </form>
          ) : (
          <form onSubmit={onSubmit} className="space-y-5">
            <div>
              <label className="form-label" htmlFor="username">CPF, e-mail ou usuario</label>
              <input
                id="username"
                className="form-input"
                type="text"
                value={form.username}
                onChange={updateField('username')}
                placeholder="Digite seu CPF, e-mail ou usuario"
                required
                autoFocus
                autoComplete="username"
              />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <label className="form-label mb-0" htmlFor="password">Senha</label>
                <Link to="/redefinir-senha" className="text-xs font-medium text-gold-300 hover:text-gold-200">
                  Esqueci minha senha
                </Link>
              </div>
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
          )}

          {!passwordChange && <p className="mt-6 text-center text-sm text-ink-300">
            Ainda não tem conta?{' '}
            <Link to="/register" className="font-medium text-gold-300 hover:text-gold-200">
              Abrir conta
            </Link>
          </p>}
        </section>
      </div>
    </main>
  );
}
