# World-Class Real Validation Gate

## Why this gate exists

One successful journey proves only that one journey worked once. It does not
prove application support, product depth, scale, UI quality, contract quality,
database safety, healing, reliability, or release readiness. This gate prevents
single-case success, repository file totals, or smoke tests from being presented
as broad product proof.

The current accepted baseline is **0 of 300 required real-AI logical
scenarios**: Directus 0/100, Medusa 0/100, and n8n 0/100. One Directus API
journey did consume a real model and pass seven operations, but it did not
retain the newly required raw-response digest/token record, so it remains
historical narrow execution evidence and is not counted in this stricter
corpus. Real-AI UI, database-behaviour, contract-drift, load, stress, and soak
denominators are also 0. None of the three applications is fully validated.

## What counts as one real-AI logical scenario

A counted scenario must:

1. start from a response returned by a configured real model during that run;
2. pass the closed AI response schema and retain a redacted response record;
3. use live authoritative application evidence rather than invented routes,
   selectors, fields, queries, outcomes, permissions, or cleanup;
4. contain at least three connected business operations or cross an equivalent
   meaningful state/permission boundary;
5. pass values or state between its steps;
6. include a meaningful verification, refusal, failure, or recovery outcome;
7. clean every test-created mutation and verify residual state;
8. run through a freshly packed and clean-installed product;
9. report proposed, accepted, rejected, compiled, executed, passed, failed,
   skipped, errored, cleaned, and residual counts separately; and
10. preserve timings and redacted evidence for the complete path.

A fixture model, fixed response, readiness request, isolated endpoint check,
repository file count, or repeated copy of the same scenario does not count.
Scenarios must have distinct business risk, state transition, failure mode, or
surface coverage. A required skipped scenario keeps its gate open.

## Minimum 300-scenario real-application corpus

Each row is a minimum, not a release ceiling. Categories are primary buckets so
one scenario is counted once even when it crosses several surfaces.

| Application | Primary scenario bucket | Required logical scenarios | Current |
| --- | --- | ---: | ---: |
| Directus | REST API and generated collection behaviour | 25 | 0 |
| Directus | GraphQL query, mutation, variables, errors, and permissions | 20 | 0 |
| Directus | Real UI navigation, forms, tables, filters, validation, and accessibility | 20 | 0 |
| Directus | Roles, policies, record visibility, authentication, and authorization | 15 | 0 |
| Directus | Contract, schema, database constraint, and data-integrity behaviour | 10 | 0 |
| Directus | Drift, safe healing, interruption, recovery, cleanup, and residual state | 10 | 0 |
| **Directus total** |  | **100** | **0** |
| Medusa | Admin API, products, inventory, pricing, customers, and permissions | 20 | 0 |
| Medusa | Store API, carts, line items, shipping, payment, order, and return state | 25 | 0 |
| Medusa | Real admin/storefront UI, validation, accessibility, and role behaviour | 20 | 0 |
| Medusa | Workflows, events, subscribers, jobs, retries, and compensation | 15 | 0 |
| Medusa | Contracts, database constraints, transactions, and data integrity | 10 | 0 |
| Medusa | Drift, security refusal, interruption, recovery, cleanup, and residue | 10 | 0 |
| **Medusa total** |  | **100** | **0** |
| n8n | REST/API identity, credential, project, and permission behaviour | 15 | 0 |
| n8n | Webhook production/test modes, payloads, responses, and authentication | 15 | 0 |
| n8n | Real UI workflow editing, execution, history, validation, and accessibility | 20 | 0 |
| n8n | Nodes, branches, merge, wait, retry, error, sub-workflow, and data flow | 25 | 0 |
| n8n | Execution modes, workers, queue/database state, events, and concurrency | 15 | 0 |
| n8n | Drift, security refusal, interruption, recovery, cleanup, and residue | 10 | 0 |
| **n8n total** |  | **100** | **0** |
| **Corpus total** |  | **300** | **0** |

