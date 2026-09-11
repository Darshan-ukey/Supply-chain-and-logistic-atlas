# Atlas V2 — Governed Roadmap and Critical Paths

Status: ACTIVE BACKLOG / DEMO SPRINT PRIORITY / ARCHITECTURE REFINEMENT PRESERVED  
Updated: 11 September 2026  
Canonical machine queue: `governance/backlog/ATLAS_V2_AGENT_EXECUTION_QUEUE.json` on `atlas-governance-registry-v2.1`.

# Immediate priority — Atlas V2 Demo Sprint

Owner target: **demo-ready functional Atlas 2.0 concept live Monday 14 September 2026** for stakeholder demonstration Tuesday 15 September 2026.

This is a distinct release track:
- `ATLAS_V2_DEMO_GO_LIVE` = functional concept/demo promotion.
- `ATLAS_V2_GO_LIVE` = full governed production promotion after architecture/recovery/P6 certification.

Primary demo executor: ChatGPT.  
Hot backup: Claude, authorized to resume the exact current demo stage if ChatGPT is unavailable/fails or the Owner directs takeover.

Governing demo files:
- `governance/demo-sprint/ATLAS_V2_DEMO_BUILD_PROTOCOL.md`
- `governance/demo-sprint/ATLAS_V2_DEMO_HANDOVER.md`
- `governance/demo-sprint/ATLAS_V2_DEMO_BUILD_LOG.md`

## Mandatory demo build discipline
Every build stage requires PRE_BUILD_AUDIT, MID_BUILD_AUDIT, POST_BUILD_AUDIT, full integration/regression review and a complete immutable repository freeze point. Delta-only certification is invalid. Prior freeze points are never overwritten.

## D2.0.0 — Baseline, handover and release-control setup
Status: **AUTHORIZED — CURRENT**

Audit the complete current repo/app/deployment state, verify required source assets and establish working branch, rollback/freeze strategy and hot-backup state. No feature mutation.

## D2.0.1 — Atlas shell + scope/future page
Status: BLOCKED_UNTIL_D2_0_0_PASS

Add `Atlas — From Domain Knowledge to Execution Readiness`, preserving existing navigation and public/protected boundaries.

## D2.0.2 — Ocean 0.6 live surface
Status: BLOCKED_UNTIL_D2_0_1_PASS

Expose/verify Ocean FCL/LCL 0.6 from existing assets under the Owner-authorized demo assumption. Do not imply Road-LTL-equivalent execution depth unless verified.

## D2.0.3 — Road LTL execution-depth explorer
Status: BLOCKED_UNTIL_D2_0_2_PASS

Expose Road LTL Operational Knowledge -> Work Decomposition -> Canonical WorkDefinition as a coherent inspectable path.

## D2.0.4 — Malkom adapter/projection
Status: BLOCKED_UNTIL_D2_0_3_PASS

Demonstrate canonical Atlas semantics projected to Malkom-specific structures while preserving the canonical/runtime boundary.

## D2.0.5 — Trace + readiness + demo narrative integration
Status: BLOCKED_UNTIL_D2_0_4_PASS

Wire the minimum coherent traceability/readiness/gap surfaces and the end-to-end stakeholder demo journey.

## D2.0.6 — Full integration and regression certification
Status: BLOCKED_UNTIL_D2_0_5_PASS

Audit complete resulting app across UI, data, architecture, access boundary, build and deployment parity. Resolve defects and freeze release candidate.

## D2.0.7 — Controlled demo promotion
Status: BLOCKED_UNTIL_D2_0_6_PASS / OWNER APPROVAL REQUIRED

Perform one deliberate tested promotion and live verification with rollback preserved.

## ATLAS_V2_DEMO_GO_LIVE
Status: BLOCKED_UNTIL_D2_0_7

Functional-concept/demo release only; not full production certification.

# Preserved architecture/recovery state

- R0.1A-R / R0.1B / R0.1C: COMPLETE — QA PASS.
- R0.2: COMPLETE — QA PASS. Effective Road LTL 1.5 remains 21 inherited 1.4 + direct LTL-03 1.5 override; P6.0 remains 502/502.
- R0.3: COMPLETE — QA PASS.
- AR0.1: COMPLETE; PR #9 merged at `206db2b54f40140cc372c4f70bd314934abc489e`.
- AR0.2: candidate complete / Owner review pending in PR #10; temporarily not current during demo sprint.
- AR0.3–AR0.6: blocked by preceding architecture gates.
- R0.4: suspended by architecture-refinement gate.
- R0.5/R0.6 and P6.2–P6.5 remain blocked/suspended per machine queue.
- Full production `CURRENT/LATEST` pointers remain unchanged.

The demo sprint may not silently approve, reject or rewrite AR0.2, and may not close production recovery/certification gates by presentation assumption.

# Platform North Star

> **Atlas is the governed intelligence and specification layer between enterprise/client operations and the technologies used to transform or execute them.**

> **Atlas owns understanding and specification. Downstream platforms own execution.**

Atlas may support domain knowledge, governance, execution/implementation readiness, design assistance and target-tool projections. Malkom, agent/workflow engines, SAP/ERP, TMS/WMS, ServiceNow, RPA, BPM/digital-twin platforms and custom applications remain downstream execution/implementation consumers.

# Critical paths

Demo path:
`D2.0.0 -> D2.0.1 -> D2.0.2 -> D2.0.3 -> D2.0.4 -> D2.0.5 -> D2.0.6 -> D2.0.7 -> ATLAS_V2_DEMO_GO_LIVE`

Full production path after demo:
`AR0.2 Owner review -> AR0.3 -> AR0.4 -> AR0.5 -> AR0.6 Owner freeze -> R0.4 -> R0.5 -> R0.6 -> P6.2 -> P6.3 -> P6.4 -> P6.5 -> ATLAS_V2_GO_LIVE`

# Completeness standard
Every applicable stage remains subject to PHYSICAL_EXISTENCE, SEMANTICS, COVERAGE, EVIDENCE, DEPENDENCY_CLOSURE, REPRODUCIBILITY, REFERENTIAL_INTEGRITY, LIVE_READABILITY, REGISTRY_COHERENCE, CLASSIFICATION_ACCURACY, SECURITY_BOUNDARY, REGRESSION and DEPLOYMENT_PARITY.

# Source-of-truth hierarchy during demo sprint
1. Frozen architecture/contracts.
2. Owner-authorized demo protocol + machine queue + handover.
3. Architecture-refinement backlog/decision ledger.
4. Recovery/custody standards.
5. This human-readable roadmap.
6. GitHub implementation/evidence.
7. Drive durable governed evidence.

If sources conflict, stop and report the conflict.
