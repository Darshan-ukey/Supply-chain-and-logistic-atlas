# Atlas v2 Frozen Asset Reconciliation — 2026-09-24

**Status:** FIRST-PASS RECONCILIATION — OWNER REVIEW / ATL-110 FREEZE INPUT  
**Source of truth audited:** `governance/frozen-assets/ASSET_REGISTER.json` on `atlas-governance-registry-v2.1`  
**Registry updatedAt:** 2026-09-23T12:30:00+05:30  
**Registry entries:** 35  
**Current=true entries:** 29

## 1. Count interpretation

The frozen-asset registry currently contains 35 records.

- 31 records have an explicit `FROZEN*` status.
- 1 additional record (Universal Ask 2.0.1) is `CERTIFIED_IN_BASELINE_PACKAGE`.
- 1 record is a current governed cross-layer contract.
- 2 records are historical pending commitments that have been superseded by frozen execution contracts.

Therefore, **35 registry records does not mean 35 Atlas v2 production-ready assets**.

Atlas v2 must preserve historical byte identity and lineage, but each asset needs a v2 disposition.

## 2. First-pass v2 dispositions

| Asset | V2 disposition | Rationale |
|---|---|---|
| universe-7.3 | REUSE_WITH_SUCCESSOR | Preserve immutable v1 baseline; v2 needs structured canonical live-store/source-refresh/change-delta mechanics rather than mutating 7.3. |
| road-ltl-1.3 | V1_PRODUCTION_BASELINE_ONLY | Current v1 production baseline. Preserve; do not mutate for v2. |
| ocean-fcl-0.5 | V1_PRODUCTION_BASELINE_ONLY | Historical/pre-live v1 baseline; preserve only. |
| ocean-lcl-0.5 | V1_PRODUCTION_BASELINE_ONLY | Historical/pre-live v1 baseline; preserve only. |
| road-ltl-1.4-candidate | HISTORICAL_LINEAGE_REFERENCE | Required lineage/base evidence; not current v2 target. |
| road-ltl-1.4-operational | HISTORICAL_LINEAGE_REFERENCE | Required base for Road LTL 1.5 OK lineage; preserve immutable. |
| road-ltl-1.5-candidate | REUSE_WITH_VALIDATION | Strong current execution-reference candidate; v2 must reconnect it to the final source→depth→WD→readiness chain before promotion. |
| road-ltl-1.5-operational | REUSE_WITH_VALIDATION | Valuable LTL-03 OKv2 reference; not universal proof of all v2 Operational Knowledge. |
| ocean-fcl-0.6-candidate | REUSE_WITH_SUCCESSOR_DEPTH | Useful Daughter/go-live candidate; current OK depth does not prove v2 execution depth. |
| ocean-lcl-0.6-candidate | REUSE_WITH_SUCCESSOR_DEPTH | Same as FCL 0.6. |
| ocean-0.6-public-safe-projections-bundle | REFERENCE_RENDERING_PROOF_ONLY | Demo/public-safe mechanical projection; non-reconstructive and not v2 canonical execution truth. |
| daughter-release-ltl1.4-ocean0.6 | RECOVERY_CUSTODY_ONLY | Exact release package remains critical recovery/lineage evidence; not a mutable v2 product asset. |
| insideOutOutsideInOperationalResearch | REUSE_AS_GOVERNING_INPUT | Still aligned with v2; supplement with explicit Source→Universe and Universe→Daughter generation contracts. |
| executabilityRecursiveDecomposition | REUSE_AS_GOVERNING_INPUT | Core decomposition standard remains relevant; reconcile with current frozen WD contracts and ATL-60/95. |
| evidenceEpistemicClassification | REUSE_WITH_V2_EXTENSION | Preserve; v2 knowledge-state taxonomy now adds explicit UI/readiness/research integration. |
| knowledgeToExecutionArchitecture | HISTORICAL_SUPERSEDED_TOP_LEVEL | Important historical architecture, but top-level product architecture is now Product Constitution + three-product AR0.2 rebase + Atlas v2 contract. |
| clientBindingResolutionPrinciple | REUSE_AS_GOVERNING_INPUT | Still valid and consistent with v2. |
| daughter-production-standard-2 | REUSE_WITH_V2_EXTENSION | Preserve structure; reconcile with structured canonical store, generated pages and change-impact graph. |
| operational-knowledge-contract-1 | HISTORICAL_SUPERSEDED | Superseded by OK Contract v2. |
| operational-knowledge-contract-2-candidate | REUSE_WITH_V2_RECONCILIATION | Strong current schema reference; reconcile against ATL-60 extensible Z1 design and future domain extensibility. |
| information-resolution-contract-1 | REUSE_AS_REFERENCE_CONTRACT | Still usable as embedded OK information semantics. |
| bol-information-resolution-baseline-0.1 | REUSE_AS_REFERENCE_BASELINE | Strong LTL-03/BOL evidence baseline; do not generalize as exhaustive cross-domain model. |
| process-concept-crosswalk-1 | REUSE_AS_IS | Governed cross-layer concept contract remains useful; Ocean coverage gap remains separate. |
| client-binding-contract-1 | REUSE_WITH_V2_RECONCILIATION | Preserve; reconcile with enterprise-discovery ingestion and richer binding workflow. |
| canonicalWorkDecompositionContract | HISTORICAL_SUPERSEDED_PENDING | Historical Sep-2 pending file only; do not use as current contract. |
| canonicalWorkDecompositionContractV1Frozen | REUSE_AS_CURRENT_EXECUTION_CONTRACT | Current frozen decomposition contract; inherit into v2 unless ATL-110 identifies a binding gap. |
| canonicalWorkDefinitionContract | HISTORICAL_SUPERSEDED_PENDING | Historical VNext pending file; do not use as current contract. |
| canonicalWorkDefinitionContractV1 | REUSE_AS_CURRENT_EXECUTION_CONTRACT | Current frozen executor-neutral WD contract; preserve and validate against richer ATL-60/95 semantics. |
| knowledge-execution-warehouse-schema-1 | DO_NOT_APPLY | Explicitly incompatible with deployed P6.2/current successor path; historical architecture only. |
| canvas-2.0.0 | V1_PRODUCTION_BASELINE_PRESERVE | Preserve byte-identical v1 shell. |
| canvas-2.0.1-candidate | REUSE_WITH_LIVE_UI_VALIDATION | Strong bridge candidate; needs v2 data integration + real browser/live validation before promotion. |
| universal-ask-2.0.1 | REUSE_WITH_V2_SUCCESSOR | Preserve certified baseline; v2 requires Universal Ask across complete graph/context/Trace/Compare/readiness surfaces. |
| atlas-warehouse-1 | HISTORICAL_BACKEND_PRESERVE_NOT_CANONICAL_V2 | Preserve as v1/backend/forensic asset; must not become v2 canonical truth if Supabase structured store is adopted. |
| road-ltl-v2.3-malkom-reference-projection | REFERENCE_PROJECTION_ONLY_NOT_CURRENT_LINEAGE | Valuable reference fixture; explicitly not generated from current governed Road LTL 1.5/P6 chain. ATL-95 requires a new current-lineage projection. |
| d2-0-6-post-build-full-state-freeze | HISTORICAL_DEMO_FREEZE_ONLY | Preserve as demo-state evidence only. |

