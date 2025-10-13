export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value / 100);
};

export const formatDate = (date: string): string => {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
};

export const formatDocument = (document: string, type: 'CPF' | 'CNPJ'): string => {
  if (type === 'CPF') {
    return document.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  } else {
    return document.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }
};

export const formatPhone = (phone: string): string => {
  return phone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
};

export const maskCurrency = (value: string): string => {
  const numericValue = value.replace(/\D/g, '');
  const formattedValue = (parseInt(numericValue) / 100).toFixed(2);
  return formattedValue.replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

export const parseCurrency = (value: string): number => {
  const numericValue = value.replace(/[^\d,]/g, '').replace(',', '.');
  return Math.round(parseFloat(numericValue) * 100);
};

export const cn = (...classes: (string | undefined | null | false)[]): string => {
  return classes.filter(Boolean).join(' ');
};