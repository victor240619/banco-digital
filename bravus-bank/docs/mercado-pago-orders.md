# Mercado Pago Orders — recebimento Pix

Esta integração recebe Pix por uma aplicação Mercado Pago exclusiva da Vantyx.
Ela não usa nem altera a aplicação da CapLimpol e permanece desabilitada quando
`MP_ENABLED` não é `true`.

## Fluxo de segurança

1. O cliente autenticado envia o valor em centavos e uma `Idempotency-Key` para
   `POST /api/payments/mp/orders/pix`.
2. O backend cria uma solicitação local vinculada ao usuário autenticado e usa
   uma segunda chave de idempotência, persistida, ao chamar `POST /v1/orders`.
3. O QR Code não altera o saldo.
4. O endpoint público `POST /api/payments/mp/webhook` valida `x-signature`,
   `x-request-id`, `data.id`, prazo da assinatura e tópico `order`.
5. O backend consulta `GET /v1/orders/{id}` e compara referência externa, valor,
   valor efetivamente pago, moeda e meio de pagamento Pix com a solicitação local.
6. Somente `processed/accredited` gera crédito. Saldo, transação, dois lados do
   ledger e marca de liquidação são gravados na mesma transação serializável.
7. Repetições do cliente, do provedor ou do webhook não geram crédito duplicado.

## Variáveis

```text
MP_ENABLED=false
MP_ACCESS_TOKEN=
MP_WEBHOOK_SECRET=
MP_API_BASE_URL=https://api.mercadopago.com
MP_PIX_MIN_AMOUNT_CENTAVOS=100
MP_PIX_MAX_AMOUNT_CENTAVOS=1000000
MP_PIX_EXPIRATION=PT30M
MP_WEBHOOK_TOLERANCE=PT5M
```

Credenciais devem ficar somente no gerenciador de segredos do ambiente. Nunca
devem ser incluídas em `.env`, logs, banco de dados, frontend ou Git.

A criação de cobrança também exige `MP_WEBHOOK_SECRET` preenchido. Sem essa
chave, o backend retorna `MP_WEBHOOK_NOT_CONFIGURED` (HTTP 503) antes de gravar
uma solicitação ou chamar o Mercado Pago. Isso impede gerar um QR Code pagável
sem a configuração local necessária para validar sua confirmação.

## Ativação segura

- Use primeiro as credenciais de teste da aplicação **Vantyx Bank**.
- Configure o webhook de teste para
  `https://<backend>/api/payments/mp/webhook` e selecione o tópico `order`.
- Execute um pagamento Pix de teste e confirme que o saldo só muda depois do
  webhook assinado e da consulta direta ao provedor.
- Reenvie o mesmo webhook e confirme que saldo, transação e ledger não mudam.
- Simule timeout e reenvio usando a mesma chave de idempotência.
- Não habilite credenciais de produção antes da aprovação contratual da conta e
  de um ensaio de rollback em staging.

## Desativação e rollback

Definir `MP_ENABLED=false` bloqueia novas orders e webhooks antes de qualquer
movimentação. A migração `V23__mercado_pago_orders.sql` é somente aditiva; não
reescreve saldos nem transações anteriores. Registros financeiros já criados não
devem ser apagados durante rollback.
