# Atlas Demo Lineage Correction — 12 September 2026

Status: ACTIVE DEMO GOVERNANCE CORRECTION  
Applies to: D2.0.0–D2.0.7, Current/Demo/Target state map, demo protocol, handover, build log and queue interpretation.  
Reason: recovered/verified P6.1/P6.2 evidence materially changed the known maturity of the new governed Road LTL lineage.

## Canonical two-lineage truth for the demo

### New governed target lineage
`Road LTL 1.5 → Operational Knowledge → Certified Recursive Decomposition (P6.1) → Canonical WorkDefinition compiler proven (P6.2), persistence pending → Client Binding / Runtime Projection not yet complete`

Verified maturity that may be stated:
- P6.1 is certified in protected persistence: 22 tasks / 603 work units / 444 terminal leaves.
- Terminal classification: 185 `EXECUTOR_READY`, 163 `BLOCKED_BY_CLIENT_BINDING`, 96 `BLOCKED_BY_KNOWLEDGE_GAP`.
- P6.2 frozen canonical WorkDefinition contract and compiler/verifier/API/migration/tests/CI exist; offline compiler certification passes.
- Canonical WorkDefinitions have not yet been governed/persisted under P6.2; do not display the 185 as persisted WDs.
- Client Binding and a verified new-lineage Malkom runtime projection remain incomplete/not proven.

### Proven Malkom execution-reference lineage
`Road LTL 1.2 → Domain Warehouse 2.3 → Malkom 3.0 projection`

This remains the verified runtime/projection proof for the Monday/Tuesday demonstration unless D2.0.0 finds stronger governed evidence.

## Why both lineages are shown
The older lineage was built specifically to prove Malkom 3.0. That proof exposed the need for Operational Knowledge, stronger governance and technology-neutral canonical semantics. The newer lineage generalizes Atlas upstream of runtime execution. Subsequent recovery showed that the newer lineage is farther advanced than previously believed: recursive decomposition is already certified and the canonical WD compiler is technically proven. What is still missing is the governed downstream seam from canonical WD through Client Binding/runtime projection to Malkom.

Therefore the demo must neither understate the new lineage nor falsely connect it to the old Malkom projection.

## Demo-stage interpretation correction

### D2.0.0
In addition to existing baseline checks, verify exact P6.1/P6.2 artifacts/hashes/status and record them in the demo baseline. Confirm there is no governed persisted P6.2 WD set or new-lineage Malkom projection before making that claim.

### D2.0.1
Atlas scope/future page should show the target chain with truthful maturity markers: decomposition certified; canonical WD compiler proven/persistence pending; Client Binding/runtime projection incomplete. It may show the older Malkom lineage separately as a proven reference implementation.

### D2.0.2
Road LTL domain surface may expose verified new-lineage decomposition/readiness facts. Ocean remains a demo candidate and must fail closed where equivalent depth is absent.

### D2.0.3
Do not describe this stage simply as if all Road LTL execution depth comes from the old lineage. Present two clearly separated views where useful:
1. target-lineage execution-depth evidence: Road LTL 1.5 + OK + certified P6.1 decomposition + P6.2 compiler-ready state;
2. proven runtime-reference depth: Road LTL 1.2 + Domain Warehouse 2.3 artifacts used for the Malkom proof.
Do not silently map one to the other.

### D2.0.4
Malkom integration continues to use the verified old/reference projection unless a real governed new-lineage Client Binding + adapter/projection is discovered and separately validated. Label it `Reference implementation / proven adapter pattern`.

### D2.0.5
The protected governance/readiness view may show the real P6.1 blocker distribution. It must distinguish `EXECUTOR_READY` terminal leaves from persisted canonical WorkDefinitions. No fake completeness percentage.

### D2.0.6
Regression/certification must specifically test for false lineage claims, including any UI copy implying that Road LTL 1.5/P6.2 produced the existing Malkom projection.

### D2.0.7
GitHub-only merge rule unchanged. No Vercel deployment authorization.

## Architecture and backlog relationship
This demo correction is consistent with AR-D014–AR-D017 working decisions. It does not authorize P6.2 persistence and does not freeze successor architecture. The post-demo production critical path should be re-baselined using separate WD compilation, scope-readiness, runtime-projection and full-domain-coverage gates after Owner review.

## Supersession rule
Where older demo-governance wording says or implies that the Road LTL 1.4/1.5 lineage still lacks recursive decomposition or canonical WD compiler capability, this document supersedes that wording. Older statements remain historical evidence of what was known at the time.

Where older wording says that the existing Malkom projection is not proven to come from Road LTL 1.5/P6.2, that guardrail remains fully valid.
