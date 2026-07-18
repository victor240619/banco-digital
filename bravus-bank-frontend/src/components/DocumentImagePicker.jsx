import React from 'react';
import { Camera, CheckCircle2, Images } from 'lucide-react';

export default function DocumentImagePicker({ label, ready, onChange }) {
  return (
    <section className="rounded-lg border border-white/10 bg-black/10 p-4" aria-label={label}>
      <div className="mb-3 flex min-h-6 items-center justify-between gap-3">
        <span className="text-sm font-medium text-ink-100">{label} *</span>
        {ready && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-300">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Recebida
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className="btn-secondary min-h-11 cursor-pointer justify-center !px-3 !py-2 text-center">
          <Camera className="h-4 w-4 shrink-0" />
          Tirar foto
          <input
            className="sr-only"
            type="file"
            accept="image/jpeg,image/png"
            capture="environment"
            aria-label={`${label}: tirar foto`}
            onChange={onChange}
          />
        </label>

        <label className="btn-secondary min-h-11 cursor-pointer justify-center !px-3 !py-2 text-center">
          <Images className="h-4 w-4 shrink-0" />
          Galeria
          <input
            className="sr-only"
            type="file"
            accept="image/jpeg,image/png"
            aria-label={`${label}: selecionar da galeria`}
            onChange={onChange}
          />
        </label>
      </div>
    </section>
  );
}
