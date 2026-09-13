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

## BQA-02 IMPLEMENTATION — Claude, continued past diagnostic handoff per Owner direction

Owner directed Claude to close BQA-02, extending beyond the diagnostic-only scope of the
original handoff. Proceeded through the full required sequence.

### Fix committed
`atlas-v2-demo-2026-09-14` @ `bcfb52c`. Two root causes, both confirmed by tracing before any
code change (not assumed):

1. **`lib/api/_router.js`'s dynamic `import(spec)`** — Vercel's Node File Trace cannot follow a
   runtime-selected import path, so `lib/api/execution-depth-projection.js` was silently excluded
   from the deployed bundle. Router-architecture-wide (matches ChatGPT's independent `/api/health`
   and `/api/config` 500 observations) — **only `api/atlas.js`'s 3 routes fixed here**, matching
   BQA-02's authorized scope. The other 7 routers are byte-unchanged.
2. **Registry-parsed data-file paths invisible to the bundler** — `execution-depth-projection.js`
   reads file paths that exist only as JSON *data*, never as source-code literals, so even fixing
   (1) alone would not have bundled the actual projection data.

Fix: `_router.js` now accepts either a pre-resolved handler function or a spec string (existing
string-spec behavior byte-identical for the other 7 routers); `api/atlas.js` converted to static
top-level imports (traceable by Vercel's bundler); `vercel.json` `includeFiles` added, scoped to
exactly the registry and the two precompiled bundle files that exist on this branch and are
actually exercised — no globs referencing nonexistent files.

### Local verification — thorough, PASS
- `execution-depth-projection?moduleId=road-ltl&moduleVersion=1.5&taskId=LTL-03` → 200, real title,
  through the actual `api/atlas.js` handler chain (not mocked).
- `ocean-fcl@0.6/FCL-01` → 200, real title, same handler.
- Unknown action → still 404 with correct shape (router regression check).
- `tests/d2-0-6-full-state-certification.mjs`: **17/17 PASS**, no regression.
- `tests/v1.1.8-api-router-smoke.mjs`: no new failures.
- `tests/v1.1.8-serverless-budget.mjs`: the one failing assertion (28 vs 29 rewrites) confirmed via
  `git stash` comparison to be **identical before and after this commit** — pre-existing since
  D2.0.6's own route consolidation, not introduced by BQA-02.

### Rendered verification — BLOCKED, NOT completed. BQA-02 stays open.
Attempted per the required sequence: navigated to the standard Vercel git-branch alias
(`https://logisticatlasv2-git-atlas-v2-demo-2026-09-14-ukeydarsh-2051s-projects.vercel.app/...`),
expecting it to resolve to the newly auto-built preview for commit `bcfb52c`. The navigation call
itself returned successfully (tab title/URL updated), but every subsequent read call
(`tab-content`, `screenshot`, then even `list-tabs`) failed with `No approval received` / a generic
execution error. The browser connector became unresponsive mid-check, not because of anything the
page returned. **I did not obtain content, so I cannot confirm the guessed branch-alias URL even
resolves to the correct deployment, let alone that the fix renders correctly.**

Per the explicit pass criterion already established for this gate — HTTP readiness or a
successful navigation call alone is insufficient; rendered content must be read — this is
recorded as **NOT a rendered PASS**. Not closing the gate on local verification alone, however
strong.

### Result
**BQA-02 = FIX_COMMITTED_LOCALLY_VERIFIED_RENDERED_PENDING**

`BQA-03 remains BLOCKED_BY_BQA_02_RENDERED_PASS` — unchanged, still blocked.
`D2.0.7 = BLOCKED` — unchanged.

Next exact action: retry rendered verification once the browser connector is responsive again —
either Claude's Opera session or ChatGPT's, whichever is available first. The exact deployment ID
and confirmed preview URL for commit `bcfb52c` should be captured directly from Vercel (ChatGPT has
working Vercel API access) rather than guessed via URL pattern, to remove that uncertainty from the
next attempt.

## BQA-02 rendered-check retry — browser connector recovered, URL guess was wrong

Owner asked to retry closing the loop. Browser connector had recovered (`list-tabs` responded
normally again). Re-navigated fresh to the same guessed URL and read content this time.

**Result:** `DNS_PROBE_FINISHED_NXDOMAIN` on
`https://logisticatlasv2-git-atlas-v2-demo-2026-09-14-ukeydarsh-2051s-projects.vercel.app`.

This is **not an application error** — the domain does not resolve at all. Likely cause: that
label is ~71 characters, over the 63-character DNS label limit, so Vercel's real git-branch alias
for this project/branch combination is truncated or hashed differently than my guess assumed.
This confirms the recommendation already logged: **guessing the URL is not reliable and should
stop.** The correct fix under test (`bcfb52c`) has still not been rendered-verified.

**BQA-02 remains: `FIX_COMMITTED_LOCALLY_VERIFIED_RENDERED_PENDING`.** Not closed.

**Concrete next action, unchanged and now confirmed necessary:** the exact deployment ID/URL for
commit `bcfb52c` needs to come from a real Vercel lookup (ChatGPT's working API access), not a
guessed alias pattern. Once supplied, Claude's browser session is available and working (confirmed
functional again this check) to complete the rendered verification immediately.

## BQA-02 RENDERED VERIFICATION — Claude, exact READY deployment

**exact commit:** `1a17fd6d04bbe56386161c7b4fad43266093e106`
**exact deployment ID:** `dpl_4r6VfAfV46w2K3bYi11atGMKJpgf`
**exact preview URL:** `https://logisticatlasv2-fmjywi4bk-ukeydarsh-2051s-projects.vercel.app`

All three required checks run against this exact deployment, in order:

### Test URL 1 — API execution-depth projection
`.../api/atlas?action=execution-depth-projection&moduleId=road-ltl&moduleVersion=1.5&taskId=LTL-03`

**Result: PASS.** `{"ok":true,"projection":{...}}` — full real LTL-03 content: `overview.title`
"Create and validate shipment, consignment and transport-document identity", complete
`operationalKnowledge` block (businessMeaning, why, informationResolution with 10 unresolved
items correctly broken down 4 SOURCE_CONTEXT_PENDING / 6 CLIENT_BINDING_REQUIRED, rule/control/
action/timing/evidence summaries), `executionReadiness.status: CONDITIONAL_READY`. No
`Handler failed to load`, no `Cannot find module`, no `ENOENT`.

### Test URL 2 — User-facing Daughter route
`.../daughter?moduleId=road-ltl&moduleVersion=1.5&taskId=LTL-03`

**Result: PASS.** Tab title "Atlas Daughter · Execution Depth". Full Execution-Depth Inspector
rendered: all 5 tabs present (Overview, Operational Knowledge, Execution Readiness, Work
Decomposition, WorkDefinition), "A5 TASK · LTL-03" badge, real title and canonical trace
(`road-ltl` / `1.5` / `a5-ltl-03` / `scp-shipment-transport-identity`), "Frozen Execution
Reference Candidate" status, and the governed boundary label "PUBLIC-SAFE PROJECTION · PROTECTED
DETAIL NOT PRELOADED" displayed exactly as designed. No `Execution depth unavailable`, no
`Handler failed to load`, no fallback-substitution text.

Observed but not navigated (correctly out of scope): header links "Canvas" → `/app` and "Admin" →
`/admin` are present in the rendered nav — structural observation only, per instruction not to
touch BQA-03 in this checkpoint.

### Test URL 3 — Root Canvas regression check
`.../` (root)

**Result: PASS.** Tab title "Enterprise Operations Platform · Supply Chain · v1.1.8" — identical
to the confirmed BQA-01 pass state. Full accessibility-tree text search for `fail|error|contract`
(case-insensitive) → zero matches, same as the BQA-01 check. Screenshot confirms: full Universe
spatial map, all 15 territories, "71 MODELS · ROAD LTL · A5" sidebar, live Inspector panel — no
error banner, no regression from BQA-01.

### Result

**BQA-02 = CLOSED_RENDERED_PASS**

**BQA-03 is now eligible for Owner/primary-executor activation but has NOT started in this
checkpoint.**

Gate state after this checkpoint:
- `BQA-01 = CLOSED_RENDERED_PASS`
- `BQA-02 = CLOSED_RENDERED_PASS`
- `BQA-03 = ELIGIBLE_NOT_STARTED`
- `D2.0.7 = BLOCKED` — unchanged, still requires explicit Owner approval and a separate decision on `/app` navigation (BQA-03) before reconsideration
