# P6.1 V1 Reconstruction Rule Baseline v1 — FROZEN

**Status:** FROZEN_RECOVERED_RECONSTRUCTION_BASELINE
**Freeze date:** 2026-09-14
**Scope:** Historical-fidelity reconstruction of P6.1 V1 Canonical Work Decomposition only.
**Does not modify:** historical certified P6.1 artifacts, AR0.2/VNext rules, P6.2 WorkDefinition compiler, runtime execution.

## Authority and lineage

This recovered baseline is frozen only after the LTL-03 reconciliation loop closed with independent cross-agent agreement.

Mandatory lineage:
- Historical P6.1 certified implementation: `ba9d47f07b59ecf79ff6cde9145c0185cc18d39d`
- Frozen Canonical Work Decomposition Contract V1: `governance/standards/CANONICAL_WORK_DECOMPOSITION_CONTRACT_V1_FROZEN.md`
- Frozen Executability and Recursive Decomposition Standard V1: `governance/standards/EXECUTABILITY_AND_RECURSIVE_DECOMPOSITION_STANDARD_V1_FROZEN.md`
- Corrected combined rule-review authority: `governance/recovery/P6.1_LTL03_COMBINED_GENERATOR_RULE_REVIEW_2026-09-14.md` @ `87015d7641995bc4b8640d8847f3b286cc1565d8`
- Corrected LTL-03 R2 manifest: `governance/baselines/p6_1_v1_ltl03_r2/manifest.json` @ `30e9001b81569bb306371e02c82f7c0c307672bd`
- Corrected LTL-03 R2 parts: `497d760d37148e5936b0119074b3dd409d481b53`, `070ace1bd5aca05c32e438c3314cd91f3cab1c33`, `17950d3746fda7fd8742bb32664a25b45faa5e2c`, `9afd03d8a0e6fbe6fee28913528d50029fb68242`
- Claude focused independent re-QA closure: `governance/recovery/P6.1_LTL03_R2_FOCUSED_RE_QA_RESULT_2026-09-14.md` @ `bcf0acd3455d0ddc39b1ffe0a7c6722bb15237d2`

LTL-03 R2 passing worked-example fingerprint:
- 38 work units
- 32 leaves
- 6 internal nodes
- 14 EXECUTOR_READY
- 11 BLOCKED_BY_KNOWLEDGE_GAP
- 7 BLOCKED_BY_CLIENT_BINDING
- 11 knowledge-gap refs
- 9 client-binding refs

Historical LTL-03 certification `43 / 37 / 14 / 8 / 15` remains forensic comparison evidence only. It was not used as a generation target.

## Frozen recovered rules CR1–CR11

### CR1 — Preserve the governed decomposition spine
Each source-defined `workDecompositionSeed` entry is one primary work unit in source order by default. Do not split a seed entry merely because it names multiple nouns, objects, verbs, fields, or evidence items.

### CR2 — Split only on independently source-supported child contracts
Recursively split a primary unit only when frozen governed source contains at least two distinct child-level execution contracts, each with independently sufficient operation/gate semantics to evaluate terminal status. Object-model membership, field families, evidence-list items, workflow adjacency, sentence conjunctions, generic validation categories, or claim names alone do not justify child units.

### CR3 — Sequence may establish order, not missing semantics
Sequence/order may establish entry ordering or pre-state only. It may not establish decision criteria, authority, validation logic, success/failure conditions, exception routing, or other semantics absent from source. A leaf whose only support for such semantics is list position fails closed.

### CR4 — Generated wording may expose source semantics, never create them
Generated trigger/action/gate/evidence/output wording may make already-governed semantics explicit. It may not supply a semantic dimension absent from source and may not become its own readiness evidence. Semantic content must be established before readiness classification, not authored afterward to justify it.

### CR5 — Fail closed using the existing V1 blocker taxonomy
Use `BLOCKED_BY_KNOWLEDGE_GAP` when canonical semantics, decision criteria, authority, validation criteria, success/failure criteria, or exception logic required for execution are unresolved. Use `BLOCKED_BY_CLIENT_BINDING` only when canonical work is understood and the unresolved item is enterprise/client/site/runtime configuration or mapping. Never invent defaults or promote readiness to improve counts.

### CR6 — Do not create ready post-binding mechanical leaves unless source supports the decomposition
A downstream action gated by an unresolved client binding is not independently ready merely because the mechanical step after binding is obvious. Represent the binding gate as the blocker; create a separate downstream child only when frozen source independently supports that child contract.

### CR7 — Generic validation categories are not executable validation rules
A source statement such as field/cross-field/cross-object validation does not itself make a validation leaf ready. The actual applicable rule must be source-supported. Unspecified validation families remain knowledge gaps.

### CR8 — Referencing an authority policy does not resolve missing precedence
A statement such as “resolve using declared authority/source-of-truth policy” does not make conflict resolution ready when the actual precedence/policy is absent. Missing precedence is a knowledge gap.

### CR9 — Historical counts are validation evidence, never generation targets
Historical per-task and aggregate counts may be compared only after generation. Never branch, merge, split, or classify units to move output toward historical numbers.

### CR10 — Canonical authority/role is required only where material
For an `EXECUTOR_READY` leaf, canonical authority/role must be resolved only where material to executing or deciding that leaf. It may be established by an explicit source-named responsible canonical actor/role or by an applicable governed source policy that genuinely assigns responsibility for that action class. Business-object roles do not qualify merely because they appear in the object model. Governance policies such as `exceptionPolicy` or `clientBindingPolicy` do not qualify merely because they govern procedure. If authority is not material, record that determination. If material authority is unresolved, fail closed using only the existing V1 blocker taxonomy: knowledge gap when canonical responsibility itself is unknown; client binding only when canonical responsibility is understood but enterprise/client assignment remains unresolved. Do not require runtime executor assignment and do not invent a new authority blocker taxonomy.

### CR11 — Failure/alternate-path semantics may inherit a genuinely applicable governed exception policy
A leaf’s material failure/alternate-result path may be satisfied by explicit leaf branch/fallback semantics or by explicit reference to an applicable task-level governed exception policy where that policy genuinely covers the leaf’s failure mode. If neither exists and a material failure mode exists, fail closed. Exception-policy inheritance does not automatically satisfy CR10 authority.

## Reconstruction procedure

For each A5 task:
1. Pin exact frozen Daughter/task source, Operational Knowledge, information-resolution/claim inputs where applicable, Contract V1, Executability Standard V1, and this recovered rule baseline.
2. Build from source-defined decomposition spine where one exists.
3. Apply CR1–CR11 before any readiness classification.
4. Validate schema, graph, blocker referential integrity, source grounding, and CR10/CR11 semantics.
5. Run self-QA.
6. Obtain independent Claude QA.
7. Apply only bounded corrections if the independent QA identifies bounded defects; do not rebuild a verified structure unnecessarily.
8. Re-QA focused changes.
9. Only after PASS advance to the next single task.
10. Compare historical counts after generation as forensic evidence only.

## Hard boundaries

This freeze does not authorize:
- Supabase protected-store mutation or reseed;
- Canonical WorkDefinition persistence;
- P6.2 compilation/persistence;
- main merge;
- production promotion;
- modification or replacement of historical certified P6.1 artifacts;
- bulk regeneration of all remaining tasks in an uncontrolled pass.

## Disposition

`P6_1_V1_RECONSTRUCTION_RULE_BASELINE_V1_FROZEN__LTL03_LOOP_CLOSED__READY_FOR_NEXT_SINGLE_A5`
