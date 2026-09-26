# Canonical WorkDefinition Contract V1 — FROZEN

**Asset ID:** `CANONICAL-WORKDEFINITION-CONTRACT-V1`
**Version:** `1.0.0`
**Status:** `FROZEN`
**Phase:** `P6.2`
**Classification:** Governance contract; WorkDefinition instances are `EXECUTION_PROTECTED`
**Governing standards:** `KNOWLEDGE_TO_EXECUTION_ARCHITECTURE_V1_FROZEN.md`, `EXECUTABILITY_AND_RECURSIVE_DECOMPOSITION_STANDARD_V1_FROZEN.md`, `CLIENT_BINDING_RESOLUTION_PRINCIPLE_V1_FROZEN.md`
**Upstream contract:** `CANONICAL_WORK_DECOMPOSITION_CONTRACT_V1_FROZEN.md`
**Supersession record:** `governance/standards/CANONICAL_WORKDEFINITION_CONTRACT_SUPERSESSION_V1.json`

## 1. Purpose

This contract defines the executor-neutral structure of a Canonical WorkDefinition: the deterministic compiled representation of a single unit of governed operational work that an executor class can perform.

It does **not** define runtime queues, Malkom structures, RPA steps, agent prompts, API endpoints, client field mappings or client values. Those are downstream projections and bindings.

## 2. Semantic position

`Daughter A5 → Operational Knowledge → Recursive Work Decomposition → Canonical WorkDefinition → Client Binding → Runtime Projection / Compiler`

A WorkDefinition is **derived truth**. It is compiled from governed upstream knowledge and never becomes an independent source of truth. It must not introduce operational semantics that do not exist upstream.

## 3. Compilation unit

The compilation unit is the **terminal Work Decomposition leaf whose `executorReadiness.status` is `EXECUTOR_READY`**.

Per `CANONICAL_WORK_DECOMPOSITION_CONTRACT_V1_FROZEN.md` §12, an `EXECUTOR_READY` leaf is *eligible* for WorkDefinition compilation. This contract makes that the exact and only unit.

Consequently:

- a leaf that is `BLOCKED_BY_CLIENT_BINDING` MUST NOT produce a WorkDefinition;
- a leaf that is `BLOCKED_BY_KNOWLEDGE_GAP` MUST NOT produce a WorkDefinition;
- a unit that is `NEEDS_DECOMPOSITION` MUST NOT produce a WorkDefinition;
- an internal (non-terminal) node MUST NOT produce a WorkDefinition.

Blocked and composite units are recorded in the per-task **compilation coverage record** (§9) with their governed blocker references preserved. They are never rewritten as executable.

The total WorkDefinition count is an **output** of compilation. It is proven by the compiler and verifier, never asserted in advance.

## 4. Identity and lineage

Every WorkDefinition MUST carry:

- `schemaVersion`
- `workDefinitionId`
- `contractVersion`
- `version`
- `status`
- `title`
- `purpose`
- `lineage`
- `provenance`

`lineage` MUST preserve, by canonical ID rather than display-name matching:

- `daughterModule`
- `daughterVersion` — the **effective** module version
- `semanticSourceVersion` — the semantic base actually governing this task
- `inheritance` — e.g. `LOSSLESS_UNCHANGED_TASK` or `DIRECT_GOVERNED_OVERRIDE`
- `sourceTaskId`
- `sourceTaskTitle`
- `decompositionId`
- `decompositionContractVersion`
- `sourceWorkUnitId`
- `workUnitPath` — ordered root→leaf `workUnitId` chain
- `unitType`

Effective-version inheritance MUST remain explicit. Runtime lookup MUST resolve the exact effective version and MUST NOT fall back to a semantic base version.

`provenance` MUST preserve:

- `compiledFrom` — const `CANONICAL_WORK_DECOMPOSITION_V1`
- `compilerVersion`
- `governedInputContentHash` — the certified protected decomposition content hash
- `sourceRefs[]` — governed source references carried from the work unit

## 5. Executable body

A WorkDefinition MAY express, and where the governed source establishes them MUST express:

| Category | Field |
|---|---|
| Applicability | `applicability.requiredWhen[]`, `applicability.prohibitedWhen[]`, `applicability.entryConditions[]` |
| Trigger | `trigger` |
| Inputs / objects / fields | `inputs[]` |
| Actors | `actors[]` |
| Systems | `systems[]` |
| Decisions | `decisions[]` |
| Rules | `rules[]` |
| Validations | `validations[]` |
| Controls | `controls[]` |
| Actions | `actions[]` |
| Outcomes | `outcomes[]` |
| Transitions | `transitions[]` |
| Clocks / waits | `clocks[]` |
| Evidence | `evidence[]` |
| Exceptions / retries / escalations / recovery | `exceptions[]` |
| Dependencies / required pre-state | `dependencies[]` |
| Execution characteristics | `executionCharacteristics` |
| Client-binding requirements | `clientBindingRequirements[]` |

