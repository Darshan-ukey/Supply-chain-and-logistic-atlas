# ATL-83 — Bounded Re-QA: ATL-82 Candidate V0.3 (V0.1)

**Task:** ATL-83 / logical ATL-82B — bounded re-QA of corrected candidate V0.3 (QA pass 3)
**Reviewer:** Claude, independent of the ATL-82 builder (ChatGPT)
**Date:** 2026-09-24

**Artifact under QA:** `governance/implementation/ATL_82_CANDIDATE_PHYSICAL_MIGRATION_V0_3.sql`
- blob `31e9f4ca8c3877519dda71f84b82502d7476ff86` (249 lines, 15,595 bytes);
- this content was introduced at commit `45faea650657213265da925a65a79e510a358f77` and pinned in `ATL-82.yaml` `working_outputs` at commit `c3dd627d8d6354556ed04e15658145dbd23e392a`, the canonical tip when checked.

**Scope, as set by the Owner and by pass 2** (`ATL-83.yaml` `next_reqa_scope`): verify the V0.2→V0.3 diff; independently run the corrected-candidate gate; verify B1/B2 closure and the regression controls; perform the live read-only state check; issue the verdict. No DDL application and no Supabase mutation.

**State checked:**
- GitHub `atlas-governance-registry-v2.1` @ `c3dd627…` and `atlas-ci-proofs` @ `c940f5340364bcc5763549fcf71efac43222b3e1`, both fetched fresh;
- live Supabase `aaoyesktlzhaunqqjhdq`, SELECT statements only;
- three disposable local PostgreSQL clusters, none of them Supabase:
  - E1: 16.13, C.UTF-8 (the ATL-94 CI settings);
  - E2: 17.6, C.UTF-8;
  - E3: 17.6, en_US.UTF-8, the live project's server version and collation.

**Evidence** (target paths, to be landed):
- `governance/implementation/ATL_83_REQA_V0_3_EXECUTION_OUTPUT_V0_1.txt`: raw output, sections A–H (cited below as "output §X");
- `governance/implementation/ATL_83_REQA_V0_3_EXTENDED_PROBE_V0_1.sql`, blob `a94027ab53330c62f73480e84008db1dc531f0f9`: the X-series probe (§6).

**Independent verification of this report:** before delivery, a separate agent that had not seen the QA reasoning checked every factual claim against four sources: git, the CI proof branch, the raw output, and SELECT-only live queries. It also re-ran the gate (16.13 and 17.6) and the X-series probe itself. It confirmed the verdict and every major claim, and found:
- 3 wrong statements: the clusters were not yet deleted when first written; the CI failure count for the first V0.3 was wrong; and "pins or CI caught every instance" was false;
- 4 overstatements:
  - X7's promotion was a no-op;
  - the default-privilege match was wider than the harness mirrors;
  - criterion 8 was marked "executed";
  - criterion 6 omitted the unadopted R1;
- 3 inconsistencies: the F5 lists differed between files, one commit citation was wrong, and a supersession was not recorded;
- 9 minor items.

All are corrected in this version. X7 was re-run with a real CANDIDATE→VALIDATED promotion, and the function-privilege check was added (output §G5).

## Disposition: **PASS.** V0.3 closes B1 and B2, every binding correction in ATL-82's scope is closed, and nothing regressed.

- **The diff is exactly the prescribed fix.** V0.2→V0.3 changes lines 214, 221 and 226 and nothing else. V0.3 is byte-identical to the stand-in used to validate the gate in pass 2. The ATL-94 canary rebuilds that stand-in from V0.2 on every CI run, and it has the same blob, `31e9f4ca`.
- **B1 is closed.**
  - V0.3 as written compiles in one transaction with `ON_ERROR_STOP` (psql exit 0).
  - Its final `ROLLBACK` leaves 0 of the 9 tables.
  - No line ends in a lone `$` quote.
- **B2 is closed.**
  - The only `tg_argv` test is null-guarded.
  - The four tables that were unguarded in V0.2 now reject in-place UPDATE, and the read-back shows the original values (`AUTHORITATIVE_RESEARCH / SUPPORTS / K2 / hwd`).
  - Beyond the gate: all 94 immutable columns across the 9 tables are blocked, and none of the 6 allowlisted columns is. DELETE and `TRUNCATE … CASCADE` are blocked on all 9 tables, and `service_role` cannot switch the guard off.
