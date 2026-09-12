# Claude ↔ ChatGPT — Atlas Shared Coordination Log

**Purpose:** Persistent direct coordination/handover file for ChatGPT and Claude. Both executors must read this file before starting/resuming Atlas work and write material findings here so the Owner does not have to relay conversations between tools.

> Full prior history through the preceding checkpoint remains recoverable from Git blob `0462bbc050a4bbd740b6dc96960dd6f6e04ee7f6` and repository history. Existing architecture, two-lineage, audit, and no-false-claim rules remain binding.

## 2026-09-12 — ChatGPT — CONTROLLED PREVIEW / SUCCESSOR BASELINE / DRIVE CUSTODY / BROWSER QA
Classification: OWNER_DIRECTION + VERIFIED_EXTERNAL_STATE
Checkpoint: MATERIAL_FINDING / PARTIAL_CLOSURE

### 1. Claude handover items checked
Claude's pending handover items were re-read. Material open items assigned to ChatGPT were:
1. verify Vercel access and use preview-over-main-merge if possible;
2. create a governed successor integrity baseline without overwriting the historical v1.1.8 hashes;
3. perform missing browser/visual click-through QA against the preview;
4. test whether ChatGPT's Google Drive connector can close the demo-sprint custody mirror gap.

### 2. Vercel access — RESOLVED for ChatGPT
ChatGPT has correct Vercel access:
- team: `ukeydarsh-2051s-projects`
- teamId: `team_82G0YS5CSlKdabFzFBgLUj3r`
- project: `logistic_atlas_v2`
- projectId: `prj_zoyyLeFrvLKHFU8Unzq3Cr8zWDc0`
- plan: Hobby

A manual preview deployment was NOT created because GitHub integration had already created a READY preview for the exact demo branch state. Reusing the auto-preview is the controlled, lower-storage path.

### 3. Governed successor release-integrity baseline — CREATED, old baseline preserved
New file on `atlas-v2-demo-2026-09-14`:
`release/baselines/atlas-v2-demo-2026-09-14-critical-hashes.json`

Final corrected commit:
`b164874c9faff078196ee7dfb6ed42b6a5a39019`

Properties:
- schema: `atlas-v2-demo-critical-integrity-v1`
- releaseId: `atlas-v2-demo-2026-09-14-candidate`
- status: `GOVERNED_CANDIDATE_NOT_PRODUCTION_BASELINE`
- base main: `58b14c7d8f3fcdb99c279caab925c39effcd378c`
- certified D2.0.6 state: `60d43c97e55b3ad1617f81c2562d2f8790def29b`
- freeze: `governance/demo-sprint/D2.0.6_POST_BUILD_FULL_STATE_FREEZE.json`
- freeze tree hash: `f79f8c2700633dfb1846ff80782f083e9ffa3ddf3ff3d8730d47b078ee093a60`
- intentional successor divergences from v1.1.8: `data/module-catalog.json` and `vercel.json`
- historical `release/baselines/v1.1.8-critical-hashes.json` was NOT modified.

Important guardrail: `lib/api/release-integrity.js` has NOT been switched to the candidate baseline. That requires an explicit governed release/Owner step; candidate baseline creation is not production promotion.

### 4. Exact current preview — READY
Current preview deployment for corrected demo HEAD `b164874c9faff078196ee7dfb6ed42b6a5a39019`:
- deploymentId: `dpl_9fQcB127sxCqxfxf3vJp5oeokGFd`
- URL: `https://logisticatlasv2-nzkw1wm1s-ukeydarsh-2051s-projects.vercel.app`
- state: `READY`
- target: preview (`null`, not production)
- Vercel metadata confirms Git ref `atlas-v2-demo-2026-09-14` and exact commit SHA above.
- `lambdaRuntimeStats`: 8 Node functions, consistent with the D2.0.6 restored eight-router invariant.
- build-log error filter: no build errors; build completed successfully.
- preview runtime error/fatal query: no errors found in the checked window.

No manual `deploy_to_vercel` action was performed.

### 5. Deployment-storage finding — MATERIAL
Vercel deployment history confirms GitHub integration creates a Vercel deployment for pushes to BOTH:
- `atlas-v2-demo-2026-09-14`, and
- `atlas-governance-registry-v2.1`.

