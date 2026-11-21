# Access incident: 2026-11-21

Production baseline: master `47f612ca5488fa4e6accda7783448eb6cec729fc`.
Repository: https://github.com/victor240619/banco-digital

## Confirmed defects

- Mobile APK still loads the legacy `https://bravusbank.com` origin. Its live frontend uses the canonical `https://vantyxbank.com/api`. Render's runtime CORS_ORIGIN still contained only historical DuckDNS/Vercel origins, despite render.yaml specifying both official domain pairs. OPTIONS from the legacy origin to the canonical API reproducibly returned 403 Invalid CORS request before login could run.
- Render Free startup took 87 seconds, exceeding the frontend's 20-second timeout.
- Login caught every backend exception and returned `400 Invalid username or password`, including database and signing failures. This prevents distinguishing a bad credential from an infrastructure failure.
- Browser/password-manager autofill populated the DOM without React change events. The login button stayed disabled and state-based submission could miss those credentials. Reproduced with synthetic browser data before fixing.

## Changes

- Restore Render CORS_ORIGIN to the exact four HTTPS origins already specified in render.yaml: vantyxbank.com, www.vantyxbank.com, bravusbank.com and www.bravusbank.com. No wildcard, authentication bypass, APK replacement, domain redirect or database migration. Environment-only deploy reuses backend commit b31e81ab64a0d8a46fe4e248a7fdd6c9cc8125fc. Deployment: dep-dc0i9hp7lnhs738oi3fg. `.openai/test-production-cors.mjs` checks all four origins through both API paths and rejects an unrelated origin using credential-free OPTIONS only.
- Allow 180 seconds for login only. The initial 120-second fix was insufficient: the canonical production route later took 121.11 seconds to return. Preserve the existing 20-second default for other requests. Do not automatically replay login or financial requests.
- Show a waiting status after 10 seconds and a useful timeout message.
- Add independent accessible visibility controls to all three password fields in the edited login/first-access screen. Values stay in the native form; toggles do not submit it.
- Read login and first-access values with native FormData, retaining browser-required validation. Use distinct form keys so a previous password or visibility state cannot carry into first-access fields. Do not retain passwords in React state. Describe numeric access as requiring prior enrollment.
- Keep invalid/inactive credentials rejected. Unexpected authentication failures return `503 AUTH_SERVICE_UNAVAILABLE`. Logs contain exception class names only, with no request, password, token, exception text or connection string.
- Add deterministic tests reproducing the timeout boundary, rejected network requests, stale sessions, administrator login, inactive accounts, database failure and signing failure.

## Verification and rollout gates

The startup test failed on the original timeout. Two backend tests failed because database/signing failures were reported as invalid credentials. After correction: complete Maven suite 76 tests, zero failures/errors/skips; production Vite build passed; login-startup, auth-session, account-data-isolation, native-production-origin and app-entry checks passed. Local browser checks verified masked defaults, independent visibility, keyboard operation and zero form submissions from toggling.

No schema, account, balance, password, role, payment configuration or ledger changes are included. Tests use synthetic data and disposable local databases only.

Health `UP` and rejection of an invalid synthetic login are not proof that a real client or administrator can sign in. The owner still reported invalid-credential errors after startup. The remaining failure must be diagnosed using the protected runtime logs and read-only account checks; never reset accounts or change passwords to conceal it.

Mobile follow-up: the environment-only deployment succeeded in 1m46s. `node --use-system-ca .openai/test-production-cors.mjs` passed all ten production OPTIONS checks: four exact trusted origins accepted on each API path, unrelated origin rejected on both. A nonexistent synthetic login sent with the legacy app origin now reaches authentication (400 with exact Access-Control-Allow-Origin) instead of failing CORS. Unauthenticated user and admin endpoints still return 403. No real credential was submitted. This verifies restoration of the cross-origin connection, not successful login for a real customer. The owner was asked to retry the installed app; no password reset was performed. The legacy frontend still has its older 20-second timeout, so a sleeping free instance remains a separate limitation.

The prior runtime CORS list was `https://bravusbnk.duckdns.org,https://bravus-bank.vercel.app,https://bravus-bank-*.vercel.app`. Record it for incident traceability only: restoring it would reintroduce the confirmed mobile outage. An application rollback should retain the corrected four-domain runtime value.

Rollback: redeploy the baseline commit above for both Render services. All database migrations remain byte-for-byte unchanged. The current free instance can still sleep; increasing the client timeout does not remove that infrastructure limitation. No paid upgrade is authorized by this change.

## Canonical domain timeout follow-up

At 09:04:52 BRT on 2026-11-21, a nonexistent synthetic login sent through
https://vantyxbank.com/api/auth/login took 121.11 seconds to return the expected
400 response. This is a measured server-path latency exceeding the published
120-second client deadline. The updated deterministic adapter reproduces that
boundary without waiting: the prior code fails with ECONNABORTED, while the
180-second login deadline allows it. Transport errors and timeouts still reject
without automatic replay, and unrelated banking requests retain 20 seconds.
Waiting feedback now says up to three minutes; fallback text does not attribute
the failure to the customer's internet.

The owner declined a paid API instance; that selection was canceled before
saving. After clarifying that both installed app and current browser were
affected, the owner explicitly authorized the free compatibility service for
the installed app's hardcoded legacy origin. Its configuration, API preservation
contract, DNS confirmation gate and rollback are recorded in
LEGACY-COMPATIBILITY.md. No database, account, password or balance migration
occurred. The original APK has not been replaced. Real account sign-in remains
a separate acceptance gate.
Rollback for this timeout follow-up alone: redeploy frontend commit
8e1539661c758acd30c8e98d872f88b4ef9942ba; retain the API and corrected CORS setting.

## Browser autofill regression fixture

For local testing only, copy `.openai/fixtures/login-autofill.html` to `bravus-bank-frontend/incident-autofill-qa.html`, start Vite on localhost, and open that file. Remove the temporary copy before building or publishing. The fixture injects only synthetic values through its visible controls and replaces the HTTP adapter; it must never be included in a production artifact.

Verified: autofill without change events; native empty-field rejection with zero requests; independent password visibility without submission; one preserved-value login reaching a synthetic admin route; initial-password form remount with empty fields; mismatched confirmation rejected without an API call; corrected autofill completes first access with exactly two total requests (login plus password completion). No production login or password reset is performed by this fixture.

Read-only account checks in the configured Supabase project found six active users, two admin and four user role assignments, main password hash lengths of 60 and zero enrolled numeric-access passwords. The stored hashes themselves were not selected or copied. The owner still needs to confirm the identifier and credential type used in the rejected production attempt; do not infer a successful account recovery from these checks.
