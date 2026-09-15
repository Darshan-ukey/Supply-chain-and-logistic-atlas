# Claude ↔ ChatGPT — Atlas Shared Coordination Log

**Status:** CANONICAL ACTIVE CONTROL LOG

This is the first and mandatory file both ChatGPT and Claude must read before starting or resuming Atlas work.

Previous active-control state is preserved in Git blob `0ab9b190f8972e4fee3d6482dacefd7abdb9f915`. Earlier history remains in repository history. Do not reread older material unless this file explicitly points to it.

## Coordination protocol
1. Read this file first.
2. Read only the ACTIVE TASK `MANDATORY REVIEW SET`, in order.
3. Detailed QA/recovery files are subordinate evidence. If not listed here, they are not mandatory reading.
4. Do not guess older dependencies. Add newly required evidence here first with the reason.
5. Every handoff must record: `Task | Current disposition | Mandatory review set | New commits/artifacts | Exact next action | Hard stops | Superseded/skippable material`.
6. When ChatGPT and Claude independently audit a gate and converge, proceed without another Owner command unless a hard governance/safety stop explicitly requires Owner action.
7. Historical counts remain post-generation forensic evidence only, never generation targets.

---

# CLOSED GATE — P6.1 V1 reconstruction repeatability

## Frozen recovered CR1–CR11 baseline
`governance/standards/P6_1_V1_RECONSTRUCTION_RULE_BASELINE_V1_FROZEN.md`
@ `3c67bb49445b6296bf6f2ccdf0c96d44d47abca0`

Drive exact-text mirror:
- Google Doc ID `1osbYoaDlUXDBwyCgAv3GqTdEUjoWUgwvUZqdDdSi_rU`
- GitHub remains canonical.

## LTL-03 passing reconstruction
`governance/baselines/p6_1_v1_ltl03_r2/`
- manifest `30e9001b81569bb306371e02c82f7c0c307672bd`
- parts `497d760d37148e5936b0119074b3dd409d481b53`, `070ace1bd5aca05c32e438c3314cd91f3cab1c33`, `17950d3746fda7fd8742bb32664a25b45faa5e2c`, `9afd03d8a0e6fbe6fee28913528d50029fb68242`
- independent closure `bcf0acd3455d0ddc39b1ffe0a7c6722bb15237d2`
- reconstructed profile `38 / 32 / 14 ready / 7 CB / 11 KG`
- historical comparison evidence only `43 / 37 / 14 / 8 / 15`.

## LTL-01 passing generalization check
`governance/baselines/P6_1_V1_LTL01_RECONSTRUCTED_R1.json`
@ `407c099e993ea9d27f870e06faf80a27b8c9c05f`

Independent QA PASS:
`governance/recovery/P6.1_LTL01_R1_INDEPENDENT_QA_RESULT_2026-09-14.md`
@ `527b4abe0ada64c65b58cdff50bfe7f977ed22f7`

Reconstructed profile `19 / 15 / 7 ready / 8 CB / 0 KG`.
Historical comparison evidence only `23 / 16 / 7 / 9 / 0`.

## Repeatability evidence — FROZEN
`governance/standards/P6_1_V1_RECONSTRUCTION_REPEATABILITY_EVIDENCE_V1_FROZEN.md`
@ `fd86c71dd44a6e8e22c3281d6e779947c1e98223`

Disposition:
`P6_1_V1_RECONSTRUCTION_REPEATABILITY_EVIDENCE_V1_FROZEN__TWO_DISTINCT_SOURCE_SHAPES_PASS__RETURN_TO_DEMO`

Do not reconstruct the remaining 20 Road LTL tasks before demo review.

---

# ACTIVE TASK — DUX-03 representative reconstructed protected-detail wiring — independent Claude QA

`TASK:` Verify the internal demo wiring that now exposes QA-passed reconstructed P6.1 V1 detail for **LTL-03 and LTL-01 only**, while retaining the public/protected boundary and the truthful WorkDefinition limitation.

`CURRENT DISPOSITION:`
`DUX_03_REPRESENTATIVE_RECONSTRUCTED_PROTECTED_DETAIL_WIRED__STATIC_AND_BUILD_QA_PASS__INDEPENDENT_RENDERED_QA_REQUIRED`

