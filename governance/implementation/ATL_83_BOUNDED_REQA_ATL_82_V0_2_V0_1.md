# ATL-83 — Bounded Re-QA: ATL-82 Candidate V0.2 (V0.1)

**Task:** ATL-83 / logical ATL-82B — bounded re-QA of the corrected candidate
**Reviewer:** Claude, independent of the ATL-82 builder (ChatGPT)
**Date:** 2026-09-23

**Artifact under QA:** `governance/implementation/ATL_82_CANDIDATE_PHYSICAL_MIGRATION_V0_2.sql`
- commit `a8c405448a0e016ad9adac7c03a9439ba719c911`;
- blob `344d0d4fed7fd5ae7d271764ba1f10e0d7552d63`, verified at that commit and unchanged at HEAD.

**Scope, as set by the Owner:** verify V0.2 and run the executable test pack against it, including regression. Confirm that C1–C4, C7 and C8 are closed. Treat C5/C6 as transferred to ATL-92 under D1=A, and confirm ATL-93 owns the P6.1/P6.2 hardening. No Supabase mutation and no DDL application.

**State checked:**
- GitHub `atlas-governance-registry-v2.1` @ `6410d936a232995f5caa2557a08280c2ed42bfa1`, fetched fresh;
- live Supabase `aaoyesktlzhaunqqjhdq`, read-only;
- a disposable local PostgreSQL 16.13, which is not Supabase.

**Independent verification of this report:** before delivery, a separate agent that had not seen the QA reasoning checked every factual claim against the raw evidence. It confirmed B1, B2, all blob identities and every cited test result. It found one wrong claim: relationship types had not been UPDATE-tested. The suite now covers them (C2n, C2p), and that claim and several wordings are corrected in this version. The §4 gate and its validation were checked the same way: a fresh agent re-ran every case and found no false statement. It found four overstatements, now corrected, and one safety gap, closed in the gate.

**Executable evidence** (target paths, to be landed):
- `governance/implementation/ATL_83_EXECUTABLE_TEST_PACK_V0_2.sh`, blob `b9cdbbe2d5071066f5f333e8229b65d2bb095cc1`;
- `governance/implementation/ATL_83_TEST_PACK_OUTPUT_V0_2.txt`, blob `f79e97e887552dc3b6e792049552cff261b7fe04`;
- `governance/implementation/ATL_83_CORRECTED_CANDIDATE_GATE_V0_1.sh`, blob `9af8eef15dbd3e6750dc643583ad0cf6ae1e2c6b`, the gate for V0.3 (§4);
- `governance/implementation/ATL_83_CORRECTED_CANDIDATE_GATE_VALIDATION_V0_1.txt`, blob `99ffe6139b9305218f4e82de20aef4144ef119ae`.

## Disposition: **FAIL. V0.2 is not executable, and C2 is not closed.** Both are fixable in three lines.

There are two blocking defects:

- **B1 — V0.2 does not compile (V0.2 builder defect).**
  - Lines 214 and 226 open and close the guard function body with a single `$` instead of the `$$` dollar quote. The file contains no `$$` at all.
  - Run as written in one transaction with `ON_ERROR_STOP` (how a migration runs), PostgreSQL stops at line 215 with `syntax error at or near "$"` and psql exits with code 3. The transaction aborts, and 0 of V0.2's 9 tables remain.
  - So **V0.2 as written delivers none of the corrections.** It also regresses a control that passed on V0.1. For criterion 8, the V0.1 report recorded that "the pinned SQL compiles, and ROLLBACK leaves 0 tables"; V0.2 as written does not compile.
  - The defect pattern matches a text-templating step that collapses `$$` to `$` (for example, a JavaScript `String.replace` replacement string). That cause is inferred, not verified.
- **B2 — the append-only guard does not protect UPDATE on four tables.** This defect **originated in Claude's ATL-83 reference DDL**, and V0.2 copied it faithfully.
  - Four **row-level** UPDATE/DELETE triggers are created with no arguments: evidence sources, evidence links, gap links and Z5 outputs. The nine statement-level TRUNCATE triggers also have no arguments, but they are unaffected, because the TRUNCATE branch raises before `tg_argv` is read.
  - In PL/pgSQL, `TG_ARGV` is **NULL** for a zero-argument trigger, not an empty array. The test pack shows this directly: "0 args; tg_argv is NULL".
  - The guard's test `not (col = any (tg_argv))` therefore evaluates to NULL, the exception never fires, and in-place UPDATE succeeds on all four tables.
  - With only B1 repaired, the pack rewrote a source's class (AUTHORITATIVE_RESEARCH → GOVERNED_INTERNAL), flipped a link's role (SUPPORTS → CONFLICTS), retargeted a gap link, and overwrote a Z5 lineage hash (`hwd` → `hash-forged`). The read-back confirms all four values.
  - **C2 is not closed.** The immutability that C4 and C8 rely on is also defeated.

**Complete fix, proven.** DIAGNOSTIC-B changes exactly three lines, 214, 221 and 226:
- `$` → `$$` on lines 214 and 226;
- on line 221, `tg_argv` → `coalesce(tg_argv, '{}'::text[])`.

With those three lines, every correction closes and every regression control holds under the suite, which now probes in-place UPDATE on all nine guarded tables. The fix belongs in a builder-owned V0.3. The diagnostic copies are not artifacts.

**Owner-scoped confirmations:**
- **C5/C6 → ATL-92 (D1=A):** confirmed. V0.2 creates no `atlas_readiness_*` table. The static check is on the pinned file; "readiness" appears only in the header comment. D1A = 0 comes from executing the diagnostic copies, since V0.2 as written does not compile. The Z6 findings are treated as transferred, not as open ATL-82 defects. ATL-92 exists in Linear with the AR0.3 `ReadinessResult` scope, blocked for implementation until the resolver can evaluate a real scope.
- **ATL-93 owns P6.1/P6.2 hardening (D2):** confirmed. ATL-93 is in Linear (Todo) with the service-role TRUNCATE/DELETE/UPDATE guard-and-audit scope and hard stops preserving the P6.1 row and P6.2's empty state.

## 1. Method

The pack reuses the ATL-83 V0.1 harness unchanged. That harness mirrors live Supabase default privileges (GRANT ALL on new public tables to `anon`, `authenticated` and `service_role`; `arwdDxt` on PG16) and includes stubs of the existing tables with their live primary-key shapes. Live Supabase was re-read this session: `atlas_workspaces(id uuid)` and `atlas_knowledge_gaps(id uuid)` exist as V0.2's FK targets, and none of V0.2's nine table names exist live.

The pack runs five phases. Phases 1–4 each use a fresh database.

| Phase | What it does |
|---|---|
| **PHASE-0** | Static checks: blob pin, dollar-quote tokens, the guard's argument test, readiness tables, ends in `rollback`. |
| **PHASE-1** | V0.2 **exactly as written**. |
| **PHASE-2 (DIAGNOSTIC-A)** | Repairs only the two dollar-quote tokens. The diff is printed and asserted: the pack exits 4 unless exactly lines 214 and 226 change. Then runs a `TG_ARGV` mechanism probe and the full correction-closure and regression suite. |
| **PHASE-3 (DIAGNOSTIC-B)** | DIAGNOSTIC-A plus the one-line guard repair. The diff is asserted in the same way (exactly lines 214, 221 and 226). Then runs the same suite. |
| **PHASE-4** | DIAGNOSTIC-B: drop in reverse dependency order, check that protected stub rows survive, then rebuild. |

The pack refuses to run without `ATL83_DISPOSABLE=1` or with a non-local host (exit 2). It also refuses any candidate whose blob is not V0.2 (exit 3). All three refusals are recorded in the SAFETY SELF-CHECK section appended to the captured output: a Supabase host, the variable unset, and the V0.1 candidate.

**The suite is strengthened compared with ATL-83 V0.1:**
- in-place UPDATE probes on all nine guarded tables, including the four zero-argument ones and relationship types (C2n), plus a relationship-type DELETE probe (C2p);
- read-backs of the values after the attempted edits;
- `anon` and `service_role` privilege checks;
- a duplicate gap-link test and an invalid relationship-lifecycle test;
- zone and support-state vocabulary regression.

**Limits.**
- PG16 was used, while live is PG17. Dollar-quote grammar and PL/pgSQL `TG_ARGV` handling are core behaviour and are expected to be identical in 17, but neither was separately executed on 17.
- The TRUNCATE and grant findings are database-privilege facts; PostgREST does not issue TRUNCATE.
- The pack's host check does not cover `PGSERVICE`, `PGSERVICEFILE` or `PGHOSTADDR`, any of which can route a connection past `PGHOST`. Run it with those unset. The §4 gate refuses them.

## 2. Correction closure

"As written" is V0.2 unchanged. "A" and "B" are the diagnostic copies. Test IDs refer to the captured output.

| ID | V0.2 as written | DIAGNOSTIC-A (quote repair only) | DIAGNOSTIC-B (+ guard repair) | Status |
|---|---|---|---|---|
| **C1** access | Not applied (B1) | No anon/authenticated grants (C1a). `service_role` = DELETE, INSERT, SELECT, UPDATE on all 9 tables, with no TRUNCATE, REFERENCES or TRIGGER (C1b). Browser roles are denied (C1c, C1d). `service_role` is denied TRUNCATE (C1e). Guard function not executable by `anon`/`authenticated`, and RLS is on all 9 tables (C1f). | Same | **Closed in content; undelivered (B1)** |
| **C2** append-only | Not applied (B1) | All five tables with an allowlist are guarded against in-place edits (C2b entity types, C2n relationship types, C2c entities, C2d relationships, C2h generation runs). DELETE and owner TRUNCATE are blocked (C2f, C2g). 18 triggers (C2i). **But UPDATE succeeds on sources, links, gap links and Z5 outputs** (C2e, C2j, C2k, C2m; the read-back shows forged values). | All in-place edits rejected. Read-back shows the originals (`AUTHORITATIVE_RESEARCH / SUPPORTS / K2 / hwd`). Promotion still works (C2a, C2h). | **NOT CLOSED (B2)** |
| **C3** relationship lifecycle | Not applied (B1) | Column present, default CANDIDATE (C3a). Invalid value rejected (C3b). Promotion allowed while the semantic payload stays frozen (C2a, C2d). | Same | **Closed in content; undelivered (B1)** |
| **C4** source registry | Not applied (B1) | One class per `(kind, ref)` (C4a). Client source requires a workspace (C4b); research source forbids one (C4c). Source-level columns are gone from the link table (C4e). `source_id` is mandatory (C4f). **But a source can be reclassified in place (C2e), and C4d then shows the altered class.** | C4a–f hold, and C4d shows the original classes | **Structure closed; protection depends on the B2 fix** |
| **C7** gap-link junction | Not applied (B1) | Valid link accepted. Half-key, nonexistent gap and duplicate rejected (C7a). **Link retargetable in place (C2k).** | Retargeting rejected | **Structure closed; immutability depends on the B2 fix** |
| **C8** Z5 hash | Not applied (B1) | NULL hash rejected (C8a). Valid output accepted (C8b). **Hash overwritable in place (C2m).** | Overwrite rejected | **NOT NULL closed; immutability depends on the B2 fix** |

**Regression** of the controls that passed on V0.1. All of these hold under both DIAGNOSTIC-A and DIAGNOSTIC-B:
- a non-existent type-version pin is rejected;
- links with two targets, or with a half key, are rejected;
- an invalid zone and an invalid support state are rejected;
- deleting a pinned type version is blocked (now by the guard, before the FK).

PHASE-4 (DIAGNOSTIC-B only) drops all 9 structures with the protected stub and gap rows intact, then rebuilds 9 structures and 18 triggers. Both rows are re-checked after the rebuild and are still 1 and 1.

**The one regression is B1 itself.** V0.2 as written no longer compiles, where V0.1 did.

## 3. Correction of Claude's own earlier claim

The ATL-83 V0.1 QA report (`fcd03f59…`) stated that C2 was "proven by P-C2a to P-C2f", for a guard "on all semantic, lineage and provenance tables". That V0.1 suite tested in-place UPDATE only on three tables whose trigger has an allowlist argument: entity types, entities and generation runs. It never tested UPDATE on the four zero-argument tables. The claim was therefore **overstated for four of the nine tables**, and the reference DDL carried B2.

This report supersedes that specific claim. The V0.1 artifact stays immutable as evidence.

## 4. Required for the next candidate (builder-owned V0.3)

1. **Exactly** the DIAGNOSTIC-B changes: lines 214 and 226 become `$$`, and line 221 wraps `tg_argv` in `coalesce(tg_argv, '{}'::text[])`. Any other change must be listed and justified, because re-QA will diff V0.2 against V0.3.
2. Optional and non-binding: drop `atlas_evidence_sources_ref_idx`. It duplicates the index that the `unique (evidence_source_kind, evidence_ref)` constraint already creates.
3. **Before handing V0.3 to QA**, a first-party proof that includes a clean run (exit 0) of `ATL_83_CORRECTED_CANDIDATE_GATE_V0_1.sh` against V0.3 as written, recording V0.3's blob. No first-party executable proof existed for V0.2, even though ATL-82's own `next_action` called for one. (`ATL_82_FIRST_PARTY_VERIFICATION_PROOF_V0_2.md` covers the V0.1 SQL.) B1 would have shown up on any execution at all. B2 is exposed only by this V0.2 pack: the V0.1 pack never UPDATEd the zero-argument tables.

**Why a separate gate.** The V0.2 pack cannot test V0.3: its diagnostic phases are specific to V0.2. With only its blob pin changed, it exits 4 on an already-corrected candidate, because the diagnostic repair then changes no lines. The gate:
- runs the candidate as written: it must compile, and its ROLLBACK must leave none of the 9 tables;
- then runs a copy with only the final ROLLBACK changed to COMMIT through the identical suite. The harness, probe, closure/regression, drop and rebuild SQL is extracted from the V0.2 pack, and both reference files are blob-verified;
- requires the normalized closure/regression, drop and rebuild output to match the DIAGNOSTIC-B results in the V0.2 output exactly.

