import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AlertCircle, Loader2 } from 'lucide-react';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import UserDashboard from './pages/UserDashboard';
import AdminDashboard from './pages/AdminDashboard';
import { authService } from './services/api';

function ProtectedRoute({ children, requireAdmin = false }) {
  const isAuthenticated = authService.isAuthenticated();
  const isAdmin = authService.hasRole('ROLE_ADMIN');
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (requireAdmin && !isAdmin) return <Navigate to="/dashboard" replace />;
  return children;
}

function PublicRoute({ children }) {
  const isAuthenticated = authService.isAuthenticated();
  const isAdmin = authService.hasRole('ROLE_ADMIN');
  if (isAuthenticated) return <Navigate to={isAdmin ? '/admin' : '/dashboard'} replace />;
  return children;
}

export default function App() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    window.setGlobalLoading = setIsLoading;
    window.setGlobalError = setError;
    return () => {
      delete window.setGlobalLoading;
      delete window.setGlobalError;
    };
  }, []);

  return (
    <Router>
      <div className="min-h-screen flex flex-col">
        <Navbar />

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
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
            <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute><UserDashboard /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute requireAdmin><AdminDashboard /></ProtectedRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>

        <Footer />
      </div>
    </Router>
  );
}
