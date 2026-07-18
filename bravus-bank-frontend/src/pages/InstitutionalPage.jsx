import React, { useEffect } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import EditorialGallery from '../components/EditorialGallery';
import { institutionalEnhancements } from './institutionalEnhancements';
import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  CircleDollarSign,
  ContactRound,
  CreditCard,
  Landmark,
  LineChart,
  Newspaper,
  ShieldCheck,
} from 'lucide-react';

const pages = {
  produto: {
    'conta-digital': {
      icon: CircleDollarSign,
      eyebrow: 'Produto',
      title: 'Conta Digital',
      lead: 'Uma experiência digital em KYD para acompanhar saldo, movimentações e serviços da conta Bravus em um só lugar.',
      sections: [
        {
          title: 'Visão centralizada',
          text: 'Consulte saldo disponível, entradas, saídas, extratos e comprovantes a partir de uma interface responsiva para navegador e aplicativo.',
        },
        {
          title: 'Acesso protegido',
          text: 'A autenticação, o encerramento de sessão no aplicativo e os controles internos de segurança protegem o acesso aos dados da conta.',
        },
        {
          title: 'Disponibilidade responsável',
          text: 'Serviços de movimentação dependem do status da conta, da análise interna e da disponibilidade dos trilhos financeiros aplicáveis.',
        },
      ],
      action: ['Acessar minha conta', '/login'],
    },
    cartoes: {
      icon: CreditCard,
      eyebrow: 'Produto',
      title: 'Cartões',
      lead: 'Informações, limites e controles de segurança organizados para uma gestão simples dos produtos elegíveis.',
      sections: [
        {
          title: 'Gestão digital',
          text: 'A área de cartões concentra status, limites e configurações disponíveis para cada produto associado à conta.',
        },
        {
          title: 'Segurança primeiro',
          text: 'Controles de acesso e monitoramento ajudam a reduzir uso indevido e mantêm as ações sensíveis vinculadas ao titular autenticado.',
        },
        {
          title: 'Sujeito à elegibilidade',
          text: 'A oferta, emissão e ativação de cartões dependem de análise, termos específicos e parceiros autorizados quando aplicável.',
        },
      ],
      action: ['Consultar produtos', '/login'],
    },
    transferencias: {
      icon: Landmark,
      eyebrow: 'Produto',
      title: 'Transferências',
      lead: 'Fluxos separados para movimentações internas Bravus, transferências locais nas Ilhas Cayman e instruções internacionais.',
      sections: [
        {
          title: 'Rede interna Bravus',
          text: 'Transferências entre contas elegíveis usam identificação do destinatário, confirmação dos dados e comprovante da operação.',
        },
        {
          title: 'ACH e EFT local',
          text: 'Instruções locais seguem os dados bancários e os participantes disponíveis para liquidação nas Ilhas Cayman.',
        },
        {
          title: 'Wire e SWIFT internacional',
          text: 'Operações internacionais exigem banco destinatário, beneficiário e, quando necessário, banco correspondente. A liquidação depende de instituições autorizadas.',
        },
      ],
      action: ['Entrar para transferir', '/login'],
    },
    investimentos: {
      icon: LineChart,
      eyebrow: 'Produto',
      title: 'Investimentos',
      lead: 'Uma área dedicada à organização de carteira, informações de posição e oportunidades disponibilizadas a clientes elegíveis.',
      sections: [
        {
          title: 'Carteira organizada',
          text: 'Visualize posições e informações financeiras disponibilizadas para a sua conta em uma única área.',
        },
        {
          title: 'Informação clara',
          text: 'Cada produto deve apresentar condições, riscos, prazos e custos antes de qualquer contratação.',
        },
        {
          title: 'Disponibilidade regulada',
          text: 'Produtos de investimento dependem de elegibilidade, documentação, jurisdição e autorização regulatória aplicável. Esta página não constitui recomendação de investimento.',
        },
      ],
      action: ['Acessar carteira', '/login'],
    },
  },
  empresa: {
    sobre: {
      icon: Building2,
      eyebrow: 'Empresa',
      title: 'Sobre a Bravus',
      lead: 'Tecnologia financeira com foco em segurança, transparência operacional e uma experiência digital orientada às Ilhas Cayman.',
      sections: [
        {
          title: 'Nossa proposta',
          text: 'Reunir conta digital, controles administrativos e serviços financeiros em uma plataforma clara, auditável e centrada no cliente.',
        },
        {
          title: 'Padrão operacional',
          text: 'A Bravus prioriza integridade de dados, histórico preservado, autenticação segura e rastreabilidade das operações.',
        },
        {
          title: 'Transparência regulatória',
          text: 'Informações regulatórias e parcerias devem ser divulgadas com referência verificável e linguagem clara, permitindo consulta nas fontes oficiais aplicáveis.',
        },
      ],
      action: ['Conhecer a conta', '/produto/conta-digital'],
    },
    carreiras: {
      icon: BriefcaseBusiness,
      eyebrow: 'Empresa',
      title: 'Carreiras',
      lead: 'Construímos produtos financeiros com responsabilidade, atenção aos detalhes e compromisso com quem utiliza a plataforma.',
      sections: [
        {
          title: 'Como trabalhamos',
          text: 'Valorizamos segurança por padrão, decisões baseadas em evidências, comunicação direta e melhoria contínua.',
        },
        {
          title: 'Áreas de atuação',
          text: 'Engenharia, produto, operações, risco, atendimento, segurança da informação e conformidade fazem parte da estrutura necessária para crescer com responsabilidade.',
        },
        {
          title: 'Oportunidades',
          text: 'As vagas serão divulgadas nesta página quando houver processos seletivos abertos. A Bravus não solicita pagamentos de candidatos.',
        },
      ],
      action: ['Voltar ao início', '/'],
    },
    imprensa: {
      icon: Newspaper,
      eyebrow: 'Empresa',
      title: 'Imprensa',
      lead: 'Informações institucionais, comunicados e atualizações oficiais sobre a Bravus Bank.',
      sections: [
        {
          title: 'Fonte oficial',
          text: 'Comunicados válidos serão publicados nos canais oficiais vinculados ao domínio bravusbank.com.',
        },
        {
          title: 'Marca e informações',
          text: 'O uso do nome, do brasão e de materiais institucionais deve preservar a identidade visual e não sugerir autorizações ou parcerias inexistentes.',
        },
        {
          title: 'Atualizações',
          text: 'Não há comunicados de imprensa publicados neste momento. Novas informações aparecerão aqui com data e origem identificadas.',
        },
      ],
      action: ['Conhecer a Bravus', '/empresa/sobre'],
    },
    contato: {
      icon: ContactRound,
      eyebrow: 'Empresa',
      title: 'Contato',
      lead: 'Canais organizados para atendimento, segurança e solicitações institucionais.',
      sections: [
        {
          title: 'Clientes',
          text: 'Para assuntos da conta, acesse o ambiente autenticado. Isso permite identificar o titular e tratar a solicitação com segurança.',
        },
        {
          title: 'Segurança',
          text: 'Nunca informe senha, código de acesso ou documentos fora dos fluxos oficiais do aplicativo e do domínio bravusbank.com.',
        },
        {
          title: 'Solicitações institucionais',
          text: 'Os canais públicos adicionais serão divulgados nesta página depois de validados. Desconfie de contatos que prometam liberação de valores mediante pagamento antecipado.',
        },
      ],
      action: ['Entrar para atendimento', '/login'],
    },
  },
};

