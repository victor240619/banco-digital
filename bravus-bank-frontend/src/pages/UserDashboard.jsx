import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowDownToLine, ArrowUpFromLine, ArrowRightLeft, Wallet, Eye, EyeOff,
  TrendingUp, TrendingDown, Activity, Receipt, CheckCircle2, AlertCircle,
  Send, Landmark, CreditCard, Percent, Globe2,
  FileText, Barcode, CalendarDays, LineChart, UserCheck, UsersRound,
  ClipboardCheck, ShieldCheck, Smartphone, Building2, List, Grid3X3,
  Download, Share2, ArrowLeft, Menu, X, Home, User, KeyRound, LogOut,
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';
import { useLocation, useNavigate } from 'react-router-dom';
import { userService, authService } from '../services/api';
import BankIdentityCard from '../components/BankIdentityCard';
import {
  formatCurrency, formatDate, getTransactionTypeLabel,
} from '../utils/helpers';
import { cn } from '../lib/cn';
import { isMobileApp } from '../lib/appChannel';
import {
  saveNativeReceiptPdf,
  shareNativeReceiptPdf,
} from '../lib/nativeReceiptDocuments';

// ============ Helpers ============
const txIcon = (type) => {
  switch (type) {
    case 'DEPOSIT':
    case 'TRANSFER_IN':
      return { Icon: ArrowDownToLine, color: 'text-emerald-300', bg: 'bg-emerald-400/10' };
    case 'WITHDRAWAL':
    case 'TRANSFER_OUT':
    case 'TRANSFER_EXTERNAL':
      return { Icon: ArrowUpFromLine, color: 'text-red-300', bg: 'bg-red-400/10' };
    case 'PAYMENT':
      return { Icon: Receipt, color: 'text-amber-300', bg: 'bg-amber-400/10' };
    default:
      return { Icon: Activity, color: 'text-ink-300', bg: 'bg-white/5' };
  }
};

const txSignClass = (type) =>
  ['DEPOSIT', 'TRANSFER_IN'].includes(type) ? 'text-emerald-300' : 'text-red-300';
const txSign = (type) =>
  ['DEPOSIT', 'TRANSFER_IN'].includes(type) ? '+' : '-';

