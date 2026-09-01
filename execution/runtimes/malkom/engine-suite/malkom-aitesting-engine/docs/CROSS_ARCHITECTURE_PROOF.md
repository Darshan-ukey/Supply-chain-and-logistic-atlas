# Cross-Architecture Real-System Proof

## Purpose

`brisk-aitesting` is the product being built. Directus, Medusa, and n8n are
large independent applications used to expose weaknesses in that product.
Brisk is another application under test; it is not the only application and it
is not the design centre.

This programme asks a simple question: can the same testing product understand
and safely test applications that work in fundamentally different ways?

The dated commands, observations, exact counts, defects, corrections, and
limits are retained in [REAL_SYSTEM_PROOF_LOG.md](engineering/REAL_SYSTEM_PROOF_LOG.md).
The mandatory rule for testing future product changes across all three systems
is [REAL_SYSTEM_CHANGE_GATE.md](engineering/REAL_SYSTEM_CHANGE_GATE.md).
The exact repository/API/UI depth, current UI shortfall, counting method, and
minimum expansion matrix are in
[REAL_SYSTEM_TARGET_DEPTH.md](engineering/REAL_SYSTEM_TARGET_DEPTH.md).

- Directus turns database structure and permissions into REST and GraphQL APIs.
- Medusa connects commerce information such as products, inventory, carts, and
  orders through multi-step business actions.
- n8n starts and coordinates workflows through manual runs, webhooks, waits,
  failures, retries, and workers.

## What "implemented on an application" means

For this programme, an application is implemented only when all applicable
items below are proven:

1. Its exact official source version is recorded.
2. It starts repeatably in an isolated local environment.
3. `brisk-aitesting` obtains real information from the running application.
4. Tests run from a packed, clean-installed copy of `brisk-aitesting`.
5. Successful actions and deliberately incorrect attempts are both executed.
6. The result says what was attempted and what the application actually said.
7. Created data is isolated and cleanup is attempted and recorded.
8. Test coverage, failures, skips, limits, and remaining gaps are documented.

Downloading a repository proves only that its source was obtained. Starting an
application proves only that its runtime can become ready. Neither result alone
proves that `brisk-aitesting` supports the application.

## How results must be explained

An **expected refusal** is a test that deliberately attempts something the
application should not allow, such as reading a hidden field without
permission. The attempt still runs. If the application refuses it for the
expected reason, the test passes. If it permits the action, returns the wrong
reason, crashes, or never answers, the test does not pass.

Every result must state:

- the exact action attempted;
- the identity or permission level used, without revealing its secret;
- the information that authorized the attempt;
- the actual status and safe response details returned by the application;
- why that response was or was not expected;
- what data was created or changed;
- whether cleanup completed and what may remain.

The following information states are distinct:

- **full**: every value required by the authoritative operation description is
  present and valid;
- **partial**: some useful values are present, but at least one required value
  is absent;
- **missing**: the required operation or required input cannot be established
  from the available authoritative information;
- **invalid**: a supplied value is present but violates the authoritative type,
  format, range, or allowed-value rule;
- **refused**: the application received the attempt and intentionally denied it;
- **failed**: the observed behavior did not match the expected application
  behavior;
- **cleaned**: every test-created item covered by the cleanup plan is confirmed
  absent or returned to its prior state;
- **residual**: something created or changed by the test may remain and its next
  safe action is recorded.

When information is partial or missing, `brisk-aitesting` must first try the
appropriate allowed information sources. It may use published contracts,
GraphQL schema inspection, runtime responses, application metadata, and
explicit user input. It must not invent a route, operation, payload, permission,
or cleanup action from a name that merely looks plausible.

## Authoritative information

The following order is used for this programme:

1. the pinned official source and its published versioned contract or schema;
2. authenticated metadata from the exact running application;
3. observed runtime responses from the exact isolated test environment;
4. explicit test configuration supplied for that environment.

AI suggestions and vendor-name shortcuts are never executable authority.

## Pinned source and first runnable versions

| Application | Official source clone | Source revision | First runnable version | License relevant to this local proof |
| --- | --- | --- | --- | --- |
| Directus | `C:\Users\u306076\Documents\azure-pubsub\directus` | `b1d7a45a77661fd13928a53448c06649f36b56f5` | `12.2.0` | Monospace Sustainable Core License 1.0; internal testing is listed as a permitted purpose |
| Medusa | `C:\Users\u306076\Documents\azure-pubsub\medusa` | `efab588e9ce621f998be4ec4431f5b15486aaac0` | `2.18.0` | MIT |
| n8n | `C:\Users\u306076\Documents\azure-pubsub\n8n` | `0839326a9ba41ecb85a72b71ffc15fe42a15364b` | `2.32.7` | Sustainable Use License, with separately licensed enterprise files; local development and testing stay within the stated use |

