# Real-System Proof Log

This is the durable, dated record of what `brisk-aitesting` learned from real
applications. It is append-only: later runs add a new entry or explicitly
supersede an earlier result; they do not silently rewrite an old failure into a
pass.

## 2026-08-03: Directus, Medusa, and n8n first-readiness achievement

### Why these applications were selected

The three applications expose different foundations, so one narrow application
cannot make the product look more general than it is:

- Directus exposes database structure and permissions through REST and GraphQL.
- Medusa joins products, inventory, pricing, carts, orders, workflows, events,
  and jobs into connected commerce state.
- n8n executes webhook/manual workflows containing nodes, branches, waits,
  retries, failures, and later multi-worker behavior.

They are applications under test. Their names may identify a report, but must
not select compiler operations, payloads, permissions, outcomes, or cleanup
rules.

### Exact systems used

| Application | Runtime | Official source revision | Local address |
| --- | --- | --- | --- |
| Directus | 12.2.0 | `b1d7a45a77661fd13928a53448c06649f36b56f5` | `http://127.0.0.1:18055` |
| Medusa | 2.18.0 with PostgreSQL 16 | `efab588e9ce621f998be4ec4431f5b15486aaac0` | `http://127.0.0.1:19000` |
| n8n | 2.32.7 | `0839326a9ba41ecb85a72b71ffc15fe42a15364b` | `http://127.0.0.1:15678` |

The official clones were shallow, exact, and clean. Directus and n8n used
versioned official containers. Medusa used the official generated sibling
application because its source repository is not the recommended standalone
application startup path.

### What was tested, how, why, and what happened

| Test | Why it matters | How it was tested | Actual result |
| --- | --- | --- | --- |
| Exact source identity | A result is not reproducible if the tested code is unknown or locally altered. | Compared every clone's official remote, exact commit, application path where required, and dirty-file count with `versions.json`. | Three exact clones found; all matched; 0 dirty paths. |
| Secret isolation | Local credentials must not enter source or reports. | Verified `.env.local` exists, is ignored by Git, and readiness output never contains the Directus access token. | Secret file ignored; `tokenPrinted` false. |
| Shared application description | The product needs one foundation-level model rather than three vendor-specific compiler paths. | Validated identity, loopback address, allowed host, secret-reference names, data boundary, cleanup rule, readiness request, authoritative sources, and capability labels for every app. | 27 of 27 common-description checks passed. |
| Directus expected refusal | A deliberate denied attempt must still execute and must not be confused with an untested case. | Called `/server/health` without authentication, then logged in with the isolated administrator reference and called it again. | Anonymous request returned expected HTTP 403; login and authenticated health returned HTTP 200; release 12.2.0; status `ok`. |
| Directus warning handling | A working but degraded service is different from a stopped service. | Read the runtime-reported status and problem checks; accepted only `ok` or `warn`, retaining warning details. | Current run `ok`; an earlier `warn` remained classified ready-but-degraded rather than down. |
| Medusa package completeness | A generated folder is not proof that required packages installed. | Ran frozen installation in offline mode after the network-assisted install. | Already up to date; offline verification passed. |
| Medusa database setup | An empty database cannot support commerce scenarios. | Ran the official `medusa db:migrate` path and queried the isolated database read-only. | Migration completed; 143 public tables. Initial data contained 4 products, 1 region, 1 sales channel, and 20 inventory items. |
| Medusa readiness separation | A healthy database does not prove that the HTTP application is running. | Reported PostgreSQL health and `/health` independently; overall readiness requires both. | Database and application ready; `/health` returned HTTP 200 with body `OK`. |
| n8n readiness | A container start alone does not prove the workflow service can answer. | Called the documented `/healthz/readiness` address. | HTTP 200 with status `ok`. |
| Safe process ownership | A helper must not kill an unrelated process merely because it uses the expected address. | Helper records its own Medusa process identity, refuses an unrecorded ready process, then performs owned stop and restart. | Ready → not ready → ready passed; database followed the same stop/start boundary. |
| Safe reset refusal | Destructive cleanup must require an exact conscious confirmation. | Called reset without `--confirm-disposable-data`. | Reset refused with exit 1 and an actionable confirmation message; no data was deleted. |
| Combined readiness honesty | The whole lab must not pass while one required application is absent. | Calculated the expected combined answer independently from Directus, Medusa database, Medusa app, and n8n readiness. | Earlier database-only Medusa state correctly produced false; current all-ready state produces true. |

