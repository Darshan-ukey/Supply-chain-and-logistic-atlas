# Atlas V2 Demo Build Protocol

Status: OWNER_AUTHORIZED_STANDING_PROTOCOL / LINEAGE CORRECTED 12 SEP 2026  
Demo target: Monday 14 September 2026  
Stakeholder demo: Tuesday 15 September 2026  
Primary executor: ChatGPT  
Hot-backup executor: Claude

## Purpose
Deliver a GitHub-only Atlas 2.0 hybrid proof of concept without sacrificing recoverability, architecture integrity or auditability. Monday is not full Atlas V2 production certification.

Mandatory companion correction:
`governance/demo-sprint/ATLAS_DEMO_LINEAGE_CORRECTION_2026-09-12.md`.

## Shared logging — NO LOG → NO ADVANCE
Both executors must read/update `claude_chatGPT.md` for PRE_ACTION, MATERIAL_FINDING, POST_ACTION and STAGE_CLOSURE. A stale shared log invalidates advancement.

## Release rule
- No Vercel deployment, preview, promotion, live change or deletion.
- Vercel is read-only for forensic audit.
- Feature branch: `atlas-v2-demo-2026-09-14`.
- `main` is integration destination only after D2.0.6 PASS + explicit Owner approval at D2.0.7.
- Main merge does not authorize Vercel deployment.
- Stop before any GitHub action expected to trigger Vercel.

## Build discipline
For each stage: PRE_ACTION → PRE_BUILD_AUDIT → narrow build slices → MID_BUILD_AUDIT → MATERIAL/POST logs → POST_BUILD_AUDIT → full integration/regression → exact repository SHA/freeze → handover → STAGE_CLOSURE. No delta-only certification. Frozen historical states remain immutable.

## Corrected hybrid lineage model

### New governed target lineage
`Road LTL 1.5 → Operational Knowledge → Certified Recursive Decomposition (P6.1) → Canonical WD compiler proven (P6.2), persistence pending → Client Binding / Runtime Projection not yet complete`

Current evidence: P6.1 = 22 tasks / 603 work units / 444 terminal leaves; 185 EXECUTOR_READY / 163 client-binding blocked / 96 knowledge-gap blocked. P6.2 compiler infrastructure is technically proven but canonical WD persistence is not authorized/completed. Do not present EXECUTOR_READY as persisted WorkDefinitions.

### Proven Malkom execution-reference lineage
`Road LTL 1.2 → Domain Warehouse 2.3 → Malkom 3.0 projection`

This remains the verified runtime/projection proof unless D2.0.0 finds stronger governed evidence. It must be labeled as a reference implementation/proven adapter pattern and never represented as output of Road LTL 1.5/P6.2.

### Why the hybrid remains valid
The old lineage proves downstream Malkom projection. The new lineage now proves substantial generic governed upstream capability. The unresolved seam is governed WD persistence → Client Binding → runtime projection. The demo should make that distinction visible rather than either understating the new path or fabricating a bridge.

## Corrected demo stages

### D2.0.0 — Baseline seam verification + branch/freeze setup
Verify foundation/runtime identity; Canvas V2 provenance; old V1.2→DW2.3→Malkom proof; P6.1 certified bundle/status; P6.2 compiler/status and persistence state; version facts; branch provenance; additive compatibility; complete pre-change freeze; no Vercel side effect.

### D2.0.1 — Additive Canvas V2 shell + Atlas scope/future page
Show `Atlas — From Domain Knowledge to Execution Readiness`. New lineage maturity may be shown accurately: decomposition certified; WD compiler proven/persistence pending; Client Binding/runtime projection incomplete. Show old Malkom proof separately.

### D2.0.2 — Road LTL + Ocean surfaces
Road LTL may expose verified target-lineage depth. Ocean 0.6 remains Owner-authorized demo candidate only; fail closed where equivalent execution depth is absent.

### D2.0.3 — Road LTL execution-depth integration
Expose two non-conflated views where useful: (a) Road LTL 1.5 + OK + certified P6.1 + P6.2 compiler-ready evidence; (b) old V1.2/DW2.3 execution-reference artifacts used for the Malkom proof. Never silently map them.

### D2.0.4 — Malkom 3.0 adapter/projection
Use verified existing Malkom projection from the proven reference lineage unless a genuine governed new-lineage Client Binding + adapter/projection is discovered and independently validated. Document known adapter losses/gaps.

### D2.0.5 — Representative POC journey + secondary governance/readiness
Primary journey: Atlas/domain → Road LTL governed execution depth → proven Malkom reference projection → larger tool-neutral Atlas direction. Protected/admin evidence may show real P6.1 blocker distribution. No fake completeness score or fake WD persistence.

### D2.0.6 — GitHub integration/regression certification
Audit complete demo branch, public/admin boundary, version labels, reproducibility, branch provenance and merge readiness. Explicitly test that UI/copy does not imply Road LTL 1.5/P6.2 generated the old Malkom projection. Freeze release candidate in GitHub only.

### D2.0.7 — Owner-approved merge to main
Merge only certified D2.0.6 state after explicit Owner approval. Verify repository integrity and log closure. Do not deploy to Vercel.

## Architecture/product guardrails
Atlas owns governed understanding/specification; downstream platforms own execution. Canonical business semantics remain technology-neutral. Malkom is a downstream consumer. No P6.2 persistence is authorized by this demo protocol. No architecture candidate is Owner-frozen merely because it appears in the demo.

## Stop conditions
Stop rather than improvise if lineage cannot be proven, a change fabricates knowledge/readiness, historical evidence would be mutated, security boundaries cannot be preserved, a new/old lineage bridge would be implied without evidence, an open AR decision would be silently closed, or a GitHub action may trigger Vercel.
