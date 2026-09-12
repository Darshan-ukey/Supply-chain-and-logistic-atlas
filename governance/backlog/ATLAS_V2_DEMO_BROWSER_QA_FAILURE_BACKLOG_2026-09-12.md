# Atlas V2 Demo — Browser QA Failure Remediation Backlog

Date: 2026-09-12
Status: OPEN — REMEDIATION NOT STARTED
Source checkpoint: interactive Opera QA against Vercel preview `dpl_9fQcB127sxCqxfxf3vJp5oeokGFd`
Demo branch under test: `atlas-v2-demo-2026-09-14` @ `b164874c9faff078196ee7dfb6ed42b6a5a39019`
Governance principle: **record first, remediate second; close exactly one browser failure at a time.**

## Disposition

D2.0.7 remains blocked. The preview is build-healthy but not demo-ready because interactive browser QA exposed functional integration failures that structural certification did not catch.

## Mandatory serial-gate policy

The three failures MUST NOT be fixed, tested, or closed as one batch.

Required order:

`BQA-01 → browser verification → log disposition → BQA-02 → browser verification → log disposition → BQA-03 → browser verification → log disposition`

Rules:
1. Only the currently active BQA item may be remediated.
2. After implementation of that single item, wait for the exact Git-triggered Vercel preview for that commit.
3. Test that failure in Opera on the deployed preview, not only in static/local tests.
4. Record PRE_ACTION, implementation evidence, browser evidence, and PASS/FAIL in `claude_chatGPT.md` before advancing.
5. If the browser test FAILS, remain on the same BQA item. Do not start the next failure.
6. If the browser test PASSES, mark only that BQA item CLOSED_RENDERED_PASS and then authorize the next BQA item.
7. Re-run the previously passed BQA item(s) opportunistically while testing later items to detect regression, but do not reopen them unless a regression is observed.
8. No combined all-three-failure closure is permitted.
9. D2.0.7 remains blocked until all three independent browser gates are PASS and the final end-to-end journey is rechecked.

Current active remediation gate: **BQA-01**.
BQA-02 and BQA-03 are **BLOCKED_BY_PRECEDING_BROWSER_GATE**.

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
4. Push only the BQA-01 remediation to the demo branch.
5. Wait for the exact preview for that commit.
6. Re-run root Canvas browser smoke in Opera.
7. Log PASS/FAIL before any BQA-02 work begins.

**Status:** ACTIVE_NEXT — NOT_STARTED
**Closure requirement:** Opera-rendered root Canvas PASS on the exact remediation preview plus log checkpoint.

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

**Remediation requirement AFTER BQA-01 PASS ONLY:**
1. Capture exact runtime error detail/log for the failing request before changing code.
2. Verify serverless bundle includes handler, projection builder, projection registry and required materialized bundle(s), or refactor to a deterministic Vercel-compatible inclusion path.
3. Preserve public-safe/protected data boundary.
4. Add endpoint test for Road LTL 1.5 / LTL-03 and at least one Ocean target.
5. Push only the BQA-02 remediation.
6. Wait for the exact preview.
7. Re-run Daughter Overview, Operational Knowledge and Execution Readiness tabs in Opera.
8. Log PASS/FAIL before any BQA-03 work begins.

**Status:** BLOCKED_BY_BQA_01_RENDERED_PASS
**Closure requirement:** Opera-rendered execution-depth PASS on the exact BQA-02 remediation preview plus log checkpoint.

### BQA-03 — Daughter `Canvas` navigation resolves to 404
**Severity:** BLOCKER FOR DEMO JOURNEY
**Observed:** Daughter header links to `/app`; browser receives `404: NOT_FOUND` on preview.

**Evidence / technical trace:**
- `daughter.html` hard-codes `<a href="/app">Canvas</a>`.
- `vercel.json` declares `/app -> /index.html`, but deployed preview behavior observed in Opera is 404.
- Root `/` is the known intended Canvas surface, although it is independently blocked by BQA-01.

**Remediation requirement AFTER BQA-02 PASS ONLY:**
1. Verify deployed route table/cleanUrls behavior rather than assuming the rewrite is effective.
2. Prefer a canonical route constant or direct stable Canvas route; avoid duplicate navigation semantics.
3. Push only the BQA-03 remediation.
4. Wait for the exact preview.
5. Regression-test Daughter → Canvas navigation in Opera.
6. Recheck BQA-01 root Canvas and BQA-02 Daughter execution depth for regression.
7. Log PASS/FAIL before any final demo-journey closure decision.

