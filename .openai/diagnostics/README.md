# Original-account verification

Local support tool outside the production frontend. Run from the repository:

    node .openai/diagnostics/serve-original-login.mjs

Open http://127.0.0.1:53121/ and let the owner enter and submit their own
existing credentials. Do not read the fields or capture filled-form screenshots.
Only inspect the status message. Never ask for the password in chat. Stop the
local server after verification.

The server serves three fixed files on loopback only, accepts GET only and
does not read or log request bodies. CSP blocks native form submission and
restricts browser fetch to the fixed original bank API. The password is sent
directly by HTTPS to https://bravusbank.com/api/auth/login with no cookies,
redirects or automatic replay. The ordinary backend login may update its own
authentication audit/credential metadata. No reset, balance or transfer endpoint
is called. A successful test's returned token stays in function memory and is
used only to log out that new session. A failed logout is explicitly reported;
neither token nor account data is returned to the screen.

Default UI uses masked passwords, an independent eye/eye-off button, keyboard
operation, native required validation and FormData for autofill. It clears
entered values when the owner submits. The browser's own password manager is
under the owner's control; the tool never saves credentials.

Tests: node .openai/test-original-login-probe.mjs. They use synthetic responses
only. Browser UI QA at /?qa=1 blocks all login submissions and provides a
synthetic-value preservation check; never use QA mode for the owner's check.
Verified: required empty fields; default masking; keyboard show/hide retaining
a synthetic value; toggling does not submit; no bank request during UI QA;
fixed HTTPS recipient; no token/account payload exposed; logout of only the
test session; no retries; rejected, restricted, network-error and logout-error
paths. An automation read of a protected field did not expose its value; the
page's synthetic-only comparison verified preservation without extracting it.

This tool distinguishes the old account source from the independent Spring
database. A match is evidence about that account, not authorization to merge
databases, change roles or route financial transactions between ledgers.
