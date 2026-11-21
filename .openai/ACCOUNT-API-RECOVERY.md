# Existing-account API recovery — 2026-11-21

Risk: critical (production authentication and banking account source).
Contract: restore existing access, preserve vantyxbank.com and its DNS, keep
free hosting, and do not reset passwords, migrate accounts or move money.

## Applied configuration

Primary static service srv-db9qjcvbtjjs73cn5ac0:
- frontend source b71f2367b142238d6a7f535bd0847fc13e205191;
- live deployment dep-dc0okr59el5s73ep6q2g;
- VITE_API_URL=/api;
- /api/* -> https://bravus-bank-240619.victor2406.chatgpt.site/api/*;
- /* -> /index.html (unchanged).

Free legacy compatibility static service srv-dc0oep6k1f9s739pmfb0:
- frontend source 5efec7bf0b7f652af58799ef982637054386d386;
- live deployment dep-dc0p5hm7bikc73bfl6eg;
- identical /api selection and rewrites;
- bravusbank.com apex verified, certificate issued, A record 216.24.57.1;
- original installed APK and signing identity unchanged.

The existing original Sites Worker/D1 stays deployed. The standalone Spring
API srv-d89feirbc2fs73f5vqa0 and its Supabase database remain separate and
intact. Its source is b31e81ab64a0d8a46fe4e248a7fdd6c9cc8125fc.
Payment callbacks and secrets remain on their previously configured service.
Both frontends have auto-deploy off. No master merge or paid upgrade occurred.

## Evidence and acceptance

An owner-controlled original-API login check succeeded and logged out only its
new session. The local diagnostic server was then stopped. After the primary
rewrite was saved and reloaded, the owner confirmed website access. Browser
response metadata showed login and protected admin endpoints returning 200,
including dashboard, users, account requests and ledger views. No private
response payload or credential was collected. The owner subsequently confirmed
that the physical installed application also opened the account.

The smallest safe alternative was to restore this verified original source.
Resetting credentials in the unrelated Spring database could not restore the
original account state and was rejected. No account/balance migration, role
grant, password reset or financial transfer was performed. Normal login audit
writes are expected. This is an access repair, not payout-provider approval or
verification of money movement.

## Recovery controls

The previous primary rewrite was /api/* ->
https://bravus-bank-api.onrender.com/api/*. Its exact local snapshot is retained
outside Git. Restoring it would reconnect the independent database and can
reintroduce the account-source outage; use only after verifying the intended
account source with the owner. Revert only the single route, leaving SPA,
current-domain DNS, secrets and databases untouched. Legacy DNS rollback is
recorded in LEGACY-COMPATIBILITY.md. Preserve both original backends.

Published frontend commits above remain available for exact redeployment.
The incident branch holds later documentation and diagnostics, which are
outside the static frontend publish directory. Local screenshots, DNS/log
snapshots, dependencies, caches and build outputs are excluded from Git.
The disposable checkout is retained for incident rollback and review, not
removed while deployment review is outstanding. Future review/merge must not
replace this account-source routing with the unrelated root blueprint.