### Executable result

`npm run smoke:real-system-lab` produced:

- 27 common-application-description checks;
- 3 diagnosis checks;
- 3 secret-safety checks;
- 14 source/application-path integrity checks;
- 3 combined-readiness reporting checks;
- 7 Directus checks;
- 2 Medusa checks;
- 3 n8n checks;
- 1 proof-limit check;
- 2 reset-safety checks;
- 1 setup-file check.

Total: **66 checks; 66 passed; 0 failures; 0 skips.** Directus, Medusa
database, Medusa application, and n8n were all ready. TCV-0032 records the test
digest, authoritative inputs, exact denominator, dimensions, and exclusions.

The engineering-record gate also passed: 93 requirements, 23 capabilities, 21
claims, 6 decisions, and 32 test-coverage records parsed; all 14 deliberately
malformed governance examples were caught; 0 failures and 0 skips. Those 14 are
documentation-integrity examples, not application test cases.

The knowledge was also tested as part of the distributed product rather than
left only in the working repository. The package proof contained 123 files,
required all 23 selected runtime and guide paths including this log and the
change-gate guide, resolved all 27 tested internal documentation links,
installed the tarball into a clean temporary project, and imported the installed
public package successfully with 0 errors.

### Defects and important discoveries retained

| Discovery | Why the first conclusion was unsafe | Correction |
| --- | --- | --- |
| Directus rejected the first disposable email. | A configured identity is not proof that the application accepts it. | Used an accepted isolated email and reset only exact disposable Directus data. |
| Random encryption keys changed across restarts. | Persisted data could no longer be read, so startup was not repeatable. | Stable values live only in the ignored local environment file. |
| Internal-only Docker networking did not publish Windows host ports. | Container configuration showed bindings, but the laptop could not call them. | Used bridge networking with explicit `127.0.0.1` bindings. |
| Compose shutdown without all profiles returned success while volumes remained. | Exit code zero did not prove cleanup. | Reset includes all profiles and exact labelled-volume verification. |
| n8n still attempted MCP registry refresh after general telemetry controls. | Disabling telemetry did not cover a separate module. | Disabled the `mcp-registry` module explicitly. |
| Medusa package requests received HTTP 429. | A partial generated app was not runnable proof. | Waited for a compliant install; did not bypass lockfile or package-safety checks; verified offline afterward. |
| Port 9000 had a listener but Medusa health hung. | A listening port was incorrectly treated as possible application ownership. | Identified Zscaler as the owner and moved Medusa to the manifest's isolated port 19000; required the actual HTTP response. |
| Combined readiness originally depended only on Medusa database health. | The lab could pass without the Medusa app. | Kept database/application states separate and required both. |
| Helper diagnosis initially checked Git ignore from the wrong root. | It could falsely say the secret file was not protected. | Resolved the actual project root and added a regression check. |
| Directus `warn` was initially treated as down. | A degraded but answering service lost useful diagnostic meaning. | Preserved `warn` as ready-but-degraded and retained failed check details. |
| Detached Medusa startup could lose its success JSON on process exit. | Humans saw container output but automation missed the helper result. | Made helper output synchronous and reran the helper-owned start proof. |

REG-0019 and REG-0020 retain root causes, wider-pattern searches, systemic
corrections, counterexamples, affected results, and remaining exclusions.

### What this achievement does not prove

This is real-system setup and readiness proof. It does **not** yet prove that a
packed clean-installed `brisk-aitesting` can discover, compile, execute,
explain, and clean business scenarios in all three applications. It also does
not prove normal least-privilege identities, permission matrices, schema drift,
interrupted mutation recovery, n8n queue mode, Medusa Redis/distributed mode,
cross-platform process control, production load, or production security.

Those limits are why the cross-architecture programme remains open even though
the first-readiness achievement is complete.
## 2026-08-03: First complex real-AI Directus execution

This is the first proof in this programme where a configured real model's
response was consumed by the connected semantic pipeline and executed against
a real target application. It is not a fixture result and not a readiness
check.

