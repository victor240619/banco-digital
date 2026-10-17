# Frontend on the existing Render account

Prepared on 2026-10-17. This deployment uses the existing repository and Render
account. It does not deploy, recreate, migrate or delete the backend or databases.
Do not apply the root `render.yaml` to provision this frontend: it also declares
backend and database resources.

## Published configuration

- Static site: `vantyx-bank-frontend` (`srv-db9qjcvbtjjs73cn5ac0`).
- URL: `https://vantyx-bank-frontend.onrender.com`.
- Repository: `https://github.com/victor240619/banco-digital`.
- Source branch: `master`; source commit:
  `47f612ca5488fa4e6accda7783448eb6cec729fc`.
- First deployment: `dep-db9qjd7btjjs73cn5aq0` (Render reported Live).
- Root directory: `bravus-bank-frontend`.
- Build: `npm ci --ignore-scripts && npm run build`.
- Publish directory: `dist`.
- Build variable: `VITE_API_URL=/api` (public configuration, not a secret).
- Node: package engine `22.x`; Render selected `22.23.3`.
- Auto-Deploy: Off. PR previews: Off.

Rewrite rules must remain in this order:

| Source | Destination | Action |
| --- | --- | --- |
| `/api/*` | `https://bravus-bank-api.onrender.com/api/*` | Rewrite |
| `/*` | `/index.html` | Rewrite |

The API rule forwards to the existing service `srv-d89feirbc2fs73f5vqa0`.
Keep it before the SPA fallback to prevent API errors from becoming HTML pages.
Do not put credentials or database connection strings into frontend build variables.

## Custom domains

`vantyxbank.com` and its `www` alias have been added to the frontend's custom
domain setup. Render specifies A `216.24.57.1` for the apex and CNAME
`vantyx-bank-frontend.onrender.com` for `www`. Render redirects `www` to the apex.

GoDaddy confirmed the apex A replacement and removal of the remaining old A
record after hardware-key verification. The apex now has one A record,
`216.24.57.1`, TTL 600. Google's public DNS returned this target. Render reports
the apex as Verified / Certificate Issued. An HTTPS request with DNS resolution
explicitly pinned to the new IP returned HTTP 200, a Render response identifier,
and the published `index-DFx8TpE4.js` asset reference, with normal TLS validation.

GoDaddy also confirmed the `www` CNAME update after its separate hardware-key
verification. The CNAME is `vantyx-bank-frontend.onrender.com.`, TTL 3600, and
Google's public DNS returned this target. Both custom domains now show Verified /
Certificate Issued in Render. An HTTPS request for `www` pinned to the assigned
Render IP returned HTTP 301 to `https://vantyxbank.com/`, with normal TLS validation.

All other DNS records, nameservers, mail settings and the legacy `bravusbank.com`
host were preserved. No Sites project, D1 binding or customer record was deleted.

## Verification and rollback

The existing API's public `/actuator/health` returned HTTP 200 with `status=UP`.
Render's build completed successfully. Published `index.html`, its JavaScript
asset and SPA routes returned HTTP 200, including the plain root and login paths
after the initial pre-deployment CDN 404 cache expired. During DNS cutover, this
machine retained the old apex IP alongside the new IP in its resolver cache;
connections to that old IP returned Cloudflare 1034. Connections to the new IP
served the correct Render build. After that system resolver cache expired, normal
HTTPS requests to the apex, `/login`, `/register`, and `/app` returned HTTP 200,
and the apex referenced the exact Render build asset. Edge continued to reuse an
old route in an existing tab; another tab loaded the previous build. DNS/browser
caches can therefore still affect individual clients during propagation. Preserve
browser sessions and security settings while those caches expire. The published
Render deployment and both certificates were verified independently of that cache.
An empty JSON POST to `/api/auth/login` returned the same HTTP 403 through the
proxy and directly from the backend, with `Cache-Control: no-store`. No real
credentials, bank accounts or financial operations were used for testing.

Run these synthetic tests from the repository root:

```sh
node .openai/test-app-entry.mjs
node .openai/test-auth-session.mjs
node .openai/test-account-data-isolation.mjs
node .openai/test-native-production-origin.mjs
```

All four passed. Authenticated production behavior and customer data consistency
were not tested. Preserve the previous Sites deployment and its D1 binding;
deleting that deployment is outside this frontend-only cutover. This also keeps
a recovery path while account data authority and legacy clients are verified.

Original DNS values, recorded before the cutover:

| Type | Name | Value | TTL seconds |
| --- | --- | --- | --- |
| A | `@` | `162.159.143.30` | 3600 |
| A | `@` | `172.66.3.26` | 600 |
| CNAME | `www` | `custom-domains.chatgpt.site.` | 3600 |

If the cutover fails, restore these values and verify HTTPS against the previous
deployment. The preserved `https://bravusbank.com/` rollback host returned HTTP 200.
Protected DNS changes require the owner's GoDaddy security key. Do not reset or
import customer data as part of a DNS rollback.

References: [Render rewrites](https://render.com/docs/redirects-rewrites) and
[custom domains](https://render.com/docs/custom-domains).