A field absent from the governed upstream source MUST be omitted or carried as an explicit empty set. The compiler MUST NOT synthesise content to fill a category.

`executionCharacteristics` carries only facts derivable from the governed source:

- `executorClassBound` — whether the governed source binds an executor class;
- `clientBindingRequired` — whether governed client-binding references exist;
- `knowledgeGapPresent` — whether governed knowledge-gap references exist;
- `outputState`, `fallbackIfBlocked` — carried verbatim where present.

Properties such as determinism or human-in-the-loop necessity are **not** derivable from Work Decomposition V1 and MUST NOT be asserted by the compiler. They are established later by executor binding and independent executor proof.

## 6. Executability

`executability.status` for a compiled WorkDefinition is `EXECUTOR_READY`, inherited from the governed source leaf. It does **not** mean runtime-certified.

`executability` MUST carry:

- `status`
- `executorClass` — from the Executability & Recursive Decomposition Standard vocabulary
- `independentExecutorProofStatus` — `NOT_INDEPENDENTLY_PROVEN` until separately demonstrated
- `requiredClientBindings[]` — stable references only
- `requiredKnowledgeGaps[]` — stable references only

An `EXECUTOR_READY` WorkDefinition MAY still reference client bindings that supply environment-specific values. It MUST NOT embed those values.

## 7. Client-binding boundary

`clientBindingRequirements[]` carries **stable binding requirement references only**.

A WorkDefinition MUST NOT contain a client value, client application name, client environment identifier, client organisational owner, queue name, endpoint, credential, local code crosswalk or client field mapping value.

Per the Client Binding Resolution Principle, Atlas owns the requirement/semantic; the client supplies the value.

## 8. Forbidden runtime leakage

The following MUST NOT appear anywhere in a canonical WorkDefinition, at any depth, as key or as structural concept:

- `malkomProjection`
- runtime queue / sub-queue structures
- RPA step definitions
- agent prompts or agent contracts
- runtime endpoints, connectors or adapters
- `clientFieldMapping` values, `clientApplication`, `clientEnvironment`
- `runtimeMappings`

Runtime projection is a separate, later, bounded phase. Compatibility with an existing runtime consumer is **not** a justification for embedding runtime structure in canonical truth.

## 9. Compilation coverage record

For each compiled A5 task the compiler MUST emit a coverage record containing:

- `sourceTaskId`, lineage and decomposition identity;
- `leafCount`;
- `compiledCount` — WorkDefinitions produced;
- `notCompiled[]` — every terminal leaf that did not compile, with `workUnitId`, `status` and its governed `requiredClientBindings[]` / `requiredKnowledgeGaps[]` references;
- `coverageStatus`.

Coverage is evidence of honest partial executability. A task with blocked leaves is never reported as fully compiled.

## 10. Determinism

Compilation MUST be deterministic: identical governed input MUST produce byte-identical canonical output, including ordering. The compiler MUST NOT depend on wall-clock time, random values, map iteration order or LLM inference for canonical content.

Volatile persistence metadata (for example `updated_at`) is not canonical content and is excluded from the canonical content hash.

## 11. Protection boundary

Full WorkDefinition instances are `EXECUTION_PROTECTED` and MUST NOT be committed to the public web/GitHub bundle or preloaded by the normal Daughter/Canvas surface.

The public projection may expose only an allowlisted, non-reconstructive summary:

- compilation status;
- WorkDefinition count;
- compiled/not-compiled leaf counts;
- blocker counts by class;
- independent executor-proof status;
- `detailIncluded: false`.

Full detail requires the `atlas.workdefinition.full.read` capability and is served from the protected backend with `private, no-store` semantics.

## 12. Downstream boundary

P6.2 stops at Canonical WorkDefinition. Client Binding resolution, Atlas Warehouse compilation and runtime projection are subsequent controlled phases.

A WorkDefinition existing does not imply a binding exists, a runtime exists, or an executor has been certified.

## 13. V1 invariants

1. Only `EXECUTOR_READY` terminal leaves compile.
2. Blocked work stays visibly blocked with its governed reason references.
3. Lineage resolves by canonical ID and preserves effective-version semantics.
4. No runtime-specific or client-specific structure enters canonical truth.
5. Compilation is deterministic and adds no knowledge absent upstream.
6. Exact module/version/task resolution fails closed.
7. Full WorkDefinition detail stays behind the protected data/API boundary.
8. WorkDefinition count is proven by compilation, never assumed.
