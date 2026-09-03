# Execution Readiness Presentation Contract V1.1

**Status:** FROZEN  
**Phase:** P1R — Frozen Stack Lock v2.2 reconciliation  
**Governing architecture:** `ATLAS-DAUGHTER-EXECUTION-DEPTH-PRESENTATION-ARCHITECTURE-V1`  
**Supersedes for future implementation:** `EXECUTION_READINESS_PRESENTATION_CONTRACT_V1_FROZEN.md`

## Purpose

Define the safe, human-readable diagnostic projection that answers:

> Can this A5 Operational Knowledge safely proceed toward recursive Work Decomposition and canonical WorkDefinition compilation?

P1R strengthens readiness to account for Operational Knowledge v2 and Information Resolution v1. Execution Readiness remains diagnostic metadata, not Work Decomposition, and must not reconstruct protected execution logic in the browser.

## Canonical readiness inputs

Readiness may be derived from governed records including:
- A5/Daughter executability status;
- Operational Knowledge v2 ambiguity/unresolved-dependency status;
- Information Resolution completeness for material fields/objects;
- required information, decisions, branches, controls, timing, responsibility, systems, evidence and exception/recovery coverage;
- source/context, client-binding, metric-definition and unknown statuses;
- Work Decomposition and WorkDefinition compilation/proof status.

## Standard presentation object

A conforming projection may emit:

```text
executionReadiness
  taskId
  status
  decompositionRequired
  decompositionStatus
  executorReadyStatus
  independentExecutorProofStatus
  coverage
    requiredInformation
    informationResolution
    objectAssociation
    semanticClassification
    normalizationValidation
    conditionalApplicability
    decisions
    branches
    evidence
    timing
    responsibility
    systems
    exceptionRecovery
    conflictPolicy
    humanReviewPolicy
  unresolved
    operationalKnowledgeCount
    operationalKnowledgeCategories[]
    sourceContextPendingCount
    clientBindingCount
    clientBindingCategories[]
    metricDefinitionPendingCount
    ambiguityCount
    unresolvedDependencyCount
    unknownCount
  dependencies
    deterministicVsJudgement
    hitlRequired
    systemActionRequired
    clientBindingRequired
  downstream
    workDecompositionStatus
    workDefinitionStatus
  provenanceSummary
    evidenceClasses[]
    confidenceStatus
  trace
    moduleId
    moduleVersion
    taskId
    operationalKnowledgeContractVersion
    informationResolutionContractVersion
    projectionContractVersion
```

## Readiness status vocabulary

### Overall `status`
- `READY_FOR_DECOMPOSITION`
- `CONDITIONAL_READY`
- `BLOCKED_KNOWLEDGE_GAP`
- `BLOCKED_INFORMATION_RESOLUTION`
- `BLOCKED_SOURCE_OR_CONTEXT`
- `BLOCKED_GOVERNANCE`
- `NOT_APPLICABLE`

`BLOCKED_INFORMATION_RESOLUTION` is used when a material field/object meaning, applicability, association, normalization, validation, authority, conflict policy or related semantic is insufficiently resolved to decompose work without inventing operational knowledge.

### `decompositionStatus`
- `NOT_REQUIRED`
- `REQUIRED_NOT_STARTED`
- `IN_PROGRESS`
- `MODELED_NOT_EXECUTOR_PROVEN`
- `EXECUTOR_READY`

### `executorReadyStatus`
- `NOT_READY`
- `PARTIAL`
- `READY_PENDING_PROOF`
- `EXECUTOR_PROVEN`

### `independentExecutorProofStatus`
- `NOT_APPLICABLE`
- `PENDING`
- `FAILED`
- `PASS`

### Coverage components
Each component emits, where measurable:
- `status`: `COMPLETE | PARTIAL | MISSING | NOT_APPLICABLE`;
- `presentCount`;
- `requiredCount`;
- `unresolvedCount`;
- safe explanatory label.

No coverage percentage may imply independent executor proof.

## Information Resolution readiness gate

