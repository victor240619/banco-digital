import React from 'react';
import { cn } from '../lib/cn';

const BRAVUS_SYMBOL_SRC = '/brand/bravus-symbol-transparent.png';

export default function Logo({ className, showWordmark = true }) {
  return (
    <div className={cn('flex items-center gap-2.5 overflow-visible', className)}>
      <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-visible p-1">
        <img
          src={BRAVUS_SYMBOL_SRC}
          alt={showWordmark ? '' : 'Bravus Bank'}
          className="block max-h-full max-w-full object-contain drop-shadow-[0_4px_12px_rgba(238,203,84,0.22)]"
        />
      </span>
      {showWordmark && (
        <div className="flex flex-col leading-none">
          <span className="font-display text-base font-bold tracking-tight text-white">BRAVUS</span>
          <span className="text-[10px] font-medium tracking-[0.2em] text-gold-300/90">PREMIUM BANK</span>
        </div>
      )}
    </div>
  );
}
