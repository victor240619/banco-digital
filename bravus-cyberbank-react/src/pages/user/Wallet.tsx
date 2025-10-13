import React, { useState } from 'react';
import { 
  Wallet, 
  Plus, 
  Send, 
  Download,
  Eye,
  EyeOff,
  QrCode,
  Copy,
  ArrowUpRight,
  ArrowDownLeft
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { formatCurrency, formatDate } from '../../utils/format';
import toast from 'react-hot-toast';

interface WalletTransaction {
  id: string;
  type: 'deposit' | 'withdrawal' | 'transfer_in' | 'transfer_out';
  description: string;
  amount: number;
  date: string;
  status: 'completed' | 'pending' | 'failed';
  reference?: string;
}

const UserWallet: React.FC = () => {
  const { user } = useAuth();
  const [showBalance, setShowBalance] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'deposit' | 'withdraw' | 'transfer'>('overview');
  
  const [transactions] = useState<WalletTransaction[]>([
    {
      id: '1',
      type: 'deposit',
      description: 'Depósito via PIX',
      amount: 50000,
      date: new Date().toISOString(),
      status: 'completed',
      reference: 'PIX-2024-001'
    },
    {
      id: '2',
      type: 'transfer_out',
      description: 'Transferência para João Silva',
      amount: -25000,
      date: new Date(Date.now() - 3600000).toISOString(),
      status: 'completed',
      reference: 'TRF-2024-002'
    },
    {
      id: '3',
      type: 'withdrawal',
      description: 'Saque no caixa eletrônico',
      amount: -10000,
      date: new Date(Date.now() - 7200000).toISOString(),
      status: 'pending',
      reference: 'WTH-2024-003'
    },
    {
      id: '4',
      type: 'transfer_in',
      description: 'Transferência recebida de Maria Santos',
      amount: 15000,
      date: new Date(Date.now() - 86400000).toISOString(),
      status: 'completed',
      reference: 'TRF-2024-004'
    }
  ]);

  const [depositForm, setDepositForm] = useState({
    amount: '',
    method: 'pix'
  });

  const [withdrawForm, setWithdrawForm] = useState({
    amount: '',
    method: 'bank_transfer'
  });

  const [transferForm, setTransferForm] = useState({
    amount: '',
    recipient: '',
    description: ''
  });

  const balance = user?.balance || 0;
  const accountNumber = '12345-6';
  const agency = '0001';
  const pixKey = user?.email || '';

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'deposit': return ArrowDownLeft;
      case 'withdrawal': return ArrowUpRight;
      case 'transfer_in': return ArrowDownLeft;
      case 'transfer_out': return ArrowUpRight;
      default: return Wallet;
    }
  };

  const getTransactionColor = (type: string, status: string) => {
    if (status === 'pending') return 'text-yellow-400';
    if (status === 'failed') return 'text-red-400';
    
    switch (type) {
      case 'deposit':
      case 'transfer_in':
        return 'text-green-400';
      case 'withdrawal':
      case 'transfer_out':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado para a área de transferência`);
  };

  const handleDeposit = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success('Solicitação de depósito enviada!');
    setDepositForm({ amount: '', method: 'pix' });
  };

  const handleWithdraw = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success('Solicitação de saque enviada!');
    setWithdrawForm({ amount: '', method: 'bank_transfer' });
  };

  const handleTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success('Transferência realizada com sucesso!');
    setTransferForm({ amount: '', recipient: '', description: '' });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-cyber font-bold text-white neon-text">
            Minha Carteira
          </h1>
          <p className="text-cyan-400 mt-2">
            Gerencie seus fundos e transações
          </p>
        </div>
      </div>

      {/* Balance Card */}
      <div className="glass-panel p-6 bg-gradient-to-r from-purple-500/10 to-pink-500/10 border-purple-500/30">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">Saldo Total</h2>
          <button
            onClick={() => setShowBalance(!showBalance)}
            className="p-2 text-purple-400 hover:text-purple-300 transition-colors"
          >
            {showBalance ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>
        
        <div className="mb-6">
          <p className="text-4xl font-cyber font-bold text-white neon-text">
            {showBalance ? formatCurrency(balance) : '••••••••'}
          </p>
          <p className="text-purple-400 mt-1">
            Disponível para uso
          </p>
        </div>

        <div className="grid grid-cols-4 gap-3">
          <button 
            onClick={() => setActiveTab('deposit')}
            className="cyber-button py-3 px-4 text-sm flex flex-col items-center space-y-1"
          >
            <Plus className="w-4 h-4" />
            <span>Depositar</span>
          </button>
          <button 
            onClick={() => setActiveTab('withdraw')}
            className="cyber-button py-3 px-4 text-sm flex flex-col items-center space-y-1"
          >
            <Download className="w-4 h-4" />
            <span>Sacar</span>
          </button>
          <button 
            onClick={() => setActiveTab('transfer')}
            className="cyber-button py-3 px-4 text-sm flex flex-col items-center space-y-1"
          >
            <Send className="w-4 h-4" />
            <span>Transferir</span>
          </button>
          <button className="cyber-button py-3 px-4 text-sm flex flex-col items-center space-y-1">
            <QrCode className="w-4 h-4" />
            <span>QR Code</span>
          </button>
        </div>
      </div>

      {/* Action Tabs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Actions */}
        <div className="space-y-6">
          {/* Account Info */}
          <div className="glass-panel p-6">
            <h3 className="text-lg font-bold text-white mb-4">Dados da Conta</h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-black/20 rounded-lg">
                <div>
                  <p className="text-gray-400 text-sm">Agência</p>
                  <p className="text-white font-mono">{agency}</p>
                </div>
                <button 
                  onClick={() => copyToClipboard(agency, 'Agência')}
                  className="p-2 text-cyan-400 hover:text-cyan-300 transition-colors"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center justify-between p-3 bg-black/20 rounded-lg">
                <div>
                  <p className="text-gray-400 text-sm">Conta</p>
                  <p className="text-white font-mono">{accountNumber}</p>
                </div>
                <button 
                  onClick={() => copyToClipboard(accountNumber, 'Número da conta')}
                  className="p-2 text-cyan-400 hover:text-cyan-300 transition-colors"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center justify-between p-3 bg-black/20 rounded-lg">
                <div>
                  <p className="text-gray-400 text-sm">Chave PIX</p>
                  <p className="text-white font-mono text-sm">{pixKey}</p>
                </div>
                <button 
                  onClick={() => copyToClipboard(pixKey, 'Chave PIX')}
                  className="p-2 text-cyan-400 hover:text-cyan-300 transition-colors"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Deposit Form */}
          {activeTab === 'deposit' && (
            <div className="glass-panel p-6">
              <h3 className="text-lg font-bold text-white mb-4">Fazer Depósito</h3>
              
              <form onSubmit={handleDeposit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Método de Depósito
                  </label>
                  <select
                    value={depositForm.method}
                    onChange={(e) => setDepositForm({...depositForm, method: e.target.value})}
                    className="w-full px-4 py-3 bg-black/20 border border-cyan-500/30 rounded-lg text-white focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors"
                  >
                    <option value="pix">PIX</option>
                    <option value="bank_transfer">Transferência Bancária</option>
                    <option value="boleto">Boleto</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Valor (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={depositForm.amount}
                    onChange={(e) => setDepositForm({...depositForm, amount: e.target.value})}
                    className="w-full px-4 py-3 bg-black/20 border border-cyan-500/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors"
                    placeholder="0.00"
                    required
                  />
                </div>

                <button type="submit" className="w-full cyber-button py-3">
                  Confirmar Depósito
                </button>
              </form>
            </div>
          )}

          {/* Withdraw Form */}
          {activeTab === 'withdraw' && (
            <div className="glass-panel p-6">
              <h3 className="text-lg font-bold text-white mb-4">Fazer Saque</h3>
              
              <form onSubmit={handleWithdraw} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Método de Saque
                  </label>
                  <select
                    value={withdrawForm.method}
                    onChange={(e) => setWithdrawForm({...withdrawForm, method: e.target.value})}
                    className="w-full px-4 py-3 bg-black/20 border border-cyan-500/30 rounded-lg text-white focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors"
                  >
                    <option value="bank_transfer">Transferência Bancária</option>
                    <option value="atm">Caixa Eletrônico</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Valor (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max={balance / 100}
                    value={withdrawForm.amount}
                    onChange={(e) => setWithdrawForm({...withdrawForm, amount: e.target.value})}
                    className="w-full px-4 py-3 bg-black/20 border border-cyan-500/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors"
                    placeholder="0.00"
                    required
                  />
                  <p className="text-gray-400 text-xs mt-1">
                    Saldo disponível: {formatCurrency(balance)}
                  </p>
                </div>

                <button type="submit" className="w-full cyber-button py-3">
                  Confirmar Saque
                </button>
              </form>
            </div>
          )}

          {/* Transfer Form */}
          {activeTab === 'transfer' && (
            <div className="glass-panel p-6">
              <h3 className="text-lg font-bold text-white mb-4">Fazer Transferência</h3>
              
              <form onSubmit={handleTransfer} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Destinatário (Email ou Chave PIX)
                  </label>
                  <input
                    type="text"
                    value={transferForm.recipient}
                    onChange={(e) => setTransferForm({...transferForm, recipient: e.target.value})}
                    className="w-full px-4 py-3 bg-black/20 border border-cyan-500/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors"
                    placeholder="email@exemplo.com"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Valor (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max={balance / 100}
                    value={transferForm.amount}
                    onChange={(e) => setTransferForm({...transferForm, amount: e.target.value})}
                    className="w-full px-4 py-3 bg-black/20 border border-cyan-500/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors"
                    placeholder="0.00"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Descrição (Opcional)
                  </label>
                  <input
                    type="text"
                    value={transferForm.description}
                    onChange={(e) => setTransferForm({...transferForm, description: e.target.value})}
                    className="w-full px-4 py-3 bg-black/20 border border-cyan-500/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors"
                    placeholder="Motivo da transferência"
                  />
                </div>

                <button type="submit" className="w-full cyber-button py-3">
                  Confirmar Transferência
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Right Column - Transactions */}
        <div className="glass-panel p-6">
          <h3 className="text-lg font-bold text-white mb-4">Histórico de Transações</h3>
          
          <div className="space-y-4 max-h-96 overflow-y-auto">
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
                        {transaction.reference && (
                          <>
                            <span className="text-gray-500">•</span>
                            <span className="text-gray-400 text-xs font-mono">
                              {transaction.reference}
                            </span>
                          </>
                        )}
                      </div>
                      <span className={`inline-block text-xs px-2 py-1 rounded-full mt-1 ${
                        transaction.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                        transaction.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-red-500/20 text-red-400'
                      }`}>
                        {transaction.status === 'completed' ? 'Concluído' :
                         transaction.status === 'pending' ? 'Pendente' : 'Falhou'}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold ${getTransactionColor(transaction.type, transaction.status)}`}>
                      {transaction.amount > 0 ? '+' : ''}{formatCurrency(Math.abs(transaction.amount))}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <button className="w-full mt-4 py-2 text-cyan-400 hover:text-cyan-300 transition-colors text-sm">
            Ver histórico completo
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserWallet;