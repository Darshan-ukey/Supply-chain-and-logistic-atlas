# Atlas Shared Executor Logging Standard V1

Status: **OWNER_AUTHORIZED STANDING STANDARD**  
Effective: 12 September 2026  
Applies to: **ChatGPT and Claude** for all Atlas audit, governance, implementation, recovery, architecture, branch, deployment-forensics and certification work.

## 1. Purpose

`claude_chatGPT.md` is the mandatory shared coordination record between ChatGPT and Claude. The Owner must not be required to relay findings, decisions, progress or handover state manually between executors.

This requirement is compulsory, not advisory.

## 2. Mandatory logging checkpoints

For every material Atlas action, both ChatGPT and Claude MUST:

### A. PRE-ACTION LOG
Before mutation, branch work, stage execution, architecture action, forensic action that may affect decisions, or certification activity:
- read the latest `claude_chatGPT.md`;
- record executor, stage, intended action, source branch/SHA where applicable, scope, relevant guardrails and next immediate action;
- confirm the action is authorized by the current queue/governance state.

### B. MATERIAL-FINDING LOG
Immediately after any material finding that can change scope, architecture, lineage, implementation, version selection, asset custody, readiness, risk, deployment interpretation or next action:
- append the finding to `claude_chatGPT.md`;
- classify it as verified fact, owner direction, working decision, or hypothesis requiring verification;
- cite repository path/SHA/runtime evidence where available;
- record its effect on CURRENT / DEMO / TARGET where applicable.

Do not wait until the end of the stage if another executor could make a different decision without this finding.

### C. POST-ACTION LOG
After every meaningful build slice, audit checkpoint, governance update, branch operation, merge-readiness result, failed action, defect discovery or resolved blocker:
- record exactly what changed;
- record files/components/branches affected;
- record tests/audits and disposition;
- record latest safe-resume SHA/state;
- record unresolved issues and the exact next action.

### D. STAGE-CLOSURE LOG
A stage may not be marked PASS, COMPLETE, READY_FOR_QA, READY_FOR_MERGE or otherwise advanced unless `claude_chatGPT.md` is current through the final stage action.

A stale shared log makes stage completion invalid.

## 3. Executor handoff rule

Before ChatGPT or Claude starts/resumes work, it must read the other executor's latest entries in `claude_chatGPT.md`.

If the shared log conflicts with the machine queue, repository state, build protocol, handover, or frozen records:
1. STOP;
2. reconcile governance/state first;
3. record the conflict and resolution in `claude_chatGPT.md`;
4. only then continue implementation.

Neither executor may rely on chat memory when the repository shared log can provide the state.

## 4. What counts as a material action

Material actions include, at minimum:
- repository/branch creation, deletion, merge, reset or baseline selection;
- implementation/code/data/schema/UI changes;
- architecture/governance decisions or candidate decisions;
- version/pointer/freeze changes;
- source/data lineage findings;
- Vercel/Supabase/runtime forensic findings that affect Atlas state or cleanup decisions;
- audit PASS/FAIL/FIX_REQUIRED findings;
- regression/security/public-admin findings;
- adapter/projection findings;
- newly discovered gaps, contradictions or stale assumptions;
- stage authorization/closure;
- any failed tool action that may leave ambiguity about repository state.

Trivial read-only lookups that do not affect state or decisions do not require an individual log entry, but their material conclusions do.

## 5. Required entry format

```text
## YYYY-MM-DD HH:MM — <Executor> — <Stage>
Classification: VERIFIED_REPOSITORY_FACT | VERIFIED_RUNTIME_FACT | OWNER_DIRECTION | WORKING_DECISION | HYPOTHESIS
Checkpoint: PRE_ACTION | MATERIAL_FINDING | POST_ACTION | STAGE_CLOSURE

Evidence inspected:
- <path/ref/commit/runtime>

Action / finding:
- ...

Files / branches / components affected:
- ...

Audit / test result:
- ...

Impact / guardrail:
- ...

Current/Demo/Target effect:
- CURRENT: ...
- DEMO: ...
- TARGET: ...

Safe resume point:
- <branch/SHA/state>

Next exact action:
- ...
```

## 6. Logging location and mutation rule

Canonical shared log:
`/claude_chatGPT.md` on `atlas-governance-registry-v2.1`.

- Append/update this file through GitHub; do not keep the authoritative handoff only in chat.
- Do not erase prior material findings to make the file shorter.
- Corrections must preserve the superseded statement and explain the correction where practical.
- The shared log is coordination/governance evidence, not canonical business/domain truth.

## 7. Demo-specific enforcement

During `ATLAS_V2_DEMO_SPRINT`:
- ChatGPT is primary executor and Claude hot backup as governed by the queue.
- Both are subject to this logging standard equally.
- Every D2.0.x PRE/MID/POST audit checkpoint must have corresponding shared-log coverage.
- D2.0.6 merge-readiness certification is invalid if shared-log continuity is incomplete.
- D2.0.7 merge to `main` is invalid if the final certified SHA and Owner approval are not logged first.
- No Vercel deployment/promotion is authorized; any finding suggesting a GitHub action may trigger Vercel must be logged before proceeding.

## 8. Standing enforcement rule

**NO LOG → NO ADVANCE.**

If either executor fails to update the shared log after a material action, the next executor must treat state as potentially stale, stop before further mutation, reconstruct the missing entry from repository evidence, and record the reconciliation before continuing.
