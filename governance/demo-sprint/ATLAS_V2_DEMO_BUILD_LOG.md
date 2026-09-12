# Atlas V2 Demo Build Log

## Historical sprint authorization and hybrid rebaseline
Detailed original 11–12 September authorization/rebaseline remains recoverable in Git history at blob `da690fe7c5833f45aa7de54fe2fce21c2e6b319e`.

Standing strategy remains:
`HYBRID_REUSE_PROVEN_EXECUTION_LINEAGE_WITH_ADDITIVE_ATLAS_V2_SURFACE`.

No Vercel deployment/preview/promotion/deletion is authorized. Demo work is GitHub-only on `atlas-v2-demo-2026-09-14`; merge to `main` requires D2.0.6 certification and explicit Owner approval.

## 12 September 2026 — P6.1/P6.2 discovery changes demo maturity narrative

### Material finding
Claude verified and ChatGPT reviewed evidence that the new governed Road LTL lineage is substantially farther advanced than assumed during the initial hybrid rebaseline:
- P6.1 recursive decomposition is certified/live in protected persistence: 22 tasks, 603 work units, 444 terminal leaves.
- 185 leaves are `EXECUTOR_READY`; 163 are `BLOCKED_BY_CLIENT_BINDING`; 96 are `BLOCKED_BY_KNOWLEDGE_GAP`.
- P6.2 frozen canonical WorkDefinition contract/compiler/verifier/API/migration/tests/CI exist and compiler certification passes offline.
- Governed P6.2 WD persistence has not occurred; no claim may be made that 185 canonical WDs are persisted.
- No verified new-lineage Client Binding → Malkom projection has been established.

### Corrected two-lineage demo architecture
**New governed target lineage:**
`Road LTL 1.5 → Operational Knowledge → Certified Recursive Decomposition (P6.1) → Canonical WD compiler proven (P6.2), persistence pending → Client Binding / Runtime Projection not yet complete`

**Proven Malkom execution-reference lineage:**
`Road LTL 1.2 → Domain Warehouse 2.3 → Malkom 3.0 projection`

### Why this correction is necessary
The initial hybrid plan correctly avoided falsely joining the two lineages, but it understated the maturity of the new lineage. The recovered evidence proves that recursive decomposition and canonical WD compiler capability are not merely future concepts. The remaining unproven seam is downstream persistence/binding/runtime projection. The hybrid strategy therefore remains correct but the demo must show the newer lineage as real governed progress rather than only future architecture.

### Stage-path correction
- D2.0.0 now also verifies exact P6.1/P6.2 assets/status and absence/presence of governed persistence/projection.
- D2.0.1 scope page shows truthful maturity markers and separates the old Malkom reference proof.
- D2.0.3 presents target-lineage execution-depth evidence separately from the old runtime-reference WorkDefinition/Malkom proof.
- D2.0.4 continues to use the old/reference Malkom adapter unless a genuine new-lineage adapter seam is proven.
- D2.0.5 may show P6.1 blocker classes but cannot convert EXECUTOR_READY leaves into persisted WDs by presentation.
- D2.0.6 adds explicit false-cross-lineage regression checks.

Canonical correction record:
`governance/demo-sprint/ATLAS_DEMO_LINEAGE_CORRECTION_2026-09-12.md`.

Architecture rationale is separately preserved in the Architecture Refinement Log and AR-D014–AR-D017 working decisions.

---

## Stage closure record — 2026-09-12 18:40 IST

Queue synchronized from a stale `currentStageId: D2.0.0` to actual state. Prior to this the
queue lagged five stages behind the branch.

