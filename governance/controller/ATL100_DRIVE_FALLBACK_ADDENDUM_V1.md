# ATL-100 Addendum — Drive-Sourced GitHub Landing Fallback V1

**Status:** ACTIVE ADDENDUM to the Atlas Cross-Agent Landing, Frozen-Asset & Shared-Log Protocol V1
**Trigger for writing this:** Claude previously lacked confirmed GitHub write access in an earlier session on this task. That has since been proven (direct push access confirmed 2026-09-26 to both `main` and `atlas-governance-registry-v2.1`). This addendum exists so that if the same failure mode recurs in a future session — Claude has material, correct output but cannot write it to GitHub — there is a durable, pre-agreed fallback rather than an ad hoc one.

## When this applies

Claude (or any GitHub-write-incapable worker) has produced a governed artifact, has mirrored or can mirror it to Google Drive custody (the existing pattern already used across task manifests, e.g. `governance/task-manifests/ATL-119.yaml`'s Drive `file_id` entries), but cannot commit it to the authorized GitHub branch/path directly.

## Fallback sequence

1. **Do not fabricate a landing.** Claude does not claim a commit exists, does not simulate one, and does not treat the Drive copy alone as equivalent to durable GitHub evidence — GitHub remains the durable evidence plane per ATL-100.
2. **Persist to Drive first**, with: exact target GitHub path, target branch, the full intended content (or a diff against a named base commit/blob SHA), and a content hash.
3. **Add `GitHub Landing Required` + `Agent — ChatGPT`** to the governing Linear issue (not ATL-100 itself, unless ATL-100 is the task in question) — mirroring the existing ATL-100 read-only-builder flow, made explicit here for the Drive case specifically.
4. **Post a Linear comment that names, explicitly, what to push from Drive to GitHub** — not a vague pointer. Minimum required fields:
   - Drive file ID / title.
   - Exact target repository path and branch.
   - Base commit/blob SHA the change is relative to (so ChatGPT can detect drift before landing).
   - Content hash of the intended final file, so ChatGPT (or any landing operator) can verify byte-fidelity after commit rather than trusting the copy.
5. **ChatGPT (or the available landing-capable agent) lands the artifact byte-exact** — per existing ATL-100 rule, a landing operator may add separate metadata/provenance but must not silently rewrite the substantive content.
6. **Landing operator re-fetches and verifies** the committed identity against the content hash from step 4, then posts the resulting commit SHA back on the same Linear issue.
7. **Ownership then returns** to whichever agent role is next in that issue's own flow (independent QA, further build, etc.) — this addendum only replaces the "who writes GitHub" step, not the surrounding crossed-QA mechanics, which are unchanged.
8. **If Drive itself is unavailable or the write is refused** (the existing ATL-100/ATL-119 manifest history notes Drive writes have previously returned "No approval received"), fail closed: record the blocker on the issue, do not silently drop the artifact, and do not attempt an unverified direct GitHub write as a workaround.

## Why "ask ChatGPT what to push from Drive," specifically

This keeps the handoff a single, explicit, verifiable instruction rather than an open-ended "please sync Drive to GitHub" — the landing operator should never have to infer which of potentially several Drive documents is the intended one, or reconstruct scope from conversation history. Every field in step 4 exists to make the landing operator's job mechanical: given this hash, this path, this base — land exactly this, and prove it landed exactly this.

## Relationship to existing ATL-100 text

This does not change ATL-100's existing authority boundaries (landing is not independent QA; no self-authorized next stage; no merge/deploy/promote authority created here). It specifies, in the Drive-sourced case only, what the existing "persist exact material output + evidence + hashes + target path + proposed log entry in governed Drive/handoff location" instruction concretely requires.
