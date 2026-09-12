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
