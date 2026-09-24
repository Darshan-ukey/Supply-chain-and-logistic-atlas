#!/usr/bin/env bash
# ATL-94 — CI proof publisher (publisher V0.1)
# Author: Claude, 2026-09-24. Called by .github/workflows/atl94-candidate-sql-gate.yml after the gate job.
#
# PURPOSE: make each CI gate result durable and readable by every agent with a plain file read (no Actions API
# needed). Writes to the dedicated branch atlas-ci-proofs, never to any other branch:
#   ATL-94/by-commit/<commit-sha>.md                  latest result for that commit (overwritten by re-runs)
#   ATL-94/runs/<commit-sha>/<run-id>-<attempt>/      RESULT.md, result.json, gate-*.txt for that run
#   ATL-94/INDEX.tsv                                  one appended line per run
# The branch is created as an orphan on first use. Each attempt starts from a fresh fetch and re-applies the
# files, so concurrent runs resolve by retrying the push.
#
# Inputs (env): ATL94_RESULT_DIR (the gate job's result files; may be empty if that job crashed),
#   ATL94_GATE_JOB_RESULT (success|failure|...), GITHUB_SHA, GITHUB_RUN_ID, GITHUB_RUN_ATTEMPT, GITHUB_REF_NAME,
#   GITHUB_EVENT_NAME, GITHUB_REPOSITORY, GITHUB_SERVER_URL, GITHUB_TOKEN (contents: write; used only as an HTTP
#   auth header for github.com). ATL94_PROOF_REMOTE overrides the remote URL (local testing).
set -uo pipefail
BRANCH=atlas-ci-proofs
[ "${ATL94_PROOF_BRANCH:-$BRANCH}" = "$BRANCH" ] || { echo "refusing: proofs may only be written to $BRANCH" >&2; exit 2; }
SHA="${GITHUB_SHA:?GITHUB_SHA required}"; RUN="${GITHUB_RUN_ID:?GITHUB_RUN_ID required}"; ATT="${GITHUB_RUN_ATTEMPT:-1}"
case "$SHA" in *[!0-9a-f]*|"") echo "refusing: GITHUB_SHA is not a hex commit id" >&2; exit 2;; esac
case "$RUN$ATT" in *[!0-9]*) echo "refusing: run id/attempt must be numeric" >&2; exit 2;; esac
RES="${ATL94_RESULT_DIR:-}"; JOBRES="${ATL94_GATE_JOB_RESULT:-unknown}"
REMOTE="${ATL94_PROOF_REMOTE:-${GITHUB_SERVER_URL:-https://github.com}/${GITHUB_REPOSITORY:?GITHUB_REPOSITORY required}.git}"
RUNURL="${GITHUB_SERVER_URL:-https://github.com}/${GITHUB_REPOSITORY:-local}/actions/runs/$RUN"
AUTH=()
if [ -n "${GITHUB_TOKEN:-}" ] && [ -z "${ATL94_PROOF_REMOTE:-}" ]; then
  B64=$(printf 'x-access-token:%s' "$GITHUB_TOKEN" | base64 -w0)
  [ "${GITHUB_ACTIONS:-}" = true ] && echo "::add-mask::$B64"
  AUTH=(-c "http.https://github.com/.extraheader=AUTHORIZATION: basic $B64")
fi
# Identity of the CI code in the checked-out commit, computed here independently of the gate job's files.
CI_CODE="unknown"
if TOP=$(git rev-parse --show-toplevel 2>/dev/null); then
  rb() { git hash-object --no-filters -- "$TOP/$1" 2>/dev/null || echo missing; }
  CI_CODE="workflow $(rb .github/workflows/atl94-candidate-sql-gate.yml), runner $(rb governance/implementation/ATL_94_CI_CANDIDATE_GATE_RUNNER_V0_1.sh), publisher $(rb governance/implementation/ATL_94_CI_PROOF_PUBLISHER_V0_1.sh)"
fi

