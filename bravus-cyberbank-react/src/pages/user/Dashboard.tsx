import React, { useState } from 'react';
import { 
  Wallet, 
  CreditCard, 
  ArrowRightLeft, 
  TrendingUp,
  Eye,
  EyeOff,
  Plus,
  Send,
  Download,
  Activity
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { formatCurrency, formatDate } from '../../utils/format';

interface Transaction {
  id: string;
  type: 'payment' | 'transfer' | 'deposit';
  description: string;
  amount: number;
  date: string;
  status: 'completed' | 'pending' | 'failed';
}

const UserDashboard: React.FC = () => {
  const { user } = useAuth();
  const [showBalance, setShowBalance] = useState(true);
  const [transactions] = useState<Transaction[]>([
    {
      id: '1',
      type: 'deposit',
      description: 'Depósito via PIX',
      amount: 50000,
      date: new Date().toISOString(),
      status: 'completed'
    },
    {
      id: '2',
      type: 'payment',
      description: 'Pagamento - Mercado Online',
      amount: -12500,
      date: new Date(Date.now() - 3600000).toISOString(),
      status: 'completed'
    },
    {
      id: '3',
      type: 'transfer',
      description: 'Transferência para João Silva',
      amount: -25000,
      date: new Date(Date.now() - 7200000).toISOString(),
      status: 'completed'
    },
    {
      id: '4',
      type: 'payment',
      description: 'Pagamento - Streaming Service',
      amount: -2990,
      date: new Date(Date.now() - 86400000).toISOString(),
      status: 'pending'
    }
  ]);

  const balance = user?.balance || 0;
  const monthlyIncome = 75000;
  const monthlyExpenses = 45000;

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'payment': return CreditCard;
      case 'transfer': return ArrowRightLeft;
      case 'deposit': return TrendingUp;
      default: return Activity;
    }
  };

  const getTransactionColor = (amount: number, status: string) => {
    if (status === 'pending') return 'text-yellow-400';
    if (status === 'failed') return 'text-red-400';
    return amount > 0 ? 'text-green-400' : 'text-red-400';
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed': return 'Concluído';
      case 'pending': return 'Pendente';
      case 'failed': return 'Falhou';
      default: return 'Desconhecido';
    }
  };

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="glass-panel p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-cyber font-bold text-white neon-text">
              Olá, {user?.name?.split(' ')[0]}! 👋
            </h1>
            <p className="text-cyan-400 mt-2">
              Bem-vindo ao seu banco digital do futuro
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-right">
              <p className="text-gray-400 text-sm">Último acesso</p>
              <p className="text-white">Hoje às 14:30</p>
            </div>
          </div>
        </div>
      </div>

      {/* Balance Card */}
      <div className="glass-panel p-6 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border-cyan-500/30">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">Saldo Disponível</h2>
          <button
            onClick={() => setShowBalance(!showBalance)}
            className="p-2 text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            {showBalance ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>
        
        <div className="mb-6">
          <p className="text-4xl font-cyber font-bold text-white neon-text">
            {showBalance ? formatCurrency(balance) : '••••••••'}
          </p>
          <p className="text-cyan-400 mt-1">
            Conta: {user?.type === 'PF' ? 'Pessoa Física' : 'Pessoa Jurídica'}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <button className="cyber-button py-3 px-4 text-sm flex items-center justify-center space-x-2">
            <Plus className="w-4 h-4" />
            <span>Depositar</span>
          </button>
          <button className="cyber-button py-3 px-4 text-sm flex items-center justify-center space-x-2">
            <Send className="w-4 h-4" />
            <span>Transferir</span>
          </button>
          <button className="cyber-button py-3 px-4 text-sm flex items-center justify-center space-x-2">
            <Download className="w-4 h-4" />
            <span>Sacar</span>
          </button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-panel p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm font-medium">Receitas do Mês</p>
              <p className="text-2xl font-bold text-green-400 mt-1">
                {formatCurrency(monthlyIncome)}
              </p>
              <div className="flex items-center mt-2">
                <TrendingUp className="w-4 h-4 text-green-400 mr-1" />
                <span className="text-green-400 text-sm">+12.5%</span>
              </div>
            </div>
            <div className="w-12 h-12 rounded-lg bg-gradient-to-r from-green-500 to-emerald-500 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>

        <div className="glass-panel p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm font-medium">Gastos do Mês</p>
              <p className="text-2xl font-bold text-red-400 mt-1">
                {formatCurrency(monthlyExpenses)}
              </p>
              <div className="flex items-center mt-2">
                <span className="text-red-400 text-sm">-8.2%</span>
                <span className="text-gray-400 text-sm ml-1">vs mês anterior</span>
              </div>
            </div>
            <div className="w-12 h-12 rounded-lg bg-gradient-to-r from-red-500 to-orange-500 flex items-center justify-center">
              <CreditCard className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>

        <div className="glass-panel p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm font-medium">Economia</p>
              <p className="text-2xl font-bold text-cyan-400 mt-1">
                {formatCurrency(monthlyIncome - monthlyExpenses)}
              </p>
              <div className="flex items-center mt-2">
                <span className="text-cyan-400 text-sm">
                  {((monthlyIncome - monthlyExpenses) / monthlyIncome * 100).toFixed(1)}%
                </span>
                <span className="text-gray-400 text-sm ml-1">da renda</span>
              </div>
            </div>
            <div className="w-12 h-12 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 flex items-center justify-center">
              <Wallet className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="glass-panel p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Transações Recentes</h2>
          <button className="text-cyan-400 hover:text-cyan-300 transition-colors text-sm">
            Ver todas
          </button>
        </div>

        <div className="space-y-4">
          {transactions.map((transaction) => {
            const Icon = getTransactionIcon(transaction.type);
            return (
              <div key={transaction.id} className="flex items-center justify-between p-4 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div>
                    <p className="text-white font-medium">{transaction.description}</p>
                    <div className="flex items-center space-x-2 mt-1">
                      <p className="text-gray-400 text-sm">
                        {formatDate(transaction.date)}
                      </p>
                      <span className="text-gray-500">•</span>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        transaction.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                        transaction.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-red-500/20 text-red-400'
                      }`}>
                        {getStatusText(transaction.status)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-bold ${getTransactionColor(transaction.amount, transaction.status)}`}>
                    {transaction.amount > 0 ? '+' : ''}{formatCurrency(Math.abs(transaction.amount))}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Payment Card */}
        <div className="glass-panel p-6">
          <h3 className="text-lg font-bold text-white mb-4">Fazer Pagamento</h3>
          <p className="text-gray-400 text-sm mb-4">
            Pague contas, boletos ou faça transferências instantâneas
          </p>
          <button className="w-full cyber-button py-3">
            <CreditCard className="w-5 h-5 mx-auto mb-1" />
            Pagar Agora
          </button>
        </div>

        {/* Investment Card */}
        <div className="glass-panel p-6">
          <h3 className="text-lg font-bold text-white mb-4">Investimentos</h3>
          <p className="text-gray-400 text-sm mb-4">
            Faça seu dinheiro render com nossos produtos de investimento
          </p>
          <button className="w-full cyber-button py-3">
            <TrendingUp className="w-5 h-5 mx-auto mb-1" />
            Investir
          </button>
        </div>
      </div>

      {/* Account Info */}
      <div className="glass-panel p-6">
        <h2 className="text-xl font-bold text-white mb-4">Informações da Conta</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="text-white font-medium mb-3">Dados Pessoais</h4>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-400">Nome:</span>
                <span className="text-white">{user?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Email:</span>
                <span className="text-white">{user?.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Tipo:</span>
                <span className="text-white">
                  {user?.type === 'PF' ? 'Pessoa Física' : 'Pessoa Jurídica'}
                </span>
              </div>
              {user?.document && (
                <div className="flex justify-between">
                  <span className="text-gray-400">
                    {user.type === 'PF' ? 'CPF' : 'CNPJ'}:
                  </span>
                  <span className="text-white">{user.document}</span>
                </div>
              )}
            </div>
          </div>

          <div>
            <h4 className="text-white font-medium mb-3">Segurança</h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Autenticação 2FA:</span>
                <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-xs">
                  Ativo
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Última senha alterada:</span>
                <span className="text-white text-sm">15 dias atrás</span>
              </div>
              <button className="text-cyan-400 hover:text-cyan-300 transition-colors text-sm">
                Alterar configurações de segurança
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserDashboard;