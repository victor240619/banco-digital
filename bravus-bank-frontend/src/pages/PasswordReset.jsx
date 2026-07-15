import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, CheckCircle2, KeyRound, Loader2, ShieldCheck,
} from 'lucide-react';
import Logo from '../components/Logo';
import { passwordResetService } from '../services/api';

const randomSecret = () => {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
};

const apiMessage = (error, fallback) => {
  const payload = error?.response?.data;
  return payload?.message || (typeof payload === 'string' ? payload : fallback);
};

export default function PasswordReset() {
  const [identifier, setIdentifier] = useState('');
  const [submitted, setSubmitted] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const startRecovery = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await passwordResetService.start({
        identifier: identifier.trim(),
        clientSecret: randomSecret(),
        idempotencyKey: `password-reset-${crypto.randomUUID()}`,
      });
      setSubmitted(data);
    } catch (requestError) {
      setError(apiMessage(requestError, 'Nao foi possivel enviar a solicitacao agora.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="container-app py-8 sm:py-12">
      <section className="card-premium mx-auto max-w-xl p-6 sm:p-8">
        <Logo />
        <div className="mt-6 pill-gold w-fit">
          <ShieldCheck className="h-3.5 w-3.5" />
          Recuperacao interna
        </div>
        <h1 className="title-md mt-4">Esqueci minha senha</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-300">
          Envie a solicitacao para o administrador. O admin emitira uma senha temporaria; depois de entrar, voce troca a senha dentro da sua conta.
        </p>

        {error && <div className="alert-error mt-5" role="alert">{error}</div>}

        {!submitted ? (
          <form onSubmit={startRecovery} className="mt-6 space-y-5">
            <div>
              <label className="form-label" htmlFor="recovery-identifier">CPF, e-mail ou usuario</label>
              <input
                id="recovery-identifier"
                className="form-input"
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                placeholder="Informe os dados da conta"
                autoComplete="username"
                required
              />
            </div>
            <button className="btn-primary w-full !py-3" disabled={loading || !identifier.trim()}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              Solicitar senha temporaria ao admin
            </button>
          </form>
        ) : (
          <div className="mt-6 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-300" />
            <h2 className="mt-4 text-lg font-semibold text-white">Solicitacao enviada</h2>
            <p className="mt-2 text-sm text-ink-300">
              O pedido apareceu na area administrativa. Quando o admin emitir a senha temporaria, entre por aqui e faca a troca obrigatoria dentro do app.
            </p>
            <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 text-left text-xs text-ink-400">
              Protocolo: <span className="font-mono text-ink-100">{submitted.requestId}</span>
            </div>
          </div>
        )}

        <Link to="/login" className="btn-secondary mt-6 w-full">
          <ArrowLeft className="h-4 w-4" /> Voltar para o login
        </Link>
      </section>
    </main>
  );
}
