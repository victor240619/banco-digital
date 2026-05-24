import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Menu, X, LogOut, LayoutDashboard, Shield } from 'lucide-react';
import { authService } from '../services/api';
import Logo from './Logo';
import { cn } from '../lib/cn';

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  const user = authService.getCurrentUser();
  const isAdmin = authService.hasRole('ROLE_ADMIN');
  const isAuthenticated = authService.isAuthenticated();

  const handleLogout = () => {
    authService.logout();
    navigate('/login');
  };

  const NavLink = ({ to, children }) => (
    <Link
      to={to}
      onClick={() => setOpen(false)}
      className={cn(
        'px-3 py-2 rounded-lg text-sm font-medium transition-colors',
        location.pathname === to
          ? 'text-white bg-white/10'
          : 'text-ink-200 hover:text-white hover:bg-white/5'
      )}
    >
      {children}
    </Link>
  );

  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-ink-950/70 border-b border-white/5">
      <div className="container-app">
        <div className="flex h-16 items-center justify-between">
          <Link to="/" className="shrink-0">
            <Logo />
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {isAuthenticated ? (
              <>
                <NavLink to="/dashboard">
                  <span className="inline-flex items-center gap-1.5">
                    <LayoutDashboard className="h-4 w-4" /> Dashboard
                  </span>
                </NavLink>
                {isAdmin && (
                  <NavLink to="/admin">
                    <span className="inline-flex items-center gap-1.5">
                      <Shield className="h-4 w-4" /> Admin
                    </span>
                  </NavLink>
                )}
                <div className="ml-2 flex items-center gap-3 pl-3 border-l border-white/10">
                  <div className="text-right leading-tight">
                    <div className="text-xs text-ink-400">conectado como</div>
                    <div className="text-sm font-medium text-white">{user?.username}</div>
                  </div>
                  <button onClick={handleLogout} className="btn-secondary !px-3 !py-2">
                    <LogOut className="h-4 w-4" />
                    <span className="hidden lg:inline">Sair</span>
                  </button>
                </div>
              </>
            ) : (
              <>
                <NavLink to="/login">Entrar</NavLink>
                <Link to="/register" className="btn-primary !py-2 !px-4 ml-2">
                  Abrir conta
                </Link>
              </>
            )}
          </nav>

          {/* Mobile button */}
          <button
            className="md:hidden btn-ghost !p-2"
            onClick={() => setOpen((o) => !o)}
            aria-label="Menu"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Mobile menu */}
        {open && (
          <div className="md:hidden pb-4 flex flex-col gap-1 animate-slide-up">
            {isAuthenticated ? (
              <>
                <NavLink to="/dashboard">Dashboard</NavLink>
                {isAdmin && <NavLink to="/admin">Admin</NavLink>}
                <button onClick={handleLogout} className="btn-secondary mt-2">
                  <LogOut className="h-4 w-4" /> Sair ({user?.username})
                </button>
              </>
            ) : (
              <>
                <NavLink to="/login">Entrar</NavLink>
                <Link to="/register" className="btn-primary mt-2">Abrir conta</Link>
              </>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