This explains why governance/log-only commits also contribute to Deployment Storage growth. Multiple governance commits in the same hour each generated READY previews. Until Git integration is reconfigured, avoid chatty GitHub writes; batch governance updates and do not manually deploy when an exact auto-preview already exists.

The two baseline commits created two previews (`1b65fb9...` and corrected `b164874...`). After identifying this behavior ChatGPT stopped further demo-branch writes before QA and consolidated governance logging into this single checkpoint.

### 6. Browser/visual click-through QA — SUPERSEDED BY FAIL RESULT BELOW
Preview protection was initially an environmental blocker. Opera Browser Connector was later enabled successfully and ChatGPT completed the first rendered QA pass. See the later BROWSER QA FAIL section below; browser QA is no longer merely open.

### 7. Google Drive custody blocker — CLOSED from ChatGPT connector
Claude's connector had three `No approval received` failures. ChatGPT's Drive connector has write access.

Created Drive folder:
`Atlas V2 Demo Recovery Checkpoint - 2026-09-12`
folderId: `1RDoM_g4Ou3qeYrHAYwNjDxuz6NJXPlpl`

Created and populated Google Doc:
`Atlas V2 Demo Recovery Checkpoint — 12 Sep 2026`
docId: `1EskE1yAm_kKB7Pm2RgWFDvCg7nier1UW8sdgO2Hw_R0`

Verified the document parent is the recovery folder. The checkpoint records:
- canonical Atlas boundary;
- two-lineage truth;
- D2.0.0–D2.0.7 status;
- certified D2.0.6 commit + 721-file freeze/tree hash;
- governed successor integrity baseline + old-baseline preservation;
- Malkom reference results/gaps;
- current controlled Vercel preview and deployment ID;
- deployment-storage behavior;
- browser QA blocker;
- reconstruction procedure.

This closes the previously recorded Drive write-authorization/custody blocker at the human-readable recovery-checkpoint level. GitHub remains canonical technical registry.

### Current safe state before browser QA disposition
- Demo branch: `atlas-v2-demo-2026-09-14` @ `b164874c9faff078196ee7dfb6ed42b6a5a39019`
- D2.0.6 certified build state remains `60d43c97e55b3ad1617f81c2562d2f8790def29b`; later delta is only the governed candidate baseline file.
- Current preview: READY at deployment `dpl_9fQcB127sxCqxfxf3vJp5oeokGFd`.
- D2.0.7/main merge: NOT executed; explicit Owner approval still required.
- Historical v1.1.8 baseline: immutable/unchanged.

---

## 2026-09-12 — ChatGPT — ATLAS PREVIEW BROWSER QA
Classification: CROSS_AGENT_RENDERED_QA + BLOCKING_DEFECT_DISCOVERY
Checkpoint: MATERIAL_FINDING / QA_DISPOSITION

### QA disposition
**FAIL — preview is not demo-ready. D2.0.7 remains BLOCKED.**

Opera Browser Connector was successfully connected and the protected Vercel preview was opened using a temporary share URL. Rendered QA found defects that static/full-state certification did not detect.

### What renders correctly
1. `/atlas-poc-journey` renders cleanly and presents the intended six-step POC narrative.
2. `/atlas-execution-readiness` renders cleanly and presents the correct product boundary: Atlas owns understanding/specification; downstream platforms own execution.
3. Both pages visibly preserve the two-lineage distinction and do not falsely claim the V1.2 Malkom projection came from Road LTL 1.5/P6.2.

### Blocking defect BQA-01 — root Canvas fails to load
Rendered root `/` displays only:
`Canvas failed to load: Runtime contract failed for road-ltl: contractVersion atlas-data-contract-v1.1+daughter-enrichment-v1`

Repository trace:
- `index.html` `AtlasModuleLoader.validateRuntime` accepts only exact `atlas-data-contract-v1.0` or `atlas-data-contract-v1.1`.
- The active Road LTL enrichment contract uses `atlas-data-contract-v1.1+daughter-enrichment-v1`.
- Ocean module variants also use enriched/quality-profile contract strings, so the fix must be governed and generic enough for known approved contract variants, not a one-off bypass.

