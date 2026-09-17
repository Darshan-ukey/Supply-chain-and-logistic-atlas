# P6.1 Historical-vs-Reconstructed Reconciliation Schema V1

**Status:** FRAMEWORK ONLY — contains zero actual comparisons. Cannot be populated until Task B succeeds and the historical per-task unit-level tree is readable. This document defines *how* the comparison will be classified and recorded, not what the comparison finds.

## Framing, stated explicitly

This is **not** "find the missing five." That framing presumes the historical 43 is the correct target and anything short of it is a defect. It isn't — see `governance/generation/GENERATOR_V1_HARDENING_NOTES.md` §Mechanism-provenance and the amendment to `7ab38c3` alongside this document: the historical count is forensic evidence from an undocumented mechanism, not a correctness target the reconstruction owes agreement with.

The actual question this schema exists to answer, per unit: **what is this historical unit's relationship to the current governed output — and does that relationship reflect a correct exclusion, a correct collapse, or a real gap?** All six possible answers are treated as legitimate findings. "Absent, and rightly so" is not a lesser outcome than "present."

---

## 1. The six classifications

Applied per historical unit once its content is readable. Criteria are stated so classification is a defensible judgment against frozen source, not a guess.

### `EXACT_SEMANTIC_EQUIVALENT`
A reconstructed unit exists whose source grounding, operation intent, and terminal classification match the historical unit — wording and ID may differ. **Test:** the union of source references is materially the same, and an independent reviewer given both units' content (not IDs) would describe them as the same governed operation.

### `MERGED_COLLAPSED_EQUIVALENT`
Two or more historical units correspond to one reconstructed unit, because the historical mechanism split something the ≥2-independently-source-supported-child threshold (CR2 / contract §4.4) would not have authorized. **Test:** the reconstructed unit's source references are a superset (union) of the merged historical units' references, and none of the merged historical units, individually, would pass the child-acceptance test in `classifyChildren`.

### `HISTORICAL_STRUCTURAL_LEXICAL_EXPANSION`
The historical unit existed only because of lexical/object-model splitting (a noun, a field, a conjunction) without independent child-level execution semantics of its own. **Test:** the unit's content, checked against CR2/CR3, fails the same acceptance test category `MERGED_COLLAPSED_EQUIVALENT` uses — but *without* a corresponding reconstructed unit that subsumes it, because nothing needed subsuming: it shouldn't have existed as a distinct unit at all. Distinguished from `MERGED_COLLAPSED_EQUIVALENT` by absence of a clean 1-or-more-to-1 mapping.

### `HISTORICAL_UNSUPPORTED_INFERENCE`
The historical unit's readiness or content depended on decision criteria, authority, or validation content that frozen source does not independently establish — the historical mechanism appears to have supplied semantic content source didn't ground, not merely over-split structure. **Test:** the unit's `action`/`decisionCriteria`/`authority` content cannot be traced to a specific frozen source passage; distinguished from structural expansion (category above) by being about *invented content*, not *invented boundaries*.

### `GENUINELY_ABSENT_FROM_RECONSTRUCTION`
A real, independently source-grounded, execution-significant operation existed historically and has no equivalent, merged or otherwise, anywhere in the 38-unit reconstruction. **Test:** the unit passes CR1–CR11 acceptance criteria on its own merits, checked against frozen source directly — and nothing in the reconstruction covers it. **This is the only category that constitutes a real defect requiring a fix to the reconstruction or generator.**

### `UNRESOLVED_COMPARISON`
Available information (historical record detail, source clarity, or reconstructed-unit correspondence) is insufficient to place the unit in categories 1–5 with a defensible test result. Requires either more historical detail than the recovered bundle provides, or Owner/ChatGPT judgment. Not a default or a dumping ground — used only when a specific classification was attempted and could not be defended.

---

## 2. Per-unit record schema