- **I reproduced the gate PASS in three environments,** with output identical to CI's after normalization. One of them is PostgreSQL 17.6 with en_US.UTF-8, the live project's version and collation, which CI does not cover.
- **The CI proof is valid.**
  - Run 35999395289 on `c3dd627` reads PASS (1 of 1), with the reviewed CI code blobs and all three canaries OK.
  - The ATL-94 runner, re-run locally on the same commit, gives the same verdict.
- **The live state is unchanged and compatible.**
  - Latest migration `20260908015858`; 20 public tables.
  - None of the 25 relation names V0.3 creates exists live, and there is no guard function.
  - Both referenced primary keys are uuid. The table and sequence default privileges match the test harness's mirror, and V0.3's explicit revokes override the live default function EXECUTE grant (output §G5).

**Scope of this PASS.** It covers ATL-82 as amended by Owner decision D1=A. Z6 readiness persistence (C5/C6, and the readiness parts of criteria 1, 3, 4 and 6) is governed by ATL-92 and not assessed here. P6.1/P6.2 hardening belongs to ATL-93 (D2).

**What this PASS does not authorize.** It authorizes no migration. V0.3 is a verified *candidate*. Applying any schema to Supabase needs Owner authorization, a separately governed task, and the conditions in §10 (F5).

## 1. Method

| # | Check | How | Output § | Result |
|---|---|---|---|---|
| 1 | Identity | Tree blob and mode at `c3dd627` for V0.3, V0.2, gate, pack and output; `git hash-object --no-filters` of the copies used | A | all match |
| 2 | Diff | `diff` V0.2 V0.3 | A | lines 214, 221, 226 only |
| 3 | Gate on the CI settings | `ATL_83_CORRECTED_CANDIDATE_GATE_V0_1.sh` (`9af8eef1`) against blob `31e9f4ca`, on E1 | B | exit 0, PASS |
| 4 | Gate on the live version | The same, on E2 and E3 | C | exit 0, PASS, identical output |
| 5 | CI cross-check | CI proof files; normalized comparison; ATL-94 runner re-run on a clean checkout | C, D | identical; PASS (1 of 1) |
| 6 | Beyond the gate | X-series probe on E1 and E3 | E, F | 94/94 immutable columns blocked; 0 bypass |
| 7 | Live state | SELECT-only queries | G | unchanged; no collision |

**The gate** runs the candidate exactly as written: it must compile, and its `ROLLBACK` must leave nothing. It then runs a commit copy (only the final `ROLLBACK` changed to `COMMIT`) through three things taken from the V0.2 pack: the TG_ARGV probe, the closure and regression suite, and drop/rebuild. It requires an exact normalized match with the recorded DIAGNOSTIC-B results. Pass 2 validated it, and it has run in CI since ATL-94.

**Why go beyond the gate.** The gate replays a fixed suite, which probes in-place UPDATE on selected columns. Pass 1 overstated C2 because its suite covered 3 of the 9 tables. To avoid repeating that, the X-series changes every column of every table and checks that nothing changed.

## 2. Identity and diff (output §A)

- V0.3, V0.2, the gate (`100755`), the pack (`100755`) and the output at `c3dd627` equal their pins: `31e9f4ca`, `344d0d4f`, `9af8eef1`, `b9cdbbe2` and `f79e97e8`.
- `diff V0.2 V0.3` changes three lines, adds none and removes none:
  - 214: `public as $` → `public as $$`;
  - 221: `any (tg_argv)` → `any (coalesce(tg_argv, '{}'::text[]))`;
  - 226: `end $;` → `end $$;`.
- The header comment is unchanged from V0.2. That follows from the three-line rule.
- **History of the V0.3 path.** The ATL-94 CI record shows how V0.3 was reached:

