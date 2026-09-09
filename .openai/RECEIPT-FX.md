# Receipt and currency quote change

Scope: receipt presentation and export; USD-source currency quote simulation.
Risk: high because the UI describes financial transactions. No account, ledger,
authentication, payment-provider, migration or production deployment changes.
Recoverable baseline: d1417e1cb2a3682f46e8a6f0fac985e6b34db12f.
Sites history confirms saved version 86 uses that exact baseline commit;
this change creates no Sites version and deploys nothing.

## Contract and boundaries

- The existing authorized receipt response feeds one immutable presentation model.
  Screen, exported HTML and PDF retain the same amount, parties, date and status.
  CPF/CNPJ are masked and accounts show only their last four characters.
- Download and share use the same PDF Blob. Unsupported browser sharing downloads
  that PDF, never a dashboard URL. Native save/share adapters remain unchanged.
- Internal records do not imply external settlement. Pending, failed, reversed
  and simulated records use explicit labels instead of a success check.
- jsPDF 4.2.1 replaces the hand-written single-page PDF encoder. The PDF engine is
  loaded on demand. Long fields wrap and paginate; Portuguese accents are retained.
  The real existing Vantyx logo and Lucide icons are reused.
- /dashboard/cambio is inside the existing authenticated dashboard. USD is fixed;
  users choose any of the 30 listed ECB-reference destination currencies.
  BRL is only the initial selection. Existing remittance routes are preserved.
- Quotes use Frankfurter v2 with providers=ECB, without keys, account identifiers,
  authorization headers or amounts in the request. Date and source are visible.
  Quotes older than seven days, invalid quotes and network errors fail closed.
  There is no invented offline rate. Same-currency selection has rate one.
- Conversion uses integer arithmetic, rounds once at the destination minor unit,
  and clears the result when amount, currency or quote changes.
- This is reference-rate simulation, NOT a balance conversion, executable FX
  offer or real-time trading quote. It excludes fees, spread and taxes.
  Existing accounts have a BRL balance, not an independently funded USD wallet.
  Real conversion requires verified separate currency balances and settlement;
  this change neither relabels BRL as USD nor creates/debits/credits any balance.

The safe alternative to changing existing BRL account semantics was an isolated
quote panel. Implementing new currency ledgers or provider integration is outside
this presentation change.

## Verification

Passed: test-receipt-model-actions, test-exchange-quotes, test-receipt-pdf,
test-native-receipt-documents, test-account-data-isolation, test-auth-session,
test-currency-exact, test-registration-flow, test-registration-draft,
test-native-production-origin, test-document-camera, test-app-entry,
test-domain-migration, test-sites-d1 and test-d1-migrations.

The D1 worker ran only with BRAVUS_SITES_TEST_BUILD=1 in a scoped temporary
directory, FakeD1 and in-memory SQLite. Production was never a test fixture.
The initial domain test lacked its generated worker; it passed after creating
the isolated test artifact. No database or ledger source changed.

Browser checks: fixed USD; live USD/BRL, USD/EUR and USD/JPY quotes; invalid zero;
old results cleared on destination changes; real browser PDF generation;
receipt modal close, keyboard focus loop and focus restoration; 320/426 widths.
All 30 supported destinations were checked against the live quote endpoint.
PDF checks: byte-identical repeated generation, original Blob retained by both
actions, PDF parsing, one-page normal receipt, multi-page long receipt, accents,
full long text after ignoring page-number footers, and visual page inspection.

Run from repository root:

    node .openai/test-receipt-model-actions.mjs
    node .openai/test-exchange-quotes.mjs
    node .openai/test-receipt-pdf.mjs
    node .openai/preview-receipt-fx.mjs

The PDF test additionally needs sharp available to Node; VANTYX_TEST_DEPENDENCIES
can point to an existing dependency runtime. Generated PDFs stay in tmp/pdfs.
The component preview uses synthetic data only and is excluded from the Vite
production entry. Build with npm run build in bravus-bank-frontend.

## Limitations and release gate

- Native OS share sheets and saving on physical Android/iOS devices were not
  exercised. JavaScript/native adapter dispatch and binary preservation passed.
- Uncommon non-Latin scripts in PDF fonts require a separate font-coverage pass.
- The project's lint command is a placeholder, not an actual lint gate.
- Tests/build ran on Node 24.20.0; the project still declares Node 20.x.
- npm audit --omit=dev reports six pre-existing packages (four high, two
  moderate): @xmldom/xmldom, axios, brace-expansion, react-router,
  react-router-dom and tar. Their locked versions are unchanged. No existing
  package version was upgraded, and no audit advisory targeted newly added
  packages. This is not a full-project security clearance.
- Production publish and physical-device verification remain release gates.
  No investment, Stripe, Mercado Pago, custody or fabricated reserve work is
  included. Keep production at the baseline until explicit publish approval.

Sources: https://frankfurter.dev/ and
https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html