## 3. Important registry/pointer findings

### GitHub ASSET_REGISTER
Usable as the most current frozen-asset inventory. It was updated 23 Sep and already records:
- frozen P6.1 Canonical Work Decomposition Contract V1;
- frozen P6.2 Canonical WorkDefinition Contract V1;
- explicit supersession of the older pending files;
- explicit DO_NOT_APPLY status for the incompatible knowledge-execution warehouse schema;
- current Canvas 2.0.1 candidate and Malkom reference projection limitations.

### GitHub CURRENT.json / LATEST.md
These pointers are stale relative to ASSET_REGISTER:
- CURRENT.json updated 2 Sep and still describes Canonical WorkDefinition as next implementation;
- LATEST.md updated 2 Sep and says recursive decomposition / WorkDefinition VNext remain production-promotion work.

For v2, **ASSET_REGISTER is materially newer than CURRENT/LATEST**. The pointer files must be reconciled rather than trusted as-is.

### Google Drive CURRENT FROZEN ASSET POINTER
Drive pointer was updated 14 Sep. It has valuable later P6.0/P6.1/presentation status and recovery notes, but it predates:
- Product Constitution/three-product refinement closure;
- later ATL-60/82/86/90 mechanics;
- frozen P6.2 WorkDefinition contract reconciliation;
- Atlas v2 Product End-State Contract;
- current Linear product/live milestone.

Drive therefore requires a new v2 custody/pointer reconciliation. Do not overwrite historical frozen artifacts; create successor pointer/custody records.

## 4. V2 frozen-asset rule

No frozen asset is to be edited in place.

Atlas v2 decisions use one of:
- REUSE_AS_IS / REUSE_AS_GOVERNING_INPUT;
- REUSE_WITH_VALIDATION;
- REUSE_WITH_SUCCESSOR (new immutable version);
- HISTORICAL/REFERENCE_ONLY;
- DO_NOT_APPLY.

A product-contract change never retroactively changes a frozen asset's historical status.

## 5. Required next actions before ATL-110 freeze

1. Reconcile GitHub `CURRENT.json` and `LATEST.md` to the newer ASSET_REGISTER without changing frozen payloads.
2. Add Atlas v2 Product End-State Contract / coverage matrix to Drive custody with explicit CANDIDATE status, then mirror final frozen identities at ATL-110.
3. Verify Drive custody exists for every decision-significant current/future v2 frozen asset class.
4. Link each v2 capability in the product coverage matrix to the exact reusable frozen asset(s), successor required, or build gap.
5. Re-run applicable hash/readback/recovery checks only where the product depends on the asset for v2; do not re-certify historical assets needlessly.
6. Do not promote Road LTL 1.5, Ocean 0.6, Canvas 2.0.1 or reference projections merely because they are frozen candidates.
