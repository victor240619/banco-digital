import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ShieldCheck, Zap, Globe2, Banknote, LineChart, Lock,
  ArrowRight, Download, Sparkles, Smartphone, Award, PhoneCall, ShieldAlert
} from 'lucide-react';
import { authService } from '../services/api';
import { APK_DOWNLOAD_URL } from '../lib/appChannel';

const FeatureCard = ({ icon: Icon, title, desc, accent }) => (
  <motion.div
    initial={{ opacity: 0, y: 14 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: '-40px' }}
    transition={{ duration: 0.45 }}
    className="card-premium p-6 hover:border-white/20 transition-colors"
  >
    <div className={`inline-flex h-11 w-11 items-center justify-center rounded-xl ${accent}`}>
      <Icon className="h-5 w-5" />
    </div>
    <h3 className="mt-4 font-display text-lg font-semibold text-white">{title}</h3>
    <p className="mt-1.5 text-sm text-ink-300 leading-relaxed">{desc}</p>
  </motion.div>
);

const Stat = ({ value, label }) => (
  <div className="text-center">
    <div className="font-display text-3xl sm:text-4xl font-bold gradient-text tabular-nums">{value}</div>
    <div className="mt-1 text-xs uppercase tracking-widest text-ink-400">{label}</div>
  </div>
);

