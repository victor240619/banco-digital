# Bravus Cayman Rail

## Arquitetura

O Bravus Cayman Rail e um trilho bancario proprio, operado como camada interna
do Bravus Bank para preparo regulatorio, roteamento, auditoria e liquidacao
controlada. Ele nao simula autorizacao bancaria: a operacao publica fica
bloqueada ate que a entidade tenha registro corporativo, licenca aplicavel da
CIMA, politica AML ativa e participantes habilitados.

Componentes:

- `cayman_rail_config`: entidade, jurisdicao, numero de registro, licenca CIMA,
  status regulatorio, modo de liquidacao e trava de producao.
- `cayman_rail_participants`: diretorio de participantes internos, bancos,
  money services businesses, correspondentes e participantes de teste.
- `cayman_rail_instructions`: ordens idempotentes de pagamento, com resultado
  de compliance, status operacional e gate regulatorio.
- `CaymanRailService`: aplica as regras de prontidao, KYC, AML basico, status
  de liquidacao e bloqueio de dinheiro real sem licenca.
- `CaymanRailController`: API administrativa em `/api/admin/cayman-rail`.

## Fases

### Fase 1 - Base license-gated

- Registrar configuracao Cayman/CIMA dentro do sistema.
- Criar participantes do trilho proprio.
- Criar ordens de pagamento com idempotencia.
- Bloquear dinheiro real em `BLOCKED_LICENSE_REQUIRED` ate o gate estar pronto.
- Validar usuario de origem com KYC automatico.
- Marcar beneficiario sem documento CPF/CNPJ como `MANUAL_REVIEW_REQUIRED`.

### Fase 2 - Compliance operacional

- Adicionar perfis de risco Cayman, PEP/sancoes internas, limites por cliente,
  revisao em quatro olhos e trilha de aprovacao.
- Adicionar upload/versionamento de politicas AML, board approval e evidencias.

### Fase 3 - Liquidacao licenciada

- Habilitar `LIVE_LICENSED` somente com registro, licenca, participantes ativos
  e ambiente de producao aprovado.
- Integrar mensageria propria, conciliacao diaria, extratos e rejeicoes.

### Fase 4 - Operacao resiliente

- Assinatura criptografica de mensagens, HSM/segredos, monitoramento 24/7,
  alta disponibilidade, disaster recovery e reporting regulatorio.

## Gate de producao

O sistema so considera o trilho pronto quando:

- `registryNumber` esta preenchido.
- `regulatoryStatus` e `LICENSED`.
- `cimaLicenseNumber` esta preenchido.
- `settlementMode` e `LIVE_LICENSED`.
- `productionEnabled` e `true`.
- Existe pelo menos um participante `ACTIVE`.

Sem isso, ordens ficam bloqueadas para dinheiro real.
