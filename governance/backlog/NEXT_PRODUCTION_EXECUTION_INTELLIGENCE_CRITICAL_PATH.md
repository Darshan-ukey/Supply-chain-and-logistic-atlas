# Atlas V2 — Governed Execution Roadmap and Production Critical Path

Status: ACTIVE BACKLOG / MACHINE-ACTIONABLE ROADMAP  
Updated: 8 September 2026  
Canonical technical backlog: this GitHub file + `ATLAS_V2_AGENT_EXECUTION_QUEUE.json` on branch `atlas-governance-registry-v2.1`.

## Operating rule

This roadmap is the standing implementation sequence for Atlas V2. An implementation agent must read the machine queue before beginning or selecting work. Chat instructions may refine an already-authorized phase, but must not silently replace this roadmap.

Only a phase whose queue status is `AUTHORIZED` may be implemented. A completed implementation stops at `AWAITING_INDEPENDENT_QA`; the agent must not self-authorize the next phase. The owner / independent QA gate advances the queue.

Frozen architecture and governed source conflicts always outrank implementation convenience.

## Current governed baseline

- Supply Chain Universe 7.3 — governed frozen baseline/reference.
- Road LTL 1.5 — current frozen execution-reference candidate.
- Road LTL 1.5 Operational Knowledge / OKv2 — frozen operational reference.
- Ocean FCL 0.6 — governed go-live candidate; 30/30 A5 PUBLIC_SAFE materialized through the universal renderer.
- Ocean LCL 0.6 — governed go-live candidate; 30/30 A5 PUBLIC_SAFE materialized through the universal renderer.
- Canvas 2.0.0 / Canvas V2.0.1 integration baseline — frozen visual shell; no redesign authorized.
- Universal Daughter Renderer V2 — frozen implementation baseline.
- P6.1 Road LTL 1.5 Recursive Work Decomposition — COMPLETE/PASS: 22 A5 tasks, 603 work units, 444 terminal leaves.
- P6.1 decomposition generation implementation is not retained in GitHub; certified output is governed/hash-anchored. Reproducibility is tracked as explicit debt below.

## Atlas V2 implementation sequence

### P6.2 — Canonical WorkDefinition Compilation — Road LTL 1.5
Status: AUTHORIZED / IN IMPLEMENTATION

Objective:
Compile executor-neutral Canonical WorkDefinitions from the certified P6.1 Road LTL 1.5 decomposition.

Required boundaries:
- target exact `road-ltl@1.5`;
- preserve per-task 1.4 inheritance and direct 1.5 LTL-03 lineage;
- no 1.4 runtime fallback;
- persist canonical definitions in protected Atlas backend storage;
- no Malkom/runtime-specific structures inside canonical WorkDefinition;
- blocked leaves remain blocked; do not fabricate executability;
- no Canvas, Daughter, Ocean, Client Binding or runtime redesign.

Exit gate:
- deterministic compiler + verifier;
- protected persistence/API and non-reconstructive PUBLIC_SAFE status;
- full inherited regression chain passes;
- implementation report + commit/evidence returned;
- phase stops at independent QA.

### P6.3 — Identity, Authorization & Public/Protected Certification
Status: BLOCKED_UNTIL_P6_2_QA

Objective:
Make the existing Supabase-auth/capability architecture operational and certify the real public/admin boundary.

Deliverables:
- provision at least one real Atlas admin identity through Supabase Auth;
- configure governed admin/capability assignment (`ATLAS_ADMIN_EMAILS` and/or app metadata / capability records);
- verify login, HttpOnly session, refresh/session expiry and logout;
- certify anonymous PUBLIC_SAFE access;
- certify authenticated protected access for Operational Knowledge, provenance, Work Decomposition and WorkDefinition according to capability;
- certify 401/403/fail-closed behavior;
- verify protected execution knowledge cannot leak through Canvas, Daughter, Ask Atlas or direct API discovery.

Exit gate:
- end-to-end user login works in deployed environment;
- public user cannot retrieve protected payloads even with direct endpoint knowledge;
- authorized admin can retrieve only capability-approved protected payloads;
- security regression evidence captured.

### P6.4 — Generic Recursive Decomposition Compiler + Ocean 0.6 Execution Depth
Status: BLOCKED_UNTIL_P6_3_QA

Objective:
Close P6.1 reproducibility debt and prove Atlas can take new governed modules through the same generic execution-depth pipeline.

