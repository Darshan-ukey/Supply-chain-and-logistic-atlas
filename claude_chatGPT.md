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

# PROGRAM SEQUENCE — OWNER CONFIRMED

`LTL-01 → independent QA → freeze repeatability evidence → resume Demo DUX/protected-detail wiring`

Do **not** turn this into a 21-task reconstruction program before returning to the demo. LTL-01 is the cross-task generalization check for the recovered P6.1 V1 rules.

---

# CLOSED GATE — LTL-03 reconciliation + recovered rule freeze

Final LTL-03 disposition:
`P6_1_V1_LTL03_R2_FOCUSED_RE_QA_PASS__READY_FOR_RULE_FREEZE_AND_NEXT_TASK`

Claude closure:
`governance/recovery/P6.1_LTL03_R2_FOCUSED_RE_QA_RESULT_2026-09-14.md` @ `bcf0acd3455d0ddc39b1ffe0a7c6722bb15237d2`

Recovered P6.1 V1 reconstruction rule baseline:
`governance/standards/P6_1_V1_RECONSTRUCTION_RULE_BASELINE_V1_FROZEN.md` @ `3c67bb49445b6296bf6f2ccdf0c96d44d47abca0`

Disposition:
`P6_1_V1_RECONSTRUCTION_RULE_BASELINE_V1_FROZEN__LTL03_LOOP_CLOSED__READY_FOR_NEXT_SINGLE_A5`

### Drive backup status — COMPLETE
Dedicated Google Doc:
- title: `Atlas P6.1 V1 Reconstruction Rule Baseline v1 — FROZEN`
- file ID: `1osbYoaDlUXDBwyCgAv3GqTdEUjoWUgwvUZqdDdSi_rU`
- Drive URL: `https://docs.google.com/document/d/1osbYoaDlUXDBwyCgAv3GqTdEUjoWUgwvUZqdDdSi_rU`
- exact frozen baseline text from GitHub commit `3c67bb49445b6296bf6f2ccdf0c96d44d47abca0` has been inserted after the initial summary section.
- Google Docs write succeeded and the document carries `ExactTextMirrorStatus=COMPLETE`.

GitHub remains canonical; Drive is the durable backup mirror.

---

# ACTIVE TASK — P6.1 V1 LTL-01 independent QA

`TASK:` LTL-01 — Resolve service demand and execution eligibility

`CURRENT DISPOSITION:`
`P6_1_V1_LTL01_R1_RECONSTRUCTION_COMPLETE__SELF_QA_PASS__INDEPENDENT_CLAUDE_QA_REQUIRED`

## MANDATORY REVIEW SET — READ IN THIS ORDER

### 1. Frozen recovered rules
`governance/standards/P6_1_V1_RECONSTRUCTION_RULE_BASELINE_V1_FROZEN.md`
@ `3c67bb49445b6296bf6f2ccdf0c96d44d47abca0`

### 2. Certified v1.4 source custody
`governance/baselines/P6_0_ROAD_LTL_1_5_SOURCE_MATERIALIZATION_CERTIFICATION.json`
@ historical certified implementation `ba9d47f07b59ecf79ff6cde9145c0185cc18d39d`

Certified Drive source:
- file ID `1CVUC40CZuhexs8oJjasBFw7OAjv4AhUI`
- `atlas-daughter-release-ltl-v1.4-ocean-v0.6-FROZEN.zip`
- recomputed ZIP SHA-256 `b81b22d2a31869441ccfbbee05a24f6ac296d32fd56ce4c46472cac7894eb289` — exact certification match.

Exact extracted inputs used:
- `data/modules/road-ltl-v1.4.json` SHA-256 `c8a0af378ac114d684e79a0640871c73bfaa4493e96e3f5a4b413fa2f330b1d4`
- `data/operational-knowledge/road-ltl-v1.4-operational.json` SHA-256 `6e5899b2c31f7458a7959ead18950911ea916a366ac28d2aeee7077855dac13e`
- `data/source-claims/road-ltl-v1.4-claims.json` SHA-256 `379e48422906732cc6e01a1e324108ca23a2f1ff05faab8cb53c3ba342000ac0`
- `data/client-binding-requirements/road-ltl-v1.4-bindings.json` SHA-256 `d461990914038a90277a06299faa5663221b6c6b371493758893a19cd71a384c`

### 3. LTL-01 reconstructed R1 candidate
Branch: `atlas-p6-1-v1-reconstruction`
File: `governance/baselines/P6_1_V1_LTL01_RECONSTRUCTED_R1.json`
Commit: `407c099e993ea9d27f870e06faf80a27b8c9c05f`

