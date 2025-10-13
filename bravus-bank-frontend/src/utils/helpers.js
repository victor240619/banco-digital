export const formatCurrency = (amount) => {
  if (amount === null || amount === undefined) return 'R$ 0,00';
  const value = amount / 100;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

export const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

export const formatAccountNumber = (accountNumber) => {
  if (!accountNumber) return '';
  return accountNumber.replace(/(\d{4})(\d{4})(\d{2})/, '$1-$2-$3');
};

export const getTransactionTypeLabel = (type) => {
  const labels = {
    DEPOSIT: 'Depósito',
    WITHDRAWAL: 'Saque',
    TRANSFER_OUT: 'Transferência Enviada',
    TRANSFER_IN: 'Transferência Recebida',
    PAYMENT: 'Pagamento',
  };
  return labels[type] || type;
};

export const getTransactionColor = (type) => {
  const colors = {
    DEPOSIT: 'success',
    TRANSFER_IN: 'success',
    WITHDRAWAL: 'danger',
    TRANSFER_OUT: 'danger',
    PAYMENT: 'warning',
  };
  return colors[type] || 'secondary';
};
