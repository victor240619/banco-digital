import React, { useEffect, useRef } from 'react';
import { AlertCircle, X } from 'lucide-react';

export default function ViewportAlert({ message, onDismiss }) {
  const alertRef = useRef(null);

  useEffect(() => {
    if (!message) return undefined;
    const frame = requestAnimationFrame(() => alertRef.current?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, [message]);

  if (!message) return null;

  return (
    <div
      ref={alertRef}
      className="fixed left-1/2 z-[300] flex w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 items-start gap-3 rounded-lg border border-red-400/40 bg-red-950/95 px-4 py-3 text-sm text-red-100 shadow-2xl backdrop-blur"
      style={{ top: 'max(1rem, env(safe-area-inset-top))' }}
      role="alert"
      aria-live="assertive"
      tabIndex={-1}
    >
      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-300" />
      <span className="min-w-0 flex-1 leading-relaxed">{message}</span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-red-200 transition hover:bg-white/10 hover:text-white"
          aria-label="Fechar aviso"
          title="Fechar aviso"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