| Stage | Status | Executor | Build SHA | Audit document | QA type |
|---|---|---|---|---|---|
| D2.0.0 | COMPLETE_WITH_EXCEPTION | ChatGPT + Claude | — | none | self-reported |
| D2.0.1 | COMPLETE | ChatGPT | `3336f658` | `D2.0.1_POST_BUILD_AUDIT.md` | executor self-certified |
| D2.0.2 | COMPLETE | Claude build / ChatGPT audit | `0d2a8ad` | `D2.0.2_POST_BUILD_AUDIT.md` | **cross-agent audited** |
| D2.0.3 | COMPLETE | Claude | `f22b77d` | `D2.0.3_POST_BUILD_AUDIT.md` | self-reported |
| D2.0.4 | COMPLETE | Claude | `457003d` | `D2.0.4_POST_BUILD_AUDIT.md` | self-reported |
| D2.0.5 | COMPLETE | Claude | `319147e` | `D2.0.5_POST_BUILD_AUDIT.md` | self-reported |
| D2.0.6 | AUTHORIZED | — | — | — | — |
| D2.0.7 | BLOCKED | — | — | — | blocker recorded |

### D2.0.0 exception
8 of 9 exit criteria are evidenced across the shared executor log. **`CREATE_PRE_CHANGE_FULL_STATE_FREEZE`
was never performed** — no freeze artifact exists on the demo branch. The stage is recorded as
complete-with-exception rather than clean, so the gap is not lost.

### QA honesty note
D2.0.2 is the only stage in this sprint verified by an agent other than the one that built it.
D2.0.3–D2.0.5 rest on committed audit documents, reproducible generators and certification tests
with negative controls proving the guards fail closed — but that is executor self-certification,
not independent QA. This distinction is recorded in the queue per-stage as `qaType`.

### Open items carried into D2.0.6
1. **Browser/visual verification has never been performed.** Neither executor has a browser or
   headless driver. All certification to date is structural, source-level and execution-level.
   D2.0.5's deliverable in particular is a visual page whose layout has never been rendered.
2. D2.0.0 full-state freeze outstanding.
3. D2.0.3–D2.0.5 not independently QA-verified.
4. **D2.0.7 auto-deploy conflict unresolved.** The repository's Vercel GitHub App has historically
   produced a deployment record on every push to every branch (333 preview + 13 production
   observed). A merge to `main` would likely auto-deploy to production, conflicting directly with
   D2.0.7's own `STOP_IF_GIT_INTEGRATION_WOULD_AUTO_DEPLOY` guardrail. The connected Vercel account
   returns 403 on `logistic_atlas_v2` (scope mismatch), so the integration cannot currently be
   inspected or disabled. A preview deployment of the demo branch is the lower-risk route to
   browser verification than a main merge.

---

## Cross-agent independent QA — D2.0.3 — 2026-09-12

**Reviewer:** ChatGPT
**Result:** PASS at source / lineage / change-scope level.

Independent checks performed against `atlas-v2-demo-2026-09-14` and historical source branch `atlas-presentation-architecture-v1-p6-2`:
- Build commit `f22b77d9765833c9cb15caafcab08273b00a2e54` changes exactly the two files claimed by the D2.0.3 audit: `execution/adapters/malkom/malkom-adapter.mjs` and `execution/contracts/malkom-adapter-manifest-v1.json`.
- Demo-branch adapter blob SHA `3e027f8286614e9d5b08080124edaac2971fd3f2` exactly matches the historical source-branch blob SHA; import provenance is independently confirmed.
- `canvas-v2/canvas-v2/data/road-ltl-workdefinitions-v2.3.json` directly declares `sourceModel: "Road LTL V1.2"`, source `Malkom-Domain-Warehouse-Engine-V2.3-Lossless(1).html`, and describes itself as a protected/admin additive derived execution projection. This independently supports the old-reference lineage and rejects any v1.5/P6.2 provenance claim.
- Adapter implementation preserves unsupported `ESCALATE` next steps as `PARTIAL` with canonical escalation visible; it does not silently flatten cross-queue semantics.
- Manifest explicitly leaves `materialize`, `deploy`, `status`, `execute`, and `reconcileEvidence` disabled, consistent with Atlas not owning runtime execution.

QA scope note:
- This cross-agent audit independently verifies source identity, change scope, lineage truth and adapter guardrail behavior from committed artifacts. Claude's earlier 22/22 execution run remains reproducible execution evidence from the build executor; ChatGPT did not re-run Node locally through the GitHub connector in this checkpoint.

**QA disposition:** D2.0.3 may be treated as **cross-agent audited** for demo-governance purposes, with the execution-run provenance caveat above retained.
