import React from 'react';
import { Link } from 'react-router-dom';
import Logo from './Logo';
import { ExternalLink, Landmark, Lock, ShieldCheck } from 'lucide-react';

const productLinks = [
  ['Conta Digital', '/produto/conta-digital'],
  ['Cartões', '/produto/cartoes'],
  ['Transferências', '/produto/transferencias'],
  ['Investimentos', '/produto/investimentos'],
  ['Canais de atendimento', '/canais-atendimento'],
];

const companyLinks = [
  ['Sobre', '/empresa/sobre'],
  ['Carreiras', '/empresa/carreiras'],
  ['Imprensa', '/empresa/imprensa'],
  ['Contato', '/empresa/contato'],
];

const FooterLinks = ({ links }) => (
  <ul className="space-y-2 text-sm text-ink-300">
    {links.map(([label, to]) => (
      <li key={to}>
        <Link className="transition-colors hover:text-gold-300" to={to}>
          {label}
        </Link>
      </li>
    ))}
  </ul>
);

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
            <FooterLinks links={productLinks} />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white mb-3">Empresa</h4>
            <FooterLinks links={companyLinks} />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white mb-3">Segurança</h4>
            <div className="space-y-2 text-sm text-ink-300">
              <div className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-gold-400" /> Criptografia TLS 1.3</div>
              <div className="inline-flex items-center gap-2"><Lock className="h-4 w-4 text-gold-400" /> JWT + 2FA</div>
            </div>
          </div>
        </div>
        <div className="mt-10 border-y border-white/10 py-6">
          <div className="flex max-w-4xl items-start gap-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gold-400/10 text-gold-300">
              <Landmark className="h-5 w-5" />
            </span>
            <div>
              <h4 className="text-sm font-semibold text-white">Regulação e transparência</h4>
              <p className="mt-2 text-sm leading-relaxed text-ink-300">
                A Cayman Islands Monetary Authority (CIMA) é a autoridade responsável pelo licenciamento e pela supervisão
                de serviços financeiros nas Ilhas Cayman. Consulte o cadastro oficial para verificar o status regulatório
                de qualquer instituição.
              </p>
              <a
                className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-gold-300 transition-colors hover:text-gold-200"
                href="https://www.cima.ky/search-entities-cima"
                target="_blank"
                rel="noreferrer"
              >
                Consultar entidades na CIMA <ExternalLink className="h-3.5 w-3.5" />
              </a>
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
