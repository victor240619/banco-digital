import React, { useState } from 'react';
import { 
  Users, 
  CreditCard, 
  ArrowRightLeft, 
  DollarSign, 
  TrendingUp,
  Activity,
  Eye,
  AlertTriangle
} from 'lucide-react';
import { formatCurrency, formatDate } from '../../utils/format';

interface DashboardStats {
  totalCustomers: number;
  totalPayments: number;
  totalTransfers: number;
  totalRevenue: number;
  monthlyGrowth: number;
  activeUsers: number;
  pendingTransactions: number;
}

interface RecentActivity {
  id: string;
  type: 'payment' | 'transfer' | 'customer';
  description: string;
  amount?: number;
  timestamp: string;
  status: 'success' | 'pending' | 'failed';
}

const AdminDashboard: React.FC = () => {
  const [stats] = useState<DashboardStats>({
    totalCustomers: 1247,
    totalPayments: 8934,
    totalTransfers: 2156,
    totalRevenue: 2847650,
    monthlyGrowth: 12.5,
    activeUsers: 892,
    pendingTransactions: 23
  });

  const [recentActivities] = useState<RecentActivity[]>([
    {
      id: '1',
      type: 'payment',
      description: 'Pagamento recebido de João Silva',
      amount: 25000,
      timestamp: new Date().toISOString(),
      status: 'success'
    },
    {
      id: '2',
      type: 'customer',
      description: 'Novo cliente cadastrado: Maria Santos',
      timestamp: new Date(Date.now() - 300000).toISOString(),
      status: 'success'
    },
    {
      id: '3',
      type: 'transfer',
      description: 'Transferência processada',
      amount: 15000,
      timestamp: new Date(Date.now() - 600000).toISOString(),
      status: 'pending'
    },
    {
      id: '4',
      type: 'payment',
      description: 'Falha no pagamento - Cartão recusado',
      amount: 5000,
      timestamp: new Date(Date.now() - 900000).toISOString(),
      status: 'failed'
    }
  ]);

  const statCards = [
    {
      title: 'Total de Clientes',
      value: stats.totalCustomers.toLocaleString(),
      icon: Users,
      color: 'from-blue-500 to-cyan-500',
      change: '+12%'
    },
    {
      title: 'Pagamentos',
      value: stats.totalPayments.toLocaleString(),
      icon: CreditCard,
      color: 'from-green-500 to-emerald-500',
      change: '+8%'
    },
    {
      title: 'Transferências',
      value: stats.totalTransfers.toLocaleString(),
      icon: ArrowRightLeft,
      color: 'from-purple-500 to-violet-500',
      change: '+15%'
    },
    {
      title: 'Receita Total',
      value: formatCurrency(stats.totalRevenue),
      icon: DollarSign,
      color: 'from-orange-500 to-red-500',
      change: '+22%'
    }
  ];

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'payment': return CreditCard;
      case 'transfer': return ArrowRightLeft;
      case 'customer': return Users;
      default: return Activity;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'text-green-400';
      case 'pending': return 'text-yellow-400';
      case 'failed': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-cyber font-bold text-white neon-text">
            Dashboard Administrativo
          </h1>
          <p className="text-cyan-400 mt-2">
            Visão geral do sistema bancário
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="glass-panel px-4 py-2">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-white text-sm">Sistema Online</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card, index) => {
          const Icon = card.icon;
          return (
            <div key={index} className="glass-panel p-6 hover:bg-white/10 transition-all duration-300">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm font-medium">{card.title}</p>
                  <p className="text-2xl font-bold text-white mt-1">{card.value}</p>
                  <div className="flex items-center mt-2">
                    <TrendingUp className="w-4 h-4 text-green-400 mr-1" />
                    <span className="text-green-400 text-sm">{card.change}</span>
                    <span className="text-gray-400 text-sm ml-1">vs mês anterior</span>
                  </div>
                </div>
                <div className={`w-12 h-12 rounded-lg bg-gradient-to-r ${card.color} flex items-center justify-center`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts and Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Performance Chart */}
        <div className="lg:col-span-2 glass-panel p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white">Performance do Sistema</h2>
            <button className="text-cyan-400 hover:text-cyan-300 transition-colors">
              <Eye className="w-5 h-5" />
            </button>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Usuários Ativos</span>
              <span className="text-white font-bold">{stats.activeUsers}</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div 
                className="bg-gradient-to-r from-cyan-500 to-blue-500 h-2 rounded-full"
                style={{ width: `${(stats.activeUsers / stats.totalCustomers) * 100}%` }}
              ></div>
            </div>
            
            <div className="flex items-center justify-between mt-4">
              <span className="text-gray-400">Crescimento Mensal</span>
              <span className="text-green-400 font-bold">+{stats.monthlyGrowth}%</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div 
                className="bg-gradient-to-r from-green-500 to-emerald-500 h-2 rounded-full"
                style={{ width: `${stats.monthlyGrowth * 4}%` }}
              ></div>
            </div>

            <div className="flex items-center justify-between mt-4">
              <span className="text-gray-400">Transações Pendentes</span>
              <div className="flex items-center">
                <AlertTriangle className="w-4 h-4 text-yellow-400 mr-1" />
                <span className="text-yellow-400 font-bold">{stats.pendingTransactions}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="glass-panel p-6">
          <h2 className="text-xl font-bold text-white mb-6">Atividade Recente</h2>
          
          <div className="space-y-4">
            {recentActivities.map((activity) => {
              const Icon = getActivityIcon(activity.type);
              return (
                <div key={activity.id} className="flex items-start space-x-3 p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4 text-cyan-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm">{activity.description}</p>
                    {activity.amount && (
                      <p className="text-cyan-400 text-sm font-medium">
                        {formatCurrency(activity.amount)}
                      </p>
                    )}
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-gray-400 text-xs">
                        {formatDate(activity.timestamp)}
                      </p>
                      <span className={`text-xs font-medium ${getStatusColor(activity.status)}`}>
                        {activity.status === 'success' ? 'Sucesso' : 
                         activity.status === 'pending' ? 'Pendente' : 'Falhou'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <button className="w-full mt-4 py-2 text-cyan-400 hover:text-cyan-300 transition-colors text-sm">
            Ver todas as atividades
          </button>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="glass-panel p-6">
        <h2 className="text-xl font-bold text-white mb-6">Ações Rápidas</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button className="cyber-button py-3 px-6 text-center">
            <Users className="w-5 h-5 mx-auto mb-2" />
            Gerenciar Clientes
          </button>
          <button className="cyber-button py-3 px-6 text-center">
            <CreditCard className="w-5 h-5 mx-auto mb-2" />
            Processar Pagamentos
          </button>
          <button className="cyber-button py-3 px-6 text-center">
            <ArrowRightLeft className="w-5 h-5 mx-auto mb-2" />
            Revisar Transferências
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;