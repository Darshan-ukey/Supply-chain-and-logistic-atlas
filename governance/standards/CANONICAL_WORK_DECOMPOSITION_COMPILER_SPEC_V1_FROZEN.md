# Canonical Work Decomposition Compiler Specification V1 — FROZEN

Asset ID: `CANONICAL-WORK-DECOMPOSITION-COMPILER-SPEC-V1`
Version: `1.0.0`
Status: `FROZEN FOR P6.1 V1 RECONSTRUCTION`
Historical semantic basis: P6.1 V1

## 1. Purpose
This specification makes the previously implicit P6.1 generation procedure reproducible. It defines how an exact Daughter A5 task and its governed Operational Knowledge are transformed into a Canonical Work Decomposition V1 instance.

It does not alter the historical P6.1 contract. Where this specification conflicts with the frozen governing standard or Canonical Work Decomposition Contract V1, those historical assets prevail.

## 2. Governing inputs
A compiler run MUST pin:
- exact `daughterModule` and `daughterVersion`;
- exact `sourceTaskId` and `sourceTaskTitle`;
- exact source/Daughter semantic hash or immutable identity;
- exact Operational Knowledge version/hash applicable to the task;
- Information Resolution contracts/knowledge available to the task, where present;
- `EXECUTABILITY_AND_RECURSIVE_DECOMPOSITION_STANDARD_V1_FROZEN.md`;
- `CANONICAL_WORK_DECOMPOSITION_CONTRACT_V1_FROZEN.md`;
- `canonical-work-decomposition-contract-v1.schema.json`;
- intended executor-class lens used for the historical V1 executability criterion.

Missing required source authority MUST fail closed. The compiler MUST NOT fill semantic gaps from general knowledge or historical aggregate counts.

## 3. Canonical generation sequence
For each exact A5 task:

1. Create a `TASK_ROOT` preserving exact module/version/task lineage.
2. Read governed Operational Knowledge for trigger, inputs/business objects, applicability, decisions/rules/controls, authority, permitted actions, states/outcomes, timing/waits, exceptions/recovery, evidence and completion criteria.
3. Create child work units only where the governed source supports a distinct business/execution-significant operation or control.
4. Use only V1 canonical unit types:
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
5. Preserve parent-child lineage and deterministic sibling sequence.
6. Where a source action contains multiple separable operations, alternatives, conditions or unresolved authority, represent it as `ACTION_GROUP`/candidate and recursively split or block; lexical splitting alone is insufficient.
7. Represent material decision conditions explicitly as decision evaluation/gate semantics; do not bury branch logic inside prose actions.
8. Represent material timing/wait conditions explicitly as temporal controls/gates.
9. Represent required evidence/completion and resulting state explicitly.
10. Recurse until every leaf passes a terminal classification test.

## 4. Historical V1 terminal classification
A leaf is `EXECUTOR_READY` only when the frozen source material is sufficient, for the intended executor-class lens, to determine:
- required input/object;
- entry/applicability conditions;
- decision/gate logic without undocumented judgement;
- one unambiguous operation;
- success and failure conditions;
- required evidence;
- resulting state/transition;
- resolved canonical authority/role.

A leaf is `BLOCKED_BY_KNOWLEDGE_GAP` when canonical semantics required for execution are unresolved, including missing threshold/precedence, missing child-level action contract, missing success/failure criteria, unresolved source context or authority ambiguity. Stable `requiredKnowledgeGaps[]` references are mandatory.

A leaf is `BLOCKED_BY_CLIENT_BINDING` when canonical work is understood but execution requires enterprise/client/site/runtime-specific values or mappings. Stable `requiredClientBindings[]` references are mandatory; actual client values must not be embedded in canonical decomposition.

`NEEDS_DECOMPOSITION` is valid only on non-terminal work units with children. No terminal leaf may retain it.

## 5. Information Resolution rule
Information Resolution remains governed Operational Knowledge. The compiler consumes only the available governed semantics. It MUST NOT fabricate missing field precedence, source priority, validation, confidence, conflict-resolution or canonical-object semantics.

Where available knowledge is insufficient, create an explicit knowledge-gap blocker rather than inventing a rule.

## 6. Executor-class rule for V1
Historical P6.1 V1 uses the intended executor class as an executability lens. The compiler MUST record this lens in the run manifest.

This V1 compiler MUST NOT apply the later AR0.2 candidate rule that stops solely on technology-neutral business-semantic sufficiency. Runtime-neutral VNext decomposition requires a separate contract/version and Owner authorization.

## 7. Determinism and IDs
A compiler run MUST produce stable IDs from pinned lineage and canonical parent/sequence identity. Re-running with identical inputs, contract version, compiler version and executor-class lens MUST preserve structural identity unless an explicitly versioned compiler change is introduced.

The compiler MUST NOT use random IDs for canonical work units.

## 8. Required output per task
Each decomposition MUST include:
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
- recursive `workUnits` conforming to the frozen contract/schema
- stable knowledge-gap/client-binding references
- exact source references

## 9. Run manifest
Every generation run MUST persist a manifest containing:
- compiler specification version/hash;
- compiler implementation commit/hash;
- governing-standard hash;
- canonical-contract hash;
- schema hash;
- Daughter/source module/version/hash;
- Operational Knowledge input version/hash;
- Information Resolution input identities/hashes used;
- executor-class lens;
- task list;
- generated output hashes;
- counts by unit type and terminal status;
- validation result;
- timestamp and authorized execution identity.

## 10. Mandatory validation
For each task and aggregate run validate:
- schema conformance;
- exact module/version/task lineage;
- one task root per task;
- no orphan parent references;
- no cycles;
- deterministic sibling ordering;
- every terminal leaf classified as READY or explicitly blocked;
- no terminal `NEEDS_DECOMPOSITION`;
- each blocker carries stable required-gap/binding references;
- no client-specific values/runtime-native structures in canonical decomposition;
- public-safe output cannot reconstruct protected work-unit detail.

Historical aggregate totals such as 603 work units and 444 leaves are evidence from the 2026-09-07 run, not hard-coded compiler targets.

## 11. Persistence/custody boundary
The compiler output is `EXECUTION_PROTECTED`.

Storage encoding (`GZIP_BASE64`, `BROTLI_BASE64`, aggregate vs per-task rows) is a persistence concern and MUST NOT affect canonical decomposition semantics.

Before any protected runtime persistence, the full generated bundle, run manifest, output hashes and validation report MUST be durably archived in approved protected custody. A human-readable public-safe summary may be separately published.

## 12. Historical reconstruction rule
A reconstruction produced under this specification MUST be labelled `RECONSTRUCTED_P6_1_V1` and MUST NOT be described as byte-for-byte recovery of the lost 2026-09-07 protected bundle unless content identity is independently proven.

## 13. Change control
This V1 specification exists to make historical P6.1 reproducible. Any change to canonical stopping semantics, unit-type semantics, readiness tests or executor-neutrality requires a successor specification/contract version; do not silently mutate V1.
