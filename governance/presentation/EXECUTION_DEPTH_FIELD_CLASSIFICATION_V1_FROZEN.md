# Execution-Depth Field Classification V1

**Status:** FROZEN  
**Phase:** P1 — Presentation and access contracts  
**Machine-readable companion:** `governance/presentation/execution-depth-field-classification-v1.json`

## Classification semantics

Visibility profiles used below:

- **SAFE_ALL** — may be emitted through a deliberately constructed safe projection to Public/Anonymous and all stronger classes.
- **SAFE_TRACE** — canonical identifier may travel as non-secret trace metadata; UI display is optional.
- **SAFE_SUMMARY** — source value must be transformed into a governed human-readable/aggregate summary; raw value is not passed through.
- **OWN_WORKSPACE** — only Pilot/Client Workspace for the active workspace plus authorized governance/Owner.
- **GOVERNANCE** — Admin/Governor or Owner only.
- **EXECUTION_PROTECTED** — full value only to explicit protected-execution capability; Owner allowed; Admin/Governor requires that capability.
- **PRIVATE_DEFAULT** — not projected until a superseding classification explicitly permits it.

Masking rules:
- `NONE`: safe projected value.
- `SUMMARY_ONLY`: normalize/redact into approved presentation semantics.
- `OMIT`: field absent.
- `OWN_SCOPE_ONLY`: emit only when authorization and workspace scope match.

Unresolved behavior:
- unresolved values are represented by governed status, never guessed or silently dropped;
- client-bound missing values are `CLIENT_BINDING_REQUIRED`, not automatically knowledge gaps;
- source/context gaps remain `CONTEXT_REQUIRED` or `RESEARCH_REQUIRED`;
- downstream compilation/proof gaps remain `NOT_YET_COMPILED` / `NOT_YET_EXECUTOR_PROVEN`.

## A. Task identity / Overview

| Canonical path | Presentation | Type | Visibility | Masking | Aggregation | Unresolved | Provenance |
|---|---|---|---|---|---|---|---|
| `taskId` | Task ID | identifier | SAFE_TRACE | NONE | no | error if absent | safe |
| `title` | Task title | text | SAFE_ALL | NONE | no | error if absent | safe |
| `a3ParentId` | A3 parent ID | identifier | SAFE_TRACE | NONE | no | omit if unavailable | safe |
| `a3ParentLabel` | A3 parent | text | SAFE_ALL | NONE | no | omit if unavailable | safe |
| `category` | Work category | enum/text | SAFE_ALL | NONE | optional grouping | `UNKNOWN` | safe |
| `identity.a5ContractId` | A5 contract | identifier | SAFE_TRACE | NONE | no | omit if unavailable | safe |
| `identity.canonicalProcessConceptId` | Canonical concept | identifier | SAFE_TRACE | NONE | no | omit if unavailable | safe |
| `identity.purpose` | Purpose | text | SAFE_ALL | NONE | no | show unresolved status | safe |
| `identity.boundary` | Scope / boundary | text | SAFE_ALL | NONE | no | show unresolved status | safe |
| `baseline.trigger|before|event|decision|rule|control|clock|action|evidence|after|outcome` | Reference operating summary | text | SAFE_SUMMARY | SUMMARY_ONLY | no | show governed status | evidence class only |
| `baseline.actor|performer|owner|decisionAuthority|custody|financial|exceptionOwner` | Responsibility summary | text | SAFE_SUMMARY | SUMMARY_ONLY | optional role grouping | context required | evidence class only |
| `baseline.inputs|outputs|authorityObject|authoritySystem|producer|consumers` | Object/system summary | list/text | SAFE_SUMMARY | SUMMARY_ONLY | counts/groups allowed | context required | evidence class only |
| `baseline.sourceIds` | Source IDs | list | GOVERNANCE | OMIT | source-family count only in safe projection | omit | full for governance |
| `baseline.claimBoundary` | Claim boundary | text | GOVERNANCE | SUMMARY_ONLY for safe basis label | no | omit | full for governance |
| `baseline.paths.*` | Path summary | text | SAFE_SUMMARY | SUMMARY_ONLY | branch-family summary | context required | safe basis only |

## B. Applicability

The path family `applicability.*.{required,primary,applicable,conditional,notDirect,incompatible,researchRequired,defaultState}` is **SAFE_ALL** when emitted as governed compatibility/applicability semantics. Internal resolver expressions, dependency code, hidden ranking/scoring or unclassified applicability descendants are **PRIVATE_DEFAULT**.