| Commit | Change | V0.3 blob | CI run | CI verdict |
|---|---|---|---|---|
| `1960638` | First V0.3: only line 221 changed, so B1 recurred | `2b3f3c22` | 35995273841 | FAIL: not pinned; gate exit 6 (static check) |
| `2f87bc2` | Pinned the defective blob | `2b3f3c22` | 35995357970 | FAIL: gate exit 6 |
| `45faea6` | Dollar quoting corrected in place | `31e9f4ca` | 35999380156 | FAIL: file does not match its pin |
| `c3dd627` | Pin updated | `31e9f4ca` | 35999395289 | **PASS (1 of 1)** |

Correcting the file in place was acceptable: no QA or PASS claim was ever made on `2b3f3c22`, and that blob stays in git history and in the CI proof record. It is not recorded in `ATL-82.yaml` (F3).

## 3. Executable verification: the gate (output §B, §C)

On E1, all four gate stages hold:
- **GATE-0 (static):**
  - lines ending in a lone dollar quote: 0;
  - `tg_argv` tests without a NULL guard: 0;
  - readiness tables created: 0;
  - exactly one `rollback;` line.
- **GATE-1 (as written):** psql exit 0; 0 tables remain after the `ROLLBACK`.
- **GATE-2 (commit copy):**
  - psql exit 0;
  - the TG_ARGV probe shows `0 args; tg_argv is NULL` and `1 args; tg_argv is array`, the B2 mechanism;
  - the closure and regression suite matches DIAGNOSTIC-B exactly.
- **GATE-3 (drop and rebuild):** both match DIAGNOSTIC-B exactly.
  - The drop leaves 0 structures, with the protected stub row and the gap row intact (1 and 1).
  - The rebuild restores 9 structures and 18 guard triggers, and both rows are still intact.

| Environment | Server | Collation | Gate exit | Raw output SHA-256 | Normalized SHA-256 |
|---|---|---|---|---|---|
| E1 (local) | 16.13 | C.UTF-8 | 0 | `3d878630…` | `48a00429…` |
| E2 (local) | 17.6 | C.UTF-8 | 0 | `0ad12262…` | `48a00429…` |
| E3 (local) | 17.6 | en_US.UTF-8 | 0 | `6b36f31b…` | `48a00429…` |
| CI run 35999395289, V0.3 | 16.15 | C.UTF-8 | 0 | `83b5a265…` | `48a00429…` |
| CI run 35999395289, canary stand-in | 16.15 | C.UTF-8 | 0 | `db00dc0b…` | `48a00429…` |

The normalization is the gate's own: temp paths, timestamps and trailing whitespace. The five normalized outputs are byte-identical (226 lines each).

## 4. B1 and B2 closure

**B1 (V0.2 did not compile).** Closed.
- GATE-0 finds no lone dollar quote.
- GATE-1 compiles V0.3 as written under `ON_ERROR_STOP`, which is how a migration runs: exit 0, and `ROLLBACK` leaves 0 tables.
- The gate compiled it on PostgreSQL 16.13, 16.15 (CI) and 17.6.

**B2 (UPDATE unguarded on four tables).** Closed.

| Table | V0.2 read-back (pass 2, B1 repaired only) | V0.3 | V0.3 read-back |
|---|---|---|---|
| `atlas_evidence_sources` | `source_class` rewritten to GOVERNED_INTERNAL | C2e: ERROR append-only | AUTHORITATIVE_RESEARCH |
| `atlas_knowledge_evidence_links` | `support_role` flipped to CONFLICTS | C2j: ERROR append-only | SUPPORTS |
| `atlas_knowledge_gap_links` | retargeted to K1 | C2k: ERROR append-only | K2 |
| `atlas_generation_z5_outputs` | `output_hash` forged | C2m: ERROR append-only | hwd |

The X-series (§6) extends this from one column per table to every column of all 9 tables.

## 5. Corrections and regression controls

