# Claude ↔ ChatGPT — Atlas Shared Coordination Log

**Status:** CANONICAL ACTIVE CONTROL LOG

Read this file first. Previous control state is preserved in Git blob `90cfadbf2e5c34251c6605bad677938f85dc81f8`; do not reread it unless this packet explicitly requires it.

## Coordination protocol
1. Read only the ACTIVE TASK mandatory review set below, in order.
2. Supporting logs not named here are not mandatory.
3. When ChatGPT and Claude converge, proceed automatically unless a hard stop requires Owner action.
4. Never tune reconstruction/compilation to historical counts.

---

# CLOSED / SUFFICIENT FOR CURRENT DEMO

## P6.1 reconstruction rules
Frozen CR1–CR11:
`governance/standards/P6_1_V1_RECONSTRUCTION_RULE_BASELINE_V1_FROZEN.md`
@ `3c67bb49445b6296bf6f2ccdf0c96d44d47abca0`
Drive mirror ID `1osbYoaDlUXDBwyCgAv3GqTdEUjoWUgwvUZqdDdSi_rU`.

Repeatability evidence:
`governance/standards/P6_1_V1_RECONSTRUCTION_REPEATABILITY_EVIDENCE_V1_FROZEN.md`
@ `fd86c71dd44a6e8e22c3281d6e779947c1e98223`.

LTL-03 QA-passed reconstruction: `38 / 32 / 14 ready / 7 CB / 11 KG`; independent closure `bcf0acd3455d0ddc39b1ffe0a7c6722bb15237d2`.
LTL-01 QA-passed reconstruction: `19 / 15 / 7 ready / 8 CB / 0 KG`; independent closure `527b4abe0ada64c65b58cdff50bfe7f977ed22f7`.

## DUX-03 representative decomposition wiring
Owner manually rendered LTL-03 on 2026-09-15 and confirmed the detailed reconstructed Work Decomposition is visible. Claude had already independently verified zero data mismatches across the 57 LTL-03/LTL-01 registered units and no public-boundary leak. The previous manual-render checklist is superseded for the urgent demo build except where a new regression appears.

Do not reconstruct the remaining 20 tasks before demo review.

---

# ACTIVE TASK — P6.2 representative real WorkDefinition demo

`TASK:` Prove the next link in the Atlas chain by displaying **real Canonical WorkDefinitions compiled from QA-passed EXECUTOR_READY leaves**, without persistence or full-coverage claims.

`CURRENT DISPOSITION:`
`P6_2_REPRESENTATIVE_WORKDEFINITIONS_COMPILED_AND_DEMO_VIEW_ADDED__FOCUSED_INDEPENDENT_QA_REQUIRED`

## MANDATORY REVIEW SET — READ IN THIS ORDER

### 1. Frozen/certified compiler behavior
Branch: `atlas-presentation-architecture-v1-p6-2`
Files:
- `lib/compile/workdefinition-compiler.js`
- `lib/compile/workdefinition-verifier.js`

Required compiler semantics:
- output schema `atlas-canonical-workdefinition-v1`
- contract `1.0.0`
- compiler `atlas-workdefinition-compiler-1.0.0`
- status `VALIDATED_REFERENCE_DEFINITION`
- only `EXECUTOR_READY` leaves compile
- executor class remains `EXECUTOR_CLASS_UNBOUND`
- independent executor proof remains `NOT_INDEPENDENTLY_PROVEN`
- compiler maps governed decomposition fields and does not synthesize missing actors/systems/rules/validations/controls/outcomes/exceptions.

### 2. QA-passed source decompositions
LTL-03:
`governance/baselines/p6_1_v1_ltl03_r2/`
Independent closure `bcf0acd3455d0ddc39b1ffe0a7c6722bb15237d2`.

Selected ready leaves:
- `WD-LTL03-R2-01` — Acquire governed BOL/document or API payload
- `WD-LTL03-R2-09B` — Resolve associated DangerousGoods conditional object family

LTL-01:
`governance/baselines/P6_1_V1_LTL01_RECONSTRUCTED_R1.json`
@ `407c099e993ea9d27f870e06faf80a27b8c9c05f`
Independent closure `527b4abe0ada64c65b58cdff50bfe7f977ed22f7`.

