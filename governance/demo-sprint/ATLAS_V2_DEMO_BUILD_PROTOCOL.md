# Atlas V2 Demo Build Protocol

Status: OWNER_AUTHORIZED_STANDING_PROTOCOL  
Effective: 12 September 2026  
Demo target: Monday 14 September 2026  
Stakeholder demo: Tuesday 15 September 2026  
Primary executor: ChatGPT  
Hot-backup executor: Claude

## 1. Purpose
Deliver a demo-ready functional Atlas 2.0 **hybrid proof of concept** without sacrificing recoverability, architecture integrity or auditability.

The demo track is intentionally separate from the full production-certification path. `ATLAS_V2_DEMO_GO_LIVE` is not equivalent to the governed `ATLAS_V2_GO_LIVE` production gate.

The Monday objective is not 100% architectural completeness. It is a credible representative proof that Atlas domain intelligence can be exposed through a modern Atlas surface and projected into Malkom 3.0 using verified existing execution artifacts, while the newer governed tool-agnostic lineage remains visibly distinct.

## 2. Executor model
- ChatGPT is the primary build executor for the demo sprint.
- Claude is the standing hot-backup executor.
- Claude may resume the exact current demo stage when ChatGPT is unavailable, fails, or the Owner explicitly directs takeover.
- Both executors must read the current machine queue, this protocol, `ATLAS_V2_DEMO_HANDOVER.md`, and `../../claude_chatGPT.md` / repository-root `claude_chatGPT.md` before action.
- Both executors must write material findings/actions into `claude_chatGPT.md` so the Owner does not have to relay findings manually.
- Claude may continue the current authorized demo stage from the last recorded safe-resume point; it may not self-advance to the next stage, reopen architecture decisions, or change scope.

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
8. handover/shared-log update
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
- create a stage freeze ref/branch when practical;
- write/update a frozen-state manifest identifying complete repository SHA, active source assets, tests, known limitations and next stage;
- never rewrite an earlier stage freeze point;
- downstream stages branch from the latest certified full-state freeze, not from transient local/chat state.

`frozen` means immutable historical full state. New work creates a newer freeze point; it does not overwrite prior frozen evidence.

## 6. Handover durability
`governance/demo-sprint/ATLAS_V2_DEMO_HANDOVER.md` is the human-readable hot-backup state.  
`governance/demo-sprint/ATLAS_V2_DEMO_BUILD_LOG.md` is the activity narrative.  
`claude_chatGPT.md` is the shared ChatGPT↔Claude findings/coordination log.  
The machine queue is the authorization state.

If repository state and these records disagree, the backup executor must stop and reconcile before editing.

## 7. Hybrid demo strategy
The selected Monday strategy is:

`HYBRID_REUSE_PROVEN_EXECUTION_LINEAGE_WITH_ADDITIVE_ATLAS_V2_SURFACE`

Use two clearly distinguished layers:

### A. Proven reference execution proof
`Road LTL V1.2 → Domain Warehouse v2.3 → Malkom 3.0 projection`

Use only after D2.0.0 verifies the actual assets, counts, scripts, lineage and known gaps.

### B. New governed Atlas direction
`Sources → Universe → Daughter Domain → Operational Knowledge → Recursive Work Decomposition → Canonical WorkDefinition → Client Binding → Execution Readiness → Adapters`

This is the tool-agnostic target architecture and must not be falsely represented as already compiling the existing Malkom proof.

### Mandatory hybrid guardrails
- Do not claim Road LTL v1.4/v1.5/R0.3 generates the current Malkom projection unless a real validated bridge exists.
- Do not silently merge the V1.2/v2.3 and V1.4/v1.5 schemas/lineages.
- Do not build a full compiler bridge merely for Monday.
- Do not hand-author LTL-03 into the reference proof lineage without explicit Owner sub-authorization.
- Malkom remains the first downstream consumer, not canonical Atlas truth.
- Governance/readiness exists as a secondary view; it is not the primary five-minute narrative.
- The 60–70% POC target means representative workable execution depth, not a fabricated numeric completeness score.

## 8. Architecture boundary
Atlas remains the governed enterprise/domain understanding and specification layer between enterprise reality and downstream tools.