const createIdempotencyKey = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `bravus-${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
};

const EMPTY_FORM = {
  amount: '',
  description: '',
  destinationAccount: '',
  transferMode: 'internal',
  channel: 'ACH',
  beneficiaryName: '',
  beneficiaryDocument: '',
  bankCode: '',
  ispb: '',
  agency: '',
  accountNumber: '',
  accountDigit: '',
  accountType: 'CORRENTE',
  destinationNetwork: 'CAYMAN_ACH',
  pixKey: '',
  pixKeyType: 'CPF',
};

const TAB_ROUTES = {
  overview: '/dashboard',
  deposit: '/dashboard/deposit',
  withdraw: '/dashboard/withdraw',
  transfer: '/dashboard/transfer',
  statements: '/dashboard/extratos',
};

const MODULE_ROUTES = {
  balances: '/dashboard/extratos',
  payments: '/dashboard/pagamentos',
  transfers: '/dashboard/transferencias',
  receipts: '/dashboard/comprovantes',
  localCayman: '/dashboard/transferencia-cayman',
  internationalWire: '/dashboard/wire-internacional',
  remittance: '/dashboard/remessas-cambio',
  'deposit-check': '/dashboard/deposito-cheque',
  credit: '/dashboard/emprestimos-recebiveis',
  dda: '/dashboard/dda-boletos',
  cards: '/dashboard/cartoes',
  checks: '/dashboard/cheques',
  schedules: '/dashboard/agendamentos',
  investments: '/dashboard/investimentos',
  pending: '/dashboard/pendencias',
  beneficiaries: '/dashboard/favorecidos',
  limits: '/dashboard/limites',
  security: '/dashboard/seguranca',
};

const MODULE_ROUTE_STATE = {
  '/dashboard/extratos': { tab: 'statements', activeModule: 'balances' },
  '/dashboard/pagamentos': { tab: 'transfer', activeModule: 'localCayman', transferMode: 'external', channel: 'ACH', destinationNetwork: 'CAYMAN_ACH' },
  '/dashboard/transferencia-cayman': { tab: 'transfer', activeModule: 'localCayman', transferMode: 'external', channel: 'ACH', destinationNetwork: 'CAYMAN_ACH' },
  '/dashboard/transferencias': { tab: 'transfer', activeModule: 'transfers', transferMode: 'internal', channel: 'INTERNAL_BRAVUS', destinationNetwork: 'INTERNAL_BRAVUS' },
  '/dashboard/comprovantes': { tab: 'overview', activeModule: 'receipts' },
  '/dashboard/wire-internacional': { tab: 'transfer', activeModule: 'internationalWire', transferMode: 'external', channel: 'SWIFT', destinationNetwork: 'SWIFT' },
  '/dashboard/remessas-cambio': { tab: 'transfer', activeModule: 'remittance', transferMode: 'external', channel: 'MSB_REMITTANCE', destinationNetwork: 'CAYMAN_MSB' },
  '/dashboard/pix': { tab: 'transfer', activeModule: 'internationalWire', transferMode: 'external', channel: 'SWIFT', destinationNetwork: 'SWIFT' },
  '/dashboard/deposito-cheque': { tab: 'overview', activeModule: 'deposit-check' },
  '/dashboard/emprestimos-recebiveis': { tab: 'overview', activeModule: 'credit' },
  '/dashboard/dda-boletos': { tab: 'overview', activeModule: 'dda' },
  '/dashboard/cartoes': { tab: 'overview', activeModule: 'cards' },
  '/dashboard/cheques': { tab: 'overview', activeModule: 'checks' },
  '/dashboard/agendamentos': { tab: 'overview', activeModule: 'schedules' },
  '/dashboard/investimentos': { tab: 'overview', activeModule: 'investments' },
  '/dashboard/pendencias': { tab: 'overview', activeModule: 'pending' },
  '/dashboard/favorecidos': { tab: 'overview', activeModule: 'beneficiaries' },
  '/dashboard/limites': { tab: 'overview', activeModule: 'limits' },
  '/dashboard/seguranca': { tab: 'overview', activeModule: 'security' },
};

const DIRECT_ROUTE_META = {
  '/dashboard/deposit': { label: 'Depósito', Icon: ArrowDownToLine },
  '/dashboard/withdraw': { label: 'Saque', Icon: ArrowUpFromLine },
  '/dashboard/saque': { label: 'Saque', Icon: ArrowUpFromLine },
  '/dashboard/transfer': { label: 'Transferência', Icon: ArrowRightLeft },
  '/dashboard/perfil': { label: 'Perfil', Icon: User },
  '/dashboard/trocar-senha': { label: 'Trocar senha', Icon: KeyRound },
};

const ACCOUNT_MENU_ITEMS = [
  { label: 'Visão geral', route: '/dashboard', Icon: Home },
  { label: 'Perfil', route: '/dashboard/perfil', Icon: User },
  { label: 'Saldos e extratos', route: '/dashboard/extratos', Icon: FileText },
  { label: 'Transferências', route: '/dashboard/transferencias', Icon: ArrowRightLeft },
  { label: 'Wire internacional', route: '/dashboard/wire-internacional', Icon: Send },
  { label: 'Segurança', route: '/dashboard/seguranca', Icon: ShieldCheck },
  { label: 'Trocar senha', route: '/dashboard/trocar-senha', Icon: KeyRound },
];

const routeStateForPath = (pathname) => {
  const path = pathname.replace(/\/+$/, '') || '/dashboard';
  const states = {
    '/dashboard': { tab: 'overview', activeModule: 'balances' },
    '/dashboard/deposit': { tab: 'deposit', activeModule: 'deposit-check' },
    '/dashboard/withdraw': { tab: 'withdraw', activeModule: 'balances' },
    '/dashboard/saque': { tab: 'withdraw', activeModule: 'balances' },
    '/dashboard/transfer': { tab: 'transfer', activeModule: 'transfers', transferMode: 'internal', channel: 'INTERNAL_BRAVUS' },
    '/dashboard/transferencias': MODULE_ROUTE_STATE['/dashboard/transferencias'],
    '/dashboard/pagamentos': MODULE_ROUTE_STATE['/dashboard/pagamentos'],
    '/dashboard/pix': MODULE_ROUTE_STATE['/dashboard/pix'],
    '/dashboard/extratos': MODULE_ROUTE_STATE['/dashboard/extratos'],
    '/dashboard/comprovantes': MODULE_ROUTE_STATE['/dashboard/comprovantes'],
    '/dashboard/credito': { tab: 'overview', activeModule: 'credit' },
    '/dashboard/dda': { tab: 'overview', activeModule: 'dda' },
    ...MODULE_ROUTE_STATE,
    '/dashboard/cartoes': { tab: 'overview', activeModule: 'cards' },
    '/dashboard/cheques': { tab: 'overview', activeModule: 'checks' },
    '/dashboard/agendamentos': { tab: 'overview', activeModule: 'schedules' },
    '/dashboard/investimentos': { tab: 'overview', activeModule: 'investments' },
    '/dashboard/pendencias': { tab: 'overview', activeModule: 'pending' },
    '/dashboard/favorecidos': { tab: 'overview', activeModule: 'beneficiaries' },
    '/dashboard/limites': { tab: 'overview', activeModule: 'limits' },
    '/dashboard/seguranca': { tab: 'overview', activeModule: 'security' },
    '/dashboard/perfil': { tab: 'profile', activeModule: 'profile' },
    '/dashboard/trocar-senha': { tab: 'change-password', activeModule: 'change-password' },
  };
  return states[path] || states['/dashboard'];
};

const destinationNetworkForChannel = (channel) => ({
  ACH: 'CAYMAN_ACH',
  EFT: 'CAYMAN_EFT',
  SWIFT: 'SWIFT',
  WIRE: 'SWIFT',
  MSB_REMITTANCE: 'CAYMAN_MSB',
  MSB_FX: 'CAYMAN_MSB',
  CAYMAN_RAIL: 'CAYMAN_RAIL',
  INTERNAL_BRAVUS: 'INTERNAL_BRAVUS',
}[channel] || 'CAYMAN_RAIL');

const displayTransferChannel = (channel) => ({
  ACH: 'ACH Cayman',
  EFT: 'EFT Cayman',
  SWIFT: 'Wire / SWIFT',
  WIRE: 'Wire / SWIFT',
  MSB_REMITTANCE: 'Remessa internacional',
  MSB_FX: 'Câmbio',
  CAYMAN_RAIL: 'Cayman Rail',
  INTERNAL_BRAVUS: 'Transferência Bravus',
  PIX: 'Canal legado descontinuado',
  TED: 'Canal legado descontinuado',
}[String(channel || '').toUpperCase()] || channel || 'Bravus');

const operationErrorMessage = (err, fallback = 'Falha na operacao.') => {
  const data = err?.response?.data;
  if (typeof data === 'string') return data;
  return data?.message || fallback;
};

const isCreditTransaction = (type) => ['DEPOSIT', 'TRANSFER_IN'].includes(type);

const receiptIdForTransaction = (tx) =>
  tx?.receiptOrderId || tx?.externalOrderId || tx?.orderId || tx?.transferOrderId || null;

const transactionCounterparty = (tx) => {
  const credit = isCreditTransaction(tx?.type);
  const label = credit ? 'De' : 'Para';
  const name =
    (credit ? tx?.senderName : tx?.receiverName)
    || tx?.counterpartyName
    || tx?.beneficiaryName
    || tx?.payerName
    || '';
  const document =
    (credit ? tx?.senderDocument : tx?.receiverDocument)
    || tx?.counterpartyDocument
    || tx?.beneficiaryDocument
    || tx?.payerDocument
    || '';
  const account =
    (credit ? tx?.senderAccountNumber : tx?.receiverAccountNumber)
    || (credit ? tx?.senderAccount : tx?.receiverAccount)
    || tx?.counterpartyAccount
    || tx?.destinationAccount
    || '';
  const bank =
    (credit ? tx?.senderBankName : tx?.receiverBankName)
    || tx?.counterpartyBankName
    || tx?.bankName
    || '';
  const detail = [
    document && `Doc ${document}`,
    account && `Conta ${account}`,
    bank,
  ].filter(Boolean).join(' | ');
  return { label, name, document, account, bank, detail };
};

const BRAVUS_FULL_LOGO_SRC = '/brand/bravus-logo-transparent.png';

const escapeHtml = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));

const documentLogoUrl = () => {
  if (typeof window === 'undefined') return BRAVUS_FULL_LOGO_SRC;
  return new URL(BRAVUS_FULL_LOGO_SRC, window.location.origin).href;
};

const documentDate = (dateString) => formatDate(dateString) || '-';

const monthKeyForDate = (dateString) => {
  const date = dateString ? new Date(dateString) : new Date();
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  return `${safeDate.getFullYear()}-${String(safeDate.getMonth() + 1).padStart(2, '0')}`;
};

const monthLabel = (key) => {
  const [year, month] = String(key).split('-').map(Number);
  const date = new Date(year, (month || 1) - 1, 1);
  if (Number.isNaN(date.getTime())) return key;
  return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
};

const selectedMonthLabel = (months) =>
  months.length === 1 ? monthLabel(months[0]) : `${months.length} meses selecionados`;

const documentFilename = (prefix, identifier, extension = 'html') =>
  `${prefix}-${String(identifier || new Date().toISOString().slice(0, 10))
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()}.${extension}`;

const downloadBlobDocument = ({ filename, blob }) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const downloadHtmlDocument = ({ filename, html }) => {
  downloadBlobDocument({
    filename,
    blob: new Blob([html], { type: 'text/html;charset=utf-8' }),
  });
};

const downloadPdfDocument = async ({ filename, pdf }) => {
  if (isMobileApp()) {
    return saveNativeReceiptPdf({ filename, pdf });
  }
  downloadBlobDocument({ filename, blob: pdf });
  return { message: 'Comprovante em PDF baixado.' };
};

const ACCOUNT_REVIEW_MESSAGE =
  'Não foi possível concluir a transferência. Sua conta está passando por uma análise interna de segurança e validação cadastral. Esse processo pode levar até 15 dias corridos. Enquanto isso, a conta permanece habilitada para receber valores normalmente.';
const OUTBOUND_REVIEW_MESSAGE =
  'Não foi possível concluir esta operação. Sua conta está passando por uma análise interna de segurança e validação cadastral. Esse processo pode levar até 15 dias corridos. Enquanto isso, a conta permanece habilitada para receber valores normalmente.';

const shareHtmlDocument = async ({ filename, html, title, text }) => {
  const file = new File([html], filename, { type: 'text/html' });
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title, text });
    return 'Arquivo compartilhado.';
  }
  if (navigator.share) {
    await navigator.share({ title, text, url: window.location.href });
    return 'Link compartilhado.';
  }
  await navigator.clipboard?.writeText(text);
  downloadHtmlDocument({ filename, html });
  return 'Compartilhamento direto indisponivel. O arquivo foi baixado e o resumo foi copiado.';
};

const sharePdfDocument = async ({ filename, pdf, title, text }) => {
  if (isMobileApp()) {
    return shareNativeReceiptPdf({ filename, pdf, title, text });
  }
  const file = new File([pdf], filename, { type: 'application/pdf' });
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title, text });
    return 'PDF compartilhado.';
  }
  if (navigator.share) {
    await navigator.share({ title, text, url: window.location.href });
    return 'Link compartilhado.';
  }
  await navigator.clipboard?.writeText(text);
  downloadPdfDocument({ filename, pdf });
  return 'Compartilhamento direto indisponivel. O PDF foi baixado e o resumo foi copiado.';
};

const pdfByteLength = (value) => new TextEncoder().encode(value).length;

const normalizePdfText = (value, fallback = '-') => {
  const normalized = String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return normalized || fallback;
};

const escapePdfText = (value) =>
  normalizePdfText(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

const truncatePdfText = (value, maxLength = 92) => {
  const text = normalizePdfText(value);
  return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text;
};

const pdfTextCommand = ({ text, x, y, size = 10, bold = false }) =>
  `BT /${bold ? 'F2' : 'F1'} ${size} Tf 1 0 0 1 ${x} ${y} Tm (${escapePdfText(text)}) Tj ET`;

const createSinglePagePdf = (commands) => {
  const stream = `${commands.join('\n')}\n`;
  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>\nendobj\n',
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n',
    `6 0 obj\n<< /Length ${pdfByteLength(stream)} >>\nstream\n${stream}endstream\nendobj\n`,
  ];
  const parts = ['%PDF-1.4\n'];
  const offsets = [];
  let offset = pdfByteLength(parts[0]);
  objects.forEach((object) => {
    offsets.push(offset);
    parts.push(object);
    offset += pdfByteLength(object);
  });
  const xrefOffset = offset;
  const xref = [
    'xref\n',
    `0 ${objects.length + 1}\n`,
    '0000000000 65535 f \n',
    ...offsets.map((item) => `${String(item).padStart(10, '0')} 00000 n \n`),
    'trailer\n',
    `<< /Size ${objects.length + 1} /Root 1 0 R >>\n`,
    'startxref\n',
    `${xrefOffset}\n`,
    '%%EOF',
  ].join('');
  return new Blob([...parts, xref], { type: 'application/pdf' });
};

const buildPrintableHtml = ({ title, subtitle, body, footer }) => `
<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; background: #f4f4f5; color: #000; font-family: Arial, Helvetica, sans-serif; }
    .document { max-width: 920px; margin: 24px auto; background: #fff; border: 1px solid #d4d4d8; padding: 32px; }
    .header { display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; border-bottom: 2px solid #000; padding-bottom: 20px; }
    .logo { width: 260px; max-width: 48%; height: auto; object-fit: contain; }
    .eyebrow { font-size: 11px; text-transform: uppercase; letter-spacing: .16em; font-weight: 700; }
    h1 { margin: 8px 0 0; font-size: 28px; line-height: 1.15; }
    .subtitle { margin-top: 6px; font-size: 14px; }
    .section { margin-top: 24px; border: 1px solid #d4d4d8; padding: 16px; }
    .section h2 { margin: 0 0 12px; font-size: 16px; }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 18px; }
    .line { display: flex; justify-content: space-between; gap: 18px; border-bottom: 1px solid #e4e4e7; padding: 7px 0; font-size: 13px; }
    .line span:last-child { text-align: right; font-family: "Courier New", monospace; font-weight: 700; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { border-bottom: 1px solid #d4d4d8; padding: 9px 6px; text-align: left; vertical-align: top; }
    th { background: #f4f4f5; font-size: 11px; text-transform: uppercase; letter-spacing: .08em; }
    td.amount, th.amount { text-align: right; white-space: nowrap; font-family: "Courier New", monospace; font-weight: 700; }
    .summary { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
    .summary div { border: 1px solid #d4d4d8; padding: 12px; }
    .summary strong { display: block; margin-top: 4px; font-family: "Courier New", monospace; }
    .footer { margin-top: 24px; border-top: 1px solid #d4d4d8; padding-top: 14px; font-size: 11px; color: #000; }
    @media (max-width: 700px) {
      .document { margin: 0; padding: 18px; border: 0; }
      .header { flex-direction: column; }
      .logo { max-width: 100%; width: 230px; }
      .grid, .summary { grid-template-columns: 1fr; }
      table { font-size: 11px; }
    }
    @media print {
      body { background: #fff; }
      .document { margin: 0; max-width: none; border: 0; }
    }
  </style>
</head>
<body>
  <main class="document">
    <header class="header">
      <img class="logo" src="${escapeHtml(documentLogoUrl())}" alt="Bravus Bank" />
      <div>
        <div class="eyebrow">Bravus Premium Bank</div>
        <h1>${escapeHtml(title)}</h1>
        <div class="subtitle">${escapeHtml(subtitle)}</div>
      </div>
    </header>
    ${body}
    <footer class="footer">${escapeHtml(footer || `Documento emitido em ${formatDate(new Date().toISOString())}`)}</footer>
  </main>
</body>
</html>`;

const accountRowsHtml = ({ me, profile, user }) => {
  const account = me?.dadosBancarios || {};
  const rows = [
    ['Titular', me?.fullName || profile?.fullName || user?.fullName || user?.username],
    ['CPF/CNPJ', me?.cpf || profile?.cpf || user?.cpf],
    ['Banco', account.nomeBanco || 'Bravus Premium Bank'],
    ['Codigo banco', account.codigoBanco || '999'],
    ['Agencia', account.agencia || profile?.agencia || '0001'],
    ['Conta', account.contaFormatada || account.conta || profile?.accountNumber || '-'],
    ['Tipo', account.tipoConta || me?.accountType || 'CORRENTE'],
  ];
  return rows.map(([label, value]) => `<div class="line"><span>${escapeHtml(label)}</span><span>${escapeHtml(value || '-')}</span></div>`).join('');
};

const receiptRowsHtml = (rows) =>
  rows.map(([label, value]) => `<div class="line"><span>${escapeHtml(label)}</span><span>${escapeHtml(value || '-')}</span></div>`).join('');

const partyRows = (party) => [
  ['Nome', party?.name],
  ['Documento', party?.document],
  ['Banco', party?.bankName || party?.bankCode],
  ['Codigo', party?.bankCode],
  ['ISPB', party?.ispb],
  ['Agencia', party?.agency],
  ['Conta', [party?.accountNumber, party?.accountDigit].filter(Boolean).join('-')],
  ['Tipo', party?.accountType],
];

const buildReceiptPdfBlob = (receipt) => {
  const commands = [
    '0.035 0.063 0.141 rg 0 800 595 42 re f',
    '0.918 0.686 0.157 rg 0 796 595 4 re f',
    '1 1 1 rg',
    pdfTextCommand({ text: 'BRAVUS PREMIUM BANK', x: 48, y: 816, size: 13, bold: true }),
    '0 0 0 rg',
    pdfTextCommand({ text: 'Comprovante de transferencia', x: 48, y: 764, size: 22, bold: true }),
    pdfTextCommand({ text: `Valor: ${formatCurrency(receipt?.amountCentavos)}`, x: 48, y: 732, size: 16, bold: true }),
    pdfTextCommand({
      text: `${displayTransferChannel(receipt?.channel)} | ${receipt?.settlementStatus || receipt?.status || 'PROCESSADO'}`,
      x: 48,
      y: 711,
      size: 10,
    }),
  ];
  let y = 680;
  const addSection = (title, rows) => {
    commands.push('0.918 0.686 0.157 rg');
    commands.push(pdfTextCommand({ text: title, x: 48, y, size: 12, bold: true }));
    commands.push('0 0 0 rg');
    y -= 20;
    rows.forEach(([label, value]) => {
      if (y < 58) return;
      commands.push(pdfTextCommand({ text: `${label}:`, x: 58, y, size: 8.5, bold: true }));
      commands.push(pdfTextCommand({ text: truncatePdfText(value), x: 190, y, size: 8.5 }));
      y -= 13;
    });
    y -= 8;
  };

  addSection('Dados da transferencia', [
    ['Comprovante', receipt?.receiptId],
    ['Tipo', receipt?.receiptKind],
    ['Transacao', receipt?.transactionId],
    ['Valor', formatCurrency(receipt?.amountCentavos)],
    ['Canal', displayTransferChannel(receipt?.channel)],
    ['Status', receipt?.status],
    ['Liquidacao', receipt?.settlementStatus],
    ['Data', documentDate(receipt?.createdAt)],
  ]);
  addSection('Pagador', partyRows(receipt?.payer));
  addSection('Recebedor', partyRows(receipt?.beneficiary));
  addSection('Rastreabilidade', [
    ['Provedor', receipt?.provider],
    ['ID provedor', receipt?.providerTransferId],
    ['Rede destino', receipt?.destinationNetwork],
    ['Participante', receipt?.destinationParticipantCode],
    ['Confirmacao destino', receipt?.destinationConfirmationId],
    ['Confirmado em', documentDate(receipt?.destinationConfirmedAt)],
    ['Mensagem', receipt?.settlementMessage],
    ['Idempotencia', receipt?.idempotencyKey],
    ['Descricao', receipt?.description || 'Transferencia Bravus'],
  ]);

  commands.push('0.25 0.25 0.25 rg');
  commands.push(pdfTextCommand({
    text: `Comprovante emitido em ${formatDate(new Date().toISOString())}. Validacao interna: ${receipt?.receiptId || '-'}`,
    x: 48,
    y: 38,
    size: 8,
  }));
  return createSinglePagePdf(commands);
};

export const buildReceiptDocument = (receipt) => {
  const title = `Comprovante Bravus ${formatCurrency(receipt?.amountCentavos)}`;
  const body = `
    <section class="section">
      <h2>Dados da transferencia</h2>
      ${receiptRowsHtml([
        ['Comprovante', receipt?.receiptId],
        ['Tipo', receipt?.receiptKind],
        ['Transacao', receipt?.transactionId],
        ['Valor', formatCurrency(receipt?.amountCentavos)],
        ['Canal', displayTransferChannel(receipt?.channel)],
        ['Status', receipt?.status],
        ['Liquidacao', receipt?.settlementStatus],
        ['Data', documentDate(receipt?.createdAt)],
      ])}
    </section>
    <section class="section">
      <h2>Pagador</h2>
      ${receiptRowsHtml(partyRows(receipt?.payer))}
    </section>
    <section class="section">
      <h2>Recebedor</h2>
      ${receiptRowsHtml(partyRows(receipt?.beneficiary))}
    </section>
    <section class="section">
      <h2>Rastreabilidade</h2>
      ${receiptRowsHtml([
        ['Provedor', receipt?.provider],
        ['ID provedor', receipt?.providerTransferId],
        ['Rede destino', receipt?.destinationNetwork],
        ['Participante', receipt?.destinationParticipantCode],
        ['Confirmacao destino', receipt?.destinationConfirmationId],
        ['Confirmado em', documentDate(receipt?.destinationConfirmedAt)],
        ['Mensagem', receipt?.settlementMessage],
        ['Idempotencia', receipt?.idempotencyKey],
        ['Descricao', receipt?.description || 'Transferencia Bravus'],
      ])}
    </section>`;
  return {
    filename: documentFilename('comprovante-bravus', receipt?.receiptId || receipt?.transactionId, 'pdf'),
    html: buildPrintableHtml({
      title,
      subtitle: `${displayTransferChannel(receipt?.channel)} | ${receipt?.settlementStatus || receipt?.status || 'PROCESSADO'}`,
      body,
      footer: `Comprovante emitido em ${formatDate(new Date().toISOString())}. Validacao interna: ${receipt?.receiptId || '-'}`,
    }),
    pdf: buildReceiptPdfBlob(receipt),
    text: `${title}\nRecebedor: ${receipt?.beneficiary?.name || '-'}\nValor: ${formatCurrency(receipt?.amountCentavos)}\nComprovante: ${receipt?.receiptId || '-'}`,
  };
};

const buildStatementDocument = ({ months, transactions, me, profile, user }) => {
  const selected = new Set(months);
  const filtered = transactions
    .filter((tx) => selected.has(monthKeyForDate(tx.createdAt || tx.date)))
    .slice()
    .sort((a, b) => new Date(a.createdAt || a.date || 0) - new Date(b.createdAt || b.date || 0));
  const inflow = filtered.filter((tx) => isCreditTransaction(tx.type)).reduce((acc, tx) => acc + (tx.amount || 0), 0);
  const outflow = filtered.filter((tx) => !isCreditTransaction(tx.type)).reduce((acc, tx) => acc + (tx.amount || 0), 0);
  const rows = filtered.map((tx) => {
    const counterparty = transactionCounterparty(tx);
    const signed = `${txSign(tx.type)} ${formatCurrency(tx.amount)}`;
    return `<tr>
      <td>${escapeHtml(documentDate(tx.createdAt || tx.date))}</td>
      <td>${escapeHtml(getTransactionTypeLabel(tx.type))}<br/><small>${escapeHtml(tx.description || '')}</small></td>
      <td>${escapeHtml(counterparty.name || '-')}<br/><small>${escapeHtml(counterparty.detail || '')}</small></td>
      <td class="amount">${escapeHtml(signed)}</td>
    </tr>`;
  }).join('');
  const period = selectedMonthLabel(months);
  const body = `
    <section class="section">
      <h2>Conta</h2>
      <div class="grid">${accountRowsHtml({ me, profile, user })}</div>
    </section>
    <section class="section">
      <h2>Resumo do periodo</h2>
      <div class="summary">
        <div>Entradas<strong>${escapeHtml(formatCurrency(inflow))}</strong></div>
        <div>Saidas<strong>${escapeHtml(formatCurrency(outflow))}</strong></div>
        <div>Movimentos<strong>${filtered.length}</strong></div>
      </div>
    </section>
    <section class="section">
      <h2>Movimentacoes</h2>
      <table>
        <thead><tr><th>Data</th><th>Operacao</th><th>Contraparte</th><th class="amount">Valor</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="4">Nenhuma movimentacao no periodo selecionado.</td></tr>'}</tbody>
      </table>
    </section>`;
  return {
    filename: documentFilename('extrato-bravus', months.join('-')),
    html: buildPrintableHtml({
      title: 'Extrato Bravus Bank',
      subtitle: `Periodo: ${period}`,
      body,
      footer: `Extrato emitido em ${formatDate(new Date().toISOString())}. Documento gerado pelo Bravus Premium Bank.`,
    }),
    text: `Extrato Bravus Bank\nPeriodo: ${period}\nEntradas: ${formatCurrency(inflow)}\nSaidas: ${formatCurrency(outflow)}\nMovimentos: ${filtered.length}`,
  };
};

const waitForAccountRetry = (delayMs) => new Promise((resolve) => {
  window.setTimeout(resolve, delayMs);
});

const shouldRetryAccountRequest = (error) => {
  const status = error?.response?.status;
  return !status || status === 408 || status === 429 || status >= 500;
};

const requestAccountData = async (request, attempts = 3) => {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await request();
    } catch (error) {
      lastError = error;
      if (!shouldRetryAccountRequest(error) || attempt === attempts - 1) throw error;
      await waitForAccountRetry(350 * (attempt + 1));
    }
  }
  throw lastError;
};

// ============ Component ============
export default function UserDashboard() {
  const initialRouteState = routeStateForPath(typeof window !== 'undefined' ? window.location.pathname : '/dashboard');
  const [profile, setProfile] = useState(null);
  const [me, setMe] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [creditSummary, setCreditSummary] = useState(null);
  const [externalOrders, setExternalOrders] = useState([]);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [receiptLoading, setReceiptLoading] = useState(null);
  const [receiptAction, setReceiptAction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [accountReviewNotice, setAccountReviewNotice] = useState('');
  const [showBalance, setShowBalance] = useState(true);
  const [portalView, setPortalView] = useState('icons');
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [activeModule, setActiveModule] = useState(initialRouteState.activeModule);

  const [tab, setTab] = useState(initialRouteState.tab);
  const [form, setForm] = useState(EMPTY_FORM);
  const [resolvedRecipient, setResolvedRecipient] = useState(null);
  const [resolveLoading, setResolveLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const internalTransferAttempt = useRef(null);
  const accountReviewNoticeRef = useRef(null);
  const accountRefreshInFlight = useRef(null);
  const accountDataSignature = useRef('');
  const lastAccountRefreshAt = useRef(0);
  const accountMenuRef = useRef(null);

  const user = authService.getCurrentUser();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => { loadData(); }, []);
  useEffect(() => {
    const route = routeStateForPath(location.pathname);
    setTab(route.tab);
    setActiveModule(route.activeModule);
    setAccountMenuOpen(false);
    if (route.tab !== 'transfer') setAccountReviewNotice('');
    if (route.transferMode) {
      setForm({
        ...EMPTY_FORM,
        transferMode: route.transferMode,
        channel: route.channel || 'ACH',
        destinationNetwork: route.destinationNetwork || destinationNetworkForChannel(route.channel || 'ACH'),
      });
      setResolvedRecipient(null);
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [location.pathname]);
  useEffect(() => {
    if (!accountMenuOpen) return undefined;
    const closeOnOutsideClick = (event) => {
      if (!accountMenuRef.current?.contains(event.target)) setAccountMenuOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setAccountMenuOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [accountMenuOpen]);
  useEffect(() => {
    if (success || error) {
      const t = setTimeout(() => { setSuccess(''); setError(''); }, 4500);
      return () => clearTimeout(t);
    }
  }, [success, error]);

  useEffect(() => {
    if (!accountReviewNotice) return undefined;
    const frame = window.requestAnimationFrame(() => {
      accountReviewNoticeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [accountReviewNotice]);

  useEffect(() => {
    if (profile?.outboundOperationsEnabled !== false) setAccountReviewNotice('');
  }, [profile?.outboundOperationsEnabled]);

  useEffect(() => {
    const destination = form.transferMode === 'internal' ? form.destinationAccount.trim() : '';
    if (tab !== 'transfer' || destination.length < 3) {
      setResolvedRecipient(null);
      setResolveLoading(false);
      return undefined;
    }
    let active = true;
    setResolveLoading(true);
    const timer = setTimeout(async () => {
      try {
        const { data } = await userService.resolveTransferDestination(destination);
        if (active) setResolvedRecipient(data?.found === false ? null : data);
      } catch {
        if (active) setResolvedRecipient(null);
      } finally {
        if (active) setResolveLoading(false);
      }
    }, 350);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [tab, form.transferMode, form.destinationAccount]);

  async function loadData(options = {}) {
    if (accountRefreshInFlight.current) {
      if (!options.force) return accountRefreshInFlight.current;
      await accountRefreshInFlight.current;
      return loadData({ ...options, force: false });
    }
    const silent = Boolean(options.silent);
    const refresh = (async () => {
      try {
        if (!silent) setLoading(true);
        const [profileRes, meRes, txRes, creditRes, externalRes] = await Promise.all([
          requestAccountData(() => userService.getProfile()),
          userService.getMe().catch(() => ({ data: null })),
          requestAccountData(() => userService.getTransactions()),
          userService.getCreditSummary().catch(() => ({ data: null })),
          userService.getExternalTransfers(8).catch(() => ({ data: [] })),
        ]);
        const snapshot = {
          profile: profileRes.data,
          me: meRes?.data || null,
          transactions: Array.isArray(txRes.data) ? txRes.data : [],
          creditSummary: creditRes?.data || null,
          externalOrders: Array.isArray(externalRes?.data) ? externalRes.data : [],
        };
        const signature = JSON.stringify(snapshot);
        if (accountDataSignature.current !== signature) {
          accountDataSignature.current = signature;
          setProfile(snapshot.profile);
          setMe(snapshot.me);
          setTransactions(snapshot.transactions);
          setCreditSummary(snapshot.creditSummary);
          setExternalOrders(snapshot.externalOrders);
        }
      } catch (err) {
        if (!silent) setError('Erro ao carregar dados da conta.');
      } finally {
        if (!silent) setLoading(false);
      }
    })();
    accountRefreshInFlight.current = refresh;
    try {
      return await refresh;
    } finally {
      if (accountRefreshInFlight.current === refresh) accountRefreshInFlight.current = null;
    }
  }

  useEffect(() => {
    const refreshLiveAccount = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      if (Date.now() - lastAccountRefreshAt.current < 1500) return;
      lastAccountRefreshAt.current = Date.now();
      loadData({ silent: true });
    };
    window.addEventListener('focus', refreshLiveAccount);
    document.addEventListener('visibilitychange', refreshLiveAccount);
    const timer = window.setInterval(refreshLiveAccount, isMobileApp() ? 45000 : 15000);
    return () => {
      window.removeEventListener('focus', refreshLiveAccount);
      document.removeEventListener('visibilitychange', refreshLiveAccount);
      window.clearInterval(timer);
    };
  }, []);

  const cents = (v) => Math.round(parseFloat(v) * 100);

  const submit = async (kind) => {
    if ((kind === 'transfer' || kind === 'withdraw') && profile?.outboundOperationsEnabled === false) {
      if (kind === 'transfer') {
        setError('');
        setAccountReviewNotice(ACCOUNT_REVIEW_MESSAGE);
        return;
      }
      return setError(OUTBOUND_REVIEW_MESSAGE);
    }
    const amountCentavos = cents(form.amount);
    if (!form.amount || !Number.isFinite(amountCentavos) || amountCentavos <= 0) return setError('Digite um valor válido.');
    if ((kind === 'withdraw' || kind === 'transfer') && balance < amountCentavos) {
      return setError('Saldo disponivel insuficiente para concluir a operacao.');
    }
    if (kind === 'transfer' && form.transferMode === 'internal' && !form.destinationAccount) {
      return setError('Informe a conta, o CPF, o e-mail ou o usuário Bravus de destino.');
    }
    if (kind === 'transfer' && form.transferMode === 'internal' && !resolvedRecipient) {
      return setError('Confira o recebedor Bravus antes de enviar. Digite a conta, o CPF, o e-mail ou o usuário completo.');
    }
    if (kind === 'transfer' && form.transferMode === 'external') {
      if ((!form.beneficiaryName || !form.beneficiaryDocument) && !resolvedRecipient) {
        return setError('Informe nome e documento do beneficiário.');
      }
      if (!form.accountNumber) return setError('Informe a conta beneficiária para o canal selecionado.');
    }
    let transferIdempotencyKey = null;
    if (kind === 'transfer') {
      const fingerprint = JSON.stringify([
        form.transferMode,
        amountCentavos,
        resolvedRecipient?.accountNumber || form.accountNumber || form.pixKey || '',
        form.beneficiaryDocument || '',
        form.channel || '',
        form.description?.trim() || '',
      ]);
      if (internalTransferAttempt.current?.fingerprint !== fingerprint) {
        internalTransferAttempt.current = {
          fingerprint,
          key: createIdempotencyKey(),
        };
      }
      transferIdempotencyKey = internalTransferAttempt.current.key;
    }
    setSubmitting(true);
    try {
      let message =
        kind === 'deposit' ? 'Depósito realizado.' :
        kind === 'withdraw' ? 'Saque realizado.' : 'Transferência enviada.';

      if (kind === 'deposit') await userService.deposit(amountCentavos, form.description);
      if (kind === 'withdraw') await userService.withdraw(amountCentavos, form.description);
      if (kind === 'transfer' && form.transferMode === 'internal') {
        const { data } = await userService.transfer(
          amountCentavos,
          resolvedRecipient.accountNumber,
          form.description,
          transferIdempotencyKey,
        );
        internalTransferAttempt.current = null;
        if (data?.provider === 'BRAVUS_INTERNAL_LEDGER') {
          message = 'Transferencia Bravus liquidada na hora.';
        }
        if (data?.provider === 'BRAVUS_SELF_PROVIDER') {
          message = data?.settlementStatus === 'LIQUIDADA_CONFIRMADA'
            ? 'Pagamento liquidado pelo provedor Bravus.'
            : 'Pagamento debitado no Bravus. Aguardando confirmacao do destino.';
        }
        const receiptOrderId = data?.receiptOrderId || data?.externalOrderId || data?.orderId || data?.id;
        if (receiptOrderId) {
          const receiptRes = await userService.getExternalTransferReceipt(receiptOrderId).catch(() => ({ data: null }));
          if (receiptRes?.data) setSelectedReceipt(receiptRes.data);
        }
      }
      if (kind === 'transfer' && form.transferMode === 'external') {
        const { data } = await userService.externalTransfer({
          amountCentavos,
          channel: form.channel,
          beneficiaryName: form.beneficiaryName || resolvedRecipient?.name || resolvedRecipient?.fullName,
          beneficiaryDocument: form.beneficiaryDocument || resolvedRecipient?.document,
          bankCode: form.bankCode || resolvedRecipient?.bankCode,
          ispb: form.ispb || resolvedRecipient?.ispb,
          agency: form.agency || resolvedRecipient?.agency,
          accountNumber: form.accountNumber || resolvedRecipient?.accountNumber,
          accountDigit: form.accountDigit || resolvedRecipient?.accountDigit,
          accountType: form.accountType || resolvedRecipient?.accountType,
          destinationNetwork: resolvedRecipient ? 'INTERNAL_BRAVUS' : form.destinationNetwork,
          pixKey: form.pixKey,
          pixKeyType: form.pixKeyType,
          description: form.description,
        }, transferIdempotencyKey);
        internalTransferAttempt.current = null;
        message = data?.status === 'PENDING_PROVIDER'
          ? 'Ordem registrada. Aguardando configuração do provedor Bravus.'
          : 'Transferência aceita pelo provedor Bravus e valor debitado.';
        if (data?.status !== 'PENDING_PROVIDER') {
          message = data?.settlementStatus === 'LIQUIDADA_CONFIRMADA'
            ? 'Transferencia liquidada no destino confirmado.'
            : 'Transferencia debitada no Bravus. Aguardando confirmacao do destino.';
        }
        const receiptOrderId = data?.receiptOrderId || data?.externalOrderId || data?.orderId || data?.id;
        if (receiptOrderId) {
          const receiptRes = await userService.getExternalTransferReceipt(receiptOrderId).catch(() => ({ data: null }));
          if (receiptRes?.data) setSelectedReceipt(receiptRes.data);
        }
      }

      setSuccess(message);
      setForm(EMPTY_FORM);
      setResolvedRecipient(null);
      await loadData({ force: true });
      navigateToTab('overview');
    } catch (err) {
      const restrictionCode = err?.response?.data?.code;
      if (kind === 'transfer' && ['ACCOUNT_UNDER_REVIEW', 'KYC_IDENTITY_PENDING'].includes(restrictionCode)) {
        setError('');
        setAccountReviewNotice(ACCOUNT_REVIEW_MESSAGE);
        return;
      }
      setError(operationErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const openReceipt = async (orderId) => {
    setReceiptLoading(orderId);
    setError('');
    try {
      const { data } = await userService.getExternalTransferReceipt(orderId);
      setSelectedReceipt(data);
    } catch (err) {
      setError(operationErrorMessage(err, 'Falha ao carregar comprovante.'));
    } finally {
      setReceiptLoading(null);
    }
  };

  const downloadReceipt = async () => {
    if (!selectedReceipt) return;
    setReceiptAction('download');
    setError('');
    try {
      const document = buildReceiptDocument(selectedReceipt);
      const result = await downloadPdfDocument(document);
      setSuccess(result.message);
    } catch (err) {
      const needsUpdate = err?.code === 'NATIVE_RECEIPT_PLUGINS_UNAVAILABLE';
      setError(needsUpdate
        ? 'Atualize o aplicativo Bravus para baixar comprovantes em PDF.'
        : 'Nao foi possivel salvar o PDF do comprovante.');
    } finally {
      setReceiptAction(null);
    }
  };

  const shareReceipt = async () => {
    if (!selectedReceipt) return;
    setReceiptAction('share');
    setError('');
    try {
      const document = buildReceiptDocument(selectedReceipt);
      const message = await sharePdfDocument({
        ...document,
        title: 'Comprovante Bravus Bank',
      });
      setSuccess(message);
    } catch (err) {
      if (err?.name !== 'AbortError') {
        const needsUpdate = err?.code === 'NATIVE_RECEIPT_PLUGINS_UNAVAILABLE';
        setError(needsUpdate
          ? 'Atualize o aplicativo Bravus para compartilhar o PDF.'
          : 'Nao foi possivel compartilhar o comprovante.');
      }
    } finally {
      setReceiptAction(null);
    }
  };

  // ====== Computed ======
  const stats = useMemo(() => {
    const inflow = transactions
      .filter((t) => ['DEPOSIT', 'TRANSFER_IN'].includes(t.type))
      .reduce((acc, t) => acc + (t.amount || 0), 0);
    const outflow = transactions
      .filter((t) => ['WITHDRAWAL', 'TRANSFER_OUT', 'TRANSFER_EXTERNAL', 'PAYMENT'].includes(t.type))
      .reduce((acc, t) => acc + (t.amount || 0), 0);
    return { inflow, outflow, count: transactions.length };
  }, [transactions]);

  const chartData = useMemo(() => {
    // last 7 days running balance approximation
    const days = [...Array(7)].map((_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (6 - i));
      return { key: d.toISOString().slice(0, 10), label: d.toLocaleDateString('pt-BR', { weekday: 'short' }), value: 0 };
    });
    transactions.forEach((t) => {
      const k = (t.createdAt || t.date || '').slice(0, 10);
      const found = days.find((d) => d.key === k);
      if (found) {
        const signed = ['DEPOSIT', 'TRANSFER_IN'].includes(t.type) ? (t.amount || 0) : -(t.amount || 0);
        found.value += signed;
      }
    });
    // running cumulative
    let acc = 0;
    return days.map((d) => { acc += d.value; return { ...d, saldo: acc / 100 }; });
  }, [transactions]);

  // ====== UI ======
  if (loading) {
    return (
      <main className="container-app native-safe-bottom space-y-4 py-4 sm:space-y-6 sm:py-8 lg:py-10">
        <div className="skeleton h-32" />
        <div className="grid md:grid-cols-3 gap-5">
          {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-24" />)}
        </div>
        <div className="skeleton h-80" />
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="container-app native-safe-bottom py-8 lg:py-12">
        <section className="mx-auto max-w-xl border border-white/10 bg-surface-900 p-6 shadow-card">
          <h1 className="text-xl font-semibold text-white">Não foi possível carregar sua conta</h1>
          <p className="mt-2 text-sm leading-6 text-ink-300">
            Seus dados permanecem protegidos. Verifique a conexão e tente carregar novamente.
          </p>
          <button type="button" className="btn-primary mt-5" onClick={() => loadData({ force: true })}>
            Tentar novamente
          </button>
        </section>
      </main>
    );
  }

  const balance = profile?.balance ?? 0;
  const accountNumber = profile.accountNumber || profile.customerCode || '-';
  const creditAvailable = creditSummary?.creditoDisponivelCentavos ?? 0;
  const creditGranted = creditSummary?.creditoTotalConcedidoCentavos ?? 0;
  const creditUsed = creditSummary?.creditoTotalUsadoCentavos ?? 0;
  const creditLiquidated = creditSummary?.creditoTotalLiquidadoCentavos ?? 0;
  const creditDebtPrincipal = creditSummary?.dividaPrincipalCentavos ?? Math.max(0, creditGranted - creditLiquidated);
  const interestAccrued = creditSummary?.jurosAcumuladoCentavos ?? 0;
  const creditDebt = creditSummary?.dividaTotalCentavos ?? (creditDebtPrincipal + interestAccrued);
  const annualInterestRate = Number(creditSummary?.taxaJurosAnualMedia ?? 0);
  const monthlyInterestRate = Number(creditSummary?.taxaJurosMensalEquivalente ?? 0);

  const navigateToTab = (id) => {
    setTab(id);
    navigate(TAB_ROUTES[id] || '/dashboard');
  };

  const openTransferMode = (transferMode = 'internal', channel = 'INTERNAL_BRAVUS', routeOverride = null) => {
    setForm({
      ...EMPTY_FORM,
      transferMode,
      channel,
      destinationNetwork: destinationNetworkForChannel(channel),
    });
    setTab('transfer');
    navigate(routeOverride || (transferMode === 'internal' ? '/dashboard/transfer' : '/dashboard/pagamentos'));
  };

  const bankingModules = [
    { id: 'balances', label: 'Saldos e Extratos', Icon: FileText, badge: `${transactions.length} movs` },
    { id: 'localCayman', label: 'Transferência Cayman', Icon: Landmark, badge: 'ACH e EFT', accent: true },
    { id: 'transfers', label: 'Transferências Bravus', Icon: ArrowRightLeft, badge: 'Liquidação interna' },
    { id: 'internationalWire', label: 'Wire internacional', Icon: Send, badge: 'SWIFT e correspondente' },
    { id: 'remittance', label: 'Remessas e câmbio', Icon: Globe2, badge: 'Licença CIMA' },
    { id: 'dda', label: 'DDA Boletos Registrados', Icon: ClipboardCheck, badge: '0 pendentes' },
    { id: 'cards', label: 'Cartoes', Icon: CreditCard, badge: 'Conta ativa' },
    { id: 'credit', label: 'Emprestimos e Recebiveis', Icon: Landmark, badge: showBalance ? formatCurrency(creditAvailable) : 'KYD ******', accent: true },
    { id: 'deposit-check', label: 'Deposito de Cheque', Icon: ArrowDownToLine, badge: 'Digital' },
    { id: 'checks', label: 'Cheques', Icon: FileText, badge: '0 folhas' },
    { id: 'schedules', label: 'Agendamentos', Icon: CalendarDays, badge: '0 hoje' },
    { id: 'investments', label: 'Investimentos', Icon: LineChart, badge: 'Carteira' },
    { id: 'pending', label: 'Pendencias', Icon: UserCheck, badge: me?.conta?.statusKyc || 'Conta' },
    { id: 'beneficiaries', label: 'Favorecidos', Icon: UsersRound, badge: `${externalOrders.length} recentes` },
    { id: 'receipts', label: 'Comprovantes', Icon: Receipt, badge: `${externalOrders.length} ordens` },
    { id: 'limits', label: 'Limites', Icon: Smartphone, badge: showBalance ? formatCurrency(me?.saldos?.limiteTransferenciaDiarioCentavos ?? me?.saldos?.limitePixDiarioCentavos ?? 0) : 'KYD ******' },
    { id: 'security', label: 'Seguranca', Icon: ShieldCheck, badge: 'Ativa' },
  ];

  const normalizedDashboardPath = location.pathname.replace(/\/+$/, '') || '/dashboard';
  const isDashboardHome = normalizedDashboardPath === '/dashboard';
  const activeModuleDefinition = bankingModules.find((module) => module.id === activeModule) || bankingModules[0];
  const dedicatedPageMeta = DIRECT_ROUTE_META[normalizedDashboardPath] || activeModuleDefinition;
  const transferOperationLabel = activeModule === 'localCayman'
    ? 'transferência Cayman'
    : activeModule === 'internationalWire'
      ? 'Wire internacional'
      : activeModule === 'remittance'
        ? 'remessa ou câmbio'
        : 'transferência';

  const handleModuleClick = (moduleId) => {
    const route = MODULE_ROUTES[moduleId] || '/dashboard';
    const routeState = routeStateForPath(route);
    setActiveModule(routeState.activeModule);
    setTab(routeState.tab);
    if (routeState.transferMode) {
      setForm({
        ...EMPTY_FORM,
        transferMode: routeState.transferMode,
        channel: routeState.channel || 'ACH',
        destinationNetwork: routeState.destinationNetwork || destinationNetworkForChannel(routeState.channel || 'ACH'),
      });
    }
    return navigate(route);
  };

  const handleAccountLogout = async () => {
    let logoutStatus = { serverRevoked: true };
    try {
      logoutStatus = await authService.logout();
    } finally {
      setAccountMenuOpen(false);
      navigate('/login', { replace: true });
    }
    if (!logoutStatus.serverRevoked && window.setGlobalError) {
      window.setGlobalError('A conta saiu deste aparelho, mas a conexão impediu a revogação remota. Entre novamente para renovar a segurança da sessão.');
    }
  };

  const Tab = ({ id, label, icon: Icon }) => (
    <button
      onClick={() => navigateToTab(id)}
      className={cn(
        'inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition',
        tab === id ? 'bg-white/10 text-white shadow-card' : 'text-ink-300 hover:text-white hover:bg-white/5'
      )}
    >
      <Icon className="h-4 w-4" /> {label}
    </button>
  );

  return (
    <main className="container-app native-safe-bottom min-w-0 space-y-4 py-4 sm:space-y-6 sm:py-8 lg:py-10">
      <div className="relative z-30 flex justify-end" ref={accountMenuRef}>
        <button
          type="button"
          className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-white/10 bg-white/[0.06] text-ink-100 transition hover:bg-white/[0.12]"
          onClick={() => setAccountMenuOpen((open) => !open)}
          aria-label={accountMenuOpen ? 'Fechar menu da conta' : 'Abrir menu da conta'}
          aria-expanded={accountMenuOpen}
          aria-haspopup="menu"
          title="Menu da conta"
        >
          {accountMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>

        <AnimatePresence>
          {accountMenuOpen && (
            <motion.div
              role="menu"
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              className="absolute right-0 top-14 w-[min(19rem,calc(100vw-2rem))] overflow-hidden rounded-lg border border-white/10 bg-ink-900 p-2 shadow-2xl"
            >
              <div className="border-b border-white/10 px-3 py-3">
                <div className="truncate text-sm font-semibold text-white">{profile?.fullName || user?.fullName || user?.username}</div>
                <div className="mt-0.5 truncate text-xs text-ink-400">Conta {accountNumber}</div>
              </div>
              <div className="py-2">
                {ACCOUNT_MENU_ITEMS.map(({ label, route, Icon }) => {
                  const active = normalizedDashboardPath === route;
                  return (
                    <button
                      key={route}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setAccountMenuOpen(false);
                        navigate(route);
                      }}
                      className={cn(
                        'flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm transition',
                        active ? 'bg-amber-300/15 text-amber-100' : 'text-ink-200 hover:bg-white/[0.07] hover:text-white'
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{label}</span>
                    </button>
                  );
                })}
              </div>
              <div className="border-t border-white/10 pt-2">
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleAccountLogout}
                  className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm text-red-200 transition hover:bg-red-400/10 hover:text-red-100"
                >
                  <LogOut className="h-4 w-4" />
                  Sair da conta
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {profile?.identityEvidenceRequired && (
        <section className="flex flex-col gap-4 rounded-lg border border-gold-400/30 bg-gold-400/10 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 font-medium text-gold-100">
              <ShieldCheck className="h-4 w-4" /> Identidade pendente
            </div>
            <p className="mt-1 text-sm text-ink-200">Envie documento e captura facial para liberar operacoes de saida.</p>
          </div>
          <button type="button" className="btn-primary shrink-0" onClick={() => navigate('/completar-identidade')}>
            Completar identidade
          </button>
        </section>
      )}
      {isDashboardHome ? (
        <>
          {/* ==== Bank Identity Card ==== */}
          {me && <BankIdentityCard me={me} />}

      {/* ==== Greeting + Balance ==== */}
      <div className="grid lg:grid-cols-3 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="card-premium relative overflow-hidden p-4 sm:p-8 lg:col-span-2"
        >
          <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-gradient-gold opacity-15 blur-3xl" />
          <div className="text-xs uppercase tracking-widest text-ink-300">
            Olá, <span className="text-white">{user?.fullName || user?.username}</span>
          </div>
          <div className="mt-2 flex items-center gap-3">
            <div className="text-sm text-ink-300">Saldo disponível</div>
            <button onClick={() => setShowBalance((v) => !v)} className="text-ink-400 hover:text-white transition">
              {showBalance ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </button>
          </div>
          <div className="mt-1 break-words font-display text-4xl font-bold tabular-nums sm:text-5xl">
            {showBalance ? (
              <>KYD <span className="gradient-text">{formatCurrency(balance).replace('KYD', '').trim()}</span></>
            ) : (
              <span className="text-ink-400">KYD ••••••</span>
            )}
          </div>
          <div className="mt-2 text-xs text-ink-400 font-mono">Conta {accountNumber}</div>

          <div className="mt-5 grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <div className="flex items-center gap-2 text-xs text-ink-300">
                <CreditCard className="h-4 w-4 text-bravus-200" /> Crédito disponível
              </div>
              <div className="mt-1 font-display text-lg font-semibold tabular-nums">
                {showBalance ? formatCurrency(creditAvailable) : 'KYD ••••••'}
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <div className="flex items-center gap-2 text-xs text-ink-300">
                <Landmark className="h-4 w-4 text-red-200" /> Dívida total
              </div>
              <div className="mt-1 font-display text-lg font-semibold tabular-nums text-red-100">
                {showBalance ? formatCurrency(creditDebt) : 'KYD ••••••'}
              </div>
              <div className="mt-1 text-[11px] text-ink-400">
                Principal {showBalance ? formatCurrency(creditDebtPrincipal) : 'KYD •••'} + juros
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <div className="flex items-center gap-2 text-xs text-ink-300">
                <Activity className="h-4 w-4 text-emerald-200" /> Juros acumulados
              </div>
              <div className="mt-1 font-display text-lg font-semibold tabular-nums">
                {showBalance ? formatCurrency(interestAccrued) : 'KYD ••••••'}
              </div>
              <div className="mt-1 text-[11px] text-ink-400">
                Usado {showBalance ? formatCurrency(creditUsed) : 'KYD •••'}
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <div className="flex items-center gap-2 text-xs text-ink-300">
                <Percent className="h-4 w-4 text-amber-200" /> Taxa do crédito
              </div>
              <div className="mt-1 font-display text-lg font-semibold tabular-nums">
                {annualInterestRate.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}% a.a.
              </div>
              <div className="mt-1 text-[11px] text-ink-400">
                {monthlyInterestRate.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}% a.m. simples
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <button onClick={() => navigateToTab('deposit')} className="btn-secondary"><ArrowDownToLine className="h-4 w-4" /> Depositar</button>
            <button onClick={() => navigateToTab('withdraw')} className="btn-secondary"><ArrowUpFromLine className="h-4 w-4" /> Sacar</button>
            <button onClick={() => navigateToTab('transfer')} className="btn-primary"><ArrowRightLeft className="h-4 w-4" /> Transferir</button>
          </div>
        </motion.div>

        {/* Stats stack */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-1 gap-4">
          <div className="card-premium p-5 flex items-center gap-4">
            <div className="h-11 w-11 rounded-xl bg-emerald-400/15 text-emerald-300 inline-flex items-center justify-center">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs text-ink-300">Entradas</div>
              <div className="font-display text-lg font-semibold tabular-nums">{formatCurrency(stats.inflow)}</div>
            </div>
          </div>
          <div className="card-premium p-5 flex items-center gap-4">
            <div className="h-11 w-11 rounded-xl bg-red-400/15 text-red-300 inline-flex items-center justify-center">
              <TrendingDown className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs text-ink-300">Saídas</div>
              <div className="font-display text-lg font-semibold tabular-nums">{formatCurrency(stats.outflow)}</div>
            </div>
          </div>
          <div className="card-premium p-5 flex items-center gap-4">
            <div className="h-11 w-11 rounded-xl bg-bravus-400/15 text-bravus-200 inline-flex items-center justify-center">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs text-ink-300">Transações</div>
              <div className="font-display text-lg font-semibold tabular-nums">{stats.count}</div>
            </div>
          </div>
        </div>
      </div>

          <BankingAccessPanel
            user={user}
            me={me}
            profile={profile}
            modules={bankingModules}
            view={portalView}
            setView={setPortalView}
            activeModule={activeModule}
            onModuleClick={handleModuleClick}
          />
        </>
      ) : (
        <DedicatedPageHeader
          page={dedicatedPageMeta}
          accountNumber={me?.dadosBancarios?.contaFormatada || me?.accountNumber || accountNumber}
          onBack={() => navigate('/dashboard')}
        />
      )}

      {/* Alerts */}
      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-5">
            <div className="alert-error inline-flex items-center gap-2"><AlertCircle className="h-4 w-4" /> {error}</div>
          </motion.div>
        )}
        {success && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-5">
            <div className="alert-success inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> {success}</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tabs */}
      {isDashboardHome && (
        <div className="mt-8 flex flex-wrap gap-2">
        <Tab id="overview" label="Visão geral" icon={Wallet} />
        <Tab id="deposit" label="Depósito" icon={ArrowDownToLine} />
        <Tab id="withdraw" label="Saque" icon={ArrowUpFromLine} />
        <Tab id="transfer" label="Transferência" icon={ArrowRightLeft} />
        <Tab id="statements" label="Extratos" icon={FileText} />
        </div>
      )}

      {/* Content */}
      <div className="mt-6 min-w-0">
        {tab === 'overview' && (
          isDashboardHome ? (
            <div className="grid min-w-0 gap-6 lg:grid-cols-3">
            {/* Chart */}
            <div className="card-premium min-w-0 p-4 sm:p-6 lg:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="title-md">Movimentação · 7 dias</h3>
                  <p className="text-xs text-ink-400 mt-0.5">Saldo acumulado por dia</p>
                </div>
              </div>
              <div className="h-64 min-w-0 overflow-hidden">
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#eecb54" stopOpacity={0.5} />
                        <stop offset="100%" stopColor="#eecb54" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#ffffff10" vertical={false} />
                    <XAxis dataKey="label" stroke="#8a93ac" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#8a93ac" fontSize={12} tickLine={false} axisLine={false} width={50} />
                    <Tooltip
                      contentStyle={{ background: '#0b0f1c', border: '1px solid #ffffff20', borderRadius: 12 }}
                      labelStyle={{ color: '#fff' }}
                      formatter={(v) => [`KYD ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'Saldo']}
                    />
                    <Area type="monotone" dataKey="saldo" stroke="#eecb54" strokeWidth={2} fill="url(#g1)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Transactions list */}
            <div className="card-premium min-w-0 p-4 sm:p-6">
              <h3 className="title-md mb-4">Últimas transações</h3>
              {transactions.length === 0 ? (
                <p className="text-sm text-ink-300">Nenhuma transação ainda.</p>
              ) : (
                <ul className="space-y-3">
                  {transactions.slice(0, 8).map((t, idx) => {
                    return (
                      <TransactionListItem
                        key={t.id || idx}
                        tx={t}
                        openReceipt={openReceipt}
                        receiptLoading={receiptLoading}
                      />
                    );
                  })}
                </ul>
              )}
            </div>
            </div>
          ) : (
            <PortalModuleDetail
              module={activeModuleDefinition}
              activeModule={activeModule}
              pageRoute={MODULE_ROUTES[activeModule] || normalizedDashboardPath}
              transactions={transactions}
              externalOrders={externalOrders}
              creditSummary={creditSummary}
              showBalance={showBalance}
              openReceipt={openReceipt}
              receiptLoading={receiptLoading}
              openTransferMode={openTransferMode}
              setTab={navigateToTab}
              me={me}
            />
          )
        )}

        {tab === 'statements' && (
          <StatementExportPanel
            transactions={transactions}
            me={me}
            profile={profile}
            user={user}
            onSuccess={setSuccess}
            onError={setError}
          />
        )}

        {tab === 'profile' && (
          <UserProfilePanel user={user} profile={profile} me={me} />
        )}

        {tab === 'change-password' && (
          <UserPasswordChangePanel onSuccess={setSuccess} onError={setError} />
        )}

        {/* Forms */}
        {(tab === 'deposit' || tab === 'withdraw' || tab === 'transfer') && (
          <div className="card-premium p-6 max-w-3xl">
            <h3 className="title-md mb-1">
              {tab === 'deposit' ? 'Novo depósito' : tab === 'withdraw' ? 'Novo saque' : `Novo ${transferOperationLabel}`}
            </h3>
            <p className="text-sm text-ink-300 mb-5">
              {tab === 'transfer'
                ? activeModule === 'localCayman'
                  ? 'Transfira em KYD por ACH ou EFT entre bancos participantes nas Ilhas Cayman.'
                  : activeModule === 'internationalWire'
                    ? 'Envie uma ordem internacional por Wire/SWIFT e banco correspondente.'
                    : activeModule === 'remittance'
                      ? 'Solicite remessa ou câmbio pelo fluxo de Money Services Business sujeito à licença CIMA.'
                      : 'Transfira entre contas Bravus com liquidação interna no mesmo ledger.'
                : 'Operação em conta corrente.'}
            </p>

            <div className="space-y-4">
              {tab === 'transfer' && (
                <div>
                  <label className="form-label">Destino</label>
                  <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                    <button
                      type="button"
                      onClick={() => setForm({ ...EMPTY_FORM, amount: form.amount, description: form.description, transferMode: 'internal', channel: 'INTERNAL_BRAVUS', destinationNetwork: 'INTERNAL_BRAVUS' })}
                      className={cn(
                        'btn-secondary justify-center',
                        form.transferMode === 'internal' && '!bg-white/15 !text-white'
                      )}
                    >
                      <ArrowRightLeft className="h-4 w-4" /> Conta Bravus
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm({ ...EMPTY_FORM, amount: form.amount, description: form.description, transferMode: 'external', channel: 'ACH', destinationNetwork: 'CAYMAN_ACH' })}
                      className={cn(
                        'btn-secondary justify-center',
                        form.transferMode === 'external' && ['ACH', 'EFT'].includes(form.channel) && '!bg-white/15 !text-white'
                      )}
                    >
                      <Landmark className="h-4 w-4" /> Cayman
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm({ ...EMPTY_FORM, amount: form.amount, description: form.description, transferMode: 'external', channel: 'SWIFT', destinationNetwork: 'SWIFT' })}
                      className={cn('btn-secondary justify-center', form.transferMode === 'external' && ['SWIFT', 'WIRE'].includes(form.channel) && '!bg-white/15 !text-white')}
                    >
                      <Send className="h-4 w-4" /> Wire
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm({ ...EMPTY_FORM, amount: form.amount, description: form.description, transferMode: 'external', channel: 'MSB_REMITTANCE', destinationNetwork: 'CAYMAN_MSB' })}
                      className={cn('btn-secondary justify-center', form.transferMode === 'external' && ['MSB_REMITTANCE', 'MSB_FX'].includes(form.channel) && '!bg-white/15 !text-white')}
                    >
                      <Globe2 className="h-4 w-4" /> Remessa
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label className="form-label">Valor (KYD)</label>
                <input
                  type="number" step="0.01" min="0"
                  className="form-input"
                  placeholder="0,00"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                />
              </div>

              {tab === 'transfer' && form.transferMode === 'internal' && (
                <div>
                  <label className="form-label">Destino Bravus</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Conta, CPF, e-mail ou usuário Bravus"
                    value={form.destinationAccount}
                    onChange={(e) => setForm({ ...form, destinationAccount: e.target.value })}
                  />
                </div>
              )}

              {tab === 'transfer' && form.transferMode === 'external' && (
                <div className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="form-label">Canal</label>
                      <select
                        className="form-input"
                        value={form.channel}
                        onChange={(e) => {
                          const channel = e.target.value;
                          setForm({
                            ...form,
                            channel,
                            destinationNetwork: destinationNetworkForChannel(channel),
                          });
                        }}
                      >
                        <option value="ACH">ACH local Cayman</option>
                        <option value="EFT">EFT local Cayman</option>
                        <option value="SWIFT">Wire / SWIFT internacional</option>
                        <option value="WIRE">Wire internacional</option>
                        <option value="MSB_REMITTANCE">Remessa internacional (MSB)</option>
                        <option value="MSB_FX">Câmbio (MSB)</option>
                      </select>
                    </div>
                    <div>
                      <label className="form-label">Rede destino</label>
                      <input className="form-input" value={form.destinationNetwork} readOnly aria-readonly="true" />
                    </div>
                    <div>
                      <label className="form-label">Documento do beneficiário</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Documento ou identificação internacional"
                        value={form.beneficiaryDocument}
                        onChange={(e) => setForm({ ...form, beneficiaryDocument: e.target.value })}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="form-label">Nome do beneficiário</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Nome completo ou razão social"
                      value={form.beneficiaryName}
                      onChange={(e) => setForm({ ...form, beneficiaryName: e.target.value })}
                    />
                  </div>

                  <div className="grid sm:grid-cols-3 gap-4">
                      <div>
                        <label className="form-label">Banco</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="001"
                          value={form.bankCode}
                          onChange={(e) => setForm({ ...form, bankCode: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="form-label">Agência / branch</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="0001"
                          value={form.agency}
                          onChange={(e) => setForm({ ...form, agency: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="form-label">Conta</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="12345678"
                          value={form.accountNumber}
                          onChange={(e) => setForm({ ...form, accountNumber: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="form-label">Dígito</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="9"
                          value={form.accountDigit}
                          onChange={(e) => setForm({ ...form, accountDigit: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="form-label">Tipo de conta</label>
                        <select
                          className="form-input"
                          value={form.accountType}
                          onChange={(e) => setForm({ ...form, accountType: e.target.value })}
                        >
                          <option value="CORRENTE">Corrente</option>
                          <option value="POUPANCA">Poupança</option>
                          <option value="PAGAMENTO">Pagamento</option>
                        </select>
                      </div>
                      <div>
                        <label className="form-label">Código de roteamento / clearing</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="00000000"
                          value={form.ispb}
                          onChange={(e) => setForm({ ...form, ispb: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
              )}

              <div>
                <label className="form-label">Descrição (opcional)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ex: Pagamento aluguel"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>

              {tab === 'transfer' && (
                <TransferRecipientPreview
                  form={form}
                  resolvedRecipient={resolvedRecipient}
                  resolveLoading={resolveLoading}
                />
              )}

              <AnimatePresence>
                {tab === 'transfer' && accountReviewNotice && (
                  <motion.div
                    ref={accountReviewNoticeRef}
                    role="alert"
                    aria-live="assertive"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="rounded-xl border border-amber-300/35 bg-amber-300/[0.08] p-4"
                  >
                    <div className="flex items-start gap-3">
                      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
                      <div>
                        <h4 className="font-semibold text-white">Transferência temporariamente indisponível</h4>
                        <p className="mt-1 text-sm leading-6 text-ink-200">{accountReviewNotice}</p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <button
                disabled={submitting || (tab === 'transfer' && resolveLoading)}
                onClick={() => submit(tab)}
                className="btn-primary w-full"
              >
                {submitting ? 'Processando...' : (
                  tab === 'deposit' ? 'Confirmar depósito' :
                  tab === 'withdraw' ? 'Confirmar saque' : `Confirmar ${transferOperationLabel}`
                )}
              </button>

              {tab === 'transfer' && externalOrders.length > 0 && (
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                  <div className="text-sm font-semibold text-white mb-3">Ordens Bravus recentes</div>
                  <ul className="space-y-2">
                    {externalOrders.slice(0, 4).map((order) => (
                      <li key={order.id} className="flex flex-col items-stretch gap-2 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                        <span className="min-w-0 truncate text-ink-200">
                          {order.channel} · {order.beneficiaryName}
                        </span>
                        <span className="shrink-0 text-ink-300">{formatCurrency(order.amountCentavos)} - {order.settlementStatus || order.status}</span>
                        <button
                          type="button"
                          className="btn-secondary w-full justify-center !py-1.5 !px-2.5 sm:w-auto"
                          disabled={receiptLoading === order.id}
                          onClick={() => openReceipt(order.id)}
                        >
                          <Receipt className="h-4 w-4" />
                          Comprovante
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {selectedReceipt && (
          <motion.div
            className="fixed inset-0 z-50 overflow-y-auto bg-black/70 px-3 py-4 sm:px-4 sm:py-6"
            data-testid="receipt-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="mx-auto min-h-full w-full max-w-3xl py-2 sm:flex sm:items-center"
              initial={{ scale: 0.96, y: 12 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 12 }}
            >
              <div
                className="max-h-[calc(100vh-4rem)] w-full overflow-y-auto rounded-xl border border-slate-300 bg-white p-4 text-black shadow-2xl [&_.receipt-block-title]:text-black [&_.receipt-block]:border-slate-200 [&_.receipt-block]:bg-slate-50 [&_.receipt-line-label]:text-black [&_.receipt-line-value]:text-black [&_.receipt-line]:border-slate-200 sm:max-h-[calc(100vh-3rem)] sm:p-6"
                data-testid="receipt-modal-paper"
              >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <img
                    src={BRAVUS_FULL_LOGO_SRC}
                    alt="Bravus Bank"
                    className="mb-4 h-16 w-auto object-contain"
                  />
                  <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-black">
                    <Receipt className="h-3.5 w-3.5" />
                    Comprovante Bravus
                  </div>
                  <h3 className="font-display text-2xl font-semibold text-black">{formatCurrency(selectedReceipt.amountCentavos)}</h3>
                  <p className="mt-1 text-sm text-black">
                    {displayTransferChannel(selectedReceipt.channel)} · {selectedReceipt.status} · {selectedReceipt.settlementStatus}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-black transition hover:bg-slate-100 disabled:cursor-wait disabled:opacity-60"
                    onClick={downloadReceipt}
                    disabled={Boolean(receiptAction)}
                  >
                    <Download className="h-4 w-4" />
                    {receiptAction === 'download' ? 'Salvando...' : 'Baixar'}
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-black transition hover:bg-slate-100 disabled:cursor-wait disabled:opacity-60"
                    onClick={shareReceipt}
                    disabled={Boolean(receiptAction)}
                  >
                    <Share2 className="h-4 w-4" />
                    {receiptAction === 'share' ? 'Abrindo...' : 'Compartilhar'}
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-black transition hover:bg-slate-100"
                    onClick={() => setSelectedReceipt(null)}
                  >
                    Fechar
                  </button>
                </div>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <ReceiptBlock title="Pagador" party={selectedReceipt.payer} />
                <ReceiptBlock title="Recebedor" party={selectedReceipt.beneficiary} />
              </div>

              <div className="receipt-block mt-5 rounded-xl border border-slate-200 bg-white p-4 text-sm">
                <ReceiptLine label="Comprovante" value={selectedReceipt.receiptId} />
                <ReceiptLine label="Tipo" value={selectedReceipt.receiptKind} />
                <ReceiptLine label="Transação" value={selectedReceipt.transactionId} />
                <ReceiptLine label="Provedor" value={selectedReceipt.provider} />
                <ReceiptLine label="ID provedor" value={selectedReceipt.providerTransferId} />
                <ReceiptLine label="Rede destino" value={selectedReceipt.destinationNetwork} />
                <ReceiptLine label="Participante" value={selectedReceipt.destinationParticipantCode} />
                <ReceiptLine label="Confirmacao destino" value={selectedReceipt.destinationConfirmationId} />
                <ReceiptLine label="Confirmado em" value={formatDate(selectedReceipt.destinationConfirmedAt)} />
                <ReceiptLine label="Liquidacao" value={selectedReceipt.settlementMessage} />
                <ReceiptLine label="Idempotência" value={selectedReceipt.idempotencyKey} />
                <ReceiptLine label="Data" value={formatDate(selectedReceipt.createdAt)} />
                <ReceiptLine label="Descrição" value={selectedReceipt.description || 'Transferência Bravus'} />
              </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

function UserProfilePanel({ user, profile, me }) {
  const bank = me?.dadosBancarios || {};
  const fields = [
    ['Nome completo', profile?.fullName || user?.fullName || '-'],
    ['CPF', profile?.cpf || user?.cpf || me?.cpf || '-'],
    ['E-mail', profile?.email || user?.email || '-'],
    ['Telefone', profile?.phone || user?.phone || '-'],
    ['Agência', bank.agencia || profile?.agencia || '0001'],
    ['Conta', bank.contaFormatada || bank.conta || profile?.accountNumber || '-'],
    ['Tipo de conta', bank.tipoConta || profile?.accountType || 'CORRENTE'],
    ['Status', profile?.active === false ? 'Bloqueada' : 'Ativa'],
  ];

  return (
    <section className="card-premium max-w-4xl overflow-hidden">
      <div className="border-b border-white/10 px-5 py-5 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-amber-300/15 text-amber-200">
            <User className="h-5 w-5" />
          </span>
          <div>
            <h2 className="title-md">Dados do perfil</h2>
            <p className="mt-1 text-sm text-ink-400">Informações vinculadas à sua conta Bravus.</p>
          </div>
        </div>
      </div>
      <dl className="grid sm:grid-cols-2">
        {fields.map(([label, value]) => (
          <div key={label} className="min-w-0 border-b border-white/10 px-5 py-4 sm:px-6 sm:odd:border-r">
            <dt className="text-xs uppercase tracking-[0.14em] text-ink-400">{label}</dt>
            <dd className="mt-1 break-words text-sm font-medium text-white">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function UserPasswordChangePanel({ onSuccess, onError }) {
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirmation: '' });
  const [submitting, setSubmitting] = useState(false);
  const strongPassword = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,128}$/;

  const updatePassword = (field, value) => setPasswords((current) => ({ ...current, [field]: value }));

  const submitPasswordChange = async (event) => {
    event.preventDefault();
    onError('');
    onSuccess('');
    if (!passwords.currentPassword) {
      onError('Informe sua senha atual.');
      return;
    }
    if (!strongPassword.test(passwords.newPassword)) {
      onError('A nova senha deve ter no mínimo 8 caracteres, com letra maiúscula, minúscula e número.');
      return;
    }
    if (passwords.newPassword !== passwords.confirmation) {
      onError('A confirmação da nova senha não confere.');
      return;
    }
    try {
      setSubmitting(true);
      await userService.changePassword({
        currentPassword: passwords.currentPassword,
        newPassword: passwords.newPassword,
      });
      setPasswords({ currentPassword: '', newPassword: '', confirmation: '' });
      onSuccess('Senha alterada com segurança. As outras sessões da conta foram encerradas.');
    } catch (err) {
      onError(operationErrorMessage(err, 'Não foi possível alterar a senha.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="card-premium max-w-2xl p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-amber-300/15 text-amber-200">
          <KeyRound className="h-5 w-5" />
        </span>
        <div>
          <h2 className="title-md">Trocar senha</h2>
          <p className="mt-1 text-sm text-ink-400">Confirme a senha atual e defina uma nova senha forte.</p>
        </div>
      </div>

      <form className="mt-6 space-y-4" onSubmit={submitPasswordChange}>
        <div>
          <label className="form-label" htmlFor="current-password">Senha atual</label>
          <input
            id="current-password"
            type="password"
            autoComplete="current-password"
            className="form-input"
            value={passwords.currentPassword}
            onChange={(event) => updatePassword('currentPassword', event.target.value)}
            maxLength={128}
            required
          />
        </div>
        <div>
          <label className="form-label" htmlFor="new-password">Nova senha</label>
          <input
            id="new-password"
            type="password"
            autoComplete="new-password"
            className="form-input"
            value={passwords.newPassword}
            onChange={(event) => updatePassword('newPassword', event.target.value)}
            minLength={8}
            maxLength={128}
            required
          />
          <p className="mt-2 text-xs text-ink-400">Use 8 ou mais caracteres, com maiúscula, minúscula e número.</p>
        </div>
        <div>
          <label className="form-label" htmlFor="confirm-password">Confirmar nova senha</label>
          <input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            className="form-input"
            value={passwords.confirmation}
            onChange={(event) => updatePassword('confirmation', event.target.value)}
            minLength={8}
            maxLength={128}
            required
          />
        </div>
        <button type="submit" className="btn-primary w-full justify-center" disabled={submitting}>
          <KeyRound className="h-4 w-4" />
          {submitting ? 'Alterando senha...' : 'Alterar senha'}
        </button>
      </form>
    </section>
  );
}

function DedicatedPageHeader({ page, accountNumber, onBack }) {
  const Icon = page?.Icon || Wallet;

  return (
    <section className="flex min-w-0 items-center gap-4 border-b border-white/10 pb-5">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.05] text-ink-100 transition hover:bg-white/[0.1]"
        aria-label="Voltar para Minha Conta"
        title="Voltar para Minha Conta"
      >
        <ArrowLeft className="h-5 w-5" />
      </button>
      <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-gold text-[#05122f]">
        <Icon className="h-6 w-6" />
      </span>
      <div className="min-w-0">
        <div className="text-xs uppercase tracking-[0.2em] text-amber-300/80">Página bancária</div>
        <h1 className="mt-1 truncate font-display text-2xl font-semibold text-white">{page?.label || 'Minha Conta'}</h1>
        <div className="mt-1 truncate text-xs font-mono text-ink-400">Conta {accountNumber || '-'}</div>
      </div>
    </section>
  );
}

function BankingAccessPanel({
  user, me, profile, modules, view, setView, activeModule, onModuleClick,
}) {
  const account = me?.dadosBancarios || {};
  const companyName = profile?.fullName || user?.fullName || user?.username || 'Cliente Bravus';
  const document = profile?.cpf || user?.cpf || me?.cpf;

  return (
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
      <div className="grid lg:grid-cols-[1fr_auto] gap-4 border-b border-white/10 bg-white/[0.06] px-5 py-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-amber-300/80">
            <Building2 className="h-4 w-4" />
            Acesso bancario
          </div>
          <div className="mt-3 text-2xl font-display font-semibold">
            Ola, <span className="text-amber-200">{companyName}</span>
          </div>
          <div className="mt-3 grid gap-1 text-sm text-ink-300 sm:grid-cols-2 lg:grid-cols-4">
            <span>Banco {account.codigoBanco || profile?.codigoBanco || '999'}</span>
            <span>Agencia {account.agencia || profile?.agencia || '0001'}</span>
            <span>Conta {account.contaFormatada || account.conta || profile?.accountNumber || '-'}</span>
            <span>CPF/CNPJ {document || '-'}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start rounded-xl border border-white/10 bg-black/20 p-1">
          <button
            type="button"
            className={cn('inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm transition',
              view === 'list' ? 'bg-white/12 text-white' : 'text-ink-300 hover:text-white')}
            onClick={() => setView('list')}
          >
            <List className="h-4 w-4" />
            Lista
          </button>
          <button
            type="button"
            className={cn('inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm transition',
              view === 'icons' ? 'bg-gradient-gold text-[#05122f]' : 'text-ink-300 hover:text-white')}
            onClick={() => setView('icons')}
          >
            <Grid3X3 className="h-4 w-4" />
            Icones
          </button>
        </div>
      </div>

      <div className="p-5">
        {view === 'icons' ? (
          <div className="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 lg:grid-cols-8">
            {modules.map((module) => (
              <ModuleIconButton
                key={module.id}
                module={module}
                active={module.id === activeModule}
                onClick={() => onModuleClick(module.id)}
              />
            ))}
          </div>
        ) : (
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            {modules.map((module) => (
              <ModuleListButton
                key={module.id}
                module={module}
                active={module.id === activeModule}
                onClick={() => onModuleClick(module.id)}
              />
            ))}
          </div>
        )}

      </div>
    </section>
  );
}

function ModuleIconButton({ module, active, onClick }) {
  const Icon = module.Icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-h-[138px] flex-col items-center text-center"
    >
      <span className={cn(
        'inline-flex h-16 w-16 items-center justify-center rounded-full border shadow-lg transition',
        active || module.accent
          ? 'border-amber-300/40 bg-gradient-gold text-[#05122f] shadow-amber-500/20'
          : 'border-white/10 bg-white/[0.07] text-amber-200 group-hover:bg-white/[0.12]'
      )}>
        <Icon className="h-7 w-7" />
      </span>
      <span className="mt-3 flex min-h-[34px] max-w-[104px] items-center justify-center text-xs font-semibold leading-tight text-ink-100">
        {module.label}
      </span>
      <span className="mt-1 max-w-[112px] truncate text-[11px] text-ink-400">{module.badge}</span>
    </button>
  );
}

function ModuleListButton({ module, active, onClick }) {
  const Icon = module.Icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex min-h-[68px] items-center gap-3 rounded-xl border px-3 text-left transition',
        active
          ? 'border-amber-300/40 bg-amber-300/12'
          : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.07]'
      )}
    >
      <span className={cn(
        'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full',
        active || module.accent ? 'bg-gradient-gold text-[#05122f]' : 'bg-white/[0.08] text-amber-200'
      )}>
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-ink-100">{module.label}</span>
        <span className="block truncate text-xs text-ink-400">{module.badge}</span>
      </span>
    </button>
  );
}

function PortalModuleDetail({
  module, activeModule, pageRoute, transactions, externalOrders, creditSummary, showBalance,
  openReceipt, receiptLoading, openTransferMode, setTab, me,
}) {
  const latestTx = transactions.slice(0, 4);
  const latestOrders = externalOrders.slice(0, 4);
  const moduleMetrics = {
    localCayman: [
      { label: 'Canal', value: 'ACH / EFT' },
      { label: 'Ordens', value: `${externalOrders.length}` },
      { label: 'Página', value: 'Transferência Cayman' },
    ],
    internationalWire: [
      { label: 'Canal', value: 'Wire / SWIFT' },
      { label: 'Liquidação', value: 'Banco correspondente' },
      { label: 'Página', value: 'Wire internacional' },
    ],
    remittance: [
      { label: 'Serviço', value: 'Remessa / câmbio' },
      { label: 'Regulador', value: 'CIMA' },
      { label: 'Página', value: 'Money Services Business' },
    ],
    transfers: [
      { label: 'Destino', value: 'Bravus' },
      { label: 'Liquidação', value: 'Interna' },
      { label: 'Pagina', value: 'Transferencias' },
    ],
    dda: [
      { label: 'Registrados', value: '0' },
      { label: 'Pendentes', value: module?.badge || '0 pendentes' },
      { label: 'Pagina', value: 'DDA' },
    ],
    cards: [
      { label: 'Conta', value: module?.badge || 'Ativa' },
      { label: 'Bandeira', value: 'Bravus' },
      { label: 'Pagina', value: 'Cartoes' },
    ],
    'deposit-check': [
      { label: 'Canal', value: 'Digital' },
      { label: 'Status', value: module?.badge || 'Ativo' },
      { label: 'Pagina', value: 'Deposito de Cheque' },
    ],
    checks: [
      { label: 'Folhas', value: module?.badge || '0 folhas' },
      { label: 'Conta', value: me?.dadosBancarios?.contaFormatada || me?.accountNumber || '-' },
      { label: 'Pagina', value: 'Cheques' },
    ],
    schedules: [
      { label: 'Hoje', value: module?.badge || '0 hoje' },
      { label: 'Conta', value: me?.dadosBancarios?.contaFormatada || me?.accountNumber || '-' },
      { label: 'Pagina', value: 'Agendamentos' },
    ],
    investments: [
      { label: 'Carteira', value: module?.badge || 'Ativa' },
      { label: 'Moeda', value: 'KYD' },
      { label: 'Pagina', value: 'Investimentos' },
    ],
    pending: [
      { label: 'KYC', value: module?.badge || 'Conta' },
      { label: 'Documento', value: me?.cpf || '-' },
      { label: 'Pagina', value: 'Pendencias' },
    ],
    beneficiaries: [
      { label: 'Recentes', value: `${externalOrders.length}` },
      { label: 'Conta', value: me?.dadosBancarios?.contaFormatada || me?.accountNumber || '-' },
      { label: 'Pagina', value: 'Favorecidos' },
    ],
    limits: [
      { label: 'Transferência diária', value: showBalance ? formatCurrency(me?.saldos?.limiteTransferenciaDiarioCentavos ?? me?.saldos?.limitePixDiarioCentavos ?? 0) : 'KYD ******' },
      { label: 'Conta', value: me?.dadosBancarios?.contaFormatada || me?.accountNumber || '-' },
      { label: 'Pagina', value: 'Limites' },
    ],
    security: [
      { label: 'Status', value: module?.badge || 'Ativa' },
      { label: 'KYC', value: me?.conta?.statusKyc || 'Conta' },
      { label: 'Pagina', value: 'Seguranca' },
    ],
  };

  return (
    <div className="mt-6 rounded-xl border border-white/10 bg-black/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-widest text-ink-400">Pagina bancaria</div>
          <div className="mt-1 text-lg font-display font-semibold text-white">{module?.label}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          {activeModule === 'balances' && (
            <button type="button" className="btn-primary !py-2 !px-3" onClick={() => setTab('statements')}>
              <Download className="h-4 w-4" />
              Extratos
            </button>
          )}
          {activeModule === 'localCayman' && (
            <button
              type="button"
              className="btn-primary !py-2 !px-3"
              onClick={() => openTransferMode('external', 'ACH', '/dashboard/transferencia-cayman')}
            >
              <Landmark className="h-4 w-4" />
              Transferir
            </button>
          )}
          {activeModule === 'internationalWire' && (
            <button type="button" className="btn-primary !py-2 !px-3" onClick={() => openTransferMode('external', 'SWIFT', '/dashboard/wire-internacional')}>
              <Send className="h-4 w-4" /> Wire
            </button>
          )}
          {activeModule === 'remittance' && (
            <button type="button" className="btn-primary !py-2 !px-3" onClick={() => openTransferMode('external', 'MSB_REMITTANCE', '/dashboard/remessas-cambio')}>
              <Globe2 className="h-4 w-4" /> Solicitar
            </button>
          )}
          {activeModule === 'transfers' && (
            <>
              <button type="button" className="btn-secondary !py-2 !px-3" onClick={() => openTransferMode('internal', 'INTERNAL_BRAVUS', '/dashboard/transferencias')}>Bravus</button>
              <button type="button" className="btn-primary !py-2 !px-3" onClick={() => openTransferMode('external', 'ACH', '/dashboard/transferencia-cayman')}>Cayman</button>
            </>
          )}
          {activeModule === 'deposit-check' && (
            <button type="button" className="btn-primary !py-2 !px-3" onClick={() => setTab('deposit')}>
              <ArrowDownToLine className="h-4 w-4" />
              Depositar
            </button>
          )}
        </div>
      </div>

      {activeModule === 'balances' && (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <div className="text-xs text-ink-400">Ultimas movimentacoes</div>
            <div className="mt-3 space-y-2">
              {latestTx.length === 0 && <div className="text-sm text-ink-400">Sem movimentacoes recentes.</div>}
              {latestTx.map((tx) => (
                <TransactionCompactLine
                  key={tx.id}
                  tx={tx}
                  showBalance={showBalance}
                  openReceipt={openReceipt}
                  receiptLoading={receiptLoading}
                />
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <div className="text-xs text-ink-400">Conta</div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <ReceiptLine label="Banco" value={me?.dadosBancarios?.nomeBanco || 'Bravus Premium Bank'} />
              <ReceiptLine label="Agencia" value={me?.dadosBancarios?.agencia} />
              <ReceiptLine label="Conta" value={me?.dadosBancarios?.contaFormatada || me?.accountNumber} />
              <ReceiptLine label="Tipo" value={me?.dadosBancarios?.tipoConta || me?.accountType} />
            </div>
          </div>
        </div>
      )}

      {activeModule === 'credit' && (
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <Metric label="Credito disponivel" value={showBalance ? formatCurrency(creditSummary?.creditoDisponivelCentavos ?? 0) : 'KYD ******'} />
          <Metric label="Divida total" value={showBalance ? formatCurrency(creditSummary?.dividaTotalCentavos ?? 0) : 'KYD ******'} />
          <Metric label="Taxa anual" value={`${Number(creditSummary?.taxaJurosAnualMedia ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`} />
        </div>
      )}

      {activeModule === 'receipts' && (
        <div className="mt-4 space-y-2">
          {latestOrders.length === 0 && <div className="text-sm text-ink-400">Nenhum comprovante externo recente.</div>}
          {latestOrders.map((order) => (
            <div key={order.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm">
              <span className="min-w-0 truncate text-ink-200">#{order.id} {order.channel} - {order.beneficiaryName}</span>
              <span className="text-xs text-ink-400">{order.settlementStatus || order.status}</span>
              <button
                type="button"
                className="btn-secondary !py-1.5 !px-2.5"
                disabled={receiptLoading === order.id}
                onClick={() => openReceipt(order.id)}
              >
                <Receipt className="h-4 w-4" />
                Abrir
              </button>
            </div>
          ))}
        </div>
      )}

      {!['balances', 'credit', 'receipts'].includes(activeModule) && (
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {(moduleMetrics[activeModule] || [
            { label: 'Status', value: module?.badge || 'Ativo' },
            { label: 'Conta', value: me?.dadosBancarios?.contaFormatada || me?.accountNumber || '-' },
            { label: 'Pagina', value: module?.label || pageRoute },
          ]).map((metric) => (
            <Metric key={metric.label} label={metric.label} value={metric.value} />
          ))}
        </div>
      )}
    </div>
  );
}

function StatementExportPanel({ transactions, me, profile, user, onSuccess, onError }) {
  const monthOptions = useMemo(() => {
    const keys = Array.from(new Set(transactions.map((tx) => monthKeyForDate(tx.createdAt || tx.date))));
    if (keys.length === 0) keys.push(monthKeyForDate(new Date().toISOString()));
    return keys
      .sort((a, b) => b.localeCompare(a))
      .slice(0, 18)
      .map((key) => ({
        key,
        label: monthLabel(key),
        count: transactions.filter((tx) => monthKeyForDate(tx.createdAt || tx.date) === key).length,
      }));
  }, [transactions]);
  const [selectedMonths, setSelectedMonths] = useState(() => monthOptions[0]?.key ? [monthOptions[0].key] : []);

  useEffect(() => {
    if (selectedMonths.length === 0 && monthOptions[0]?.key) {
      setSelectedMonths([monthOptions[0].key]);
    }
  }, [monthOptions, selectedMonths.length]);

  const selectedSet = new Set(selectedMonths);
  const selectedTransactions = transactions.filter((tx) => selectedSet.has(monthKeyForDate(tx.createdAt || tx.date)));
  const selectedInflow = selectedTransactions.filter((tx) => isCreditTransaction(tx.type)).reduce((acc, tx) => acc + (tx.amount || 0), 0);
  const selectedOutflow = selectedTransactions.filter((tx) => !isCreditTransaction(tx.type)).reduce((acc, tx) => acc + (tx.amount || 0), 0);

  const toggleMonth = (key) => {
    setSelectedMonths((current) => {
      if (current.includes(key)) return current.filter((item) => item !== key);
      return [...current, key].sort((a, b) => b.localeCompare(a));
    });
  };

  const buildDocument = () => buildStatementDocument({
    months: selectedMonths.length ? selectedMonths.slice().sort() : [monthOptions[0]?.key].filter(Boolean),
    transactions,
    me,
    profile,
    user,
  });

  const downloadStatement = () => {
    if (selectedMonths.length === 0) return onError('Selecione pelo menos um mes para baixar o extrato.');
    const document = buildDocument();
    downloadHtmlDocument(document);
    onSuccess('Extrato baixado com a logo completa do Bravus Bank.');
  };

  const shareStatement = async () => {
    if (selectedMonths.length === 0) return onError('Selecione pelo menos um mes para compartilhar o extrato.');
    const document = buildDocument();
    try {
      const message = await shareHtmlDocument({
        ...document,
        title: 'Extrato Bravus Bank',
      });
      onSuccess(message);
    } catch (err) {
      if (err?.name !== 'AbortError') onError('Nao foi possivel compartilhar o extrato.');
    }
  };

  return (
    <div className="card-premium p-6" data-testid="statement-export-panel">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <img src={BRAVUS_FULL_LOGO_SRC} alt="Bravus Bank" className="h-14 w-auto object-contain" />
            <div>
              <h3 className="title-md">Extratos Bravus Bank</h3>
              <p className="mt-1 text-sm text-ink-300">Selecione um ou mais meses para baixar ou compartilhar.</p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-secondary !py-2 !px-3" onClick={() => setSelectedMonths(monthOptions.map((option) => option.key))}>
            Todos
          </button>
          <button type="button" className="btn-secondary !py-2 !px-3" onClick={() => setSelectedMonths([])}>
            Limpar
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {monthOptions.map((option) => (
          <label
            key={option.key}
            className={cn(
              'flex cursor-pointer items-center justify-between gap-3 rounded-xl border p-4 transition',
              selectedMonths.includes(option.key)
                ? 'border-amber-300/50 bg-amber-300/10'
                : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'
            )}
          >
            <span>
              <span className="block text-sm font-semibold text-white">{option.label}</span>
              <span className="block text-xs text-ink-400">{option.count} movimentacoes</span>
            </span>
            <input
              type="checkbox"
              className="h-5 w-5 accent-amber-300"
              checked={selectedMonths.includes(option.key)}
              onChange={() => toggleMonth(option.key)}
            />
          </label>
        ))}
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <Metric label="Meses selecionados" value={String(selectedMonths.length)} />
        <Metric label="Entradas no periodo" value={formatCurrency(selectedInflow)} />
        <Metric label="Saidas no periodo" value={formatCurrency(selectedOutflow)} />
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <button type="button" className="btn-primary" onClick={downloadStatement}>
          <Download className="h-4 w-4" />
          Baixar extrato
        </button>
        <button type="button" className="btn-secondary" onClick={shareStatement}>
          <Share2 className="h-4 w-4" />
          Compartilhar extrato
        </button>
      </div>
    </div>
  );
}

function TransactionListItem({ tx, openReceipt, receiptLoading }) {
  const { Icon, color, bg } = txIcon(tx.type);
  const counterparty = transactionCounterparty(tx);
  const receiptOrderId = receiptIdForTransaction(tx);

  return (
    <li className="flex items-start gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3">
      <div className={cn('mt-0.5 h-9 w-9 shrink-0 rounded-lg inline-flex items-center justify-center', bg)}>
        <Icon className={cn('h-4 w-4', color)} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-white">{getTransactionTypeLabel(tx.type)}</div>
            {counterparty.name && (
              <div className="truncate text-xs text-ink-200">
                {counterparty.label}: {counterparty.name}
              </div>
            )}
            {counterparty.detail && (
              <div className="truncate text-[11px] text-ink-400">{counterparty.detail}</div>
            )}
            <div className="text-[11px] text-ink-500">{formatDate(tx.createdAt || tx.date)}</div>
          </div>
          <div className={cn('shrink-0 text-sm font-medium tabular-nums', txSignClass(tx.type))}>
            {txSign(tx.type)} {formatCurrency(tx.amount)}
          </div>
        </div>
        {receiptOrderId && (
          <button
            type="button"
            className="btn-secondary mt-2 !py-1.5 !px-2.5 text-xs"
            disabled={receiptLoading === receiptOrderId}
            onClick={() => openReceipt(receiptOrderId)}
          >
            <Receipt className="h-3.5 w-3.5" />
            Comprovante
          </button>
        )}
      </div>
    </li>
  );
}

function TransactionCompactLine({ tx, showBalance, openReceipt, receiptLoading }) {
  const counterparty = transactionCounterparty(tx);
  const receiptOrderId = receiptIdForTransaction(tx);

  return (
    <div className="rounded-lg border border-white/5 bg-black/15 p-3 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-ink-100">{getTransactionTypeLabel(tx.type)}</div>
          {counterparty.name && (
            <div className="truncate text-xs text-ink-300">{counterparty.label}: {counterparty.name}</div>
          )}
          {counterparty.detail && (
            <div className="truncate text-[11px] text-ink-500">{counterparty.detail}</div>
          )}
        </div>
        <span className={cn('shrink-0 font-mono', txSignClass(tx.type))}>
          {txSign(tx.type)} {showBalance ? formatCurrency(tx.amount) : 'KYD ******'}
        </span>
      </div>
      {receiptOrderId && (
        <button
          type="button"
          className="btn-secondary mt-2 !py-1 !px-2 text-xs"
          disabled={receiptLoading === receiptOrderId}
          onClick={() => openReceipt(receiptOrderId)}
        >
          <Receipt className="h-3.5 w-3.5" />
          Comprovante
        </button>
      )}
    </div>
  );
}

function TransferRecipientPreview({ form, resolvedRecipient, resolveLoading }) {
  const internalDestination = form.transferMode === 'internal';
  if (internalDestination) {
    const destination = form.destinationAccount.trim();
    if (!destination) return null;
    const name = resolvedRecipient?.name || resolvedRecipient?.fullName;
    const detail = resolvedRecipient
      ? [
          resolvedRecipient.document && `Doc ${resolvedRecipient.document}`,
          resolvedRecipient.accountNumber && `Conta ${resolvedRecipient.accountNumber}`,
          resolvedRecipient.bankName || 'Bravus Premium Bank',
        ].filter(Boolean).join(' | ')
      : `Conta ou identificador informado: ${destination}`;

    return (
      <div className="rounded-xl border border-amber-300/20 bg-amber-300/[0.06] p-4 text-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="font-semibold text-white">Recebedor Bravus</div>
            <div className="mt-1 text-ink-200">
              {resolveLoading ? 'Consultando destinatario...' : name || 'Destinatario ainda nao localizado'}
            </div>
            <div className="mt-1 text-xs text-ink-400">{detail}</div>
          </div>
          <span className={resolvedRecipient ? 'pill-green' : 'pill-gold'}>
            {resolvedRecipient ? 'Localizado' : 'Validar'}
          </span>
        </div>
      </div>
    );
  }

  const hasExternalData =
    form.beneficiaryName || form.beneficiaryDocument || form.pixKey || form.accountNumber || form.bankCode;
  if (!hasExternalData) return null;

  const account = [form.bankCode, form.agency, form.accountNumber, form.accountDigit].filter(Boolean).join(' / ');

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm">
      <div className="font-semibold text-white">Recebedor informado</div>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <ReceiptLine label="Nome" value={form.beneficiaryName} />
        <ReceiptLine label="Documento" value={form.beneficiaryDocument} />
        <ReceiptLine label="Canal" value={form.channel} />
        <ReceiptLine label="Destino" value={account} />
      </div>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="text-xs uppercase tracking-widest text-ink-400">{label}</div>
      <div className="mt-2 truncate font-display text-lg font-semibold text-white">{value || '-'}</div>
    </div>
  );
}

function ReceiptBlock({ title, party }) {
  return (
    <div className="receipt-block rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm">
      <div className="receipt-block-title mb-3 font-semibold text-white">{title}</div>
      <ReceiptLine label="Nome" value={party?.name} />
      <ReceiptLine label="Documento" value={party?.document} />
      <ReceiptLine label="Banco" value={party?.bankName || party?.bankCode} />
      <ReceiptLine label="Código" value={party?.bankCode} />
      <ReceiptLine label="ISPB" value={party?.ispb} />
      <ReceiptLine label="Agência" value={party?.agency} />
      <ReceiptLine label="Conta" value={[party?.accountNumber, party?.accountDigit].filter(Boolean).join('-')} />
      <ReceiptLine label="Tipo" value={party?.accountType} />
    </div>
  );
}

function ReceiptLine({ label, value }) {
  return (
    <div className="receipt-line flex items-start justify-between gap-3 border-b border-white/5 py-1.5 last:border-0">
      <span className="receipt-line-label text-ink-400">{label}</span>
      <span className="receipt-line-value max-w-[65%] break-words text-right font-mono text-ink-100">{value || '-'}</span>
    </div>
  );
}
