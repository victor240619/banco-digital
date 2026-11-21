# Offline account-capacity measurement

Run `node .openai/measure-account-capacity.mjs` from the repository root.
No deployment, build, credential input or production account creation occurs.
The script disables outbound fetch and uses only synthetic identities, minimal
synthetic images, disposable in-memory state and the existing transactional
fake D1 from the regression suite. Do not add production snapshots or credentials.

The script evaluates the Worker template from build-sites-artifact.mjs with
empty static assets and the existing TEST_ONLY seed. It exercises the original
public-registration handler, including input validation, hashing, encryption,
account creation and registration metadata. UTF-8 JSON bytes are measured after
each registration until they cross 2,000,000 bytes. Counts include the three
initial fixture accounts and exclude real production accounts.

This brackets the documented D1 string/row-size ceiling, not an operational
account allowance. SQL row metadata also consumes space, and existing users,
sessions, transactions and audit history reduce headroom. Encrypted image rows,
indexes, other tables, quotas, CPU limits and actual provider subscription
allowances are separate constraints. The original shared JSON state is read,
normalized and potentially rewritten for every request; account count alone
does not determine throughput.

The concurrency check runs authenticated read-only admin requests through the
actual Worker and its queue against the existing fake D1. It uses the full
synthetic state immediately below the JSON ceiling. An in-memory session for a
fixture administrator is inserted only into that isolated fake database; no
real password or session is used. Successful responses and timing percentiles
describe local Node execution, without network, real D1 latency, deployment CPU
limits, or contention across Worker instances. They are not a guarantee of
production concurrent-user capacity.

Assertions check successful registrations, JSON round-trip, unique account
numbers, the byte boundary and authenticated queue responses. The fixture
locates its administrator by role without using a production credential.

## Synthetic result on 2026-11-21

| New synthetic registrations | Total fixture accounts | Shared JSON bytes |
| --- | --- | --- |
| 0 | 3 | 3,920 |
| 100 | 103 | 435,573 |
| 200 | 203 | 867,873 |
| 400 | 403 | 1,617,473 |
| 500 | 503 | 1,963,773 |
| 510 | 513 | 1,998,403 |
| 511 | 514 | 2,001,866 |

Average added JSON size over the below-limit sample: 3,911 bytes per
registration. Audit retention changes the marginal slope; do not extrapolate
linearly from a single user record. The row/string ceiling was bracketed at
513/514 fixture accounts, not enforced by a real D1 write. This is not the
number of accounts still available in production, whose payload size was not
accessible through the connected database tool.

The local authenticated queue test passed at 1, 5, 10 and 25 concurrent
requests with no errors. At 25, total time was 895 ms and response p95 was
864 ms. These timings describe this host and fake D1 only, not hosted capacity.
Minimal test-image encrypted rows are excluded from the shared JSON measure.

Live measurements, if available, must remain separate from synthetic results.
Public API response sizes are not database row sizes. Keep actual business
counts, screenshots, performance captures and any database metadata outside
this public repository. Do not infer total occupied database bytes when the
database connector cannot access the project.

Reference: https://developers.cloudflare.com/d1/platform/limits/ (checked
2026-11-21): maximum string/BLOB/table-row size 2,000,000 bytes, on both tiers.
The original shared-state design must be considered even if hosting is upgraded.

Only this measurement script and methodology are changed. Existing production
services, DNS, source routing, users, balances, credentials and APK are intact.
The measurement branch can be discarded without a production rollback. Local
reports are excluded from Git; the disposable checkout is retained for review.