## MANDATORY REVIEW SET — READ IN THIS ORDER

### 1. Demo baseline before this wiring
Branch: `atlas-v2-demo-2026-09-14`
Baseline commit:
`4d856af6c6b89200b1fd7bcd167e0256afb7f26a`

Purpose:
- DUX-01 inspector/playback navigation fix;
- DUX-02 cache defensive fix;
- DUX-03 prior public-safe-only protected limitation;
- DUX-04 Execution Readiness navigation.

### 2. Repeatability authority
`governance/standards/P6_1_V1_RECONSTRUCTION_REPEATABILITY_EVIDENCE_V1_FROZEN.md`
@ `fd86c71dd44a6e8e22c3281d6e779947c1e98223`

Purpose: authorizes representative use of independently QA-passed LTL-03/LTL-01 reconstructed detail for demo; does **not** authorize remaining-task reconstruction or a full protected-recovery claim.

### 3. New LTL-03 internal representative dataset
Demo branch file:
`data/demo-internal/p6-1-reconstructed-protected-ltl03.json`
Commit:
`3d37e732f8bac810ac55aa0e941220ac9aa53841`

Expected properties:
- classification `INTERNAL_DEMO_PROTECTED_RECONSTRUCTION`;
- reconstructed profile `38 / 32 / 14 / 7 / 11`;
- historical certified comparison `43 / 37 / 14 / 8 / 15` separately labelled evidence only;
- complete 38-unit identity/parent/type/readiness register;
- selected full semantics for `01`, `16`, `05B`, `09B`;
- explicit statement that this is a QA-passed historical-fidelity reconstruction, **not** original lost protected bytes and not byte-identical recovery.

### 4. New LTL-01 internal representative dataset
Demo branch file:
`data/demo-internal/p6-1-reconstructed-protected-ltl01.json`
Commit:
`465f2d42e1aee4c58c30b7f1e2fffa090c8ebd33`

Expected properties:
- classification `INTERNAL_DEMO_PROTECTED_RECONSTRUCTION`;
- reconstructed profile `19 / 15 / 7 / 8 / 0`;
- historical certified comparison `23 / 16 / 7 / 9 / 0` separately labelled evidence only;
- complete 19-unit identity/parent/type/readiness register;
- selected full semantics for `I01`, `G03`, `AUTH`, `O01`;
- O01 retains `MATERIAL_AND_RESOLVED` CR10 semantics;
- explicit statement that this is reconstructed historical-fidelity detail, not original protected bytes.

### 5. Daughter wiring
Demo branch file:
`daughter.html`
Commit:
`ae2d7a90b34db98d98883fd097a97688f305a90f`

Implementation boundary:
- existing shared renderer `assets/universal-daughter-renderer-v2.js` was deliberately **not modified**;
- public/default path remains the existing status-only protected view;
- only when query has `internalDemo=1` does `daughter.html` attempt to fetch one of the two representative datasets;
- only LTL-01/LTL-03 have representative detail files;
- when any other task opens Work Decomposition in internalDemo, the historical public-safe summary remains and a notice explicitly says representative protected reconstruction is not available for that task and no tree is fabricated;
- WorkDefinition remains the existing P6.2 compiler-status/schema view with zero persisted canonical WorkDefinitions; no reconstructed/fake WorkDefinition instance was added.

### 6. Regression/static/build evidence
Compare from baseline `4d856af6c6b89200b1fd7bcd167e0256afb7f26a` to current demo head `ae2d7a90b34db98d98883fd097a97688f305a90f`:
- exactly 3 changed files:
  1. `data/demo-internal/p6-1-reconstructed-protected-ltl01.json` (added)
  2. `data/demo-internal/p6-1-reconstructed-protected-ltl03.json` (added)
  3. `daughter.html` (modified)
- no changes to `index.html`, shared renderer, public projection API, Execution Readiness page, P6.2 compiler-status data, or canvas logic.

Vercel preview deployment:
- deployment ID `dpl_3ei2nW2nkoV2PSDUFGWUrZXgjjsD`
- commit `ae2d7a90b34db98d98883fd097a97688f305a90f`
- state `READY`
- preview host `logisticatlasv2-n1l7lgza3-ukeydarsh-2051s-projects.vercel.app`
- errors-only build log: no errors; `Build Completed in /vercel/output [2s]`.

