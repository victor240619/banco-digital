import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Clock3,
  CreditCard,
  Headphones,
  MonitorSmartphone,
  ShieldCheck,
} from 'lucide-react';

const channels = [
  {
    title: 'Online',
    icon: MonitorSmartphone,
    text: 'Acesse sua conta Bravus pelo navegador ou aplicativo para consultar saldos, movimentações, comprovantes e serviços disponíveis para o seu perfil.',
    action: 'Acessar banco online',
    to: '/login',
  },
  {
    title: 'Atendimento assistido',
    icon: Headphones,
    text: 'Solicitações relacionadas à conta devem começar no ambiente autenticado. Assim, o atendimento identifica o titular e preserva a segurança das informações.',
    action: 'Ver canais de contato',
    to: '/empresa/contato',
  },
  {
    title: 'Caixas compatíveis',
    icon: CreditCard,
    text: 'Saques em caixas eletrônicos dependem de cartão elegível, rede compatível, disponibilidade regional, limites e eventuais tarifas informadas antes da operação.',
    action: 'Consultar informações de cartões',
    to: '/produto/cartoes',
  },
];

function ChannelImage({ index, title }) {
  return (
    <div className="relative aspect-[4/3] overflow-hidden bg-ink-900">
      <img
        src="/images/service-channels.png"
        alt={`Canal de atendimento ${title}`}
        className="absolute top-0 h-full w-[300%] max-w-none object-cover"
        style={{ left: `-${index * 100}%` }}
        loading={index === 0 ? 'eager' : 'lazy'}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-ink-950/25 to-transparent" />
    </div>
  );
}

export default function ServiceChannels() {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  return (
    <main>
      <section className="container-app pb-12 pt-12 sm:pb-16 sm:pt-16">
        <Link className="inline-flex items-center gap-2 text-sm text-ink-300 transition-colors hover:text-white" to="/">
          <ArrowLeft className="h-4 w-4" /> Voltar ao início
        </Link>

        <div className="mt-10 max-w-3xl">
          <p className="text-xs font-semibold uppercase text-gold-300">Atendimento Bravus</p>
          <h1 className="mt-3 font-display text-4xl font-bold text-white sm:text-5xl">Escolha o canal certo para você.</h1>
          <p className="mt-5 text-lg leading-relaxed text-ink-200">
            Acesso digital, suporte protegido e informações transparentes sobre o uso de terminais compatíveis.
          </p>
        </div>
      </section>

      <section className="container-app" aria-label="Canais de atendimento">
        <div className="grid gap-5 lg:grid-cols-3">
          {channels.map((channel, index) => {
            const Icon = channel.icon;
            return (
              <article className="flex min-h-full flex-col overflow-hidden rounded-lg border border-white/10 bg-white/[0.03]" key={channel.title}>
                <ChannelImage index={index} title={channel.title} />
                <div className="flex flex-1 flex-col p-6 sm:p-7">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-gold-400/10 text-gold-300">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h2 className="mt-5 font-display text-2xl font-semibold text-white">{channel.title}</h2>
                  <p className="mt-3 flex-1 leading-relaxed text-ink-300">{channel.text}</p>
                  <Link className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-gold-300 transition-colors hover:text-gold-200" to={channel.to}>
                    {channel.action} <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="mt-20 border-y border-white/10 bg-white/[0.02]">
        <div className="container-app grid gap-8 py-10 md:grid-cols-2 md:gap-14">
          <div className="flex items-start gap-4">
            <Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-gold-300" aria-hidden="true" />
            <div>
              <h2 className="font-display text-lg font-semibold text-white">Acesso digital contínuo</h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-300">
                O ambiente digital pode ser acessado a qualquer hora. Funções específicas podem ficar temporariamente indisponíveis por segurança ou manutenção.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-gold-300" aria-hidden="true" />
            <div>
              <h2 className="font-display text-lg font-semibold text-white">Atendimento com proteção</h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-300">
                A Bravus nunca solicita senha completa, código temporário ou pagamento antecipado para liberar acesso ou valores.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
