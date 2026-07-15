import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight, CheckCircle2, Loader2, ShieldCheck, UserPlus,
} from 'lucide-react';
import { authService } from '../services/api';
import { clearRegistrationDraft, loadRegistrationDraft, saveRegistrationDraft } from '../lib/registrationDraft';

const onlyDigits = (value) => value.replace(/\D/g, '');

const formatCpf = (value) => {
  const digits = onlyDigits(value).slice(0, 11);
  return digits
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
};

const formatPhone = (value) => {
  const digits = onlyDigits(value).slice(0, 11);
  if (digits.length <= 10) return digits.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3').replace(/[-\s]+$/, '');
  return digits.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3').replace(/[-\s]+$/, '');
};

function Field({ label, name, value, onChange, type = 'text', required, placeholder, minLength, autoComplete, onBlur }) {
  return (
    <div>
      <label className="form-label" htmlFor={name}>{label}{required && ' *'}</label>
      <input
        id={name}
        type={type}
        name={name}
        className="form-input"
        value={value}
        onChange={onChange}
        required={required}
        minLength={minLength}
        placeholder={placeholder}
        autoComplete={autoComplete}
        onBlur={onBlur}
      />
    </div>
  );
}

export default function Register() {
  const availabilityRequestRef = useRef(0);
  const requestKeyRef = useRef('');
  const [formData, setFormData] = useState(() => loadRegistrationDraft());
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(null);
  const [availability, setAvailability] = useState({ status: 'idle', accountExists: false, message: '' });

  useEffect(() => { saveRegistrationDraft(formData); }, [formData]);

  const registrationPayload = () => ({
    username: String(formData.username || '').trim().toLowerCase(),
    email: String(formData.email || '').trim().toLowerCase(),
    cpf: onlyDigits(String(formData.cpf || '')),
  });

  const checkAvailability = async ({ requireComplete = false } = {}) => {
    const requestId = availabilityRequestRef.current + 1;
    availabilityRequestRef.current = requestId;
    const identity = registrationPayload();
    if (requireComplete && (identity.username.length < 3 || !identity.email || identity.cpf.length !== 11)) {
      setError('Preencha usuario, e-mail e CPF antes de enviar a solicitacao.');
      return false;
    }
    setAvailability({ status: 'checking', accountExists: false, message: 'Verificando dados...' });
    try {
      const result = await authService.checkRegistration(identity);
      if (requestId !== availabilityRequestRef.current) return false;
      const hasConflict = ['ACCOUNT_ALREADY_EXISTS', 'USERNAME_ALREADY_EXISTS', 'EMAIL_ALREADY_EXISTS'].includes(result.code);
      setAvailability({
        status: result.available ? 'available' : (hasConflict ? 'conflict' : 'idle'),
        accountExists: Boolean(result.accountExists),
        message: result.message || '',
      });
      if (hasConflict || (requireComplete && !result.available)) setError(result.message || 'Revise os dados antes de continuar.');
      return Boolean(result.available);
    } catch (err) {
      if (requestId !== availabilityRequestRef.current) return false;
      const payload = err?.response?.data;
      const message = typeof payload === 'string' ? payload : payload?.message;
      setAvailability({ status: 'error', accountExists: false, message: message || 'Falha ao verificar os dados.' });
      if (requireComplete) setError(message || 'Falha ao verificar os dados.');
      return false;
    }
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    const nextValue =
      name === 'cpf' ? formatCpf(value) :
      name === 'phone' ? formatPhone(value) :
      value;
    setFormData((current) => ({ ...current, [name]: nextValue }));
    if (['username', 'email', 'cpf'].includes(name)) {
      requestKeyRef.current = '';
      availabilityRequestRef.current += 1;
      setAvailability({ status: 'idle', accountExists: false, message: '' });
    }
  };

  const handleIdentityBlur = () => {
    const identity = registrationPayload();
    if (identity.username || identity.email || identity.cpf) checkAvailability();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    if (onlyDigits(String(formData.cpf || '')).length !== 11) {
      setError('Informe CPF com 11 digitos.');
      return;
    }
    if (!globalThis.crypto?.randomUUID) {
      setError('Este dispositivo precisa de suporte seguro para gerar o protocolo.');
      return;
    }
    setLoading(true);
    try {
      if (!await checkAvailability({ requireComplete: true })) return;
      if (!requestKeyRef.current) requestKeyRef.current = `public-account-${globalThis.crypto.randomUUID()}`;
      const registered = await authService.register({
        ...formData,
        cpf: onlyDigits(String(formData.cpf || '')),
        phone: onlyDigits(String(formData.phone || '')),
        idempotencyKey: requestKeyRef.current,
      });
      clearRegistrationDraft();
      setSubmitted(registered);
    } catch (err) {
      const payload = err?.response?.data;
      const message = typeof payload === 'string' ? payload : payload?.message || err.message;
      if (payload?.accountExists || payload?.code === 'ACCOUNT_ALREADY_EXISTS') {
        setAvailability({ status: 'conflict', accountExists: true, message });
      }
      setError(message || 'Erro ao enviar solicitacao. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="container-app py-12 sm:py-16">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="mx-auto max-w-3xl"
      >
        <div className="card-premium p-8 sm:p-10">
          <div className="mb-7">
            <div className="pill-gold mb-3">
              <UserPlus className="h-3.5 w-3.5" />
              Solicitacao de abertura
            </div>
            <h1 className="title-md">Pedir abertura de conta Bravus</h1>
            <p className="mt-1.5 text-sm text-ink-300">
              O cadastro nao cria conta automaticamente. Ele envia uma notificacao ao administrador, que cria a conta internamente e informa a senha temporaria.
            </p>
          </div>

          {error && <div className="alert-error mb-5" role="alert">{error}</div>}

          {availability.accountExists && (
            <div className="mb-5 flex flex-wrap gap-3" aria-label="Acoes para conta existente">
              <Link to="/login" className="btn-primary !py-2 !px-4">Entrar na conta</Link>
              <Link to="/redefinir-senha" className="btn-secondary !py-2 !px-4">Esqueci minha senha</Link>
            </div>
          )}

          {submitted ? (
            <div className="text-center">
              <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-300" />
              <h2 className="mt-4 text-lg font-semibold text-white">Solicitacao enviada ao admin</h2>
              <p className="mt-2 text-sm text-ink-300">
                O administrador recebeu o pedido. A conta sera criada manualmente, com senha temporaria para primeiro acesso.
              </p>
              <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 text-left text-xs text-ink-400">
                Protocolo: <span className="font-mono text-ink-100">{submitted.requestId}</span>
              </div>
              <Link to="/login" className="btn-primary mt-6 w-full">
                Ir para login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Usuario desejado" name="username" value={formData.username || ''} onChange={handleChange} onBlur={handleIdentityBlur} required placeholder="seu.usuario" minLength={3} autoComplete="username" />
                <Field label="E-mail" name="email" type="email" value={formData.email || ''} onChange={handleChange} onBlur={handleIdentityBlur} required placeholder="voce@email.com" autoComplete="email" />
                <Field label="Nome completo" name="fullName" value={formData.fullName || ''} onChange={handleChange} required placeholder="Seu nome completo" autoComplete="name" />
                <Field label="CPF" name="cpf" value={formData.cpf || ''} onChange={handleChange} onBlur={handleIdentityBlur} required placeholder="000.000.000-00" autoComplete="off" />
                <Field label="Telefone" name="phone" type="tel" value={formData.phone || ''} onChange={handleChange} placeholder="(00) 00000-0000" autoComplete="tel" />
              </div>

              {availability.status === 'available' && (
                <div className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200" role="status">
                  <span className="inline-flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    {availability.message}
                  </span>
                </div>
              )}

              <div className="rounded-xl border border-gold-400/25 bg-gold-400/10 px-4 py-3 text-sm text-gold-100">
                <span className="inline-flex items-start gap-2">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                  Senha e conta serao criadas somente na area administrativa do Bravus.
                </span>
              </div>

              <button type="submit" disabled={loading} className="btn-primary w-full !py-3">
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Enviando solicitacao...
                  </>
                ) : (
                  <>
                    Solicitar abertura
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>
          )}

          <p className="mt-6 text-center text-sm text-ink-300">
            Ja e cliente?{' '}
            <Link to="/login" className="font-medium text-gold-300 hover:text-gold-200">
              Entrar
            </Link>
          </p>
        </div>
      </motion.div>
    </main>
  );
}