ChatGPT could not complete an authenticated rendered click-through because the preview deployment redirects this session through Vercel SSO. Do **not** treat rendered QA as already passed.

## EXACT NEXT ACTION — CLAUDE

Perform **independent demo wiring QA only**. Do not modify the demo in parallel unless a bounded defect is proven.

Verify:
1. Data fidelity: both representative files match the independently QA-passed reconstruction artifacts for unit identity/parent/type/status and displayed selected semantics.
2. LTL-03 internal route:
   `/daughter?moduleId=road-ltl&moduleVersion=1.5&taskId=LTL-03&internalDemo=1`
   - Work Decomposition tab shows reconstructed protected detail, 38-unit register and reconstruction disclosure.
3. LTL-01 internal route:
   `/daughter?moduleId=road-ltl&moduleVersion=1.5&taskId=LTL-01&internalDemo=1`
   - Work Decomposition tab shows reconstructed protected detail, 19-unit register and reconstruction disclosure.
4. A non-reconstructed task, e.g. LTL-02 internal route:
   - must **not** show invented protected units;
   - must retain historical public-safe summary plus explicit no-representative-detail notice.
5. Public/default route for LTL-01 and LTL-03 (same URLs without `internalDemo=1`):
   - must remain status-only/protected;
   - must not fetch or display reconstructed unit detail.
6. WorkDefinition tab:
   - no fabricated compiled WorkDefinition instance;
   - zero persisted canonical WDs / compiler schema-status semantics remain truthful.
7. Main canvas navigation:
   - normal/base inspector `Open Execution Depth` reaches internal demo daughter route;
   - playback inspector reaches same intended route;
   - Execution Readiness navigation still works.
8. Security/deployment boundary:
   - detail exists only on this unmerged preview branch; no main merge or production promotion occurred;
   - confirm no accidental protected detail was inserted into public production data/module files.
9. Regression: no new functional/rendered failure relative to `4d856af...` caused by these three changes.

Return exactly one disposition in this same shared log:
- `DUX_03_REPRESENTATIVE_PROTECTED_WIRING_INDEPENDENT_QA_PASS__READY_FOR_DEMO_REVIEW`
- `DUX_03_REPRESENTATIVE_PROTECTED_WIRING_INDEPENDENT_QA_FAIL__BOUNDED_CORRECTIONS_REQUIRED`
- `DUX_03_REPRESENTATIVE_PROTECTED_WIRING_INDEPENDENT_QA_FAIL__BOUNDARY_VIOLATION`

If PASS: update this log and stop; next step is demo review, not remaining-task reconstruction.
If bounded FAIL: name exact file/element correction; do not reopen P6.1 reconstruction.
If boundary violation: stop and identify exact leak before any further demo work.

`NEW COMMITS/ARTIFACTS:`
- repeatability freeze `fd86c71dd44a6e8e22c3281d6e779947c1e98223`
- LTL-03 demo dataset `3d37e732f8bac810ac55aa0e941220ac9aa53841`
- LTL-01 demo dataset `465f2d42e1aee4c58c30b7f1e2fffa090c8ebd33`
- Daughter wiring `ae2d7a90b34db98d98883fd097a97688f305a90f`
- Vercel preview `dpl_3ei2nW2nkoV2PSDUFGWUrZXgjjsD`

`HARD STOPS:`
- no remaining-20-task reconstruction before demo review;
- no Supabase mutation/reseed;
- no WorkDefinition persistence;
- no main merge;
- no production promotion;
- no claim that LTL-03/LTL-01 reconstructions are byte-identical original protected payloads;
- no claim of full P6.1 protected coverage;
- no fabricated WorkDefinition/runtime execution proof.

`SUPERSEDED / SAFE TO SKIP:`
- LTL-03 forensic intermediates unless a data-fidelity contradiction appears;
- LTL-01 self-QA unless tracing a specific QA finding;
- reconstruction of remaining tasks;
- damaged Supabase payload decode attempts;
- prior DUX-03 “no representative protected detail exists” limitation — superseded only for LTL-01/LTL-03 by these explicitly reconstructed representative artifacts.

Next handoff must update this same file before changing task/gate.
