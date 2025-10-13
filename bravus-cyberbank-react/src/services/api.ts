import axios from 'axios';
import { 
  Customer, 
  Payment, 
  Transfer, 
  CreateCustomerRequest, 
  CreatePaymentRequest, 
  CreateTransferRequest,
  LoginCredentials,
  RegisterData,
  User
} from '../types';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para adicionar token de autenticação
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor para lidar com respostas de erro
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: async (credentials: LoginCredentials): Promise<{ token: string; user: User }> => {
    try {
      const response = await api.post('/auth/login', credentials);
      const { token, user } = response.data;
      
      // Converter balance de centavos para reais se necessário
      if (user.balance) {
        user.balance = user.balance / 100;
      }
      
      return { token, user };
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Erro ao fazer login');
    }
  },

  register: async (data: RegisterData): Promise<{ token: string; user: User }> => {
    try {
      const response = await api.post('/auth/register', data);
      const { token, user } = response.data;
      
      // Converter balance de centavos para reais se necessário
      if (user.balance) {
        user.balance = user.balance / 100;
      }
      
      return { token, user };
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Erro ao criar conta');
    }
  },

  logout: () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
  }
};

// Customer API
export const customerAPI = {
  create: async (data: CreateCustomerRequest): Promise<Customer> => {
    const response = await api.post('/customers', data);
    return response.data;
  },

  getAll: async (): Promise<Customer[]> => {
    // Simulação - em produção conectar com backend
    return [
      {
        id: '1',
        stripeCustomerId: 'cus_123',
        name: 'João Silva',
        email: 'joao@email.com',
        type: 'PF',
        document: '123.456.789-00',
        phone: '(11) 99999-9999',
        createdAt: '2024-01-15T10:00:00Z'
      },
      {
        id: '2',
        stripeCustomerId: 'cus_456',
        name: 'Maria Santos',
        email: 'maria@email.com',
        type: 'PF',
        document: '987.654.321-00',
        phone: '(11) 88888-8888',
        createdAt: '2024-01-16T14:30:00Z'
      }
    ];
  }
};

// Payment API
export const paymentAPI = {
  create: async (data: CreatePaymentRequest): Promise<Payment> => {
    const response = await api.post('/payments', data);
    return response.data;
  },

  getAll: async (): Promise<Payment[]> => {
    // Simulação - em produção conectar com backend
    return [
      {
        id: '1',
        stripePaymentIntentId: 'pi_123',
        customerId: '1',
        grossAmount: 10000,
        feeAmount: 1000,
        currency: 'brl',
        description: 'Pagamento teste',
        status: 'succeeded',
        createdAt: '2024-01-15T10:00:00Z'
      }
    ];
  }
};

// Transfer API
export const transferAPI = {
  create: async (data: CreateTransferRequest): Promise<Transfer> => {
    const response = await api.post('/transfers', data);
    return response.data;
  },

  getAll: async (): Promise<Transfer[]> => {
    // Simulação - em produção conectar com backend
    return [
      {
        id: '1',
        stripeTransferId: 'tr_123',
        destinationAccountId: 'acct_123',
        grossAmount: 10000,
        feeAmount: 1000,
        netAmount: 9000,
        currency: 'brl',
        description: 'Transferência teste',
        createdAt: '2024-01-15T10:00:00Z'
      }
    ];
  }
};

export default api;