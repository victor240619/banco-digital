import React from 'react';
import { cn } from '../lib/cn';

const VANTYX_SYMBOL_SRC = '/brand/vantyx-app-icon-master.png';
const VANTYX_HORIZONTAL_SRC = '/brand/vantyx-bank-horizontal.png';

export default function Logo({ className, showWordmark = true }) {
  return (
    <div className={cn('flex min-w-0 items-center overflow-visible', className)}>
      <img
        src={showWordmark ? VANTYX_HORIZONTAL_SRC : VANTYX_SYMBOL_SRC}
        alt="Vantyx Bank"
        className={cn(
          'block object-contain drop-shadow-[0_5px_16px_rgba(0,102,255,0.24)]',
          showWordmark ? 'h-11 w-auto max-w-[190px]' : 'h-11 w-11 rounded-xl'
        )}
      />
    </div>
  );
}
