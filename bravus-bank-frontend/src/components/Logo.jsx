import React from 'react';
import { cn } from '../lib/cn';

export default function Logo({ className, showWordmark = true }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <svg viewBox="0 0 64 64" className="h-8 w-8" aria-hidden="true">
        <defs>
          <linearGradient id="lg-bg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#0c328e" />
            <stop offset="100%" stopColor="#040f2e" />
          </linearGradient>
          <linearGradient id="lg-gold" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#eecb54" />
            <stop offset="100%" stopColor="#d49b1c" />
          </linearGradient>
        </defs>
        <rect width="64" height="64" rx="14" fill="url(#lg-bg)" />
        <path
          d="M20 18h14a10 10 0 0 1 0 20h-14V18zm0 14v14h16a10 10 0 0 0 0-20"
          stroke="url(#lg-gold)"
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {showWordmark && (
        <div className="flex flex-col leading-none">
          <span className="font-display text-base font-bold tracking-tight text-white">BRAVUS</span>
          <span className="text-[10px] font-medium tracking-[0.2em] text-gold-300/90">PREMIUM BANK</span>
        </div>
      )}
    </div>
  );
}
