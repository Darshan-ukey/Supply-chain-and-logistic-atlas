# Atlas V2 Demo Build Protocol

Status: OWNER_AUTHORIZED_STANDING_PROTOCOL  
Effective: 12 September 2026  
Demo target: Monday 14 September 2026  
Stakeholder demo: Tuesday 15 September 2026  
Primary executor: ChatGPT  
Hot-backup executor: Claude

## 1. Purpose
Deliver a demo-ready functional Atlas 2.0 **hybrid proof of concept** without sacrificing recoverability, architecture integrity or auditability.

The Monday objective is not full Atlas V2 production certification. It is a credible representative proof that Atlas domain intelligence can be exposed through a modern Atlas surface and projected into Malkom 3.0 using verified existing execution artifacts while the newer governed tool-agnostic lineage remains distinct.

## 2. Mandatory release policy
Read and obey `governance/demo-sprint/ATLAS_GITHUB_ONLY_DEMO_RELEASE_POLICY.md`.

Current standing rule:
- **No Vercel deployment, preview, promotion or live change is authorized.**
- Vercel is read-only for forensic inventory/audit.
- Demo feature implementation occurs only on `atlas-v2-demo-2026-09-14`.
- `atlas-v2-demo-2026-09-14` was created from `main` and is the sole authorized demo implementation branch unless the Owner changes this rule.
- Tomorrow, after full audit/certification and Owner approval, the certified demo branch may be merged to `main`.
- Merge to `main` does **not** authorize Vercel deployment.
- If Git integration would automatically deploy a branch or `main` merge, STOP before the action that would create a live effect and report it.

## 3. Executor model
- ChatGPT is the primary build executor.
- Claude is standing hot backup.
- Claude may resume the exact current demo stage only when ChatGPT is unavailable/fails or the Owner directs takeover.
- Both executors must read the machine queue, this protocol, `ATLAS_V2_DEMO_HANDOVER.md`, repository-root `claude_chatGPT.md`, `ATLAS_CURRENT_DEMO_TARGET_STATE_MAP.md`, and the GitHub-only release policy before action.
- Both executors must record material findings/actions in `claude_chatGPT.md`.
- Neither executor may self-advance a blocked stage or reopen architecture decisions.

## 4. Small-stage build rule
No monolithic build. Only one demo stage active at a time.

Each stage must follow:
1. PRE_BUILD_AUDIT
2. explicit scope + acceptance tests
3. small atomic build slices
4. MID_BUILD_AUDIT after meaningful slices
5. POST_BUILD_AUDIT
6. integration/regression check
7. complete GitHub-state freeze
8. handover/shared-log update
9. next-stage authorization

A failed audit stops the stage.

## 5. No delta-only certification
A stage is not accepted merely because changed files work. Validate the complete resulting repository state against architecture boundaries, Page 0/Canvas preservation, public/admin boundary, data/source lineage, navigation, build health and current demo critical path.

The acceptance artifact must reference the complete repository commit SHA.

## 6. Full-state freeze rule
After each PASS stage:
- record exact complete repository commit SHA;
- create a stage freeze ref/branch when practical;
- record active source assets, tests, limitations and next stage;
- never rewrite earlier freeze points;
- downstream stages build from the latest certified full state.

## 7. Three-branch operating model
- `atlas-governance-registry-v2.1` = governance and authorization state.
- `atlas-v2-demo-2026-09-14` = active demo implementation branch.
- `main` = integration destination after Owner-approved D2.0.7 merge.

Historical/recovery/architecture/presentation branches remain reference assets. Reuse from them must be traceable and deliberate.

The repository currently contains many branches. Do not select another branch merely because it appears newer. D2.0.0 must verify any asset before importing it.

## 8. Hybrid demo strategy
Selected strategy:
`HYBRID_REUSE_PROVEN_EXECUTION_LINEAGE_WITH_ADDITIVE_ATLAS_V2_SURFACE`

### Proven reference execution proof
`Road LTL V1.2 → Domain Warehouse v2.3 → Malkom 3.0 projection`

Use only after D2.0.0 verifies actual assets, lineage, scripts and known gaps.

### New governed Atlas direction
`Sources → Universe → Daughter Domain → Operational Knowledge → Recursive Work Decomposition → Canonical WorkDefinition → Client Binding → Execution Readiness → Adapters`