Source revisions record what was inspected. The first runnable version records
the stable application release used for initial live proof. If these differ,
the report must not imply that the default-branch source itself was built.

## Startup choices and tradeoffs

### Directus

The first proof uses the official versioned Directus container with SQLite and
private persisted storage. This follows the official self-hosting route, avoids
the repository's database-debug Compose file, and avoids changing the laptop's
Node version. Source-build proof remains a separate open task.

### Medusa

The core source repository is not itself the recommended standalone test
application. Medusa's contributor instructions require a sibling local Medusa
application. The first proof therefore uses the official application creator,
pinned to Medusa 2.18.0, plus an isolated PostgreSQL container. The storefront
is omitted initially because API and admin proof do not require it. Storefront
proof remains an explicit later task.

### n8n

The first proof uses the official versioned n8n container with isolated local
storage. This is the quickest supported single-process start. Source-build and
queue-mode proof are separate later tasks; queue mode adds PostgreSQL, Redis,
and at least one worker.

## Honest gap list

### Built

- Shared evidence, compilation, lowering, typed-value, result, and reference-app
  foundations exist in `brisk-aitesting`.
- The three official repositories are cloned at clean, recorded revisions.
- Synthetic and small reference applications already exercise parts of the
  shared pipeline.

### Partially built

- Directus and general GraphQL/data-platform support are specified, but a real
  Directus end-to-end proof is not yet complete.
- Cleanup ordering and pre-execution validation exist, while durable mutation
  receipts and interrupted-run recovery remain incomplete.

### Missing

- Real Directus, Medusa, and n8n packed-product scenario results.
- Medusa commerce evidence and n8n workflow evidence providers.
- Full permission, interruption, drift, cleanup, security, and distributed
  worker proof across the three applications.

### Blocked by product decision

- Nothing in initial local setup is currently blocked by a product decision.

### Blocked by external dependency

- No external dependency currently blocks first readiness. Earlier Medusa
  package downloads received HTTP 429 responses, including a bounded 391.6
  second retry. After the network path changed, a frozen offline install check
  passed, proving the required packages were present. The lockfile and package
  safety rules were never bypassed.

## What the first readiness checks will not prove

A healthy response proves only that the selected application process started
and answered its documented readiness request. It does not prove discovery,
permissions, mutation safety, cleanup, interruption recovery, drift handling,
security, complete architecture support, or release readiness.

## Current readiness result

The repeatable local helper and TCV-0032 currently report:

| Application part | Observed result | Plain meaning |
| --- | --- | --- |
| Directus application | ready | Anonymous health details were refused with HTTP 403 as expected; isolated authenticated health returned HTTP 200 and status `ok`. |
| Medusa database | ready | The isolated PostgreSQL container is healthy. |
| Medusa application | ready | The exact 2.18.0 workspace completed database migration and returned HTTP 200 with body `OK` from `/health` on isolated port 19000. |
| n8n application | ready | Its documented readiness address returned HTTP 200 and status `ok`. |
| Whole three-application lab | ready | All three application readiness checks succeeded. This still proves startup only, not `brisk-aitesting` business-scenario support. |

TCV-0032 made 66 checks: all 66 passed, with 0 failures and 0 skips. These
checks cover the common three-application description, source-copy integrity,
local-secret exclusion, setup-file validity, honest readiness reporting,
Directus's expected anonymous refusal, and refusal to delete disposable lab
data without explicit confirmation. They do not test business behavior through
`brisk-aitesting` yet.

The shared helper now starts and stops the recorded Medusa application as well
as its database. Its stop/start proof changed Medusa from ready, to not ready,
and back to ready. The helper records the process identity under the already
ignored `.brisk-aitesting` runtime folder and refuses to stop a ready process it
did not start. This prevents a stale or unrelated process from being treated as
safe lab ownership.

Medusa's official migration created 143 public database tables and its initial
data script produced 4 products, 1 region, 1 sales channel, and 20 inventory
items. It produced 0 customers. Therefore the later isolated-seed checkpoint
remains open: a customer and dedicated test identities still need to be created
through supported Medusa paths. The first attempt on port 9000 did not prove a
Medusa listener because that port belonged to the laptop's Zscaler tunnel;
Medusa was restarted with `PORT=19000`, matching the recorded manifest.
