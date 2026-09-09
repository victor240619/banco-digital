import React from 'react';
import { CheckCircle2, Clock3, CircleAlert, Info, X } from 'lucide-react';
import { RECEIPT_LOGO } from '../lib/receiptModel';
import './receipt.css';

export const receiptStatusIcon = (kind) => ({ success: CheckCircle2, pending: Clock3, error: CircleAlert, info: Info }[kind] || Info);

export default function ReceiptPaper({ model, onClose, children }) {
  const StatusIcon = receiptStatusIcon(model.kind);
  return (
    <article className="vantyx-receipt" data-testid="receipt-modal-paper" aria-label={model.title}>
      <header className="vantyx-receipt-header">
        <img src={RECEIPT_LOGO} width="190" height="52" alt="Vantyx Bank" />
        {onClose && <button className="vantyx-receipt-close" type="button" aria-label="Fechar comprovante" onClick={onClose}><X size={24} /></button>}
      </header>
      <div className="vantyx-receipt-body">
        <h2 id="vantyx-receipt-title">{model.title}</h2>
        <div className={`vantyx-receipt-summary is-${model.kind}`}>
          <StatusIcon size={44} strokeWidth={1.8} aria-hidden="true" />
          <p className="vantyx-receipt-status">{model.label}</p>
          <p className="vantyx-receipt-amount">{model.amount}</p>
          <p className="vantyx-receipt-date">{model.date} <span>(Brasília)</span></p>
        </div>
        {model.parties.map((party) => <section key={party.title} className="vantyx-receipt-party">
          <h3>{party.title}</h3>
          <p className="vantyx-receipt-name">{party.name}</p>
          <div className="vantyx-receipt-row"><span>{party.documentLabel}</span><span>{party.document}</span></div>
          <p className="vantyx-receipt-account">{party.account}</p>
        </section>)}
        <div className="vantyx-receipt-identifier"><span>Identificador</span><strong>{model.identifier}</strong></div>
        <section className="vantyx-receipt-details" aria-label="Detalhes da operação">
          <h3>DETALHES DA OPERAÇÃO</h3>
          {model.details.map(([label, value]) => <div className="vantyx-receipt-row" key={label}><span>{label}</span><span>{value}</span></div>)}
        </section>
        <p className="vantyx-receipt-note">{model.note}</p>
        {children}
      </div>
    </article>
  );
}