export default function Home() {
  const isAuthenticated = authService.isAuthenticated();
  const isAdmin = authService.hasRole('ROLE_ADMIN');

  return (
    <main>
      {/* ============ HERO ============ */}
      <section className="container-app pt-16 sm:pt-24 pb-16">
        <div className="grid lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="pill-gold mb-6"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Premium Digital Banking
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.05 }}
              className="title-xl"
            >
              Seu dinheiro,<br />
              <span className="gradient-text">no padrão Bravus.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.15 }}
              className="mt-5 max-w-xl text-lg text-ink-200 leading-relaxed"
            >
              Conta digital premium com segurança bancária de verdade, transferências instantâneas
              e uma experiência feita pra quem exige mais.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.25 }}
              className="mt-8 flex flex-wrap gap-3"
            >
              {!isAuthenticated ? (
                <>
                  <a href={APK_DOWNLOAD_URL} download className="btn-primary text-base !py-3 !px-6">
                    Baixar APK e abrir conta <Download className="h-4 w-4" />
                  </a>
                  <Link to="/login" className="btn-secondary text-base !py-3 !px-6">
                    Já sou cliente
                  </Link>
                </>
              ) : (
                <>
                  <Link to="/dashboard" className="btn-primary text-base !py-3 !px-6">
                    Ir para o Dashboard <ArrowRight className="h-4 w-4" />
                  </Link>
                  {isAdmin && (
                    <Link to="/admin" className="btn-secondary text-base !py-3 !px-6">
                      Painel admin
                    </Link>
                  )}
                </>
              )}
            </motion.div>

            <div className="mt-10 flex flex-wrap items-center gap-5 text-sm text-ink-300">
              <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-gold-400" /> Criptografia TLS 1.3</span>
              <span className="inline-flex items-center gap-2"><Lock className="h-4 w-4 text-gold-400" /> JWT + 2FA</span>
              <span className="inline-flex items-center gap-2"><Award className="h-4 w-4 text-gold-400" /> Compliance LGPD</span>
            </div>
          </div>

          {/* Card visual mock */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="lg:col-span-5"
          >
            <div className="relative">
              {/* Glow */}
              <div className="absolute -inset-6 bg-gradient-to-br from-gold-400/20 via-bravus-500/20 to-transparent blur-3xl rounded-3xl" />
              {/* Card */}
              <div className="relative card-premium p-6 rounded-3xl overflow-hidden">
                <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-gradient-gold opacity-20 blur-2xl" />
                <div className="flex items-center justify-between">
                  <div className="text-xs uppercase tracking-widest text-ink-300">Saldo disponível</div>
                  <div className="pill-gold">Premium</div>
                </div>
                <div className="mt-3 font-display tabular-nums text-4xl font-bold">
                  KYD <span className="gradient-text">128.450,90</span>
                </div>
                <div className="mt-1 text-xs text-ink-400">Ag. 0001 · CC 0042-7</div>

                <div className="mt-6 grid grid-cols-3 gap-2">
                  {['ACH / EFT', 'Wire', 'Transferir'].map((t) => (
                    <div key={t} className="rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-center text-xs font-medium hover:bg-white/10 transition-colors">
                      {t}
                    </div>
                  ))}
                </div>

                <div className="mt-6">
                  <div className="text-xs text-ink-400 mb-2">Últimas movimentações</div>
                  <ul className="space-y-2">
                    {[
                      { t: 'ACH recebido', v: '+ KYD 1.200,00', c: 'text-emerald-300' },
                      { t: 'Assinatura Bravus', v: '- KYD 49,90', c: 'text-red-300' },
                      { t: 'Transferência', v: '- KYD 850,00', c: 'text-red-300' },
                    ].map((m, i) => (
                      <li key={i} className="flex items-center justify-between text-sm">
                        <span className="text-ink-200">{m.t}</span>
                        <span className={`font-medium tabular-nums ${m.c}`}>{m.v}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ============ STATS ============ */}
      <section className="container-app">
        <div className="card-premium grid grid-cols-2 md:grid-cols-4 gap-6 p-8">
          <Stat value="24/7" label="Canais digitais" />
          <Stat value="99.99%" label="Uptime SLA" />
          <Stat value="256-bit" label="Criptografia" />
          <Stat value="24/7" label="Suporte" />
        </div>
      </section>

      {/* ============ LOST OR STOLEN CARDS ============ */}
      <section className="container-app mt-20" aria-labelledby="lost-card-support-title">
        <div className="relative min-h-[520px] overflow-hidden rounded-lg border border-white/10 sm:min-h-[460px]">
          <img
            src="/images/lost-card-support.png"
            alt="Carteira e cartão sobre uma passarela próxima ao mar"
            className="absolute inset-0 h-full w-full object-cover object-center sm:object-right"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-slate-950/72 sm:bg-gradient-to-r sm:from-slate-950/95 sm:via-slate-950/78 sm:to-slate-950/10" />

          <div className="relative z-10 flex min-h-[520px] max-w-2xl flex-col justify-center px-6 py-10 sm:min-h-[460px] sm:px-10 lg:px-14">
            <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-lg border border-gold-400/30 bg-slate-950/70 text-gold-300">
              <ShieldAlert className="h-6 w-6" aria-hidden="true" />
            </div>
            <h2 id="lost-card-support-title" className="font-display text-3xl font-bold leading-tight text-white sm:text-4xl">
              Reporte cartões perdidos ou roubados 24 horas por dia, 7 dias por semana.
            </h2>

            <div className="mt-8 grid gap-5 sm:grid-cols-2">
              <a
                href="tel:+16367227111"
                className="group border-l-2 border-gold-400 pl-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-300"
              >
                <span className="block text-sm font-medium text-ink-200">Serviços Globais Mastercard</span>
                <span className="mt-1 inline-flex items-center gap-2 font-display text-xl font-semibold text-white group-hover:text-gold-300">
                  <PhoneCall className="h-5 w-5" aria-hidden="true" />
                  +1 636 722 7111
                </span>
              </a>
              <a
                href="tel:+13039671090"
                className="group border-l-2 border-gold-400 pl-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-300"
              >
                <span className="block text-sm font-medium text-ink-200">Visa Global Service</span>
                <span className="mt-1 inline-flex items-center gap-2 font-display text-xl font-semibold text-white group-hover:text-gold-300">
                  <PhoneCall className="h-5 w-5" aria-hidden="true" />
                  +1 303 967 1090
                </span>
              </a>
            </div>

            <p className="mt-8 max-w-xl text-xs leading-relaxed text-ink-300">
              Canais globais de assistência das bandeiras. A disponibilidade e os custos da chamada podem variar. Informe também o emissor do cartão.
            </p>
          </div>
        </div>
      </section>

      {/* ============ FEATURES ============ */}
      <section className="container-app mt-20">
        <div className="max-w-2xl">
          <div className="pill-gold mb-3"><Sparkles className="h-3.5 w-3.5" /> Por que Bravus</div>
          <h2 className="title-lg">Uma camada acima do digital banking comum.</h2>
          <p className="mt-3 text-ink-300">
            Tudo o que você precisa, construído com a obsessão de quem entende de finanças e tecnologia.
          </p>
        </div>

        <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <FeatureCard
            icon={Zap}
            title="Transferências Cayman e globais"
            desc="ACH/EFT local, Wire/SWIFT internacional e liquidação interna Bravus com trilhos separados."
            accent="bg-gold-400/15 text-gold-300"
          />
          <FeatureCard
            icon={ShieldCheck}
            title="Segurança bancária"
            desc="JWT, hashing forte de senhas, auditoria completa e compliance LGPD."
            accent="bg-emerald-400/15 text-emerald-300"
          />
          <FeatureCard
            icon={LineChart}
            title="Visão completa"
            desc="Dashboards com indicadores em tempo real, extratos e relatórios exportáveis."
            accent="bg-bravus-400/15 text-bravus-200"
          />
          <FeatureCard
            icon={Banknote}
            title="Pagamentos Stripe"
            desc="Integração nativa com Stripe para assinaturas e cobranças seguras."
            accent="bg-fuchsia-400/15 text-fuchsia-300"
          />
          <FeatureCard
            icon={Globe2}
            title="Disponível 24/7"
            desc="Infraestrutura altamente disponível com observabilidade de classe mundial."
            accent="bg-sky-400/15 text-sky-300"
          />
          <FeatureCard
            icon={Smartphone}
            title="Experiência impecável"
            desc="UI moderna, responsiva e acessível em qualquer dispositivo."
            accent="bg-amber-400/15 text-amber-300"
          />
        </div>
      </section>

      {/* ============ CTA ============ */}
      <section className="container-app mt-20">
        <div className="relative card-premium overflow-hidden p-10 sm:p-14 text-center">
          <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-gradient-gold opacity-10 blur-3xl" />
          <div className="absolute -bottom-24 -right-24 w-72 h-72 rounded-full bg-bravus-500 opacity-20 blur-3xl" />
          <h2 className="title-lg gradient-text">Pronto pra subir de padrão?</h2>
          <p className="mt-3 text-ink-200 max-w-xl mx-auto">
            Abra sua conta em menos de 2 minutos. 100% digital, com a confiança que você espera de um banco premium.
          </p>
          {!isAuthenticated && (
            <a href={APK_DOWNLOAD_URL} download className="btn-primary mt-7 text-base !py-3 !px-8">
              Baixar APK <Download className="h-4 w-4" />
            </a>
          )}
        </div>
      </section>
    </main>
  );
}