## C. Required information

| Canonical path | Presentation | Visibility | Masking | Unresolved | Provenance |
|---|---|---|---|---|---|
| `requiredInformation[].fieldRequirementId` | Requirement ID | SAFE_TRACE | NONE | omit if unavailable | safe |
| `requiredInformation[].canonicalFieldId` | Canonical information concept | SAFE_TRACE | NONE | error if required by contract | safe |
| `requiredInformation[].name` | Required information | SAFE_ALL | NONE | show unresolved | safe |
| `requiredInformation[].category` | Information category | SAFE_ALL | NONE | `UNKNOWN` | safe |
| `requiredInformation[].cardinality` | Cardinality | SAFE_ALL | NONE | `CONTEXT_REQUIRED` | safe |
| `requiredInformation[].requiredWhen` | Required when | SAFE_ALL | NONE | `CONTEXT_REQUIRED` | evidence class only |
| `requiredInformation[].why` | Why required | SAFE_ALL | NONE | show unresolved | evidence class only |
| `requiredInformation[].valueOrigin` | Value origin | SAFE_ALL | NONE | `CONTEXT_REQUIRED` | safe class |
| `requiredInformation[].validation` | Validation | SAFE_SUMMARY | SUMMARY_ONLY | `CONTEXT_REQUIRED` | evidence class only |
| `requiredInformation[].sourceRefs` | Exact sources | GOVERNANCE | OMIT | omit | full governance |
| `requiredInformation[].evidenceClass` | Evidence class | SAFE_ALL | NONE | `UNCLASSIFIED` | self |
| `requiredInformation[].clientBindingRequired` | Client binding required | SAFE_ALL | NONE | false only when explicit | safe |
| `requiredInformation[].notes` | Notes | PRIVATE_DEFAULT | OMIT | omit | governance if reclassified |
| any runtime/client value corresponding to required information | Actual value | OWN_WORKSPACE | OWN_SCOPE_ONLY | explicit missing/binding status | own/governance |

## D. Decisions and rules

`decisionGates[]` current human-readable fields are classified as follows:
- IDs (`gateId`) → SAFE_TRACE.
- `gate`, `question`, `decisionQuestion`, `condition`, `onPass`, `onFail` → SAFE_SUMMARY; the projection may normalize wording but may not invent logic.
- `basis`, `evidenceClass`, `clientConfigured` → SAFE_ALL as category/status fields.
- `sourceRefs` or equivalent exact source lineage → GOVERNANCE.
- any future machine expression, executable predicate, AST, compiler token, exact runtime route or client-local code → EXECUTION_PROTECTED or OWN_WORKSPACE as applicable; never inherited as public-safe.

## E. Constraints and controls

- `constraints[].constraint`, `type`, `basis`, `clientConfigured` → SAFE_ALL/SAFE_SUMMARY as human-readable operational constraints.
- `controls[].controlId` → SAFE_TRACE.
- `controls[].objective`, `executionPoint`, `failureBehavior` → SAFE_SUMMARY.
- `controls[].evidenceClass` → SAFE_ALL.
- `controls[].sourceBasis|sourceRefs` → GOVERNANCE.
- machine control expression, runtime hook, exact client threshold/value → EXECUTION_PROTECTED / OWN_WORKSPACE.

## F. Atomic actions

- `atomicActions[].actionId` → SAFE_TRACE.
- `action`, `precondition`, `postcondition`, `executorNeutral` → SAFE_SUMMARY / SAFE_ALL.
- canonical `performerRole`, `authorityOwner`, `targetSystemRole` → SAFE_SUMMARY; client-bound named instances are not included.
- `evidenceClass` → SAFE_ALL.
- `sourceRefs` → GOVERNANCE.
- executable command, endpoint, payload mapping, runtime function/agent prompt or tool parameters → EXECUTION_PROTECTED / OWN_WORKSPACE.

## G. States and branch transitions

Daughter-level reference state/branch semantics are operational knowledge, distinct from the protected compiled WorkDefinition transition graph.