Natural generated profile:
- 19 work units
- 15 leaves
- 7 `EXECUTOR_READY`
- 8 `BLOCKED_BY_CLIENT_BINDING`
- 0 `BLOCKED_BY_KNOWLEDGE_GAP`
- 6 unique client-binding refs
- 0 terminal `NEEDS_DECOMPOSITION`

Important source-shape rule: LTL-01 has no `workDecompositionSeed`. The R1 tree is built from explicit v1.4 `requiredInformation`, `decisionGates`, `atomicAction`, branch transitions, temporal constraint, evidence contracts and binding records. Do not judge it against the LTL-03 20-step spine pattern.

### 4. ChatGPT self-QA
`governance/recovery/P6.1_LTL01_R1_RECONSTRUCTION_SELF_QA_2026-09-14.md`
Commit: `f5ccc8ef15879fa80f63e31714d3793e407a17a3`

### 5. Historical comparison — AFTER content review only
Historical certified LTL-01 evidence:
`23 work units / 16 leaves / 7 EXECUTOR_READY / 9 BLOCKED_BY_CLIENT_BINDING / 0 BLOCKED_BY_KNOWLEDGE_GAP`

Current natural R1 delta:
`-4 units / -1 leaf / 0 ready / -1 CB / 0 KG`

Do not use this delta as a correction target. Explain it only after source/content QA.

`NEW COMMITS/ARTIFACTS:`
- recovered rule freeze `3c67bb49445b6296bf6f2ccdf0c96d44d47abca0`
- LTL-01 candidate `407c099e993ea9d27f870e06faf80a27b8c9c05f`
- LTL-01 self-QA `f5ccc8ef15879fa80f63e31714d3793e407a17a3`
- Drive exact-text backup file ID `1osbYoaDlUXDBwyCgAv3GqTdEUjoWUgwvUZqdDdSi_rU`

`EXACT NEXT ACTION — CLAUDE:`
Perform **independent LTL-01 R1 content/structure QA only**. Do not regenerate in parallel.

Verify from the exact frozen source:
1. schema/graph/count integrity;
2. whether the 3 composite containers are source-disciplined rather than artificial over-decomposition;
3. all 7 ready leaves against CR1–CR11, especially CR6, CR10 and CR11;
4. all 8 client-binding leaves against the actual v1.4 `requiredInformation` and binding records;
5. whether use of source-native `LTL-01::REQ::05` as the commodity-classification binding ref is valid or should be represented differently;
6. whether `WD-LTL01-R1-O01` may remain ready under CR6 because `LTL-01::ACT::01` is explicitly source-supported with precondition/performer/authority/target/postcondition;
7. whether zero knowledge gaps is substantively justified;
8. only after those checks, explain the structural delta versus historical `23/16/7/9/0`.

Return exactly one disposition:
- `P6_1_V1_LTL01_R1_INDEPENDENT_QA_PASS__READY_FOR_REPEATABILITY_FREEZE`
- `P6_1_V1_LTL01_R1_INDEPENDENT_QA_FAIL__BOUNDED_CORRECTIONS_REQUIRED`
- `P6_1_V1_LTL01_R1_INDEPENDENT_QA_FAIL__RULE_BASELINE_CONTRADICTION_FOUND`

If PASS: update this shared log and stop. ChatGPT will freeze repeatability evidence, then return to Demo DUX/protected-detail wiring.
If bounded FAIL: list exact per-unit corrections only; do not rebuild the whole tree.
If rule contradiction: identify the exact frozen rule and source evidence; do not silently alter the frozen baseline.

`HARD STOPS:`
- no LTL-02 or remaining-task reconstruction;
- no Supabase protected-store mutation/reseed;
- no WorkDefinition persistence;
- no main merge;
- no production promotion;
- no demo protected-detail wiring until LTL-01 independent QA closes and repeatability evidence is frozen;
- no modification of the frozen rule baseline without a separately evidenced contradiction and versioned successor.

`SUPERSEDED / SAFE TO SKIP:`
- all LTL-03 intermediate forensic/reconciliation logs unless a new contradiction appears;
- earlier CR10 wording `e59b4d6...`;
- v1.3 source as substitute for certified v1.4;
- v1.5 LTL-03 OK/IR/claim enrichment for LTL-01;
- all remaining A5 tasks for now.

Next handoff must update this same file before changing task/gate.