```json
{
  "historicalUnitRef": {
    "taskId": "string",
    "historicalUnitId": "string or path, as recovered from the protected bundle",
    "historicalContentSummary": "string, quoting/paraphrasing the recovered content"
  },
  "reconstructedUnitRef": {
    "reconstructedUnitId": "string, or null if no candidate correspondence exists"
  },
  "classification": "one of the six values above",
  "classificationBasis": "explicit reasoning citing the specific frozen source passage(s) relied on",
  "sourceRefsHistorical": ["array of source refs the historical unit cited"],
  "sourceRefsReconstructed": ["array, or null"],
  "reviewer": "Claude | ChatGPT | Owner",
  "independentlyConfirmed": "boolean — true only after a second reviewer checked the same test independently"
}
```

Every record is one unit. A merge (`MERGED_COLLAPSED_EQUIVALENT`) produces multiple historical-side records pointing at the same `reconstructedUnitRef`, not one combined record — so the count of records always equals the historical unit count, and the classification distribution is directly auditable against the aggregate delta.

---

## 3. Knowledge-gap blocker reconciliation — same taxonomy, scoped to blockers

Applied specifically to the historical 15 vs. reconstructed 11 `BLOCKED_BY_KNOWLEDGE_GAP` instances for LTL-03, using the same six classifications with blocker-scoped criteria:

| Classification | Blocker-scoped meaning |
|---|---|
| `EXACT_SEMANTIC_EQUIVALENT` | The same real gap is blocked in both, possibly under a different ref label. |
| `MERGED_COLLAPSED_EQUIVALENT` | Multiple historical gaps were properly consolidated onto one unit's blocker list after correct unit merging. |
| `HISTORICAL_STRUCTURAL_LEXICAL_EXPANSION` | The gap only existed because its carrying unit was itself an over-split lexical artifact (category above) — the gap disappears because the unit correctly does, not because the gap was resolved. |
| `HISTORICAL_UNSUPPORTED_INFERENCE` | The historical mechanism flagged something as a gap based on its own unsupported assumption about what *should* be required, rather than a gap source actually leaves open. |
| `GENUINELY_ABSENT_FROM_RECONSTRUCTION` | A real, source-grounded gap that the historical run correctly identified and the reconstruction has somehow resolved or dropped without genuine grounding for doing so. **This is the specific check that would catch a false READY** — the direction of error that matters most, since losing a genuine blocker is more dangerous than losing a genuine ready-unit. |
| `UNRESOLVED_COMPARISON` | Same as above — insufficient information. |

### Per-blocker record schema

```json
{
  "historicalBlockerRef": {
    "taskId": "LTL-03",
    "historicalUnitId": "string",
    "historicalBlockerReason": "string, as recovered"
  },
  "reconstructedBlockerRef": {
    "reconstructedUnitId": "string or null",
    "reconstructedBlockerRef": "string or null — must be one of the generator's governed refs (e.g. MISSING_DECISION_CRITERIA), not free text"
  },
  "classification": "one of the six values",
  "classificationBasis": "string",
  "reviewer": "Claude | ChatGPT | Owner",
  "independentlyConfirmed": "boolean"
}
```

**Deliberate emphasis:** for the blocker-level reconciliation specifically, `GENUINELY_ABSENT_FROM_RECONSTRUCTION` deserves the most scrutiny of any cell in either schema. A missing *ready* unit is a completeness problem. A missing *blocker* is a soundness problem — it means something the reconstruction currently calls safe may not be. Both schemas are structurally identical, but this is where review time should concentrate first once B unblocks this.

---

## 4. What happens once Task B succeeds

1. Extract the historical per-unit tree for LTL-03 from the recovered bundle.
2. Populate one record per historical unit (unit-level schema) and one per historical knowledge-gap blocker (blocker-level schema).
3. Every classification requires `classificationBasis` citing actual frozen source — no record is accepted with a bare label and no reasoning.
4. A second reviewer (ChatGPT, if Claude classified; Claude, if ChatGPT classified) independently re-derives at least the `GENUINELY_ABSENT_FROM_RECONSTRUCTION` and `UNRESOLVED_COMPARISON` records before `independentlyConfirmed` may be set true — these are the two classifications where being wrong matters most.
5. Only after that does an aggregate summary get written. The aggregate is a rollup of confirmed individual records, never a starting point.

No comparison exists yet. This document is the template it will be poured into.
