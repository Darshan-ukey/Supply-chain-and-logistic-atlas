# P6.1 Historical Bundle — Read-Only Restore-Test Specification V2

**Status:** SPECIFICATION ONLY — not executed. Supersedes V1 in force. V1 remains in git history unmodified.

**What changed from V1, and why:** V1 only retrieved and verified a row against production — that is retrieval-plus-verification, not a restore-test. It also left the hash domain ambiguous, assumed the export would be clean without addressing what the query tool itself might already have transformed, and assumed a single canonicalization for per-task hashing without establishing what canonicalization the certification actually used. V2 fixes all four by making them explicit, testable steps rather than assumptions.

**Provenance note:** this V2 was drafted independently in direct response to the same four issues, and landed in parallel with ChatGPT's own independent QA of V1 (`CHATGPT_INDEPENDENT_QA_823f5d9.md`), which identified the same four gaps (its B-1 through B-4) by separate review. That convergence — two independent passes reaching the same required corrections — is itself worth noting. Two of ChatGPT's specific points sharpened what this V2 initially had: comparing the table's own stored `content_hash` column directly before any recomputation (§5, Step 0), and a stricter rule that a per-task hash match under an unproven method is diagnostic, not certifying (§7). Both are incorporated below.

---

## 1–4. Source table, expected row identity, encoding discrepancy — unchanged from V1

Carried forward without modification: table `public.atlas_work_decompositions`, expected identity (`road-ltl`/`1.5`/`1.0.0`/`__ALL_22__`, 1 row), and the open `BROTLI_BASE64` vs `JSONB`/`GZIP_BASE64` discrepancy, resolved empirically at execution time per V1 §3's decision rule, not assumed either way.

---

## 5. Hash-domain matrix — replaces V1's single ambiguous "decoded payload" hash

**Step 0, added per ChatGPT's independent QA of this spec's V1 predecessor — check before computing anything.** The table itself carries a `content_hash` column (`migrations/p6-1-protected-work-decompositions.sql`), populated at write time by whatever process inserted the row. Compare that stored value directly against `protectedStoreContentHash` and `compileBundleSha256` **first, with zero computation** — a same-table, already-computed value is the strongest, cheapest evidence available, and if it already matches one of the certification fields, that resolves which field the "content hash" concept in this table means before any decode/recompute work is needed.

**Also established from `lib/compile/p6-1-certification-gate.js`:** the actual downstream compilation gate checks a value it calls `governedInputContentHash` against `certifiedContentHash` (sourced from `protectedStoreContentHash`) — confirming `protectedStoreContentHash` is the field that matters for input verification in the governed pipeline. This narrows which certification field is primary; it does not by itself reveal the exact byte-domain, which is still resolved empirically below.

**The core problem V1 didn't resolve, for cases §0 doesn't already settle:** `protectedStoreContentHash` and `compileBundleSha256` are each a hash of *some specific byte string*, and there are at least three plausible candidates for what that string is, each of which hashes differently even for identical underlying content:

| Domain | Definition |
|---|---|
| **H1 — stored-representation hash** | SHA-256 of the `payload` or `payload_compressed_base64` column value exactly as returned by the query, before any decode |
| **H2 — decompressed-bytes hash** | SHA-256 of the byte string after decompression (if `GZIP_BASE64`) or the raw stored string (if `JSONB`), before JSON parsing |
| **H3 — canonical-reserialization hash** | SHA-256 of the parsed content, re-serialized under a defined canonicalization (`atlas-stable-json-v1` — sorted keys, no whitespace, matching the convention already established for the AR0.3 readiness resolver and generator) |

**Procedure:** compute all three (H1, H2, H3) and compare each against both `protectedStoreContentHash` and `compileBundleSha256` — a 3×2 matrix, six comparisons, all reported, not just the first match found. Report exactly which domain (if any) matches which certification field. A mismatch across all six is a materially different finding than a match in exactly one cell, and the specification must not collapse that distinction into a single pass/fail bit.

---

## 6. Exact-export — tightened

**Export happens immediately after row-count confirmation, before any decode or analysis is attempted** — reordered from V1, where export was step 9 (after analysis). If anything goes wrong during decode/analysis, the frozen raw artifact must already exist untouched, not be reconstructed after the fact from whatever state analysis left things in.

**Known limitation, stated rather than assumed away:** the query tool available for this task returns results through its own JSON-RPC interface, which means the row's field values are received already parsed once by that tool before Claude ever sees them. This is *not* the same as capturing the true wire-level response bytes from Postgres. The export captures the strongest form actually available — the tool's returned string value for `payload`/`payload_compressed_base64`, saved verbatim with no further reformatting, JSON re-stringification, or whitespace normalization applied by Claude — but it cannot claim to be a byte-exact capture of what Postgres itself returned before the query tool's own parsing. This limitation is recorded in the exported artifact's own metadata, not discovered later by someone assuming otherwise.

---

## 7. Per-task hashing — the canonicalization-unknown problem, addressed rather than assumed past

V1 assumed recomputing `contentHashSha256` "from the decoded per-task payload" would reproduce the certification's stored values. That assumes the certification used the same canonicalization this restore-test would apply — which is not established anywhere in GitHub.

