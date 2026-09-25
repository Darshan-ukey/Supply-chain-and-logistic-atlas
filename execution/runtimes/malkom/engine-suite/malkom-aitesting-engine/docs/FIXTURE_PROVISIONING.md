# Fixture Provisioning and Data Preconditions

A check such as "rename an organization" can only run if an organization
exists. Before this feature, an empty collection surfaced as the bare runtime
failure `Missing value for step_x.orgId`. This document describes how the
engine now handles missing test data: honestly by default, and self-healing
when the host explicitly opts in.

## The Switch

```js
export default defineHostConfig({
  app: { name: 'My SaaS', baseUrl: 'http://localhost:3000' },
  fixtures: 'provision-when-missing', // default: 'require-existing'
});
```

Environment form: `BRISK_AITESTING_FIXTURES=provision-when-missing`.
Advanced manual config: `planning.fixtures`.

| Policy | Meaning |
|:-------|:--------|
| `require-existing` (default) | The engine never creates business entities to satisfy a missing value. A check whose data is absent fails with an honest `precondition` diagnosis instead of a bare missing-variable error. |
| `provision-when-missing` | When no existing value can satisfy a required input, the compiler provisions a fixture from a declared creation operation — but only under the safety rules below. |

The default is deliberately conservative: some hosts must never have tests
create business entities, even transiently.

## Producer-Fallback Sourcing ("ensure-exists")

Under `provision-when-missing`, when a required input (for example
`organization.id`) has no intent value, no fixture, no generator, and no
earlier step output, the compiler searches the evidence graph for exactly one
creation operation that can provide it. All of the following must hold, or the
engine refuses with a typed explanation:

1. **Declared producer.** The operation has `sideEffect: 'create'`, owns the
   same resource, and declares an output of the missing semantic type.
2. **Host or contract authority only.** Runtime-observed or heuristic evidence
   is never enough to invent a mutation.
3. **Self-cleaning.** The producer declares a `cleanupOperationId` that
   resolves to an executable cleanup operation. A fixture that could leave
   residue is never provisioned.
4. **Automatic cleanup scenario.** The check's cleanup policy is `automatic`,
   so the standard cleanup machinery is guaranteed to tear the fixture down.
5. **Unambiguous.** Exactly one operation qualifies; two candidates are a
   refusal, never a guess.

When all rules hold, the compiler synthesizes a `setup`-phase fixture step
before the consumer, binds the consumer's input to the fixture's output, and
the existing cleanup synthesis attaches the matching delete. At execution time
the fixture's compensation is registered on the cleanup stack *before* the
creating request fires, and teardown runs last-in-first-out in the run's
`finally` block — the same guarantees every compiled create step already has
(see [CLEANUP_AND_RECOVERY.md](CLEANUP_AND_RECOVERY.md)).

When any rule fails, compilation refuses with the `NO_CLEANUP_SAFE_PRODUCER`
diagnostic alongside the standard `MISSING_REQUIRED_VALUE`, for example:

> No organization.id value exists to test against, and no self-cleaning
> creation capability is usable: Creation operation org.create declares no
> cleanupOperationId, so a provisioned organization.id fixture could not be
> removed afterwards. Declare a cleanup operation to enable self-cleaning
> fixtures.

## Planning-Time Emptiness Awareness

A value can also be sourced from a live read: a workflow that lists
organizations and updates the first one compiles fine, then fails at run time
if the list is empty. The planner now probes those sources before the run:

- After lowering, every input bound to a read/list step's output is probed
  with the exact GET request and the exact capture path the runtime would use.
- Probes are strictly read-only: GET only, network policy enforced, bounded by
  the provider timeout. Any condition that prevents a trustworthy verdict —
  non-GET source, run-time-dependent path, sign-in that only exists at
  execution time, non-2xx answer — yields `unverified`, never a guess.
- **Empty + `provision-when-missing`:** the affected checks are recompiled
  with the read-sourced binding replaced by a provisioned fixture (the
  `forceProvisionSemanticTypes` compile option), under the same five safety
  rules.
- **Empty + `require-existing`:** the plan is stamped with a warning before
  anything runs, for example: *"GET /api/organizations succeeded with HTTP 200
  but returned no organization.id value: the collection is empty in the target
  app. This check will fail without data. Create one organization, or set
  fixtures: 'provision-when-missing' so Brisk provisions a self-cleaning
  fixture via org.create."*

## The Plan Record

Every decision — made or refused — is a typed record on the plan
(`plan.fixtureProvisioning`, schema
`brisk-aitesting.fixture-provisioning.v1`), validated by both plan gates:

| Field | Meaning |
|:------|:--------|
| `scenarioId` | The check (intent scenario) the value belongs to |
| `semanticType` | The missing or probed value type, for example `organization.id` |
| `policy` | The fixtures policy in force |
| `outcome` | `provisioned`, `existing-data`, `empty-requires-existing-data`, `no-cleanup-safe-producer`, or `unverified` |
| `explanation` | Plain words a host can show directly |
| `sourceOperationId` | The read/list operation that was probed, when one exists |
| `producerOperationId` / `cleanupOperationId` | The creation and cleanup operations used or considered |
| `probe` | Method, path, verdict (`empty`/`populated`/`unknown`), HTTP status, and timestamp of the live probe |

Outcomes other than `existing-data` and `unverified` are also mirrored into
`plan.warnings` as plain strings, so the user knows before running.

## The Honest Runtime Diagnosis

When a value is still missing at execution time — the collection was empty and
provisioning was not enabled or not possible — the failure is no longer the
bare `Missing value for step_x.orgId`:

- The API engine distinguishes a **precondition** shortfall (every producing
  step passed but returned nothing to capture) from a **dependency** failure
  (a producing step did not pass). The new `failureCategory: 'precondition'`
  exists in both the result type and the result JSON contract.
- The assertion message states what actually happened: *"No org existed to
  test against: 'List organizations' completed successfully but its response
  contained no value for step_x.orgId."*
- The result's `diagnosis[]` channel explains the fix: create the missing
  resource, declare a host/contract creation operation with a
  `cleanupOperationId`, or set `fixtures: 'provision-when-missing'`.

## What This Feature Never Does

- It never provisions from runtime-observed, heuristic, or AI-derived
  evidence, and never without a declared, executable cleanup.
- It never mutates the target app during planning; planning probes are
  read-only GETs and provisioning happens only inside the journaled,
  compensated execution path.
- It never guesses between two eligible producers, and it never silently
  converts a refusal into a pass — every refusal is a diagnostic, a plan
  record, and a plain-words explanation.
