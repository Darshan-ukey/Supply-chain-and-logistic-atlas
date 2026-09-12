# Atlas V2 Demo — Browser QA Failure Remediation Backlog

Date: 2026-09-12
Status: OPEN — REMEDIATION NOT STARTED
Source checkpoint: interactive Opera QA against Vercel preview `dpl_9fQcB127sxCqxfxf3vJp5oeokGFd`
Demo branch under test: `atlas-v2-demo-2026-09-14` @ `b164874c9faff078196ee7dfb6ed42b6a5a39019`
Governance principle: **record first, remediate second; no merge to main until browser QA rerun passes.**

## Disposition

D2.0.7 remains blocked. The preview is build-healthy but not demo-ready because interactive browser QA exposed functional integration failures that structural certification did not catch.

## Confirmed failures

### BQA-01 — Root Canvas runtime contract rejection
**Severity:** BLOCKER
**Observed:** root preview renders only:
`Canvas failed to load: Runtime contract failed for road-ltl: contractVersion atlas-data-contract-v1.1+daughter-enrichment-v1`

**Evidence / technical trace:**
- Road LTL current module uses an enriched Atlas data-contract variant.
- Canvas runtime loader accepts only exact `atlas-data-contract-v1.0` and `atlas-data-contract-v1.1` strings before adapting legacy modules.
- Failure therefore occurs before the Canvas can render.

**Remediation requirement:**
1. Audit the canonical contract-family rules and all active daughter contractVersion values.
2. Change runtime compatibility logic only if the enriched variant is governed-compatible; do not weaken validation to an unrestricted prefix match.
3. Add regression tests covering base and governed enrichment contract variants.
4. Re-run root Canvas browser smoke.

**Status:** NOT_STARTED

### BQA-02 — Execution-depth projection handler fails at runtime
**Severity:** BLOCKER
**Observed:** `/daughter?moduleId=road-ltl&moduleVersion=1.5&taskId=LTL-03` renders shell but reports:
`Execution depth unavailable` / `Handler failed to load`.

**Evidence / technical trace:**
- Browser successfully loads Universal Daughter Renderer V2 shell.
- Renderer calls `/api/execution-depth-projection`.
- `vercel.json` rewrites this to `/api/atlas?action=execution-depth-projection`.
- `api/atlas.js` declares the action and dynamically imports `lib/api/execution-depth-projection.js`.
- That handler imports `lib/projections/execution-depth-projection.js`, which reads projection registry/materialized files from repository paths at runtime.
- Exact Vercel 500 detail still needs capture before remediation; likely dependency/bundling/path closure must be proven rather than assumed.

**Remediation requirement:**
1. Capture exact runtime error detail/log for the failing request before changing code.
2. Verify serverless bundle includes handler, projection builder, projection registry and required materialized bundle(s), or refactor to a deterministic Vercel-compatible inclusion path.
3. Preserve public-safe/protected data boundary.
4. Add endpoint test for Road LTL 1.5 / LTL-03 and at least one Ocean target.
5. Re-run Daughter Overview, Operational Knowledge and Execution Readiness tabs in browser.

**Status:** NOT_STARTED

### BQA-03 — Daughter `Canvas` navigation resolves to 404
**Severity:** BLOCKER FOR DEMO JOURNEY
**Observed:** Daughter header links to `/app`; browser receives `404: NOT_FOUND` on preview.

**Evidence / technical trace:**
- `daughter.html` hard-codes `<a href="/app">Canvas</a>`.
- `vercel.json` declares `/app -> /index.html`, but deployed preview behavior observed in Opera is 404.
- Root `/` is the known intended Canvas surface, although it is independently blocked by BQA-01.

**Remediation requirement:**
1. Verify deployed route table/cleanUrls behavior rather than assuming the rewrite is effective.
2. Prefer a canonical route constant or direct stable Canvas route; avoid duplicate navigation semantics.
3. Regression-test Daughter → Canvas navigation on the preview.

**Status:** NOT_STARTED

## Surfaces that passed the browser pass

### BQA-PASS-01 — Representative POC Journey
`/atlas-poc-journey` rendered correctly in Opera. Layout is coherent and the two lineages remain visibly separated.

### BQA-PASS-02 — Atlas Execution Readiness stakeholder page
`/atlas-execution-readiness` rendered correctly in Opera. Hero, three-zone model and lineage maturity section are readable and consistent with the intended Atlas boundary.

These passes do not offset the functional blockers above.

## Controlled remediation sequence

The following order is mandatory to minimize Vercel deployment-storage churn and avoid partial fixes:

1. **PRE-REMEDIATION TRACE** — capture exact BQA-02 runtime error and verify active contract/route facts.
2. **ONE BATCHED DEMO-BRANCH FIX** — BQA-01 + BQA-02 + BQA-03 together where technically safe.
3. **LOCAL/STRUCTURAL REGRESSION** — contract compatibility, endpoint loading, public/protected boundary, route/link checks.
4. **FULL-STATE CERTIFICATION DELTA REVIEW** — ensure eight-router invariant and existing D2.0.6 guards remain intact.
5. **SUCCESSOR BASELINE REFRESH** — update the governed demo candidate baseline only after the corrected tree is certified; historical v1.1.8 hashes remain immutable.
6. **SINGLE CONTROLLED PREVIEW** — rely on the GitHub-triggered preview; do not manually deploy another copy.
7. **OPERA BROWSER RERUN** — root Canvas → Daughter → execution-depth tabs → return navigation → POC Journey → Execution Readiness.
8. **FAILURE CLOSURE** — only mark BQA-01/02/03 closed with rendered evidence and no new material regression.
9. **D2.0.7 DECISION** — only after browser QA is green and Owner separately authorizes merge/main handling.

## Release / storage guardrails

- No production deployment or promotion.
- No main merge while any BQA blocker is open.
- No mutation of the historical `v1.1.8-critical-hashes.json` baseline.
- Do not create manual Vercel previews when a GitHub-triggered exact-commit preview exists.
- Governance/log commits themselves are known to trigger Vercel previews; batch future governance writes where tooling permits.
- Do not weaken contract validation or public/protected boundaries merely to make the demo green.
- Do not change the two-lineage truth or imply Road LTL 1.5 generated the proven Malkom V1.2 reference projection.

## Exit criteria for this backlog

All must be true:
- Root Canvas renders without contract rejection.
- Road LTL 1.5 / LTL-03 public-safe execution depth renders from the governed handler.
- Daughter → Canvas navigation works on the exact preview.
- POC Journey and Execution Readiness still render correctly.
- No console/runtime blocker in the tested journey.
- Eight serverless-router invariant remains intact.
- Public/protected execution-IP boundary remains intact.
- Successor candidate baseline reflects the certified corrected state.
- Opera browser QA rerun recorded PASS.
- D2.0.7 remains separately Owner-controlled.
