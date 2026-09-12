# BQA-02 — Execution-Depth Runtime Failure Remediation Log

Date: 2026-09-13
Status: IN_PROGRESS — EXACT_RUNTIME_DETAIL_PENDING
Failure gate: BQA-02 only
Precondition: BQA-01 = CLOSED_RENDERED_PASS (Claude rendered QA)
Downstream gate: BQA-03 remains blocked until BQA-02 rendered PASS.

## PRE_ACTION
Owner authorized BQA-02 start.

Scope is strictly limited to the Road LTL 1.5 / LTL-03 execution-depth runtime failure previously rendered as `Execution depth unavailable` / `Handler failed to load`.

Required sequence:
1. Capture the exact runtime error before any code change.
2. Trace the failing handler and all runtime file/module dependencies.
3. Apply the smallest Vercel-compatible fix without weakening the public/protected boundary or changing canonical lineage semantics.
4. Do not touch BQA-03.
5. Commit only BQA-02 implementation to `atlas-v2-demo-2026-09-14`.
6. Use the exact Git-triggered preview; no manual deployment.
7. Run endpoint/static regression checks, then rendered browser verification of Road LTL 1.5 / LTL-03 execution depth.
8. Close only with rendered PASS. If rendered test fails, remain on BQA-02.

Guardrails:
- Preserve eight top-level serverless routers.
- Preserve two-lineage truth.
- Preserve public-safe/protected execution-IP boundaries.
- No main merge or production deployment.
- No successor-baseline promotion as production.
- BQA-03 remains untouched and blocked.

## MATERIAL FINDING — source/runtime trace before remediation
No BQA-02 code has been changed yet.

Verified current routing chain on `atlas-v2-demo-2026-09-14`:
- `api/atlas.js` uses `createRouter('atlas', {'execution-depth-projection':'./execution-depth-projection.js', ...})`.
- `lib/api/_router.js` performs `await import(spec)` where `spec` is selected dynamically from the route map; its catch returns `{error:'Handler failed to load', detail:<actual import/runtime message>}`.
- `lib/api/execution-depth-projection.js` statically imports `../projections/execution-depth-projection.js`.
- `lib/projections/execution-depth-projection.js` reads the projection source registry and public-safe materialized bundles using runtime filesystem paths rooted at `process.cwd()`.
- Vercel runtime logs on the same BQA-01 preview show `/api/health` and `/api/config` also returning HTTP 500 through the same `createRouter` dynamic-import pattern. This is strong supporting evidence that the failure is at router/serverless dependency loading rather than the Road LTL projection semantics alone.

Important: this is still a technical hypothesis until the exact `detail` field from the failing execution-depth request is captured. The backlog explicitly requires that exact runtime detail before code mutation.

## CLAUDE BROWSER DIAGNOSTIC HANDOFF — TEST/TRACE ONLY
Claude is authorized to perform the missing diagnostic read because ChatGPT cannot currently obtain the protected endpoint body through its browser session.

Use the exact BQA-01-passed preview:
- implementation commit: `63e9b54bde58638886fbb64eeae4ad1719877412`
- deployment: `dpl_CuzQLjp873NxoPUskBs3RrhXxbt7`
- preview: `https://logisticatlasv2-1m8tu0747-ukeydarsh-2051s-projects.vercel.app`

Claude must do ONLY the following:
1. Open this exact endpoint in the connected authenticated browser:
   `https://logisticatlasv2-1m8tu0747-ukeydarsh-2051s-projects.vercel.app/api/execution-depth-projection?moduleId=road-ltl&moduleVersion=1.5&taskId=LTL-03`
2. Capture the full JSON response, especially the exact `detail` value accompanying `Handler failed to load`.
3. If the endpoint is rewritten to `/api/atlas?action=execution-depth-projection`, capture that final URL/status as well.
4. Optionally open `/api/health` on the same exact preview and capture its full JSON `detail` only as corroborating evidence; do not broaden remediation scope to system APIs.
5. Write the exact observed error text and HTTP status into this file or `claude_chatGPT.md` under a `BQA-02 EXACT_RUNTIME_ERROR` checkpoint.
6. Do NOT modify code, deploy, touch BQA-03, merge, or mark BQA-02 closed.

Once the exact error is recorded, ChatGPT may continue BQA-02 implementation.

Current gate state:
- `BQA-01 = CLOSED_RENDERED_PASS`
- `BQA-02 = IN_PROGRESS_EXACT_RUNTIME_DETAIL_PENDING`
- `BQA-03 = BLOCKED_BY_BQA_02_RENDERED_PASS`
- `D2.0.7 = BLOCKED`

## BQA-02 EXACT_RUNTIME_ERROR — captured by Claude

**HTTP status:** 500
**Full JSON response, exact endpoint** `https://logisticatlasv2-1m8tu0747-ukeydarsh-2051s-projects.vercel.app/api/execution-depth-projection?moduleId=road-ltl&moduleVersion=1.5&taskId=LTL-03`:

```json
{"ok":false,"error":"Handler failed to load","group":"atlas","action":"execution-depth-projection","detail":"Cannot find module '/var/task/lib/api/execution-depth-projection.js' imported from /var/task/lib/api/_router.js"}
```

**Diagnosis:** the file is genuinely absent from the deployed serverless bundle at `/var/task/`. Cause: `lib/api/_router.js` resolves handlers via `await import(spec)` where `spec` is a runtime-selected string from a route map, not a static string literal. Vercel's Node File Trace (the static-analysis dependency bundler for `@vercel/node` functions) cannot follow dynamic `import()` calls with a variable path, so it excludes every file only reachable that way from the deployed bundle.

**This is router-architecture-wide, not specific to execution-depth-projection.** ChatGPT's `/api/health` and `/api/config` 500s are the same root cause. Confirms ChatGPT's hypothesis was correct: this is a pre-existing latent defect in the `_router.js` dynamic-import pattern, not something introduced by the D2.0.4 execution-depth work. It was undetected until now because no rendered browser test had been run against a live Vercel deployment of this architecture before this demo sprint.

Claude proceeding to full BQA-02 closure per Owner direction (test → fix → regress → commit → rendered verify → close), continuing past the diagnostic-only handoff scope.
