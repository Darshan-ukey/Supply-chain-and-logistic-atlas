# Execution-Depth Field Classification V1.1

**Status:** FROZEN  
**Phase:** P1R — Frozen Stack Lock v2.2 reconciliation  
**Governing architecture:** `ATLAS-DAUGHTER-EXECUTION-DEPTH-PRESENTATION-ARCHITECTURE-V1`  
**Supersedes for future implementation:** `EXECUTION_DEPTH_FIELD_CLASSIFICATION_V1_FROZEN.md`  
**Machine-readable companion:** `governance/presentation/execution-depth-field-classification-v1.1.json`

## Purpose

Classify execution-depth canonical fields after Operational Knowledge Contract v2 embedded Information Resolution Contract v1. The default remains fail-closed: any field/path not explicitly classified is `PRIVATE_DEFAULT` and is omitted from unauthorized projections.

## Visibility profiles

- **SAFE_ALL** — deliberately projected value may be emitted to all consumer classes.
- **SAFE_TRACE** — canonical identifier may travel as trace metadata; display optional.
- **SAFE_SUMMARY** — source value must be transformed into a governed human-readable/aggregate summary; raw value is not passed through.
- **OWN_WORKSPACE** — active Pilot/Client Workspace plus authorized governance/Owner only.
- **GOVERNANCE** — Admin/Governor or Owner only.
- **EXECUTION_PROTECTED** — full value requires protected-execution capability; Owner allowed.
- **PRIVATE_DEFAULT** — not projected until explicitly reclassified.

Masking values: `NONE`, `SUMMARY_ONLY`, `OWN_SCOPE_ONLY`, `OMIT`.

## Global invariants

1. New canonical fields are private by default.
2. Exact client values/mappings are own-workspace data.
3. Exact source-to-claim lineage is governance data unless separately released.
4. Exact machine/compiler/runtime logic is execution-protected.
5. Safe Operational Knowledge may explain business meaning and resolution behavior, but must not provide enough machine detail to reconstruct protected execution contracts.
6. Full Work Decomposition and WorkDefinition remain protected regardless of UI visibility.
7. Canonical statuses are preserved; user-facing aliases do not replace source status values.

## A. Overview / task identity

- `taskId`, canonical task/concept IDs, A5 contract IDs → **SAFE_TRACE**.
- task title, purpose, boundary, business outcome, safe hierarchy labels → **SAFE_ALL / SAFE_SUMMARY**.
- raw source IDs/claim boundaries → **GOVERNANCE**.

## B. Applicability

Human-readable required/prohibited conditions, jurisdiction/regime/condition applicability and active-context status → **SAFE_ALL / SAFE_SUMMARY**.

Internal resolver expressions, hidden scoring/ranking, machine predicates or unclassified descendants → **PRIVATE_DEFAULT / EXECUTION_PROTECTED**.

## C. Operational Knowledge v2 task semantics

- `businessMeaning`, `why`, pre/postcondition and outcome summaries → **SAFE_SUMMARY**.
- canonical input/output object families and system-of-record roles → **SAFE_SUMMARY**.
- ambiguity/unresolved dependency counts/categories → **SAFE_SUMMARY**.
- exact internal notes, source claim detail and unclassified payloads → **GOVERNANCE / PRIVATE_DEFAULT**.

## D. Information Resolution v1 — identity and shape

| Path family | Classification | Rule |
|---|---|---|
| `informationResolution[].canonicalFieldId` | SAFE_TRACE | trace identifier |
| `.canonicalObjectRef` | SAFE_TRACE | trace identifier |
| `.businessMeaning` | SAFE_ALL | governed human-readable meaning |
| `.scope` | SAFE_ALL | canonical object/scope class |
| `.shape.datatype` | SAFE_ALL | safe type |
| `.shape.cardinality` | SAFE_ALL | safe cardinality |
| `.shape.unit` | SAFE_SUMMARY | normalized unit class where safe |
| `.shape.codeAuthority` | SAFE_SUMMARY | authority class/name only if non-restricted |

