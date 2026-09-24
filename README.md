# atlas-ci-proofs

Written only by the ATL-94 GitHub Actions workflow (`.github/workflows/atl94-candidate-sql-gate.yml`).
Each run of the ATL-82 candidate SQL gate records its result here, keyed by the source commit:

- `ATL-94/by-commit/<commit-sha>.md`: latest result for that commit
- `ATL-94/runs/<commit-sha>/<run-id>-<attempt>/`: full evidence for one run (RESULT.md, result.json, gate outputs)
- `ATL-94/INDEX.tsv`: one line per run (UTC time, commit, run id, attempt, event, ref, verdict, verdict detail)

Do not edit by hand. A result is only valid together with its Actions run URL and the source commit it names.
