# Installed-app compatibility

The owner confirmed both browser and installed-app timeouts and explicitly
authorized free compatibility hosting for bravusbank.com. The primary site
remains https://vantyxbank.com. The installed version 1.3.0 / code 4 still
contains https://bravusbank.com as its server URL. No replacement APK, signing
key or application ID is introduced.

Render static service: srv-dc0oep6k1f9s739pmfb0 / vantyx-legacy-frontend.
Public technical URL: https://vantyx-legacy-frontend.onrender.com.
Current frontend source: b71f2367b142238d6a7f535bd0847fc13e205191.
Deployment: dep-dc0okr59el5s73ep6qtg (Live).
Auto-deploy and PR previews are Off. Configuration is recorded separately in
render-legacy-frontend.yaml; do not apply the root render.yaml to recreate it,
because that unrelated blueprint also declares API/database resources.

The updated frontend retains the canonical API already selected by the live
legacy frontend. Its separate /api/* compatibility route must continue to
reach the original Sites worker through its existing platform hostname. The
Sites worker and Spring API are separate implementations with separate
storage. Never silently replace that legacy endpoint with the Spring API,
copy tokens between implementations, or migrate account data as a hosting fix.

Before any DNS change, normal browser access to the prepared static deployment
rendered the corrected login. Its compatibility proxy returned the original
worker's expected 400 response for a nonexistent synthetic login. No real
credential was submitted. Both production builds completed successfully.

The API remains on Render Free: the owner declined the paid upgrade. The
workspace showed 1 of 2 included domains before this compatibility binding,
then 2 of 2. No paid compute instance is created for this static frontend.

## DNS confirmation gate

GoDaddy currently requires the owner's security-key confirmation for the
first apex A record update. Until the saved records are observed, do not claim
the app cutover is complete. The pre-change 19-record DNS snapshot is retained
locally outside Git.

Authorized apex changes: A @ 162.159.143.30, TTL 1800, becomes 216.24.57.1;
then remove A @ 172.66.3.26, TTL 600. Leave www, mail, NS, SOA and TXT records
unchanged. Keeping www on its original hosting avoids Render's generated
www-to-apex redirect affecting another installed origin.

After confirmation, verify authoritative DNS, valid TLS without bypassing a
warning, /app and /login on the unchanged apex origin, the 180-second login
deadline in the served bundle, and the original protected API's unauthenticated
rejection through /api/*. Successful real customer/admin sign-in is a separate
acceptance gate.

Rollback restores A @ 162.159.143.30 with TTL 1800 and recreates A @
172.66.3.26 with TTL 600 if removed. The original Sites deployment and its data
remain intact. Do not delete either backend, the old Site, accounts or ledger.