if [ -n "$RES" ] && [ -f "$RES/RESULT.md" ] && [ -f "$RES/result.json" ]; then
  OVERALL=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["overall"])' "$RES/result.json" 2>/dev/null || echo UNKNOWN)
  DETAIL=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("verdict_detail",""))' "$RES/result.json" 2>/dev/null | head -1 | tr -d '\t`')
else
  OVERALL=FAIL; RES=""; DETAIL=""
fi
case "$OVERALL" in PASS|FAIL) ;; *) OVERALL=FAIL;; esac
# The job result is authoritative for FAIL: a PASS file from a job that did not succeed is recorded as FAIL.
[ "$JOBRES" = success ] || OVERALL=FAIL
[ "$OVERALL" = PASS ] || DETAIL="FAIL"
case "$DETAIL" in PASS*|FAIL) ;; *) DETAIL="$OVERALL";; esac

BASE=$(mktemp -d); trap 'rm -rf "$BASE"' EXIT
publish_once() { # $1 = attempt number; runs in a subshell; writes the proof commit id to $BASE/commit
  local d="$BASE/attempt-$1"; mkdir -p "$d" && cd "$d" || return 1
  git init -q . && git config user.name "atlas-ci-gate[bot]" && git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
  git remote add origin "$REMOTE"
  if git "${AUTH[@]}" ls-remote origin "refs/heads/$BRANCH" 2>/dev/null | awk -v r="refs/heads/$BRANCH" '$2 == r {f = 1} END {exit !f}'; then
    git "${AUTH[@]}" fetch -q --depth=1 origin "refs/heads/$BRANCH" && git checkout -q -B "$BRANCH" FETCH_HEAD || return 1
  else
    git checkout -q --orphan "$BRANCH"
    cat > README.md <<'EOF'
# atlas-ci-proofs

Written only by the ATL-94 GitHub Actions workflow (`.github/workflows/atl94-candidate-sql-gate.yml`).
Each run of the ATL-82 candidate SQL gate records its result here, keyed by the source commit:

- `ATL-94/by-commit/<commit-sha>.md`: latest result for that commit
- `ATL-94/runs/<commit-sha>/<run-id>-<attempt>/`: full evidence for one run (RESULT.md, result.json, gate outputs)
- `ATL-94/INDEX.tsv`: one line per run (UTC time, commit, run id, attempt, event, ref, verdict, verdict detail)

Do not edit by hand. A result is only valid together with its Actions run URL and the source commit it names.
EOF
  fi
  local R="ATL-94/runs/$SHA/$RUN-$ATT"; mkdir -p "$R" ATL-94/by-commit
  if [ -n "$RES" ]; then cp "$RES"/RESULT.md "$RES"/result.json "$R"/; for g in "$RES"/gate-*.txt; do [ -f "$g" ] && cp "$g" "$R"/; done; fi
  {
    echo "# ATL-94 proof for commit \`$SHA\`: **${DETAIL:-$OVERALL}**"
    echo
    echo "- Actions run: $RUNURL (attempt $ATT)"
    echo "- Gate job result: \`$JOBRES\`"
    echo "- CI code in this commit (raw blobs, computed by the publish job): $CI_CODE"
    echo "- Event / ref: \`${GITHUB_EVENT_NAME:-unknown}\` / \`${GITHUB_REF_NAME:-unknown}\`"
    echo "- Full evidence: \`$R/\`"
    echo
    if [ -n "$RES" ]; then cat "$RES/RESULT.md"; else echo "The gate job produced no result files (job result: $JOBRES). Treat this commit as FAIL."; fi
  } > "ATL-94/by-commit/$SHA.md"
  printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$SHA" "$RUN" "$ATT" "${GITHUB_EVENT_NAME:-unknown}" "${GITHUB_REF_NAME:-unknown}" "$OVERALL" "${DETAIL:-$OVERALL}" >> ATL-94/INDEX.tsv
  git add -A .
  git commit -q -m "ATL-94 proof: $OVERALL for ${SHA:0:12} (run $RUN attempt $ATT)" || return 1
  git "${AUTH[@]}" push -q origin "HEAD:refs/heads/$BRANCH" || return 1
  git rev-parse HEAD > "$BASE/commit"
}

for i in 1 2 3 4 5 6; do
  if (publish_once "$i"); then
    MSG="Published ATL-94 proof ($OVERALL) for $SHA to $BRANCH:ATL-94/by-commit/$SHA.md in proof commit $(cat "$BASE/commit")"
    echo "$MSG"; [ -n "${GITHUB_STEP_SUMMARY:-}" ] && printf '\n%s\n' "$MSG" >> "$GITHUB_STEP_SUMMARY"
    exit 0
  fi
  echo "publish attempt $i failed; retrying from a fresh fetch" >&2; sleep $((i * 3 + RANDOM % 4))
done
echo "could not publish the ATL-94 proof after 6 attempts" >&2; exit 1
