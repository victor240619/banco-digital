import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './hooks/useAuth';

// Components
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';

// Admin Pages
import AdminDashboard from './pages/admin/Dashboard';
import AdminCustomers from './pages/admin/Customers';
import AdminPayments from './pages/admin/Payments';
import AdminTransfers from './pages/admin/Transfers';

// User Pages
import UserDashboard from './pages/user/Dashboard';
import UserWallet from './pages/user/Wallet';

const AppRoutes: React.FC = () => {
  const { isAuthenticated, isAdmin } = useAuth();

  return (
    <Routes>
      {/* Public Routes */}
      <Route 
        path="/login" 
        element={!isAuthenticated ? <Login /> : <Navigate to={isAdmin ? "/admin" : "/dashboard"} />} 
      />
      <Route 
        path="/register" 
        element={!isAuthenticated ? <Register /> : <Navigate to={isAdmin ? "/admin" : "/dashboard"} />} 
      />
      
      {/* Protected Routes */}
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        {/* Admin Routes */}
        <Route 
          path="admin" 
          element={
            <ProtectedRoute adminOnly>
              <AdminDashboard />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="admin/customers" 
          element={
            <ProtectedRoute adminOnly>
              <AdminCustomers />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="admin/payments" 
          element={
            <ProtectedRoute adminOnly>
              <AdminPayments />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="admin/transfers" 
          element={
            <ProtectedRoute adminOnly>
              <AdminTransfers />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="admin/reports" 
          element={
            <ProtectedRoute adminOnly>
              <div className="glass-panel p-8 text-center">
                <h2 className="text-2xl font-bold text-white mb-4">Relatórios</h2>
                <p className="text-gray-400">Módulo de relatórios em desenvolvimento</p>
              </div>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="admin/settings" 
          element={
            <ProtectedRoute adminOnly>
              <div className="glass-panel p-8 text-center">
                <h2 className="text-2xl font-bold text-white mb-4">Configurações</h2>
                <p className="text-gray-400">Módulo de configurações em desenvolvimento</p>
              </div>
            </ProtectedRoute>
          } 
        />

        {/* User Routes */}
        <Route path="dashboard" element={<UserDashboard />} />
        <Route path="wallet" element={<UserWallet />} />
        <Route 
          path="payments" 
          element={
            <div className="glass-panel p-8 text-center">
              <h2 className="text-2xl font-bold text-white mb-4">Pagamentos</h2>
              <p className="text-gray-400">Módulo de pagamentos em desenvolvimento</p>
            </div>
          } 
        />
        <Route 
          path="transfers" 
          element={
            <div className="glass-panel p-8 text-center">
              <h2 className="text-2xl font-bold text-white mb-4">Transferências</h2>
              <p className="text-gray-400">Módulo de transferências em desenvolvimento</p>
            </div>
          } 
        />
        <Route 
          path="profile" 
          element={
            <div className="glass-panel p-8 text-center">
              <h2 className="text-2xl font-bold text-white mb-4">Perfil</h2>
              <p className="text-gray-400">Módulo de perfil em desenvolvimento</p>
            </div>
          } 
        />
      </Route>

      {/* Redirect root to appropriate dashboard */}
      <Route 
        path="/" 
        element={
          <Navigate to={
            !isAuthenticated ? "/login" : 
            isAdmin ? "/admin" : "/dashboard"
          } />
        } 
      />
      
      {/* Catch all route */}
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <AppRoutes />
          <Toaster 
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: 'rgba(0, 0, 0, 0.8)',
                color: '#fff',
                border: '1px solid rgba(0, 212, 255, 0.3)',
                backdropFilter: 'blur(10px)',
              },
              success: {
                iconTheme: {
                  primary: '#00ff41',
                  secondary: '#000',
                },
              },
              error: {
                iconTheme: {
                  primary: '#ff0080',
                  secondary: '#000',
                },
              },
            }}
          />
        </div>
      </Router>
    </AuthProvider>
  );
};

export default App;