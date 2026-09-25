# Real-System Target Depth and Coverage Gap

## Why this record exists

A green health check against a large application can create false confidence.
Reachable pages, usable controls, API operations, data rules, roles,
permissions, workflows, and executed scenarios describe testing depth.
Repository size does not. This record keeps source size only as secondary
context so a small passing suite cannot hide behind the size or reputation of
Directus, Medusa, or n8n.

## Why these three applications

They were selected for different foundations, not their brand names:

- **Directus** tests a database-generated REST and GraphQL surface whose visible
  records, fields, and actions change with roles and policies.
- **Medusa** tests connected commerce state where products, pricing, inventory,
  customers, carts, orders, workflows, events, and jobs depend on each other.
- **n8n** tests visual workflow construction and asynchronous execution through
  manual starts, webhooks, nodes, branches, waits, retries, credentials,
  failures, and later workers.

Together they prevent one simple CRUD application from becoming the product's
entire idea of compatibility. They are still only the first minimum set.

## Primary depth measures

These are the numbers that must lead future reports:

| Measure | What it means | Current Directus | Current Medusa | Current n8n |
| --- | --- | ---: | ---: | ---: |
| Reachable UI pages | A page a test identity can actually open at runtime | not measured | not measured | not measured |
| Interactive UI elements | Visible enabled links, buttons, inputs, selects, editors, menus, and dialogs on those pages, deduplicated by purpose | not measured | not measured | not measured |
| Meaningful UI journeys executed | A multi-step user goal with an asserted business or permission result | **0** | **0** | **0** |
| Live API operations | Runtime-supported method/path, GraphQL field or mutation, webhook, or equivalent callable operation | 129 OpenAPI operations; plus 97 system GraphQL query fields and 198 mutation fields | not measured | not measured |
| API business scenarios executed | A real call or connected flow with request, response, state, permission, and cleanup checks where applicable | **1 complex AI journey / 7 operations** | **0** | **0** |
| Backend data rules | Required/optional fields, types, allowed values, relationships, state transitions, and permission rules observed from authoritative contracts/runtime | required title, create/read/update allow, delete deny, published-state response, cleanup identity; broader denominator not measured | not measured | not measured |
| Workflows/events/jobs | Runtime-supported delayed or multi-step processing surfaces | not measured | not measured | not measured |
| Real-AI scenarios executed | Scenarios proposed by the configured model, accepted against trusted evidence, and actually run by `brisk-aitesting` | **1 journey: 6 AI actions + 1 deterministic cleanup** | **0** | **0** |

"Not measured" is intentionally different from zero. Zero means we know no
scenario was executed. Not measured means the live denominator has not yet been
collected, so no percentage can honestly be calculated.

An interactive-element count is useful only with context. Ten copies of the
same row action are one element type plus ten rendered instances, not ten
different product capabilities. Reports must retain both numbers and identify
which controls were actually used and asserted.

## Secondary source inventory

The inventory was produced by `npm run smoke:real-system-target-inventory`
against the exact clean pinned revisions on 2026-08-03.

| Measure | Directus | Medusa | n8n |
| --- | ---: | ---: | ---: |
| Tracked files | 4,497 | 23,419 | 26,109 |
| Tracked bytes | 25,794,288 | 258,018,239 | 190,036,993 |
| Source-like tracked files | 4,212 | 21,338 | 24,242 |
| Package manifests | 43 | 110 | 86 |
| Test-classified tracked paths | 1,232 | 1,379 | 9,220 |
| UI source files in the primary UI area | 576 Vue files | 1,918 TS/TSX files | 3,129 TS/Vue files |
| Static UI route records | 89 | 272 | 80 |
| Static API depth | 42 mounted base paths and 264 handler registrations | 321 route files and 478 exported HTTP handlers | 111 controller files and 519 decorated HTTP handlers |
| Contract/schema depth indicator | Generated REST OpenAPI plus normal/system GraphQL surfaces | 225 validation/query/middleware files plus typed HTTP definitions | 391 `@n8n/api-types` files plus decorated REST/webhook surfaces |

For background only, the targets contain **54,025 tracked files**, **49,792 source-like
files**, **239 package manifests**, **11,831 test-classified paths**, **5,623 UI
source files**, **441 static UI route records**, and at least **1,261 statically
counted HTTP handler registrations**. The API measures are architecture-specific
and therefore must not be treated as one universal endpoint denominator.

### Counting method and limits

- Tracked files come from `git ls-files`; bytes are current on-disk sizes of
  those exact tracked paths.
