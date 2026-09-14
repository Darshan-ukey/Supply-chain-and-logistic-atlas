# Claude ↔ ChatGPT — Atlas Shared Coordination Log

**Status:** CANONICAL ACTIVE CONTROL LOG

This is the first and mandatory file both ChatGPT and Claude must read before starting or resuming Atlas work.

Previous active-control state is preserved in Git blob `9c5985dda2bf0e5bb2f048bfae84bcb3d3e18fd5`; earlier long-form history is preserved in blob `82eb6b9bedec5e6bad88394cf2329708224f12c6`. Do not reread either unless this file explicitly points back to them.

## Coordination protocol
1. Read this file first.
2. Read only the ACTIVE TASK `MANDATORY REVIEW SET`, in order.
3. Detailed QA/recovery files are subordinate evidence. If not listed here, they are not mandatory reading.
4. Do not guess which older logs/commits matter. Add any newly required evidence here first with the reason.
5. Every handoff must update: `Task | Current disposition | Mandatory review set | New commits/artifacts | Exact next action | Hard stops | Superseded/skippable material`.
6. When ChatGPT and Claude independently audit a gate and converge, proceed without waiting for another Owner command unless a hard governance/safety stop explicitly requires Owner action.
7. Historical counts are post-generation comparison evidence only, never generation targets.

---

# CLOSED GATE — LTL-03 reconciliation + recovered rule freeze

## Final LTL-03 disposition
`P6_1_V1_LTL03_R2_FOCUSED_RE_QA_PASS__READY_FOR_RULE_FREEZE_AND_NEXT_TASK`

Claude closure evidence:
- `governance/recovery/P6.1_LTL03_R2_FOCUSED_RE_QA_RESULT_2026-09-14.md`
- commit `bcf0acd3455d0ddc39b1ffe0a7c6722bb15237d2`

Corrected R2 active artifact remains on `atlas-p6-1-v1-reconstruction`:
- part 1 `497d760d37148e5936b0119074b3dd409d481b53`
- part 2 `070ace1bd5aca05c32e438c3314cd91f3cab1c33`
- part 3 `17950d3746fda7fd8742bb32664a25b45faa5e2c`
- part 4 `9afd03d8a0e6fbe6fee28913528d50029fb68242`
- manifest `30e9001b81569bb306371e02c82f7c0c307672bd`

Verified fingerprint: 38 work units / 32 leaves / 6 internal / 14 EXECUTOR_READY / 11 KG / 7 CB / 11 KG refs / 9 CB refs.

## Recovered P6.1 V1 reconstruction rule baseline — FROZEN
Artifact:
`governance/standards/P6_1_V1_RECONSTRUCTION_RULE_BASELINE_V1_FROZEN.md`

Freeze commit:
`3c67bb49445b6296bf6f2ccdf0c96d44d47abca0`

Disposition:
`P6_1_V1_RECONSTRUCTION_RULE_BASELINE_V1_FROZEN__LTL03_LOOP_CLOSED__READY_FOR_NEXT_SINGLE_A5`

Authority incorporated into this freeze:
- historical P6.1 implementation `ba9d47f07b59ecf79ff6cde9145c0185cc18d39d`;
- frozen Contract V1;
- frozen Executability Standard V1;
- corrected CR1–CR11 authority `87015d7641995bc4b8640d8847f3b286cc1565d8`;
- passing LTL-03 R2 worked example + Claude independent closure above.

Do not silently modify this frozen recovered baseline. Any later rule change requires a versioned successor/amendment and evidence from a new contradiction.

---

# ACTIVE TASK — P6.1 V1 reconstruction: LTL-01

`TASK:` LTL-01 — Resolve service demand and execution eligibility

`CURRENT DISPOSITION:`
`P6_1_V1_LTL01_SOURCE_LINEAGE_RESOLVED__READY_FOR_SOURCE_FIRST_RECONSTRUCTION`

## MANDATORY REVIEW SET — READ IN THIS ORDER

### 1. Frozen recovered reconstruction rules
`governance/standards/P6_1_V1_RECONSTRUCTION_RULE_BASELINE_V1_FROZEN.md`
@ `3c67bb49445b6296bf6f2ccdf0c96d44d47abca0`

Purpose: authoritative CR1–CR11 reconstruction baseline.

### 2. P6.0 certified source lineage
`governance/baselines/P6_0_ROAD_LTL_1_5_SOURCE_MATERIALIZATION_CERTIFICATION.json`
@ historical certified commit `ba9d47f07b59ecf79ff6cde9145c0185cc18d39d`