## E. Information Resolution v1 — applicability and value origin

- `.applicability.requiredWhen`, `.prohibitedWhen`, `.jurisdictionApplicability`, `.conditionIds` → **SAFE_SUMMARY**.
- `.valueOrigin.originClass` → **SAFE_ALL**.
- `.valueOrigin.allowedEvidenceSources` → **SAFE_SUMMARY** by evidence/source family only; exact source IDs are not passed through.
- `.valueOrigin.labelSynonyms`, `.documentRegionHints` → **PRIVATE_DEFAULT** unless explicitly released because they can expose extraction/runtime design.

## F. Information Resolution v1 — resolution logic

- `.resolutionRules.extraction` → **SAFE_SUMMARY** only; exact extraction instructions are protected/private.
- `.resolutionRules.derivation` → **SAFE_SUMMARY** only; exact executable derivation is **EXECUTION_PROTECTED**.
- `.resolutionRules.association` → **SAFE_SUMMARY** only.
- `.resolutionRules.normalization` → **SAFE_SUMMARY** only.
- `.resolutionRules.allowedValues` → **SAFE_SUMMARY** only when the domain values themselves are safe; client/local code lists remain **OWN_WORKSPACE**.

The safe projection may explain what must be resolved, associated or normalized, but not expose compiler-ready expressions, prompts, selectors, regexes, model instructions or runtime implementation detail.

## G. Information Resolution v1 — validation

- `.validation.fieldRules` → **SAFE_SUMMARY**.
- `.validation.crossFieldRules` → **SAFE_SUMMARY** at business-rule level; exact executable expressions are **EXECUTION_PROTECTED**.
- `.validation.crossObjectRules` → **SAFE_SUMMARY** at business-rule level; exact executable expressions are **EXECUTION_PROTECTED**.

Public summaries must not reveal exact client thresholds, restricted classification algorithms or full machine decision graphs.

## H. Information Resolution v1 — authority and runtime policy

- `.authority.authorityOwner`, `.systemOfRecordRole` → **SAFE_SUMMARY** canonical roles.
- `.authority.authoritySource` → **GOVERNANCE**; safe projection may show source/authority class only.
- `.runtimePolicy.conflictPolicy`, `.missingValuePolicy`, `.confidencePolicy`, `.humanReviewPolicy` → **SAFE_SUMMARY**.
- exact confidence thresholds, runtime score cut-offs, queue/team routes or client escalation targets → **OWN_WORKSPACE / EXECUTION_PROTECTED**.

## I. Information Resolution v1 — provenance, binding and measurement

- `.sourceClaims` → **GOVERNANCE**.
- `.binding.resolutionStatus` → **SAFE_ALL**.
- `.binding.clientBindingSlots` → canonical need/status may be **SAFE_SUMMARY**; actual client slot/value/mapping is **OWN_WORKSPACE**.
- `.binding.runtimeMappings` → **EXECUTION_PROTECTED**; client-local portions remain **OWN_WORKSPACE**.
- `.measurement.measurementProfile` → **SAFE_SUMMARY** where it names non-sensitive metric classes.
- `.measurement.feedbackProfile` and runtime observations → **OWN_WORKSPACE / GOVERNANCE** by scope.

## J. Required information / decisions / controls / actions

Existing P1 classifications remain:
- canonical requirement names, categories, `requiredWhen`, `why`, value-origin class, evidence class → **SAFE_ALL / SAFE_SUMMARY**;
- validation summaries → **SAFE_SUMMARY**;
- exact source refs → **GOVERNANCE**;
- decision questions/conditions and control/action descriptions → **SAFE_SUMMARY**;
- machine predicates, runtime commands, endpoints, payload maps, agent prompts/tool parameters → **EXECUTION_PROTECTED**.

## K. States, branches, timing, responsibility, systems, documents and evidence

