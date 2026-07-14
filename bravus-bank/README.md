# Bravus Bank

Serviço Spring Boot com integração Stripe para planos e pagamentos.

## Requisitos
- Java 17+
- Maven 3.8+
- Variáveis de ambiente (veja `.env.example`)

## Endpoints
- `GET /api/plans` — lista planos: 99,90; 134,00; 489,00 (BRL)
- `POST /api/customers` — cria cliente (PF/PJ)
- `POST /api/subscriptions` — cria sessão de checkout para assinatura
- `POST /api/payments` — cria PaymentIntent com taxa 10% (Connect opcional)
- `POST /api/stripe/webhook` — webhook de eventos

## Execução
```bash
export STRIPE_API_KEY=sk_test_...
export STRIPE_WEBHOOK_SECRET=whsec_...
export STRIPE_FEE_PERCENT=10
mvn -f bravus-bank/pom.xml spring-boot:run
```

## Recuperacao de senha

O fluxo publico aceita CPF, e-mail ou usuario sem revelar se a conta existe.
Contas elegiveis recebem um desafio de captura facial pela camera. A evidencia
fica criptografada com AES-256-GCM e aguarda revisao de um administrador
autorizado contra a biometria cadastrada na abertura da conta.

Depois da aprovacao, o cliente pode definir uma nova senha uma unica vez dentro
do prazo da solicitacao. A troca incrementa a versao da credencial e invalida
os tokens JWT emitidos anteriormente. Nenhum saldo ou lancamento financeiro e
alterado por esse processo.

Em producao, configure `BRAVUS_BIOMETRIC_KEY` com 32 bytes aleatorios em Base64.
Sem essa chave, novas evidencias biometricas nao devem ser aceitas em producao.
