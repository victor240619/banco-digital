import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Menu, X, LogOut, LayoutDashboard, Languages, Shield } from 'lucide-react';
import { authService } from '../services/api';
import Logo from './Logo';
import { cn } from '../lib/cn';
import { useLocale } from '../contexts/LocaleContext';

export default function Navbar({ nativeApp = false }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const { locale, localeOptions, setLocale, t } = useLocale();

  const user = authService.getCurrentUser();
  const isAdmin = authService.hasRole('ROLE_ADMIN');
  const isAuthenticated = authService.isAuthenticated();
  const institutionalRoute = location.pathname === '/'
    || /^\/(produto|empresa)(\/|$)/.test(location.pathname)
    || location.pathname === '/canais-atendimento';
  const publicLinks = [
    ['Conta pessoal', '/produto/conta-digital'],
    ['Empresas', '/produto/transferencias'],
    ['Investimentos', '/produto/investimentos'],
    ['Empresa', '/empresa/sobre'],
    ['Ajuda', '/canais-atendimento'],
  ];

  const LanguageSelect = ({ mobile = false }) => (
    <label className={cn('flex items-center gap-2 text-sm text-ink-300', mobile ? 'mt-2 px-3 py-2' : 'ml-2')}>
      <Languages className="h-4 w-4 shrink-0 text-gold-300" aria-hidden="true" />
      <span className="sr-only">{t('Idioma')}</span>
      <select
        aria-label={t('Idioma')}
        className="min-h-10 rounded-lg border border-white/10 bg-ink-950 px-2 text-sm text-white outline-none focus:border-gold-300"
        onChange={(event) => setLocale(event.target.value)}
        value={locale}
      >
        {localeOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
    </label>
  );

  const handleLogout = async () => {
    let logoutStatus = { serverRevoked: true };
    try {
      logoutStatus = await authService.logout();
    } finally {
      setOpen(false);
      navigate('/login', { replace: true });
    }
    if (!logoutStatus.serverRevoked && window.setGlobalError) {
      window.setGlobalError('A conta saiu deste aparelho, mas a conexao impediu a revogacao remota. Entre novamente para renovar a seguranca da sessao.');
    }
  };

  const NavLink = ({ to, children }) => (
    <Link
      to={to}
      onClick={() => setOpen(false)}
      className={cn(
        'px-3 py-2 rounded-lg text-sm font-medium transition-colors',
        location.pathname === to
          ? 'bg-white/[0.08] text-white'
          : 'text-ink-300 hover:bg-white/[0.05] hover:text-white'
      )}
    >
      {children}
    </Link>
  );

  if (nativeApp && !isAuthenticated) return null;

  if (nativeApp) {
    const home = isAdmin ? '/admin' : '/dashboard';
    return (
      <header className="native-app-header sticky top-0 z-40 border-b border-white/10 bg-ink-950">
        <div className="native-safe-top flex min-h-16 items-center justify-between gap-3 px-3">
          <Link to={home} className="min-w-0 shrink">
            <Logo />
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="btn-secondary min-h-11 shrink-0 !px-3 !py-2"
            aria-label="Sair da conta"
          >
            <LogOut className="h-4 w-4" />
            <span>Sair</span>
          </button>
        </div>
      </header>
    );
  }

  return (
    <header className="vantyx-nav sticky top-0 z-40 border-b border-white/[0.08] bg-ink-950/95 backdrop-blur-xl">
      <div className="container-app">
        <div className="flex h-20 items-center justify-between gap-6">
          <Link to="/" className="shrink-0">
            <Logo />
          </Link>

          {/* Desktop nav */}
          <nav className="hidden flex-1 items-center justify-end gap-1 md:flex">
            {isAuthenticated ? (
              <>
                {isAdmin ? (
                  <NavLink to="/admin">
                    <span className="inline-flex items-center gap-1.5">
                      <Shield className="h-4 w-4" /> {t('Painel Admin')}
                    </span>
                  </NavLink>
                ) : (
                  <NavLink to="/dashboard">
                    <span className="inline-flex items-center gap-1.5">
                      <LayoutDashboard className="h-4 w-4" /> {t('Minha Conta')}
                    </span>
                  </NavLink>
                )}
                <div className="ml-2 flex items-center gap-3 pl-3 border-l border-white/10">
                  <div className="text-right leading-tight">
                    <div className="text-xs text-ink-400">{t('conectado como')}</div>
                    <div className="text-sm font-medium text-white">{user?.username}</div>
                  </div>
                  <button onClick={handleLogout} className="btn-secondary !px-3 !py-2">
                    <LogOut className="h-4 w-4" />
                    <span className="hidden lg:inline">{t('Sair')}</span>
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="mr-auto flex items-center gap-0.5 lg:mx-auto">
                  {publicLinks.map(([label, to]) => <NavLink key={to} to={to}>{t(label)}</NavLink>)}
                </div>
                {institutionalRoute && <LanguageSelect />}
                <NavLink to="/login">{t('Entrar')}</NavLink>
                <Link to="/register" className="btn-primary ml-2 !rounded-lg !px-5 !py-2.5">
                  {t('Abrir conta')}
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
                {isAdmin
                  ? <NavLink to="/admin">{t('Painel Admin')}</NavLink>
                  : <NavLink to="/dashboard">{t('Minha Conta')}</NavLink>}
                <button onClick={handleLogout} className="btn-secondary mt-2">
                  <LogOut className="h-4 w-4" /> {t('Sair')} ({user?.username})
                </button>
              </>
            ) : (
              <>
                {publicLinks.map(([label, to]) => <NavLink key={to} to={to}>{t(label)}</NavLink>)}
                {institutionalRoute && <LanguageSelect mobile />}
                <NavLink to="/login">{t('Entrar')}</NavLink>
                <Link to="/register" className="btn-primary mt-2">{t('Abrir conta')}</Link>
              </>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
