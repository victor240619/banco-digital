# Access incident: 2026-11-21

Production baseline: master `47f612ca5488fa4e6accda7783448eb6cec729fc`.
Repository: https://github.com/victor240619/banco-digital

## Confirmed defects

- Render Free startup took 87 seconds, exceeding the frontend's 20-second timeout.
- Login caught every backend exception and returned `400 Invalid username or password`, including database and signing failures. This prevents distinguishing a bad credential from an infrastructure failure.
- Browser/password-manager autofill populated the DOM without React change events. The login button stayed disabled and state-based submission could miss those credentials. Reproduced with synthetic browser data before fixing.

## Changes

- Allow 120 seconds for login only. Preserve the existing 20-second default for other requests. Do not automatically replay login or financial requests.
- Show a waiting status after 10 seconds and a useful timeout message.
- Add independent accessible visibility controls to all three password fields in the edited login/first-access screen. Values stay in the native form; toggles do not submit it.
- Read login and first-access values with native FormData, retaining browser-required validation. Use distinct form keys so a previous password or visibility state cannot carry into first-access fields. Do not retain passwords in React state. Describe numeric access as requiring prior enrollment.
- Keep invalid/inactive credentials rejected. Unexpected authentication failures return `503 AUTH_SERVICE_UNAVAILABLE`. Logs contain exception class names only, with no request, password, token, exception text or connection string.
- Add deterministic tests reproducing the timeout boundary, rejected network requests, stale sessions, administrator login, inactive accounts, database failure and signing failure.

## Verification and rollout gates

The startup test failed on the original timeout. Two backend tests failed because database/signing failures were reported as invalid credentials. After correction: complete Maven suite 76 tests, zero failures/errors/skips; production Vite build passed; login-startup, auth-session, account-data-isolation, native-production-origin and app-entry checks passed. Local browser checks verified masked defaults, independent visibility, keyboard operation and zero form submissions from toggling.

No schema, account, balance, password, role, payment configuration or ledger changes are included. Tests use synthetic data and disposable local databases only.

Health `UP` and rejection of an invalid synthetic login are not proof that a real client or administrator can sign in. The owner still reported invalid-credential errors after startup. The remaining failure must be diagnosed using the protected runtime logs and read-only account checks; never reset accounts or change passwords to conceal it.

Rollback: redeploy the baseline commit above for both Render services. All database migrations remain byte-for-byte unchanged. The current free instance can still sleep; increasing the client timeout does not remove that infrastructure limitation. No paid upgrade is authorized by this change.

## Browser autofill regression fixture

For local testing only, copy `.openai/fixtures/login-autofill.html` to `bravus-bank-frontend/incident-autofill-qa.html`, start Vite on localhost, and open that file. Remove the temporary copy before building or publishing. The fixture injects only synthetic values through its visible controls and replaces the HTTP adapter; it must never be included in a production artifact.

Verified: autofill without change events; native empty-field rejection with zero requests; independent password visibility without submission; one preserved-value login reaching a synthetic admin route; initial-password form remount with empty fields; mismatched confirmation rejected without an API call; corrected autofill completes first access with exactly two total requests (login plus password completion). No production login or password reset is performed by this fixture.

Read-only account checks in the configured Supabase project found six active users, two admin and four user role assignments, main password hash lengths of 60 and zero enrolled numeric-access passwords. The stored hashes themselves were not selected or copied. The owner still needs to confirm the identifier and credential type used in the rejected production attempt; do not infer a successful account recovery from these checks.
