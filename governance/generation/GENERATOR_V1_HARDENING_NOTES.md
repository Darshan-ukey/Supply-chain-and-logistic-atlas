# Generator V1 Hardening Notes

**Status:** DRAFT_CANDIDATE — NOT OWNER-FROZEN
**Original:** `tools/generate-canonical-work-decomposition-v1.mjs` @ `00bb8bb` (blob `c92c109…`)
**Hardened:** same path @ this commit (blob `05dbd99…`)
**Method:** empirical probing before any code was written — every defect below was reproduced and confirmed against the original before being fixed, then re-verified fixed against the same probe.

---

## Defect 1 — only the first applicable blocker was reported

**Probe:** a unit with four simultaneous, independently genuine gaps (missing decision criteria, missing validation rule, missing authority, missing failure semantics).

**Confirmed:** `blockerRefs: ['MISSING_DECISION_CRITERIA']` — the other three real gaps were invisible in the output. Anyone auditing for completeness would see one problem and reasonably assume it was the only one.

**Fix:** `deriveStatus` now evaluates every applicable rule and unions every resulting ref before deciding status. Re-verified: the same input now yields all four refs, deterministically sorted.

---

## Defect 2 — a unit could reach `EXECUTOR_READY` with no governed operation

**Probe:** a seed with exactly one genuinely source-supported child contract (below the ≥2 split threshold, which is itself correct per the contract), where the seed itself declared no action of its own.

**Confirmed:** the emitted unit had `action: null` and `status: EXECUTOR_READY`. The one real, source-grounded action that existed one level down was discarded entirely — not merged, not flagged, not visible anywhere in the output.

This directly violates the historical V1 terminal test's own requirement: a leaf is ready only when source is sufficient to identify "one unambiguous operation." A null action is not one.

**Fix:** `EXECUTOR_READY` now has a structural floor — a unit must have a non-null `action` or `decisionCriteria` or it fails closed to `BLOCKED_BY_KNOWLEDGE_GAP` with an explicit `MISSING_ACTION_OR_DECISION` ref. The floor is asserted twice: once in `deriveStatus`, and again as an independent invariant in `validateGraph`, so no future code path that constructs a unit without going through `normalizeUnit` can bypass it silently.

**Explicit design choice, not decided unilaterally:** when a unit falls below the split threshold, its one accepted child's content is **not** auto-merged into the parent. Merging would invent a structural decision the source did not make. Instead the loss becomes *visible* via the new audit trail (below) and, where it leaves the unit genuinely ungrounded, the unit fails closed rather than silently passing. Flagging this for review rather than treating it as settled.

---

## Addition — child-contract audit trail

Every seed that declares candidate `childContracts` now carries a `childContractAudit` object on whichever unit ends up representing it (container or primary), recording: how many were declared, how many were accepted, whether the split threshold was met, and — for each rejected candidate — its ID and rejection reason.

This exists because Defect 2's underlying condition (candidates existed, one or more were rejected or fell below threshold, and the result gave no trace of that) is precisely the "did we silently drop something" question this whole generation effort needs to be able to answer by inspection, not by re-deriving from source by hand.

---

## Addition — runtime/adapter contamination guard, defense in depth

`normalizeUnit` already only copies a fixed allow-list of fields, which structurally prevents Malkom/RPA/agent-shaped input keys from reaching canonical output. `validateGraph` now additionally asserts this as an independent invariant against a named list of forbidden keys, so contamination would be caught even if a future code path bypassed `normalizeUnit`.

---

## What was verified correct and left unchanged

- The ≥2 child-split threshold matches the contract's own language exactly ("at least two distinct child-level execution contracts") — this is a governed rule, not a bug, and was initially mis-flagged as one before re-checking against the source text.
- Seed order within a task is preserved as given (source order), never re-sorted — confirmed correct per contract §4 ("read... in source order"), distinct from task order across a module, which *is* canonically re-sorted for reproducibility regardless of input array order.
- Slug-based task-ID collision (e.g. `LTL-03` vs `ltl_03`) fails closed via the existing duplicate-ID check — confirmed this already worked correctly.
- The knowledge-gap-before-client-binding precedence, when both could apply to the same unit, is correct per the reconstruction baseline's own CR5 language ("client work is understood" is a precondition for the client-binding classification) — confirmed via explicit test, not just left alone by assumption.

---

## Scope note

This hardening pass covers the generator implementation only. It does not run the generator against real Road LTL source, does not compare output to historical counts, and does not authorize freezing the contract or the generator. See `governance/generation/GENERATOR_V1_STATUS_AND_BOUNDARIES.md` for the full status record against the Owner's task package.
