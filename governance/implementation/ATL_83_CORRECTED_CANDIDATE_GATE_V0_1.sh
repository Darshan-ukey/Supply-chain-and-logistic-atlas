#!/usr/bin/env bash
# ATL-83 — Corrected-candidate gate for ATL-82 physical migration candidates (gate V0.1)
# Author: Claude (independent QA), 2026-09-23. Companion to
# governance/implementation/ATL_83_BOUNDED_REQA_ATL_82_V0_2_V0_1.md (section 4).

# PURPOSE: run a corrected ATL-82 candidate (V0.3 or later) exactly as written (it must compile, and its
# ROLLBACK must leave none of the 9 tables), then run a copy with only the final ROLLBACK changed to COMMIT
# through the same TG_ARGV probe, closure/regression suite and drop/rebuild as
# ATL_83_EXECUTABLE_TEST_PACK_V0_2.sh, and compare the normalized closure, drop and rebuild output with the
# DIAGNOSTIC-B results recorded in ATL_83_TEST_PACK_OUTPUT_V0_2.txt. Exit 0 only on an exact match.
# Usable as the builder's first-party executable proof and as a CI step.
# The V0.2 pack cannot do this: its diagnostic phases are V0.2-specific and exit 4 on a corrected candidate.

# The suite SQL is extracted from the V0.2 pack and the golden results from the V0.2 output; both must sit
# next to this script, and both are blob-verified before use, so the suite is identical by construction.

