import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Building2, CreditCard, Copy, Check, ShieldCheck, Crown,
  ChevronDown, ChevronUp, KeyRound, MapPin, User2, Phone, Mail,
} from 'lucide-react';

/**
 * Card de identidade bancária — substitui o header simples por algo profissional.
 * Mostra: nível da conta, banco, agência, conta, chave PIX, status KYC.
 * Permite expandir pra ver dados pessoais completos.
 */
export default function BankIdentityCard({ me }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(null);

  if (!me) return null;

  const banco = me.dadosBancarios || {};
  const conta = me.conta || {};
  const endereco = me.endereco || {};

  const copy = async (label, value) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      setTimeout(() => setCopied(null), 1500);
    } catch {}
  };

  const copyAllBankData = () => {
    const txt = [
      `${banco.nomeBanco} (cód. ${banco.codigoBanco})`,
      `Titular: ${me.fullName}`,
      `CPF: ${me.cpf}`,
      `Agência: ${banco.agencia}`,
      `Conta: ${banco.contaFormatada || banco.conta} (${banco.tipoConta})`,
      `Chave PIX (${banco.tipoChavePix}): ${banco.chavePix}`,
    ].join('\n');
    copy('all', txt);
  };

  const nivelStyle = {
    PREMIUM:  { label: 'PREMIUM',  cls: 'from-amber-500/30 to-amber-700/10 text-amber-200 border-amber-500/40' },
    BLACK:    { label: 'BLACK',    cls: 'from-zinc-700/40 to-black/40 text-zinc-200 border-zinc-500/40' },
    INFINITY: { label: 'INFINITY', cls: 'from-fuchsia-500/30 to-indigo-700/20 text-fuchsia-200 border-fuchsia-500/40' },
  }[conta.nivel] || { label: conta.nivel || 'PREMIUM', cls: 'from-amber-500/30 to-amber-700/10 text-amber-200 border-amber-500/40' };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-3xl border border-amber-500/20 bg-gradient-to-br from-[#040f2e] via-[#071a4d] to-[#040f2e] p-6 md:p-8 shadow-2xl"
    >
      {/* shimmer dourado de fundo */}
      <div className="pointer-events-none absolute -top-32 -right-32 h-72 w-72 rounded-full bg-amber-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -left-20 h-72 w-72 rounded-full bg-amber-600/5 blur-3xl" />

      <div className="relative z-10 flex flex-col gap-6">
        {/* Topo: banco + nível */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-amber-500/15 p-3 ring-1 ring-amber-500/30">
              <Building2 className="h-7 w-7 text-amber-300" />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-amber-300/80">
                {banco.nomeBanco || 'Bravus Premium Bank'}
              </p>
              <p className="text-xs text-white/50 mt-0.5">
                Cód. {banco.codigoBanco} · ISPB {banco.ispb}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className={`flex items-center gap-1.5 rounded-full border bg-gradient-to-r px-3 py-1 text-[11px] font-semibold tracking-wider ${nivelStyle.cls}`}>
              <Crown className="h-3.5 w-3.5" />
              {nivelStyle.label}
            </span>
            {conta.statusKyc === 'VERIFICADO' && (
              <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-3 py-1 text-[11px] font-medium text-emerald-300 ring-1 ring-emerald-500/30">
                <ShieldCheck className="h-3.5 w-3.5" /> Verificado
              </span>
            )}
          </div>
        </div>

        {/* Nome + saudação */}
        <div>
          <p className="text-sm text-white/50">Titular</p>
          <h2 className="font-display text-2xl md:text-3xl font-semibold text-white tracking-tight">
            {me.fullName}
          </h2>
          <p className="text-xs text-white/40 mt-1">CPF {me.cpf}</p>
        </div>

        {/* Grade de dados bancários */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <DataPill
            label="Agência"
            value={banco.agencia}
            onCopy={() => copy('agencia', banco.agencia)}
            copied={copied === 'agencia'}
          />
          <DataPill
            label="Conta"
            value={banco.contaFormatada || banco.conta}
            sub={banco.tipoConta}
            onCopy={() => copy('conta', banco.conta)}
            copied={copied === 'conta'}
          />
          <DataPill
            label={`Chave PIX (${banco.tipoChavePix || 'CPF'})`}
            value={banco.chavePix}
            icon={KeyRound}
            onCopy={() => copy('pix', banco.chavePix)}
            copied={copied === 'pix'}
            highlight
          />
          <DataPill
            label="Banco"
            value={banco.codigoBanco}
            sub={banco.nomeBanco}
            icon={CreditCard}
            onCopy={() => copy('banco', `${banco.codigoBanco} - ${banco.nomeBanco}`)}
            copied={copied === 'banco'}
          />
        </div>

        {/* Botões de ação */}
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button
            onClick={copyAllBankData}
            className="flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-[#040f2e] shadow-lg shadow-amber-500/30 transition hover:bg-amber-400"
          >
            {copied === 'all' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied === 'all' ? 'Copiado!' : 'Copiar dados bancários'}
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm text-white/80 transition hover:bg-white/10"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            {expanded ? 'Recolher detalhes' : 'Ver mais detalhes'}
          </button>
        </div>

        {/* Painel expandido */}
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="border-t border-white/10 pt-5 mt-2 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3"
          >
            <DetailRow icon={Mail} label="Email" value={me.email} />
            <DetailRow icon={Phone} label="Telefone" value={me.phoneFormatted || me.phone} />
            <DetailRow icon={User2} label="Username" value={`@${me.username}`} />
            <DetailRow icon={MapPin}
              label="Endereço"
              value={endereco.rua
                ? `${endereco.rua}, ${endereco.numero || 's/n'} - ${endereco.cidade}/${endereco.uf}`
                : 'Não cadastrado'} />
            <DetailRow label="Abertura da conta" value={formatDate(conta.abertura)} />
            <DetailRow label="Status KYC" value={conta.statusKyc} />
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

function DataPill({ label, value, sub, onCopy, copied, icon: Icon, highlight }) {
  return (
    <button
      onClick={onCopy}
      className={`group relative flex flex-col items-start rounded-2xl border bg-white/5 px-4 py-3 text-left transition hover:bg-white/10 ${
        highlight ? 'border-amber-500/40 bg-amber-500/5' : 'border-white/10'
      }`}
    >
      <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.15em] text-white/45">
        {Icon && <Icon className="h-3 w-3" />}
        {label}
      </span>
      <span className="mt-1 font-mono text-base font-semibold text-white truncate max-w-full">
        {value || '—'}
      </span>
      {sub && <span className="text-[11px] text-white/40 mt-0.5">{sub}</span>}
      <span className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition">
        {copied
          ? <Check className="h-3.5 w-3.5 text-emerald-300" />
          : <Copy className="h-3.5 w-3.5 text-white/40" />}
      </span>
    </button>
  );
}

function DetailRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3">
      {Icon && <Icon className="h-4 w-4 text-amber-300/70 mt-0.5 shrink-0" />}
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wider text-white/40">{label}</p>
        <p className="text-sm text-white/90 truncate">{value || '—'}</p>
      </div>
    </div>
  );
}

function formatDate(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  } catch {
    return iso;
  }
}