- `states.before`, `states.success`, `states.failure`, `states.controlledFailure`, `states.recovery` → SAFE_SUMMARY.
- `branchTransitions[].transitionId` → SAFE_TRACE.
- `fromState`, `event`, `condition`, `toState`, `branch`, `nextHandling`, `nextStep`, `evidenceRequired` → SAFE_SUMMARY.
- exact runtime queue/subqueue/status/route mapping, compiled transition IDs/guards and client status codes → EXECUTION_PROTECTED / OWN_WORKSPACE.

## H. Temporal constraints

- `temporalConstraints[].temporalId` → SAFE_TRACE.
- `type`, `rawText`, `requiredWhen`, `startWhen`, `stopWhen`, `durationOrDeadline`, `timezone`, `resolutionStatus` → SAFE_SUMMARY, with client-specific numeric values removed unless own-workspace entitled.
- `sourceRefs` → GOVERNANCE.
- actual client/carrier cut-off, SLA duration, contract time bar or local threshold → OWN_WORKSPACE.
- compiled wait/timer expressions → EXECUTION_PROTECTED.

## I. Responsibility

- canonical `responsibility.performer`, `owner`, `decisionAuthority`, `exceptionOwner`, `custody` → SAFE_SUMMARY.
- actual client role/team/person, delegation limit, approval threshold and escalation target → OWN_WORKSPACE.
- governance authority metadata outside client scope → GOVERNANCE.

## J. System exchanges

- `systemExchanges[].exchangeId` → SAFE_TRACE.
- canonical `producerSystemRole`, `authoritySystemRole`, `consumerSystemRoles`, `payloadObjectIds`, `interfaceType`, `acknowledgement`, `idempotency`, `retry` → SAFE_SUMMARY.
- `sourceRefs` → GOVERNANCE.
- actual client application/environment/endpoint/topic/queue/table/field/credential/integration configuration → OWN_WORKSPACE.
- executable runtime connector configuration/payload transform → EXECUTION_PROTECTED.

## K. Documents / objects

- canonical `documents[].documentId`, `role`, `requiredWhen` → SAFE_ALL/SAFE_TRACE.
- `documents[].fieldContract` → SAFE_SUMMARY; exact protected machine schema or proprietary field map is omitted.
- `documents[].sourceRefs` → GOVERNANCE.
- canonical document family/state/legal-state summary may be SAFE_SUMMARY where separately governed; exact restricted legal/source basis remains GOVERNANCE.
- client document template/layout/field coordinates → OWN_WORKSPACE.

## L. Evidence and outcomes

- `evidenceContracts[].evidenceId` → SAFE_TRACE.
- `type`, `requirement`, `acceptanceCriteria`, `evidenceClass` → SAFE_ALL/SAFE_SUMMARY.
- `retention` → SAFE_SUMMARY as contextual class; exact client contractual retention value → OWN_WORKSPACE.
- `expectedOutcomes[].code`, `meaning`, `stateAfter`, `requiredEvidence` → SAFE_SUMMARY.
- runtime route/status/next-step mappings → EXECUTION_PROTECTED / OWN_WORKSPACE.

## M. Client-binding requirements

| Canonical path | Visibility | Masking / scope |
|---|---|---|
| `clientBindingRequirements[].bindingId` | SAFE_TRACE | not necessarily displayed |
| `.taskId` | SAFE_TRACE | none |
| `.bindingObject` | SAFE_ALL | canonical concept only |
| `.bindingType` | SAFE_ALL | none |
| `.requiredWhen` | SAFE_ALL | none |
| `.why` | SAFE_ALL | none |
| `.valueOrigin` | SAFE_ALL | class only |
| `.validation` | SAFE_SUMMARY | human-readable, no local secret/value |
| `.resolutionStatus` | SAFE_ALL | none |
| `.collectionQuestion` | OWN_WORKSPACE | Pilot/Client Workspace/Admin/Owner; omitted public/general authenticated |
| `.sourceRefs` | GOVERNANCE | omitted otherwise |
| `.basis` and descendants | GOVERNANCE | safe projection may emit only basis/evidence class |
| `.systemOfRecord.canonicalAuthoritySystemRole` | SAFE_SUMMARY | canonical role |
| `.systemOfRecord.canonicalProducerRoles` | SAFE_SUMMARY | canonical roles |
| `.systemOfRecord.canonicalConsumerRoles` | SAFE_SUMMARY | canonical roles |
| `.systemOfRecord.clientApplication` | OWN_WORKSPACE | active workspace only |
| `.systemOfRecord.clientEnvironment` | OWN_WORKSPACE | active workspace only |
| `.clientFieldMapping.canonicalConcept` | SAFE_SUMMARY | canonical concept |
| `.clientFieldMapping.requiredIfDigitallyExecuted` | SAFE_ALL | none |
| `.clientFieldMapping.clientFieldOrApiElement` | OWN_WORKSPACE | active workspace only |
| `.authorityOwner.canonicalOwnerBasis|canonicalRole` | SAFE_SUMMARY | canonical role/basis |
| `.authorityOwner.clientRoleOrTeam` | OWN_WORKSPACE | active workspace only |
| `.authorityOwner.clientNamedPerson` | OWN_WORKSPACE | active workspace only |
| `.clientDependencyBoundary` | SAFE_SUMMARY | generic boundary only; client-specific contents default private |
| actual local parameter/value/code/crosswalk/contract/policy | OWN_WORKSPACE | active workspace only |