# SAFETY: runs ONLY against a disposable local PostgreSQL (>=15). It refuses Supabase/pooler targets, any
# non-local PGHOST, and PGSERVICE/PGSERVICEFILE/PGHOSTADDR (which can route a connection past the PGHOST check).
#   Required: ATL83_DISPOSABLE=1, PGHOST is a local socket dir or localhost/127.0.0.1, superuser PGUSER.
#   Usage:    ATL83_DISPOSABLE=1 PGHOST=/var/tmp PGPORT=55433 PGUSER=postgres \
#             ./ATL_83_CORRECTED_CANDIDATE_GATE_V0_1.sh <candidate.sql> <expected-git-blob-sha>
# The expected blob is an argument, so the gate does not change for a new candidate blob; the proof must record
# it, and QA re-verifies it against the landed candidate. The match is exact (guard-function line numbers,
# constraint names, column order), so a candidate change beyond DIAGNOSTIC-B that alters the suite's output
# needs a gate revision. Timestamp normalization means a timestamptz->timestamp change is not detected here.
# Exit codes: 0 PASS; 2 unsafe target; 3 blob mismatch, known-failed candidate or reference file mismatch;
#             5 behaviour differs from the golden DIAGNOSTIC-B results (diff printed); 6 static check failed.
# Normalization before comparison: temp-dir paths -> psql:<file>.sql:, timestamps -> <TS>, trailing whitespace
# removed (psql pads table headers; the recorded V0.2 output has trailing whitespace stripped). Nothing else.
set -uo pipefail
CAND="${1:?path to ATL-82 candidate SQL required}"
EXPECT_BLOB="${2:?expected git blob sha of the candidate required}"
[ "${ATL83_DISPOSABLE:-}" = "1" ] || { echo "refusing: set ATL83_DISPOSABLE=1 for a disposable local PostgreSQL" >&2; exit 2; }
case "${PGHOST:-}" in /*|localhost|127.0.0.1) ;; *) echo "refusing: PGHOST must be a local socket dir or localhost" >&2; exit 2;; esac
case "${PGHOST:-}${PGDATABASE:-}" in *supabase*|*pooler*) echo "refusing: Supabase target detected" >&2; exit 2;; esac
[ -z "${PGSERVICE:-}${PGSERVICEFILE:-}${PGHOSTADDR:-}" ] || { echo "refusing: PGSERVICE, PGSERVICEFILE and PGHOSTADDR must be unset" >&2; exit 2; }
command -v git >/dev/null || { echo "git required for blob pins" >&2; exit 3; }
GOT=$(git hash-object "$CAND"); [ "$GOT" = "$EXPECT_BLOB" ] || { echo "candidate blob $GOT != expected $EXPECT_BLOB" >&2; exit 3; }
case "$GOT" in
  b16a4bd9b16763287a76574e7231695b2c271f2e) echo "refusing: ATL-82 V0.1 failed ATL-83 QA; this gate is for corrected candidates" >&2; exit 3;;
  344d0d4fed7fd5ae7d271764ba1f10e0d7552d63) echo "refusing: ATL-82 V0.2 failed ATL-83 re-QA; use ATL_83_EXECUTABLE_TEST_PACK_V0_2.sh for V0.2" >&2; exit 3;;
esac
D=$(cd "$(dirname "$0")" && pwd)
PACK="$D/ATL_83_EXECUTABLE_TEST_PACK_V0_2.sh"; OUT="$D/ATL_83_TEST_PACK_OUTPUT_V0_2.txt"
[ "$(git hash-object "$PACK" 2>/dev/null)" = "b9cdbbe2d5071066f5f333e8229b65d2bb095cc1" ] || { echo "reference pack missing or not blob b9cdbbe2: $PACK" >&2; exit 3; }
[ "$(git hash-object "$OUT" 2>/dev/null)" = "f79e97e887552dc3b6e792049552cff261b7fe04" ] || { echo "reference output missing or not blob f79e97e8: $OUT" >&2; exit 3; }
W=$(mktemp -d); trap 'rm -rf "$W"' EXIT
PSQL="psql -X -q"
extract() { sed -n "/^cat > \"\\\$W\/$1\" <<'SQL'\$/,/^SQL\$/p" "$PACK" | sed '1d;$d' > "$W/$1"; [ -s "$W/$1" ] || { echo "could not extract $1 from the reference pack" >&2; exit 3; }; }
for f in harness.sql argv.sql closure.sql down.sql rebuild.sql; do extract "$f"; done
norm() { sed -E -e 's#psql:[^ ]*/(closure|down|rebuild)\.sql:#psql:\1.sql:#' -e 's/[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]+)?([+-][0-9]{2}(:[0-9]{2})?)?/<TS>/g' -e 's/[[:space:]]+$//'; }
sed -n '220,391p' "$OUT" | norm > "$W/gold_closure.txt"
sed -n '393,403p' "$OUT" | norm > "$W/gold_down.txt"
sed -n '404,419p' "$OUT" | norm > "$W/gold_rebuild.txt"
head -n1 "$W/gold_closure.txt" | grep -q 'fixtures' && head -n1 "$W/gold_down.txt" | grep -q '^== DOWN' && head -n1 "$W/gold_rebuild.txt" | grep -q '^== REBUILD' || { echo "golden sections not found in the reference output" >&2; exit 3; }
fresh() { $PSQL -d postgres -c "drop database if exists $1" -c "create database $1" 2>&1 | grep -v 'does not exist, skipping'; $PSQL -v ON_ERROR_STOP=1 -d "$1" -f "$W/harness.sql"; }
compare() { if diff "$W/gold_$1.txt" "$W/got_$1.txt" > "$W/diff_$1.txt"; then echo "golden match: $1 (DIAGNOSTIC-B results reproduced exactly)"; else echo "GOLDEN MISMATCH: $1 (< golden DIAGNOSTIC-B, > candidate)"; cat "$W/diff_$1.txt"; FAIL=1; fi; }
V9="('atlas_knowledge_entity_types','atlas_knowledge_relationship_types','atlas_knowledge_generation_runs','atlas_knowledge_entities','atlas_knowledge_relationships','atlas_evidence_sources','atlas_knowledge_evidence_links','atlas_knowledge_gap_links','atlas_generation_z5_outputs')"
FAIL=0

