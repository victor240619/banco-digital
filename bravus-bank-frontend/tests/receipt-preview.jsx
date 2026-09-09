import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Download, Share2 } from 'lucide-react';
import ReceiptModal from '../src/components/ReceiptModal.jsx';
import CurrencyExchangePanel from '../src/components/CurrencyExchangePanel.jsx';
import ReceiptPaper from '../src/components/ReceiptPaper.jsx';
import { buildReceiptModel } from '../src/lib/receiptModel.js';
import { buildReceiptDocument } from '../src/lib/receiptDocument.jsx';
import { receiptFixture } from '../../.openai/receipt-fixture.mjs';
import '../src/index.css';

function Preview() {
  const [receipt, setReceipt] = useState(null);
  const [message, setMessage] = useState('');
  const [mode, setMode] = useState('receipt');
  const [width, setWidth] = useState(426);
  const [errors, setErrors] = useState([]);
  React.useEffect(() => {
    const report = (event) => setErrors((old) => [...old, event.message || event.reason?.message || String(event.reason)]);
    window.addEventListener('error', report); window.addEventListener('unhandledrejection', report);
    return () => { window.removeEventListener('error', report); window.removeEventListener('unhandledrejection', report); };
  }, []);
  const pdf = async () => {
    try {
      const document = await buildReceiptDocument(receiptFixture);
      const result = await fetch('/test-pdf', { method: 'POST', body: document.pdf });
      if (!result.ok) throw Error('PDF validation save failed');
      setMessage('PDF de teste gerado');
    } catch (error) { setMessage('Erro PDF: ' + error.message); }
  };
  return <div style={{ padding: 16, background: '#edf0f5', minHeight: '100vh', color: '#08132c' }}>
    <p>TESTE ISOLADO - DADOS FICTÍCIOS</p>
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', margin: '12px 0 20px' }}>
      <button onClick={() => setMode('receipt')}>Modelo do comprovante</button>
      <button onClick={() => setReceipt(receiptFixture)}>Abrir comprovante</button>
      <button onClick={() => setReceipt({ ...receiptFixture, status: 'PENDING', settlementStatus: 'AGUARDANDO_CONFIRMACAO_MANUAL', channel: 'SWIFT' })}>Comprovante pendente</button>
      <button onClick={() => setMode('exchange')}>Câmbio</button>
      <button onClick={() => setWidth(320)}>Largura 320</button>
      <button onClick={() => setWidth(426)}>Largura 426</button>
      <button onClick={pdf}>Validar PDF</button>
      <a href="/test-pdf" target="_blank">Visualizar PDF</a>
    </div>
    <p role="status">{message}</p><p>Erros de execução: {errors.length}</p>{errors.map((error, i) => <p key={i}>{error}</p>)}
    {mode === 'receipt' ? <div style={{ width: '100%', maxWidth: width, margin: 'auto' }}><ReceiptPaper model={buildReceiptModel(receiptFixture)}>
      <div className="vantyx-receipt-actions"><button className="vantyx-receipt-action" onClick={() => setReceipt(receiptFixture)}><Share2 size={20} />Compartilhar</button><button className="vantyx-receipt-action secondary" onClick={pdf}><Download size={20} />Baixar PDF</button></div>
    </ReceiptPaper></div> : <CurrencyExchangePanel />}
    {receipt && <ReceiptModal receipt={receipt} onClose={() => setReceipt(null)} />}
  </div>;
}
const previewRoot = import.meta.hot?.data.previewRoot || createRoot(document.getElementById('root'));
if (import.meta.hot) import.meta.hot.data.previewRoot = previewRoot;
previewRoot.render(<Preview />);