const relatedLinks = {
  produto: [
    ['Conta Digital', '/produto/conta-digital'],
    ['Cartões', '/produto/cartoes'],
    ['Transferências', '/produto/transferencias'],
    ['Investimentos', '/produto/investimentos'],
  ],
  empresa: [
    ['Sobre', '/empresa/sobre'],
    ['Carreiras', '/empresa/carreiras'],
    ['Imprensa', '/empresa/imprensa'],
    ['Contato', '/empresa/contato'],
  ],
};

export default function InstitutionalPage({ section }) {
  const { slug } = useParams();
  const page = pages[section]?.[slug];
  const enhancement = institutionalEnhancements[section]?.[slug];

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [section, slug]);

  if (!page) return <Navigate to="/" replace />;

  const Icon = page.icon;
  const contentSections = [...page.sections, ...(enhancement?.moreSections || [])];

  return (
    <main>
      <section className="container-app pb-14 pt-12 sm:pb-20 sm:pt-16">
        <Link className="inline-flex items-center gap-2 text-sm text-ink-300 transition-colors hover:text-white" to="/">
          <ArrowLeft className="h-4 w-4" /> Voltar ao início
        </Link>

        <div className="mt-10 max-w-3xl">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-gold-400/10 text-gold-300">
            <Icon className="h-6 w-6" />
          </div>
          <p className="mt-6 text-xs font-semibold uppercase text-gold-300">{page.eyebrow}</p>
          <h1 className="mt-3 font-display text-4xl font-bold text-white sm:text-5xl">{page.title}</h1>
          <p className="mt-5 text-lg leading-relaxed text-ink-200">{page.lead}</p>
        </div>
      </section>

      <section className="border-y border-white/10 bg-white/[0.02]">
        <div className="container-app divide-y divide-white/10">
          {contentSections.map((item, index) => (
            <article className="grid gap-3 py-9 md:grid-cols-[160px_1fr] md:gap-10" key={item.title}>
              <div className="text-xs font-semibold uppercase text-gold-300">
                {String(index + 1).padStart(2, '0')}
              </div>
              <div className="max-w-3xl">
                <h2 className="font-display text-xl font-semibold text-white">{item.title}</h2>
                <p className="mt-3 leading-relaxed text-ink-300">{item.text}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      {enhancement?.gallery && (
        <EditorialGallery
          description={enhancement.galleryDescription}
          items={enhancement.gallery.items}
          sheet={enhancement.gallery.sheet}
          title={enhancement.galleryTitle}
        />
      )}

      {enhancement?.faqs?.length > 0 && (
        <section className="border-y border-white/10 bg-white/[0.02]">
          <div className="container-app py-14 sm:py-20">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase text-gold-300">Perguntas frequentes</p>
              <h2 className="mt-3 font-display text-3xl font-semibold text-white sm:text-4xl">Informações importantes</h2>
            </div>
            <div className="mt-8 divide-y divide-white/10 border-y border-white/10">
              {enhancement.faqs.map(([question, answer]) => (
                <details className="group py-5" key={question}>
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-6 font-medium text-white">
                    {question}
                    <span className="text-xl font-normal text-gold-300 transition-transform group-open:rotate-45" aria-hidden="true">+</span>
                  </summary>
                  <p className="mt-3 max-w-4xl pr-10 leading-relaxed text-ink-300">{answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="container-app py-14 sm:py-20">
        <div className="flex flex-col justify-between gap-8 border-b border-white/10 pb-12 md:flex-row md:items-end">
          <div>
            <div className="inline-flex items-center gap-2 text-sm font-medium text-gold-300">
              <ShieldCheck className="h-4 w-4" /> Informação clara e acesso protegido
            </div>
            <h2 className="mt-3 font-display text-2xl font-semibold text-white">Próximo passo</h2>
          </div>
          <Link className="btn-primary w-full justify-center md:w-auto" to={page.action[1]}>
            {page.action[0]} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <nav aria-label={`Outras páginas de ${page.eyebrow}`} className="mt-10">
          <p className="text-xs font-semibold uppercase text-ink-400">Veja também</p>
          <div className="mt-4 grid gap-px overflow-hidden rounded-lg border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-4">
            {relatedLinks[section].map(([label, to]) => (
              <Link
                className="flex min-h-14 items-center justify-between bg-ink-950 px-4 text-sm font-medium text-ink-200 transition-colors hover:bg-white/5 hover:text-white"
                key={to}
                to={to}
              >
                {label} <ArrowRight className="h-4 w-4 text-gold-300" />
              </Link>
            ))}
          </div>
        </nav>
      </section>
    </main>
  );
}