Normalization covers temp paths, timestamps and trailing whitespace only. It therefore does not detect a `timestamptz` → `timestamp` change or a changed timestamp default; the V0.2 → V0.3 diff must catch those.

The gate keeps the pack's safety refusals and adds one: it also refuses `PGSERVICE`, `PGSERVICEFILE` and `PGHOSTADDR`, any of which can route a connection past the local-host check. The V0.2 pack's check has that gap. It refuses V0.1 and V0.2.

It takes the candidate's expected blob as an argument, so it does not need to change for a new candidate blob. Because the match is exact (including guard-function line numbers, constraint names and column order), any V0.3 change beyond DIAGNOSTIC-B that alters the suite's output needs a gate revision. Dropping `atlas_evidence_sources_ref_idx` (item 2) does not.

**Gate validation** (`ATL_83_CORRECTED_CANDIDATE_GATE_VALIDATION_V0_1.txt`). V0.3 does not exist yet, so a stand-in was used: V0.2 with exactly the three DIAGNOSTIC-B lines. Results:
- stand-in: PASS, exit 0;
- B1-only mutant (B2 retained): rejected by the static check, exit 6;
- stand-in with `output_hash` made nullable: rejected on the golden comparison, exit 5, and the diff shows C8a accepted and the lineage hash lost;
- refusals: V0.2 (exit 3), a wrong expected blob (exit 3), a Supabase host, `PGHOSTADDR`, `PGSERVICE` and an unset `ATL83_DISPOSABLE` (exit 2), and a tampered reference output (exit 3).

**Re-QA of V0.3** will be bounded to three checks:
- the V0.2 → V0.3 diff;
- a gate run against V0.3 as written, which must PASS (an exact match with DIAGNOSTIC-B);
- a live read-only state check.

## 5. Governance synchronization findings (for ChatGPT/Owner disposition, not binding on the QA verdict)

- **G1 — the previous ATL-83 landing was incomplete.** The three evidence files landed byte-exact (`cb2d662`, `189eea8`, `4d9ca9c`). But:
  - `ATL-83.yaml` is still `AUTHORIZED_NOT_STARTED` (last changed at `7770fa3`);
  - `claude_chatGPT.md` has no entry for the ATL-83 QA result and no D1/D2 Owner-decision entry. Earlier ATL-83 release and handoff entries do exist;
  - `ATL-60.yaml` was not updated for the ATL-83 result or for the D1=A split of Z6 persistence out of ATL-60's physical scope.

  ATL-60's checkpoint is therefore stale (`BLOCKED_CHECKPOINT_STALE`, §6). Applying §11.3 item 9 to a QA result or scope split is an interpretation, the same one the earlier ATL-83 handoff used; the item's text addresses the creation and release of prerequisites. The ATL-83 manifest in this package (`ATL-83.yaml`) supersedes the unlanded one and records both QA passes.
- **G2 — `ATL-82.yaml` `task_status` is `IN_PROGRESS`.** That is not a canonical value, and the manifest was touched at `6410d93`, after the ATL-91 amendment took effect at `353a40c`. It must be normalized on touch. ChatGPT's Linear comment and the V0.2 output entry say `IMPLEMENTED_UNVERIFIED`. Given this evidence, the canonical state becomes `VERIFICATION_FAILED`. The status change belongs to ChatGPT/Owner.
- **G3 — the executable bit was dropped.** The V0.1 test pack landed with mode `100644`; the handoff asked for `100755`. Minor.
- **G4 — ATL-92 and ATL-93 have no manifests.** This is acceptable while they are in Todo. A manifest is required when each becomes active (TC-0).
- **R8 — mechanism recommendation, non-binding.** `.github/workflows` is already in use on this branch (10 workflows), but none executes candidate SQL. A workflow that runs the ATL-83 pack in a PostgreSQL service container on any change to `governance/implementation/*.sql` would have rejected V0.2 at commit time. It would also make the "executable first-party proof" a gate that cannot be skipped. `ATL_83_CORRECTED_CANDIDATE_GATE_V0_1.sh` is designed to be usable as that CI step (it accepts `PGHOST=localhost`). It has not been run in CI, and the workflow must supply each candidate's expected blob from a pinned source rather than computing it from the file.

## 6. Mutation statement

No Supabase mutation, migration, DDL, `execute_sql` write, branch operation or GitHub write was performed.

Live Supabase at the end of this re-QA:
- latest migration `20260908015858`;
- `atlas_work_decompositions` = 1 and `atlas_work_definitions` = 0;
- 20 public tables;
- none of V0.2's nine table names present.

All DDL ran only inside the disposable local PostgreSQL cluster.
