#!/usr/bin/env bash
# ATL-94 — CI runner for the ATL-82 candidate gate (runner V0.1)
# Author: Claude, 2026-09-24. Called by .github/workflows/atl94-candidate-sql-gate.yml; also runnable locally.
#
# PURPOSE: GitHub executes the candidate SQL so that no agent has to. The run is PASS only if ALL of these hold:
#   - CANARY: this environment reproduces the recorded gate results. The stand-in (V0.2 + exactly the three
#     DIAGNOSTIC-B lines) must PASS (gate exit 0), the B1-only mutant must be rejected by the static check (6)
#     and the nullable-output_hash mutant must fail the golden comparison (5). Canary files are rebuilt from V0.2
#     with fixed sed edits and blob-asserted.
#   - NAMING: every tracked file whose path mentions ATL-82 / ATL_82 / ATL 82 (any case, in a file or folder name)
#     and ends in .sql, .psql, .pgsql or .ddl must be exactly
#     governance/implementation/ATL_82_CANDIDATE_PHYSICAL_MIGRATION_V<n>_<m>.sql and a regular file.
#   - HISTORY: V0_1 and V0_2 are skipped only if name AND bytes match the failed originals (b16a4bd9, 344d0d4f).
#     A modified V0_1/V0_2, or a byte copy of either under another name, is a FAIL.
#   - PINS: every other candidate's raw bytes (git hash-object --no-filters) equal the single well-formed
#     blob_sha pinned for its path in governance/task-manifests/ATL-82.yaml working_outputs. Duplicate YAML keys,
#     a working_outputs path with unexpected characters, a blob_sha that is not 40 lowercase hex, conflicting
#     pins, or any pinned .sql path (any case) that is not a present, correctly named candidate are FAILs.
#   - GATE: governance/implementation/ATL_83_CORRECTED_CANDIDATE_GATE_V0_1.sh (blob-pinned below, with its
#     reference pack and output also pinned) exits 0 for every non-historical candidate. An unpinned candidate
#     is still gated so the SQL commit gets feedback, but the run stays FAIL until its pin lands.
# "PASS (canary only)" means no candidate beyond the historical ones exists yet; the canary still executed the gate.
#
# SAFETY: disposable local PostgreSQL only. Same refusals as the gate: ATL83_DISPOSABLE=1 required, PGHOST must be
# a local socket dir or localhost/127.0.0.1, no Supabase/pooler target, PGSERVICE/PGSERVICEFILE/PGHOSTADDR unset.
# No secrets are read. Nothing is written outside ATL94_OUT_DIR and a temp dir.
#
# Usage: ATL83_DISPOSABLE=1 PGHOST=<socket dir> PGPORT=<port> PGUSER=<superuser> \
#        ATL94_OUT_DIR=<dir> ./ATL_94_CI_CANDIDATE_GATE_RUNNER_V0_1.sh
# Outputs in ATL94_OUT_DIR: RESULT.md (human summary), result.json (machine), gate-*.txt (full gate outputs).
set -uo pipefail

