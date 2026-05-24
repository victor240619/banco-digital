import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Lock, User, ArrowRight, ShieldCheck } from 'lucide-react';
import { authService } from '../services/api';

export default function Login() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await authService.login(formData.username, formData.password);
      navigate(response.roles?.includes('ROLE_ADMIN') ? '/admin' : '/dashboard');
    } catch (err) {
      const msg = err?.response?.data?.message || err?.response?.data || 'Credenciais inválidas. Tente novamente.';
      setError(typeof msg === 'string' ? msg : 'Erro ao fazer login.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="container-app py-16 sm:py-20">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="mx-auto max-w-md"
      >
        <div className="card-premium p-8 sm:p-10">
          <div className="mb-7">
            <div className="pill-gold mb-3"><ShieldCheck className="h-3.5 w-3.5" /> Acesso seguro</div>
            <h1 className="title-md">Bem-vindo de volta</h1>
            <p className="mt-1.5 text-sm text-ink-300">Acesse sua conta Bravus Bank.</p>
          </div>

          {error && <div className="alert-error mb-5">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="form-label">Usuário</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400" />
                <input
                  type="text"
                  name="username"
                  className="form-input pl-10"
                  value={formData.username}
                  onChange={handleChange}
                  required
                  autoComplete="username"
                  placeholder="seu.usuario"
                />
              </div>
            </div>

            <div>
              <label className="form-label">Senha</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400" />
                <input
                  type="password"
                  name="password"
                  className="form-input pl-10"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
              {loading ? 'Entrando...' : (<>Entrar <ArrowRight className="h-4 w-4" /></>)}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-ink-300">
            Ainda não tem conta?{' '}
            <Link to="/register" className="font-medium text-gold-300 hover:text-gold-200">Abrir conta</Link>
          </p>

          <div className="mt-6 rounded-xl bg-white/[0.03] border border-white/10 p-4">
            <div className="text-xs uppercase tracking-widest text-ink-400 mb-2">Credenciais de teste</div>
            <div className="text-sm space-y-1 font-mono">
              <div><span className="text-gold-300">admin</span> / admin123</div>
              <div><span className="text-gold-300">user</span> / user123</div>
            </div>
          </div>
        </div>
      </motion.div>
    </main>
  );
}