Deliverables:
- recover or implement a deterministic, module-neutral Recursive Work Decomposition compiler conforming to the frozen decomposition contract and executability standard;
- prove it reproduces/certifies Road LTL 1.5 semantics without changing the governed P6.1 baseline;
- run Ocean FCL 0.6 (30 A5 tasks) through recursive decomposition;
- run Ocean LCL 0.6 (30 A5 tasks) through recursive decomposition;
- preserve source/module/Operational Knowledge lineage, blockers, exceptions, controls and executability state;
- compile Ocean Canonical WorkDefinitions through the already-certified generic P6.2 WorkDefinition compiler;
- do not manually author Ocean WorkDefinitions and do not introduce Ocean-specific logic into generic compilers/renderers.

Exit gate:
- Road LTL, Ocean FCL and Ocean LCL all traverse governed Operational Knowledge → Work Decomposition → Canonical WorkDefinition through reusable contracts;
- zero hidden fallback to older Ocean/LTL versions;
- structural/verifier gates pass for each module;
- independent QA approves execution-depth parity.

### P6.5 — Atlas V2 Integration & Production Certification
Status: BLOCKED_UNTIL_P6_4_QA

Objective:
Certify the integrated Atlas V2 product and production deployment.

Integrated product scope:
- Page 0 / Atlas navigation;
- Canvas V2 frozen visual architecture;
- Road LTL 1.5 Daughter;
- Ocean FCL 0.6 Daughter;
- Ocean LCL 0.6 Daughter;
- Overview → Operational Knowledge → Execution Readiness → protected Work Decomposition → protected WorkDefinition;
- Ask Atlas / Trace / Governance boundaries;
- anonymous/public-safe and authenticated/protected behavior.

Deliverables:
- integrate execution-depth status and protected retrieval without Canvas redesign;
- certify exact module/version/task routing and fail-closed behavior;
- run complete regression across P2–P6.4 plus public execution-IP boundaries;
- connect/verify correct Vercel project/account;
- verify deployed branch + commit parity against GitHub;
- production smoke tests for Page 0, LTL, Ocean FCL/LCL, auth, public/admin surfaces and protected APIs;
- update governed release evidence, frozen pointer/register and durable Drive release package where applicable.

Exit gate:
- current live deployment health independently verified;
- correct certified commit is served;
- no protected-data leakage;
- LTL/FCL/LCL all render through universal architecture;
- independent QA marks Atlas V2 production release PASS.

### Atlas V2.0 — GO LIVE
Status: BLOCKED_UNTIL_P6_5_QA

Promotion rule:
No implementation agent may declare production go-live. Promotion requires explicit independent QA / owner authorization after P6.5.

## Explicit technical/governance debt

### DEBT-01 — P6.1 Decomposition Reproducibility
Status: MUST_BE_RESOLVED_IN_P6_4

The certified Road LTL 1.5 P6.1 decomposition exists and is hash-anchored, but the original generator implementation that produced the 603-node graph is not retained in GitHub. P6.2 may consume the certified output; Atlas must not claim scalable module-neutral decomposition capability until P6.4 restores deterministic reproducibility and proves it on Ocean 0.6.

## Deferred post-V2 execution-fabric backlog

The following remain valid but are not blockers for the Canvas + LTL + Ocean Atlas V2 product release unless explicitly promoted into the V2 gate:
- Universal Adapter Contract;
- Malkom Adapter / Domain Warehouse runtime projection;
- runtime compiler/verifier beyond canonical WorkDefinition;
- Client Binding and runtime connectors;
- controlled Malkom end-to-end execution proof;
- governed runtime measurement / feedback loop.

These are downstream execution-fabric phases. They must preserve the frozen boundary:
`Canonical WorkDefinition → Client Binding → Runtime Projection / Adapter → Execution`.

## Source-of-truth hierarchy for roadmap execution

1. Frozen architecture/governance contracts — architectural authority.
2. `governance/backlog/ATLAS_V2_AGENT_EXECUTION_QUEUE.json` — machine-readable current phase authorization.
3. This roadmap — human-readable phase intent, scope and acceptance gates.
4. GitHub implementation/evidence — actual code and technical lineage.
5. Drive — durable frozen release packages, evidence and human-consumable vault copies; not a competing mutable backlog.

If any of these conflict, stop and report the conflict rather than silently selecting the easiest interpretation.
