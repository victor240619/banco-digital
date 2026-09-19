import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight, Banknote, CreditCard, Globe2, Headphones,
  LineChart, LockKeyhole, ShieldCheck, Sparkles, Zap,
} from 'lucide-react';
import { authService } from '../services/api';
import { useLocale } from '../contexts/LocaleContext';

const reveal = {
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
  transition: { duration: 0.5 },
};

function CapabilityCard({ icon: Icon, title, children }) {
  return (
    <motion.article {...reveal} className="obsidian-feature-card">
      <span className="obsidian-icon"><Icon className="h-5 w-5" aria-hidden="true" /></span>
      <h3>{title}</h3>
      <p>{children}</p>
    </motion.article>
  );
}

function Metric({ value, label }) {
  return (
    <div className="obsidian-metric">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

export default function Home() {
  const isAuthenticated = authService.isAuthenticated();
  const isAdmin = authService.hasRole('ROLE_ADMIN');
  const { t } = useLocale();

  return (
    <main className="vantyx-obsidian-home">
      <section className="obsidian-hero">
        <div className="container-app obsidian-hero-grid">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
            className="obsidian-hero-copy"
          >
            <div className="obsidian-kicker"><Sparkles className="h-3.5 w-3.5" /> Vantyx Bank</div>
            <h1>{t('Intelligent Banking.')}<br /><span>{t('Possibilidades sem limites.')}</span></h1>
            <p>
              {t('Banco digital premium para uma vida sem fronteiras. Seguro, inteligente e desenvolvido para oferecer performance em cada movimentação.')}
            </p>
            <div className="obsidian-actions">
              {isAuthenticated ? (
                <Link to={isAdmin ? '/admin' : '/dashboard'} className="btn-primary">
                  {t('Acessar minha conta')} <ArrowRight className="h-4 w-4" />
                </Link>
              ) : (
                <>
                  <Link to="/register" className="btn-primary">
                    {t('Abrir minha conta')} <ArrowRight className="h-4 w-4" />
                  </Link>
                  <a href="#vantyx-features" className="btn-secondary">{t('Explorar recursos')}</a>
                </>
              )}
            </div>
            <div className="obsidian-assurances">
              <span><ShieldCheck className="h-4 w-4" /> {t('Proteção multicamada')}</span>
              <span><Globe2 className="h-4 w-4" /> {t('Acesso global')}</span>
              <span><Headphones className="h-4 w-4" /> {t('Atendimento 24/7')}</span>
            </div>
          </motion.div>

          <motion.figure
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.08 }}
            className="obsidian-hero-media"
          >
            <img
              src="/images/obsidian/vantyx-mobile-banking.png"
              alt={t('Experiência mobile Vantyx Bank em acabamento obsidian')}
              loading="eager"
            />
          </motion.figure>
        </div>
      </section>

      <section className="container-app obsidian-metrics" aria-label={t('Indicadores Vantyx')}>
        <Metric value="24/7" label={t('Canais digitais')} />
        <Metric value="BRL" label={t('Conta em reais')} />
        <Metric value="256-bit" label={t('Criptografia')} />
        <Metric value="99,99%" label={t('Disponibilidade')} />
      </section>

      <section id="vantyx-features" className="container-app obsidian-section">
        <div className="obsidian-section-heading">
          <div className="obsidian-kicker">Vantyx Obsidian</div>
          <h2>{t('Inteligência, segurança e liberdade em uma única experiência.')}</h2>
          <p>{t('O essencial de um banco completo com uma interface precisa, silenciosa e premium.')}</p>
        </div>

        <div className="obsidian-feature-grid">
          <CapabilityCard icon={Zap} title={t('Operações rápidas')}>
            {t('Transferências e movimentações em poucos passos, com confirmação clara em cada etapa.')}
          </CapabilityCard>
          <CapabilityCard icon={Globe2} title={t('Acesso sem fronteiras')}>
            {t('Conta digital disponível em qualquer dispositivo, com rotas locais e internacionais separadas.')}
          </CapabilityCard>
          <CapabilityCard icon={ShieldCheck} title={t('Segurança bancária')}>
            {t('Sessões protegidas, rastreabilidade e dados financeiros isolados por titular.')}
          </CapabilityCard>
          <CapabilityCard icon={LineChart} title={t('Visão para crescer')}>
            {t('Saldos, extratos e indicadores organizados para decisões mais inteligentes.')}
          </CapabilityCard>
        </div>
      </section>

      <section className="container-app obsidian-split-section">
        <motion.div {...reveal} className="obsidian-media-panel">
          <img src="/images/obsidian/vantyx-cards.png" alt={t('Cartões Vantyx Obsidian em preto e prata')} loading="lazy" />
        </motion.div>
        <motion.div {...reveal} className="obsidian-copy-panel">
          <div className="obsidian-kicker">{t('Cartão premium')}</div>
          <h2>{t('O cartão Vantyx.')}</h2>
          <p>
            {t('Identidade obsidian, detalhes em prata fria e controles digitais para acompanhar o ritmo da sua conta.')}
          </p>
          <ul>
            <li><CreditCard className="h-4 w-4" /> {t('Gestão integrada à conta')}</li>
            <li><LockKeyhole className="h-4 w-4" /> {t('Controles de segurança')}</li>
            <li><Globe2 className="h-4 w-4" /> {t('Uso nacional e internacional')}</li>
          </ul>
          <Link to="/produto/cartoes" className="btn-secondary">{t('Conhecer os cartões')} <ArrowRight className="h-4 w-4" /></Link>
        </motion.div>
      </section>

      <section className="container-app obsidian-split-section obsidian-split-reverse">
        <motion.div {...reveal} className="obsidian-media-panel obsidian-mobile-panel">
          <img src="/images/obsidian/vantyx-wealth-mobile.png" alt={t('Painel de investimentos Vantyx em interface obsidian')} loading="lazy" />
        </motion.div>
        <motion.div {...reveal} className="obsidian-copy-panel">
          <div className="obsidian-kicker">{t('Visão financeira')}</div>
          <h2>{t('Ferramentas que trabalham por você.')}</h2>
          <p>
            {t('Acompanhe movimentações, crédito e investimentos com hierarquia clara, gráficos objetivos e valores em reais.')}
          </p>
          <ul>
            <li><LineChart className="h-4 w-4" /> {t('Indicadores em tempo real')}</li>
            <li><Banknote className="h-4 w-4" /> {t('Extratos e comprovantes')}</li>
            <li><ShieldCheck className="h-4 w-4" /> {t('Dados exclusivos do titular')}</li>
          </ul>
          <Link to="/produto/investimentos" className="btn-secondary">{t('Explorar investimentos')} <ArrowRight className="h-4 w-4" /></Link>
        </motion.div>
      </section>

      <section className="container-app obsidian-security-section">
        <div className="obsidian-security-copy">
          <div className="obsidian-kicker">{t('Segurança')}</div>
          <h2>{t('Proteção em cada acesso.')}</h2>
          <p>
            {t('Autenticação, criptografia, auditoria e isolamento por conta trabalham juntos para proteger seus dados.')}
          </p>
        </div>
        <div className="obsidian-security-grid">
          <span><LockKeyhole className="h-5 w-5" /> {t('Criptografia ponta a ponta')}</span>
          <span><ShieldCheck className="h-5 w-5" /> {t('Proteção em tempo real')}</span>
          <span><Globe2 className="h-5 w-5" /> {t('Infraestrutura segura')}</span>
          <span><Zap className="h-5 w-5" /> {t('Alertas imediatos')}</span>
        </div>
      </section>

      <section className="container-app obsidian-closing">
        <img src="/images/obsidian/vantyx-private-banking.png" alt={t('Ambiente premium Vantyx Bank')} loading="lazy" />
        <div className="obsidian-closing-copy">
          <img src="/brand/vantyx-bank-logo.png" alt="Vantyx Bank" />
          <h2>{t('O futuro do banking já começou.')}</h2>
          <p>{t('Uma experiência premium, segura e construída para acompanhar cada fase da sua vida financeira.')}</p>
          {!isAuthenticated && <Link to="/register" className="btn-primary">{t('Abrir minha conta')} <ArrowRight className="h-4 w-4" /></Link>}
        </div>
      </section>
    </main>
  );
}
