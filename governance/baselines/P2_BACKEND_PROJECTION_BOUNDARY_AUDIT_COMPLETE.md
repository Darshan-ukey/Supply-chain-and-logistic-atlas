# P2 — Backend Projection Boundary Audit

**Status:** COMPLETE / EXIT GATE PASS  
**Branch:** `atlas-presentation-architecture-v1-p2`  
**Base:** `atlas-presentation-architecture-v1-p1r`  
**Canonical semantic baseline:** Frozen Stack Lock v2.2  
**Presentation contracts:** Operational Knowledge 1.1 / Execution Readiness 1.1 / Field Classification 1.1 / Authorization Matrix 1.0

## Objective

Create the server/build-side authorization boundary required by the frozen five-depth Daughter presentation architecture so normal/public users receive useful Overview, Operational Knowledge and Execution Readiness projections while detailed Work Decomposition, WorkDefinition, runtime mappings, client-local values and reconstructive execution IP remain protected.

## Implemented projection classes

### PUBLIC_SAFE
Endpoint: `/api/execution-depth-projection`

- anonymous-safe;
- constructed field-by-field from registered canonical sources;
- does not return raw canonical containers;
- keeps canonical trace identity and presentation-contract version;
- exposes safe human-readable Operational Knowledge and Execution Readiness;
- never returns full Work Decomposition or WorkDefinition.

### GOVERNANCE_CANONICAL_NO_EXECUTION_IP
Endpoint: `/api/governance-operational-projection`

- requires authenticated capability `atlas.operational.full.read`;
- can expose governed canonical operational information and runtime-feedback evidence;
- continues to remove execution-protected reconstruction fields including detailed resolution workflow, source-claim crosswalk within critical rules and Work Decomposition seed;
- private/no-store.

### EXECUTION_PROTECTED
Endpoints:
- `/api/work-decomposition` — requires `atlas.work_decomposition.full.read`; reserved and returns `NOT_YET_COMPILED` until canonical decomposition is materialized.
- `/api/admin-workdefinitions` — existing V2 WorkDefinition store retained, now explicitly capability-gated by `atlas.workdefinition.full.read` or legacy `WORKDEFINITION_VIEW`.

The current V2 WorkDefinition store remains an older protected execution asset; P2 does not represent it as Road LTL 1.5 WorkDefinition VNext.

## First deep proof — Road LTL 1.5 / LTL-03

The P2 public projection proves that BOL Information Resolution can expose useful safe knowledge without leaking execution IP.

Public projection includes:
- LTL-03 canonical identity and lineage;
- business meaning / why;
- safe BOL canonical object families;
- applicability summaries;
- human-readable resolution principles;
- aggregate unresolved counts;
- measurement-definition pending count;
- conditional execution-readiness status;
- Work Decomposition / WorkDefinition status only.

Public projection excludes:
- `workDecompositionSeed`;
- `resolutionWorkflow`;
- exact `sourceClaimIds` / source-claim pack references;
- raw field-performance baseline;
- exact unresolved client/runtime labels such as Shipper Code or Handling Unit Line No;
- client application/environment/field mappings;
- runtime mappings;
- full Work Decomposition;
- full WorkDefinition.

## Readiness semantic proof

P2 does not conflate localization with knowledge gaps:
- 4 `SOURCE_CONTEXT_PENDING` items contribute to the operational-knowledge unresolved count;
- 6 `CLIENT_BINDING_REQUIRED` items remain client-localization dependencies and do not become false knowledge gaps;
- the Malkom metric-definition issue is surfaced separately;
- Information Resolution is `PARTIAL`, not falsely labeled complete or executor-proven;
- overall LTL-03 is `CONDITIONAL_READY`, preserving the frozen Road LTL 1.5 gate semantics.

## Source-path security

Projection request parameters are identifiers only. They are resolved through `governance/presentation/p2-projection-source-registry.json`; they never become filesystem paths. Unregistered module/version combinations fail closed.

This also creates the generic extension pattern for future Daughter materialization: add a declarative source registry entry when the Daughter conforms to a supported canonical profile. No LTL-specific renderer logic is required.

## Routing / deployment

The new routes remain inside the existing consolidated `api/atlas.js` Vercel function. Top-level Vercel function count remains unchanged. `vercel.json` now rewrites the three P2 routes into the consolidated Atlas router.

## Verification

Dedicated CI workflow: `.github/workflows/p2-projection-boundary.yml`  
Command: `npm run p2:check`

Proof run:
- GitHub Actions run: `33721105230`
- head SHA: `ce5745ee5a896e61f0521e4c1036532526dff595`
- conclusion: **SUCCESS**
- P2 projection-boundary test: PASS
- existing V2 public-IP boundary test: PASS
- consolidated API-router smoke test: PASS
- Vercel status at proof SHA: SUCCESS

The first CI attempt failed because the test searched the entire governance response and matched protected field names inside the explicit omission-audit list. The assertion was corrected to inspect the canonical payload subtree. This did not represent a data leak; the succeeding run verifies the actual protected data is absent.

## Semantic/regression impact

P2 does **not** modify or promote:
- Supply Chain Universe 7.3;
- Road LTL production 1.3;
- Road LTL 1.5 semantic candidate data;
- Ocean FCL/LCL production 0.5;
- Ocean FCL/LCL 0.6 candidate semantics;
- Canvas 2.0.0;
- Operational Knowledge Contract v2;
- Information Resolution Contract v1;
- Client Binding Contract;
- Canonical Work Decomposition / WorkDefinition semantics.

P2 changes only projection/API authorization infrastructure, capability mapping, route configuration, verification and governance records.

## Remaining limitation intentionally deferred

Ocean FCL/LCL 0.6 frozen candidates are not currently materialized as repository JSON files on this branch. P2 therefore does not substitute 0.5 or fabricate missing Information Resolution depth. The source registry fails closed until an applicable frozen candidate payload is materialized. This is compliant with the P1R rule to show only depth actually present.

## Exit gate

**PASS.** The browser/API boundary now has a tested public-safe projection and separate governance/execution-protected paths. P3 may consume only these projections (or a later superseding boundary) and must not read raw canonical execution data directly into the Daughter browser.

**Next phase:** P3 — Universal Daughter Renderer V2.
