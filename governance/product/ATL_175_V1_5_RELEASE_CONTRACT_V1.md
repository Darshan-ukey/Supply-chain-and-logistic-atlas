# ATL-175 — Atlas v1.5 Bounded API, Versioning, Release & Rollback Contract

This handover freezes the bounded v1.5 product-release contract for the current-lineage Road LTL → Malkom Domain Warehouse proof.

## Stable contract
- Query/export/package consumers must carry explicit asset/package/version identity.
- Malkom package identity is `malkom-dw::road-ltl::LTL-04::v1`; compatibility is exact-current-lineage.
- Identity, lineage, or compatibility ambiguity fails closed.
- Public access is limited to public-safe governed projections/exports. Controlled deepen, client-binding resolution, promotion, and rollback are protected actions.

## Release and rollback
Promotion path is **STAGING → INDEPENDENT_QA → OWNER_GATE → PRODUCTION**. Production promotion is not authorized by this artifact. ATL-142 remains the Owner gate.

Rollback is to the identity-verified current production baseline preceding v1.5. Release-significant governed data, generated projections, release manifest, and this contract require backup/recovery evidence before promotion. Recovery may restore only identity-verified evidence.

Frozen assets are never mutated in place.

## Compatibility assumptions
v1.5 supports the frozen current-lineage package only. It does not provide implicit schema migration or multi-generation negotiation. A mismatch is surfaced and denied rather than coerced.

## STOP boundary
No universal schema-migration framework, multi-generation version negotiation, broad indexing redesign, or full future upgrade architecture. Those remain outside this v1.5 slice.

Machine-readable source: `governance/product/ATL_175_V1_5_RELEASE_CONTRACT_V1.json`.
