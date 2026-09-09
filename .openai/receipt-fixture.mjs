// Synthetic data for isolated tests. Never seed a live account with this fixture.
export const receiptFixture = {
  receiptId: 'DEMO-000001', transactionId: 'TX-DEMO-001',
  receiptKind: 'COMPROVANTE_LIQUIDACAO_CONFIRMADA',
  amountCentavos: 125000, currency: 'BRL', channel: 'INTERNAL_BRAVUS',
  status: 'COMPLETED', settlementStatus: 'LIQUIDADA_CONFIRMADA',
  createdAt: '2026-09-05T17:32:00Z', description: 'Transferência de demonstração',
  payer: { name: 'Cliente Exemplo', document: '00000000000', bankName: 'Vantyx Bank', accountNumber: '00007310' },
  beneficiary: { name: 'Ana Exemplo', document: '00000000000', bankName: 'Vantyx Bank', accountNumber: '00004821' },
};