For each material canonical field/object, readiness must consider whether the following are sufficiently explicit or deliberately bound/escalated:
- business meaning and canonical object scope;
- datatype/cardinality/unit/code authority where applicable;
- required/prohibited conditions and jurisdiction/condition applicability;
- value origin and permitted evidence class;
- object association;
- normalization;
- field, cross-field and cross-object validation;
- authority owner/system-of-record role;
- conflict and missing-value policy;
- confidence/HITL policy;
- source/context status;
- client-binding status.

A task must not become `READY_FOR_DECOMPOSITION` when decomposition would have to invent one of these material semantics.

## Canonical status mapping

Readiness computations use canonical statuses without rewriting them:
- `CANONICAL_RESOLVED` / `SOURCE_RESOLVED` → resolved reference knowledge;
- `SOURCE_CONTEXT_PENDING` → source/context unresolved;
- `CLIENT_BINDING_REQUIRED` → canonical need resolved but localization pending;
- `RESOLVED_CLIENT_SPECIFIC` → resolved within authorized client scope;
- `METRIC_DEFINITION_REQUIRED` → measurement definition unresolved;
- `UNKNOWN` → unresolved/unknown.

Presentation aliases are permitted only as labels.

## Client binding is not a knowledge-gap synonym

A client-binding requirement does not automatically block decomposition. A task may remain `READY_FOR_DECOMPOSITION` when:
- canonical meaning is known;
- applicability is known;
- validation/authority requirements are known;
- the unresolved element is genuinely deployment-specific, such as a client field, system, code, local policy value or route.

Conversely, a flat runtime/client label whose canonical meaning is still unknown is a source/context or operational-knowledge gap, not merely a binding.

## Determinism / judgement profile

`deterministicVsJudgement` may emit only:
- `DETERMINISTIC_DOMINANT`
- `MIXED`
- `JUDGEMENT_DOMINANT`
- `UNKNOWN`

It must not expose exact machine rules, decision trees or recursive decomposition.

## HITL and system dependencies

`hitlRequired` and `systemActionRequired` are safe aggregate indicators. Category-level explanations may include `AUTHORITY_DECISION`, `EXCEPTION_REVIEW`, `LOW_CONFIDENCE`, `CONFLICT_RESOLUTION`, `CLIENT_POLICY_RESOLUTION`, or `SYSTEM_STATE_CHANGE`. Exact queue names, routes, endpoints, fields or transition logic remain protected/scoped.

## Public-safe allowlist

Public/Anonymous and normal Authenticated Atlas may receive:
- readiness status labels;
- decomposition required/status;
- executor-ready and independent-proof status;
- approved coverage aggregates;
- Information Resolution completeness summaries;
- unresolved counts/category families;
- deterministic/judgement aggregate;
- HITL/system/client-binding dependency indicators;
- Work Decomposition and WorkDefinition availability/status only;
- safe provenance/evidence-class summary.

They do not receive:
- exact failing machine rules or cross-field logic;
- raw Information Resolution contracts;
- exact source claims/source IDs;
- exact client mappings/values;
- candidate decomposition sequence/tree;
- WorkDefinition fields/rules/transitions;
- runtime projections or connector configuration.

## Stronger entitlement behavior

Pilot and Client Workspace users may receive richer diagnostics needed to resolve their own workspace bindings and collection questions, but not protected Work Decomposition/WorkDefinition unless separately entitled.

Admin/Governor and Owner may receive exact failing canonical element references and governance provenance according to capability. Full Work Decomposition/WorkDefinition remains separately protected.

## No covert-channel rule

Readiness must not leak protected logic through verbose failure text, raw failing payload excerpts, source IDs, client field names, machine predicates, or counts granular enough to reconstruct a protected decomposition tree.

## P2 proof requirement

P2 must demonstrate on Road LTL v1.5 `LTL-03` that:
1. BOL Information Resolution completeness can affect readiness;
2. `CLIENT_BINDING_REQUIRED` does not become a false knowledge gap;
3. `SOURCE_CONTEXT_PENDING` or unresolved canonical semantics can block/condition readiness;
4. safe users receive only aggregate/readable diagnostics;
5. Ocean FCL/LCL v0.6 remains supported with the depth actually present, without fabricating Information Resolution completeness.

## Exit condition

P2 is conformant only when readiness is computed server/build-side from canonical records after authorization, uses the v2.2 status semantics, and returns only the fields permitted by this contract and the Authorization Projection Matrix V1.
