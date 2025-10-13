import React from 'react';
import { Link } from 'react-router-dom';
import { authService } from '../services/api';

function Home() {
  const isAuthenticated = authService.isAuthenticated();
  const isAdmin = authService.hasRole('ROLE_ADMIN');

  return (
    <div className="container" style={{ marginTop: '60px' }}>
      <div style={{ textAlign: 'center', marginBottom: '60px' }}>
        <h1 style={{ 
          fontSize: '64px', 
          background: 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          marginBottom: '20px',
          fontWeight: 'bold'
        }}>
          ⚡ BRAVUS BANK
        </h1>
        <p style={{ fontSize: '24px', color: 'var(--text-secondary)', marginBottom: '40px' }}>
          O Futuro do Banking Digital
        </p>
        
        {!isAuthenticated ? (
          <div style={{ display: 'flex', gap: '20px', justifyContent: 'center' }}>
            <Link to="/login">
              <button className="btn btn-primary" style={{ padding: '16px 40px', fontSize: '18px' }}>
                Entrar
              </button>
            </Link>
            <Link to="/register">
              <button className="btn btn-secondary" style={{ padding: '16px 40px', fontSize: '18px' }}>
                Criar Conta
              </button>
            </Link>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '20px', justifyContent: 'center' }}>
            <Link to="/dashboard">
              <button className="btn btn-primary" style={{ padding: '16px 40px', fontSize: '18px' }}>
                Meu Dashboard
              </button>
            </Link>
            {isAdmin && (
              <Link to="/admin">
                <button className="btn btn-secondary" style={{ padding: '16px 40px', fontSize: '18px' }}>
                  Painel Admin
                </button>
              </Link>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-3" style={{ marginTop: '80px' }}>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>🚀</div>
          <h3 style={{ color: 'var(--primary)', marginBottom: '15px' }}>Rápido & Seguro</h3>
          <p style={{ color: 'var(--text-secondary)' }}>
            Transações instantâneas com a mais alta segurança em criptografia
          </p>
        </div>

        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>💳</div>
          <h3 style={{ color: 'var(--primary)', marginBottom: '15px' }}>Sem Taxas</h3>
          <p style={{ color: 'var(--text-secondary)' }}>
            Transferências e operações sem taxas abusivas. Transparência total
          </p>
        </div>

        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>🌐</div>
          <h3 style={{ color: 'var(--primary)', marginBottom: '15px' }}>24/7 Online</h3>
          <p style={{ color: 'var(--text-secondary)' }}>
            Acesse sua conta a qualquer hora, de qualquer lugar do mundo
          </p>
        </div>
      </div>

      <div className="card" style={{ marginTop: '60px', textAlign: 'center', padding: '60px 40px' }}>
        <h2 style={{ color: 'var(--primary)', fontSize: '32px', marginBottom: '20px' }}>
          Pronto para começar?
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '18px', marginBottom: '30px' }}>
          Abra sua conta em menos de 2 minutos
        </p>
        {!isAuthenticated && (
          <Link to="/register">
            <button className="btn btn-primary" style={{ padding: '16px 60px', fontSize: '18px' }}>
              Criar Conta Grátis
            </button>
          </Link>
        )}
      </div>
    </div>
  );
}

export default Home;
