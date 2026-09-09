import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, Share2 } from 'lucide-react';
import ReceiptPaper from './ReceiptPaper';
import { buildReceiptModel } from '../lib/receiptModel';
import { downloadReceiptDocument, shareReceiptDocument } from '../lib/receiptActions';

export default function ReceiptModal({ receipt, onClose }) {
  const model = useMemo(() => buildReceiptModel(receipt), [receipt]);
  const prepared = useRef(null);
  const busy = useRef(false);
  const dialog = useRef(null);
  const [action, setAction] = useState(null);
  const [feedback, setFeedback] = useState(null);
  useEffect(() => { prepared.current = null; setFeedback(null); }, [receipt]);
  useEffect(() => {
    const previousFocus = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.current?.focus();
    return () => { document.body.style.overflow = overflow; previousFocus?.focus?.(); };
  }, []);
  const prepare = () => {
    if (!prepared.current) prepared.current = import('../lib/receiptDocument.jsx')
      .then(({ buildReceiptDocument }) => buildReceiptDocument(receipt))
      .catch((error) => { prepared.current = null; throw error; });
    return prepared.current;
  };
  // Prepare in advance so the native share gesture need not wait for assets.
  useEffect(() => { prepare().catch(() => {}); }, [receipt]);
  const run = async (kind) => {
    if (busy.current) return;
    busy.current = true;
    setAction(kind);
    setFeedback(null);
    try {
      const document = await prepare();
      const result = kind === 'download' ? await downloadReceiptDocument(document) : await shareReceiptDocument(document);
      setFeedback({ message: typeof result === 'string' ? result : result.message });
    } catch (error) {
      if (error?.name !== 'AbortError') setFeedback({ error: true, message: error?.code === 'NATIVE_RECEIPT_PLUGINS_UNAVAILABLE'
        ? 'Atualize o aplicativo para salvar e compartilhar comprovantes em PDF.'
        : 'Não foi possível preparar o PDF. Tente novamente.' });
    } finally { busy.current = false; setAction(null); }
  };
  const handleKey = (event) => {
    if (event.key === 'Escape') onClose();
    if (event.key !== 'Tab') return;
    const controls = [...dialog.current.querySelectorAll('button:not(:disabled), a[href]')];
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && [first, dialog.current].includes(document.activeElement)) { event.preventDefault(); last?.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  };
  return createPortal(<div className="fixed inset-0 z-[80] overflow-y-auto bg-black/70 px-3 py-4 sm:py-6" data-testid="receipt-modal-overlay">
    <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="vantyx-receipt-title" tabIndex={-1} onKeyDown={handleKey} className="mx-auto w-full max-w-[426px] outline-none">
      <ReceiptPaper model={model} onClose={onClose}>
        <div className="vantyx-receipt-actions">
          <button className="vantyx-receipt-action" type="button" onClick={() => run('share')} disabled={Boolean(action)}><Share2 size={20} />{action === 'share' ? 'Abrindo...' : 'Compartilhar'}</button>
          <button className="vantyx-receipt-action secondary" type="button" onClick={() => run('download')} disabled={Boolean(action)}><Download size={20} />{action === 'download' ? 'Salvando...' : 'Baixar PDF'}</button>
        </div>
        {feedback && <p role={feedback.error ? 'alert' : 'status'} className={`vantyx-receipt-feedback ${feedback.error ? 'error' : ''}`}>{feedback.message}</p>}
      </ReceiptPaper>
    </div>
  </div>, document.body);
}
