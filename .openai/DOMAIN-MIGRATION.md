# Vantyx production domain

Primary origin: `https://vantyxbank.com`. `https://www.vantyxbank.com`
serves the same deployment and existing D1 binding. Technical Sites page URLs
redirect to the primary origin, preserving path and query. API requests are not
redirected. No database, customer, session, credential or evidence migration is
part of this change. Existing account identifiers (including login emails) and
native application ID `com.bravus.bank` must not be renamed.

The frontend API default and the configuration for future signed native releases
use the new origin. Explicit API environment overrides retain their precedence.
The alternative Spring deployment CORS list accepts both public domain pairs.
Browser sessions remain origin-local: users may need to sign in again on the new
domain; tokens must never be copied into redirect URLs.

## Compatibility and removal gate

Keep both old domain bindings, DNS and HTTPS active. The distributed APK 1.3.0
still opens `https://bravusbank.com`, and existing installed PWAs are also tied to
their installation origin. Serving the same application there keeps its native
bridge, camera and account-only routing intact. Do not redirect those hosts or
cancel their registrations merely because the new domain is live.

Removing the compatibility hosts requires an updated release signed with the
original key, an installation migration plan, and validation that legacy access
is no longer needed. This change does not replace the downloadable APK, change
signing keys or publish to app stores.

## Verification and recovery

Run `node .openai/test-native-production-origin.mjs`,
`node .openai/test-app-entry.mjs`, and existing auth/account-isolation tests.
After building the frontend and `.openai/build-sites-artifact.mjs`, run
`node .openai/test-domain-migration.mjs` with the same temporary directory.
This executes the generated worker without customer data or network access.
Run the D1 suite separately against a test-only build; never publish that build.

Recovery baseline: Sites version 84, source
`554e3b3fdba3e156b15b5ba2d24b5124dc1372a6`. Restore that saved version to
roll back the origin defaults without changing data. Leave the domain bindings
active during recovery. Production packaging must have
`BRAVUS_SITES_TEST_BUILD` unset.
