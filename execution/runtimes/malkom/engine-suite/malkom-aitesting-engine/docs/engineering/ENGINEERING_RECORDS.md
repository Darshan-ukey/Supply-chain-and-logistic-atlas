# Maintaining Engineering Records

`ENGINEERING_EXECUTION_CHECKPOINTS.md` is the execution source of truth. The
records in this directory provide traceability and proof for its work.

## Required updates

Every product change must update, where applicable:

1. `REQUIREMENTS_TRACEABILITY.md` for implementation, proof, evidence, and status;
2. `CAPABILITY_MATRIX.md` for the capability's honest proof state;
3. `CLAIM_LEDGER.md` before making a release or documentation claim;
4. `REGRESSION_CATALOGUE.md` for an escaped defect;
5. `../decisions` for a material architecture, authority, compatibility, security, protocol, storage, healing, cleanup, or benchmark choice;
6. `../ENGINEERING_EXECUTION_CHECKPOINTS.md` only after the applicable proof exists;
7. `TEST_COVERAGE.md` whenever a test executable is added or changed. Explain
   the risk and subtle behavior, authoritative inputs, denominator, and
   exclusions—not only the filename or broad feature name.

Run `npm run smoke:engineering-records` before submitting changes. It parses
the Markdown records, validates them against the closed JSON Schema, checks
cross-record honesty invariants, and proves representative negative and
adversarial records are rejected.

The same gate hashes every `smoke/run-*.mjs` executable. A changed digest or a
new undocumented test fails before the wider smoke suite starts. Existing
`legacy-backfill-pending` entries are visible debt and cannot be used by new
tests.

Do not manually alter a status to make a gate pass. Correct the missing
implementation, test, evidence, or claim instead.