**Procedure:** compute each of the 22 per-task hashes under **two** methods and compare both against the certification's `perTask[].contentHashSha256`:

- **Method A — raw extraction:** the exact substring/byte-range corresponding to that task's data within the decoded (H2-domain) payload, with no re-serialization at all.
- **Method B — canonical re-serialization:** the task's parsed sub-object, re-serialized under `atlas-stable-json-v1` (same canonicalization as H3).

Report per-task, per-method: match / no-match. A task matching under Method A but not B (or vice versa) is informative — it would indicate the certification's original hash was computed over raw bytes rather than a canonical form, or vice versa — and must be reported as that specific finding, not averaged away into a single pass/fail per task.

**Sharpened per ChatGPT's independent QA — this is diagnostic, not certifying, unless provenance is independently established.** Methods A and B are two well-motivated candidates, not a search for whichever happens to match. A match under one method is *suggestive* of which algorithm the certification originally used; it is not *proof*, because neither method has been confirmed as the one actually used at certification time — no such algorithm citation exists anywhere in GitHub, checked directly. Unless a specific commit or script is found that documents the original hashing method (none is currently known to exist), the per-task result caps at `ALGORITHM_PROVENANCE_UNRESOLVED` even when one method matches all 22 — full PASS on this section requires either that provenance being found, or the Owner explicitly accepting a specific matching method as sufficient despite unconfirmed provenance. This is a stricter bar than treating a match as self-certifying.

---

## 8. Genuine independent restore — the step V1 was missing entirely

V1 ended at "verify the retrieved row against expected values." That is retrieval-plus-verification. It does not demonstrate recoverability, because every check ran inside the same session that still holds the live database connection — nothing was actually *lost and rebuilt*.

**This step makes it a real restore-test, using the same method already proven for the PC-5 readiness-resolver drill: destroy the working context, rebuild from the frozen artifact alone, confirm identical results.**

1. Complete steps 1–7 above inside the live session (**Phase 1**). This produces the frozen raw export (§6) and its full set of computed hashes/counts (§5, §7).
2. Spawn a genuinely separate execution context for **Phase 2** — a new process with **no Supabase credentials, connection string, or MCP tool access passed to it at all**. This is verified, not assumed: the subprocess's environment is inspected to confirm no Supabase-related credential is present before it runs.
3. That isolated process receives **only** the Phase 1 raw export file — no live query, no re-fetch, no access back to the original session.
4. Inside that isolated process, independently repeat: decode (§3–§5's decision rule and H1/H2/H3 computation), structural counts, and both per-task hashing methods (§7).
5. **PASS for this step requires every value computed in Phase 2 to exactly match its Phase 1 counterpart** — same H1/H2/H3, same structural counts, same 22×2 per-task results.

This is what actually proves recoverability: not that the live row matches expectations, but that the *exported artifact alone*, with no database in reach, reproduces everything independently. A restore-test that never removes database access during verification hasn't tested restoration — it's tested retrieval.

---

## 9. Isolated environment note

A throwaway Supabase branch was considered for isolation and is not the right mechanism here: Task B reads one existing row and writes nothing, so there is nothing a database branch would isolate that Phase 2's process-level isolation (§8) doesn't already isolate more directly. Branching remains available if a future task requires it; it is not part of this restore-test.

---

## 10. PASS / FAIL criteria — full replacement of V1 §8

**PASS** requires every one of the following:

- Exactly 1 row (unchanged from V1).
- Encoding resolved to a known, decodable value (unchanged from V1's decision rule).
- Phase 1 export captured before analysis, with its capture-limitation metadata recorded (§6).
- Step 0 direct `content_hash`-column comparison performed first (§5), before any recomputation.
- The H1/H2/H3 × {protectedStoreContentHash, compileBundleSha256} matrix computed in full — 6 results, not a single pass/fail (§5).
- All 22 tasks' per-task hashes computed under both Method A and Method B, each compared, with the result capped at `ALGORITHM_PROVENANCE_UNRESOLVED` unless the original algorithm is independently confirmed or the Owner explicitly accepts a specific method (§7).
- **Phase 2 independent restore (§8) completes and every value matches Phase 1 exactly.** Without this, the result is `RETRIEVAL_VERIFIED_RESTORE_NOT_PROVEN` — a distinct, weaker outcome from PASS, not a rounding-up.
- Zero write operations at any point in either phase, confirmed by reviewing the executed query log.

**FAIL modes, each reported specifically, not collapsed to one generic FAIL:**

- Row-count mismatch → stop immediately, do not attempt decode.
- Zero of the 6 hash-matrix cells match → `HASH_DOMAIN_UNRESOLVED` — the stored content cannot currently be tied to either certification hash under any tested domain.
- Structural counts differ → `STRUCTURAL_MISMATCH`, reported with the specific differing fields.
- Some but not all of 22×2 per-task hashes match → reported per-task, per-method, by `taskId` — this is exactly the granularity the reconciliation schema needs as input.
- Phase 2 does not reproduce Phase 1 → `RESTORE_NOT_PROVEN`, reported with which specific value diverged — this failure mode is the one most worth taking seriously, since it would mean the export itself is insufficient for recovery even though the live row checks out.

**On any FAIL:** stop. No alternate decode attempted, no looser query, no partial export presented as sufficient.
