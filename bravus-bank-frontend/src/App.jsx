import React, { Suspense, lazy, useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AlertCircle, Loader2 } from 'lucide-react';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import { authService } from './services/api';
import { isMobileApp } from './lib/appChannel';

const Home = lazy(() => import('./pages/Home'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const PasswordReset = lazy(() => import('./pages/PasswordReset'));
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
  if (isAuthenticated) return <Navigate to={isAdmin ? '/admin' : '/dashboard'} replace />;
  return children;
}


function NotFoundRedirect() {
  const isAuthenticated = authService.isAuthenticated();
  const isAdmin = authService.hasRole('ROLE_ADMIN');
  if (!isAuthenticated) return <Navigate to={isMobileApp() ? '/login' : '/'} replace />;
  return <Navigate to={isAdmin ? '/admin' : '/dashboard'} replace />;
}

function RootRoute() {
  if (!isMobileApp()) return <Home />;
  const isAuthenticated = authService.isAuthenticated();
  const isAdmin = authService.hasRole('ROLE_ADMIN');
  return <Navigate to={isAuthenticated ? (isAdmin ? '/admin' : '/dashboard') : '/login'} replace />;
}

export default function App() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const nativeApp = isMobileApp();

  useEffect(() => {
    window.setGlobalLoading = setIsLoading;
    window.setGlobalError = setError;
    return () => {
      delete window.setGlobalLoading;
      delete window.setGlobalError;
    };
  }, []);

  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <div className="min-h-screen flex flex-col">
        {!nativeApp && <Navbar />}

        {error && (
          <div
            onClick={() => setError(null)}
            className="cursor-pointer bg-red-500/15 border-y border-red-500/30 text-red-200 text-sm py-2 px-4 flex items-center justify-center gap-2"
          >
            <AlertCircle className="h-4 w-4" />
            <span>{typeof error === 'string' ? error : 'Ocorreu um erro inesperado.'}</span>
            <span className="text-red-300/80 text-xs">(clique para fechar)</span>
          </div>
        )}

        {isLoading && (
          <div className="fixed top-16 right-4 z-50 bg-white/[0.06] backdrop-blur-xl border border-white/10 rounded-full px-3 py-1.5 text-xs text-ink-200 flex items-center gap-2 shadow-card">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-gold-300" />
            Carregando...
          </div>
        )}

        <div className="flex-1">
          <Suspense fallback={<PageFallback />}>
            <Routes>
              <Route path="/" element={<RootRoute />} />
              <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
              <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
              <Route path="/redefinir-senha" element={<PublicRoute><PasswordReset /></PublicRoute>} />
              <Route path="/dashboard/*" element={<ProtectedRoute userOnly><UserDashboard /></ProtectedRoute>} />
              <Route path="/admin" element={<ProtectedRoute requireAdmin><AdminDashboard /></ProtectedRoute>} />
              <Route path="*" element={<NotFoundRedirect />} />
            </Routes>
          </Suspense>
        </div>

        {!nativeApp && <Footer />}
      </div>
    </Router>
  );
}
