# BQA-02 — Vercel Build Failure Addendum / Claude Remediation Handoff

Date: 2026-09-13
Classification: MATERIAL_FINDING + OWNER_AUTHORIZED_REMEDIATION_HANDOFF
Gate: BQA-02 only
Status: IN_PROGRESS_BUILD_FAILURE_AFTER_FIX

## Context
BQA-01 is already `CLOSED_RENDERED_PASS`.
BQA-02 implementation commit `bcfb52cb48a8f19c03f64b060cd420667301024a` was produced by Claude after first capturing the exact runtime error:

`Cannot find module '/var/task/lib/api/execution-depth-projection.js' imported from /var/task/lib/api/_router.js`

Claude's local verification of the BQA-02 implementation passed, including the real Road LTL and Ocean execution-depth handler chain and 17/17 full-state checks. BQA-02 was correctly left open pending live rendered verification.

## New Vercel finding from ChatGPT
ChatGPT used the Vercel API to locate the exact Git-triggered deployment for commit `bcfb52cb48a8f19c03f64b060cd420667301024a`.

Exact deployment:
- deployment ID: `dpl_Cu2EcQrkTMdFagiz3qsen62zmog7`
- preview URL: `https://logisticatlasv2-1i9lqbdff-ukeydarsh-2051s-projects.vercel.app`
- Git ref: `atlas-v2-demo-2026-09-14`
- Git commit: `bcfb52cb48a8f19c03f64b060cd420667301024a`
- Vercel state: `ERROR`

The deployment did not reach READY. Therefore browser verification is not yet possible and BQA-02 cannot be closed.

## Exact build error
Vercel build logs, errors-only:

`Error: The pattern "api/atlas.js" defined in \`functions\` doesn't match any Serverless Functions inside the \`api\` directory.`

Vercel reference emitted by build:
`https://vercel.link/unmatched-function-pattern`

This is the immediate blocker. The previous guessed branch-alias/DNS problem was secondary and must not be treated as the application failure.

## Claude authorization and exact scope
Owner has explicitly asked Claude to fix this BQA-02 build failure.

Claude is authorized to:
1. Read the current `vercel.json` at demo branch HEAD and compare it with the BQA-02 changes in `bcfb52c`.
2. Determine why the `functions` entry targeting `api/atlas.js` is invalid for this repository/Vercel routing model.
3. Correct only the Vercel function/includeFiles configuration required to package the BQA-02 execution-depth handler and its two exercised data files.
4. Preserve the existing BQA-02 code changes unless a directly necessary adjustment is proven by the build failure.
5. Preserve exactly eight top-level serverless routers; do not create a ninth router.
6. Preserve public-safe/protected execution-IP boundaries and two-lineage truth.
7. Do not touch BQA-03.
8. Do not merge to main or deploy/promote production.
9. Commit the smallest BQA-02 build-remediation delta to `atlas-v2-demo-2026-09-14`.
10. Allow the normal Git-triggered Vercel preview to build; do not manually deploy unless explicitly authorized later.
11. Record the new commit SHA and build result in `governance/demo-sprint/BQA-02_EXECUTION_LOG_2026-09-13.md` and/or `claude_chatGPT.md`.
12. If the new deployment is `ERROR`, remain on BQA-02 and capture the exact new build error before any further change.
13. If the new deployment is `READY`, obtain the exact deployment ID/URL from Vercel or request ChatGPT to provide it; do not guess aliases.
14. On the exact READY preview, browser-test ONLY BQA-02:
    - `/api/atlas?action=execution-depth-projection&moduleId=road-ltl&moduleVersion=1.5&taskId=LTL-03` must return HTTP 200 with real projection JSON and no `Handler failed to load`.
    - `/daughter?moduleId=road-ltl&moduleVersion=1.5&taskId=LTL-03` must render execution depth rather than `Execution depth unavailable`.
    - Regression-check root `/` still renders the Canvas from BQA-01.
15. Capture rendered evidence/screenshot/accessibility-tree output and record PASS/FAIL.
16. Only after rendered PASS may Claude write exactly: `BQA-02 = CLOSED_RENDERED_PASS`.
17. A BQA-02 PASS only unlocks BQA-03; it does not authorize starting BQA-03 unless the Owner/primary executor proceeds to that gate.

## Current gate state
- `BQA-01 = CLOSED_RENDERED_PASS`
- `BQA-02 = IN_PROGRESS_BUILD_FAILURE_AFTER_FIX`
- `BQA-03 = BLOCKED_BY_BQA_02_RENDERED_PASS`
- `D2.0.7 = BLOCKED`

## Guardrail
Do not close BQA-02 on local tests, a successful build alone, or HTTP readiness alone. Closure still requires rendered browser evidence on the exact READY preview.