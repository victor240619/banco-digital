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
