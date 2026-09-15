# Claude ↔ ChatGPT — Atlas Shared Coordination Log

**Status:** CANONICAL ACTIVE CONTROL LOG

This is the first and mandatory file both ChatGPT and Claude must read before starting or resuming Atlas work.

Previous active-control state is preserved in Git blob `162e42037f2fb08d8f9cc382443d0b10709b5e5f`. Earlier history remains in repository history. Do not reread older material unless this file explicitly points to it.

## Coordination protocol
1. Read this file first.
2. Read only the ACTIVE TASK `MANDATORY REVIEW SET`, in order.
3. Detailed QA/recovery files are subordinate evidence. If not listed here, they are not mandatory reading.
4. Do not guess older dependencies. Add any newly required evidence here first with the reason.
5. Every handoff must record: `Task | Current disposition | Mandatory review set | New commits/artifacts | Exact next action | Hard stops | Superseded/skippable material`.
6. When ChatGPT and Claude independently audit a gate and converge, proceed without waiting for another Owner command unless a hard governance/safety stop explicitly requires Owner action.
7. Historical counts remain post-generation forensic evidence only, never generation targets.

---

# CLOSED GATE — P6.1 V1 reconstruction repeatability

## LTL-03
Final disposition:
`P6_1_V1_LTL03_R2_FOCUSED_RE_QA_PASS__READY_FOR_RULE_FREEZE_AND_NEXT_TASK`

Passing independent closure:
`governance/recovery/P6.1_LTL03_R2_FOCUSED_RE_QA_RESULT_2026-09-14.md`
@ `bcf0acd3455d0ddc39b1ffe0a7c6722bb15237d2`

Corrected protected reconstruction:
`governance/baselines/p6_1_v1_ltl03_r2/`
- manifest `30e9001b81569bb306371e02c82f7c0c307672bd`
- parts `497d760d37148e5936b0119074b3dd409d481b53`, `070ace1bd5aca05c32e438c3314cd91f3cab1c33`, `17950d3746fda7fd8742bb32664a25b45faa5e2c`, `9afd03d8a0e6fbe6fee28913528d50029fb68242`

## Frozen recovered CR1–CR11 baseline
`governance/standards/P6_1_V1_RECONSTRUCTION_RULE_BASELINE_V1_FROZEN.md`
@ `3c67bb49445b6296bf6f2ccdf0c96d44d47abca0`

Drive durable mirror:
- Google Doc ID `1osbYoaDlUXDBwyCgAv3GqTdEUjoWUgwvUZqdDdSi_rU`
- exact frozen baseline text mirrored successfully
- GitHub remains canonical.

## LTL-01 generalization check
Candidate:
`governance/baselines/P6_1_V1_LTL01_RECONSTRUCTED_R1.json`
@ `407c099e993ea9d27f870e06faf80a27b8c9c05f`

Independent QA PASS:
`governance/recovery/P6.1_LTL01_R1_INDEPENDENT_QA_RESULT_2026-09-14.md`
@ `527b4abe0ada64c65b58cdff50bfe7f977ed22f7`

Disposition:
`P6_1_V1_LTL01_R1_INDEPENDENT_QA_PASS__READY_FOR_REPEATABILITY_FREEZE`

## Repeatability evidence — FROZEN
`governance/standards/P6_1_V1_RECONSTRUCTION_REPEATABILITY_EVIDENCE_V1_FROZEN.md`
@ `fd86c71dd44a6e8e22c3281d6e779947c1e98223`

Disposition:
`P6_1_V1_RECONSTRUCTION_REPEATABILITY_EVIDENCE_V1_FROZEN__TWO_DISTINCT_SOURCE_SHAPES_PASS__RETURN_TO_DEMO`

Conclusion now frozen:
- CR1–CR11 generalize across two materially different source shapes;
- LTL-03 demonstrates seed-driven enriched OK with both KG and CB blockers;
- LTL-01 demonstrates non-seed v1.4 contract-driven structure with CB-only blockers and a materially-resolved CR10 authority case;
- sufficient evidence exists for the demo purpose;
- do **not** reconstruct the remaining 20 Road LTL tasks before returning to demo.

---

# ACTIVE TASK — Resume Demo DUX / protected-detail wiring

`TASK:` DUX-03 successor — replace the prior “protected detail unavailable” demo limitation with real reconstructed protected detail for the two independently validated representative tasks only: LTL-03 and LTL-01.

`CURRENT DISPOSITION:`
`DEMO_PROTECTED_DETAIL_RECOVERY_NOW_SUPPORTED_FOR_LTL03_AND_LTL01__WIRING_REQUIRED`

