import React from 'react';
import Logo from './Logo';
import { ShieldCheck, Lock } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="mt-24 border-t border-white/5 bg-ink-950/60">
      <div className="container-app py-10">
        <div className="grid gap-8 md:grid-cols-4">
          <div>
            <Logo />
            <p className="mt-4 text-sm text-ink-300 max-w-xs">
              Banco digital premium. Construído com segurança bancária, performance moderna e experiência impecável.
            </p>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white mb-3">Produto</h4>
            <ul className="space-y-2 text-sm text-ink-300">
              <li>Conta Digital</li>
              <li>Cartões</li>
              <li>Transferências</li>
              <li>Investimentos</li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white mb-3">Empresa</h4>
            <ul className="space-y-2 text-sm text-ink-300">
              <li>Sobre</li>
              <li>Carreiras</li>
              <li>Imprensa</li>
              <li>Contato</li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white mb-3">Segurança</h4>
            <div className="space-y-2 text-sm text-ink-300">
              <div className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-gold-400" /> Criptografia TLS 1.3</div>
              <div className="inline-flex items-center gap-2"><Lock className="h-4 w-4 text-gold-400" /> JWT + 2FA</div>
            </div>
          </div>
        </div>
        <div className="mt-10 pt-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-ink-400">
          <div>© {new Date().getFullYear()} Bravus Bank. Todos os direitos reservados.</div>
          <div className="flex gap-4">
            <span>Termos</span>
            <span>Privacidade</span>
            <span>Compliance</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
