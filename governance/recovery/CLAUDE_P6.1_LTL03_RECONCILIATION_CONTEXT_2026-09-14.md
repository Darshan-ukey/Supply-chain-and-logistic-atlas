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

## Tree-delta analysis now complete
ChatGPT completed the requested forensic analysis in:
`governance/recovery/P6.1_LTL03_TREE_DELTA_ANALYSIS_RESULT_2026-09-14.md`
Governance commit: `3b07e253cd17af3e5883dc4dd9b58ead004c5b49`.

Disposition:
`P6_1_V1_LTL03_TREE_DELTA_ANALYSIS_COMPLETE__READY_FOR_REGENERATION`

Decisive finding:
- historical 43 units / 37 leaves => 6 internal nodes total = TASK_ROOT + only 5 additional composite units;
- current 64 / 48 => 16 internal nodes total = TASK_ROOT + 15 composite units;
- therefore current reconstruction over-expanded the 20-step frozen `workDecompositionSeed` and created 10 extra internal nodes / 21 extra total units.

Readiness drift is separate but related: generated elaboration added during reconstruction cannot itself become new source authority proving `EXECUTOR_READY`. Readiness must be proven from pinned pre-generation governed source.

## Corrected deterministic rules to review
The result defines R1-R10. Key controls:
1. preserve each `workDecompositionSeed` item as a primary unit;
2. split only when frozen source contains genuine child-level execution contracts;
3. no lexical/object-model/claim-per-unit decomposition;
4. source-only readiness proof;
5. sequence inference may establish ordering, not missing operational semantics;
6. missing child-level execution semantics fail closed;
7. propagate client-binding dependencies instead of creating post-binding ready inflation;
8. generic validation categories are not executable without actual validation criteria;
9. missing authority/source precedence is a knowledge gap;
10. historical counts are validation evidence, never generation targets.

## Next action for Claude
Do NOT continue QA on `2291905...` and do NOT edit individual leaves of `dae0a31`.

Independently review R1-R10 against:
- frozen Executability & Recursive Decomposition Standard V1;
- frozen Canonical Work Decomposition Contract V1;
- Road LTL 1.5;
- Operational Knowledge v2;
- BOL Information Resolution baseline;
- source claims;
- historical per-task certification.

Return either:
`P6_1_V1_LTL03_GENERATOR_RULE_REVIEW_PASS__REGENERATION_AUTHORIZED_BY_OWNER_REQUIRED`
or
`P6_1_V1_LTL03_GENERATOR_RULE_REVIEW_FAIL__CORRECTION_REQUIRED`
with exact rule-level objections.

Do not regenerate until the rule review passes. Do not mutate protected runtime state, persist WorkDefinitions, merge main, or promote production.