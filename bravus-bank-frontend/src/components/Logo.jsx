import React from 'react';
import { cn } from '../lib/cn';

const VANTYX_SYMBOL_SRC = '/brand/vantyx-app-icon-master.png';

export default function Logo({ className, showWordmark = true }) {
  return (
    <div className={cn('flex items-center gap-2.5 overflow-visible', className)}>
      <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-visible p-1">
        <img
          src={VANTYX_SYMBOL_SRC}
          alt={showWordmark ? '' : 'Vantyx Bank'}
          className="block max-h-full max-w-full object-contain drop-shadow-[0_4px_12px_rgba(30,89,190,0.28)]"
        />
      </span>
      {showWordmark && (
        <div className="flex flex-col leading-none">
          <span className="font-display text-base font-bold tracking-[0.18em] text-white">VANTYX</span>
          <span className="text-[10px] font-medium tracking-[0.42em] text-blue-200/90">BANK</span>
        </div>
      )}
    </div>
  );
}
