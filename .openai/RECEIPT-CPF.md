# Receipt CPF display correction — 2026-09-09

Baseline: 5b6c1dd24f79258017826322a8ca2263a3cd6ecd (published Sites version 87).
Rollback: republish that saved version; no database migration is involved.

Scope: show the six middle CPF digits as `***.123.456-**` for both parties in
the existing shared receipt model. Screen, exported HTML and downloaded/shared
PDF consume this model. This is a display convention, not identity validation.
Full raw/formatted CPFs and already partially masked CPFs are supported. Unknown
or malformed identifiers stay hidden; unavailable digits are never invented.
CNPJ masking and account-number masking remain unchanged.

Privacy-sensitive presentation / high-risk publication: backend authorization,
account ownership, account records, ledger, balances, currency logic, credentials,
dependencies and migrations are unchanged. No real customer data was used.
The smaller shared-model change avoids diverging screen and export formatters.

Verification: baseline regression passed; the new partial-CPF test failed on
the old implementation and passed after correction. Cases cover both parties,
raw/formatted/already-masked CPF, leading zeros, missing/malformed identifiers,
CNPJ and input immutability. Receipt PDF parsing and visual inspection confirmed
both partial CPFs and no full fixture CPF. Repeated PDF generation is byte-identical;
download/share keep the same Blob. Native receipt adapter, account isolation,
session and currency quote tests passed, as did the production frontend build.
Physical-device share sheets were not retested. Existing dependency warnings
are outside this small patch. Generated PDFs/builds/cache stay out of Git.
