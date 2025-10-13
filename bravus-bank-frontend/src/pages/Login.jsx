import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authService } from '../services/api';

function Login() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await authService.login(formData.username, formData.password);
      
      // Redirect based on role
      if (response.roles && response.roles.includes('ROLE_ADMIN')) {
        navigate('/admin');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.response?.data || 'Erro ao fazer login. Verifique suas credenciais.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container" style={{ maxWidth: '500px', marginTop: '80px' }}>
      <div className="card">
        <h1 style={{ color: 'var(--primary)', marginBottom: '10px', fontSize: '32px' }}>
          🔐 Login
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '30px' }}>
          Acesse sua conta Bravus Bank
        </p>

        {error && (
          <div className="alert alert-error">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Usuário</label>
            <input
              type="text"
              name="username"
              className="form-input"
              value={formData.username}
              onChange={handleChange}
              required
              placeholder="Digite seu usuário"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Senha</label>
            <input
              type="password"
              name="password"
              className="form-input"
              value={formData.password}
              onChange={handleChange}
              required
              placeholder="Digite sua senha"
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '10px' }}
            disabled={loading}
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <div style={{ marginTop: '20px', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-secondary)' }}>
            Não tem uma conta?{' '}
            <Link to="/register" style={{ color: 'var(--primary)', textDecoration: 'none' }}>
              Cadastre-se aqui
            </Link>
          </p>
        </div>

        <div style={{ marginTop: '30px', padding: '16px', background: 'var(--dark)', borderRadius: '8px', border: '1px solid var(--border)' }}>
          <p style={{ fontSize: '14px', marginBottom: '10px', color: 'var(--text-secondary)' }}>
            🧪 Credenciais de Teste:
          </p>
          <p style={{ fontSize: '14px', marginBottom: '5px' }}>
            <strong style={{ color: 'var(--primary)' }}>Admin:</strong> admin / admin123
          </p>
          <p style={{ fontSize: '14px' }}>
            <strong style={{ color: 'var(--primary)' }}>Usuário:</strong> user / user123
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;
