const gallery = (slug, items) => ({
  sheet: `/images/galleries/${slug}.png`,
  items: items.map(([title, alt]) => ({ title, alt })),
});

export const institutionalEnhancements = {
  produto: {
    'conta-digital': {
      gallery: gallery('conta-digital', [
        ['Acesso pelo celular', 'Cliente consultando a conta digital pelo celular em uma marina'],
        ['Visão financeira', 'Notebook exibindo uma visão financeira digital organizada'],
        ['Entrada protegida', 'Autenticação segura de uma conta em um dispositivo móvel'],
        ['Extratos organizados', 'Cliente analisando movimentações e documentos digitais'],
        ['Suporte remoto', 'Atendimento remoto prestado por uma especialista financeira'],
        ['Conexão internacional', 'Vista de Cayman conectada a serviços financeiros digitais'],
      ]),
      galleryTitle: 'A conta no seu dia a dia',
      galleryDescription: 'Uma visão prática dos principais momentos de uso da conta, do acesso protegido ao acompanhamento das movimentações.',
      moreSections: [
        {
          title: 'Cadastro e análise de dados',
          text: 'A abertura exige informações consistentes, documentos válidos e verificação de identidade. Divergências podem gerar pedido de correção ou análise adicional antes da liberação completa dos serviços.',
        },
        {
          title: 'Movimentações e comprovantes',
          text: 'Operações concluídas devem aparecer no histórico com data, valor, participantes, identificador e comprovante. Atualizações da aplicação não devem apagar registros persistidos.',
        },
        {
          title: 'Moeda, limites e disponibilidade',
          text: 'A interface utiliza KYD. Limites e funções disponíveis variam conforme o perfil, o status da conta, a análise interna e a disponibilidade operacional de cada serviço.',
        },
      ],
      faqs: [
        ['Como acesso minha conta?', 'Use a página de login ou o aplicativo oficial. No aplicativo, a sessão é encerrada ao sair ou colocar o app em segundo plano.'],
        ['O saldo pode desaparecer após uma atualização?', 'Não. Dados financeiros persistidos devem permanecer no histórico e ser reconciliados com os lançamentos da conta.'],
        ['Por que uma função pode não aparecer?', 'Alguns serviços dependem do status da conta, análise, elegibilidade e disponibilidade do respectivo trilho operacional.'],
        ['Onde encontro comprovantes?', 'Depois de autenticado, consulte a área de movimentações ou extratos e abra o detalhe da transação correspondente.'],
      ],
    },
    cartoes: {
      gallery: gallery('cartoes', [
        ['Produto elegível', 'Cliente segurando um cartão bancário sem dados visíveis'],
        ['Pagamento por aproximação', 'Pagamento seguro por aproximação em um terminal comercial'],
        ['Controles digitais', 'Configurações de segurança de cartão em um celular'],
        ['Uso em terminais', 'Cliente utilizando cartão em um caixa eletrônico genérico'],
        ['Viagens e organização', 'Cartão sem dados ao lado de uma carteira de viagem'],
        ['Suporte de segurança', 'Especialista auxiliando cliente em assunto relacionado a cartão'],
      ]),
      galleryTitle: 'Controle e segurança do cartão',
      galleryDescription: 'Informações para acompanhar um produto elegível, proteger o uso e agir rapidamente em situações de perda ou suspeita.',
      moreSections: [
        {
          title: 'Elegibilidade e emissão',
          text: 'A existência da área de cartões não representa aprovação automática. Oferta, bandeira, emissão, entrega e ativação dependem de produto disponível, análise e termos apresentados ao cliente.',
        },
        {
          title: 'Limites e autorizações',
          text: 'Limites podem variar por produto e perfil. Compras podem ser recusadas por saldo, limite, segurança, indisponibilidade da rede ou restrições aplicáveis ao estabelecimento e à localização.',
        },
        {
          title: 'Perda, roubo e contestação',
          text: 'Em caso de perda ou uso não reconhecido, interrompa o uso do cartão pelos controles disponíveis e procure os canais oficiais. Uma contestação exige análise e não equivale a reembolso automático.',
        },
      ],
      faqs: [
        ['A conta já inclui um cartão?', 'Não necessariamente. A disponibilidade depende de elegibilidade, emissão e condições específicas do produto.'],
        ['Posso usar qualquer caixa eletrônico?', 'Somente terminais compatíveis com o cartão emitido. Disponibilidade, limites e tarifas podem variar por rede e localidade.'],
        ['O que fazer se perder o cartão?', 'Use imediatamente os controles disponíveis e contate os canais oficiais da bandeira e do emissor.'],
        ['Como consultar limites?', 'Quando houver cartão associado, os limites e o status serão exibidos na área autenticada do produto.'],
      ],
    },
    transferencias: {
      gallery: gallery('transferencias', [
        ['Confirmação do destinatário', 'Duas pessoas conferindo uma transferência em um celular'],
        ['ACH e EFT local', 'Empresário acompanhando uma operação local em um notebook'],
        ['Wire internacional', 'Profissional acompanhando conexões financeiras internacionais'],
        ['Dados do beneficiário', 'Cliente revisando informações de beneficiário em um tablet'],
        ['Comprovante digital', 'Confirmação de operação exibida em um celular'],
        ['Reconciliação operacional', 'Analista monitorando liquidação e reconciliação de transferências'],
      ]),
      galleryTitle: 'Da instrução ao comprovante',
      galleryDescription: 'Cada etapa precisa preservar os dados do destinatário, o status da operação e a rastreabilidade do lançamento financeiro.',
      moreSections: [
        {
          title: 'Dados obrigatórios',
          text: 'O remetente deve conferir beneficiário, conta, instituição, valor, moeda e finalidade. Operações internacionais podem exigir endereço, SWIFT/BIC do banco participante e banco correspondente.',
        },
        {
          title: 'Processamento e status',
          text: 'Uma solicitação pode ficar em análise, processamento, concluída, recusada ou revertida. A interface só deve informar sucesso depois da confirmação definitiva da operação aplicável.',
        },
        {
          title: 'Custos, câmbio e prazo',
          text: 'Tarifas, conversão cambial e prazo dependem do tipo de transferência e das instituições participantes. As condições aplicáveis devem ser apresentadas antes da confirmação quando disponíveis.',
        },
      ],
      faqs: [
        ['Qual a diferença entre transferência interna, ACH/EFT e Wire?', 'A interna ocorre entre contas Bravus elegíveis; ACH/EFT é um trilho local; Wire é uma instrução internacional que pode envolver bancos correspondentes.'],
        ['Uma transferência pode ser duplicada?', 'O sistema deve usar controles de idempotência para impedir que a mesma solicitação confirmada seja debitada duas vezes.'],
        ['Quando o comprovante fica disponível?', 'Depois que a operação alcança o status confirmado aplicável e o lançamento está persistido.'],
        ['Uma conta nova pode transferir?', 'A permissão depende do status e da análise da conta. Contas em análise podem estar limitadas a receber valores.'],
      ],
    },
    investimentos: {
      gallery: gallery('investimentos', [
        ['Visão de carteira', 'Profissional analisando uma carteira de investimentos em um notebook'],
        ['Orientação e objetivos', 'Conversa entre cliente e profissional sobre objetivos financeiros'],
        ['Planejamento de longo prazo', 'Pessoa registrando metas ao lado de gráficos financeiros'],
        ['Análise empresarial', 'Empresário estudando documentos de investimento'],
        ['Pesquisa de mercado', 'Analista acompanhando tendências de mercados globais'],
        ['Planejamento patrimonial', 'Conversa de planejamento financeiro com vista para o mar'],
      ]),
      galleryTitle: 'Informação antes da decisão',
      galleryDescription: 'Investir exige compreender objetivo, prazo, liquidez, custos e risco. As imagens representam etapas de análise, não promessa de resultado.',
      moreSections: [
        {
          title: 'Perfil e adequação',
          text: 'A disponibilidade de produtos depende de elegibilidade e avaliação de adequação. Objetivos, experiência, horizonte e tolerância a risco devem ser considerados antes de qualquer contratação.',
        },
        {
          title: 'Risco, liquidez e custos',
          text: 'Investimentos podem oscilar e gerar perdas. Prazo de resgate, tributação aplicável, taxas e demais custos precisam ser apresentados nas condições específicas do produto.',
        },
        {
          title: 'Posição e documentos',
          text: 'Quando houver produto contratado, a área autenticada deve organizar posição, movimentações e documentos disponibilizados pelas instituições responsáveis pela oferta ou custódia.',
        },
      ],
      faqs: [
        ['Esta página recomenda algum investimento?', 'Não. O conteúdo é informativo e não constitui recomendação, oferta ou garantia de retorno.'],
        ['Todos os clientes podem investir?', 'Não necessariamente. Acesso depende de produto disponível, jurisdição, documentação e elegibilidade.'],
        ['Existe rendimento garantido?', 'Não se deve presumir garantia. Risco e condições variam por produto e precisam ser avaliados antes da decisão.'],
        ['Onde consulto minha posição?', 'Quando houver carteira disponível, ela será exibida na área autenticada com as informações fornecidas pelo produto aplicável.'],
      ],
    },
  },
  empresa: {
    sobre: {
      gallery: gallery('sobre', [
        ['Equipe multidisciplinar', 'Equipe de tecnologia financeira colaborando em um escritório'],
        ['Produto e engenharia', 'Profissionais revisando uma interface bancária digital'],
        ['Risco e conformidade', 'Equipe analisando controles e documentação operacional'],
        ['Experiência do cliente', 'Workshop colaborativo sobre experiência financeira'],
        ['Operação segura', 'Especialista acompanhando sistemas e operações digitais'],
        ['Foco em Cayman', 'Vista do litoral e distrito empresarial das Ilhas Cayman'],
      ]),
      galleryTitle: 'Como a Bravus é construída',
      galleryDescription: 'Produto, engenharia, segurança, operações e atendimento trabalham juntos para manter uma experiência clara e rastreável.',
      moreSections: [
        {
          title: 'Tecnologia e dados',
          text: 'A plataforma combina interfaces web e móvel, serviços de autenticação, controles administrativos e persistência financeira. Mudanças devem preservar histórico e compatibilidade com os clientes existentes.',
        },
        {
          title: 'Governança operacional',
          text: 'Ações sensíveis precisam de autorização, trilha de auditoria e revisão. Operações financeiras não devem ser apagadas; correções devem manter evidência e rastreabilidade.',
        },
        {
          title: 'Evolução responsável',
          text: 'Novos produtos e integrações são incorporados conforme capacidade técnica, parceiros aplicáveis e requisitos legais. A comunicação pública deve diferenciar recursos disponíveis de planos futuros.',
        },
      ],
      faqs: [
        ['Qual é a proposta da Bravus?', 'Oferecer uma experiência financeira digital organizada, com foco em segurança, rastreabilidade e atendimento responsável.'],
        ['Onde a plataforma é acessada?', 'Pelo domínio oficial e pelo aplicativo distribuído nos canais oficiais da Bravus.'],
        ['Como as atualizações preservam os dados?', 'Mudanças devem usar persistência, migrações compatíveis e validação para evitar perda de contas, saldos ou históricos.'],
        ['Como saber se um serviço está disponível?', 'Consulte a área autenticada e as condições exibidas para o produto. Recursos futuros não devem ser tratados como ativos antes da liberação.'],
      ],
    },
    carreiras: {
      gallery: gallery('carreiras', [
        ['Pessoas e colaboração', 'Equipe diversa de tecnologia financeira reunida em um escritório'],
        ['Engenharia segura', 'Profissionais colaborando no desenvolvimento de software'],
        ['Produto e design', 'Equipe conduzindo uma sessão de produto e experiência'],
        ['Operações e risco', 'Profissionais analisando processos operacionais'],
        ['Processo seletivo', 'Candidato participando de uma entrevista profissional'],
        ['Aprendizado contínuo', 'Equipe em uma sessão interna de desenvolvimento profissional'],
      ]),
      galleryTitle: 'Áreas que constroem o produto',
      galleryDescription: 'A Bravus depende de diferentes especialidades trabalhando em conjunto, com responsabilidade técnica e respeito ao cliente.',
      moreSections: [
        {
          title: 'Processo seletivo',
          text: 'Quando houver vaga, a descrição deve informar responsabilidades, requisitos, local ou modalidade de trabalho e etapas previstas. Candidatos devem receber comunicação por canal identificável.',
        },
        {
          title: 'Privacidade de candidatos',
          text: 'Currículos e informações de candidatura devem ser usados apenas para fins relacionados ao processo seletivo e protegidos contra acesso indevido.',
        },
        {
          title: 'Prevenção a fraudes',
          text: 'A Bravus não cobra taxa de inscrição, curso obrigatório ou pagamento para participar de seleção. Mensagens suspeitas devem ser ignoradas e reportadas pelos canais oficiais.',
        },
      ],
      faqs: [
        ['Há vagas abertas agora?', 'As oportunidades ativas serão apresentadas nesta página. A ausência de uma vaga publicada significa que não há processo público anunciado.'],
        ['Como enviar candidatura?', 'Siga exclusivamente o canal indicado na vaga publicada e não envie documentos sensíveis por contatos não verificados.'],
        ['A Bravus cobra para contratar?', 'Não. Nenhuma etapa legítima exige pagamento do candidato.'],
        ['Quais áreas podem ter oportunidades?', 'Engenharia, produto, operações, risco, atendimento, segurança da informação e conformidade estão entre as áreas essenciais.'],
      ],
    },
    imprensa: {
      gallery: gallery('imprensa', [
        ['Porta-voz preparado', 'Profissional preparando informações para uma entrevista'],
        ['Atendimento à imprensa', 'Executivo respondendo perguntas de jornalistas'],
        ['Conteúdo institucional', 'Equipe revisando uma publicação digital'],
        ['Produção de entrevista', 'Equipamentos profissionais preparados para entrevista'],
        ['Eventos e posicionamentos', 'Porta-voz falando em um evento corporativo'],
        ['Revisão de informações', 'Equipe conferindo fatos antes de uma publicação'],
      ]),
      galleryTitle: 'Informação pública com responsabilidade',
      galleryDescription: 'Comunicados, entrevistas e materiais institucionais exigem origem identificada, revisão e linguagem que não crie parcerias ou autorizações inexistentes.',
      moreSections: [
        {
          title: 'Comunicados e arquivo',
          text: 'Publicações futuras devem apresentar título, data, contexto e origem. Correções relevantes precisam ser sinalizadas sem apagar a versão histórica necessária para compreensão.',
        },
        {
          title: 'Solicitações de imprensa',
          text: 'Pedidos de entrevista, dados institucionais e confirmação de informações devem começar pela página de contato, com identificação do veículo e prazo solicitado.',
        },
        {
          title: 'Uso de marca e imagens',
          text: 'O brasão e os materiais da Bravus não podem ser alterados de forma que prejudique a identificação da marca ou sugira endosso, licença ou parceria não confirmada.',
        },
      ],
      faqs: [
        ['Onde estão os comunicados oficiais?', 'Quando publicados, ficarão nesta página e nos canais vinculados ao domínio oficial.'],
        ['Como solicitar entrevista?', 'Use a página de contato e informe veículo, pauta, prazo e dados profissionais para retorno.'],
        ['Posso usar o brasão da Bravus?', 'O uso depende de autorização e deve preservar proporção, cores e integridade visual da marca.'],
        ['Como confirmar uma notícia?', 'Compare a informação com os canais oficiais e solicite confirmação quando o conteúdo não estiver publicado pela Bravus.'],
      ],
    },
    contato: {
      gallery: gallery('contato', [
        ['Atendimento especializado', 'Especialista de atendimento pronta para auxiliar clientes'],
        ['Solicitação pelo aplicativo', 'Cliente iniciando atendimento protegido pelo celular'],
        ['Conversa por vídeo', 'Cliente em atendimento remoto por vídeo'],
        ['Orientação de segurança', 'Profissionais explicando proteção de conta'],
        ['Gestão de solicitações', 'Especialista acompanhando solicitações em sistema interno'],
        ['Acompanhamento claro', 'Cliente recebendo orientação remota em um tablet'],
      ]),
      galleryTitle: 'Atendimento com contexto e segurança',
      galleryDescription: 'O canal correto ajuda a identificar a solicitação, proteger o titular e registrar o acompanhamento sem expor credenciais.',
      moreSections: [
        {
          title: 'Assuntos atendidos',
          text: 'Acesso à conta, atualização de dados, dúvidas sobre movimentações, segurança, documentos e informações institucionais devem ser direcionados ao fluxo correspondente.',
        },
        {
          title: 'Identificação e acompanhamento',
          text: 'Solicitações de clientes devem começar no ambiente autenticado quando possível. O acompanhamento precisa preservar protocolo, histórico e dados suficientes para análise.',
        },
        {
          title: 'Urgências de segurança',
          text: 'Suspeita de acesso indevido, perda de dispositivo ou transação não reconhecida exige troca de senha e contato pelos canais oficiais. Nunca compartilhe código temporário ou senha completa.',
        },
      ],
      faqs: [
        ['Qual é o melhor canal para assuntos da conta?', 'Entre na área autenticada para que a solicitação seja associada ao titular com mais segurança.'],
        ['A Bravus pede senha pelo atendimento?', 'Não. Senha completa e códigos temporários não devem ser informados a atendentes.'],
        ['Como reportar uma transação desconhecida?', 'Reúna os dados visíveis no extrato, proteja o acesso à conta e abra uma solicitação pelos canais oficiais.'],
        ['Onde encontro atendimento geral?', 'A página Canais de atendimento organiza acesso online, suporte assistido e informações sobre terminais compatíveis.'],
      ],
    },
  },
};
