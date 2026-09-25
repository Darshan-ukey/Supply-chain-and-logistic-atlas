# ATL-80 — Independent QA V0.1

**Task:** ATL-80 / logical ATL-79A — Governed Seed Knowledge-Type Registry Contract (Linear ATL-81 / logical ATL-80B)
**QA owner:** Claude (independent)
**Date:** 2026-09-22
**Disposition:** **PASS_WITH_BINDING_CORRECTIONS**

This artifact is the Owner-provided copy of Claude's independent QA handoff after Claude's GitHub push was rejected by its git proxy. It is persisted by ChatGPT without changing Claude's substantive findings.

## Verified audit result

Claude followed LINEAR → MANIFEST → GOVERNANCE → ARTIFACT STATE → QA, independently verified BUILD `66217aa95280d468d159467d409a5424c197e9bc` and first-party VERIFY `02653d8826c44bf03b40974176184293f9bcd56d`, checked the governing inputs, confirmed zero literal backslash-n corruption, and independently confirmed no Supabase migration beyond `20260908015858`.

## Per-criterion disposition

| # | Criterion | Result |
|---|---|---|
| 1 | Every type used by ATL-79 has a stable type ID and explicit version | PASS |
| 2 | Semantic meaning and required extension attributes are machine-validatable | PASS WITH BINDING CORRECTION — F1 |
| 3 | Every relationship used by ATL-79 has a stable type ID/version and endpoint constraints | PASS |
| 4 | Later semantic change requires successor type version | PASS WITH BINDING CORRECTION — F2 |
| 5 | No LTL/BOL-specific type is falsely universalized | PASS |
| 6 | Pack is sufficient for ATL-79 criterion #3 without invented versions | PASS |
| 7 | No physical Supabase DDL/mutation required | PASS |

Scope minimality: PASS.

## F1 — BINDING_CORRECTION_REQUIRED

`ET-BUSINESS-OBJECT@1.0.0` has no required fields, so an empty semantic payload validates.

Required correction:
- add `"required": ["object_kind"]` to the schema contract;
- require `distinction_rules` at governed write time when source evidence establishes a distinction from a similar object, including ATL-79 F1 Reference/PRO.

## F2 — BINDING_CORRECTION_REQUIRED

The design describes successor versions but does not explicitly make persisted type-registry rows immutable.

Required correction:
- add to ATL-60 §9 that a persisted `(type_id,type_version)` row in entity/relationship type registries is immutable; schema contract, endpoint constraints and semantic definition never change in place;
- add the same pack-specific immutability rule after ATL-80 §6.

## Non-blocking findings

- F3: `REQUIRES_CLIENT_BINDING` / `HAS_KNOWLEDGE_GAP` relationship types remain ungoverned. Not required by ATL-79's declared scope; log as near-term prerequisite.
- F4: `RT-ASSOCIATED-WITH@1.0.0` association_role is free text. Adequate for current single use; revisit once recurring role values justify governance.
- F5: straight-through-processing terminology is cross-domain and does not violate criterion 5.
- Status vocabulary is coherent with ATL-60.

## Overall disposition

**PASS_WITH_BINDING_CORRECTIONS.**

ATL-80 and ATL-79 remain blocked until F1/F2 are applied and independently rechecked. F3–F5 are non-blocking.

After correction: first-party verify both fixes and corruption checks; bounded independent recheck of F1/F2; only then govern ATL-80 PASS and rerun ATL-79's complete frozen verification matrix.
