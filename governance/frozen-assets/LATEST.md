# Atlas — Latest Frozen Assets (READ THIS FIRST)

Updated: **2026-09-25**  
Canonical frozen registry: `governance/frozen-assets/ASSET_REGISTER.json`  
Machine pointer: `governance/frozen-assets/CURRENT.json`  
Integration lock: `governance/frozen-assets/history/frozen-stack-lock-v2.2.json`

## Authority rule
Use `ASSET_REGISTER.json` for frozen-asset identity/status. This file and `CURRENT.json` are mutable navigation pointers only. Frozen payloads remain immutable.

## Production baseline — unchanged
- Universe 7.3
- Road LTL 1.3
- Ocean FCL 0.5
- Ocean LCL 0.5
- Canvas 2.0.0
- Universal Ask 2.0.1
- Atlas Warehouse 1

No Atlas v2 candidate is production-promoted by this pointer reconciliation.

## Current execution-reference candidates
- Road LTL 1.5 — frozen execution-reference candidate.
- Road LTL 1.5 Operational Knowledge / OKv2 — frozen operational reference.
- Ocean FCL 0.6 and Ocean LCL 0.6 — frozen execution-reference candidates.
- Canvas 2.0.1 — frozen execution-reference candidate; live/browser validation still required.
- Ocean 0.6 public-safe projection bundle — rendering/reference proof only.

## Current canonical execution contracts
- Canonical Work Decomposition Contract V1 — asset `canonicalWorkDecompositionContractV1Frozen`; governed on source branch `atlas-presentation-architecture-v1-p6-2`; blob `046885c71dc9fb24532b398cacd47ffc522f3a1b`.
- Canonical WorkDefinition Contract V1 — asset `canonicalWorkDefinitionContractV1`; governed on source branch `atlas-presentation-architecture-v1-p6-2`; blob `c074489f2cf7edacde962f7e0260e2b240d24b87`.

The older Sep-2 pending decomposition/WorkDefinition records are historical and superseded. Do not treat them as next implementation.

## Atlas v2 candidate product direction
- Product End-State Contract V1 candidate: `governance/product/ATLAS_V2_PRODUCT_END_STATE_CONTRACT_V1_CANDIDATE.md`
- Product Coverage Matrix V1 candidate: `governance/product/ATLAS_V2_PRODUCT_COVERAGE_MATRIX_V1_CANDIDATE.json`
- Business Logic / Rule Ontology / Runtime Consumption candidate: `governance/product/ATLAS_V2_BUSINESS_RULE_ONTOLOGY_RUNTIME_CONSUMPTION_CONTRACT_V0_1_CANDIDATE.md`

These remain **CANDIDATE / NOT FROZEN** until ATL-110 independent QA and explicit Owner product-contract freeze.

## Reuse / successor direction for Atlas v2
The 35-record registry was reconciled under ATL-118. Atlas v2 uses explicit dispositions: REUSE_AS_IS / REUSE_AS_GOVERNING_INPUT, REUSE_WITH_VALIDATION, REUSE_WITH_SUCCESSOR, HISTORICAL/REFERENCE_ONLY, or DO_NOT_APPLY. See `governance/product/ATLAS_V2_FROZEN_ASSET_RECONCILIATION_2026-09-24.md`.

## Critical guard
`knowledge-execution-warehouse-schema-1` is **DO_NOT_APPLY** to the current P6.2/successor schema path. Historical frozen candidates are not promoted merely because they are frozen.

## Recovery / custody
GitHub is canonical technical authority for identity, hash, lineage and executable contracts. Drive retains decision-significant human-readable custody/recovery evidence. The Atlas v2 candidate contract and rule ontology have candidate Drive custody mirrors; exact final frozen identities must be mirrored/read back at ATL-110.

## Next governed gate
Finish ATL-118/ATL-119 reconciliation → close ATL-103 candidate reconciliation → ATL-110 independent QA → explicit Owner product-contract freeze. Only then may the temporary release controller dispatch downstream Atlas v2 build lanes.
