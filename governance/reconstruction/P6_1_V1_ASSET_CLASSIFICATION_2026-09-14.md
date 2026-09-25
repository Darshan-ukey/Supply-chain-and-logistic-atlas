# P6.1 V1 Asset Classification — 2026-09-14

Status: OWNER_AUTHORIZED GOVERNANCE RECORD

## Frozen governing logic
These assets define canonical P6.1 V1 meaning and must remain immutable historical authorities:
- `governance/standards/EXECUTABILITY_AND_RECURSIVE_DECOMPOSITION_STANDARD_V1_FROZEN.md`
- `governance/standards/CANONICAL_WORK_DECOMPOSITION_CONTRACT_V1_FROZEN.md`
- `schemas/canonical-work-decomposition-contract-v1.schema.json`
- `governance/standards/CANONICAL_WORK_DECOMPOSITION_COMPILER_SPEC_V1_FROZEN.md`

## Version-controlled compiler implementation
The generator/compiler implementation is an executable governance asset. It must be version-controlled, hash-pinned in each run manifest, deterministic for identical pinned inputs, and separately versioned when logic changes.

## Frozen input assets per compilation
- exact Daughter module/version and semantic hash
- exact A5 task identity/title
- exact Operational Knowledge version/hash
- exact Information Resolution assets/hashes used
- exact governing-standard/contract/schema/compiler-spec versions/hashes
- intended executor-class lens under historical V1

## Frozen generated assets per successful run
- full protected decomposition output
- run manifest
- source crosswalk/provenance
- knowledge-gap/client-binding blocker register
- structural/readiness validation report
- output content hash
- public-safe non-reconstructive summary
- custody pointer

## Implementation assets, not semantic truth
These are auditable/versioned but do not define canonical decomposition meaning:
- Supabase table/storage topology
- aggregate-vs-per-task persistence strategy
- `BROTLI_BASE64` / `GZIP_BASE64` encoding
- seeding scripts
- protected API transport mechanics
- Vercel deployment/runtime details

## Historical P6.1 preservation
The certified 2026-09-07 P6.1 record remains immutable historical evidence. Reconstruction outputs must use a separate lineage and label `RECONSTRUCTED_P6_1_V1` unless byte-for-byte identity with the lost bundle is independently proven.
