// Presentation only: never changes the original transaction or its settlement.
export const RECEIPT_LOGO = '/brand/vantyx-bank-horizontal.png';
export const RECEIPT_COLORS = { navy: '#030d25', blue: '#0066ff', ink: '#08132c', muted: '#647087', border: '#dce2eb' };

const clean = (value) => String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
const brand = (value) => clean(value).replace(/Bravus(?: Premium)? Bank/gi, 'Vantyx Bank');
const upper = (value) => clean(value).toUpperCase();

export function formatReceiptAmount(amount, currency = 'BRL') {
  const raw = String(amount ?? '');
  if (!/^\d+$/.test(raw) || (typeof amount === 'number' && !Number.isSafeInteger(amount))) {
    throw new Error('O valor do comprovante é inválido.');
  }
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error('Moeda do comprovante inválida.');
  const decimals = new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits;
  const minor = BigInt(raw);
  const scale = 10n ** BigInt(decimals);
  const whole = minor / scale;
  const fraction = (minor % scale).toString().padStart(decimals, '0');
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).formatToParts(whole)
    .map((part) => part.type === 'fraction' ? fraction : part.value).join('');
}

const dateLabel = (raw) => {
  if (!raw || Number.isNaN(Date.parse(raw))) return 'Data não informada';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(raw));
};

export function receiptState(receipt) {
  const status = upper(receipt.status);
  const settlement = upper(receipt.settlementStatus);
  const internal = ['INTERNAL_BRAVUS', 'INTERNAL_VANTYX'].includes(upper(receipt.channel));
  if (/SIMUL|TEST|DEMO/.test(status + ' ' + settlement + ' ' + upper(receipt.receiptKind))) {
    return { kind: 'info', title: 'Registro de simulação', label: 'Simulação - sem movimentação real', note: 'Simulação. Este documento não comprova pagamento.' };
  }
  if (/REVERSED|REFUNDED|ESTORNAD/.test(status + ' ' + settlement)) {
    return { kind: 'info', title: 'Registro de transferência', label: 'Transferência estornada', note: 'Este registro informa uma operação estornada, não um pagamento vigente.' };
  }
  if (/FAILED|REJECTED|CANCELLED|CANCELED|FALH|REJEIT|CANCEL/.test(status + ' ' + settlement)) {
    return { kind: 'error', title: 'Registro de transferência', label: 'Transferência não concluída', note: 'Este registro não comprova crédito ao destinatário.' };
  }
  if (internal && status === 'COMPLETED' && ['LIQUIDADA_CONFIRMADA', 'SETTLED', 'COMPLETED'].includes(settlement)) {
    return { kind: 'success', title: 'Comprovante de transferência', label: 'Transferência interna', note: 'Registro interno Vantyx. Não comprova liquidação em instituição externa.' };
  }
  if (!internal && status === 'COMPLETED' && ['LIQUIDADA_CONFIRMADA', 'SETTLED'].includes(settlement)
    && receipt.destinationConfirmationId && receipt.destinationConfirmedAt
    && receipt.provider && !/INTERNAL|SIMUL|TEST|MANUAL/i.test(receipt.provider)) {
    return { kind: 'success', title: 'Comprovante de transferência', label: 'Transferência confirmada', note: 'Situação informada pelo serviço de transferência. Consulte os dados de confirmação abaixo.' };
  }
  return { kind: 'pending', title: 'Comprovante de solicitação', label: 'Confirmação de destino pendente', note: 'Solicitação registrada. Este documento não comprova recebimento pelo destinatário.' };
}

const partyModel = (party = {}, title) => {
  const doc = clean(party.document).replace(/\D/g, '');
  const account = clean(party.accountNumber);
  return {
    title,
    name: clean(party.name) || 'Não informado',
    documentLabel: doc.length === 14 ? 'CNPJ' : doc.length === 11 ? 'CPF' : 'Documento',
    document: !party.document ? 'Não informado' : doc.length === 14 ? '**.***.***/****-**' : '***.***.***-**',
    account: [brand(party.bankName) || clean(party.bankCode) || 'Instituição não informada', account ? `Conta •••• ${account.slice(-4)}` : 'Conta não informada'].join(' · '),
  };
};

export function buildReceiptModel(receipt) {
  if (!receipt || typeof receipt !== 'object') throw new Error('Comprovante indisponível.');
  const state = receiptState(receipt);
  const identifier = clean(receipt.receiptId || receipt.transactionId) || 'Não informado';
  const currency = upper(receipt.currency) || 'BRL';
  const details = [
    ['Transação', receipt.transactionId],
    ['Descrição', receipt.description],
    ['Situação registrada', receipt.status],
    ['Liquidação registrada', receipt.settlementStatus],
    ['Tipo de registro', receipt.receiptKind],
    ['Canal registrado', receipt.channel],
    ['Provedor', receipt.provider],
    ['Referência do provedor', receipt.providerTransferId],
    ['Rede de destino', receipt.destinationNetwork],
    ['Participante de destino', receipt.destinationParticipantCode],
    ['Confirmação no destino', receipt.destinationConfirmationId],
    ['Data da confirmação', receipt.destinationConfirmedAt ? dateLabel(receipt.destinationConfirmedAt) : null],
    ['Informação da operação', receipt.settlementMessage],
    ['Idempotência', receipt.idempotencyKey],
  ].filter(([, value]) => value !== null && value !== undefined && clean(value) !== '')
    .map(([label, value]) => [label, clean(value)]);
  return Object.freeze({
    ...state, identifier, currency, amount: formatReceiptAmount(receipt.amountCentavos, currency),
    date: dateLabel(receipt.createdAt),
    dateIso: Number.isNaN(Date.parse(receipt.createdAt)) ? null : new Date(receipt.createdAt).toISOString(),
    parties: [partyModel(receipt.beneficiary, 'DESTINATÁRIO'), partyModel(receipt.payer, 'REMETENTE')],
    details,
    filename: `comprovante-vantyx-${identifier.replace(/[^a-zA-Z0-9-]/g, '-').slice(0, 120).toLowerCase()}.pdf`,
  });
}