- Source-like files use a documented extension allowlist.
- Test-classified paths use test/spec/e2e names and directories. They show that
  the upstream project is test-rich; we did not execute those 11,831 paths.
- Directus UI routes count `path:` records in its root router and module route
  registries. API handlers count static Express router method registrations.
- Medusa UI routes count `path:` records in its dashboard route map. API depth
  counts `route.ts` modules and exported HTTP methods.
- n8n UI routes count `path:` records in route/router source files. API depth
  counts REST controller files and HTTP method decorators.
- Dynamic database-generated routes, optional plugins, edition-gated behavior,
  runtime extensions, and generated operations can change the live surface.
- A route or handler found in source is **not** an executed test and is **not**
  evidence that `brisk-aitesting` supports it.

The first inventory run failed 1 of 15 checks because it incorrectly assumed
Medusa would express at least 50 UI pages as `page.tsx` files. Medusa instead
declares the core dashboard through a route map. The correction measured 272
actual `path:` route records rather than lowering the threshold to make the test
pass. The corrected inventory passed 15/15 with 0 failures and 0 skips.

## Honest current `brisk-aitesting` executed UI depth

The currently rerun local suites produced:

| Suite | All scenarios | Primary UI scenarios | Actual UI depth |
| --- | ---: | ---: | --- |
| Serious SaaS reference | 13 | 3 | Login, dashboard, and users routes; body visibility only; 13/13 overall passed. |
| Five reference proof apps | 38 | 5 | One visible home route in Todo, multi-tenant, and e-commerce; two visible routes in event/messaging; 38/38 overall passed. |
| Main smoke app | 6 | 2 | Home visibility plus login with two fills and one click; 6/6 overall passed. |

The main smoke also contains focused missing-evidence, healing, feedback, and
invalid-plan UI cases. These are valuable engine safety checks, but they do not
add business-screen breadth.

Most importantly:

| Real target | Executed business UI scenarios today |
| --- | ---: |
| Directus | **0** |
| Medusa | **0** |
| n8n | **0** |

Therefore no current result may say that the product has broad UI support for
these three applications. Readiness proves only startup; source inventory proves
only target depth; reference UI proves selected engine mechanics.

## Minimum gate expansion

Counts are a floor, not a definition of quality. Each scenario must assert a
meaningful state, permission, or outcome; opening 15 pages with only a visible
body does not satisfy the gate.

Before the first three-app behavior-upgrade gate can pass, **each application**
must have at least:

| Gate | Minimum per application | Required depth |
| --- | ---: | --- |
| Browser/UI | 15 logical scenarios | At least 5 navigation/read, 5 real user mutation flows, 3 denied/invalid flows, and 2 recovery/accessibility/session flows. |
| API/business | 20 logical scenarios | Positive reads/mutations, typed multi-step values, invalid data, missing information, auth and permission boundaries, and state verification. |
| Contract/discovery | 8 checks | Published/runtime schema acquisition, full/partial/missing/conflicting information, drift, and affected-only recompilation. |
| Security | 10 checks | Secret redaction, wrong/no identity, least privilege, forbidden network/path, malicious input, and no unsafe fallback. |
| Reliability | 8 checks | Timeout, waiting, retry, cancellation, restart, middle-step failure, and correlation. |
| Cleanup/recovery | 6 checks | Isolated created data, receipts, safe ordering, forced cleanup failure, residual reporting, and no deletion of pre-existing data. |

This creates an initial floor of **67 meaningful checks per application** and
**201 across the three applications**, in addition to shared setup, packaging,
governance, performance, and cross-platform checks. Scenario overlap is allowed
only when one executed scenario produces independently inspectable evidence for
multiple gates; reports must retain each denominator rather than counting one
scenario several times as several executed scenarios.

### Required application-specific UI journeys

- Directus: sign-in/session, collection navigation, item create/edit/read/delete,
  typed field validation, file/relationship behavior, schema change, role/policy
  visibility, hidden field, forbidden mutation, and permission drift.
- Medusa: admin sign-in/session, products/variants, pricing, inventory, customer,
  sales channel/region, cart/order state, invalid transition, failed middle step,
  workflow/event result, and compensation/residual visibility.
- n8n: owner setup/sign-in, workflow list/create/edit, node configuration,
  branching, webhook/manual execution, wait/resume, retry, deliberate node
  failure, execution detail, credential-reference redaction, activation, and
  cleanup.

These journeys will be refined from each live authenticated surface. Vendor
names remain outside universal compiler decision rules.
