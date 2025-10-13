import React from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { 
  LogOut, 
  Home, 
  Users, 
  CreditCard, 
  ArrowRightLeft, 
  Settings,
  Wallet,
  PieChart,
  Shield
} from 'lucide-react';

const Layout: React.FC = () => {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path: string) => location.pathname === path;

  const adminMenuItems = [
    { path: '/admin', icon: Home, label: 'Dashboard' },
    { path: '/admin/customers', icon: Users, label: 'Clientes' },
    { path: '/admin/payments', icon: CreditCard, label: 'Pagamentos' },
    { path: '/admin/transfers', icon: ArrowRightLeft, label: 'Transferências' },
    { path: '/admin/reports', icon: PieChart, label: 'Relatórios' },
    { path: '/admin/settings', icon: Settings, label: 'Configurações' },
  ];

  const userMenuItems = [
    { path: '/dashboard', icon: Home, label: 'Dashboard' },
    { path: '/wallet', icon: Wallet, label: 'Carteira' },
    { path: '/payments', icon: CreditCard, label: 'Pagamentos' },
    { path: '/transfers', icon: ArrowRightLeft, label: 'Transferências' },
    { path: '/profile', icon: Settings, label: 'Perfil' },
  ];

  const menuItems = isAdmin ? adminMenuItems : userMenuItems;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 matrix-bg">
      {/* Sidebar */}
      <div className="fixed inset-y-0 left-0 z-50 w-64 bg-black/20 backdrop-blur-xl border-r border-cyan-500/20">
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-center h-16 border-b border-cyan-500/20">
            <div className="flex items-center space-x-2">
              <Shield className="w-8 h-8 text-cyan-400" />
              <span className="text-xl font-cyber font-bold text-white neon-text">
                BRAVUS
              </span>
            </div>
          </div>

          {/* User Info */}
          <div className="p-4 border-b border-cyan-500/20">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-sm">
                  {user?.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <p className="text-white font-medium text-sm">{user?.name}</p>
                <p className="text-cyan-400 text-xs">
                  {isAdmin ? 'Administrador' : 'Cliente'}
                </p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-2">
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                    isActive(item.path)
                      ? 'bg-cyan-500/20 text-cyan-400 neon-border'
                      : 'text-gray-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Logout Button */}
          <div className="p-4 border-t border-cyan-500/20">
            <button
              onClick={handleLogout}
              className="flex items-center space-x-3 w-full px-4 py-3 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-all duration-200"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-medium">Sair</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="ml-64">
        {/* Header */}
        <header className="bg-black/10 backdrop-blur-xl border-b border-cyan-500/20 px-6 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-cyber font-bold text-white">
              {isAdmin ? 'Painel Administrativo' : 'Área do Cliente'}
            </h1>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-white font-medium">{user?.name}</p>
                <p className="text-cyan-400 text-sm">{user?.email}</p>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;