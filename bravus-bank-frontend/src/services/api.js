import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:9000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 20000,
});

// ====== Interceptors ======
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
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

    if (error.response && error.response.status === 401) {
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
    const { data } = await api.post('/auth/login', { username, password });
    if (data.token) {
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data));
    }
    return data;
  },
  register: async (userData) => {
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

export default api;
