# W1-22 Normalization specification REV3 (rework round 3): correction of W1-23 QA R2 finding F4

Task W1-22 | rework op W122-R3-20261011-IST (run date 2026-10-11 UTC / 2026-10-12 IST) | Executor: Claude Sonnet 5.5 (scheduled Atlas monitor) | Wave 1 / sub-wave 1D
State set by this run: DONE_CLAIMED, AI = QA_PENDING. NOT VERIFIED. Risk HIGH, QA_REQUIRED (QA-1, QA-2, QA-3) unchanged. Batch QA: W1-23 (ChatGPT, Class D), round 3.
Scope: DESIGN ONLY. Executed only on a throwaway local PostgreSQL 16.15 (this sandbox, no Atlas data). No Supabase/Atlas write. Frozen V7.3, atlas_* tables, ATL-123, PC-01..11, uncitral (AMBIGUOUS) untouched. No new task; column X unchanged.
Rework rule: only what failed. F4 R2 text (W1-23): "partial unique index enforces alias_norm only, not alias_key; concurrent punctuation-equivalent aliases can bypass SELECT-only trigger."

## 1. Cause (confirmed by execution, not only by reading)
In REV2 the strict-key owner check (`alias_key`) was a trigger SELECT. A SELECT cannot see an uncommitted insert of another session, so two sessions inserting `Shipment record` (obj-a) and `shipment-record` (obj-b) both pass, both commit, and the term has two live owners. The only database-level unique index was on the plain `alias_norm`, which differs between the two spellings. REPRODUCED on the REV2 interface in READ COMMITTED, REPEATABLE READ and SERIALIZABLE (race_results_REV3.txt): B committed without error each time. A second race (a live owner inserted beside a concurrent AMBIGUOUS holder) also committed on REV2.

## 2. Correction (normalization_interface_REV3_DESIGN_ONLY.sql = REV2 + patch_rev3.py; nothing else changed)
1. `stg_alias.alias_key` is now a STORED GENERATED column `stg_strict_key(alias_raw)` (the database owns the key; it cannot be written). The guard computes the same value locally because generated columns are not yet set inside a BEFORE trigger.
2. New generated `alias_class` (1 = live: CONFIRMED_SEED/PROPOSED/CONFIRMED; 2 = AMBIGUOUS; null = RETIRED).
3. Exclusion constraint `stg_alias_one_live_owner_per_key`: EXCLUDE USING gist (construct_kind =, alias_key =, construct_id <>) WHERE alias_class = 1. Two different constructs cannot both hold a live alias with the same strict key. The same construct may hold several spellings of one key.
4. Exclusion constraint `stg_alias_no_live_beside_ambiguous`: (construct_kind =, alias_key =, construct_id <>, alias_class <>) WHERE alias_class IS NOT NULL. A live owner and an AMBIGUOUS holder of different constructs cannot coexist; AMBIGUOUS + AMBIGUOUS (the register case) is allowed; RETIRED rows are outside both.
5. Exclusion constraints are checked against in-flight rows of other transactions (the second writer waits for the first, then fails with SQLSTATE 23P01), so they hold in READ COMMITTED, REPEATABLE READ and SERIALIZABLE. The REV2 trigger stays as the first, readable error; the constraints are the backstop that does not depend on what the trigger can see.
6. Requires extension `btree_gist` (contrib; the `<>` operator for text). Supabase offers it; W1-25 must confirm and place it in the `extensions` schema.
New rule R-AMB-2 (consequence of 4): an ambiguity resolution is applied losers first, owner last: every non-owner member is moved to RETIRED, then the approved owner to CONFIRMED (one transaction, W1-25 loader). REV2 did the owner first; it is now refused by constraint 4 (found by the regression run, see 3). The REV2 test order for F4-B16/F4-B17 is swapped in test_w122_rev2_on_rev3.sql accordingly; nothing else in the REV2 suite changed (diff in ev folder).
Unchanged: ledger, ambiguity register, family-key rules, resolve_term, everything in REV2 section 3 not named above. F1-F3 (W1-21) not touched.

## 3. Evidence (throwaway local PostgreSQL 16.15)
- REV2 suite re-run on the REV2 interface (clean run, unchanged files, hash of test file matches the record): 96/96 PASS.
- REV2 suite on the REV3 interface (regression): 96/96 PASS (res_rev2_on_rev3.txt). First run 94/96: F4-B16/B18 failed because of the owner-first order, which led to R-AMB-2.
- New constraint-level suite test_w122_rev3_f4.sql: 20/20 PASS (res_rev3_f4.txt). It disables the guard trigger (modelling a writer whose SELECT cannot see a concurrent row) and shows the constraints alone refuse punctuation, whitespace-run and ampersand variants, an AMBIGUOUS holder beside a live owner and a live owner beside AMBIGUOUS holders; allows AMBIGUOUS+AMBIGUOUS, RETIRED, the same construct holding two spellings, and other kinds; alias_key not writable.
- Real two-session races (race2.sh; A holds its transaction 3 s, B starts after 1 s): REV2 B commits in all 3 isolation levels for the punctuation race and in 2 of 2 for the AMBIGUOUS race (violation reproduced); REV3 B is refused in all (SQLSTATE 23P01, constraint named); identical-term race is refused by the existing unique index (race_results_REV3.txt).
- Mutation: removing the two constraints makes 8 of the 20 new tests fail (res_rev3_f4_mutation.txt). Not vacuous.
- Re-run by W1-23: create a UTF8 database, `psql -f test_w122_rev3_f4.sql` (loads base excerpt, REV3 interface; expect 20 PASS) and `psql -f test_w122_rev2_on_rev3.sql` (expect 96 PASS); races: `race_setup.sql` + `race2.sh` per race_results_REV3.txt (needs `\i` iface and `-v iface=`; see script).

## 4. Disclosures
- The base excerpt and REV2 interface files fetched back from Drive hash differently from the sha256 recorded in the REV2 row (Drive copies are transcribed through a tool call): base a9e16f65... vs recorded 1981c83b...; interface a97417f6... vs recorded 554f175b.... The test file hash matches (dd67dc40...). Behaviour is identical: 96/96 PASS on the Drive copies. Verify by re-running, not by hashing.
- Executor self-check only; independence not claimed. A real Supabase branch, RLS with the service role, performance of the gist indexes and the 780/265 real rows are unproven until W1-25/W1-26.
- Not addressed (outside F4, unchanged): removal of the LAST ledger row (W1-26 must record the ledger head hash externally); AMBIGUITY_RESOLUTION change_class needs the W1-21 enum patch; HITL items (uncitral origin, doc-ocean-bl vs sea-waybill, arrival-notice, release/reserve, bare broker, compound names) and PC-01..03 counts (257/442/81 vs 258/441/81) still open for the Owner.
- Consequence for lookups: an alias row that is not live and not AMBIGUOUS must be RETIRED; there is no other state that frees a key.
