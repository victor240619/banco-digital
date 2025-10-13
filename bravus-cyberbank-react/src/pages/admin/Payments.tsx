import React, { useState, useEffect } from 'react';
import { 
  CreditCard, 
  Plus, 
  Search, 
  Filter, 
  Eye, 
  CheckCircle,
  Clock,
  XCircle,
  DollarSign
} from 'lucide-react';
import { Payment, CreatePaymentRequest } from '../../types';
import { paymentAPI, customerAPI } from '../../services/api';
import { formatCurrency, formatDate } from '../../utils/format';
import toast from 'react-hot-toast';

const AdminPayments: React.FC = () => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'succeeded' | 'pending' | 'failed'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);

  const [newPayment, setNewPayment] = useState<CreatePaymentRequest>({
    customerId: '',
    amountInCents: 0,
    description: '',
    destinationAccountId: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [paymentsData, customersData] = await Promise.all([
        paymentAPI.getAll(),
        customerAPI.getAll()
      ]);
      setPayments(paymentsData);
      setCustomers(customersData);
    } catch (error) {
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const payment = await paymentAPI.create(newPayment);
      setPayments([payment, ...payments]);
      setShowCreateModal(false);
      setNewPayment({
        customerId: '',
        amountInCents: 0,
        description: '',
        destinationAccountId: ''
      });
      toast.success('Pagamento criado com sucesso!');
    } catch (error) {
      toast.error('Erro ao criar pagamento');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'succeeded': return <CheckCircle className="w-5 h-5 text-green-400" />;
      case 'pending': return <Clock className="w-5 h-5 text-yellow-400" />;
      case 'failed': return <XCircle className="w-5 h-5 text-red-400" />;
      default: return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'succeeded': return 'Sucesso';
      case 'pending': return 'Pendente';
      case 'failed': return 'Falhou';
      default: return 'Desconhecido';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'succeeded': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'pending': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'failed': return 'bg-red-500/20 text-red-400 border-red-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const filteredPayments = payments.filter(payment => {
    const matchesSearch = payment.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         payment.stripePaymentIntentId.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === 'all' || payment.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-cyber font-bold text-white neon-text">
            Gerenciar Pagamentos
          </h1>
          <p className="text-cyan-400 mt-2">
            {payments.length} pagamentos processados
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="cyber-button flex items-center space-x-2 px-6 py-3"
        >
          <Plus className="w-5 h-5" />
          <span>Novo Pagamento</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { 
            title: 'Total de Pagamentos', 
            value: payments.length.toString(),
            icon: CreditCard,
            color: 'from-blue-500 to-cyan-500'
          },
          { 
            title: 'Pagamentos Aprovados', 
            value: payments.filter(p => p.status === 'succeeded').length.toString(),
            icon: CheckCircle,
            color: 'from-green-500 to-emerald-500'
          },
          { 
            title: 'Pagamentos Pendentes', 
            value: payments.filter(p => p.status === 'pending').length.toString(),
            icon: Clock,
            color: 'from-yellow-500 to-orange-500'
          },
          { 
            title: 'Valor Total', 
            value: formatCurrency(payments.reduce((sum, p) => sum + p.grossAmount, 0)),
            icon: DollarSign,
            color: 'from-purple-500 to-violet-500'
          }
        ].map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div key={index} className="glass-panel p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm font-medium">{stat.title}</p>
                  <p className="text-2xl font-bold text-white mt-1">{stat.value}</p>
                </div>
                <div className={`w-12 h-12 rounded-lg bg-gradient-to-r ${stat.color} flex items-center justify-center`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="glass-panel p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar por descrição ou ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-black/20 border border-cyan-500/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors"
            />
          </div>
          
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="w-full pl-12 pr-4 py-3 bg-black/20 border border-cyan-500/30 rounded-lg text-white focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors"
            >
              <option value="all">Todos os status</option>
              <option value="succeeded">Aprovados</option>
              <option value="pending">Pendentes</option>
              <option value="failed">Falharam</option>
            </select>
          </div>

          <div className="flex items-center justify-end">
            <span className="text-gray-400 text-sm">
              {filteredPayments.length} de {payments.length} pagamentos
            </span>
          </div>
        </div>
      </div>

      {/* Payments Table */}
      <div className="glass-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-black/20 border-b border-cyan-500/20">
              <tr>
                <th className="text-left p-4 text-cyan-400 font-medium">ID / Descrição</th>
                <th className="text-left p-4 text-cyan-400 font-medium">Valor</th>
                <th className="text-left p-4 text-cyan-400 font-medium">Taxa</th>
                <th className="text-left p-4 text-cyan-400 font-medium">Status</th>
                <th className="text-left p-4 text-cyan-400 font-medium">Data</th>
                <th className="text-left p-4 text-cyan-400 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredPayments.map((payment) => (
                <tr key={payment.id} className="border-b border-gray-700/50 hover:bg-white/5 transition-colors">
                  <td className="p-4">
                    <div>
                      <p className="text-white font-medium font-mono text-sm">
                        {payment.stripePaymentIntentId}
                      </p>
                      <p className="text-gray-400 text-sm">
                        {payment.description || 'Sem descrição'}
                      </p>
                    </div>
                  </td>
                  <td className="p-4">
                    <p className="text-white font-bold">
                      {formatCurrency(payment.grossAmount)}
                    </p>
                  </td>
                  <td className="p-4">
                    <p className="text-gray-300">
                      {formatCurrency(payment.feeAmount)}
                    </p>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(payment.status)}
                      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(payment.status)}`}>
                        {getStatusText(payment.status)}
                      </span>
                    </div>
                  </td>
                  <td className="p-4 text-gray-300">
                    {formatDate(payment.createdAt)}
                  </td>
                  <td className="p-4">
                    <button
                      onClick={() => setSelectedPayment(payment)}
                      className="p-2 text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10 rounded-lg transition-colors"
                      title="Ver detalhes"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredPayments.length === 0 && (
          <div className="text-center py-12">
            <CreditCard className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">Nenhum pagamento encontrado</p>
          </div>
        )}
      </div>

      {/* Create Payment Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-panel p-8 max-w-md w-full">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">Novo Pagamento</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCreatePayment} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Cliente *
                </label>
                <select
                  value={newPayment.customerId}
                  onChange={(e) => setNewPayment({...newPayment, customerId: e.target.value})}
                  className="w-full px-4 py-3 bg-black/20 border border-cyan-500/30 rounded-lg text-white focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors"
                  required
                >
                  <option value="">Selecione um cliente</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.stripeCustomerId}>
                      {customer.name} - {customer.email}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Valor (R$) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={newPayment.amountInCents / 100}
                  onChange={(e) => setNewPayment({...newPayment, amountInCents: Math.round(parseFloat(e.target.value) * 100)})}
                  className="w-full px-4 py-3 bg-black/20 border border-cyan-500/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors"
                  placeholder="0.00"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Descrição
                </label>
                <input
                  type="text"
                  value={newPayment.description}
                  onChange={(e) => setNewPayment({...newPayment, description: e.target.value})}
                  className="w-full px-4 py-3 bg-black/20 border border-cyan-500/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors"
                  placeholder="Descrição do pagamento"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Conta de Destino (Opcional)
                </label>
                <input
                  type="text"
                  value={newPayment.destinationAccountId}
                  onChange={(e) => setNewPayment({...newPayment, destinationAccountId: e.target.value})}
                  className="w-full px-4 py-3 bg-black/20 border border-cyan-500/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors"
                  placeholder="acct_xxxxxxxxxx"
                />
              </div>

              <div className="flex space-x-4 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-3 px-4 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 cyber-button py-3"
                >
                  Criar Pagamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payment Details Modal */}
      {selectedPayment && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-panel p-8 max-w-md w-full">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">Detalhes do Pagamento</h2>
              <button
                onClick={() => setSelectedPayment(null)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Status:</span>
                <div className="flex items-center space-x-2">
                  {getStatusIcon(selectedPayment.status)}
                  <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(selectedPayment.status)}`}>
                    {getStatusText(selectedPayment.status)}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-gray-400">ID do Pagamento:</span>
                <span className="text-white font-mono text-sm">{selectedPayment.stripePaymentIntentId}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-gray-400">Valor Bruto:</span>
                <span className="text-white font-bold">{formatCurrency(selectedPayment.grossAmount)}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-gray-400">Taxa:</span>
                <span className="text-white">{formatCurrency(selectedPayment.feeAmount)}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-gray-400">Valor Líquido:</span>
                <span className="text-green-400 font-bold">
                  {formatCurrency(selectedPayment.grossAmount - selectedPayment.feeAmount)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-gray-400">Moeda:</span>
                <span className="text-white uppercase">{selectedPayment.currency}</span>
              </div>

              {selectedPayment.description && (
                <div>
                  <span className="text-gray-400 block mb-1">Descrição:</span>
                  <span className="text-white">{selectedPayment.description}</span>
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-gray-400">Data de Criação:</span>
                <span className="text-white">{formatDate(selectedPayment.createdAt)}</span>
              </div>
            </div>

            <button
              onClick={() => setSelectedPayment(null)}
              className="w-full mt-6 cyber-button py-3"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPayments;