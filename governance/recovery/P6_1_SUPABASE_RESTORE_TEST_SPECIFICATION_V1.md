# P6.1 Historical Bundle — Read-Only Restore-Test Specification V1

**Status:** SPECIFICATION ONLY — not executed, not authorized to execute by this document alone
**Purpose:** define the exact recovery procedure and PASS/FAIL criteria for Task B *before* any Supabase access occurs, so the procedure itself can be QA'd first.
**Every field below is sourced from a governed artifact already in GitHub, cited exactly. Nothing is assumed.**

---

## 1. Source table / key

| Field | Value | Source |
|---|---|---|
| Table | `public.atlas_work_decompositions` | `migrations/p6-1-protected-work-decompositions.sql` @ `5149e09` |
| Primary key | `decomposition_id` (text) | same |
| Row-selection key | unique on `(module_id, module_version, source_task_id, contract_version)` | same |
| RLS | enabled; `anon`/`authenticated` explicitly revoked; only `service_role` has any privilege | same |

## 2. Expected row identity

| Field | Expected value | Source |
|---|---|---|
| `module_id` | `road-ltl` | Certification @ `07208535`, field `moduleId` |
| `module_version` | `1.5` | same, `moduleVersion` |
| `contract_version` | `1.0.0` | same, `contractVersion` |
| `source_task_id` | `__ALL_22__` (aggregate sentinel, not a real task ID) | Certification `backend.aggregateSourceTaskId` |
| Expected physical row count for this query | exactly **1** | Certification `backend.physicalRowCountExpected` |
| Expected logical task count represented inside that row | **22** | Certification `backend.logicalTaskCountExpected` |

## 3. Expected encoding — OPEN DISCREPANCY, flagged rather than assumed

The certification's `backend.payloadEncoding` field states **`BROTLI_BASE64`**.

The table's own schema, per its migration chain (`5149e09` then `72fcfd5`, both read in full — no later migration to this table exists in any branch), enforces a check constraint permitting **only** `payload_encoding IN ('JSONB', 'GZIP_BASE64')`. `BROTLI_BASE64` is not a value the constraint allows the stored column to hold.

**This is not resolved here.** Three explanations are possible and the restore-test's first read-only step (§6, step 1) must distinguish them before proceeding:

1. `backend.payloadEncoding` in the certification describes a **transport/export** encoding (e.g. how the compiler packages data when it *leaves* the table), distinct from the stored `payload_encoding` column — in which case the two are not in conflict and simply describe different stages.
2. The schema was changed after `72fcfd5` in a way not committed to GitHub — an untracked drift, itself a finding.
3. The certification's field is stale or wrong.

The restore-test procedure does not assume any of these. It reads the actual stored `payload_encoding` value from the row and reconciles it against both possibilities before choosing a decoder.

## 4. Expected protected-store hash

| Field | Value | Source |
|---|---|---|
| `protectedStoreContentHash` | `2c26e760ff6a5b3d4a0500d22f79b531a92fb8380d5b31d2a60b8b49506092ab` | Certification `protectedBundle.protectedStoreContentHash` |
| `compileBundleSha256` (distinct field — do not conflate) | `6a8ff9d11e8ee93da668452e9a083eef7f2a1ac07ac7f5815d6baf18a000cf8a` | Certification `protectedBundle.compileBundleSha256` |

