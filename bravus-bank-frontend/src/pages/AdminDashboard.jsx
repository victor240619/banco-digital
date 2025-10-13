import React, { useState, useEffect } from 'react';
import { adminService } from '../services/api';
import { formatCurrency, formatDate } from '../utils/helpers';

function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [statsRes, usersRes, transactionsRes] = await Promise.all([
        adminService.getDashboard(),
        adminService.getAllUsers(),
        adminService.getAllTransactions(),
      ]);
      setStats(statsRes.data);
      setUsers(usersRes.data);
      setTransactions(transactionsRes.data);
    } catch (err) {
      setError('Erro ao carregar dados do painel admin');
    } finally {
      setLoading(false);
    }
  };

  const handleActivateUser = async (userId) => {
    try {
      await adminService.activateUser(userId);
      setSuccess('Usuário ativado com sucesso!');
      await loadData();
    } catch (err) {
      setError('Erro ao ativar usuário');
    }
  };

  const handleDeactivateUser = async (userId) => {
    try {
      await adminService.deactivateUser(userId);
      setSuccess('Usuário desativado com sucesso!');
      await loadData();
    } catch (err) {
      setError('Erro ao desativar usuário');
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Tem certeza que deseja excluir este usuário?')) {
      return;
    }

    try {
      await adminService.deleteUser(userId);
      setSuccess('Usuário excluído com sucesso!');
      await loadData();
    } catch (err) {
      setError('Erro ao excluir usuário');
    }
  };

  if (loading && !stats) {
    return (
      <div className="loading">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="container" style={{ marginTop: '30px' }}>
      <h1 style={{ color: 'var(--primary)', marginBottom: '10px', fontSize: '36px' }}>
        👑 Painel Administrativo
      </h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '30px' }}>
        Gestão completa do Bravus Bank
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

      {/* Stats */}
      <div className="grid grid-3" style={{ marginBottom: '30px' }}>
        <div className="stat-card">
          <div className="stat-label">👥 Total de Usuários</div>
          <div className="stat-value">{stats?.totalUsers || 0}</div>
        </div>
        
        <div className="stat-card">
          <div className="stat-label">✅ Usuários Ativos</div>
          <div className="stat-value">{stats?.activeUsers || 0}</div>
        </div>
        
        <div className="stat-card">
          <div className="stat-label">💰 Saldo Total</div>
          <div className="stat-value" style={{ fontSize: '24px' }}>{formatCurrency(stats?.totalBalance || 0)}</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '2px solid var(--border)', paddingBottom: '10px' }}>
        <button 
          className={`btn ${activeTab === 'dashboard' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('dashboard')}
        >
          📊 Dashboard
        </button>
        <button 
          className={`btn ${activeTab === 'users' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('users')}
        >
          👥 Usuários
        </button>
        <button 
          className={`btn ${activeTab === 'transactions' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('transactions')}
        >
          💳 Transações
        </button>
      </div>

      {/* Content */}
      {activeTab === 'dashboard' && (
        <div className="card">
          <h2 style={{ color: 'var(--primary)', marginBottom: '20px' }}>📈 Estatísticas do Sistema</h2>
          
          <div className="grid grid-2" style={{ marginBottom: '30px' }}>
            <div style={{ padding: '20px', background: 'var(--dark)', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <h3 style={{ color: 'var(--primary)', marginBottom: '15px', fontSize: '18px' }}>📊 Resumo Geral</h3>
              <p style={{ marginBottom: '10px', color: 'var(--text-secondary)' }}>
                Total de Transações: <strong style={{ color: 'var(--text)' }}>{stats?.totalTransactions || 0}</strong>
              </p>
              <p style={{ marginBottom: '10px', color: 'var(--text-secondary)' }}>
                Usuários Cadastrados: <strong style={{ color: 'var(--text)' }}>{stats?.totalUsers || 0}</strong>
              </p>
              <p style={{ marginBottom: '10px', color: 'var(--text-secondary)' }}>
                Taxa de Ativação: <strong style={{ color: 'var(--success)' }}>
                  {stats?.totalUsers > 0 ? Math.round((stats.activeUsers / stats.totalUsers) * 100) : 0}%
                </strong>
              </p>
            </div>

            <div style={{ padding: '20px', background: 'var(--dark)', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <h3 style={{ color: 'var(--primary)', marginBottom: '15px', fontSize: '18px' }}>💵 Financeiro</h3>
              <p style={{ marginBottom: '10px', color: 'var(--text-secondary)' }}>
                Saldo Total em Contas: <strong style={{ color: 'var(--success)' }}>{formatCurrency(stats?.totalBalance || 0)}</strong>
              </p>
              <p style={{ marginBottom: '10px', color: 'var(--text-secondary)' }}>
                Saldo Médio por Conta: <strong style={{ color: 'var(--text)' }}>
                  {stats?.activeUsers > 0 ? formatCurrency(Math.round(stats.totalBalance / stats.activeUsers)) : 'R$ 0,00'}
                </strong>
              </p>
            </div>
          </div>

          <h3 style={{ color: 'var(--primary)', marginBottom: '15px', fontSize: '18px' }}>🎯 Ações Rápidas</h3>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={() => setActiveTab('users')}>
              Gerenciar Usuários
            </button>
            <button className="btn btn-secondary" onClick={() => setActiveTab('transactions')}>
              Ver Todas Transações
            </button>
            <button className="btn btn-secondary" onClick={loadData}>
              🔄 Atualizar Dados
            </button>
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="card">
          <h2 style={{ color: 'var(--primary)', marginBottom: '20px' }}>👥 Gerenciamento de Usuários</h2>
          {users.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '40px' }}>
              Nenhum usuário encontrado
            </p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Usuário</th>
                    <th>Nome</th>
                    <th>Email</th>
                    <th>Conta</th>
                    <th>Saldo</th>
                    <th>Status</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td>{user.id}</td>
                      <td>{user.username}</td>
                      <td>{user.fullName}</td>
                      <td>{user.email}</td>
                      <td>{user.accountNumber}</td>
                      <td>{formatCurrency(user.balance)}</td>
                      <td>
                        <span className={`badge ${user.isActive ? 'badge-success' : 'badge-danger'}`}>
                          {user.isActive ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          {user.isActive ? (
                            <button 
                              className="btn btn-danger" 
                              style={{ padding: '6px 12px', fontSize: '12px' }}
                              onClick={() => handleDeactivateUser(user.id)}
                            >
                              Desativar
                            </button>
                          ) : (
                            <button 
                              className="btn btn-primary" 
                              style={{ padding: '6px 12px', fontSize: '12px' }}
                              onClick={() => handleActivateUser(user.id)}
                            >
                              Ativar
                            </button>
                          )}
                          <button 
                            className="btn btn-danger" 
                            style={{ padding: '6px 12px', fontSize: '12px' }}
                            onClick={() => handleDeleteUser(user.id)}
                          >
                            Excluir
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'transactions' && (
        <div className="card">
          <h2 style={{ color: 'var(--primary)', marginBottom: '20px' }}>💳 Todas as Transações</h2>
          {transactions.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '40px' }}>
              Nenhuma transação encontrada
            </p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Usuário</th>
                    <th>Tipo</th>
                    <th>Valor</th>
                    <th>Descrição</th>
                    <th>Status</th>
                    <th>Data</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((transaction) => (
                    <tr key={transaction.id}>
                      <td>{transaction.id}</td>
                      <td>{transaction.username}</td>
                      <td>{transaction.type}</td>
                      <td style={{ color: transaction.type.includes('IN') || transaction.type === 'DEPOSIT' ? 'var(--success)' : 'var(--danger)' }}>
                        {formatCurrency(transaction.amount)}
                      </td>
                      <td>{transaction.description || '-'}</td>
                      <td>
                        <span className="badge badge-success">
                          {transaction.status}
                        </span>
                      </td>
                      <td>{formatDate(transaction.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;
