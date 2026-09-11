# Atlas V2 Demo — Hot-Backup Handover

Status: ACTIVE  
Primary executor: ChatGPT  
Backup executor: Claude  
Backup takeover: AUTHORIZED for the exact current demo stage if ChatGPT is unavailable/fails or Owner directs takeover.

## Current program state
- Program: Atlas V2 Demo Sprint
- Target: demo-ready functional concept live Monday 14 September 2026
- Stakeholder demo: Tuesday 15 September 2026
- Current stage: `D2.0.0 — Baseline, handover and release-control setup`
- Stage status: `AUTHORIZED`
- Architecture program: AR0.2 remains preserved at Owner-review gate; do not silently advance or overwrite it during demo sprint.
- Full production gate: `ATLAS_V2_GO_LIVE` remains distinct from `ATLAS_V2_DEMO_GO_LIVE`.

## Starting governed state
- Governance branch: `atlas-governance-registry-v2.1`
- Governance head immediately before demo protocol creation: `227391d64c3e178b4e72ab51cadd5564fbab9720`
- Current live Vercel project: `logistic_atlas_v2`
- GitHub repository: `Darshan-ukey/Supply-chain-and-logistic-atlas`
- Current architecture-review state from queue v16: AR0.1 COMPLETE; AR0.2 AWAITING_OWNER_REVIEW; AR0.3+ blocked; R0.4 suspended.

## Owner-authorized demo assumptions
- Ocean FCL/LCL 0.6 may be treated as available/live for the functional concept, but do not imply Road-LTL-equivalent execution depth unless verified.
- Road LTL is the execution-depth reference domain.
- Road LTL Work Decomposition / WorkDefinition is a required demo capability.
- Malkom adapter/projection is a required demo capability.
- Add one new Atlas page explaining `Domain Knowledge -> Execution Readiness -> Adapters / Downstream Tools` and the platform evolution/scope.

## Current work completed
1. Owner changed delivery priority to a Monday demo-ready Atlas 2.0 functional concept.
2. Primary/backup executor model agreed: ChatGPT primary, Claude hot backup.
3. Small-stage audit discipline agreed: PRE / MID / POST audit for every build stage.
4. No-delta-only certification rule agreed.
5. Full-state immutable freeze after each passed stage agreed.
6. `governance/demo-sprint/ATLAS_V2_DEMO_BUILD_PROTOCOL.md` created.

## Work in progress
D2.0.0 governance setup and baseline audit only. No demo feature code has been changed by ChatGPT under this sprint yet.

## Last safe resume point
If ChatGPT becomes unavailable now, Claude should:
1. read the machine queue on `atlas-governance-registry-v2.1`;
2. read `ATLAS_V2_DEMO_BUILD_PROTOCOL.md` and this handover;
3. verify whether queue/CLAUDE/roadmap have already been synchronized to D2.0.0;
4. finish only D2.0.0 baseline/release-control setup;
5. do not begin D2.0.1 until D2.0.0 post-audit PASS and next-stage authorization are recorded.

## Guardrails
- Never work directly on `main`.
- Never edit Vercel as source of truth.
- Do not overwrite historical frozen assets; freeze new complete states.
- Do not certify only changed files; audit the complete resulting app.
- Do not fabricate Ocean, Road LTL, WorkDefinition, readiness or Malkom semantics.
- Do not make Malkom queue/subqueue structures canonical Atlas truth.
- Maintain public/protected execution-IP boundaries.
- Keep AR0.2 evidence and open decisions intact.

## Next exact actions for D2.0.0
1. Synchronize queue to demo sprint and dual-executor rules.
2. Update `CLAUDE.md` so Claude reads this handover and can resume the exact active demo stage.
3. Update human roadmap with the demo sprint and Monday release distinction.
4. Audit current repository baseline: application structure, current live/preview source branch, existing Ocean 0.6 assets, existing Road LTL decomposition/WorkDefinition assets, existing Malkom adapter/projection assets, auth/public-admin split and Vercel linkage.
5. Create D2.0.0 PRE_BUILD_AUDIT and POST_BUILD_AUDIT/full-state baseline manifests.
6. Create dedicated demo build branch from the accepted application baseline.
7. Freeze D2.0.0 full-state baseline and only then authorize D2.0.1.

## Handover update rule
Update this file after every meaningful build slice or audit checkpoint. The backup executor must not rely on chat history when this file can provide the state.
