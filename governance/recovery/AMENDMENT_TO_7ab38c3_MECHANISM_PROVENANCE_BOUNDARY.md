# Amendment to `7ab38c3` — Mechanism Provenance Boundary

**Status:** AMENDMENT — does not rewrite `7ab38c3`, which remains in git history unmodified. This document identifies specific wording in it that implies a relationship between the 43 and the 38 that is not established, and freezes the correct framing going forward. Consistent with this project's own rule against silently overwriting a prior baseline: the original is not edited; this supersedes it in force.

## Why this amendment exists

`7ab38c3` was written before the mechanism-provenance question was settled. At the time it was written, "43 vs 38" read naturally as "did the new run reproduce the old one." It does not — and per the Owner directly: the 43 came from an earlier generator mechanism that crashed and was never documented; the compiler spec now in GitHub (`CANONICAL_WORK_DECOMPOSITION_COMPILER_SPEC_V1_FROZEN.md` @ `c99c3e5`) states its own purpose as making "the previously implicit P6.1 generation procedure reproducible" — **the spec's own words concede the original procedure was never actually documented**, which is direct textual support for treating 43 as forensic output from an unrecoverable method, not a verified target.

## Specific wording identified, and the correction

| Location in `7ab38c3` | Problematic framing | Correction |
|---|---|---|
| Opening line | *"not whether 38 matches 43, but whether..."* | Retained as the right question, but strengthened below — the document should not have gone on to treat 43 as a baseline anyway. |
| Summary line | *"The 5 are NOT yet accounted for at unit level"* | "5" is not a deficit to account for. It is a difference between two outputs of two different, non-comparable mechanisms. Reframe: *the relationship between the two outputs is not yet characterized at unit level* — which may resolve to zero real gaps, or to some, once B and the reconciliation schema are applied. |
| §1, "Strongest single corroboration" | *"Two independent derivations converging on the same readiness count is meaningful evidence"* | This treats the undocumented historical mechanism as a valid *independent derivation method* whose agreement corroborates the new one. That is not established — the historical mechanism's own validity is precisely what's unknown. The `EXECUTOR_READY` count matching is still worth noting as a data point, but not framed as two methods corroborating each other. |
| §2 header | *"What the delta actually is, post-regeneration"* | "Post-regeneration" implies the 38 is a regeneration of the 43. It is not a regeneration of anything — it is a first-generation output from a newly governed mechanism that happens to address the same task. Reframe: *"What the difference between the two outputs is."* |
| §2 table | *"Δ vs historical"* | Same issue — "Δ vs historical" frames historical as the reference point being deviated from. Reframe as a side-by-side count comparison, not a delta from a baseline. |
| §5 | *"A per-task delta of −5 units, if it generalised, would compound across 22 tasks"* | "Compound" implies an accumulating error. Reframe: if the *pattern* generalizes (whatever it turns out to be — correct exclusion or real gap), it's worth knowing early rather than late. The number itself is not evidence of a growing defect until the reconciliation schema classifies it. |
| §6 | *"Can we defend 38 as correct?"* / *"Can we say we didn't miss the remaining 5?"* | Both questions presuppose 43 as the standard 38 is measured against. Reframe below. |
| §6, "Recommended closure condition" | *"a disposition of collapsed / correctly-excluded / genuinely-missed for each"* | This three-way disposition is superseded by the six-category schema in `P6_1_HISTORICAL_RECONCILIATION_SCHEMA_V1.md`, which distinguishes structural over-expansion from unsupported inference from genuine absence — finer-grained and less presumptive than the original three buckets. |

## The frozen distinction, stated plainly, going forward

- **43** = historical output from an earlier generator mechanism that was undocumented at the time and crashed. It is not recoverable as a procedure — only its output counts are. It is **forensic evidence**, not a specification.
- **38** = output from the reconstructed, governed CR1–CR11 mechanism, built and frozen this month, with rules derived forensically from a diagnosed prior failure (the 64-unit over-decomposition) and independently QA'd.
- **Historical counts (43/37/14/8/15, and the aggregate 603/444/185/163/96) are forensic comparison evidence only — never a correctness target, never a thing the governed mechanism owes agreement with.** This was already CR9's rule for generation; this amendment extends the same rule to how *this project talks about* the numbers afterward, not just how the generator behaves.

**What legitimately survives from `7ab38c3` unchanged:** the actual technical claims — the control inventory in §1 (with the one corroboration line reframed above), the fact that GitHub holds no per-unit historical detail (§4), that Task B is the prerequisite for any real comparison (§4), and the scope caveat that LTL-03 is 1 of 22 (§5). None of those depended on the rerun/reproduction framing and none are retracted.

## What replaces the retracted framing

Any future comparison between the 43 and the 38 uses `P6_1_HISTORICAL_RECONCILIATION_SCHEMA_V1.md`'s six-category classification, applied per unit and per blocker, once `P6_1_SUPABASE_RESTORE_TEST_SPECIFICATION_V1.md` makes the historical tree readable. Both are framework/specification documents only as of this amendment — neither has been executed.
