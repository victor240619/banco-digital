import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:9000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 20000,
});

// Endpoints públicos — não devem receber Authorization (token velho gera 403)
const PUBLIC_PATHS = ['/auth/login', '/auth/register'];

// ====== Interceptors ======
api.interceptors.request.use(
  (config) => {
    const url = (config.url || '').replace(/^\/+/, '/');
    const isPublic = PUBLIC_PATHS.some((p) => url.startsWith(p));
    if (isPublic) {
      // garante que NUNCA enviamos token em endpoints públicos
      if (config.headers && config.headers.Authorization) delete config.headers.Authorization;
    } else {
      const token = localStorage.getItem('token');
      if (token) config.headers.Authorization = `Bearer ${token}`;
    }
    if (window.setGlobalLoading) window.setGlobalLoading(true);
    return config;
  },
  (error) => {
    if (window.setGlobalLoading) window.setGlobalLoading(false);
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => {
    if (window.setGlobalLoading) window.setGlobalLoading(false);
    return response;
  },
  (error) => {
    if (window.setGlobalLoading) window.setGlobalLoading(false);

    const status = error?.response?.status;
    const url = (error?.config?.url || '');
    const isPublic = PUBLIC_PATHS.some((p) => url.includes(p));

    // Token inválido em endpoint protegido: limpa e redireciona
    if ((status === 401 || status === 403) && !isPublic) {
      const onAuthPage = ['/login', '/register'].some((p) => window.location.pathname.startsWith(p));
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (!onAuthPage) window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ====== Auth ======
export const authService = {
  login: async (username, password) => {
    // garante que login parte sem token sujo no storage
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    const { data } = await api.post('/auth/login', { username, password });
    if (data.token) {
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data));
    }
    return data;
  },
  register: async (userData) => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    const { data } = await api.post('/auth/register', userData);
    if (data.token) {
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data));
    }
    return data;
  },
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },
  getCurrentUser: () => {
    try { return JSON.parse(localStorage.getItem('user') || 'null'); }
    catch { return null; }
  },
  isAuthenticated: () => !!localStorage.getItem('token'),
  hasRole: (role) => {
    const u = authService.getCurrentUser();
    return !!(u && u.roles && u.roles.includes(role));
  },
};

// ====== User ======
export const userService = {
  getProfile: () => api.get('/user/profile'),
  getMe: () => api.get('/user/me'),
  getBalance: () => api.get('/user/balance'),
  getTransactions: () => api.get('/user/transactions'),
  deposit: (amount, description) =>
    api.post('/user/deposit', { type: 'DEPOSIT', amount, description }),
  withdraw: (amount, description) =>
    api.post('/user/withdraw', { type: 'WITHDRAWAL', amount, description }),
  transfer: (amount, destinationAccount, description) =>
    api.post('/user/transfer', {
      type: 'TRANSFER_OUT', amount, destinationAccount, description,
    }),
};

// ====== Admin ======
export const adminService = {
  getDashboard: () => api.get('/admin/dashboard'),
  getAllUsers: () => api.get('/admin/users'),
  getUserById: (id) => api.get(`/admin/users/${id}`),
  activateUser: (id) => api.put(`/admin/users/${id}/activate`),
  deactivateUser: (id) => api.put(`/admin/users/${id}/deactivate`),
  deleteUser: (id) => api.delete(`/admin/users/${id}`),
  getAllTransactions: () => api.get('/admin/transactions'),
};

// ====== Ledger / Contabilidade (admin) ======
export const ledgerAdminService = {
  balanceSheet: () => api.get('/admin/ledger/balance-sheet'),
  validateChain: () => api.get('/admin/ledger/validate-chain'),
  entries: (page = 0, size = 50) =>
    api.get(`/admin/ledger/entries?page=${page}&size=${size}`),
  grantsByUser: (userId) => api.get(`/admin/ledger/credit/by-user/${userId}`),
  grantCredit: (payload) => api.post('/admin/ledger/credit/grant', payload),
};

export default api;