Implication: the main Canvas surface is unusable on the preview and must be remediated before demo certification.

### Blocking defect BQA-02 — Daughter execution depth fails at runtime
Rendered route:
`/daughter?moduleId=road-ltl&moduleVersion=1.5&taskId=LTL-03`

The Daughter shell renders, but content fails closed with:
- `Execution depth unavailable`
- `Handler failed to load`
- `No alternate Daughter version has been substituted.`

Repository trace:
- renderer calls `/api/execution-depth-projection`;
- `vercel.json` rewrites it to `/api/atlas?action=execution-depth-projection`;
- `api/atlas.js` routes that action to `./execution-depth-projection.js` relative to `lib/api/_router.js`, therefore to `lib/api/execution-depth-projection.js`;
- that implementation exists and calls `lib/projections/execution-depth-projection.js`;
- projection code performs runtime `fs.readFileSync` against registry/materialized/module/operational-knowledge files under `process.cwd()`.

Strong likely cause: required dynamic filesystem dependencies are not included in the Vercel serverless bundle, causing handler execution/import dependency failure at runtime. Exact Vercel JSON error detail was not captured because protected API fetch redirects through Vercel SSO. Remediation must verify the precise failure rather than merely suppressing it.

### Blocking defect BQA-03 — Daughter Canvas navigation is broken
`daughter.html` links Canvas to `/app`.
Rendered navigation to `/app` returns Vercel `404: NOT_FOUND` on this preview, despite a rewrite in `vercel.json` intended to map `/app` to `/index.html`.

Safe remediation should either fix the rewrite behavior or make the Daughter navigation point directly to the known root/`index.html` route. Do not leave a demo navigation dead-end.

### Admin surface
Navigating `/admin` redirected to Vercel authentication; admin visual QA was not completed in this pass. This is secondary to the three public/demo blockers above.

### Required remediation sequence
1. Keep D2.0.7/main merge blocked.
2. Fix Canvas contract-version validation using an explicit governed compatibility rule for approved enriched contract variants; do not broadly accept arbitrary suffixes.
3. Fix Daughter execution-depth serverless runtime packaging/handler dependency closure; verify exact failure and ensure required registry/materialized/source files are present in the function bundle or refactor away unsafe dynamic filesystem dependency.
4. Fix Daughter Canvas navigation (`/app` dead-end).
5. Add regression/browser checks that would fail on these three defects.
6. Update the governed successor candidate integrity baseline for intentional remediation changes; do not mutate v1.1.8 historical baseline.
7. Allow GitHub integration to create a single new preview from the batched remediation commit; do not manually deploy.
8. Re-run full rendered Opera QA on the new exact preview.
9. Only after rendered QA passes should D2.0.7/main-merge readiness be reconsidered under explicit Owner approval.

### Storage guardrail
Every GitHub push currently creates a Vercel preview, including governance-only pushes. Batch remediation and evidence updates into as few commits as practical. No manual Vercel deployment is authorized or necessary.

---

## 2026-09-12 — ChatGPT — FAILURE BACKLOG FREEZE BEFORE REMEDIATION
Classification: GOVERNANCE_SYNC + OWNER_DIRECTION
Checkpoint: PRE_ACTION / BACKLOG_CREATED

No remediation has started. The three browser-QA failures above are now frozen into the dedicated action backlog:
`governance/backlog/ATLAS_V2_DEMO_BROWSER_QA_FAILURE_BACKLOG_2026-09-12.md`.

Backlog IDs:
- `BQA-01` — root Canvas contract-version rejection.
- `BQA-02` — execution-depth projection handler runtime failure.
- `BQA-03` — Daughter → Canvas `/app` navigation 404.

The backlog also fixes the remediation order: capture exact BQA-02 runtime error first; implement one batched demo-branch fix where safe; run structural/full-state regression; refresh only the successor candidate baseline; allow one Git-triggered preview; rerun Opera; keep D2.0.7 blocked until rendered PASS and separate Owner approval.

**NO FAILURE CLOSURE IS AUTHORIZED BY THIS LOG ENTRY.** This checkpoint records work to be done; it does not certify any fix.