Purpose: proves that LTL-01 is one of the 21 tasks inherited unchanged from frozen Road LTL v1.4 into effective v1.5; only LTL-03 is a direct v1.5 override.

Certified frozen source vault:
- Google Drive file ID `1CVUC40CZuhexs8oJjasBFw7OAjv4AhUI`
- file `atlas-daughter-release-ltl-v1.4-ocean-v0.6-FROZEN.zip`
- certified ZIP SHA-256 `b81b22d2a31869441ccfbbee05a24f6ac296d32fd56ce4c46472cac7894eb289`
- base module SHA-256 `c8a0af378ac114d684e79a0640871c73bfaa4493e96e3f5a4b413fa2f330b1d4`
- base operational knowledge SHA-256 `6e5899b2c31f7458a7959ead18950911ea916a366ac28d2aeee7077855dac13e`

### 3. Exact frozen LTL-01 source files from the certified Drive ZIP
Read these exact files from the certified ZIP; do not substitute v1.3 or infer from v1.5 LTL-03 enrichment:
- `data/modules/road-ltl-v1.4.json`
- `data/operational-knowledge/road-ltl-v1.4-operational.json`
- `data/source-claims/road-ltl-v1.4-claims.json`
- `data/client-binding-requirements/road-ltl-v1.4-bindings.json`

LTL-01 source establishes, among other things:
- decision: `Is Road LTL eligible for cargo, lane, service and required date?`
- rule: serviceability, commodity, size/weight, prohibited-goods, lane, cut-off and contract rules must pass;
- canonical owner/authority basis: Commercial / transport service owner; contracted service owner with controlled override authority;
- explicit client bindings include service catalogue/lane matrix, cut-off rules, prohibited/restricted commodity policy, override authority, and contract/service entitlements.

Important source-shape difference from LTL-03: v1.4 LTL-01 does **not** carry the v1.5 LTL-03 `workDecompositionSeed`. Therefore CR1 means preserve a named source spine where one exists; it does not authorize inventing a seed for LTL-01. Build from the actual frozen task structures: required information, decision gates, constraints, controls, atomic actions, branch transitions, temporal constraints, evidence contracts, executability, and explicit client-binding requirements.

### 4. Frozen historical comparison evidence — only after generation
Historical certified LTL-01:
- 23 work units
- 16 leaves
- 7 EXECUTOR_READY
- 9 BLOCKED_BY_CLIENT_BINDING
- 0 BLOCKED_BY_KNOWLEDGE_GAP

These counts are forensic evidence only. Do not use them to shape/split/classify the reconstruction.

`NEW COMMITS/ARTIFACTS:`
- recovered rule freeze: `3c67bb49445b6296bf6f2ccdf0c96d44d47abca0`
- shared control-log activation of LTL-01: this commit

`EXACT NEXT ACTION:`
1. Reconstruct LTL-01 source-first under frozen CR1–CR11 using only the exact v1.4 frozen inputs above.
2. Do not invent a `workDecompositionSeed`; derive work units only from source-explicit task structures/contracts.
3. Classify readiness only after source semantics are assembled.
4. Record CR10 authority-materiality on each ready leaf.
5. Apply existing V1 KG/CB taxonomy only; no new blocker types.
6. Self-QA schema/graph/source/blockers/readiness.
7. Hand the resulting single-task artifact to Claude for independent QA.
8. Compare to historical 23/16/7/9/0 only after generation.
9. If Claude finds bounded defects, correct in place and focused re-QA; do not rebuild verified structure unnecessarily.

`HARD STOPS:`
- no Supabase protected-store mutation/reseed;
- no WorkDefinition persistence;
- no main merge;
- no production promotion;
- no modification/replacement of historical certified P6.1 artifacts;
- no regeneration of LTL-02 or any other remaining task until LTL-01 independently passes;
- no bulk remaining-task generation.

`SUPERSEDED / SAFE TO SKIP:`
- all LTL-03 forensic/reconciliation intermediate logs and experiments unless a new contradiction to the frozen baseline appears;
- earlier CR10 wording `e59b4d6...`;
- v1.3 source as a substitute for the certified v1.4 source;
- v1.5 LTL-03 OK/IR/claim enrichment for LTL-01.

Next handoff must update this same file before Claude or ChatGPT changes task/gate.
