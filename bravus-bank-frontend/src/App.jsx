import React, { Suspense, lazy, useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ViewportAlert from './components/ViewportAlert';
import { authService } from './services/api';
import { isAccountApp, isMobileApp } from './lib/appChannel';
import { accountDestination } from './lib/accountApp';

const Home = lazy(() => import('./pages/Home'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const InstitutionalPage = lazy(() => import('./pages/InstitutionalPage'));
const ServiceChannels = lazy(() => import('./pages/ServiceChannels'));
const PasswordReset = lazy(() => import('./pages/PasswordReset'));
const IdentityVerification = lazy(() => import('./pages/IdentityVerification'));
const UserDashboard = lazy(() => import('./pages/UserDashboard'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));

function PageFallback() {
  return (
    <div className="container-app py-16">
      <div className="card-premium mx-auto flex max-w-sm items-center justify-center gap-2 p-6 text-sm text-ink-200">
        <Loader2 className="h-4 w-4 animate-spin text-gold-300" />
        Carregando pagina...
      </div>
    </div>
  );
}

function ProtectedRoute({ children, requireAdmin = false, userOnly = false }) {
  const isAuthenticated = authService.isAuthenticated();
  const isAdmin = authService.hasRole('ROLE_ADMIN');
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  // Admin tentando entrar na tela de usuário → manda pro /admin
  if (userOnly && isAdmin) return <Navigate to="/admin" replace />;
  // Usuário comum tentando entrar no /admin → manda pro /dashboard
  if (requireAdmin && !isAdmin) return <Navigate to="/dashboard" replace />;
  return children;
}

function PublicRoute({ children }) {
  const isAuthenticated = authService.isAuthenticated();
  const isAdmin = authService.hasRole('ROLE_ADMIN');
  const user = authService.getCurrentUser();
  if (isAuthenticated) return <Navigate to={isAdmin ? '/admin' : (user?.identityEvidenceRequired ? '/completar-identidade' : '/dashboard')} replace />;
  return children;
}

function AccountTheme({ children }) {
  useEffect(() => {
    document.body.classList.add('account-obsidian-page');
    return () => document.body.classList.remove('account-obsidian-page');
  }, []);
  return children;
}


function NotFoundRedirect() {
  const isAuthenticated = authService.isAuthenticated();
  const isAdmin = authService.hasRole('ROLE_ADMIN');
  const user = authService.getCurrentUser();
  if (!isAuthenticated) return <Navigate to={isAccountApp() ? '/login' : '/'} replace />;
  return <Navigate to={isAdmin ? '/admin' : (user?.identityEvidenceRequired ? '/completar-identidade' : '/dashboard')} replace />;
}

function AccountEntry() {
  const destination = accountDestination({
    authenticated: authService.isAuthenticated(),
    admin: authService.hasRole('ROLE_ADMIN'),
    identityEvidenceRequired: authService.getCurrentUser()?.identityEvidenceRequired,
  });
  return <Navigate to={destination} replace />;
}

function AppContent() {
  // Re-evaluate when a route changes (including navigation to /app in a web tab).
  useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const nativeApp = isAccountApp();
  const nativeSession = isMobileApp();

  useEffect(() => {
    window.setGlobalLoading = setIsLoading;
    window.setGlobalError = setError;
    document.documentElement.classList.toggle('native-app', nativeApp);
    document.body.classList.toggle('native-app', nativeApp);
    return () => {
      delete window.setGlobalLoading;
      delete window.setGlobalError;
      document.documentElement.classList.remove('native-app');
      document.body.classList.remove('native-app');
    };
  }, [nativeApp]);

  useEffect(() => {
    if (!nativeSession) return undefined;
    let loginRequired = false;
    const endNativeSession = () => {
      const hadSession = authService.isAuthenticated();
      void authService.logout({ reason: 'APP_BACKGROUND', keepalive: true });
      if (hadSession) loginRequired = true;
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        endNativeSession();
        return;
      }
      const protectedPath = /^\/(dashboard|admin|completar-identidade)(\/|$)/.test(window.location.pathname);
      if ((loginRequired || protectedPath) && !authService.isAuthenticated()) {
        window.location.replace('/login');
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', endNativeSession);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', endNativeSession);
    };
  }, [nativeSession]);

  return (
    <MotionConfig reducedMotion={nativeApp ? 'always' : 'user'}>
      <div className="flex min-h-screen min-w-0 flex-col">
        <Navbar nativeApp={nativeApp} />

        <ViewportAlert
          message={error ? (typeof error === 'string' ? error : 'Ocorreu um erro inesperado.') : ''}
          onDismiss={() => setError(null)}
        />

        {isLoading && (
          <div className="fixed top-16 right-4 z-50 bg-white/[0.06] backdrop-blur-xl border border-white/10 rounded-full px-3 py-1.5 text-xs text-ink-200 flex items-center gap-2 shadow-card">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-gold-300" />
            Carregando...
          </div>
        )}

        <div className="flex-1">
          <Suspense fallback={<PageFallback />}>
            <Routes>
              <Route path="/app" element={<AccountEntry />} />
              {nativeApp ? (
                <Route path="/" element={<AccountEntry />} />
              ) : <>
                <Route path="/" element={<Home />} />
                <Route path="/produto/:slug" element={<InstitutionalPage section="produto" />} />
                <Route path="/empresa/:slug" element={<InstitutionalPage section="empresa" />} />
                <Route path="/canais-atendimento" element={<ServiceChannels />} />
              </>}
              <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
              <Route path="/register/*" element={<PublicRoute><Register /></PublicRoute>} />
              <Route path="/redefinir-senha" element={<PublicRoute><PasswordReset /></PublicRoute>} />
              <Route path="/completar-identidade" element={<ProtectedRoute userOnly><AccountTheme><IdentityVerification /></AccountTheme></ProtectedRoute>} />
              <Route path="/dashboard/*" element={<ProtectedRoute userOnly><AccountTheme><UserDashboard /></AccountTheme></ProtectedRoute>} />
              <Route path="/admin" element={<ProtectedRoute requireAdmin><AccountTheme><AdminDashboard /></AccountTheme></ProtectedRoute>} />
              <Route path="*" element={<NotFoundRedirect />} />
            </Routes>
          </Suspense>
        </div>

        {!nativeApp && <Footer />}
      </div>
    </MotionConfig>
  );
}

export default function App() {
  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AppContent />
    </Router>
  );
}
