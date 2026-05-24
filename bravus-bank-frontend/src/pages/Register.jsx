import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, UserPlus } from 'lucide-react';
import { authService } from '../services/api';

export default function Register() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    username: '', email: '', password: '', confirmPassword: '',
    fullName: '', cpf: '', phone: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (formData.password !== formData.confirmPassword) return setError('As senhas não coincidem');
    if (formData.password.length < 6) return setError('A senha deve ter no mínimo 6 caracteres');
    setLoading(true);
    try {
      const { confirmPassword, ...payload } = formData;
      await authService.register(payload);
      navigate('/dashboard');
    } catch (err) {
      const msg = err?.response?.data?.message || err?.response?.data || 'Erro ao criar conta. Tente novamente.';
      setError(typeof msg === 'string' ? msg : 'Erro ao criar conta.');
    } finally {
      setLoading(false);
    }
  };

  const Field = ({ label, name, type = 'text', required, placeholder, minLength }) => (
    <div>
      <label className="form-label">{label}{required && ' *'}</label>
      <input
        type={type}
        name={name}
        className="form-input"
        value={formData[name]}
        onChange={handleChange}
        required={required}
        minLength={minLength}
        placeholder={placeholder}
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
            <div className="pill-gold mb-3"><UserPlus className="h-3.5 w-3.5" /> Abertura de conta</div>
            <h1 className="title-md">Crie sua conta Bravus</h1>
            <p className="mt-1.5 text-sm text-ink-300">Leva menos de 2 minutos. 100% digital.</p>
          </div>

          {error && <div className="alert-error mb-5">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Usuário" name="username" required placeholder="seu.usuario" minLength={3} />
              <Field label="E-mail" name="email" type="email" required placeholder="voce@email.com" />
              <Field label="Nome completo" name="fullName" required placeholder="Seu nome completo" />
              <Field label="CPF" name="cpf" placeholder="000.000.000-00" />
              <Field label="Telefone" name="phone" type="tel" placeholder="(00) 00000-0000" />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Senha" name="password" type="password" required minLength={6} placeholder="Mínimo 6 caracteres" />
              <Field label="Confirmar senha" name="confirmPassword" type="password" required placeholder="Repita a senha" />
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full !py-3">
              {loading ? 'Criando conta...' : (<>Abrir minha conta <ArrowRight className="h-4 w-4" /></>)}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-ink-300">
            Já é cliente?{' '}
            <Link to="/login" className="font-medium text-gold-300 hover:text-gold-200">Entrar</Link>
          </p>
        </div>
      </motion.div>
    </main>
  );
}