Every application set must contain positive, invalid, missing-information,
unauthenticated, unauthorized, boundary, adversarial, timeout, cancellation,
mutation, cleanup, residual-state, drift, healing, interruption, and recovery
cases. These are coverage dimensions across the bucket totals, not extra cases
that may be silently omitted.

## Depth denominators

For every application and identity, record the live denominators before
claiming coverage:

- reachable UI pages and states;
- rendered interactive elements and accessibility roles;
- API operations actually discovered and accepted as authoritative;
- GraphQL fields/mutations/subscriptions where applicable;
- request, response, event, message, and database contracts;
- roles, policies, permissions, tenant or project boundaries;
- workflows, events, jobs, nodes, queues, workers, and state transitions;
- database tables/collections inspected, constraints exercised, rows created,
  rows cleaned, and residual rows;
- evidence files enumerated, opened, parsed, accepted, rejected, and excluded;
- Evidence Graph nodes, edges, conflicts, and unresolved facts.

Total repository files remain secondary context. The product must report actual
files and bytes it inspected; dependency folders, generated output, caches, and
unopened files cannot be counted as inspected.

## Performance, load, and stress matrix

Run the matrix on the packed product with machine, runtime, provider, app, and
configuration versions fixed in the report.

### Cold and warm measurements

For each application, measure at least 10 cold and 30 warm repetitions of
inspection, evidence construction, AI planning, compilation, execution,
cleanup, and report generation. Report stage and end-to-end minimum, median,
p95, p99, maximum, and variance. AI network time must be shown separately from
local product time.

### Repository and plan scale

Measure small, medium, large, and very-large corpora. Record actual source files
and bytes inspected, accepted/excluded files, routes/operations discovered,
graph nodes/edges, conflicts, plan scenarios/operations, compilation time, and
artifact volume. Exercise plans containing at least 10, 100, 500, and 1,000
operations without converting unexecuted operations into passes.

### Concurrency and sustained operation

- inspection/compile-only: 1, 5, 10, 25, and 50 concurrent runs;
- isolated real execution: 1, 5, 10, and 25 concurrent runs where application
  and provider quotas permit safe execution;
- real-provider planning: 1, 3, and 5 concurrent calls with rate-limit and
  cancellation outcomes retained;
- sustained packed-product run: at least 30 minutes with periodic mutations,
  failures, cleanup, and residual checks;
- interruption: terminate planning, execution, artifact writing, and cleanup at
  controlled points, then prove safe resume or explicit refusal to replay.

No load generator may attack an external or production system. Concurrency is
limited to the authorized local applications and configured provider policy.

### Required resource metrics

- wall-clock and per-stage time;
- process CPU time and normalized CPU utilization;
- baseline, median, p95, and peak resident memory;
- event-loop delay and active handles;
- open files/sockets and child processes;
- requests and operations per second;
- AI request count, retries, tokens when returned, latency, and cost when known;
- bytes read from source/contracts and bytes written as artifacts;
- database rows/resources created, cleaned, and remaining;
- crashes, timeouts, cancellations, retries, duplicates, leaks, and corrupted or
  missing result records.

## Non-negotiable safety and truth thresholds

The following allowed count is zero across the accepted corpus:

- fabricated pass;
- invented executable operation reaching an engine;
- unauthoritative mutation;
- cross-role, cross-project, or cross-tenant mutation;
- leaked configured secret;
- unsafe AI instruction execution;
- lost known result after interruption;
- unknown mutation replay;
- unexplained skip;
- unrecorded cleanup outcome;
- residual test data after a run reported clean;
- unsafe healing accepted without proven equivalence.

Quality and performance regression thresholds must be fixed from the reviewed
versioned baseline before the benchmark gate can pass. Thresholds may not be
weakened after seeing a failing candidate without a recorded product decision.

## Completion rule

No application-support, cross-architecture, stress, benchmark, healing, or
release claim is complete until its entire stated denominator passes from a
clean-installed package and the evidence checker accepts the records. A narrow
case may be recorded as narrow evidence, but it must not close a broad task.
