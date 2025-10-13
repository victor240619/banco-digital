import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authService } from '../services/api';

function Navbar() {
  const navigate = useNavigate();
  const user = authService.getCurrentUser();
  const isAdmin = authService.hasRole('ROLE_ADMIN');
  const isAuthenticated = authService.isAuthenticated();

  const handleLogout = () => {
    authService.logout();
    navigate('/login');
  };

  return (
    <nav className="navbar">
      <div className="navbar-content">
        <Link to="/" className="navbar-brand">
          ⚡ BRAVUS BANK
        </Link>
        <div className="navbar-menu">
          {isAuthenticated ? (
            <>
              {isAdmin && (
                <Link to="/admin" className="navbar-link">
                  Admin Dashboard
                </Link>
              )}
              <Link to="/dashboard" className="navbar-link">
                Dashboard
              </Link>
              <span className="navbar-link" style={{ color: 'var(--primary)' }}>
                {user?.username}
              </span>
              <button onClick={handleLogout} className="btn btn-secondary" style={{ padding: '8px 16px' }}>
                Sair
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="navbar-link">
                Login
              </Link>
              <Link to="/register">
                <button className="btn btn-primary" style={{ padding: '8px 16px' }}>
                  Cadastrar
                </button>
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
