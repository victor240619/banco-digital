import axios from 'axios';

// Prefer env-configured API base; default to local backend
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:9000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Handle 401 errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth Services
export const authService = {
  login: async (username, password) => {
    const response = await api.post('/auth/login', { username, password });
    if (response.data.token) {
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data));
    }
    return response.data;
  },
  
  register: async (userData) => {
    const response = await api.post('/auth/register', userData);
    if (response.data.token) {
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data));
    }
    return response.data;
  },
  
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },
  
  getCurrentUser: () => {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  },
  
  isAuthenticated: () => {
    return !!localStorage.getItem('token');
  },
  
  hasRole: (role) => {
    const user = authService.getCurrentUser();
    return user && user.roles && user.roles.includes(role);
  }
};

// User Services
export const userService = {
  getProfile: () => api.get('/user/profile'),
  getBalance: () => api.get('/user/balance'),
  getTransactions: () => api.get('/user/transactions'),
  
  deposit: (amount, description) => 
    api.post('/user/deposit', { type: 'DEPOSIT', amount, description }),
  
  withdraw: (amount, description) => 
    api.post('/user/withdraw', { type: 'WITHDRAWAL', amount, description }),
  
  transfer: (amount, destinationAccount, description) => 
    api.post('/user/transfer', { 
      type: 'TRANSFER_OUT', 
      amount, 
      destinationAccount, 
      description 
    }),
};

// Admin Services
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
