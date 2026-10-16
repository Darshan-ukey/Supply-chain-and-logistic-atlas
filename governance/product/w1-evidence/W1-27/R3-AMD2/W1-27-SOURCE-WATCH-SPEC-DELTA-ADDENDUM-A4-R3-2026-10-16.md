# W1-27 Source Watch delta addendum A4 - AMD2 (R3 rework, partial) - 2026-10-16
Executor: CLAUDE scheduled monitor, op W127-A4R3-REWORK-20261016-1303-IST. Executor self-check only; not independent QA; nothing approved.
Base: A4 (byte-exact, unchanged) + R2 amendment (F-A4-01..05). This file adds ONLY what is listed below.

## Covered in this revision
1. Cycle package schema 2.1 (supersedes 2.0; identity.schema_version const "2.1"). New optional root property delta_closure (array of deltaClosure) and root conditional H24: package_state PUBLISHED, CONSUMER_PROPAGATED or MONITORED requires delta_closure.
2. W1-GOV-001 per-destination disposition and completeness readback (requirements v3.2 s8.7). One deltaClosure record per accepted delta; exactly six destinations once each: PRODUCT_DEFINITION, ARCHITECTURE_REGISTRY, FEATURE_CAPABILITY_REGISTRY, GOVERNANCE_CHANGE_CONTROL, PRODUCT_EVOLUTION_RECORD, DECISION_REGISTER. Disposition CHANGED | NO_CHANGE_REQUIRED | BLOCKED (reason required unless CHANGED). readback {performed, result PASS|FAIL|NOT_RUN, destinations_checked 0-6}.
3. Semantic rules S77-S80 (published or later): S77 exactly one closure record per accepted delta; S78 six destinations exactly once; S79 no BLOCKED destination; S80 readback performed, PASS, over all six.
4. R2 rules S58-S76 re-implemented in the regenerated runner (see R2 amendment for their text), plus S68 digest total = watch-list size.
5. Tests: run_delta_tests.py 139 tests, 0 fails: prior 95, R2-scope valid fixtures SW-D18..D20, closure fixtures SW-D21..D23, negatives SW-N77..N111 (each checked against its intended rule or schema layer), SW-D24 no dead rule (S58-S80 all fire), SW-D25 rule-switch mutation, SW-D26 108-combination closure differential. SW-D15 (4320) and SW-D16 mutation still pass.

## NOT covered (still open, row 36 remains REWORK_REQUIRED)
(a) routing storage option vs atlas_knowledge_gaps, (b) TMP-AG-02/13 absorption mapping, (c) four-layer QA mapping, (d) convergence-state mapping, (f) RLS / no-anon rule for proposed staging tables. These are design-contract items from H36 / requirements v3.2 s8 and s10 and need a separate bounded run.

## Notes
The runner reads cycle-package.schema.json by that name; Drive copy is stored with an -A4-R3 suffix, rename on download. Drive sizes are from create results, not downloaded hash checks.
