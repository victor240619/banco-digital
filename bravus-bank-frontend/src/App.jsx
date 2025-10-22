import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import UserDashboard from './pages/UserDashboard';
import AdminDashboard from './pages/AdminDashboard';
import { authService } from './services/api';

// Protected Route Component
function ProtectedRoute({ children, requireAdmin = false }) {
  const isAuthenticated = authService.isAuthenticated();
  const isAdmin = authService.hasRole('ROLE_ADMIN');

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

// Public Route Component (redirects authenticated users)
function PublicRoute({ children }) {
  const isAuthenticated = authService.isAuthenticated();
  const isAdmin = authService.hasRole('ROLE_ADMIN');

  if (isAuthenticated) {
    return <Navigate to={isAdmin ? "/admin" : "/dashboard"} replace />;
  }

  return children;
}

function App() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Make loading and error setters available globally
  useEffect(() => {
    window.setGlobalLoading = setIsLoading;
    window.setGlobalError = setError;
    
    const handleGlobalError = (event) => {
      console.error('Global error:', event.error);
      setError('An unexpected error occurred. Please try again.');
    };

    window.addEventListener('error', handleGlobalError);
    return () => {
      window.removeEventListener('error', handleGlobalError);
      delete window.setGlobalLoading;
      delete window.setGlobalError;
    };
  }, []);

  return (
    <Router>
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0a0e27 0%, #1a1f3a 100%)' }}>
        <Navbar />
        {error && (
          <div style={{ 
            background: '#ff4444', 
            color: 'white', 
            padding: '10px', 
            textAlign: 'center',
            cursor: 'pointer'
          }} onClick={() => setError(null)}>
            {error} (Click to dismiss)
          </div>
        )}
        {isLoading && (
          <div style={{ 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0, 
            background: 'rgba(0,0,0,0.5)', 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center',
            zIndex: 9999
          }}>
            <div style={{ color: 'white', fontSize: '18px' }}>Loading...</div>
          </div>
        )}
        <Routes>
          <Route path="/" element={<Home />} />
          
          <Route 
            path="/login" 
            element={
              <PublicRoute>
                <Login />
              </PublicRoute>
            } 
          />
          
          <Route 
            path="/register" 
            element={
              <PublicRoute>
                <Register />
              </PublicRoute>
            } 
          />
          
          <Route 
            path="/dashboard" 
            element={
              <ProtectedRoute>
                <UserDashboard />
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/admin" 
            element={
              <ProtectedRoute requireAdmin={true}>
                <AdminDashboard />
              </ProtectedRoute>
            } 
          />
          
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
