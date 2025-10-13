import React, { useState, useEffect } from 'react';
import { userService, authService } from '../services/api';
import { formatCurrency, formatDate, getTransactionTypeLabel, getTransactionColor } from '../utils/helpers';

function UserDashboard() {
  const [profile, setProfile] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [activeTab, setActiveTab] = useState('overview');
  const [transactionForm, setTransactionForm] = useState({
    amount: '',
    description: '',
    destinationAccount: '',
  });

  const user = authService.getCurrentUser();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [profileRes, transactionsRes] = await Promise.all([
        userService.getProfile(),
        userService.getTransactions(),
      ]);
      setProfile(profileRes.data);
      setTransactions(transactionsRes.data);
    } catch (err) {
      setError('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const handleDeposit = async () => {
    if (!transactionForm.amount || transactionForm.amount <= 0) {
      setError('Digite um valor válido');
      return;
    }

    try {
      setLoading(true);
      await userService.deposit(
        Math.round(parseFloat(transactionForm.amount) * 100),
        transactionForm.description
      );
      setSuccess('Depósito realizado com sucesso!');
      setTransactionForm({ amount: '', description: '', destinationAccount: '' });
      await loadData();
      setActiveTab('overview');
    } catch (err) {
      setError(err.response?.data || 'Erro ao realizar depósito');
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async () => {
    if (!transactionForm.amount || transactionForm.amount <= 0) {
      setError('Digite um valor válido');
      return;
    }

    try {
      setLoading(true);
      await userService.withdraw(
        Math.round(parseFloat(transactionForm.amount) * 100),
        transactionForm.description
      );
      setSuccess('Saque realizado com sucesso!');
      setTransactionForm({ amount: '', description: '', destinationAccount: '' });
      await loadData();
      setActiveTab('overview');
    } catch (err) {
      setError(err.response?.data || 'Erro ao realizar saque');
    } finally {
      setLoading(false);
    }
  };

  const handleTransfer = async () => {
    if (!transactionForm.amount || transactionForm.amount <= 0) {
      setError('Digite um valor válido');
      return;
    }
    if (!transactionForm.destinationAccount) {
      setError('Digite a conta de destino');
      return;
    }

    try {
      setLoading(true);
      await userService.transfer(
        Math.round(parseFloat(transactionForm.amount) * 100),
        transactionForm.destinationAccount,
        transactionForm.description
      );
      setSuccess('Transferência realizada com sucesso!');
      setTransactionForm({ amount: '', description: '', destinationAccount: '' });
      await loadData();
      setActiveTab('overview');
    } catch (err) {
      setError(err.response?.data || 'Erro ao realizar transferência');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !profile) {
    return (
      <div className="loading">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="container" style={{ marginTop: '30px' }}>
      <h1 style={{ color: 'var(--primary)', marginBottom: '10px', fontSize: '36px' }}>
        👋 Olá, {user?.fullName || user?.username}!
      </h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '30px' }}>
        Bem-vindo ao seu painel Bravus Bank
      </p>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: '20px' }}>
          {error}
          <button onClick={() => setError('')} style={{ float: 'right', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '20px' }}>×</button>
        </div>
      )}

      {success && (
        <div className="alert alert-success" style={{ marginBottom: '20px' }}>
          {success}
          <button onClick={() => setSuccess('')} style={{ float: 'right', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '20px' }}>×</button>
        </div>
      )}

      {/* Account Summary */}
      <div className="grid grid-3" style={{ marginBottom: '30px' }}>
        <div className="stat-card">
          <div className="stat-label">💰 Saldo Disponível</div>
          <div className="stat-value">{formatCurrency(profile?.balance || 0)}</div>
        </div>
        
        <div className="stat-card">
          <div className="stat-label">🏦 Número da Conta</div>
          <div className="stat-value" style={{ fontSize: '20px' }}>{profile?.accountNumber}</div>
        </div>
        
        <div className="stat-card">
          <div className="stat-label">📊 Tipo de Conta</div>
          <div className="stat-value" style={{ fontSize: '20px' }}>{profile?.accountType}</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '2px solid var(--border)', paddingBottom: '10px' }}>
        <button 
          className={`btn ${activeTab === 'overview' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('overview')}
        >
          📊 Visão Geral
        </button>
        <button 
          className={`btn ${activeTab === 'deposit' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('deposit')}
        >
          💵 Depósito
        </button>
        <button 
          className={`btn ${activeTab === 'withdraw' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('withdraw')}
        >
          🏧 Saque
        </button>
        <button 
          className={`btn ${activeTab === 'transfer' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('transfer')}
        >
          💸 Transferir
        </button>
      </div>

      {/* Content */}
      {activeTab === 'overview' && (
        <div className="card">
          <h2 style={{ color: 'var(--primary)', marginBottom: '20px' }}>📜 Histórico de Transações</h2>
          {transactions.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '40px' }}>
              Nenhuma transação encontrada
            </p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Tipo</th>
                    <th>Valor</th>
                    <th>Descrição</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((transaction) => (
                    <tr key={transaction.id}>
                      <td>{formatDate(transaction.createdAt)}</td>
                      <td>{getTransactionTypeLabel(transaction.type)}</td>
                      <td style={{ color: transaction.type.includes('IN') || transaction.type === 'DEPOSIT' ? 'var(--success)' : 'var(--danger)' }}>
                        {transaction.type.includes('IN') || transaction.type === 'DEPOSIT' ? '+' : '-'}{formatCurrency(transaction.amount)}
                      </td>
                      <td>{transaction.description || '-'}</td>
                      <td>
                        <span className={`badge badge-${getTransactionColor(transaction.status)}`}>
                          {transaction.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'deposit' && (
        <div className="card">
          <h2 style={{ color: 'var(--primary)', marginBottom: '20px' }}>💵 Fazer Depósito</h2>
          <div className="form-group">
            <label className="form-label">Valor (R$)</label>
            <input
              type="number"
              className="form-input"
              value={transactionForm.amount}
              onChange={(e) => setTransactionForm({ ...transactionForm, amount: e.target.value })}
              placeholder="0.00"
              step="0.01"
              min="0.01"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Descrição (Opcional)</label>
            <input
              type="text"
              className="form-input"
              value={transactionForm.description}
              onChange={(e) => setTransactionForm({ ...transactionForm, description: e.target.value })}
              placeholder="Ex: Salário"
            />
          </div>
          <button className="btn btn-primary" onClick={handleDeposit} disabled={loading}>
            {loading ? 'Processando...' : 'Confirmar Depósito'}
          </button>
        </div>
      )}

      {activeTab === 'withdraw' && (
        <div className="card">
          <h2 style={{ color: 'var(--primary)', marginBottom: '20px' }}>🏧 Fazer Saque</h2>
          <div className="form-group">
            <label className="form-label">Valor (R$)</label>
            <input
              type="number"
              className="form-input"
              value={transactionForm.amount}
              onChange={(e) => setTransactionForm({ ...transactionForm, amount: e.target.value })}
              placeholder="0.00"
              step="0.01"
              min="0.01"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Descrição (Opcional)</label>
            <input
              type="text"
              className="form-input"
              value={transactionForm.description}
              onChange={(e) => setTransactionForm({ ...transactionForm, description: e.target.value })}
              placeholder="Ex: Retirada"
            />
          </div>
          <button className="btn btn-primary" onClick={handleWithdraw} disabled={loading}>
            {loading ? 'Processando...' : 'Confirmar Saque'}
          </button>
        </div>
      )}

      {activeTab === 'transfer' && (
        <div className="card">
          <h2 style={{ color: 'var(--primary)', marginBottom: '20px' }}>💸 Fazer Transferência</h2>
          <div className="form-group">
            <label className="form-label">Conta de Destino</label>
            <input
              type="text"
              className="form-input"
              value={transactionForm.destinationAccount}
              onChange={(e) => setTransactionForm({ ...transactionForm, destinationAccount: e.target.value })}
              placeholder="0000000000"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Valor (R$)</label>
            <input
              type="number"
              className="form-input"
              value={transactionForm.amount}
              onChange={(e) => setTransactionForm({ ...transactionForm, amount: e.target.value })}
              placeholder="0.00"
              step="0.01"
              min="0.01"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Descrição (Opcional)</label>
            <input
              type="text"
              className="form-input"
              value={transactionForm.description}
              onChange={(e) => setTransactionForm({ ...transactionForm, description: e.target.value })}
              placeholder="Ex: Pagamento"
            />
          </div>
          <button className="btn btn-primary" onClick={handleTransfer} disabled={loading}>
            {loading ? 'Processando...' : 'Confirmar Transferência'}
          </button>
        </div>
      )}
    </div>
  );
}

export default UserDashboard;