| ID | Pass 2 status (V0.2) | V0.3 | Evidence |
|---|---|---|---|
| **C1** | Closed in content, undelivered (B1) | **CLOSED** | C1a–C1f: no anon/authenticated grants; service_role has exactly DELETE, INSERT, SELECT, UPDATE; permission denied for authenticated and anon SELECT, authenticated TRUNCATE and service_role TRUNCATE; RLS on 9 of 9; guard EXECUTE f/f. X8: no EXECUTE for PUBLIC either. |
| **C2** | NOT CLOSED (B2; also undelivered because of B1) | **CLOSED** | C2a–C2p, C2-READBACK, C2i (18 guard triggers). X1, X2, X4–X7, X9. |
| **C3** | Closed in content, undelivered (B1) | **CLOSED** | C3a: relationship `lifecycle_status` exists, default CANDIDATE. C3b: an invalid value is rejected. |
| **C4** | Structure closed; protection depended on B2 | **CLOSED** | C4a–C4f: unique (kind, ref); client and research scope checks; link class derived from its source; no source-level columns on the link; `source_id` NOT NULL. C2e and C2j now block reclassification. X2 blocks all 8 source columns and all 10 link columns. |
| C5, C6 | Transferred to ATL-92 (D1=A) | Out of scope | D1A: 0 readiness tables. |
| **C7** | Structure closed; immutability depended on B2 | **CLOSED** | C7a: a valid link is accepted; a half-key target, a nonexistent gap and a duplicate are rejected. C2k blocks retargeting. X2 blocks all 6 gap-link columns. |
| **C8** | NOT NULL closed; immutability depended on B2 | **CLOSED** | C8a: NULL `output_hash` rejected. C8b: a valid row is accepted. C2m blocks overwriting. X2 blocks all 6 Z5-output columns. |

**Regression controls** (passed on V0.1; re-checked every pass): all hold, in the golden-matched REGRESSION section:
- the type-version pin FK;
- the link two-target and half-key checks;
- the zone and support-state vocabularies;
- deletion of a pinned type is blocked (1 row remains).

**Rollback/rebuild:** GATE-3 matches exactly (§3).

## 6. Beyond the gate: the X-series probe (output §E, §F)

The probe runs, in one fresh disposable database, after the harness, the V0.3 commit copy, and the pack's `closure.sql` (which loads the fixtures). It refuses to run if Supabase schemas are present; I tested that refusal (psql exit 3, output §E). Every probe statement is rolled back or blocked, except X7's single allowed promotion.

| Probe | What it does | Result (E1; E3 identical apart from collation row order) |
|---|---|---|
| X0 | Row count per table | ≥1 row in each of the 9 tables |
| X1 | Guard triggers as PostgreSQL reports them | 9 row triggers `BEFORE DELETE OR UPDATE`, whose arguments are the allowlists; 9 `BEFORE TRUNCATE` statement triggers; 0 disabled; 0 other user triggers |
| X2 | Changes **every column** of one row in each table, one column at a time, then rolls back | 100 columns: all **94 immutable columns BLOCKED** (append-only); all 6 allowlisted columns not blocked by the guard |
| X4 | DELETE one row per table | 9 of 9 blocked |
| X5 | `TRUNCATE … CASCADE` per table, as owner | 9 of 9 blocked |
| X3/X6 | MD5 of each table's contents before X2 and after X5 | 9 of 9 unchanged |
| X7 | As `service_role`, the only writer role | Promotion of relationship R2 from CANDIDATE to VALIDATED succeeds (read before and after). Evidence-ref edit, Z5 hash edit and gap-link DELETE are blocked. Read-back shows the originals. |
| X8 | Guard function properties | Security invoker; `search_path` pinned to `pg_catalog, public`; EXECUTE false for anon, authenticated and PUBLIC |
| X9 | `service_role` tries to switch the guard off | `session_replication_role = replica`: permission denied. `DISABLE TRIGGER` and `DROP TRIGGER`: must be owner. The guard still blocks. |

**Allowlists** (the only columns that may change in place):
- entity types: `status`;
- relationship types: `status`;
- generation runs: `run_status`;
- entities: `lifecycle_status`, `updated_at`;
- relationships: `lifecycle_status`;
- evidence sources, evidence links, gap links and Z5 outputs: none.

Five of the six allowlisted columns report a CHECK violation in X2, because the probe writes an out-of-vocabulary value. The guard let the change through and the vocabulary constraint caught it. Valid promotions succeed in C2a, C2h, C2n and X7.

**Immutable columns blocked, per table:**