The run created a disposable Directus collection with required `title`, state
field `status`, and optional `secret_note`; a non-admin role and policy; an
access link; create/read/update permissions; and an active least-privilege
user. The normal journey used only that user. A separate cleanup authorization
was kept in process memory by environment-variable reference and redacted from
evidence and output.

The configured MiniMax model returned one connected intent. Trusted code mapped
its six ordered business actions to runtime/host operations, passed the created
item ID into later reads, update, verification, and refused delete, then added
one deterministic cleanup operation. Actual results were:

- create valid article: HTTP 200, passed;
- read the same captured article: HTTP 200, passed;
- update it to published: HTTP 200, passed;
- read and assert `data.status` equals `published`: HTTP 200, passed;
- attempt create without required title: expected HTTP 400, passed;
- attempt delete without permission: expected HTTP 403, passed;
- cleanup with isolated cleanup identity: HTTP 204, passed.

The logical journey passed 1/1 with 100% pass rate, 0 failed, 0 skipped, and 0
errors. After product cleanup, an administrator observation found 0 matching
test items. The harness then deleted the disposable user, three permissions,
access link, policy, role, and collection; every deletion returned 204, and
residual role/policy queries returned 0. No credential or identifier value was
printed.

Important defects and corrections discovered on the path:

1. Directus live OpenAPI incorrectly led the first setup shape toward a nested
   `fields` request that returned 403; runtime-supported `collection + meta +
   schema` succeeded, with fields added through `/fields/{collection}`.
2. The default Directus 12.2.0 entitlement blocks selective custom field rules.
   Full-field action permissions were used without bypassing the license;
   hidden-field proof remains open.
3. A `.test` user email was rejected by live Directus validation; a disposable
   `example.com` address was accepted.
4. The first AI attempt lacked CA forwarding and failed before planning. The
   existing trusted CA parameter was then reused; TLS verification was never
   disabled.
5. The compiler rejected the next real AI intent because durable create lacked
   cleanup. Runtime secret-reference resolution and an isolated cleanup
   operation were added.
6. Validation then rejected routes absent from discovery, and later confused
   refusal and cleanup operations sharing the same DELETE path. One contract
   list now feeds evidence, discovery, and authoritative-operation records;
   stable operation identity separates same-route meanings.
7. The first executed journey passed 6/7 operations but the published-state
   assertion used a nested object where the engine expects a JSON path. The
   corrected `data.status` assertion produced the final 7/7 pass.

Limits: this run used the working-tree build, not a fresh packed install. It
does not prove Directus UI, normal GraphQL, selective hidden-field rules,
forced cleanup failure, schema/permission drift, other operating systems,
Medusa, n8n, or production readiness.

## 2026-08-03: Directus packed-install real-AI repetition

The same complex Directus API journey was repeated through the path available
to an installing user. The command built `brisk-aitesting-0.2.0.tgz` (125 files,
989,394 unpacked bytes), created a newly emptied npm project, installed the
tarball, copied only the external test driver into that project, and loaded the
product by its installed package name. The child proof explicitly reported
`productLoad: clean-installed-package`; it could not satisfy this marker by
using the repository-relative product import.

The configured real MiniMax response was consumed. It proposed six ordered,
connected business actions. Trusted product code supplied the exact Directus
routes, methods, bodies, expected statuses, captured article identifier,
published-state check, permission expectation, cleanup identity, and cleanup
operation. All seven executed operations passed: create, dependent read,
publish update, published-state verification, expected HTTP 400 for a missing
required title, expected HTTP 403 for an unauthorized delete, and cleanup. The
logical result was 1/1 passed with 0 failures, 0 skips, and 0 errors. The final
matching article count, residual role count, and residual policy count were all
0; every harness deletion returned HTTP 204; no credential was printed.

Two launcher defects occurred before any AI-planned business operation ran.
Windows rejected direct spawning of `npm.cmd`, then npm lifecycle text appeared
before the JSON package report. The launcher now invokes npm through its actual
Node entry point and extracts only the final JSON report. REG-0024 preserves
these failures and their corrections.

Limits: this proves one packed-install Directus API journey on local Windows
with one configured provider. It does not prove Directus UI or GraphQL,
selective hidden-field permissions, forced cleanup failure, model comparison,
token/cost capture, other operating systems, Medusa, n8n, or production.

## 2026-08-05: Lab readiness regression (55 of 66 checks passed)

