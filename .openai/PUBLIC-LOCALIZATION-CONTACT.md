# Public localization and contact — 2026-09-19

Baseline: d2f5ab702aac4d2ea9c1264558dfcbe190204750 (published Sites version 88).
Rollback: republish that saved version. No database migration or runtime binding changes.

## Scope and isolation

- Public institutional pages detect the visitor's browser language. Portuguese
  locales use `pt-BR`, Spanish locales use `es`, and all other locales use `en`.
- A visible selector lets visitors override the detected language. The preference
  is stored only in browser local storage. No IP geolocation, tracking request,
  account identifier or authenticated data is used.
- The automatic language applies to the public home, navigation, footer, core
  institutional content and core support-channel content. Existing extended
  Portuguese galleries and FAQs remain available in Portuguese; they are omitted
  in English and Spanish rather than shown partially translated.
- The public contact email is `Contact@vantyxbank.com`, with a warning not to send
  passwords, temporary codes or personal documents by email.
- Authentication, admin authorization, account ownership, balances, ledger,
  transfers, receipts, KYC, databases, migrations and mobile app entry are unchanged.

## Excluded representations

The supplied Cayman and Isle of Man addresses, telephone numbers and company names
were not published. The current official Cayman National contact page identifies
the Peter A. Tomkins Building, 62 Forum Lane and 4-8 Hope Street as Cayman National
locations and identifies Cayman National Bank Ltd. and Cayman National Securities
Ltd. as the licensed entities. Rebranding those details as Vantyx would be an
unverified institutional representation.

Reference checked: https://www.caymannational.com/about/support/contact-us

## Verification contract

- Locale detection, manual override, unsupported-language fallback and blocked
  local-storage behavior are deterministic and covered by a focused test.
- The frontend production build must pass.
- Public assets must contain the requested contact email and must not contain the
  excluded Cayman National addresses, names or telephone numbers.
- Existing authentication, account-isolation and native-entry regressions must pass.
