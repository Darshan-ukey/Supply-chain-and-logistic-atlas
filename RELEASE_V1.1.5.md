# v1.1.5 · Parity Plus Guards

## What this is

v1.1.4 (full-parity) restored the Stage 23 spatial canvas and the five
Stage 17–21 client layers exactly, on top of the Foundation v1.1 backend and the
v1.1.3 eight-function consolidation. That UI restoration is the right base and is
kept unchanged here.

v1.1.5 closes five verification gaps found by auditing that build, and fixes two
copy regressions the donor restore reintroduced.

## Base retained from v1.1.4

Verified, not assumed:

- Stage 17–21 clients present as **real donor files**
  (13,284 / 7,854 / 20,988 / 36,566 / 29,213 bytes), not stubs.
- Boxed `assets/` rewrite removed; `index.html` loads the Stage 23 frontend.
- All 6 migrations present.
- 8 serverless functions, 28 legacy API paths, all 28 handlers load and are callable.
- Frozen source HTML byte-identical: `47a111bd…` / `70850a00…`.

### On the canonical JSON hash difference

`page0-v6.2.2.json` and `road-ltl-v1.2.json` differ by hash from v1.1. This was
checked structurally rather than accepted or rejected on the hash alone:

- **Zero content drift on shared keys.**
- The difference is purely **additive** — v1.1.4 merged the Stage 23 key shape
  (`ontologyNodes`, `availableContext`, `module`, `publication`) alongside the
  v1.1 shape (`entityNodes`, `contracts`, `roles`…) so one file serves both the
  restored frontend and the Foundation backend.
- `ontologyNodes` and `entityNodes` are identical (220 each).

This is a legitimate merge. What was missing was any test enforcing that it
*stays* additive — see guard 1.

## Gaps closed

### 1. Canonical integrity was no longer enforced
The frozen source hashes were intact but **nothing asserted them**. New
`tests/v1.1.5-canonical-integrity.mjs` re-anchors both frozen sources, asserts
the nine canonical counts, and proves the dual key shape stays additive by
checking alias parity. 14 checks.

### 2. Browser certification could not fail
`v1.1.4-browser-certificate.mjs` reads a stored `audits/v1.1.4/browser-parity.json`
and asserts against it. The data was credible — it matched an independent browser
run — but a stored file cannot catch tomorrow's regression.

New `tests/v1.1.5-live-browser-certificate.mjs` serves the package over HTTP,
drives real Chromium at 1440×900 and 390×844, and asserts against the live DOM:
15 spatial territories, 0 boxed territories, ambient mesh, 110 ambient dots,
zero runtime errors, zero horizontal overflow, Stage 15.2 UI active, semantic
zoom engaged. Skips cleanly when no browser binary is present, so it never
produces a false failure in CI.

The original JSON-replay test is **kept as well** — it still documents the
certified baseline.

### 3. Full-universe scale test was absent
Restored as `tests/v1.1.5-scale-smoke.mjs`, adapted to the Stage 23
`globalThis.EnterpriseOpsCore` engine: 71 destinations, 2,130 synthetic
processes, ~9ms.

### 4. Three legacy tests were dead
`stage22.1-ephemeral-llm-smoke`, `stage22.2-pilot-security-smoke` and
`stage23-pilot-evaluation-smoke` all pointed at hardcoded
`/mnt/data/atlas-canvas-stage22.2/…` paths and at the pre-consolidation `api/`
location. Repaired to relative + `lib/api` paths. All three now run and are
**wired into `npm run check`** — the security/RLS smoke in particular was
present but never executed.

### 5. Copy regressions
- Restored the V1.0.1 deviation-caveat fix.
- Re-added the coverage-scope clarification dropped from v1.1.2: the
  71-destination registry is roadmap scope, **not** completed modules.

While applying (5), a blanket replace was caught making two sites read worse — a
data-entry prompt and a Markdown export both ended up with a duplicated caveat.
Both were refined individually. The `DEVIATION ≠ GAP` guard already covers the
meaning elsewhere in the UI.

## Re-baselining

`release-integrity` compares 23 files against a recorded baseline. The copy fixes
changed `index.html`, so the check failed by design.

Rather than silently overwriting, the drift was proven first: **1 of 23 files
changed**, and a line diff confirmed it contained only the intended copy edits —
all five Stage 17–21 donor files, all canonical data and all frozen sources
untouched. Only then was the baseline updated, with a `rebaseline` block recorded
in the file stating the previous hash, the new hash, the reason, and what was
verified unchanged.

## Verification

```
npm run check     132 PASS / 0 FAIL   (exit 0)
```

Includes: canonical integrity · static parity · foundation smoke · API router ·
full-universe scale · pilot security · ephemeral LLM · pilot evaluation ·
stored browser certificate · live browser certificate · offline pilot eval (10/10).

Deploy-critical invariants at ship time:

| | |
|---|---|
| Serverless functions | 8 (limit 12) |
| Migrations | 6 |
| Stage 17–21 clients | real donor files |
| Boxed `assets/` | removed |
| Frozen sources | `47a111bd…` / `70850a00…` |
| Canonical content drift | zero |

## Deploying

1. Commit and tag `v1.1.5`.
2. Vercel should report **8 functions**.
3. Set Supabase and LLM environment variables — auth, workspace, document and
   collaboration routes fail closed without them. `/api/health` and
   `/api/version` respond regardless.
4. Run the migrations in `migrations/` before using Stage 17–21 features; those
   layers depend on tables the SQL creates.
5. Smoke test: `/api/health` → `{"ok":true}`, `/api/version` →
   `scoip-v1.1.5-parity-plus-guards-2026.08.24`.

## Still open

Unchanged from v1.1 — these are content and external-certification items, not defects:

- Live Gemini provider certification (`npm run pilot:eval:live`) once configured.
- Deployed Vercel end-to-end run.
- Dependency lockfile after registry access.
- Restore/PITR rehearsal before persistent confidential client data.
