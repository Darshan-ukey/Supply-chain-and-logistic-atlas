# Evidence Acquisition And Selective Recompilation

This guide explains what Brisk does after compilation says that information is
missing. The short rule is: **ask only relevant sources, find every scenario
that the returned information can change, rebuild those scenarios through the
normal compiler, and preserve the others.**

## Plain-language definitions

- **Missing information** is a specific compiler finding such as no evidenced
  operation, a required value with no approved source, missing cleanup, or an
  operation blocked by unresolved evidence.
- **Affected scenario** is a user scenario whose result can change because an
  operation was added, removed, changed, or placed in conflict. Brisk uses the
  original missing-information reference, previously selected operations, and
  the compiler's real operation-matching rule to identify it.
- **Preserved scenario** is a scenario whose previous compiler result is reused
  because the new evidence cannot change its operation selection or safety.
  Preserved does not mean “never checked”: it was compiled earlier in the same
  planning run and its result remains recorded.
- **Selective recompilation** means running the existing semantic compiler again
  only for affected scenarios. It is not a second, weaker compiler.
- **Unavailable source** means either no configured provider accepts the
  requirement, or accepted providers fail/return no usable evidence.
- **Contradictory evidence** means acquired information creates an unresolved
  conflict on an affected operation. Brisk rechecks the affected scenario,
  records the conflict, and stops unsafe compilation.

## Full and partial information

A **full acquisition decision record** contains the missing requirement IDs,
affected/recompiled/preserved scenario IDs, attempted and cached provider IDs,
acquired graph revisions, evidence revisions and content digests before and
after the round, authority-policy digest, conflicts, diagnostics, compilation
status, outcome, reason, and stable decision ID.

**Partial acquired information** can be valid even when it answers only some
requirements. Brisk merges the valid graph, identifies what it can actually
change, and recompiles that scope. Remaining missing information stays visible
and may use another bounded round. Partial does not mean that missing values are
invented or that an incomplete workflow may execute.

“Full record” does not mean the provider's information is proven true. Truth,
freshness, and authorization remain separate provider and host responsibilities.

## How affected scenarios are found

Brisk compares evidence before and after acquisition by operation ID and full
operation content. A scenario is affected when at least one of these is true:

1. a missing-information record names an operation that changed;
2. its previous compiled steps or diagnostics reference a changed operation;
3. a new or changed operation passes the semantic compiler's real candidate
   rule for one of its actions;
4. an operation used by it now has an unresolved conflict.

This is conservative: Brisk may rebuild an extra scenario when evidence could
change its choice, but it must not preserve a scenario that can change. Merely
returning an unrelated operation does not make every scenario affected.

Input graph order does not change the affected-scenario list or conflict
decision. Scenario order follows the original user intent.

## What each stop reason means

The public `brisk-aitesting.acquisition-recompilation-decision.v1` record uses:

- `EVIDENCE_ACQUIRED`: usable evidence was merged and affected scenarios were
  rebuilt. The outcome says whether compilation completed or another round is
  needed.
- `NO_ACQUIRABLE_REQUIREMENT`: compilation is incomplete, but no current
  diagnostic maps to an evidence request.
- `NO_ELIGIBLE_PROVIDER`: no configured source accepted the current request.
- `NO_USABLE_EVIDENCE`: sources were tried but failed or returned no valid
  information.
- `IRRELEVANT_EVIDENCE`: valid information arrived, but it cannot change a
  current scenario, so Brisk stops instead of looping.
- `CONTRADICTORY_EVIDENCE`: an affected operation has an unresolved conflict;
  unsafe compilation stops without guessing.
- `MAX_ROUNDS_REACHED`: the configured bound ended before all scenarios could
  compile, including a zero-round policy that disables acquisition.

`outcome` is separate from the reason:

- `completed`: all scenarios now compile;
- `recompiled`: affected scenarios were rebuilt but more information is needed;
- `stopped`: safety or policy ended the loop.

## Where users receive the record

Semantic plans expose `evidenceDecisions`. The field is optional for backwards
compatibility and because a planner that never acquires evidence has no
acquisition decision to report. `SemanticCompilationError` exposes the same
records when planning cannot safely complete, so failure does not erase what
was tried or why Brisk stopped.

Every record has a closed JSON shape. Unknown fields, malformed digests,
duplicate decision IDs, a scenario marked both recompiled and preserved, or a
recompiled scenario absent from the affected list are rejected.

## Example result

```json
{
  "schemaVersion": "brisk-aitesting.acquisition-recompilation-decision.v1",
  "outcome": "completed",
  "reasonCode": "EVIDENCE_ACQUIRED",
  "affectedScenarioIds": ["order-scenario"],
  "recompiledScenarioIds": ["order-scenario"],
  "preservedScenarioIds": ["profile-scenario"],
  "attemptedProviderIds": ["order-contract"],
  "acquiredGraphRevisions": ["order-contract-graph-v1"],
  "conflictIds": [],
  "compilationStatus": "compiled"
}
```

The complete record also includes its ID, round, explanation, requirements,
diagnostics, cache hits, evidence revisions/digests, and authority-policy digest.

## Proof and honest limits

`npm run smoke:incremental-recompilation` runs 54 checks across 17 named
categories. It covers two-scenario selective rebuilding, preserved-result
identity, changed and newly matching operations, reversed input order,
irrelevant information, unresolved conflicts, plan integration, stable decision
identity, unavailable and failed providers, bounded rounds, no invention, and
malformed decision records.

This is deterministic synthetic proof. It does not yet prove large-plan
performance, concurrent or distributed compilation, persistence across process
restart, cross-scenario data dependencies, real provider correctness, or a
production reference application. Current workflow value binding is scoped to
one logical scenario; if future designs allow one scenario to consume another
scenario's output, the affected-scope rule must expand before that feature is
enabled.