**Status:** BLOCKED_BY_BQA_02_RENDERED_PASS
**Closure requirement:** Opera-rendered Daughter → Canvas navigation PASS on the exact BQA-03 remediation preview plus log checkpoint.

## Surfaces that passed the initial browser pass

### BQA-PASS-01 — Representative POC Journey
`/atlas-poc-journey` rendered correctly in Opera. Layout is coherent and the two lineages remain visibly separated.

### BQA-PASS-02 — Atlas Execution Readiness stakeholder page
`/atlas-execution-readiness` rendered correctly in Opera. Hero, three-zone model and lineage maturity section are readable and consistent with the intended Atlas boundary.

These passes do not offset the functional blockers above.

## Controlled serial remediation sequence

### Gate 1 — BQA-01
- PRE_ACTION log.
- Diagnose governed contract-family compatibility.
- Implement BQA-01 only.
- Run structural regression relevant to BQA-01.
- Refresh successor candidate baseline only if the BQA-01 change touches pinned candidate files.
- Allow one Git-triggered preview.
- Opera test root Canvas.
- Log `BQA-01 PASS` or `BQA-01 FAIL`.
- Advance only on PASS.

### Gate 2 — BQA-02
Starts only after BQA-01 has `CLOSED_RENDERED_PASS`.
- PRE_ACTION log.
- Capture exact runtime error before code mutation.
- Implement BQA-02 only.
- Run endpoint/public-protected regression.
- Refresh successor candidate baseline only if required.
- Allow one Git-triggered preview.
- Opera test Daughter Overview + Operational Knowledge + Execution Readiness.
- Recheck root Canvas for regression.
- Log `BQA-02 PASS` or `BQA-02 FAIL`.
- Advance only on PASS.

### Gate 3 — BQA-03
Starts only after BQA-02 has `CLOSED_RENDERED_PASS`.
- PRE_ACTION log.
- Verify deployed routing behavior.
- Implement BQA-03 only.
- Run route/link regression.
- Refresh successor candidate baseline only if required.
- Allow one Git-triggered preview.
- Opera test Daughter → Canvas return navigation.
- Recheck BQA-01 and BQA-02 surfaces for regression.
- Log `BQA-03 PASS` or `BQA-03 FAIL`.
- Advance only on PASS.

### Final journey verification
Only after all three have independent rendered PASS:
- root Canvas → Daughter → execution-depth tabs → return to Canvas → POC Journey → Execution Readiness;
- no material console/runtime blocker;
- eight-router invariant intact;
- public/protected boundary intact;
- successor candidate baseline reflects the final certified corrected state;
- D2.0.7 remains separately Owner-controlled.

## Release / storage guardrails

- No production deployment or promotion.
- No main merge while any BQA blocker is open.
- No mutation of the historical `v1.1.8-critical-hashes.json` baseline.
- Do not create manual Vercel previews when a GitHub-triggered exact-commit preview exists.
- Serial failure closure necessarily creates separate previews; minimize unrelated writes and never combine unrelated remediation merely to reduce preview count.
- Governance/log commits themselves are known to trigger Vercel previews; keep each gate's logging concise and necessary.
- Do not weaken contract validation or public/protected boundaries merely to make the demo green.
- Do not change the two-lineage truth or imply Road LTL 1.5 generated the proven Malkom V1.2 reference projection.
- A static test PASS cannot close a browser-discovered failure.

## Exit criteria for this backlog

All must be true and independently logged:
- `BQA-01 = CLOSED_RENDERED_PASS`.
- `BQA-02 = CLOSED_RENDERED_PASS`.
- `BQA-03 = CLOSED_RENDERED_PASS`.
- Root Canvas renders without contract rejection.
- Road LTL 1.5 / LTL-03 public-safe execution depth renders from the governed handler.
- Daughter → Canvas navigation works on the exact preview.
- POC Journey and Execution Readiness still render correctly.
- No console/runtime blocker in the tested journey.
- Eight serverless-router invariant remains intact.
- Public/protected execution-IP boundary remains intact.
- Successor candidate baseline reflects the certified corrected state.
- Final Opera end-to-end browser QA rerun recorded PASS.
- D2.0.7 remains separately Owner-controlled.
