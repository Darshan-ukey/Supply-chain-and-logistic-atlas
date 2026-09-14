# P6.1 V1 — LTL-03 Reconstruction Self-QA

Status: `SELF_QA_PASS__INDEPENDENT_QA_REQUIRED`

Scope: source-grounded reconstruction of Road LTL 1.5 / LTL-03 under the historical P6.1 V1 executability and recursive-decomposition rules.

This is **not** byte-for-byte recovery of the lost historical P6.1 private bundle and does not claim historical LTL-03 unit-count identity.

## Artifact under test

- Branch: `atlas-p6-1-v1-reconstruction`
- Machine contract: `governance/baselines/P6_1_V1_LTL03_RECONSTRUCTED_DECOMPOSITION.json`
- Contract commit before this QA record: `39ab0b4995291b3dddd664a8d3d13ad2fdc4a92e`
- Git blob SHA: `76dbfa96d5fd71544689e0c3b1bc5d4fe94f0165`
- Historical certified implementation base: `ba9d47f07b59ecf79ff6cde9145c0185cc18d39d`
- Compiler specification: `governance/standards/CANONICAL_WORK_DECOMPOSITION_COMPILER_SPEC_V1_FROZEN.md`

## Governing source inputs

1. `data/modules/road-ltl-v1.5.json`
2. `data/operational-knowledge/road-ltl-v1.5-operational.json`
3. `data/operational-knowledge/road-ltl-v1.5-bol-resolution-baseline.json`
4. `data/source-claims/road-ltl-v1.5-bol-resolution-claims.json`
5. `governance/standards/EXECUTABILITY_AND_RECURSIVE_DECOMPOSITION_STANDARD_V1_FROZEN.md`
6. `governance/standards/CANONICAL_WORK_DECOMPOSITION_CONTRACT_V1_FROZEN.md`
7. `schemas/canonical-work-decomposition-contract-v1.schema.json`

## Materialized result

- Work units: **64**
- Terminal leaves: **48**
- `EXECUTOR_READY`: **38**
- `BLOCKED_BY_CLIENT_BINDING`: **7** leaves
- `BLOCKED_BY_KNOWLEDGE_GAP`: **3** leaves
- Unique client-binding references: **9**
- Unique knowledge-gap references: **5**

These are reconstruction results only. Historical P6.1 aggregate totals across all 22 A5 tasks must not be used as target counts for this task.

## Correction made during QA

The first human-readable draft carried `Code`, `SHC`, `Related Value`, and `BOL Type` only in its unresolved-semantics register. Before machine-contract materialization they were made explicit fail-closed terminal leaves:

- `Code` → `KG-LTL03-CODE-SEMANTICS`
- `SHC` → `KG-LTL03-SHC-SEMANTICS`
- `Related Value` → `KG-LTL03-RELATED-VALUE-SEMANTICS`
- `BOL Type` → `CB-LTL03-BOL-TYPE`

This preserves the frozen BOL baseline rather than allowing unresolved semantics to disappear into narrative notes.

## Schema validation

Validated against `schemas/canonical-work-decomposition-contract-v1.schema.json` using JSON Schema Draft 2020-12 semantics.

Result: **PASS**.

## Structural validation

- unique work-unit IDs: PASS
- exactly one root: PASS
- every non-root parent resolves: PASS
- cycles: 0 / PASS
- terminal `NEEDS_DECOMPOSITION`: 0 / PASS
- internal composite nodes have children and remain `NEEDS_DECOMPOSITION`: PASS
- source references non-empty on every unit: PASS
- blocker leaves contain reasons: PASS
- knowledge-gap leaves contain stable knowledge-gap references: PASS
- client-binding leaves contain stable client-binding references: PASS
- sibling sequence uniqueness: PASS
- recomputed summary counts equal declared counts: PASS

## Source / semantic QA disposition

**SELF-QA PASS WITH INDEPENDENT REVIEW REQUIRED.**

The tree is anchored to the frozen 20-step `workDecompositionSeed` and the LTL-03 v1.5 task/Operational Knowledge/BOL/source-claim records. Known unresolved source semantics and client-specific values fail closed instead of being guessed.

New reconstruction IDs are identifiers for source-grounded unresolved requirements; they are not claims that the exact IDs existed in the lost historical private bundle.

## Explicit non-authorizations

This QA does **not** authorize:

- Supabase/protected-store mutation or reseeding;
- replacement of the historical P6.1 certified record;
- Canonical WorkDefinition compilation/persistence;
- merge to `main`;
- production promotion;
- representation of the reconstruction as historical byte-identical recovery.

## Independent QA gate

An independent reviewer must compare the machine contract against the pinned frozen sources and specifically check:

1. every generated work unit is supported by source material;
2. no source-required decision, action, evidence, timing, exception or unresolved semantic is omitted;
3. no client/runtime-specific value has been promoted to canonical truth;
4. the historical P6.1 V1 executor-class stop criterion, rather than AR0.2/VNext semantics, governs the tree;
5. blocker classifications are correct;
6. source references are sufficient for traceability;
7. machine-contract schema/topology remains valid after any corrections.

Until that independent gate passes, disposition remains `RECONSTRUCTED_P6_1_V1__SELF_QA_PASS__INDEPENDENT_QA_REQUIRED`.
