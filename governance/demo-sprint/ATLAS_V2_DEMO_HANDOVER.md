# Atlas V2 Demo — Hot-Backup Handover

Status: ACTIVE  
Primary executor: ChatGPT  
Backup executor: Claude  
Backup takeover: AUTHORIZED for the exact current demo stage if ChatGPT is unavailable/fails or Owner directs takeover.

## Current program state
- Program: Atlas V2 Hybrid Demo Sprint
- Target: demo-ready functional concept in GitHub by Monday 14 September 2026
- Stakeholder demo: Tuesday 15 September 2026
- Current stage: `D2.0.0 — Baseline seam verification + GitHub branch/freeze setup`
- Stage status: `AUTHORIZED`
- Architecture program: AR0.2 remains preserved at Owner-review gate; do not silently advance or overwrite it during demo sprint.
- `ATLAS_V2_DEMO_GO_LIVE` is **SUSPENDED_BY_OWNER_NO_VERCEL_RULE**.

## Mandatory release rule — 12 Sep 2026
- **No Vercel deployment, preview, promotion, live update or deletion is authorized.**
- Vercel may be read only for forensic audit/inventory.
- Demo implementation branch: `atlas-v2-demo-2026-09-14`.
- Integration destination after certification and explicit Owner approval: `main`.
- A merge to `main` does **not** authorize a Vercel deployment.
- If Git integration would automatically create a Vercel deployment from branch pushes or a `main` merge, STOP before the triggering action and report the risk.
- Standing policy: `governance/demo-sprint/ATLAS_GITHUB_ONLY_DEMO_RELEASE_POLICY.md`.

## Branch model
- `atlas-governance-registry-v2.1` — governance/authorization only.
- `atlas-v2-demo-2026-09-14` — sole authorized demo feature implementation branch.
- `main` — merge destination after D2.0.6 PASS + explicit Owner approval at D2.0.7.
- Other presentation/recovery/architecture/backup branches are reference/history only unless an asset is deliberately imported with lineage.

### Branch inventory finding
A branch inventory on 12 Sep found 35 pre-existing branches before the demo branch creation, including presentation, recovery, architecture, backups and `main`.

During connector verification, an extra empty branch `atlas-v2-demo-2026-09-14-check` was inadvertently created from `main`. It is **UNAUTHORIZED / DO NOT USE / DELETE_LATER**. No work should ever be committed to it. The authorized implementation branch remains only `atlas-v2-demo-2026-09-14`.

## Product/demo state
- Hybrid strategy remains selected: reuse the verified old execution proof where real, wrapped in the additive Atlas V2 demo surface.
- Existing proof lineage to verify: `Road LTL V1.2 → Domain Warehouse v2.3 → Malkom 3.0 projection`.
- New governed target lineage remains separate: `Sources → Universe → Daughter Domain → Operational Knowledge → Work Decomposition → Canonical WorkDefinition → Enterprise/Client Binding → Execution Readiness → Adapters`.
- Do not claim the new v1.4/v1.5/R0.3 lineage currently generates the old Malkom projection.
- Governance/readiness remains secondary to the five-minute stakeholder POC story.

## Vercel foundation / estate rule
- `supplychainatlas.vercel.app` is the Owner-designated Aug 23/25 foundation and eventual live upgrade target.
- Other Atlas-related Vercel projects/deployments remain unclassified pending forensic review for unique code/data, duplicates, recoverability and safe deletion.
- Nothing may be deleted or redeployed during the current demo sprint.

## Current work completed
1. Owner authorized Monday hybrid POC strategy.
2. ChatGPT primary / Claude hot-backup model established.
3. PRE/MID/POST audit and no-delta-only certification rules established.
4. Shared `claude_chatGPT.md` coordination file established.
5. Current/Demo/Target state map created.
6. Vercel estate audit/disposition record created.
7. GitHub-only release policy created.
8. Explicit demo branch `atlas-v2-demo-2026-09-14` created from `main`.
9. Queue rebased to v19: D2.0.7 now means Owner-approved merge to `main`, not live deployment.

## Work in progress
D2.0.0 only. No demo feature implementation has begun under the rebased plan.

## Last safe resume point
If ChatGPT becomes unavailable now, Claude must:
1. read `claude_chatGPT.md`;
2. read `ATLAS_CURRENT_DEMO_TARGET_STATE_MAP.md`;
3. read queue v19;
4. read `ATLAS_GITHUB_ONLY_DEMO_RELEASE_POLICY.md` and the demo build protocol;
5. continue only D2.0.0;
6. do not work on `main`;
7. do not use `atlas-v2-demo-2026-09-14-check`;
8. do not perform any Vercel mutation;
9. do not start D2.0.1 until D2.0.0 PASS and authorization are recorded.

## D2.0.0 remaining exact actions
1. Verify foundation/repository relationship, including exact source state associated with `supplychainatlas.vercel.app` where recoverable.
2. Verify Canvas V2 authoritative asset/history.
3. Verify the V1.2 → Domain Warehouse v2.3 → Malkom proof assets, counts, scripts and known gaps.
4. Verify additive compatibility with foundation/current codebase.
5. Verify Universe/Road LTL/Ocean/Ask Atlas naming/version facts.
6. Audit existing GitHub branches for assets relevant to the demo; do not infer newest = correct.
7. Record `atlas-v2-demo-2026-09-14` base SHA from `main` and create D2.0.0 PRE_CHANGE baseline manifest.
8. Verify Git/Vercel integration behavior sufficiently to avoid accidental deployment from branch pushes/merge.
9. Freeze D2.0.0 full GitHub state and only then authorize D2.0.1.

## Guardrails
- Never build demo features directly on `main`.
- Never mutate Vercel during the current sprint.
- Never overwrite historical frozen assets.
- Never certify only changed files; audit complete repository state.
- Never fabricate Ocean, Road LTL, WorkDefinition, readiness or Malkom semantics.
- Never make runtime queue/subqueue structures canonical Atlas truth.
- Maintain public/protected execution-IP boundaries.
- Preserve AR0.2 open decisions.

## Handover update rule
Update this file after every meaningful build slice/audit checkpoint. The backup executor must not rely on chat history when governed files provide the state.