Existing P1 classifications remain:
- daughter-level state/branch/timing/responsibility/system/document/evidence semantics → **SAFE_SUMMARY** when expressed in canonical human-readable form;
- exact compiled transitions/timers/routes/status codes/connector configuration → **EXECUTION_PROTECTED**;
- client system names, endpoints, fields, templates, coordinates, local SLAs/thresholds/roles → **OWN_WORKSPACE**;
- exact source refs → **GOVERNANCE**.

## L. Client binding

Canonical need/type/why/requiredWhen/value-origin class/resolution status → **SAFE_ALL / SAFE_SUMMARY**.

Collection questions → **OWN_WORKSPACE** for Pilot/Client Workspace; governance/Owner may receive according to scope.

Actual client application/environment/field/API/code/value/policy/contract/team/person mapping → **OWN_WORKSPACE**.

## M. Provenance

Claim IDs may travel as **SAFE_TRACE** where needed. Evidence class/confidence/status summaries → **SAFE_ALL**. Exact source refs, source-to-claim crosswalk, detailed claim boundary and source-resolution notes → **GOVERNANCE**.

## N. Execution Readiness

Safe projections may emit:
- overall readiness status;
- decomposition required/status;
- executor-proof status;
- coverage summaries, including Information Resolution/object association/semantic classification/normalization-validation/conditional applicability;
- unresolved category counts;
- HITL/system/client-binding indicators;
- Work Decomposition/WorkDefinition availability/status.

Exact failing machine logic, candidate decomposition, WorkDefinition detail or source/client payloads remain protected/scoped.

## O. Recursive Work Decomposition

Full descendant fields, tree/graph relationships, node sequencing, derivation lineage and exact node contracts → **EXECUTION_PROTECTED**.

Safe users may receive only explicitly approved status and coarse aggregates that cannot reconstruct the decomposition.

## P. Canonical WorkDefinition

Full identity/lineage/applicability/work object/input fields/decisions/rules/validations/controls/actions/systems/actors/outcomes/transitions/waits/retries/escalations/recovery/evidence/execution characteristics/client-binding points and machine descendants → **EXECUTION_PROTECTED**.

Safe users may receive only availability/status/schema version if separately safe, executor-neutral readiness/proof status and approved non-reconstructive aggregates.

## Q. Runtime projections

All runtime-specific queue/subqueue/work-type/outcome/route/status/next-step definitions, workflow nodes, RPA selectors, agent/tool contracts, API mappings, compiler payloads and Malkom projection detail → **EXECUTION_PROTECTED**. Client-local values inside them remain **OWN_WORKSPACE**.

## R. Canonical status mapping

Canonical statuses remain canonical. Safe projection may map to labels only:
- `CANONICAL_RESOLVED` / `SOURCE_RESOLVED` → resolved reference knowledge;
- `SOURCE_CONTEXT_PENDING` → source/context resolution required;
- `CLIENT_BINDING_REQUIRED` → client localization required;
- `RESOLVED_CLIENT_SPECIFIC` → resolved in authorized client scope;
- `METRIC_DEFINITION_REQUIRED` → metric definition unresolved;
- `UNKNOWN` → unknown/unresolved.

## S. Catch-all / schema evolution

Every canonical path not explicitly matched by this contract or its machine companion is **PRIVATE_DEFAULT / OMIT**. A new field requires explicit classification in a superseding frozen contract before P2/P3/P5 may emit it.

## P2 implementation rule

P2 must evaluate candidate fields server/build-side against this classification before response construction. Renderer judgement cannot widen visibility. Road LTL v1.5 LTL-03/BOL is the first deep proof; the same logic must remain generic for Ocean FCL/LCL v0.6 and future daughters.

## Exit condition

P1R field classification passes only if every OKv2/Information Resolution path used by P2 has an explicit safe/summary/own-workspace/governance/execution-protected/private-default outcome and unclassified paths fail closed.
