export const formatCurrency = (amount) => {
  const value = Number(amount);
  if (!Number.isFinite(value)) return 'R$ 0,00';

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value / 100);
};

export const formatCurrencyExact = (amountInCents) => {
  const raw = String(amountInCents ?? '').trim();
  if (!/^-?\d+$/.test(raw)) return formatCurrency(amountInCents);

  const cents = BigInt(raw);
  const negative = cents < 0n;
  const absolute = negative ? -cents : cents;
  const whole = absolute / 100n;
  const fraction = String(absolute % 100n).padStart(2, '0');
  const grouped = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${negative ? '-' : ''}R$ ${grouped},${fraction}`;
};

export const formatDate = (dateString) => {
  if (!dateString) return '';

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '';

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
  return String(accountNumber).replace(/(\d{4})(\d{4})(\d{2})/, '$1-$2-$3');
};

export const getTransactionTypeLabel = (type) => {
  const labels = {
    DEPOSIT: 'Depósito',
    WITHDRAWAL: 'Saque',
    TRANSFER_OUT: 'Transferência enviada',
    TRANSFER_IN: 'Transferência recebida',
    TRANSFER_EXTERNAL: 'Transferência bancária externa',
    PAYMENT: 'Pagamento',
  };
  return labels[type] || type || 'Transação';
};

export const getTransactionColor = (type) => {
  const colors = {
    DEPOSIT: 'success',
    TRANSFER_IN: 'success',
    WITHDRAWAL: 'danger',
    TRANSFER_OUT: 'danger',
    TRANSFER_EXTERNAL: 'danger',
    PAYMENT: 'warning',
  };
  return colors[type] || 'secondary';
};