## N. Provenance claims

- `provenanceClaims[].claimId` → SAFE_TRACE.
- owning operational assertion is presented through its classified canonical field; raw duplicate `statement` is SAFE_SUMMARY only when necessary for a provenance view.
- `evidenceClass`, confidence/status summaries → SAFE_ALL.
- exact `sourceRefs`, detailed `claimBoundary`, effective-source crosswalk and source-resolution notes → GOVERNANCE.
- public/normal provenance must not expose protected source inventory indirectly through IDs, URLs or source-count fingerprinting.

## O. Executability and WorkDefinition-readiness

- `executability.status`, `decompositionRequired` → SAFE_ALL through Execution Readiness.
- `executability.stopCriterion` → SAFE_SUMMARY; never raw pass-through where it reveals protected derivation detail.
- `executability.candidateDecomposition` → EXECUTION_PROTECTED; safe projection may expose only approved type/count aggregate.
- `workDefinitionReadiness.daughterOperationalContract`, `clientBindingContract`, `workDecomposition`, `canonicalWorkDefinition`, `independentExecutorProof` → SAFE_ALL status fields.
- any future detailed failing-element list → GOVERNANCE or EXECUTION_PROTECTED depending content.

## P. Recursive Work Decomposition — protected operational layer

Full descendant fields are **EXECUTION_PROTECTED**:
`decompositionId`, `parentA5Id`, `type`, `purpose`, `trigger`, `inputs`, `decision`, `action`, `systemInteraction`, `humanBoundary`, `control`, `outcome`, `exception`, `evidence`, `provenance`, `confidence`, child relationships/tree/graph, exact node sequencing and derivation lineage.

Safe users may receive only explicitly constructed aggregates:
- decomposition availability/status;
- node count;
- node-type counts at approved coarseness;
- maximum depth where non-sensitive;
- unresolved count;
- executor-ready count/status.

## Q. Canonical WorkDefinition — protected operational layer

Full descendant fields are **EXECUTION_PROTECTED**:
identity, lineage, applicability, work object, entry event, required inputs, canonical fields, decisions, rules, validations, controls, actions, systems, actors, outcomes, transitions, waits/clocks, retries, escalations, recovery, evidence, state-after semantics, execution characteristics, client-binding points and all machine-readable/compiled descendants.

Safe users may receive only:
- WorkDefinition availability/status;
- schema/contract version if classified safe;
- executor-neutral readiness/proof status;
- approved aggregate counts that cannot reconstruct the contract.

## R. Runtime projections

All runtime-specific queue/subqueue/work-type/outcome/route/status/next-step definitions, agent/tool contracts, RPA selectors, workflow nodes, API execution mappings and Malkom projection payloads are **EXECUTION_PROTECTED**, additionally subject to runtime assignment/capability. Client-local binding values within them remain **OWN_WORKSPACE**.

## S. Catch-all / schema evolution

**Every canonical field or descendant path not explicitly matched above is `PRIVATE_DEFAULT` and MUST NOT be emitted by P2/P3/P5 projections.**

A new field requires one of:
1. explicit addition to a superseding frozen field-classification contract; or
2. server-side omission until classification is approved.

This catch-all is what makes the registry complete even when schemas evolve.

## Exit condition

P1 field classification passes only if P2 can evaluate every candidate canonical path against an explicit allow/summary/own-workspace/governance/execution-protected/private-default rule without relying on renderer judgement.