| Table | Columns | Blocked |
|---|---|---|
| evidence sources | 8 | 8/8 |
| Z5 outputs | 6 | 6/6 |
| entities | 20 | 18/18 |
| entity types | 10 | 9/9 |
| evidence links | 10 | 10/10 |
| gap links | 6 | 6/6 |
| generation runs | 10 | 9/9 |
| relationship types | 11 | 10/10 |
| relationships | 19 | 18/18 |

## 7. CI proof cross-check (ATL-94)

**The proof** is at `atlas-ci-proofs:ATL-94/by-commit/c3dd627d8d6354556ed04e15658145dbd23e392a.md`, in proof commit `c940f5340364bcc5763549fcf71efac43222b3e1`. It records:
- run https://github.com/Darshan-ukey/Supply-chain-and-logistic-atlas/actions/runs/35999395289, attempt 1, gate job `success`, event `push`;
- runner image ubuntu24 20260920.314.1; PostgreSQL 16.15 (pgdg); collation C.UTF-8;
- the three reference files at their pins.

**It meets every ATL-94 acceptance rule for a PASS:**
- its CI code line shows exactly the reviewed blobs in `ATL-94.yaml` `reviewed_ci_code_blobs`: workflow `b4e179a9`, runner `ab833c26`, publisher `792e6155`, gate `9af8eef1`;
- all three canaries are OK (stand-in 0, B1-only 6, nullable hash 5);
- V0.1 and V0.2 are SKIPPED as historical;
- V0.3 is pinned to `31e9f4ca` and PASSes.

**The published hashes match the files.** The SHA-256 values in the proof match the evidence files on the branch.

**Local re-run.** The ATL-94 runner (`ab833c26`), run on a clean checkout of `c3dd627` on E1, gives **PASS (1 of 1 candidate(s) passed the gate)** with exit 0 (output §D).

**Conclusion.** The CI proof is a valid first-party executable proof under the ATL-94 builder protocol. This verdict does not rest on it: it rests on my own runs, which agree with it.

## 8. Live read-only state check (output §G)

| Item | Live value | Meaning |
|---|---|---|
| Migrations | 17; latest `20260908015858` (p6_2_canonical_work_definitions) | Same latest version as recorded in passes 1 and 2; no ATL-82 migration applied |
| Public tables | 20; list in output §G | Unchanged |
| V0.3 tables present | 0 of 9 | Nothing applied |
| `atlas_guard_append_only` | absent | Nothing applied |
| `atlas_readiness_*` tables | 0 | D1=A boundary intact |
| Name collisions | 0 of 25 relations V0.3 creates | 9 tables, 8 primary-key indexes, 2 unique-constraint indexes, 6 explicit indexes |
| FK targets | `atlas_workspaces(id uuid)`, `atlas_knowledge_gaps(id uuid)` | Match V0.3's references |
| Protected rows | Work decompositions 1, work definitions 0 | P6.1/P6.2 state unchanged |
| Server / collation | 17.6 / en_US.UTF-8 | Covered by E3 |
| Default privileges in `public` | Tables `arwdDxtm` and sequences `rwU` to anon, authenticated and service_role; function EXECUTE to the same three roles | Table and sequence defaults match the harness mirror, and V0.3's table revokes override them (C1). The harness does not mirror the function default. Output §G5 adds it on E3: after V0.3, anon, authenticated and PUBLIC have no EXECUTE on the guard. |
| `service_role` | Not superuser, not a member of `postgres`, cannot SET `session_replication_role`, BYPASSRLS | X9's local result holds live |

## 9. ATL-82 acceptance criteria and physical-design checks, rolled up across the three passes