## MANDATORY REVIEW SET — READ IN THIS ORDER

### 1. Current demo implementation baseline
Branch:
`atlas-v2-demo-2026-09-14`

Current head:
`4d856af6c6b89200b1fd7bcd167e0256afb7f26a`

Purpose:
- DUX-01 fixed inspector/playback route;
- DUX-02 defensive registry/catalog cache control;
- DUX-03 currently discloses protected-store decode blocker and uses only public-safe summary/schema instead of fabricated protected detail;
- DUX-04 adds discoverable Execution Readiness navigation.

### 2. Demo objective / boundary
Preserve the existing D2 objective:
`PROVE_REPRESENTATIVE_DOMAIN_TO_MALKOM_EXECUTION_PATH_WITHOUT_CLAIMING_FULL_NEW_PIPELINE_COMPLETENESS`

Atlas boundary remains:
- Atlas owns governed understanding/specification;
- downstream tools own execution;
- demo must not claim full Road LTL protected recovery, full WorkDefinition compilation, or production readiness.

### 3. Real protected representative artifacts now available
LTL-03 corrected protected reconstruction:
`governance/baselines/p6_1_v1_ltl03_r2/`
with manifest/part commits listed above.

LTL-01 protected reconstruction:
`governance/baselines/P6_1_V1_LTL01_RECONSTRUCTED_R1.json`
@ `407c099e993ea9d27f870e06faf80a27b8c9c05f`

Both are independently QA-passed reconstruction artifacts under frozen CR1–CR11.

### 4. Repeatability authority
`governance/standards/P6_1_V1_RECONSTRUCTION_REPEATABILITY_EVIDENCE_V1_FROZEN.md`
@ `fd86c71dd44a6e8e22c3281d6e779947c1e98223`

Purpose:
- proves representative repeatability across LTL-03 and LTL-01;
- explicitly does not authorize bulk reconstruction of remaining tasks.

## EXACT NEXT ACTION — CHATGPT

1. Inspect demo branch `4d856af...` and identify the exact DUX-03 protected-detail rendering/data path.
2. Add protected demo data for **LTL-03 and LTL-01 only**, sourced from the independently QA-passed reconstructed artifacts.
3. Clearly label the detailed views as **reconstructed protected P6.1 V1 detail** / recovered historical-fidelity reconstruction, not the original lost protected payload.
4. Preserve the existing public/protected boundary. Public/default path must continue to hide protected decomposition detail.
5. For tasks other than LTL-03/LTL-01, retain the existing truthful public-safe/protected-unavailable behavior. Do not fabricate trees for the remaining 20 tasks.
6. Do not fabricate Canonical WorkDefinition instances. Historical P6.1 had WorkDefinition compilation `NOT_STARTED`; WorkDefinition schema/projection explanation may remain, but no fake compiled instance.
7. Keep original protected-store decode/custody finding as historical recovery context where relevant, but update the UI so it no longer implies that no representative protected detail exists anywhere.
8. Validate both inspector paths (normal/base and playback) and Execution Readiness navigation after wiring.
9. Run demo regression checks and compare against `4d856af...` baseline.
10. Update this shared log with exact commits and hand to Claude for **independent demo wiring QA only**.

## EXACT NEXT ACTION — CLAUDE AFTER CHATGPT WIRING
Do not modify the demo in parallel. After ChatGPT commits the wiring and updates this log, independently verify:
- only LTL-03 and LTL-01 expose real reconstructed protected detail;
- labels distinguish reconstruction from original historical protected payload;
- public path leaks no protected detail;
- no fabricated WorkDefinition instance appears;
- other 20 tasks remain truthful/non-fabricated;
- both inspector/playback routes and Execution Readiness navigation reach the intended protected demo surface;
- regression result does not introduce a new failure relative to `4d856af...`.

Return PASS / bounded-fix disposition in this same shared log.

`HARD STOPS:`
- no remaining-20-task reconstruction before demo review;
- no Supabase mutation/reseed;
- no WorkDefinition persistence;
- no main merge;
- no production promotion;
- no claim that reconstructed LTL-03/LTL-01 are byte-identical to the lost original protected payload;
- no claim of full P6.1 protected coverage;
- no fabricated WorkDefinition or runtime execution proof.

`SUPERSEDED / SAFE TO SKIP:`
- all LTL-03 forensic intermediate logs unless a new contradiction appears;
- LTL-01 self-QA unless tracing a specific independent-QA finding;
- reconstruction of LTL-02 and remaining tasks;
- renewed attempts to decode the damaged Supabase protected payload unless materially new custody evidence appears.

Next handoff must update this same file before changing task/gate.
