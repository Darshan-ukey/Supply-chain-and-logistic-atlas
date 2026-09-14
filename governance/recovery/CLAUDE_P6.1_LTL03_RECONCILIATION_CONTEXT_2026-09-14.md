# Claude context — P6.1 V1 LTL-03 historical reconciliation

Read first with `governance/recovery/P6.1_LTL03_HISTORICAL_RECONCILIATION_2026-09-14.md`.

## Do not QA the latest authority-blocked artifact
Commit `229190524efb59a196f6d977e7bcabd1d66207fb` is preserved only as an audit experiment. Its blanket `CB-LTL03-EXECUTOR-AUTHORITY` conversion is NOT the historical P6.1 V1 rule.

Historical contract evidence says canonical decomposition is executor-neutral and `EXECUTOR_READY` does not mean runtime-certified. Independent executor proof is separately tracked.

## Certified historical LTL-03 profile recovered
From `P6_1_RECURSIVE_WORK_DECOMPOSITION_CERTIFICATION.json @ ba9d47f...`:
- 43 work units
- 37 leaves
- 14 EXECUTOR_READY
- 8 BLOCKED_BY_CLIENT_BINDING
- 15 BLOCKED_BY_KNOWLEDGE_GAP
- content hash `4563feae1776761c1cb542ffaf737c852b1162238fc6bad61071dae16f420555`

The full 22-task totals remain 603 / 444 / 185 / 163 / 96.

## Current regenerated artifact before authority overblocking
`dae0a3197d692b0482ce61b8398f170141f92ea6` = 64 / 48 / 38 / 7 / 3.

This means the current reconstruction is +21 units, +11 leaves, +24 ready leaves, -1 client blocker, -12 knowledge blockers versus the certified LTL-03 historical profile.

## What to do next
Do NOT force the historical counts. Use them as evidence that the current compiler/reconstruction semantics are drifting.

Independently analyze the 64-unit tree and identify:
1. over-decomposition caused by workflow/lexical splitting not supported by historical P6.1 rules;
2. leaves marked ready using detail added during the 2026-09-14 correction rather than detail present in the frozen pre-P6.1 source;
3. unresolved canonical semantics that should be knowledge-gap blockers under the frozen V1 contract;
4. client-specific values/configuration that should be client-binding blockers;
5. the smallest deterministic rule corrections that explain the historical shape without hard-coding counts.

Use exact frozen sources and standards only. Return a delta table with columns:
`currentWorkUnitId | currentStatus | sourceSupport | historicalRuleIssue | proposedDisposition | reason`.

Then report whether a source-grounded deterministic regeneration can reasonably converge toward the historical semantic shape. Do not mutate protected runtime state, persist WorkDefinitions, merge main, or promote production.

Required disposition string:
`P6_1_V1_LTL03_TREE_DELTA_ANALYSIS_COMPLETE__READY_FOR_REGENERATION`
or
`P6_1_V1_LTL03_TREE_DELTA_ANALYSIS_INCONCLUSIVE__STOP`.