| # | Criterion | Pass 1 (V0.1) | V0.3 | Basis |
|---|---|---|---|---|
| 1 | Faithful to the logical model | FAIL | **PASS** (amended scope) | C4 and C7 closed; C5/C6 transferred to ATL-92 (D1=A); no LTL/BOL universalization (unchanged since pass 1) |
| 2 | Composite type/version and knowledge/version identity | PASS | **PASS** | Regression controls hold |
| 3 | Zone boundaries and research-vs-client classification | FAIL | **PASS** (amended scope) | C4a–C4f; source class immutable (C2e, X2); readiness-run scope moved to ATL-92 |
| 4 | Referential integrity and controlled vocabularies | FAIL | **PASS** (amended scope) | C3 and C7 closed; vocabularies enforced (C3b, REGRESSION); the readiness vocabulary moved to ATL-92 |
| 5 | Append-only, versioned history | FAIL | **PASS** | C2 closed: gate suite plus X1–X9 |
| 6 | Explicit Z1→Z5 and Z6 lineage | FAIL | **PASS** for Z1→Z5 | Binding correction C8 closed, and `output_hash` is immutable. A Z5 output can still name a WorkDefinition that does not exist, because R1 is non-binding and was not adopted (O1). Z6 lineage moved to ATL-92. |
| 7 | RLS/access fit for protected IP | FAIL | **PASS** | C1 closed; X8, X9 |
| 8 | Rollback/rebuild, verifiable without mutation | PASS (design level) | **PASS** (design level) | V0.3 ends in ROLLBACK. GATE-3 executed QA's drop and rebuild scripts (from the V0.2 pack) against V0.3 with an exact match. A builder-owned down-migration is still open (F5). |
| 9 | Compatible with the existing schema and P6.1/P6.2 | PASS | **PASS** | §8 live check; compiles and behaves identically on 17.6 |
| 10 | No materialization or mutation | PASS | **PASS** | No DML in V0.3; live state unchanged |

**Physical-design checks.** All seven answers from pass 1 stand, and the binding parts are now delivered:
- Q1, append-only enforced in the database: C2 closed.
- Q2, access pattern: C1 closed.
- Q3, source-class location: C4 closed.
- Q4, Z5 bridge: C8 closed; R1 not adopted (O1).
- Q5, JSON validation in the database: not required before first materialization.
- Q6, gap linkage: the C7 junction exists; the FR-02 revision is outside ATL-82.
- Q7, registry supersession: PASS.

## 10. Findings for ChatGPT/Owner disposition (not binding on the verdict)

**F1 — the builder's write path has altered content four times.** Every instance was caught before it counted:

| Instance | What changed | Caught by |
|---|---|---|
| V0.2 | `$$` became `$` (B1) | Pass-2 QA execution. ATL-94 CI did not exist yet, and a blob pin cannot detect a compile error. |
| First V0.3 (`2b3f3c22`) | Only line 221 was applied, so B1 recurred | ATL-94 CI (static check, exit 6), twice |
| Gate's first landing (`86d36f8`, blob `af842ced`) | Lines consisting of a bare `#` were emptied, one line was dropped, and the mode changed from `100755` to `100644`. Restored at `f7cbde5`. | The gate's blob pin |
| `ATL-82.yaml` prose | "`$` dollar quotes" where the fix is `$$` | This QA (F3) |

Three instances fit a text step that collapses `$$` to `$`; the gate alteration is a different pattern. Both causes are inferred, not verified. **Recommendations:**
- **R9.** Any SQL the builder writes is untrusted until ATL-94 CI PASSes. Before ATL-92 or ATL-93 produce DDL, extend the executable CI gate to their SQL; each needs its own reference suite.
- **R11.** Land Claude-authored files by raw byte copy, and check each written blob and mode. GitHub's file-write response returns `content.sha`.

**F2 — V0.3 was handed to QA before its governance records were synchronized.** The pin itself was synchronized at `c3dd627`, but:
- `ATL-82.yaml` `current_checkpoint` still reads "awaiting fresh ATL-94 CI proof", and `next_action` still asks for that proof and for a first-party proof to be persisted;
- the repository has no first-party proof citation for V0.3;
- there is no shared-log entry for V0.3 and no ATL-82 Linear comment.

The Owner's instruction supplied the proof citation, and I verified the proof directly (§7). The closure synchronization in the handoff closes this.

**F3 — stale fields in `ATL-82.yaml`:**
- the V0.1 SQL entry reads `state: VERIFIED_FIRST_PARTY`, although V0.1 failed pass 1;
- the V0.3 note says "`$` dollar quotes" (F1);
- the superseded first V0.3 blob `2b3f3c22` is not recorded in `superseded_outputs`.

**F4 — CI runs PostgreSQL 16; the live project runs 17.6.** For V0.3 this is closed: E2 and E3 reproduce the golden output exactly on 17.6. **R10:** move ATL-94 CI to PostgreSQL 17 through a governed workflow change, before any apply task. The canary re-proves the golden output on the new version.

