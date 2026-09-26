# Canonical Work Decomposition Contract V1 — FROZEN

**Asset ID:** `CANONICAL-WORK-DECOMPOSITION-CONTRACT-V1`  
**Version:** `1.0.0`  
**Status:** `FROZEN`  
**Phase:** `P6.1`  
**Classification:** Governance contract; decomposition instances are `EXECUTION_PROTECTED`  
**Governing standard:** `EXECUTABILITY_AND_RECURSIVE_DECOMPOSITION_STANDARD_V1_FROZEN.md`

## 1. Purpose

This contract defines the executor-neutral structure by which an Atlas Daughter A5 task is recursively decomposed into work units until each terminal unit is either executable without undocumented SME judgement or explicitly blocked by a governed dependency.

It does **not** define runtime-native queues, Malkom fields, client-system mappings, RPA steps, agent prompts, API calls, or client values. Those are downstream projections/bindings.

## 2. Semantic position

`Daughter A5 → Operational Knowledge → Recursive Work Decomposition → Canonical WorkDefinition → Client Binding → Runtime Projection / Compiler`

Work Decomposition is part of the Atlas Operational Layer. A5 is never assumed to be executable merely because it is the deepest published Daughter level.

## 3. Required lineage

Every decomposition MUST preserve:

- `decompositionId`
- `contractVersion`
- `daughterModule`
- `daughterVersion`
- `sourceTaskId`
- `sourceTaskTitle`
- `semanticLineage`
- `parentLink`
- `executionReadinessStatus`
- `stopCriterion`

Effective-version inheritance MUST be explicit. A later effective Daughter version may inherit unchanged semantic content from a hash-pinned frozen base, but runtime lookup MUST still resolve the exact effective version and MUST NOT silently fall back to the base version.

## 4. Recursive work-unit contract

Every work unit MUST have:

- `workUnitId`
- `parentWorkUnitId` (null only for the task root)
- `sequence`
- `unitType`
- `name`
- `purpose`
- `sourceRefs[]`
- `executorReadiness`

When applicable, a work unit MAY also carry:

- `trigger`
- `inputs[]`
- `entryConditions[]`
- `decisionGates[]`
- `atomicActions[]`
- `branchTransitions[]`
- `temporalConstraints[]`
- `evidenceRequirements[]`
- `dependencies[]`
- `outputState`
- `fallbackIfBlocked`

No client-specific value, client application name, client environment identifier, runtime mapping, runtime queue name, or runtime-native action is permitted in the canonical work unit.

## 5. Unit types

V1 recognizes these executor-neutral unit types:

- `TASK_ROOT`
- `INFORMATION_RESOLUTION`
- `DECISION_EVALUATION`
- `DECISION_GATE`
- `ACTION_EXECUTION`
- `ACTION_GROUP`
- `ATOMIC_ACTION_CANDIDATE`
- `ATOMIC_ACTION`
- `TEMPORAL_CONTROL`
- `TEMPORAL_GATE`
- `EVIDENCE_AND_STATE`
- `EVIDENCE_CAPTURE`

A future unit type requires a new compatible contract version; renderers/runtimes must not infer unknown types.

## 6. Executor-readiness states

`executorReadiness.status` is one of:

- `NEEDS_DECOMPOSITION`
- `EXECUTOR_READY`
- `BLOCKED_BY_KNOWLEDGE_GAP`
- `BLOCKED_BY_CLIENT_BINDING`

### 6.1 NEEDS_DECOMPOSITION

Allowed only on a non-terminal work unit with one or more children. It means the unit is intentionally composite.

### 6.2 EXECUTOR_READY

A leaf may be `EXECUTOR_READY` only when the governed source material is sufficient for an executor to:

1. identify the required input/object;
2. determine entry/applicability conditions;
3. evaluate any gate/branch without undocumented judgement;
4. perform one unambiguous operation;
5. know the success and failure condition;
6. emit the required evidence;
7. determine the resulting state/transition; and
8. act under a resolved canonical authority/role.