Canonical business semantics remain technology-neutral. Runtime queues, subqueues, agent nodes, BPMN implementation nodes, credentials and platform-specific implementation remain downstream projections/bindings unless an Owner-approved successor architecture explicitly changes this boundary.

The AR0 architecture-refinement program remains preserved. Demo implementation must not silently resolve or overwrite open AR0 decisions.

## 9. Demo build stages — REBASED 12 SEP 2026

### D2.0.0 — Baseline seam verification + hybrid release freeze
No feature mutation.

Must verify:
1. exact Road LTL version/data/hash served by the current live Vercel app;
2. authoritative Canvas V2 asset and whether/where it was previously deployed;
3. actual V1.2 → Domain Warehouse v2.3 → Malkom artifacts, definition/task counts, scripts and known gaps;
4. additive compatibility between Canvas V2 components and the live product;
5. Universe, Road LTL, Ocean and Ask Atlas version/naming facts;
6. complete pre-change repository freeze point.

### D2.0.1 — Additive Canvas V2 shell + Atlas scope/future page
Reuse verified Canvas V2 presentation components additively without redefining canonical data semantics.

Add stakeholder page:
**Atlas — From Domain Knowledge to Execution Readiness**

Show:
`Universe → Daughter Domain → Operational Knowledge → Work Decomposition → WorkDefinition → Client Binding → Execution Readiness → Adapters / Downstream Tools`

Do not claim this entire successor path is already end-to-end compiled.

### D2.0.2 — Road LTL + Ocean demo domain surfaces
Expose verified Road LTL domain navigation plus Owner-authorized Ocean 0.6 demo surface.

Correctly distinguish production/reference/candidate/demo states. Fail closed where execution depth is unavailable.

### D2.0.3 — Proven Road LTL execution-depth integration
Integrate the verified existing V1.2 / Domain Warehouse v2.3 reference WorkDefinition depth into the additive demo surface.

Use representative patterns rather than manufacturing full completion. Label lineage accurately. Do not relabel this as v1.5 output.

### D2.0.4 — Malkom 3.0 adapter/projection integration
Wire and demonstrate the verified existing Malkom adapter/projection from the proven reference lineage.

Demonstrate Atlas → Malkom projection while preserving the canonical/runtime boundary. Known adapter losses/gaps remain visible in evidence, not silently filled.

### D2.0.5 — Representative POC journey + secondary governance/readiness view
Wire the five-minute stakeholder journey end-to-end.

Primary journey:
`Atlas → Road LTL → representative work/execution depth → Malkom projection → larger Atlas scope/future`

Secondary protected/admin capability:
- provenance;
- gaps;
- version state;
- Operational Knowledge/readiness evidence;
- accurate lineage/trace.

Do not lead with raw recovery metrics unless useful/asked.

### D2.0.6 — Hybrid demo full integration, regression + deployment parity certification
Run complete UI/data/security/navigation/runtime/deployment audit.

Verify:
- public/admin boundary;
- no stale/false version labels;
- no fabricated cross-lineage claims;
- live readability;
- deployment parity;
- rollback readiness.

Create the full post-build immutable release-candidate freeze point.

### D2.0.7 — Controlled Monday demo promotion
With Owner approval, promote exactly one tested demo release to the intended live runtime and verify after deployment.

This is `ATLAS_V2_DEMO_GO_LIVE`, not full Atlas V2 production certification.

## 10. Release discipline
- GitHub is canonical.
- Do not edit production directly in Vercel.
- Use a dedicated demo build branch and controlled Vercel previews.
- Avoid uncontrolled deployment fan-out from governance-only commits where possible.
- Promote only a tested release candidate.
- Preserve the prior live release for rollback.

## 11. Stop conditions
Stop and report rather than improvise when:
- a required governed/reference asset is missing;
- lineage cannot be proven;
- an assumption would fabricate domain/client knowledge;
- the current full-state baseline cannot be reproduced;
- a change would mutate a historical frozen asset;
- public/protected data boundaries cannot be preserved;
- a change would falsely imply the new governed lineage already drives the old Malkom proof;
- the demo requirement conflicts with an unresolved architecture decision in a way that changes canonical meaning.
