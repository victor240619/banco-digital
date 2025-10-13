import React, { useState, useEffect } from 'react';
import { 
  ArrowRightLeft, 
  Plus, 
  Search, 
  Eye, 
  CheckCircle,
  DollarSign,
  TrendingUp
} from 'lucide-react';
import { Transfer, CreateTransferRequest } from '../../types';
import { transferAPI } from '../../services/api';
import { formatCurrency, formatDate } from '../../utils/format';
import toast from 'react-hot-toast';

const AdminTransfers: React.FC = () => {
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState<Transfer | null>(null);

  const [newTransfer, setNewTransfer] = useState<CreateTransferRequest>({
    destinationAccountId: '',
    amountInCents: 0,
    description: ''
  });

  useEffect(() => {
    loadTransfers();
  }, []);

  const loadTransfers = async () => {
    try {
      const data = await transferAPI.getAll();
      setTransfers(data);
    } catch (error) {
      toast.error('Erro ao carregar transferências');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const transfer = await transferAPI.create(newTransfer);
      setTransfers([transfer, ...transfers]);
      setShowCreateModal(false);
      setNewTransfer({
        destinationAccountId: '',
        amountInCents: 0,
        description: ''
      });
      toast.success('Transferência criada com sucesso!');
    } catch (error) {
      toast.error('Erro ao criar transferência');
    }
  };

  const filteredTransfers = transfers.filter(transfer => {
    const matchesSearch = transfer.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         transfer.stripeTransferId.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         transfer.destinationAccountId.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const totalTransferredAmount = transfers.reduce((sum, t) => sum + t.grossAmount, 0);
  const totalFees = transfers.reduce((sum, t) => sum + t.feeAmount, 0);
  const totalNetAmount = transfers.reduce((sum, t) => sum + t.netAmount, 0);

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
            Gerenciar Transferências
          </h1>
          <p className="text-cyan-400 mt-2">
            {transfers.length} transferências processadas
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="cyber-button flex items-center space-x-2 px-6 py-3"
        >
          <Plus className="w-5 h-5" />
          <span>Nova Transferência</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { 
            title: 'Total de Transferências', 
            value: transfers.length.toString(),
            icon: ArrowRightLeft,
            color: 'from-blue-500 to-cyan-500'
          },
          { 
            title: 'Valor Bruto Total', 
            value: formatCurrency(totalTransferredAmount),
            icon: DollarSign,
            color: 'from-green-500 to-emerald-500'
          },
          { 
            title: 'Total de Taxas', 
            value: formatCurrency(totalFees),
            icon: TrendingUp,
            color: 'from-orange-500 to-red-500'
          },
          { 
            title: 'Valor Líquido Total', 
            value: formatCurrency(totalNetAmount),
            icon: CheckCircle,
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar por descrição, ID ou conta de destino..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-black/20 border border-cyan-500/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors"
            />
          </div>

          <div className="flex items-center justify-end">
            <span className="text-gray-400 text-sm">
              {filteredTransfers.length} de {transfers.length} transferências
            </span>
          </div>
        </div>
      </div>

      {/* Transfers Table */}
      <div className="glass-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-black/20 border-b border-cyan-500/20">
              <tr>
                <th className="text-left p-4 text-cyan-400 font-medium">ID / Destino</th>
                <th className="text-left p-4 text-cyan-400 font-medium">Valor Bruto</th>
                <th className="text-left p-4 text-cyan-400 font-medium">Taxa</th>
                <th className="text-left p-4 text-cyan-400 font-medium">Valor Líquido</th>
                <th className="text-left p-4 text-cyan-400 font-medium">Descrição</th>
                <th className="text-left p-4 text-cyan-400 font-medium">Data</th>
                <th className="text-left p-4 text-cyan-400 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransfers.map((transfer) => (
                <tr key={transfer.id} className="border-b border-gray-700/50 hover:bg-white/5 transition-colors">
                  <td className="p-4">
                    <div>
                      <p className="text-white font-medium font-mono text-sm">
                        {transfer.stripeTransferId}
                      </p>
                      <p className="text-gray-400 text-xs font-mono">
                        → {transfer.destinationAccountId}
                      </p>
                    </div>
                  </td>
                  <td className="p-4">
                    <p className="text-white font-bold">
                      {formatCurrency(transfer.grossAmount)}
                    </p>
                  </td>
                  <td className="p-4">
                    <p className="text-red-400 font-medium">
                      -{formatCurrency(transfer.feeAmount)}
                    </p>
                  </td>
                  <td className="p-4">
                    <p className="text-green-400 font-bold">
                      {formatCurrency(transfer.netAmount)}
                    </p>
                  </td>
                  <td className="p-4">
                    <p className="text-gray-300 text-sm">
                      {transfer.description || 'Sem descrição'}
                    </p>
                  </td>
                  <td className="p-4 text-gray-300">
                    {formatDate(transfer.createdAt)}
                  </td>
                  <td className="p-4">
                    <button
                      onClick={() => setSelectedTransfer(transfer)}
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

        {filteredTransfers.length === 0 && (
          <div className="text-center py-12">
            <ArrowRightLeft className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">Nenhuma transferência encontrada</p>
          </div>
        )}
      </div>

      {/* Create Transfer Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-panel p-8 max-w-md w-full">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">Nova Transferência</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCreateTransfer} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Conta de Destino *
                </label>
                <input
                  type="text"
                  value={newTransfer.destinationAccountId}
                  onChange={(e) => setNewTransfer({...newTransfer, destinationAccountId: e.target.value})}
                  className="w-full px-4 py-3 bg-black/20 border border-cyan-500/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors"
                  placeholder="acct_xxxxxxxxxx"
                  required
                />
                <p className="text-gray-400 text-xs mt-1">
                  ID da conta Stripe de destino
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Valor (R$) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={newTransfer.amountInCents / 100}
                  onChange={(e) => setNewTransfer({...newTransfer, amountInCents: Math.round(parseFloat(e.target.value) * 100)})}
                  className="w-full px-4 py-3 bg-black/20 border border-cyan-500/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors"
                  placeholder="0.00"
                  required
                />
                <p className="text-gray-400 text-xs mt-1">
                  Valor bruto (taxas serão deduzidas automaticamente)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Descrição
                </label>
                <textarea
                  value={newTransfer.description}
                  onChange={(e) => setNewTransfer({...newTransfer, description: e.target.value})}
                  className="w-full px-4 py-3 bg-black/20 border border-cyan-500/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors resize-none"
                  placeholder="Descrição da transferência"
                  rows={3}
                />
              </div>

              {/* Preview */}
              {newTransfer.amountInCents > 0 && (
                <div className="bg-black/20 rounded-lg p-4 space-y-2">
                  <h4 className="text-white font-medium">Resumo da Transferência:</h4>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Valor Bruto:</span>
                    <span className="text-white">{formatCurrency(newTransfer.amountInCents)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Taxa (10%):</span>
                    <span className="text-red-400">-{formatCurrency(Math.round(newTransfer.amountInCents * 0.1))}</span>
                  </div>
                  <div className="flex justify-between text-sm border-t border-gray-600 pt-2">
                    <span className="text-gray-400 font-medium">Valor Líquido:</span>
                    <span className="text-green-400 font-bold">
                      {formatCurrency(newTransfer.amountInCents - Math.round(newTransfer.amountInCents * 0.1))}
                    </span>
                  </div>
                </div>
              )}

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
                  Criar Transferência
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transfer Details Modal */}
      {selectedTransfer && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-panel p-8 max-w-md w-full">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">Detalhes da Transferência</h2>
              <button
                onClick={() => setSelectedTransfer(null)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">ID da Transferência:</span>
                <span className="text-white font-mono text-sm">{selectedTransfer.stripeTransferId}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-gray-400">Conta de Destino:</span>
                <span className="text-white font-mono text-sm">{selectedTransfer.destinationAccountId}</span>
              </div>

              <div className="bg-black/20 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Valor Bruto:</span>
                  <span className="text-white font-bold">{formatCurrency(selectedTransfer.grossAmount)}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Taxa:</span>
                  <span className="text-red-400 font-medium">-{formatCurrency(selectedTransfer.feeAmount)}</span>
                </div>

                <div className="flex items-center justify-between border-t border-gray-600 pt-3">
                  <span className="text-gray-400 font-medium">Valor Líquido:</span>
                  <span className="text-green-400 font-bold text-lg">
                    {formatCurrency(selectedTransfer.netAmount)}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-gray-400">Moeda:</span>
                <span className="text-white uppercase">{selectedTransfer.currency}</span>
              </div>

              {selectedTransfer.description && (
                <div>
                  <span className="text-gray-400 block mb-1">Descrição:</span>
                  <div className="bg-black/20 rounded-lg p-3">
                    <span className="text-white">{selectedTransfer.description}</span>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-gray-400">Data de Criação:</span>
                <span className="text-white">{formatDate(selectedTransfer.createdAt)}</span>
              </div>
            </div>

            <button
              onClick={() => setSelectedTransfer(null)}
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

export default AdminTransfers;