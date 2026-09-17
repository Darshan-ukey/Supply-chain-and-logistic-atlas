# P6.1 Successor Generation Contract V1

**Status:** DRAFT_CANDIDATE — NOT OWNER-FROZEN
**Purpose:** Govern deterministic future generation of canonical Road LTL work decomposition successors without mutating the historical certified P6.1 V1 bundle.

## 1. Authority model

This contract reconciles four authorities:

1. **Aug 26–28, 2026 Atlas/Malkom methodology decisions** — methodology source only.
2. **Canonical Work Decomposition Contract V1** — structural/semantic contract.
3. **Executability & Recursive Decomposition Standard V1** — executability and fail-closed rules.
4. **P6.1 V1 Reconstruction Rule Baseline CR1–CR11** — recovered historical-fidelity generation rules.

The historical certified P6.1 output remains immutable forensic/certification evidence. It is not a generation target.

## 2. Governing methodology recovered from Aug 26–28 conversations

The canonical flow is:

`GOVERNED DOMAIN KNOWLEDGE -> WORK DECOMPOSITION -> CANONICAL WORK DEFINITION/EXECUTION SEMANTICS -> CLIENT BINDING/EXTENSIONS -> ADAPTER/COMPILER -> RUNTIME`

The core is executor/tool-neutral. Malkom is an adapter/projection consumer, not the canonical ontology.

Canonical semantics may include trigger, state, inputs, decisions, rules, controls, actions, systems, outcomes, transitions, evidence, escalation, clocks/timers, actors/roles, objects, provenance and source support.

Runtime-specific structures such as Malkom Queue/Subqueue/WorkType, workflow-engine states, RPA steps or agent schemas are downstream projections. Unsupported runtime capability must be reported explicitly and must never be silently flattened, deleted, converted to END/STAY, or inferred.

Derived Work Decomposition/WorkDefinition assets never rewrite the governed Atlas source. Client binding and runtime projection never mutate an ACTIVE canonical reference definition.

## 3. Deterministic input closure

A generation run is valid only when its manifest pins exact immutable identities for all applicable inputs:

- module ID and version;
- exact Daughter/task source objects;
- exact Operational Knowledge objects;
- workDecompositionSeed entries where present;
- applicable information-resolution/claim/rule sources;
- Canonical Work Decomposition Contract version/hash;
- Executability & Recursive Decomposition Standard version/hash;
- this Generation Contract version/hash;
- generator implementation commit/blob hash;
- runtime/language version and dependency lock identity;
- canonicalization/hash algorithm version;
- validator implementation identities;
- explicit governed N/A decisions and their authority.

Floating `latest`, branch-head-only, mutable URLs, or unversioned runtime/configuration references are invalid.

## 4. Generation algorithm

For each governed source task, in deterministic source order:

1. Instantiate exactly one TASK_ROOT.
2. Read the source-defined `workDecompositionSeed` in source order when present.
3. Treat each seed entry as one primary work unit by default.
4. Recursively split a primary unit only when frozen governed source supports at least two distinct child-level execution contracts with independently sufficient operation/gate semantics.
5. Sequence/order may establish order or pre-state only; it may not invent decision criteria, authority, validation logic, exception handling or missing semantics.
6. Generated wording may expose source semantics but may never create semantic content.
7. For each candidate terminal leaf, evaluate canonical executability before assigning readiness.
8. Use only the governed blocker taxonomy. Missing canonical semantics/decision criteria/authority/validation/success-failure/exception logic => `BLOCKED_BY_KNOWLEDGE_GAP`. Canonical work understood but enterprise/client/site/runtime assignment/mapping unresolved => `BLOCKED_BY_CLIENT_BINDING`.
9. Do not create a ready downstream mechanical child merely because a blocked client binding would make the later action obvious.
10. Generic validation categories are not executable validation rules; an actual applicable rule must be source-supported.
11. A reference to an authority/source-of-truth policy does not resolve missing precedence unless the applicable precedence itself is governed.
12. Material authority/role is required only where execution/decision genuinely depends on it. Runtime executor assignment is not canonical authority.
13. Failure/alternate-path semantics may inherit a genuinely applicable governed exception policy; otherwise unresolved material failure handling fails closed.
14. Unsupported adapter/runtime semantics remain canonically preserved and are reported as capability gaps; they never alter canonical generation.
15. Validate graph reachability, termination, parent references, cycles, orphan nodes, blocker referential integrity, source grounding and semantic conflicts.
16. Emit canonical output only after all structural validation passes. A valid output may still contain governed blockers.

## 5. Historical-count prohibition

Historical P6.1 counts — including 22 tasks, 603 work units, 444 leaves, 185 EXECUTOR_READY, 163 BLOCKED_BY_CLIENT_BINDING and 96 BLOCKED_BY_KNOWLEDGE_GAP — are post-generation forensic evidence only.

The generator MUST NOT branch, split, merge, relabel or promote/demote any unit to approach historical counts. Historical output hashes/counts must not be visible to the generation algorithm before output finalization.

## 6. Canonical output requirements

Every emitted work unit must carry or resolve deterministically to:

- stable ID derived from source identity + governed decomposition path;
- parent/root linkage;
- unit type;
- canonical action/gate semantics;
- source/provenance references;
- semantic source version;
- readiness/blocker state;
- blocker references where applicable;
- applicable authority/role semantics where material;
- applicable failure/alternate-path semantics;
- deterministic content hash.

Output ordering must be deterministic and independent of object insertion order, wall-clock time, run ID or environment-specific metadata.

## 7. Separation of canonical generation and runtime projection

The generator MUST NOT emit Malkom Queue/Subqueue/WorkType, runtime-specific statuses, runtime routing IDs, client system IDs or adapter-only schemas as canonical semantics.

Adapter generation occurs only after canonical output is fixed. Capability mismatches are reported as projection diagnostics such as `UNSUPPORTED_BY_<ADAPTER>` and may block projection, but they cannot rewrite canonical work.

## 8. Verification gates

A generation candidate cannot be frozen until:

1. deterministic rerun produces identical canonical semantic hashes from identical frozen inputs;
2. schema validation passes;
3. graph validation passes;
4. blocker integrity passes;
5. source-grounding validation passes;
6. independent QA passes;
7. a fresh recovery/rebuild run from frozen inputs succeeds in an originating-session-independent environment;
8. Generation Registry records exact input, generator, validator and output identities;
9. immutable custody and recovery references are recorded.

## 9. Historical P6.1 boundary

This contract does not authorize regeneration, replacement, mutation or reseeding of the historical certified P6.1 protected bundle.

The existing P6.1 bundle must first be recovered and frozen byte-for-byte from its certified protected store. Future outputs created under this contract are successors and must receive new identities/versions.

## 10. Freeze condition

This document becomes `OWNER_FROZEN` only after:

- implementation exists and is independently QA'd;
- deterministic fixtures pass;
- recovery/rebuild proof passes;
- exact hash/identity is recorded in the Generation Registry;
- Owner explicitly authorizes freeze.