`EXECUTOR_READY` does **not** mean runtime-certified. Independent executor proof is separately tracked.

### 6.3 BLOCKED_BY_KNOWLEDGE_GAP

Use when canonical execution semantics are not sufficiently established. Examples include unresolved source context, missing threshold/precedence, missing child-level action contract, missing success/failure criteria, or an ambiguity requiring new source-backed operational knowledge.

The blocker MUST be represented by stable `requiredKnowledgeGaps[]` references. Do not invent a default.

### 6.4 BLOCKED_BY_CLIENT_BINDING

Use when canonical work is understood but execution requires client/carrier/site/runtime-specific values or configuration. The blocker MUST be represented by stable `requiredClientBindings[]` references. Do not embed the client value itself in canonical decomposition.

## 7. Stop criterion

Recursion stops only when **every leaf** is either:

- `EXECUTOR_READY`, or
- explicitly `BLOCKED_BY_KNOWLEDGE_GAP`, or
- explicitly `BLOCKED_BY_CLIENT_BINDING`.

A leaf MUST NOT remain `NEEDS_DECOMPOSITION`. Internal nodes MUST NOT claim `EXECUTOR_READY` merely because their children exist.

## 8. Atomic-action rule

A source field labelled `atomicActions` is not automatically atomic. If the wording contains multiple separable operations, alternatives, conditional actions, or unresolved authority, the compiler MUST create an `ACTION_GROUP` and recursively split or block the child operations. Lexical splitting alone cannot establish executor readiness; missing child-level preconditions, success/failure criteria, evidence, or authority become explicit blockers.

## 9. Information Resolution integration

Information Resolution remains part of Operational Knowledge. Work Decomposition consumes resolved canonical object semantics but does not fabricate missing OKv2/IR depth.

For inherited tasks whose source only has OKv1 depth, P6.1 may decompose what the frozen source supports and MUST explicitly block what requires unavailable semantics. It must not backfill later semantics into an earlier frozen Daughter source.

## 10. Evidence, exceptions and state

Executor-ready work must make evidence and resulting state explicit enough for downstream WorkDefinition compilation. Exception/fallback semantics must preserve fail-closed behavior: missing information, conflicts, unresolved applicability, or authority uncertainty route to a blocker/exception, not a guessed action.

## 11. Protection boundary

Full decomposition instances are `EXECUTION_PROTECTED` and MUST NOT be committed into the public web/GitHub bundle or preloaded by the normal Daughter/Canvas surface.

The normal/public projection may expose only an allowlisted summary:

- compilation status;
- work-unit count;
- terminal-leaf count;
- executor-ready leaf count;
- client-binding-blocked leaf count;
- knowledge-gap-blocked leaf count;
- independent executor-proof status; and
- `detailIncluded: false`.

Full detail requires `atlas.work_decomposition.full.read` and is served from the protected backend with `private, no-store` semantics.

## 12. Downstream boundary

P6.1 stops at Work Decomposition. Canonical WorkDefinition compilation is a subsequent controlled phase. A decomposition leaf being `EXECUTOR_READY` means it is eligible for WorkDefinition compilation; it does not imply that a WorkDefinition already exists or that any runtime has been certified.

## 13. Governance / feedback

Runtime or client discovery may raise a suggested gap, but it cannot mutate the decomposition automatically. The governed path remains:

`observed runtime gap → suggested gap → owner/governor validation → update correct canonical layer → recompile dependent decomposition → recompile WorkDefinition/runtime projection`

## 14. V1 invariants

1. A5 is not an execution stop level.
2. Recursion depth is criterion-driven, not hierarchy-count-driven.
3. Every leaf terminates truthfully as ready or explicitly blocked.
4. Client bindings never become global canonical rules.
5. Runtime projections never become the Atlas source of truth.
6. Exact Daughter/module/task version resolution fails closed.
7. Full decomposition detail stays behind the protected data/API boundary.
8. WorkDefinition is downstream and is not implicitly manufactured by P6.1.