**These are two different hashes of two possibly different things** (the protected store's content vs. a compiled bundle). The restore-test must state, empirically, which hash the retrieved row's payload actually reproduces — not assume it is the one the Owner asked about.

## 5. Decoder / decompression method

Determined conditionally on §3's outcome, in this order, each step logged:

1. Read `payload_encoding` from the row.
2. If `'JSONB'`: `payload` column is already structured JSON — no decode step; use directly.
3. If `'GZIP_BASE64'`: base64-decode `payload_compressed_base64`, then gzip-inflate, then JSON-parse.
4. If the value is `'BROTLI_BASE64'` or anything else the migration's constraint should not permit: **stop and report the exact stored value** rather than guessing a decoder for it — this itself would be the finding from §3.

No decoder is applied speculatively. If the encoding value does not match a known method above, decoding does not proceed.

## 6. Expected reconstructed bundle hash / counts

After successful decode, the reconstructed JSON payload must satisfy, all independently checked:

| Check | Expected |
|---|---|
| SHA-256 of the decoded payload | matches `protectedStoreContentHash` (§4) — **or** the discrepancy is reported explicitly if it instead matches `compileBundleSha256`, or matches neither |
| Task count | 22 |
| Total work units | 603 |
| Leaf count | 444 |
| `EXECUTOR_READY` count | 185 |
| `BLOCKED_BY_CLIENT_BINDING` count | 163 |
| `BLOCKED_BY_KNOWLEDGE_GAP` count | 96 |
| Per-task `contentHashSha256` (all 22) | matches the 22 values already in `governance/baselines/P6_1_RECURSIVE_WORK_DECOMPOSITION_CERTIFICATION.json` `perTask[]` — this is the strongest available check, since it is 22 independent hash comparisons, not one aggregate count |

## 7. Isolated restore-test steps

**Environment:** a throwaway/branch Supabase context if `mcp__Supabase__create_branch` is available and approved; otherwise a read-only query against production with zero write operations issued at any point. No `apply_migration`, no `execute_sql` containing `insert`/`update`/`delete`/`alter`/`drop`, ever.

1. `list_tables` (read-only) — confirm `public.atlas_work_decompositions` exists with the schema in §1, before querying it. Do not assume the migration was applied as written; verify.
2. `execute_sql`, strictly `select`, exactly:
   ```sql
   select decomposition_id, module_id, module_version, source_task_id,
          contract_version, semantic_source_version, status,
          payload_encoding, payload, payload_compressed_base64,
          content_hash, created_at, updated_at
   from public.atlas_work_decompositions
   where module_id = 'road-ltl' and module_version = '1.5'
     and source_task_id = '__ALL_22__' and contract_version = '1.0.0';
   ```
3. Confirm exactly 1 row returned. Zero rows or more than 1 is an immediate FAIL (§8) — do not retry with a looser query.
4. Record `payload_encoding` exactly as stored. Resolve §3 per the decision rule there.
5. Decode per §5. Log every transformation applied.
6. Compute SHA-256 of the decoded payload. Compare against §6.
7. Parse the decoded payload; compute the 6 structural counts in §6; compare.
8. For each of the 22 tasks, recompute `contentHashSha256` from the decoded per-task payload and compare against the certification's `perTask[]`.
9. Export the exact retrieved row (all columns, undecoded, as returned by step 2) to a local file, hashed, before any further local processing — this is the artifact that becomes the immutable custody export, not a re-serialized or "cleaned" version of it.
10. At no point does this procedure write, update, delete, migrate, or re-insert anything into `public.atlas_work_decompositions` or any other production table.

## 8. PASS / FAIL criteria

**PASS** requires every one of the following, with no exceptions and no partial credit:

- Step 3: exactly 1 row.
- Step 4/§3: encoding is resolved to a known, decodable value — not `BROTLI_BASE64` used speculatively.
- Step 6: decoded-payload SHA-256 matches `protectedStoreContentHash` exactly.
- Step 7: all 6 structural counts match exactly (22/603/444/185/163/96).
- Step 8: all 22 per-task content hashes match exactly.
- Step 10: zero write operations occurred, confirmed by reviewing the executed query log, not by intent alone.

**Any single mismatch is a FAIL**, and specifically:

- A row-count mismatch (step 3) is a FAIL and stops the procedure — do not attempt decode.
- A hash mismatch on step 6 with matching structural counts (step 7) is reported as `HASH_MISMATCH_STRUCTURE_MATCHES` — a distinct, more specific failure than a generic FAIL, since it would mean the content differs in some way the aggregate counts don't reveal.
- A per-task mismatch on step 8 for some but not all of the 22 is reported per-task, by `taskId`, not as one aggregate FAIL — this is what would make a future reconciliation (see the separate reconciliation-schema document) possible at all.

**On FAIL:** stop. Do not attempt an alternate decode, a looser query, or a "best-effort" partial export. Report exactly which check failed and the actual observed value against the expected one.

## 9. What this specification does not authorize

Writing this document does not itself authorize execution. Execution still requires Supabase access, which remains unapproved as of this writing. This document exists so the *procedure* can be reviewed and QA'd before that access is used, per the Owner's explicit sequencing.
