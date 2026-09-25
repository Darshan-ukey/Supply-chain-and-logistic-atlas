# Cleanup and Recovery Safety

Status: definitions, compiler cleanup-safety records, dependency-aware cleanup
ordering, and the pre-lowering safety gate are implemented; the recovery
executor is not yet complete.

## Simple meanings

- **Cleanup**: undoing test-created state, for example deleting a customer that
  Brisk created only for a test.
- **Precondition**: a fact that must be true before cleanup is safe, for example
  the created customer's captured id must exist and must come from that run.
- **Mutation receipt**: a durable note written around an external change. It
  says which action was attempted, with which stable identity, and whether its
  completion was observed.
- **Idempotent action**: an action proven safe to repeat without creating a
  second effect. Brisk must not infer this from an HTTP verb or a name.
- **Independent cleanup**: cleanup that does not need a failed cleanup to finish.
  Example: deleting an unrelated test invoice may continue after deleting a
  test customer fails.
- **Residual state**: test-created data that may still exist after Brisk stops.
  It must be named and reported, never hidden behind a passed verdict.
- **Full recovery**: every registered safe cleanup reaches an accepted final
  outcome and no test-created state is known to remain.
- **Partial recovery**: some safe cleanup finishes, but at least one item fails,
  is blocked, or cannot be proven safe. The exact remainder must be reported.

## What exists now

The compiler can attach a declared cleanup operation to a create operation. It
builds cleanup after the normal work and reverses the actual resource
dependencies: if a task needs a project, the task cleanup must finish before
the project cleanup. Two resources that do not depend on each other do not gain
a false cleanup dependency. The compiler also keeps two resources of the same
type distinct by binding each cleanup to the exact step that produced its id.

The executor separately runs its older registered API cleanup list in reverse
registration order, continues its loop after a cleanup failure, and reports
failed cleanup as an operational issue. A journal can identify a run that
stopped before completion without inventing a test verdict.

Every compiler-produced cleanup now has a versioned safety record. It names the
resource-producing step and operation, cleanup step and operation, earlier
cleanup it depends on, required value sources, accepted outcomes, exact evidence
revision and provenance, and the cleanup-only recovery policy. Its stable id is
calculated from those facts. Final workflow validation rejects a missing,
duplicate, unknown, stale, or altered record.

Before any adapter turns a compiled workflow into an executable request, Brisk
revalidates the complete workflow and its Evidence Graph. If the cleanup
identity, source operation, cleanup operation, phase, captured-value binding,
accepted outcome, dependency, provenance, or execution authority changed, the
lowerer returns `WORKFLOW_VALIDATION_FAILED`. No adapter receives the rejected
workflow. This is a safety stop, not an application test verdict.

## What is partial or missing

- Reverse cleanup is proven with focused synthetic chains, branches, and two
  same-type resources. Property-based and broad generated-graph proof is still
  missing.
- The journal records broad stages, not each mutation and cleanup attempt.
- Interrupted runs are reported as recovered, but pending cleanup is not resumed.
- Duplicate mutation prevention, cleanup exactly-once protection, dependency-
  aware continuation, and structured residual-state reporting are not built.

## Safety rule and sources of truth

The compiled workflow is the source of truth for what may run, its dependencies,
required values, accepted outcomes, and evidence. The append-only run journal is
the source of truth for what was registered, attempted, observed, completed,
failed, or skipped during that run. Runtime captures supply the exact values
needed by cleanup. AI text is never authority to repeat a mutation or invent a
missing value.

After interruption, Brisk will use a cleanup-only recovery rule. It may continue
only a registered cleanup whose workflow facts, captured values, dependencies,
and prior journal state prove it safe. It will not restart discovery, planning,
tests, or an unknown mutation. A normal action may be resumed only when an
authoritative operation contract explicitly proves its idempotency or resume
rule; absence of that proof means do not repeat it.

## Ordering rule

If resource B depends on resource A, cleanup removes B before A. Brisk recognizes
that relationship from the compiled typed output flow, including an intervening
non-resource step. A failed cleanup blocks only cleanup that depends on it;
unrelated branches may continue. Every attempt and decision must be journalled
before a final recovery result is reported.

## Current proof depth

`TCV-0031` now runs 88 focused synthetic checks. Seventeen of those checks cover
cleanup ordering: a three-resource dependency chain, two independent branches
sharing one parent, and two same-type resources that require distinct cleanup
steps and captured ids. Another 26 checks prove one valid lowering plus eight
tampered or de-authorized cleanup families are stopped before either normal or
cleanup adapter code is called. All 88 passed with zero failures and zero skips
in the focused run on 2026-08-03.

This proves compiler construction and validation for those fixtures. It does
not prove runtime cleanup after a process interruption, journal replay,
exactly-once cleanup, cleanup timeout handling, property-generated graphs,
every adapter, another operating system, or production load.

## Product tradeoff

This rule can leave residual test data when proof is incomplete. That is safer
than repeating a payment, message, account creation, or other external change.
Brisk must make the remainder and next safe action visible so a user or host can
resolve it deliberately.
