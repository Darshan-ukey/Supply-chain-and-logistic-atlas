# Atlas — Latest Frozen Assets (READ THIS FIRST)

Updated: **2026-09-07**  
Canonical frozen registry: `governance/frozen-assets/ASSET_REGISTER.json`  
Machine latest pointer: `governance/frozen-assets/CURRENT.json`  
Presentation asset register: `governance/presentation/PRESENTATION_ASSET_REGISTER_V1.7.json`  
Integration lock: `governance/frozen-assets/history/frozen-stack-lock-v2.2.json`

## Production baseline — unchanged
- Universe **7.3**
- Road LTL **1.3** — `FROZEN_PRODUCTION_BASELINE`
- Ocean FCL **0.5** — historical/pre-cutover production baseline
- Ocean LCL **0.5** — historical/pre-cutover production baseline
- Canvas **2.0.0**
- Universal Ask **2.0.1**
- Atlas Warehouse **1**

P6.1 does not promote or mutate these production semantic baselines.

## Approved/current Daughter targets
- Road LTL **1.5** — `FROZEN_EXECUTION_REFERENCE_CANDIDATE`
  - exact effective PUBLIC_SAFE runtime coverage: **22/22**
  - 21 unchanged tasks inherit losslessly from pinned frozen Road LTL 1.4
  - `LTL-03` remains the sole direct governed 1.5 semantic override
  - no runtime fallback to Road LTL 1.4 or 1.3
- Ocean FCL **0.6** — approved production go-live Daughter target; immutable
- Ocean LCL **0.6** — approved production go-live Daughter target; immutable

Ocean 0.5 is not an execution-depth fallback for 0.6.

## Presentation / execution-depth architecture status

Completed through **P6.1**:

- P0 — architecture/register baseline
- P1 — presentation contracts and authorization matrix
- P1R — Information Resolution-safe presentation refinement
- P2 — authorization-aware backend projection boundary
- P3 — Universal Daughter Renderer V2
- P3O — Ocean FCL/LCL 0.6 materialization/certification
- P4 — Canvas V2.0.1 → Daughter integration bridge
- P5 — Ask Atlas / Trace / Governance integration
- P6.0 — Road LTL 1.5 effective materialization
- P6.1 — Recursive Work Decomposition

## P6.1 — Recursive Work Decomposition — COMPLETE PASS

Canonical Work Decomposition Contract V1 is frozen and Road LTL 1.5 is recursively decomposed across all 22 A5 tasks.

Compiled protected graph:

- A5 tasks: **22**
- work units: **603**
- terminal leaves: **444**
- `EXECUTOR_READY`: **185**
- `BLOCKED_BY_CLIENT_BINDING`: **163**
- `BLOCKED_BY_KNOWLEDGE_GAP`: **96**
- cycles: **0**
- orphan parents: **0**
- invalid terminal `NEEDS_DECOMPOSITION`: **0**

Full Work Decomposition remains `EXECUTION_PROTECTED`.

The protected Supabase store uses one server-only `BROTLI_BASE64` aggregate row containing 22 logical task decompositions. `/api/work-decomposition` requires `atlas.work_decomposition.full.read`, resolves the exact module/version/task tuple, decompresses server-side, and returns only the requested task decomposition. The aggregate 22-task payload is never returned.

PUBLIC_SAFE surfaces expose only approved non-reconstructive decomposition status/count summaries with `detailIncluded=false`.

## P6.1 certification

- Dedicated GitHub Actions run: **34092195930 — SUCCESS**
- Certified implementation commit: `ba9d47f07b59ecf79ff6cde9145c0185cc18d39d`
- Vercel commit status: **SUCCESS**
- inherited regression chain: **P6.0 → P5 → P4 → P3O → P3 → P2 → public execution-IP boundary — PASS**
- Daughter semantic mutation: **none**
- runtime semantic fallback: **none**
- independent executor proof: **not yet claimed**
- Canonical WorkDefinition compilation: **not started**

Authoritative P6.1 records:

- `governance/presentation/P6_1_STATUS.json`
- `governance/presentation/P6_1_RECURSIVE_WORK_DECOMPOSITION_REGISTER.json`
- `governance/baselines/P6_1_RECURSIVE_WORK_DECOMPOSITION_CERTIFICATION.json`
- `governance/baselines/P6_1_RECURSIVE_WORK_DECOMPOSITION_AUDIT_COMPLETE.md`

## Frozen operational reference assets
- Road LTL 1.5 Operational Knowledge — `FROZEN_OPERATIONAL_REFERENCE`
- Operational Knowledge Contract **v2**
- Information Resolution Contract **v1**
- BOL Information Resolution Baseline **v0.1**
- Canonical Work Decomposition Contract **v1**

Information Resolution remains nested inside Operational Knowledge; it is not a separate semantic layer.

## Next controlled phase

**P6.2 — Canonical WorkDefinition Compilation**

The next phase may compile WorkDefinition only from governed executable Work Decomposition nodes. It must remain executor-neutral, preserve explicit blockers, keep client-specific values in Client Binding rather than the canonical definition, and must not claim independent executor proof until separately demonstrated.

## Remaining promotion work

1. Compile Canonical WorkDefinition from P6.1 executable nodes.
2. Populate the governed Atlas Warehouse with the compiled operational layer.
3. Resolve required client-binding dependencies without mutating canonical reference definitions.
4. Build runtime projections/adapters only after canonical compilation.
5. Complete independent executor proof and downstream measured validation before execution-reference candidates are promoted as executor-proven production assets.

## How to use this registry
Never determine the current Atlas state from filenames or old chat history. Start with this file and `CURRENT.json`. Historical frozen versions remain immutable under `governance/frozen-assets/history/`.
