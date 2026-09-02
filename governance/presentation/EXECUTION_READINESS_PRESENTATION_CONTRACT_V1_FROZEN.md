# Execution Readiness Presentation Contract V1

**Status:** FROZEN  
**Phase:** P1 — Presentation and access contracts  
**Governing architecture:** `ATLAS-DAUGHTER-EXECUTION-DEPTH-PRESENTATION-ARCHITECTURE-V1`

## Purpose

Define the safe, human-readable diagnostic projection that answers:

> Can this A5 operational knowledge safely proceed toward recursive Work Decomposition and canonical WorkDefinition compilation?

Execution Readiness is diagnostic metadata. It is not Work Decomposition and it must not reconstruct protected execution logic in the browser.

## Canonical readiness inputs

Readiness may be derived from governed Daughter fields including:
- `executability.status`;
- `executability.decompositionRequired`;
- `executability.stopCriterion`;
- `executability.candidateDecomposition`;
- `workDefinitionReadiness.daughterOperationalContract`;
- `workDefinitionReadiness.clientBindingContract`;
- `workDefinitionReadiness.workDecomposition`;
- `workDefinitionReadiness.canonicalWorkDefinition`;
- `workDefinitionReadiness.independentExecutorProof`;
- counts/completeness derived from required information, decision gates, branches, evidence, timing, responsibility, systems and binding objects;
- unresolved/research/client-binding statuses.

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
    decisions
    branches
    evidence
    timing
    responsibility
    systems
    exceptionRecovery
  unresolved
    operationalKnowledgeCount
    operationalKnowledgeCategories[]
    clientBindingCount
    clientBindingCategories[]
    researchRequiredCount
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
    projectionContractVersion
```

## Status vocabulary

### `status`
- `READY_FOR_DECOMPOSITION`
- `CONDITIONAL_READY`
- `BLOCKED_KNOWLEDGE_GAP`
- `BLOCKED_SOURCE_OR_CONTEXT`
- `BLOCKED_GOVERNANCE`
- `NOT_APPLICABLE`

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
Each coverage component emits:
- `status`: `COMPLETE | PARTIAL | MISSING | NOT_APPLICABLE`;
- `presentCount` where measurable;
- `requiredCount` where measurable;
- `unresolvedCount`;
- safe explanatory label.

No coverage percentage may imply independent executor proof.

## Determinism / judgement profile

`deterministicVsJudgement` may emit only an aggregate classification:
- `DETERMINISTIC_DOMINANT`
- `MIXED`
- `JUDGEMENT_DOMINANT`
- `UNKNOWN`

It must not expose exact machine rules, decision trees or protected recursive decomposition.

## HITL and system dependencies

`hitlRequired` and `systemActionRequired` are safe boolean/aggregate indicators. Public/normal projections may explain **why at category level** (for example `AUTHORITY_DECISION`, `EXCEPTION_REVIEW`, `CLIENT_POLICY_RESOLUTION`, `SYSTEM_STATE_CHANGE`) but must not emit queue names, exact route logic, exact target fields, endpoints or machine transitions.

## Unresolved classification

Readiness must distinguish:
- operational knowledge gaps;
- source/context resolution;
- client binding;
- research required;
- downstream compilation/proof state.

A client-binding requirement is not automatically an operational knowledge gap. A task may remain `READY_FOR_DECOMPOSITION` while deployment-specific binding values remain unresolved if the canonical need, validation and authority origin are already defined.

## Public-safe allowlist

Public/Anonymous and normal Authenticated Atlas may receive:
- readiness status labels;
- decomposition required/status;
- executor-ready status;
- independent executor-proof status;
- coverage aggregates;
- unresolved counts and category families;
- deterministic/judgement aggregate;
- HITL/system/client-binding dependency indicators;
- Work Decomposition and WorkDefinition availability/status only;
- safe provenance/evidence-class summary.

They do **not** receive:
- `executability.stopCriterion` verbatim when it would disclose protected derivation logic beyond the approved safe explanation;
- `candidateDecomposition` exact sequence as executable nodes;
- decomposition node IDs/tree/graph;
- WorkDefinition fields/rules/transitions;
- exact client mappings/values;
- runtime projections;
- restricted provenance/source crosswalk.

## Stronger entitlement behavior

Pilot and Client Workspace users may receive richer unresolved/binding diagnostics needed to complete their own workspace, but no protected Work Decomposition/WorkDefinition unless separately entitled.

Admin/Governor and Owner may receive full readiness diagnostics, exact failing canonical element references and governance provenance. Full Work Decomposition/WorkDefinition still requires their protected execution capability, not merely presence on this screen.

## No covert-channel rule

Readiness must not leak protected logic through:
- verbose failure text that reproduces exact rules/transitions;
- unredacted failing payload excerpts;
- client-field names in public diagnostics;
- source refs or internal IDs not classified for that consumer;
- counts granular enough to reconstruct a protected decomposition tree.

## Exit condition

P2 is conformant only when readiness is computed server/build-side from canonical records after authorization and the returned object contains only fields allowed by this contract and the P1 authorization matrix.
