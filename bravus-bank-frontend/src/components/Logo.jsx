import React from 'react';
import { cn } from '../lib/cn';

const BRAVUS_SYMBOL_SRC = '/brand/bravus-symbol-transparent.png';

export default function Logo({ className, showWordmark = true }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <img
        src={BRAVUS_SYMBOL_SRC}
        alt={showWordmark ? '' : 'Bravus Bank'}
        className="h-10 w-10 shrink-0 object-contain drop-shadow-[0_4px_12px_rgba(238,203,84,0.22)]"
      />
      {showWordmark && (
        <div className="flex flex-col leading-none">
          <span className="font-display text-base font-bold tracking-tight text-white">BRAVUS</span>
          <span className="text-[10px] font-medium tracking-[0.2em] text-gold-300/90">PREMIUM BANK</span>
        </div>
      )}
    </div>
  );
}
