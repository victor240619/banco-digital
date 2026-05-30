import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, CheckCircle2, Loader2, UserPlus } from 'lucide-react';
import { authService } from '../services/api';

const PASSWORD_MESSAGE = 'Use no mínimo 8 caracteres, com letra maiúscula, minúscula e número.';
const STRONG_PASSWORD = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

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
  if (digits.length <= 10) {
    return digits.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3').replace(/[-\s]+$/, '');
  }
  return digits.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3').replace(/[-\s]+$/, '');
};

export default function Register() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    cpf: '',
    phone: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    const nextValue =
      name === 'cpf' ? formatCpf(value) :
      name === 'phone' ? formatPhone(value) :
      value;

    setFormData((current) => ({ ...current, [name]: nextValue }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    if (!STRONG_PASSWORD.test(formData.password)) {
      setError(PASSWORD_MESSAGE);
      return;
    }

    setLoading(true);

    try {
      const { confirmPassword, ...payload } = formData;
      await authService.register({
        ...payload,
        cpf: onlyDigits(payload.cpf),
        phone: onlyDigits(payload.phone),
      });
      navigate('/dashboard', { replace: true });
    } catch (err) {
      const payload = err?.response?.data;
      const message = typeof payload === 'string' ? payload : payload?.message;
      setError(message || 'Erro ao criar conta. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const Field = ({ label, name, type = 'text', required, placeholder, minLength, autoComplete }) => (
    <div>
      <label className="form-label" htmlFor={name}>
        {label}{required && ' *'}
      </label>
      <input
        id={name}
        type={type}
        name={name}
        className="form-input"
        value={formData[name]}
        onChange={handleChange}
        required={required}
        minLength={minLength}
        placeholder={placeholder}
        autoComplete={autoComplete}
      />
    </div>
  );

  return (
    <main className="container-app py-12 sm:py-16">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="mx-auto max-w-2xl"
      >
        <div className="card-premium p-8 sm:p-10">
          <div className="mb-7">
            <div className="pill-gold mb-3">
              <UserPlus className="h-3.5 w-3.5" />
              Abertura de conta
            </div>
            <h1 className="title-md">Crie sua conta Bravus</h1>
            <p className="mt-1.5 text-sm text-ink-300">Leva menos de 2 minutos. 100% digital.</p>
          </div>

          {error && <div className="alert-error mb-5" role="alert">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Usuário" name="username" required placeholder="seu.usuario" minLength={3} autoComplete="username" />
              <Field label="E-mail" name="email" type="email" required placeholder="voce@email.com" autoComplete="email" />
              <Field label="Nome completo" name="fullName" required placeholder="Seu nome completo" autoComplete="name" />
              <Field label="CPF" name="cpf" placeholder="000.000.000-00" autoComplete="off" />
              <Field label="Telefone" name="phone" type="tel" placeholder="(00) 00000-0000" autoComplete="tel" />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Senha" name="password" type="password" required minLength={8} placeholder="Mínimo 8 caracteres" autoComplete="new-password" />
              <Field label="Confirmar senha" name="confirmPassword" type="password" required placeholder="Repita a senha" autoComplete="new-password" />
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-ink-300">
              <span className="inline-flex items-center gap-2 text-ink-200">
                <CheckCircle2 className="h-4 w-4 text-gold-300" />
                {PASSWORD_MESSAGE}
              </span>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full !py-3">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Criando conta...
                </>
              ) : (
                <>
                  Abrir minha conta
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-ink-300">
            Já é cliente?{' '}
            <Link to="/login" className="font-medium text-gold-300 hover:text-gold-200">
              Entrar
            </Link>
          </p>
        </div>
      </motion.div>
    </main>
  );
}
