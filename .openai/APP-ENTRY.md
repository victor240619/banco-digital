# Account-only app entry

- Native Android/iOS entry: `/app` on the existing production origin.
- Installed web app entry: `/app`, retaining the original manifest identity `/`.
- Native bridge initialization happens before rendering. Standalone iOS/PWA,
  the app user-agent, and older Android WebViews also select account-only UI.
- `/app` remembers presentation mode only within the current tab. It is not an
  authentication flag and cannot grant a native API channel, role or account access.
- App routes include login, account creation, password reset, identity completion
  and existing protected dashboards. Institutional routes are not registered in
  app mode; unknown routes return to login or the authenticated account.
- The ordinary browser website and existing account/session/API contracts remain.

## Verification

Run `npm ci` and `npm run build` in `bravus-bank-frontend`, then run
`node .openai/test-app-entry.mjs` from the repository root. The regression suite
renders the real route guards and navigation with synthetic page/auth fixtures;
it does not access customers or production APIs. It covers 30 redirect cases,
native/PWA/legacy detection, blocked storage, reload, public auth pages,
protected dashboards, role restrictions and unaffected website routes.

Also run the existing authentication, account-isolation and D1 regression tests.
The D1 suite requires a test-only artifact (`BRAVUS_SITES_TEST_BUILD=1`); build
the production artifact separately with that variable absent.

## Release and recovery

The existing APK loads its UI from production, so the web correction does not
require replacing its signing key or account identifiers. The bundled APK in
`public/downloads` is still version 1.3.0 / code 4. This change does not replace
that binary. A newly distributed native package must be rebuilt and signed with
the original release key; do not substitute a debug key or new application ID.

The preceding production source is
`3a23f4de006abcc4edcfa22cdf5e674b108f5ffa`, Sites version 82. Restore that saved
version to roll back the web presentation. No schema, balances, credentials,
account records, biometric evidence or server authorization is migrated here.