[ "${ATL83_DISPOSABLE:-}" = "1" ] || { echo "refusing: set ATL83_DISPOSABLE=1 for a disposable local PostgreSQL" >&2; exit 2; }
case "${PGHOST:-}" in /*|localhost|127.0.0.1) ;; *) echo "refusing: PGHOST must be a local socket dir or localhost" >&2; exit 2;; esac
case "${PGHOST:-}${PGDATABASE:-}" in *supabase*|*pooler*) echo "refusing: Supabase target detected" >&2; exit 2;; esac
[ -z "${PGSERVICE:-}${PGSERVICEFILE:-}${PGHOSTADDR:-}" ] || { echo "refusing: PGSERVICE, PGSERVICEFILE and PGHOSTADDR must be unset" >&2; exit 2; }

ROOT="${ATL94_REPO_ROOT:-$(git rev-parse --show-toplevel)}"
OUT="${ATL94_OUT_DIR:?set ATL94_OUT_DIR}"
mkdir -p "$OUT"
IMPL="$ROOT/governance/implementation"
MANIFEST="$ROOT/governance/task-manifests/ATL-82.yaml"
GATE="$IMPL/ATL_83_CORRECTED_CANDIDATE_GATE_V0_1.sh"
PINNED_REFS="ATL_83_CORRECTED_CANDIDATE_GATE_V0_1.sh:9af8eef15dbd3e6750dc643583ad0cf6ae1e2c6b ATL_83_EXECUTABLE_TEST_PACK_V0_2.sh:b9cdbbe2d5071066f5f333e8229b65d2bb095cc1 ATL_83_TEST_PACK_OUTPUT_V0_2.txt:f79e97e887552dc3b6e792049552cff261b7fe04"
V02="$IMPL/ATL_82_CANDIDATE_PHYSICAL_MIGRATION_V0_2.sql"
V02_BLOB=344d0d4fed7fd5ae7d271764ba1f10e0d7552d63
HISTORICAL="ATL_82_CANDIDATE_PHYSICAL_MIGRATION_V0_1:b16a4bd9b16763287a76574e7231695b2c271f2e:V0.1-failed-ATL-83-QA ATL_82_CANDIDATE_PHYSICAL_MIGRATION_V0_2:344d0d4fed7fd5ae7d271764ba1f10e0d7552d63:V0.2-failed-ATL-83-re-QA"
VALID_REL='^governance/implementation/ATL_82_CANDIDATE_PHYSICAL_MIGRATION_V[0-9]+_[0-9]+\.sql$'
W=$(mktemp -d); trap 'rm -rf "$W"' EXIT
ROWS="$W/rows.tsv"; : > "$ROWS"; : > "$W/seen"
OVERALL=PASS; NOTES=""; GATED=0; PASSED=0
note() { NOTES="$NOTES$1"$'\n'; }
row() { printf '%s\t%s\t%s\t%s\t%s\t%s\n' "$1" "$2" "$3" "$4" "$5" "$6" >> "$ROWS"; }  # kind name blob pin exit verdict
fail() { OVERALL=FAIL; }
rawblob() { git hash-object --no-filters -- "$1" 2>/dev/null || echo unreadable; }
rungate() { bash "$GATE" "$2" "$3" > "$OUT/gate-$1.txt" 2>&1; RC=$?; }  # name candidate blob -> RC

# --- prerequisites -------------------------------------------------------------------------------------------
fatal=0
for spec in $PINNED_REFS; do
  f="$IMPL/${spec%%:*}"; want=${spec#*:}
  if [ ! -f "$f" ]; then note "missing reference file: governance/implementation/${spec%%:*}"; fatal=1
  elif [ "$(rawblob "$f")" != "$want" ]; then note "governance/implementation/${spec%%:*} blob $(rawblob "$f") != pinned $want"; fatal=1; fi
done
[ -f "$MANIFEST" ] || { note "manifest missing: governance/task-manifests/ATL-82.yaml"; fatal=1; }
[ -f "$V02" ] && [ "$(rawblob "$V02")" = "$V02_BLOB" ] || { note "canary source V0.2 missing or not blob 344d0d4f"; fatal=1; }
python3 -c 'import yaml' 2>/dev/null || { note "python3 PyYAML not available"; fatal=1; }
PGV=$(psql -X -At -d postgres -c 'show server_version' 2>/dev/null) || PGV=unknown
PGC=$(psql -X -At -d postgres -c "select datcollate from pg_database where datname='template1'" 2>/dev/null) || PGC=unknown
PSQLV=$(psql --version 2>/dev/null) || PSQLV=unknown
[ "$PGV" = unknown ] && { note "cannot connect to the disposable PostgreSQL"; fatal=1; }
CI_CODE="workflow $(rawblob "$ROOT/.github/workflows/atl94-candidate-sql-gate.yml"), runner $(rawblob "$IMPL/ATL_94_CI_CANDIDATE_GATE_RUNNER_V0_1.sh"), publisher $(rawblob "$IMPL/ATL_94_CI_PROOF_PUBLISHER_V0_1.sh")"

if [ "$fatal" = 1 ]; then
  fail
else
  # --- canary ---------------------------------------------------------------------------------------------------
  C="$W/canary"; mkdir -p "$C"
  sed -e '214s/ as [$]$/ as $$/' -e '226s/^end [$];$/end $$;/' -e "221s/col = any (tg_argv)/col = any (coalesce(tg_argv, '{}'::text[]))/" "$V02" > "$C/standin.sql"
  sed -e '214s/ as [$]$/ as $$/' -e '226s/^end [$];$/end $$;/' "$V02" > "$C/b1_only.sql"
  sed '176s/output_hash text not null,/output_hash text,/' "$C/standin.sql" > "$C/hash_nullable.sql"
  for spec in "standin:31e9f4ca8c3877519dda71f84b82502d7476ff86:0" "b1_only:0ee97349aa165870083a87939c1c354f9a43be36:6" "hash_nullable:4f14071c55c73e5778470cc36ca3185c40600c0e:5"; do
    n=${spec%%:*}; rest=${spec#*:}; b=${rest%%:*}; want=${rest#*:}
    got=$(rawblob "$C/$n.sql")
    if [ "$got" != "$b" ]; then row canary "$n" "$got" "$b" - "FAIL (canary file not reproduced)"; fail; continue; fi
    rungate "canary-$n" "$C/$n.sql" "$b"
    if [ "$RC" = "$want" ]; then row canary "$n" "$b" "expect exit $want" "$RC" OK; else row canary "$n" "$b" "expect exit $want" "$RC" "FAIL (environment does not reproduce the recorded gate results)"; fail; fi
  done

  # --- pins from ATL-82.yaml (string-only parsing; duplicate keys rejected) --------------------------------------
  if ! python3 - "$MANIFEST" > "$W/pins.tsv" 2> "$W/pins.err" <<'PY'
import sys, yaml
class L(yaml.BaseLoader):
    pass
def nodup(loader, node, deep=False):
    keys = [loader.construct_object(k, deep=True) for k, _ in node.value]
    if len(keys) != len(set(map(str, keys))):
        raise SystemExit("duplicate mapping key at %s" % node.start_mark)
    return yaml.BaseLoader.construct_mapping(loader, node, deep)
L.add_constructor(yaml.resolver.BaseResolver.DEFAULT_MAPPING_TAG, nodup)
d = yaml.load(open(sys.argv[1]), Loader=L) or {}
wo = d.get('working_outputs') if isinstance(d, dict) else None
if wo is not None and not isinstance(wo, list):
    raise SystemExit("working_outputs is not a list")
import re
for e in (wo or []):
    if isinstance(e, dict) and 'blob_sha' in e:
        p, b = e.get('path'), e['blob_sha']
        if not isinstance(p, str) or not re.fullmatch(r'[A-Za-z0-9._/-]+', p.strip()):
            raise SystemExit("malformed working_outputs path: %r" % (p,))
        ok = isinstance(b, str) and re.fullmatch(r'[0-9a-f]{40}', b.strip())
        print("%s\t%s" % (p.strip(), b.strip() if ok else "MALFORMED"))
PY
  then note "could not parse ATL-82.yaml: $(tr '\n' ' ' < "$W/pins.err")"; fail; : > "$W/pins.tsv"; fi

  # --- stray candidate-like files -------------------------------------------------------------------------------
  git -C "$ROOT" -c core.quotePath=true ls-files > "$W/all" || { note "git ls-files failed"; fail; }
  grep -Ei 'atl[-_ ]?82([^0-9].*)?\.(sql|psql|pgsql|ddl)"?$' "$W/all" | sort -u > "$W/tracked"
  while IFS= read -r s; do
    grep -Eq "$VALID_REL" <<< "$s" || { row candidate "$s" - - - "FAIL (ATL-82 SQL file not named governance/implementation/ATL_82_CANDIDATE_PHYSICAL_MIGRATION_V<n>_<m>.sql)"; fail; }
  done < "$W/tracked"

  # --- candidates -----------------------------------------------------------------------------------------------
  shopt -s nullglob
  for f in "$IMPL"/ATL_82_CANDIDATE_PHYSICAL_MIGRATION_V*.sql; do
    rel="governance/implementation/$(basename "$f")"; name=$(basename "$f" .sql)
    grep -Eq "$VALID_REL" <<< "$rel" || continue   # already reported as stray if tracked
    echo "$rel" >> "$W/seen"
    if [ -L "$f" ] || [ ! -f "$f" ]; then row candidate "$name" - - - "FAIL (not a regular file)"; fail; continue; fi
    b=$(rawblob "$f")
    hist=""; copy=""; histname=""
    for h in $HISTORICAL; do hn=${h%%:*}; r=${h#*:}; hb=${r%%:*}; why=${r#*:}
      [ "$hn" = "$name" ] && histname="$why"
      if [ "$hb" = "$b" ]; then if [ "$hn" = "$name" ]; then hist="$why"; else copy="$why"; fi; fi
    done
    if [ -n "$hist" ]; then row candidate "$name" "$b" - - "SKIPPED ($hist)"; continue; fi
    if [ -n "$histname" ]; then row candidate "$name" "$b" - - "FAIL (historical candidate modified in place; it must stay byte-identical: $histname)"; fail; continue; fi
    if [ -n "$copy" ]; then row candidate "$name" "$b" - - "FAIL (byte copy of a known-failed candidate: $copy)"; fail; continue; fi
    GATED=$((GATED + 1))
    pins=$(awk -F'\t' -v p="$rel" '$1==p{print $2}' "$W/pins.tsv" | sort -u)
    npins=$(printf '%s' "$pins" | grep -c . || true)
    if [ "$npins" = 0 ]; then
      rungate "$name" "$f" "$b"
      if [ "$RC" = 0 ]; then gv="gate PASS"; else gv="gate exit $RC; see gate-$name.txt"; fi
      row candidate "$name" "$b" "none" "$RC" "FAIL (not pinned in ATL-82.yaml working_outputs; $gv)"; fail; continue
    fi
    if [ "$npins" != 1 ]; then row candidate "$name" "$b" "$(echo "$pins" | tr '\n' ' ')" - "FAIL (conflicting pins in ATL-82.yaml)"; fail; continue; fi
    if ! grep -Eq '^[0-9a-f]{40}$' <<< "$pins"; then row candidate "$name" "$b" "$pins" - "FAIL (malformed pin in ATL-82.yaml)"; fail; continue; fi
    if [ "$pins" != "$b" ]; then row candidate "$name" "$b" "$pins" - "FAIL (file does not match its ATL-82.yaml pin)"; fail; continue; fi
    rungate "$name" "$f" "$b"
    if [ "$RC" = 0 ]; then row candidate "$name" "$b" "$pins" 0 PASS; PASSED=$((PASSED + 1)); else row candidate "$name" "$b" "$pins" "$RC" "FAIL (gate exit $RC; see gate-$name.txt)"; fail; fi
  done
  # a pinned candidate path must be present and gated in this commit
  while IFS=$'\t' read -r p pb; do
    case "$(printf '%s' "$p" | tr '[:upper:]' '[:lower:]')" in *.sql|*.psql|*.pgsql|*.ddl|*atl_82_candidate*|*atl-82*candidate*)
      grep -qxF -- "$p" "$W/seen" || { row pin "$p" - "$pb" - "FAIL (pinned in ATL-82.yaml but not a present, correctly named candidate in this commit)"; fail; };;
    esac
  done < "$W/pins.tsv"
fi

if [ "$OVERALL" = PASS ] && [ "$GATED" = 0 ]; then DETAIL="PASS (canary only: no candidate beyond the historical V0.1/V0.2 exists yet)"
elif [ "$OVERALL" = PASS ]; then DETAIL="PASS ($PASSED of $GATED candidate(s) passed the gate)"
else DETAIL="FAIL"; fi

# --- report ---------------------------------------------------------------------------------------------------
{
  echo "# ATL-94 CI gate result: **$DETAIL**"
  echo
  echo "| Field | Value |"
  echo "|---|---|"
  echo "| Repository | ${GITHUB_REPOSITORY:-local} |"
  echo "| Ref | ${GITHUB_REF_NAME:-$(git -C "$ROOT" rev-parse --abbrev-ref HEAD 2>/dev/null || echo local)} |"
  echo "| Commit | ${GITHUB_SHA:-$(git -C "$ROOT" rev-parse HEAD 2>/dev/null || echo local)} |"
  echo "| Event | ${GITHUB_EVENT_NAME:-local} |"
  if [ -n "${GITHUB_RUN_ID:-}" ]; then echo "| Run | ${GITHUB_SERVER_URL:-https://github.com}/${GITHUB_REPOSITORY:-}/actions/runs/$GITHUB_RUN_ID (attempt ${GITHUB_RUN_ATTEMPT:-1}) |"; else echo "| Run | local run |"; fi
  echo "| Runner | ${RUNNER_OS:-local} ${ImageOS:-} ${ImageVersion:-} |"
  echo "| PostgreSQL server / client | $PGV / $PSQLV |"
  echo "| Cluster collation | $PGC |"
  echo "| Reference files | $PINNED_REFS |"
  echo "| CI code (raw blobs) | $CI_CODE |"
  echo "| Candidates checked / passed | $GATED / $PASSED |"
  echo "| UTC time | $(date -u +%Y-%m-%dT%H:%M:%SZ) |"
  echo
  echo "| Kind | Name | Blob | Pin / expectation | Exit | Verdict |"
  echo "|---|---|---|---|---|---|"
  awk -F'\t' '{printf "| %s | %s | `%s` | %s | %s | %s |\n",$1,$2,$3,$4,$5,$6}' "$ROWS"
  if [ -n "$NOTES" ]; then echo; echo "Notes:"; printf '%s' "$NOTES" | sed 's/^/- /'; fi
  echo
  echo "Gate output SHA-256:"
  for g in "$OUT"/gate-*.txt; do [ -f "$g" ] && echo "- $(basename "$g"): \`$(sha256sum "$g" | cut -c1-64)\`"; done
} > "$OUT/RESULT.md"
python3 - "$ROWS" "$OVERALL" "$DETAIL" "$GATED" "$PASSED" "$CI_CODE" > "$OUT/result.json" <<'PY'
import sys, json, os
rows = [dict(zip(["kind","name","blob","pin_or_expectation","exit","verdict"], l.rstrip("\n").split("\t"))) for l in open(sys.argv[1]) if l.strip()]
print(json.dumps({"task": "ATL-94", "overall": sys.argv[2], "verdict_detail": sys.argv[3], "candidates_gated": int(sys.argv[4]),
  "candidates_passed": int(sys.argv[5]), "ci_code_blobs": sys.argv[6], "commit": os.environ.get("GITHUB_SHA"),
  "run_id": os.environ.get("GITHUB_RUN_ID"), "run_attempt": os.environ.get("GITHUB_RUN_ATTEMPT"), "ref": os.environ.get("GITHUB_REF_NAME"),
  "gate_blob": "9af8eef15dbd3e6750dc643583ad0cf6ae1e2c6b", "results": rows}, indent=2))
PY
cat "$OUT/RESULT.md"
[ -n "${GITHUB_STEP_SUMMARY:-}" ] && cat "$OUT/RESULT.md" >> "$GITHUB_STEP_SUMMARY"
[ "$OVERALL" = PASS ] && exit 0 || exit 1