Selected ready leaves:
- `WD-LTL01-R1-G01` — Evaluate request completeness
- `WD-LTL01-R1-O01` — Create or reject transport service request with reason; retain CR10 `MATERIAL_AND_RESOLVED` evidence.

### 3. Representative compiled outputs
Demo branch: `atlas-v2-demo-2026-09-14`
File:
`data/demo-internal/p6-2-representative-workdefinitions.json`
Commit:
`383de3b1ea897856cc381a517287c1b5095ea6f9`

Expected:
- 4 definitions exactly, 2 for LTL-03 and 2 for LTL-01;
- classification `INTERNAL_DEMO__REAL_COMPILER_OUTPUT__NOT_PERSISTED`;
- representative input hashes:
  - LTL-03 `693a9ef08ab6cde50e664ef0e669656146a7140025d6a6fbde7bd77e5a84463f`
  - LTL-01 `7b7879f2d6fb38edf68a619b2c6c6ed56de02cb67cca083689a0297d16ca14d7`
- `persisted=false`, `rowCountCreated=0`;
- no claim of full P6.2 compilation or independent executor proof.

### 4. Detailed WorkDefinition inspector
Demo branch file:
`workdefinition-demo.html`
Commit/head:
`a002298e4857e2454d393e4308972b3abbb407ff`

Behavior:
- `?taskId=LTL-03&internalDemo=1` displays the two LTL-03 compiled definitions;
- `?taskId=LTL-01&internalDemo=1` displays the two LTL-01 compiled definitions;
- shows ID/title, source leaf/path, trigger, inputs, decisions, actions, transitions, clocks, evidence, dependencies, output state, executor/readiness, bindings/gaps, provenance and governed input hash;
- explicitly states internal demo, real representative compiler output, not persisted, not full coverage, not independent executor proof;
- includes backlink to the corresponding Daughter Work Decomposition route.

No existing Daughter renderer was modified in this urgent step; this minimizes regression risk. Integration into the WorkDefinition tab can follow after the demo if desired.

## EXACT NEXT ACTION — CLAUDE
Perform **focused independent P6.2 QA only**. Do not reopen P6.1 and do not modify in parallel unless a bounded defect is proven.

Verify:
1. All four source work units are `EXECUTOR_READY` in the cited QA-passed reconstruction artifacts.
2. Recompute each of the four WorkDefinitions using the frozen compiler mapping; compare all fields, not only IDs.
3. Run verifier invariants conceptually/programmatically: schema/contract/status/ID, lineage path termination, required arrays, executor class, independent proof, binding parity, 64-hex input hashes.
4. Confirm `WD-LTL01-R1-O01` retains the source CR10 `MATERIAL_AND_RESOLVED` evidence and no runtime executor identity is invented.
5. Confirm empty fields are empty because Work Decomposition V1 did not populate them; they are not silently synthesized.
6. Confirm persistence remains zero/no Supabase mutation.
7. Confirm page wording does not imply full P6.2 coverage, runtime execution proof, production authorization or persisted WorkDefinitions.
8. If browser access works, render both task routes and confirm actual detailed records appear. If browser tooling is blocked, do not block the data/compiler QA; record rendered check separately.

Return in this same file:
- `P6_2_REPRESENTATIVE_WORKDEFINITION_QA_PASS__READY_FOR_OWNER_DEMO`
or
- `P6_2_REPRESENTATIVE_WORKDEFINITION_QA_FAIL__BOUNDED_CORRECTIONS_REQUIRED`

## HARD STOPS
- no Supabase persistence/mutation;
- no compile of all 21 ready leaves unless separately authorized;
- no remaining-20-task P6.1 reconstruction;
- no main merge;
- no production promotion;
- no independent-executor-proof claim;
- no claim these four records represent full Road LTL P6.2 coverage.

## DEMO STORY NOW
`A5 → Operational Knowledge → QA-passed Work Decomposition → real representative Canonical WorkDefinition → downstream client/runtime binding → consuming tool`

Atlas still does not execute the business process.