echo "== GATE-0 identity and static checks"
echo "candidate blob verified: $GOT"
echo "reference pack b9cdbbe2 and reference output f79e97e8 verified; suite extracted from the pack"
LONE=$(grep -c -E '(as [$]$|end [$];$)' "$CAND"); echo "lines ending in a lone dollar quote (expect 0): $LONE"
echo "tg_argv uses:"; grep -n 'tg_argv' "$CAND"
UNGUARDED=$(grep 'any *( *tg_argv *)' "$CAND" | grep -vc coalesce); echo "tg_argv array tests without a NULL guard (expect 0): $UNGUARDED"
echo "readiness tables created (expect 0): $(grep -c -i 'create table public.atlas_readiness' "$CAND")"
NRB=$(grep -c '^rollback;$' "$CAND"); echo "candidate ends in: $(tail -n1 "$CAND") (rollback lines: $NRB, expect 1)"
[ "$LONE" = "0" ] && [ "$UNGUARDED" = "0" ] && [ "$NRB" = "1" ] || { echo "STATIC CHECK FAILED" >&2; exit 6; }

echo "== GATE-1 candidate exactly as written (single transaction, ON_ERROR_STOP=1, ends in ROLLBACK)"
fresh atl83g_p1
$PSQL -v ON_ERROR_STOP=1 -d atl83g_p1 -f "$CAND" 2>&1; RC=$?; echo "as-written psql exit code (expect 0): $RC"
N=$($PSQL -At -d atl83g_p1 -c "select count(*) from pg_tables where schemaname='public' and tablename in $V9"); echo "tables remaining after ROLLBACK (expect 0): $N"
[ "$RC" = "0" ] && [ "$N" = "0" ] || { echo "GATE-1 FAILED: candidate does not run cleanly as written"; FAIL=1; }

echo "== GATE-2 candidate committed (only the final ROLLBACK changed to COMMIT): TG_ARGV probe and closure suite"
sed 's/^rollback;$/commit;/' "$CAND" > "$W/cand_commit.sql"
echo "commit-copy diff (expect one changed line):"; diff "$CAND" "$W/cand_commit.sql" | grep -E '^[0-9]'
fresh atl83g_p2
$PSQL -v ON_ERROR_STOP=1 -d atl83g_p2 -f "$W/cand_commit.sql"; echo "committed psql exit code: $?"
$PSQL -d atl83g_p2 -f "$W/argv.sql" 2>&1
$PSQL -d atl83g_p2 -f "$W/closure.sql" > "$W/raw_closure.txt" 2>&1; cat "$W/raw_closure.txt"; norm < "$W/raw_closure.txt" > "$W/got_closure.txt"
compare closure

echo "== GATE-3 drop and rebuild"
fresh atl83g_p3
$PSQL -v ON_ERROR_STOP=1 -d atl83g_p3 -f "$W/cand_commit.sql"
$PSQL -d atl83g_p3 -f "$W/down.sql" > "$W/raw_down.txt" 2>&1; cat "$W/raw_down.txt"; norm < "$W/raw_down.txt" > "$W/got_down.txt"
$PSQL -v ON_ERROR_STOP=1 -d atl83g_p3 -f "$W/cand_commit.sql"
$PSQL -d atl83g_p3 -f "$W/rebuild.sql" > "$W/raw_rebuild.txt" 2>&1; cat "$W/raw_rebuild.txt"; norm < "$W/raw_rebuild.txt" > "$W/got_rebuild.txt"
compare down
compare rebuild
for d in atl83g_p1 atl83g_p2 atl83g_p3; do $PSQL -d postgres -c "drop database if exists $d"; done

if [ "$FAIL" = "0" ]; then echo "== GATE RESULT: PASS (candidate $GOT runs clean as written; its committed copy reproduces every DIAGNOSTIC-B result)"; exit 0; fi
echo "== GATE RESULT: FAIL (candidate $GOT)"; exit 5
