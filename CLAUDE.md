# Atlas — Standing Implementation Agent Protocol

This repository is governed. Do not select the next implementation task from chat history, assumptions or perceived convenience.

## Mandatory start-of-work read order

Before starting any Atlas implementation/recovery work:

1. Read `governance/frozen-assets/CURRENT.json` and `governance/frozen-assets/LATEST.md` for historical/frozen pointers, but do not assume `FROZEN` alone means complete/reproducible.
2. Read `governance/backlog/ATLAS_V2_AGENT_EXECUTION_QUEUE.json` from branch `atlas-governance-registry-v2.1`.
3. Read `governance/backlog/NEXT_PRODUCTION_EXECUTION_INTELLIGENCE_CRITICAL_PATH.md` from the same governance branch.
4. If queue mode is `PRE_P6_FOUNDATION_RECOVERY`, read `governance/standards/ATLAS_PRE_P6_FOUNDATION_RECOVERY_STANDARD_V1.md` before any other phase-specific implementation work.
5. Read the frozen architecture/contracts referenced by the authorized stage.
6. Verify the intended implementation baseline branch/SHA against GitHub before editing.

## Task-selection rule

- Implement only the stage/phase whose queue status is exactly `AUTHORIZED`.
- Do not start work marked `BLOCKED_*`, `SUSPENDED_*`, `TO_BE_RESCOPED_*`, `AWAITING_INDEPENDENT_QA`, or equivalent.
- While recovery mode is active, do not resume P6.2/P6.3/P6.4/P6.5 regardless of prior authorization/history.
- If the current authorized stage is already complete locally, return its completion report and stop.
- Never self-authorize the next stage.
- Never promote production/go-live without explicit owner / independent QA authorization.

## Architecture rule

Frozen governed architecture outranks implementation convenience. The Pre-P6 Recovery Standard is a certification/recovery overlay and does not authorize redesign of the frozen Knowledge-to-Execution architecture.

If code, old docs, prototypes, pending notes, runtime behavior or historical certification conflict with frozen architecture or the current recovery queue, report the conflict and stop rather than silently choosing.

Do not:
- work directly on `main`;
- redesign the frozen Canvas shell;
- make Malkom/runtime structures canonical Atlas truth;
- move client-specific values into canonical WorkDefinition or canonical Operational Knowledge;
- fabricate business/domain knowledge or executability;
- target historical node/count totals during a rebuild;
- hide unresolved blockers/knowledge gaps;
- overwrite, relabel or mutate frozen historical evidence to make a test pass;
- treat a hash/CI success alone as proof of completeness;
- treat historical deployment success as current production health;
- repair a downstream symptom while an upstream recovery gate remains unresolved.

## Recovery certification rule

For each applicable asset/stage, assess and report the relevant dimensions:
- SEMANTICS
- COVERAGE
- EVIDENCE
- DEPENDENCY_CLOSURE
- REPRODUCIBILITY
- REFERENTIAL_INTEGRITY
- LIVE_READABILITY
- SECURITY_BOUNDARY
- REGRESSION
- DEPLOYMENT_PARITY

Do not classify an asset `FROZEN_COMPLETE` unless all applicable dimensions pass. Use truthful interim classifications such as `FROZEN_REFERENCE`, `FROZEN_DELTA`, `FROZEN_PARTIAL`, `SEMANTICALLY_VALID_REPRODUCIBILITY_BLOCKED`, or `RECERTIFICATION_REQUIRED` where appropriate.

## Completion rule

At the end of an authorized stage/phase, return:
- objective;
- starting branch/SHA;
- authoritative inputs used and their hashes/lineage;
- files changed;
- migrations/backend changes;
- architecture decisions and unresolved conflicts;
- certification-dimension results;
- tests/CI and exact results;
- evidence and counts (derived, never target-tuned);
- ending branch/SHA;
- governance/pointer changes;
- limitations/debt;
- recommended next action.

Then stop at `AWAITING_INDEPENDENT_QA`.

The next stage becomes executable only after the machine queue is updated by governance/owner QA.
