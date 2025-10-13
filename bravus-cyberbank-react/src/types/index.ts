export interface User {
  id: string;
  name: string;
  email: string;
  type: 'PF' | 'PJ';
  document?: string;
  phone?: string;
  balance?: number;
  isAdmin?: boolean;
}

export interface Customer {
  id: string;
  stripeCustomerId: string;
  name: string;
  email: string;
  type: 'PF' | 'PJ';
  document?: string;
  phone?: string;
  createdAt: string;
}

export interface Payment {
  id: string;
  stripePaymentIntentId: string;
  customerId?: string;
  grossAmount: number;
  feeAmount: number;
  currency: string;
  description?: string;
  status: string;
  createdAt: string;
}

export interface Transfer {
  id: string;
  stripeTransferId: string;
  destinationAccountId: string;
  grossAmount: number;
  feeAmount: number;
  netAmount: number;
  currency: string;
  description?: string;
  createdAt: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  type: 'PF' | 'PJ';
  document?: string;
  phone?: string;
}

export interface CreateCustomerRequest {
  name: string;
  email: string;
  type: 'PF' | 'PJ';
  document?: string;
  phone?: string;
}

export interface CreatePaymentRequest {
  customerId: string;
  amountInCents: number;
  description?: string;
  destinationAccountId?: string;
}

export interface CreateTransferRequest {
  destinationAccountId: string;
  amountInCents: number;
  description?: string;
}

export interface DashboardStats {
  totalCustomers: number;
  totalPayments: number;
  totalTransfers: number;
  totalRevenue: number;
  monthlyGrowth: number;
}