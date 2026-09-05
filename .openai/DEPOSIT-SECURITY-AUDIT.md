# Deposit credit audit — 2026-09-05

## Scope and verified findings

This is a targeted source and regression audit of customer-created credits and
legacy payment entry points, not a certification of financial backing or a full
penetration test. No customer production data or real provider payments were used.
Recovery baseline: source `0cd37fe687ba39c6c3a99955080bb57721289875`, Sites 85.

| Finding | Risk | Containment |
| --- | --- | --- |
| `/api/user/deposit` increased the authenticated user's balance from client-supplied amounts with no payment evidence | Critical | Both Workers and Spring now reject with `DEPOSIT_PAYMENT_REQUIRED`; no balance/transaction writes |
| Legacy MP webhook lacked signature validation and credited balances without a unique, owner-bound settlement transaction | Critical | Spring security denies the legacy provider routes; the unsafe handler is not a supported integration |
| Legacy Stripe payment/transfer routes accepted client-selected customer/destination IDs without a funded, owner-bound order | Critical | Spring security denies payment/transfer provider routes, including admin calls |
| Worker withdrawal/legacy transfer amounts allowed non-integer/unsafe numbers | High | Positive safe integer centavos required before financial writes |
| Existing reserve is declared/book credit, not externally evidenced cash | Financial integrity | Declaration and history preserved; no certification, cash conversion or investment payout enabled |

Login, account identifiers, native application identity, internal transfers,
existing statements, KYC evidence and administrative book-credit policy are not
changed. Legacy `/api/transfers` means Stripe transfers, not the preserved
`/api/user/transfer` or `/api/internal-transfers` endpoints.

## Verification

- Existing frontend production build.
- D1 fixture suite: authenticated customer/admin deposit attempts, large amounts,
  forged payment fields, duplicate/concurrent calls, unauthorized calls and
  restart; compare all users, transactions, ledger entries, transfer orders and
  credit grants before/after. Existing internal transfer/idempotency/account
  isolation/reconciliation assertions remain in the same suite.
- Existing app-entry, auth-session, account-isolation, domain-migration, exact
  currency and migration regression tests.
- Spring controller unit test proves repository methods are never called by a
  direct deposit. Security integration tests cover anonymous/customer/admin
  attempts at quarantined providers and authenticated deposit rejection.
- No production database API mutation or test customer is required for rollout.

## Existing balances and recovery

Do not delete old deposits or overwrite customer balances automatically. Assess
historical deposits against independent settlement evidence in a separately
authorized reconciliation. Any correction must use attributed compensating
entries, not deletion of posted history. This patch makes no such adjustments.

Sites 85 is an emergency application recovery baseline, but it contains the
self-credit vulnerability. Do not restore it without retaining deposit denial
or equivalent containment. No schema or migration is changed by this patch.

## Stripe / Mercado Pago integration boundary (not activated)

Legacy controllers are quarantined, not newly implemented provider adapters.
Adding keys alone must not reopen them. Before a supported adapter can credit:

1. Confirm provider approval for the actual business/product and operator.
2. Create a durable, authenticated owner-bound deposit intent with integer BRL
   centavos, server-selected receiving business account and unique idempotency
   key. Do not accept a receiving account or customer identity from the client.
3. Store secret/restricted keys and webhook secrets only in the hosting secret
   manager. Admin configuration may reference a verified receiving account and
   secret name, never return keys to the browser or persist them in Git/history.
4. Call the provider server-side with the same intent reference/idempotency key.
   A successful redirect or client notification is never payment proof.
5. Validate signed webhook raw bytes, timestamp/replay bounds and event type;
   retrieve authoritative payment details and verify exact amount, BRL currency,
   merchant, environment, intent owner and paid/settled state.
6. Atomically claim a unique `(provider, payment_id)` settlement, post balanced
   ledger entries, update the same owner's balance and record an immutable audit.
   Retries must return the original result without crediting again. Failed or
   ambiguous callbacks must not be acknowledged as successful settlement.
7. Reconcile actual available funds, fees, refunds and chargebacks. Refunds use
   compensating entries and cannot be funded by unrelated customer deposits.

References: [Stripe restricted businesses](https://stripe.com/legal/restricted-businesses),
[Mercado Pago signed notifications](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-preferences/payment-notifications).
API connectivity and contractual approval are distinct from financial custody,
bank authorization and proof of backing.

## Investment requirement recorded, not activated

Requested terms: one principal contribution; simple monthly return equal to 40%
of that original principal; principal and returns unavailable until 12 months.
For BRL 1,000, the requested arithmetic is BRL 400/month and BRL 5,800 at month
12 including principal (BRL 4,800 return). This is not a projection or guarantee
of economic performance and must not be advertised as a live funded product.

The current declared/book-credit reserve cannot be certified by software as real
assets. No fictitious backing, certificate, investment subscriptions, custody
transfer to an admin, interest accrual, reserve debits or payout route are added.
Real activation requires externally verifiable backing, operator authorization,
custody/segregation and contract terms, and tested settlement/reserve controls.