This target direction must not be falsely represented as already compiling the existing Malkom proof.

Mandatory guardrails:
- no claim that v1.4/v1.5/R0.3 generates the existing Malkom projection unless a validated bridge exists;
- no silent schema/lineage merge;
- no full compiler bridge merely for Monday;
- no hand-authored LTL-03 without explicit Owner sub-authorization;
- Malkom is first downstream consumer, not canonical Atlas truth;
- governance/readiness is secondary to the five-minute POC narrative;
- 60–70% means representative workable execution depth, not a numeric completeness claim.

## 9. Demo stages — GitHub-only release model

### D2.0.0 — Baseline seam verification + branch/freeze setup
No feature mutation.

Must verify:
1. exact Road LTL version/data/hash associated with the protected foundation and relevant repository state;
2. authoritative Canvas V2 asset and deployment/history provenance;
3. actual V1.2 → Domain Warehouse v2.3 → Malkom assets, counts, scripts and gaps;
4. additive compatibility with the foundation/current codebase;
5. Universe/Road LTL/Ocean/Ask Atlas version facts;
6. GitHub branch inventory and reuse provenance;
7. `atlas-v2-demo-2026-09-14` exists from `main` and is the active implementation branch;
8. complete pre-change repository freeze point;
9. no action in this stage triggers Vercel deployment.

### D2.0.1 — Additive Canvas V2 shell + Atlas scope/future page
Build only on `atlas-v2-demo-2026-09-14`.

Reuse verified Canvas V2 presentation components additively. Add **Atlas — From Domain Knowledge to Execution Readiness**. Do not redefine canonical data semantics or claim the successor path is already end-to-end compiled.

### D2.0.2 — Road LTL + Ocean demo domain surfaces
Expose verified Road LTL domain navigation and Owner-authorized Ocean 0.6 demo candidate surface with accurate status labels. Fail closed where depth is unavailable.

### D2.0.3 — Proven Road LTL execution-depth integration
Integrate verified existing V1.2 / Domain Warehouse v2.3 reference WorkDefinition depth. Use representative patterns; preserve lineage; do not relabel as v1.5 output.

### D2.0.4 — Malkom 3.0 adapter/projection integration
Wire the verified existing Malkom projection from the proven reference lineage. Known adapter losses/gaps remain documented.

### D2.0.5 — Representative POC journey + secondary governance/readiness view
Primary journey:
`Atlas → Road LTL → representative execution depth → Malkom projection → larger Atlas scope/future`

Secondary protected/admin evidence may show provenance, gaps, version state, Operational Knowledge/readiness evidence and trace.

### D2.0.6 — GitHub full integration/regression certification
No deployment parity or Vercel promotion.

Verify the complete demo branch:
- full UI/data/navigation integrity;
- public/admin boundary;
- no stale/false version labels;
- no fabricated cross-lineage claims;
- build/repository reproducibility;
- branch provenance;
- merge readiness against `main`;
- rollback/freeze readiness.

Create immutable release-candidate freeze **in GitHub only**.

### D2.0.7 — Owner-approved merge to main
With explicit Owner approval:
- compare certified demo branch with `main`;
- merge only the certified D2.0.6 state to `main`;
- verify repository integrity after merge;
- record merge SHA and freeze.

**Do not deploy to Vercel.** D2.0.7 ends at GitHub `main`.

### Post-D2.0.7 live deployment
Not authorized under the current sprint. Any future update to `supplychainatlas.vercel.app` requires separate Owner authorization after Vercel project/domain and auto-deployment behavior are understood.

## 10. Vercel estate rule
`supplychainatlas.vercel.app` is the Owner-designated Aug 23/25 foundation and eventual live upgrade target.

Other Atlas Vercel projects/deployments are unclassified pending forensic review for unique data/code, duplicates, recoverability and safe deletion. No Vercel deletion is authorized during this demo build.

## 11. Stop conditions
Stop and report rather than improvise when:
- required asset/lineage cannot be proven;
- a change would fabricate domain/client knowledge;
- a historical frozen asset would be mutated;
- public/protected boundaries cannot be preserved;
- implementation would falsely imply the new governed lineage drives the old Malkom proof;
- an unresolved architecture decision would be silently closed;
- any GitHub action is expected to trigger an unauthorized Vercel deployment or live-site change.
