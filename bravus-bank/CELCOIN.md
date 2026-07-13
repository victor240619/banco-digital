# Celcoin Pix provider

The Bravus backend can use Celcoin as the external Pix cash-out provider.
Enable it with environment variables on the backend runtime:

```env
BRAVUS_BANKING_PROVIDER_MODE=CELCOIN

CELCOIN_AUTH_URL=https://sandbox.openfinance.celcoin.dev
CELCOIN_BASE_URL=https://sandbox.openfinance.celcoin.dev
CELCOIN_DICT_PATH=/pix/v1/dict/v2/key
CELCOIN_PIX_PAYMENT_PATH=/baas/v2/pix/payment

CELCOIN_CLIENT_ID=replace-with-client-id
CELCOIN_CLIENT_SECRET=replace-with-client-secret

CELCOIN_DEBIT_ACCOUNT=replace-with-celcoin-payment-account
CELCOIN_DEBIT_BRANCH=replace-with-branch
CELCOIN_DEBIT_TAX_ID=replace-with-tax-id-digits
CELCOIN_DEBIT_ACCOUNT_TYPE=CACC
CELCOIN_DEBIT_NAME=Bravus Bank
CELCOIN_PAYER_ID=replace-with-payer-document-digits
```

When the transfer is made by Pix key, Bravus first calls Celcoin DICT
(`/pix/v1/dict/v2/key`) and then submits the Pix payment using the returned
`endToEndId`. When the transfer is made by manual bank data, Bravus submits the
payment with `initiationType=MANUAL`.

For production, Celcoin requires the contracted product, homologation, Bearer
authentication, mTLS certificate/key, and IP allow-listing. The Java runtime can
load the client certificate through JVM SSL properties, for example:

```env
JAVA_TOOL_OPTIONS=-Djavax.net.ssl.keyStore=/run/secrets/celcoin-keystore.p12 -Djavax.net.ssl.keyStorePassword=replace -Djavax.net.ssl.keyStoreType=PKCS12
```

Never commit Celcoin credentials, certificates, or production account data to
the repository.
