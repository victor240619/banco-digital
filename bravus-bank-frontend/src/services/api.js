import axios from 'axios';
import {
  BRAVUS_PRODUCTION_API_URL,
  MOBILE_APP_API_URL,
  getAppClientChannel,
  getAppClientHeader,
  isMobileApp,
} from '../lib/appChannel';

const resolveApiUrl = () => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  if (typeof window === 'undefined') return 'http://localhost:9000/api';
  if (isMobileApp()) return MOBILE_APP_API_URL;

  const { hostname } = window.location;
  if (hostname === '127.0.0.1') return 'http://127.0.0.1:9000/api';
  if (hostname === 'localhost') return 'http://localhost:9000/api';

  return BRAVUS_PRODUCTION_API_URL;
};

const API_URL = resolveApiUrl();

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 20000,
});

// Endpoints públicos — não devem receber Authorization (token velho gera 403)
const PUBLIC_PATHS = ['/auth/login', '/auth/register', '/auth/password-reset', '/auth/initial-password'];

// ====== Interceptors ======
api.interceptors.request.use(
  (config) => {
    const url = (config.url || '').replace(/^\/+/, '/');
    const isPublic = PUBLIC_PATHS.some((p) => url.startsWith(p));
    const appHeader = getAppClientHeader();
    if (appHeader) config.headers['X-Bravus-Client'] = appHeader;
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

    // Somente 401 encerra a sessao. Um 403 pertence ao modulo/acao negada
    // e nao pode expulsar o usuario das demais funcoes autorizadas.
    if (status === 401 && !isPublic) {
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
    const { data } = await api.post('/auth/login', {
      username,
      password,
      clientChannel: getAppClientChannel(),
    });
    if (data.token) {
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data));
    }
    return data;
  },
  completeInitialPassword: async (initialPasswordChangeToken, newPassword) => {
    const { data } = await api.post('/auth/initial-password/complete', {
      initialPasswordChangeToken,
      newPassword,
      clientChannel: getAppClientChannel(),
    });
    if (!data?.token) throw new Error('Troca concluida sem sessao valida. Entre novamente.');
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data));
    return data;
  },
  checkRegistration: async (registrationData) => {
    const { data } = await api.post('/auth/register/availability', {
      ...registrationData,
      clientChannel: getAppClientChannel(),
    });
    return data;
  },
  verifyRegistrationFace: async (registrationData) => {
    const { data } = await api.post('/auth/register/face-check', {
      ...registrationData,
      clientChannel: getAppClientChannel(),
    });
    return data;
  },
  register: async (userData) => {
    const appHeader = getAppClientHeader();
    const { data } = await api.post(
      '/auth/register',
      {
        ...userData,
        clientChannel: getAppClientChannel(),
      },
      appHeader
        ? { headers: { 'X-Bravus-Client': appHeader } }
        : undefined
    );
    if (!data?.token) throw new Error('Cadastro concluido sem sessao valida. Entre novamente.');
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data));
    return data;
  },
  logout: async () => {
    let serverRevoked = !localStorage.getItem('token');
    try {
      if (!serverRevoked) {
        await api.post('/auth/logout');
        serverRevoked = true;
      }
    } catch {
      serverRevoked = false;
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
    return { serverRevoked };
  },
  getCurrentUser: () => {
    try { return JSON.parse(localStorage.getItem('user') || 'null'); }
    catch { return null; }
  },
  updateCurrentUser: (patch) => {
    const current = authService.getCurrentUser();
    if (!current) return null;
    const updated = { ...current, ...patch };
    localStorage.setItem('user', JSON.stringify(updated));
    return updated;
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
  verifyIdentityFace: (faceImage) => api.post('/user/kyc/face-check', {
    faceImage,
    biometricChallenge: 'FACE_CAMERA_CAPTURE_V1',
  }),
  submitIdentityEvidence: (evidence, idempotencyKey) => api.post('/user/kyc/enroll', {
    ...evidence,
    biometricChallenge: 'FACE_CAMERA_CAPTURE_V1',
  }, { headers: { 'Idempotency-Key': idempotencyKey } }),
  getCreditSummary: () => api.get('/credit/summary'),
  getExternalTransfers: (limit = 20) => api.get(`/user/external-transfers?limit=${limit}`),
  getExternalTransferReceipt: (orderId) => api.get(`/user/external-transfers/${orderId}/receipt`),
  resolveTransferDestination: (destination) =>
    api.get(`/user/transfer/resolve?destination=${encodeURIComponent(destination)}`),
  deposit: (amount, description) =>
    api.post('/user/deposit', { type: 'DEPOSIT', amount, description }),
  withdraw: (amount, description) =>
    api.post('/user/withdraw', { type: 'WITHDRAWAL', amount, description }),
  transfer: (amount, destinationAccount, description, idempotencyKey) =>
    api.post('/user/transfer', {
      type: 'TRANSFER_OUT', amount, destinationAccount, description,
    }, {
      headers: { 'Idempotency-Key': idempotencyKey },
    }),
  externalTransfer: (payload, idempotencyKey) => api.post('/user/external-transfers', payload, {
    headers: { 'Idempotency-Key': idempotencyKey },
  }),
};

export const passwordResetService = {
  start: (payload) => api.post('/auth/password-reset/start', payload),
  submitFace: (payload) => api.post('/auth/password-reset/face', payload),
  status: (payload) => api.post('/auth/password-reset/status', payload),
  complete: (payload) => api.post('/auth/password-reset/complete', payload),
};

// ====== Admin ======
export const adminService = {
  getDashboard: () => api.get('/admin/dashboard'),
  getAllUsers: () => api.get('/admin/users'),
  provisionAccount: (payload, idempotencyKey) => api.post('/admin/accounts/provision', payload, {
    headers: { 'Idempotency-Key': idempotencyKey },
  }),
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
  issueCredit: (payload) => api.post('/admin/ledger/credit/issue', payload),
  releaseCredit: (grantId) => api.post(`/admin/ledger/credit/${grantId}/release`),
};

export const passwordResetAdminService = {
  pending: () => api.get('/admin/password-reset/requests'),
  evidence: (requestId) => api.get(`/admin/password-reset/requests/${requestId}/evidence`),
  approve: (requestId, reason) => api.post(`/admin/password-reset/requests/${requestId}/approve`, { reason }),
  reject: (requestId, reason) => api.post(`/admin/password-reset/requests/${requestId}/reject`, { reason }),
};

export const kycAdminService = {
  pending: () => api.get('/admin/kyc/pending'),
  evidence: (username) => api.get(`/admin/kyc/${encodeURIComponent(username)}/evidence`),
  approve: (username, reason) => api.post(`/admin/kyc/${encodeURIComponent(username)}/approve`, { reason }),
  reject: (username, reason) => api.post(`/admin/kyc/${encodeURIComponent(username)}/reject`, { reason }),
};

export const analysisService = {
  analyzeDocument: (payload) => api.post('/admin/analysis/document', payload),
  recentDocuments: (limit = 20) => api.get(`/admin/analysis/document?limit=${limit}`),
};

export const externalTransferService = {
  submit: (payload, idempotencyKey) => api.post('/admin/ledger/external-transfers', payload, {
    headers: { 'Idempotency-Key': idempotencyKey },
  }),
  recent: (limit = 20) => api.get(`/admin/ledger/external-transfers?limit=${limit}`),
};

export const globalRailService = {
  participants: () => api.get('/admin/global-rail/participants'),
  createParticipant: (payload) => api.post('/admin/global-rail/participants', payload),
  confirmTransfer: (orderId, payload) => api.post(`/admin/global-rail/transfers/${orderId}/confirm`, payload),
};

export const caymanRailService = {
  config: () => api.get('/admin/cayman-rail/config'),
  updateConfig: (payload) => api.put('/admin/cayman-rail/config', payload),
  readiness: () => api.get('/admin/cayman-rail/readiness'),
  participants: () => api.get('/admin/cayman-rail/participants'),
  createParticipant: (payload) => api.post('/admin/cayman-rail/participants', payload),
  instructions: (limit = 20) => api.get(`/admin/cayman-rail/instructions?limit=${limit}`),
  submitInstruction: (payload) => api.post('/admin/cayman-rail/instructions', payload),
};

export const unifiedSearchService = {
  search: (payload) => api.post('/admin/search/unified', payload),
};

export default api;