**F5 — conditions for any future apply task.** These are not ATL-83 conditions, and this PASS does not satisfy them. The same list is recorded in `ATL-82.yaml`, `ATL-60.yaml`, the shared log and the handoff.
1. **Authorization.** Owner authorization and a separately governed apply task. ATL-82's own non-authorizations forbid applying.
2. **Apply artifact.** V0.3 is wrapped in `begin;` … `rollback;` by design; the gate verified its commit copy, with only the final line changed. So V0.3 itself must not be applied as-is. The apply artifact must be byte-derived from V0.3 by a stated transformation of that wrapper, blob-pinned, and must pass the ATL-94 gate.
3. **Transaction handling.** How the applying tool handles transaction statements must be established in that task.
4. **Down-migration.** A builder-owned executable down-migration is required. The QA `down.sql` is not a builder artifact. (Open since pass 1.)
5. **Rebuild proof.** A rebuild proof from frozen Generation Registry inputs is required. (Open since pass 1.)
6. **Live checks.** Pre- and post-apply live read-only checks.

Pass 1's third condition, a clean run of the corrected candidate, is now met. ATL-60's separate block on canonical data mutation is unaffected.

**Observations** (non-binding, carried forward):
- **O1:** R1 was not adopted. A Z5 output row can still name a WorkDefinition that does not exist (R1-INFO in the suite).
- **O2:** the optional drop of `atlas_evidence_sources_ref_idx` was not taken. It duplicates the unique constraint's index; harmless.
- **O3:** `atlas_knowledge_gap_links` has no primary key. Its identity is the NULLS NOT DISTINCT unique key accepted under C7. This is harmless for append-only rows, but some tooling expects a primary key; note it for the apply task.
- **O4:** status columns accept any transition within their vocabulary, and status changes are not audited (pass-1 R3, not adopted).
- **O5:** a table owner or superuser can bypass any trigger-based guard; `service_role` cannot (X9, §8). The residual sits with the owner role.

## 11. Recommended synchronization (field-level detail in the handoff)

- **ATL-83:** QA disposition PASS. It is closed through the governed checkpoint once this evidence and the synchronization below are landed and read back.
- **ATL-82:**
  - `task_status: INDEPENDENT_QA_PASSED`;
  - record the CI proof as V0.3's first-party executable proof;
  - V0.3 state `INDEPENDENT_QA_PASSED`;
  - add the pass-3 `qa_and_decisions` entry;
  - fix F3.
  - **Owner decision D3:** close ATL-82 as `GOVERNED_COMPLETE`, since its design-only scope is delivered, with any apply in a new governed task (recommended). The alternative is to hold ATL-82 open at `OWNER_AUTHORIZATION_REQUIRED`.
- **ATL-60:** checkpoint and blocker. The physical-design chain is complete through ATL-83. The DDL-apply blocker's remaining release condition is F5, which includes Owner authorization and a separately governed apply task. The canonical-data blocker is unchanged.

## 12. Reproduction

With a disposable PostgreSQL ≥ 15 as a non-root user, and the gate, pack, output and V0.3 from `c3dd627` in one folder:

```
ATL83_DISPOSABLE=1 PGHOST=<socket dir> PGPORT=<port> PGUSER=postgres \
  ./ATL_83_CORRECTED_CANDIDATE_GATE_V0_1.sh ATL_82_CANDIDATE_PHYSICAL_MIGRATION_V0_3.sql 31e9f4ca8c3877519dda71f84b82502d7476ff86
```

For the X-series, in one fresh database, run with psql in this order:
1. `harness.sql`;
2. the V0.3 commit copy;
3. `closure.sql`;
4. `ATL_83_REQA_V0_3_EXTENDED_PROBE_V0_1.sql`.

Extract `harness.sql` and `closure.sql` from the pack as the gate does. The exact driver is in output §E.

## 13. Mutation statement

- No Supabase mutation; the live project was read with SELECT statements only.
- No DDL outside the three disposable local clusters, which were stopped and deleted afterwards.
- No GitHub write by Claude. The evidence, manifest and handoff are delivered through Drive for ChatGPT landing.