This entry supersedes the "66 checks; 66 passed" result above as the latest
lab state. It was recorded late: the failing run happened on 2026-08-05, but
this log was only corrected on 2026-08-11. That delay was itself a mistake —
this log is append-only exactly so a newer failure is never hidden behind an
older success.

`npm run smoke:real-system-lab` on 2026-08-05 (retained in
`real-system-lab-output.log`) reported:

- 66 checks; 55 passed; **11 failures**; 0 skips.
- Directus: not ready (no answer at its address, login not possible, release
  pinning not confirmed) — 7 failures.
- Medusa: database still `starting` — 1 failure.
- n8n: not ready (no answer at its readiness address) — 3 failures.

The most likely cause is simple: the Docker lab was not running or not
finished starting when the check ran. That does not soften the record — the
lab was not ready, so the earlier "all ready" state was no longer true on that
day. The readiness proof from 2026-08-03 remains true for 2026-08-03 only.

What this entry does not change: clone-integrity, secret-safety,
common-description, diagnosis, reset-safety, and configuration checks all
still passed (55 of 66). What it does change: no current claim of "all three
applications ready" may cite this log until a newer dated entry shows a fully
passing run.

## 2026-08-11: Real-AI Directus journey repeated after the core-engine fixes

`npm run smoke:real-ai-directus` against live Directus 12.2.0 with the real
MiniMax model (`MiniMax-M3`) passed 1/1 logical journeys (7/7 operations:
create, dependent read, publish update, published-state verification,
expected HTTP 400, expected HTTP 403, cleanup 204). Residual role and policy
re-queries returned 0. No credential printed.

New in this run, produced by the product itself for the first time:
- honest check counts in the result (requested 1, understood 1, ready 1,
  not ready 0);
- AI usage in the result (1 call, 0 errors, 1,190 tokens in, 1,783 out) with
  request/answer fingerprints and a retained redacted answer record — the
  evidence the validation gate has required all along but nothing computed.

Kept defect: the first attempt failed before planning because MiniMax's
strict mode rejects map-shaped values in the intent schema, introduced
2026-08-10 and never exercised against a real model until now. The schema
now uses a named list; the passing run proves the fix. Kept summary:
`docs/proofs/2026-08-11-directus-real-ai-journey.md`.

Limits: one API journey, one provider, working-tree build, local Windows.

## 2026-08-11: First real-AI Brisk pub-sub journey

`npm run smoke:real-ai-brisk` against the real Brisk platform (sibling
project at `127.0.0.1:3000` with its own Postgres/Kafka/Redis/RabbitMQ)
passed 1/1 logical journeys (8 operations): create channel, create topic
using the captured channel id, publish a message, read it back from that
exact topic, expected refusal of a topic without a name, and cleanup of the
topic and channel. Final channel re-query: 0 matching. No credential printed.
AI usage: 1 MiniMax call, 1,258 tokens in, 1,546 out, with retained records.

The executed cleanup steps carry step-scoped value names
(`<step_action_1_1.briskChannelId>`, `<step_action_2_2.briskTopicId>`),
proving on a real product that each delete targets the resource created by
that exact step.

Kept defect: the first attempt stopped at admin sign-in with HTTP 500 —
the Brisk server was running but its database and broker containers had
exited. A health page answering 200 does not prove dependencies are alive.
Kept summary: `docs/proofs/2026-08-11-brisk-real-ai-journey.md`.

Limits: one API journey, one provider, local Windows. Brisk UI journeys,
consumers under load, and in-Brisk platform integration remain open.

## 2026-08-11: Lab readiness restored (66 of 66 checks passed)

`npm run smoke:real-system-lab` passed 66/66 with 0 failures and 0 skips.
Observed readiness: Directus true, Medusa database true, Medusa application
true, n8n true, overall true. This supersedes the 2026-08-05 regression entry
as the current lab state.

Kept detail: the Medusa application repeatedly failed the lab helper's fixed
120-second readiness window on this machine — not because it was broken, but
because a cold `medusa develop` boot takes longer than that here. For this
run it was started directly and answered its health address once boot
finished. Follow-up: the helper's readiness window should be configurable
instead of hardcoded at 120 seconds.

Limits: readiness only. It does not prove business scenarios on Medusa or
n8n; the executed business journeys proven today are the Directus and Brisk
API journeys recorded above.
