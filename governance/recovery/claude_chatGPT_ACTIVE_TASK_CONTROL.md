# Claude ↔ ChatGPT — Atlas Active Task Control

**Status:** CANONICAL ACTIVE COORDINATION LOG
**Purpose:** This is the first file both ChatGPT and Claude must read before starting/resuming Atlas work. It is the control/index layer over all detailed governance and recovery artifacts.

## Operating rule

1. Read this file first.
2. For the ACTIVE TASK, read **only** the artifacts/commits listed under `MANDATORY REVIEW SET`, in the order shown.
3. Supporting reports not listed there are evidence/archive only and do not need to be rediscovered or independently selected.
4. Do not infer which older logs are relevant. If an older artifact becomes necessary, add it here first with the reason it is required.
5. Every handoff between ChatGPT and Claude must update this file with:
   - current task;
   - current gate/disposition;
   - exact mandatory artifacts and commits;
   - exact action for the receiving agent;
   - explicit hard stops;
   - what prior material can be skipped because its result has already been incorporated.
6. Detailed QA/recovery files may still be created when they have a specific evidence purpose, but they are subordinate to this control log.
7. When both ChatGPT and Claude have independently checked/audited a gate and converge, proceed to the next governed task without waiting for another Owner command unless a hard governance/safety stop explicitly requires Owner action.

---

# ACTIVE TASK PACKET — P6.1 V1 LTL-03 R2 closure → rule freeze → next task

## Current state

LTL-03 R2 bounded corrections have passed Claude's focused independent re-QA.

**Current disposition:**
`P6_1_V1_LTL03_R2_FOCUSED_RE_QA_PASS__READY_FOR_RULE_FREEZE_AND_NEXT_TASK`

Claude focused re-QA report:
- `governance/recovery/P6.1_LTL03_R2_FOCUSED_RE_QA_RESULT_2026-09-14.md`
- commit `bcf0acd` (full SHA to be resolved from repository when needed)

Verified post-correction structural fingerprint remains:
- 38 work units
- 32 leaves
- 6 internal nodes
- 14 EXECUTOR_READY
- 11 BLOCKED_BY_KNOWLEDGE_GAP
- 7 BLOCKED_BY_CLIENT_BINDING
- 11 knowledge-gap refs
- 9 client-binding refs
- no collateral tree/status/blocker drift from bounded corrections

Historical LTL-03 comparison remains evidence only:
`43 / 37 / 14 / 8 / 15`

## MANDATORY REVIEW SET — read in this order

### 1. Rule authority
`governance/recovery/P6.1_LTL03_COMBINED_GENERATOR_RULE_REVIEW_2026-09-14.md`
- authoritative corrected CR1–CR11 version: commit `87015d7641995bc4b8640d8847f3b286cc1565d8`
- purpose: defines the corrected deterministic P6.1 V1 generation rules; CR10 authority-materiality clarification is authoritative over Claude's earlier `e59b4d6` wording.

### 2. Initial independent R2 QA — reason bounded correction was required
`governance/recovery/P6.1_LTL03_R2_INDEPENDENT_QA_RESULT_2026-09-14.md`
- governance commit recorded by Claude: `5082390` (resolve full SHA if needed)
- purpose: establishes that structure/source-grounding were sound and isolates exactly two bounded defects: manifest summary conformance + missing artifact-level CR10 determinations.

### 3. Bounded-correction handoff
`governance/recovery/P6.1_LTL03_R2_BOUNDED_CORRECTIONS_HANDOFF_2026-09-14.md`
- commit `c3b7e32e316d62aaf3860be2aae61f2493b1edcc`
- purpose: defines exact allowed correction scope and focused re-QA scope.

### 4. Corrected R2 artifact
Branch: `atlas-p6-1-v1-reconstruction`
Directory: `governance/baselines/p6_1_v1_ltl03_r2/`

Bounded correction commits:
- units part 1: `497d760d37148e5936b0119074b3dd409d481b53`
- units part 2: `070ace1bd5aca05c32e438c3314cd91f3cab1c33`
- units part 3: `17950d3746fda7fd8742bb32664a25b45faa5e2c`
- units part 4: `9afd03d8a0e6fbe6fee28913528d50029fb68242`
- corrected manifest + refreshed hashes: `30e9001b81569bb306371e02c82f7c0c307672bd`

Purpose: canonical current R2 reconstruction candidate after bounded corrections. Earlier R2 part/manifest commits remain audit history only.

### 5. Focused independent re-QA — closure evidence
`governance/recovery/P6.1_LTL03_R2_FOCUSED_RE_QA_RESULT_2026-09-14.md`
- commit `bcf0acd` (resolve full SHA if exact full hash is required)
- purpose: independently verifies manifest fields, all four refreshed hashes, all 14 CR10 determinations, substantive defensibility of those determinations, and absence of collateral structural drift.

## MATERIAL INCORPORATED — DO NOT RE-REVIEW UNLESS A NEW CONTRADICTION APPEARS

These remain audit history but are **not mandatory reading for the current gate**, because their material findings are already incorporated into corrected CR1–CR11 and R2:
- initial 64/48/38/7/3 reconstruction (`39ab0...`, `dae0a31...`);
- strict-authority audit experiment `2291905...`;
- first and second independent QA reports (`041d33c...` etc.);
- tree-delta analyses (`d22dc72...`, `3b07e25...`);
- earlier combined-rule wording `e59b4d6...` superseded by `87015d7...`;
- initial R2 generation commits `eb06dd9...`, `573bcc0...`, `dbb6dc0...`, `23d7794...`, `315c662...` superseded for active artifact purposes by the bounded-correction commits above.

They may be reopened only if a new finding directly contradicts the current rule set or corrected artifact.

## EXACT NEXT ACTION

1. **Freeze the corrected CR1–CR11 rule set as the recovered P6.1 V1 reconstruction rule baseline**, using a versioned amendment/successor artifact; do not silently overwrite a historical frozen standard.
2. Record exact source/commit lineage in this control log.
3. Then move to the **next single A5 task reconstruction**, not all remaining 21 at once.
4. Apply the same pattern:
   source-first generation → self-QA → Claude independent QA → bounded correction if required → focused re-QA → only then advance.
5. Historical per-task counts remain post-generation forensic evidence only, never generation targets.

## HARD STOPS

Until explicitly cleared by the relevant later gate:
- no Supabase protected-store mutation/reseed;
- no WorkDefinition persistence;
- no production promotion;
- no main merge;
- no replacement of historical certified P6.1 artifacts;
- no bulk regeneration of all remaining tasks in one uncontrolled pass.

## COORDINATION REQUIREMENT FOR NEXT HANDOFF

Whoever acts next must update this file before handing off. The update must contain:
`Task | Current disposition | Mandatory review set | New commits/artifacts | Exact next action | Hard stops | Superseded/skippable material`.

If a detailed report is created but not listed here, the receiving agent is **not required to discover or review it** until this control log is updated.
