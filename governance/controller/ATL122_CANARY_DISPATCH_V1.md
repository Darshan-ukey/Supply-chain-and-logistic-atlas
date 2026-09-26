# ATL-122 — Live Worker-Dispatch Bridge Canary: Dispatch Record

**Status:** DISPATCH ISSUED — AWAITING BUILDER (ChatGPT) PICKUP
**Controller (this dispatch):** Claude, session `https://claude.ai/code/session_01M8i9bTBMW63squ3KmxEhC2`
**Governing task:** ATL-122
**Envelope schema:** `schemas/worker-job-envelope-v1.schema.json`

## Why this exists

`tools/atlas-release-controller/canary.mjs` (branch `atlas-v2-temp-release-controller`) already proves the controller's eligible→build→verify→rework→QA→land→sync state machine against a **synthetic, self-contained task graph** — its own header states explicitly that it does *not* prove live dispatch against real Linear/GitHub/agent infrastructure, and that a live-dispatch proof "must be run once with a human watching before ATL-120 is trusted with real task dispatch." This record is that live-dispatch proof, run under the ATL-100 Linear-first interim protocol (direct API adapters deferred per ATL-122's own interim architecture amendment).

## Job envelope — Step 1 (Controller → ChatGPT, BUILDER role)

```json
{
  "jobId": "atl122-job-001-chatgpt-builder",
  "idempotencyKey": "atl122-canary-2026-09-26-001",
  "taskRef": "ATL-122",
  "role": "BUILDER",
  "assignedAgent": "Agent — ChatGPT",
  "allowedScope": {
    "branch": "atl-122-canary-2026-09-26",
    "pathAllowlist": ["artifacts/atl-122-canary/CANARY_FIXTURE.md"],
    "operationAllowlist": ["APPEND_ONE_LINE_AT_MARKER"]
  },
  "immutableInputs": {
    "inputRefs": ["atl-122-canary-2026-09-26:artifacts/atl-122-canary/CANARY_FIXTURE.md"],
    "inputHashes": {
      "artifacts/atl-122-canary/CANARY_FIXTURE.md": "b91a1a79262fc315fbdc18e1280f05e3baf89949"
    }
  },
  "expectedOutputs": {
    "description": "Replace the line '<!-- CANARY_INSERT_POINT -->' in the fixture with exactly the literal line below (no other change to the file, no change to any other file on this branch), then commit and push to the named branch.",
    "verifiableClaim": "CANARY_LINE: atl122-canary-2026-09-26-001 inserted-by=ChatGPT"
  },
  "evidenceLocation": {
    "type": "GITHUB_COMMIT",
    "target": "atl-122-canary-2026-09-26:artifacts/atl-122-canary/CANARY_FIXTURE.md"
  },
  "timeoutPolicy": {
    "maxWaitHours": 24,
    "onTimeout": "FAIL_CLOSED_NO_SILENT_SUBSTITUTION"
  },
  "stopConditions": [
    "WORKER_ENDPOINT_UNAVAILABLE",
    "EVIDENCE_MISSING",
    "HASH_MISMATCH",
    "OUT_OF_SCOPE_MUTATION",
    "SELF_QA_ATTEMPT",
    "DUPLICATE_IDEMPOTENCY_KEY_ALREADY_TERMINAL"
  ],
  "issuedAt": "2026-09-26T09:25:00+05:30",
  "issuedBy": "Claude (controller role, this dispatch)"
}
```

## Required exact edit

In `artifacts/atl-122-canary/CANARY_FIXTURE.md` on branch `atl-122-canary-2026-09-26`, replace the marker line

```
<!-- CANARY_INSERT_POINT -->
```

with exactly:

```
CANARY_LINE: atl122-canary-2026-09-26-001 inserted-by=ChatGPT
```

No other file, and no other line of this file, may change. This is the bounded scope; anything wider is a stop condition (`OUT_OF_SCOPE_MUTATION`).

## Step 2 (planned) — Controller → Claude, INDEPENDENT_REVIEWER role

Once GitHub evidence for Step 1 exists, ownership routes to `Agent — Claude` + `Awaiting Independent QA` on ATL-122 (identical mechanics to the ATL-119 crossed-QA cycle already run in this session). The reviewing agent must independently confirm, from the committed diff alone:

1. Exactly and only the required line replaced the marker (byte-exact).
2. No other file on `atl-122-canary-2026-09-26` changed.
3. The committing identity is not the same actor recorded as controller/dispatcher for this job (builder ≠ reviewer — the reviewer here, Claude, is also not the builder, so this is inherently satisfied for this canary run; the same-actor check is exercised structurally by the envelope's `role` field and by `canary.mjs`'s existing self-QA-refusal unit test, not re-derived here).
4. Commit hash and diff are durable (`git show`), not a pasted claim.

Disposition, and the terminal record, will be appended to this file and to ATL-122 in Linear. No merge to any protected branch is required or authorized — evidence lives on the disposable branch and in this governance-branch record.

## Negative controls exercised so far (structural, via `canary.mjs`, pre-existing)

These are already proven at the control-flow level and are not re-run per real-dispatch attempt: same-actor QA refusal, landing-before-QA refusal, forged owner-grant refusal. What this dispatch adds is the piece `canary.mjs` explicitly disclaims: a real external worker (ChatGPT) acting on a real bounded job issued through real Linear state, with real GitHub evidence, ingested by a real distinct independent reviewer (Claude).

## Current state

`WAITING_ON_BUILDER`. Per ATL-100, hourly watcher latency is acceptable and no Owner intervention is required for this step — ChatGPT's own hourly Linear watcher is the expected pickup mechanism now that ATL-122 carries `Agent — ChatGPT` + `Agent Ready`.
