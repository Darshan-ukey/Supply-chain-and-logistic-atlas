# Atlas V2 Demo Build Protocol

Status: OWNER_AUTHORIZED_STANDING_PROTOCOL  
Effective: 11 September 2026  
Demo target: Monday 14 September 2026  
Stakeholder demo: Tuesday 15 September 2026  
Primary executor: ChatGPT  
Hot-backup executor: Claude

## 1. Purpose
Deliver a demo-ready functional Atlas 2.0 vertical slice without sacrificing recoverability, architecture integrity or auditability.

The demo track is intentionally separate from the full production-certification path. `ATLAS_V2_DEMO_GO_LIVE` is not equivalent to the governed `ATLAS_V2_GO_LIVE` production gate.

## 2. Executor model
- ChatGPT is the primary build executor for the demo sprint.
- Claude is the standing hot-backup executor.
- Claude may resume the exact current demo stage when ChatGPT is unavailable, fails, or the Owner explicitly directs takeover.
- Claude must read the current machine queue, this protocol and `ATLAS_V2_DEMO_HANDOVER.md` before any action.
- Claude may continue the current authorized demo stage from the last recorded safe-resume point; it may not self-advance to the next stage, reopen architecture decisions, or change scope.
- Every material ChatGPT update must be reflected in the handover/log so Claude never needs chat history to reconstruct the state.

## 3. Small-stage build rule
No monolithic build is allowed. The demo is built in short, independently auditable stages. Only one demo stage is active at a time.

Each stage must follow:
1. PRE_BUILD_AUDIT
2. explicit stage scope + acceptance tests
3. build in small atomic slices
4. MID_BUILD_AUDIT after each meaningful slice and before widening scope
5. POST_BUILD_AUDIT
6. integration/regression check
7. full-state freeze
8. handover update
9. only then authorize the next stage

A failed audit stops the stage. Fix the current stage before continuing.

## 4. No delta-only certification
A stage is never accepted merely because its changed files work.

Every post-build audit must validate the resulting complete application state against:
- frozen architecture boundaries;
- existing Page 0 / Canvas behavior that must remain intact;
- admin/public access boundary;
- data/source lineage;
- cross-feature navigation;
- runtime/build health;
- current demo critical path.

The acceptance artifact must reference the complete repository commit, not only the delta.

## 5. Full-state freeze rule
After every PASS stage:
- record the exact repository commit SHA as the complete immutable stage state;
- create a stage freeze ref/branch when practical (for example `atlas-v2-demo-freeze-d2-0-1`);
- write/update a frozen-state manifest identifying complete repository SHA, active source assets, tests, known limitations and next stage;
- never rewrite an earlier stage freeze point;
- downstream stages branch from the latest certified full-state freeze, not from transient local/chat state.

`frozen` means immutable historical full state. New work creates a newer freeze point; it does not overwrite prior frozen evidence.

## 6. Handover durability
`governance/demo-sprint/ATLAS_V2_DEMO_HANDOVER.md` is the human-readable hot-backup state.
`governance/demo-sprint/ATLAS_V2_DEMO_BUILD_LOG.md` is the append-only activity narrative.
The machine queue is the authorization state.

The handover must always contain:
- current stage and status;
- current working branch;
- starting full-state SHA;
- latest verified commit SHA;
- last safe-resume point;
- exact work completed;
- exact work in progress;
- files/components touched;
- tests/audits run and results;
- unresolved defects/blockers;
- guardrails relevant to the current stage;
- next exact action;
- backup-takeover permission.

If repository state and handover disagree, the backup executor must stop and reconcile before editing.

## 7. Demo scope guardrails
The Monday demo vertical slice may assume, for demo purposes and only where governed assets support it:
- Ocean FCL/LCL 0.6 is available as a live domain/daughter surface;
- Road LTL is the execution-depth reference domain;
- Road LTL work decomposition / WorkDefinition capability is the primary execution-readiness proof;
- Malkom is the first demonstrated downstream adapter/projection;
- a new Atlas scope/future page explains domain knowledge -> execution readiness -> adapters/downstream tools.

Do not claim:
- full Atlas 2.0 production certification;
- Ocean execution-depth parity with Road LTL unless actually built/verified;
- autonomous solution generation;
- Atlas runtime execution;
- full ERP implementation readiness;
- closure of known Road LTL/BOL knowledge gaps when unresolved.

## 8. Architecture boundary
Atlas remains the governed enterprise/domain understanding and specification layer between enterprise reality and downstream tools.

Canonical business semantics remain technology-neutral. Runtime queues, subqueues, agent nodes, BPMN implementation nodes, credentials and platform-specific implementation remain downstream projections/bindings unless an Owner-approved successor architecture explicitly changes this boundary.

The AR0 architecture-refinement program remains preserved. Demo implementation must not silently resolve or overwrite open AR0 decisions.

## 9. Demo build stages
### D2.0.0 — Baseline, handover and release-control setup
Audit current repository/live deployment, establish exact demo baseline, create working/freeze strategy, verify recoverability. No feature build.

### D2.0.1 — Atlas shell + scope/future page
Add the stakeholder-facing `Domain Knowledge -> Execution Readiness -> Adapters` page without breaking current Atlas navigation or protected/public boundaries.

### D2.0.2 — Ocean 0.6 live surface
Expose/verify Ocean FCL/LCL 0.6 in the demo navigation/canvas using governed existing assets. Do not invent execution depth.

### D2.0.3 — Road LTL execution-depth explorer
Expose Road LTL operational knowledge, recursive work decomposition and canonical WorkDefinition in a coherent inspectable path.

### D2.0.4 — Malkom adapter/projection
Demonstrate canonical Atlas semantics projected to Malkom-specific execution structures while preserving the canonical/runtime boundary.

### D2.0.5 — Trace + readiness + demo narrative integration
Add the minimum coherent traceability/readiness surfaces and wire the hero demo journey end-to-end.

### D2.0.6 — Full integration and regression certification
Run full-state UI/data/security/build/deployment audit; resolve defects; freeze release candidate.

### D2.0.7 — Controlled demo promotion
Promote one deliberate tested demo release to the intended live URL and verify it after deployment. This is `ATLAS_V2_DEMO_GO_LIVE`, not full production certification.

## 10. Release discipline
- GitHub is canonical.
- Do not edit production directly in Vercel.
- Use a dedicated demo build branch and controlled Vercel previews.
- Avoid uncontrolled deployment fan-out from governance-only commits where possible.
- Promote only a tested release candidate.
- Preserve the prior live release for rollback.

## 11. Stop conditions
Stop and report rather than improvise when:
- a required governed asset is missing;
- an assumption would fabricate domain/client knowledge;
- the current full-state baseline cannot be reproduced;
- a change would mutate a historical frozen asset;
- public/protected data boundaries cannot be preserved;
- the demo requirement conflicts with an unresolved architecture decision in a way that changes canonical meaning.
