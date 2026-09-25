# ATL-80 — Friction Register Entries FR-02 / FR-03 V0.1

**Source:** Claude independent QA of ATL-80 (`ATL_80_INDEPENDENT_QA_V0_1.md`, commit `775b3122fb9391192907b910360e5ff494f4150c`), findings F3 and F4. Recorded as friction-register entries in the same format and numbering series as `ATL_79_LTL03_REAL_FACT_SCHEMA_DRY_RUN_V0_1.md` §6 FR-01, continuing that series (FR-01 was ATL-79's; these are ATL-80's).
**Date:** 2026-09-22
**Status:** Logged, non-blocking. Neither entry gates ATL-80's PASS or ATL-79's resumption. Both require an Owner/governance decision on whether to promote to a formal Linear prerequisite now or leave deferred.

---

### FR-02 — `REQUIRES_CLIENT_BINDING` / `HAS_KNOWLEDGE_GAP` relationship types remain ungoverned

ATL-60 §5 names `REQUIRES_CLIENT_BINDING`, `REQUIRES_MASTER_DATA` and `HAS_KNOWLEDGE_GAP` as the intended mechanism for carrying a Z1 record's cross-reference to a Z2 client binding or an open knowledge gap. ATL-79's own dry-run describes exactly this kind of cross-reference for two of its four facts — F3's Z2 confidence-threshold boundary (`CB-LTL03-CRITICAL-CONFIDENCE-THRESHOLD`) and F4's Z2 instruction-type-value-set boundary (`CB-LTL03-INSTRUCTION-TYPE-VALUE-SET`) — but only in prose. None of the three named relationship types has a governed `(type_id, type_version)` contract. ATL-80 deliberately scoped itself to only the one relationship ATL-79's BUILD artifact explicitly declared (`RT-ASSOCIATED-WITH` for F1), so this is not a defect in ATL-80's minimality — but it means F3 and F4's Z2 boundaries currently cannot be persisted as actual `atlas_knowledge_relationships` rows, only described in a design document.

**Potential severity:** non-blocking today, material soon — the moment any fact needs its Z2 boundary or a Mechanism-1 knowledge gap actually written as a governed relationship row (rather than descriptive text in a dry-run artifact), this becomes a blocking prerequisite of exactly the same shape ATL-80 was for type/version pinning.

**Required decision:** either (a) pre-empt this now by extending ATL-80 (or a small follow-on task) to define governed `(type_id, type_version)` contracts for `REQUIRES_CLIENT_BINDING` and `HAS_KNOWLEDGE_GAP` under the same Linear-first discovered-prerequisite rule that created ATL-80, or (b) leave it deferred and accept that the first task needing to persist a real Z2-boundary or gap-linkage row will discover and block on it the same way ATL-79 discovered FR-01. Either is defensible; this entry exists so the decision is made deliberately rather than the gap being rediscovered cold.

No correction is made inside ATL-80 for this entry — consistent with the project's own rule that a discovered prerequisite is not repaired inline.

### FR-03 — `RT-ASSOCIATED-WITH@1.0.0`'s `association_role` is unconstrained free text

The relationship type's only semantic content field is `association_role: {"type": "string"}` with no enum, no governed value list, and endpoint constraints that (via `ET-BUSINESS-OBJECT`'s deliberate genericness) permit almost any business-object-to-business-object edge. For its single current use (F1, role ≈ the Reference/PRO distinction) this is adequate. Nothing currently prevents it from becoming a catch-all edge type distinguished only by uncontrolled role strings as more facts are mapped through it.

**Potential severity:** low today (single instance, well-understood use); rises as more relationships route through this one type without a governed vocabulary for `association_role`.

**Required decision:** no action needed now. Revisit once a second or third materially different `association_role` value is actually needed — per ATL-60 §8's extension protocol, decide then whether recurring roles should be promoted to a governed enum on this type or split into more specific relationship types. Recorded so this isn't silently treated as permanently fine.

---

## Handoff

Both entries are logged only; neither blocks ATL-80's governed-complete status or ATL-79's resumption (confirmed in the companion bounded-recheck record, `ATL_80_F1_F2_BOUNDED_RECHECK_V0_1.md`). Claude did not write to GitHub. This file and the shared-log append fragment are the complete handoff for these two entries.
