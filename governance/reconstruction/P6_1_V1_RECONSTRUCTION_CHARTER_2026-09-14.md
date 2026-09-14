# P6.1 V1 Reconstruction Charter — 2026-09-14

Status: OWNER_AUTHORIZED / RECONSTRUCTION STARTED

## Objective
Reconstruct Canonical Work Decomposition for Road LTL 1.5 using the historical P6.1 V1 governing logic exactly as frozen, without applying later AR0.2/VNext reinterpretations and without overwriting historical P6.1 evidence.

## Historical authority
- Base certified implementation: `ba9d47f07b59ecf79ff6cde9145c0185cc18d39d`
- Governing standard: `governance/standards/EXECUTABILITY_AND_RECURSIVE_DECOMPOSITION_STANDARD_V1_FROZEN.md`
- Canonical contract: `governance/standards/CANONICAL_WORK_DECOMPOSITION_CONTRACT_V1_FROZEN.md`
- Machine schema: `schemas/canonical-work-decomposition-contract-v1.schema.json`
- Historical exact target: `road-ltl@1.5`

## Explicit architectural choice
This reconstruction uses the historical P6.1 V1 stopping rule: recursively decompose until each work unit is unambiguous enough for the intended executor class, subject to the frozen contract and fail-closed blocker rules.

The AR0.2 candidate refinement that proposes business-semantic sufficiency independent of executor class is NOT applied here. Historical P6.1 remains immutable; any future VNext decomposition model must be separately authorized and versioned.

## Reconstruction boundary
This work may:
- reconstruct protected decomposition instances from frozen Road LTL 1.5 semantics and governed Operational Knowledge;
- create a reproducible compiler/generator specification and implementation for P6.1 V1;
- generate a controlled protected/demo fixture, beginning with LTL-03;
- validate lineage, topology, stop criteria, readiness classification, blockers, evidence and source references;
- produce a public-safe non-reconstructive summary.

This work must NOT:
- claim byte-for-byte recovery of the lost historical private bundle;
- rewrite or replace the historical P6.1 certified record;
- infer missing business semantics from aggregate counts;
- fabricate missing Operational Knowledge, Information Resolution or source authority;
- apply AR0.2/VNext stopping logic;
- persist to protected production Supabase without separate Owner authorization;
- merge to `main` or promote production without separate Owner authorization.

## Required durable assets
1. `CANONICAL_WORK_DECOMPOSITION_COMPILER_SPEC_V1_FROZEN.md`
2. version-controlled compiler/generator implementation
3. reconstruction input manifest with exact source hashes/versions
4. protected full decomposition output/fixture with immutable content hash
5. validation/certification report
6. public-safe summary
7. custody pointer documenting where protected output resides

## Initial execution scope
Start with `LTL-03` as the representative deep-demo task. Do not expand to all 22 tasks until LTL-03 passes the V1 contract, topology checks, stop criteria and independent review.

## Exit classifications
- `P6_1_V1_LTL03_RECONSTRUCTION_PASS`
- `P6_1_V1_LTL03_BLOCKED_BY_SOURCE_GAP`
- `P6_1_V1_COMPILER_SPEC_INSUFFICIENT__STOP`

Historical totals (603/444/185/163/96) are reference evidence only and are not acceptance targets for reconstructed output.
