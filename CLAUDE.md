# Atlas — Standing Implementation Agent Protocol

This repository is governed. Do not select the next implementation task from chat history, assumptions or perceived convenience.

## Mandatory start-of-work read order

Before starting any Atlas implementation phase:

1. Read `governance/frozen-assets/CURRENT.json` and `governance/frozen-assets/LATEST.md`.
2. Read `governance/backlog/ATLAS_V2_AGENT_EXECUTION_QUEUE.json` from branch `atlas-governance-registry-v2.1`.
3. Read `governance/backlog/NEXT_PRODUCTION_EXECUTION_INTELLIGENCE_CRITICAL_PATH.md` from the same governance branch.
4. Read the frozen architecture/contracts referenced by the authorized phase.
5. Verify the intended implementation baseline branch/SHA against GitHub before editing.

## Task-selection rule

- Implement only the phase whose queue status is exactly `AUTHORIZED`.
- Do not start a phase marked `BLOCKED_*`, `AWAITING_INDEPENDENT_QA`, or equivalent.
- If the current authorized phase is already complete locally, return its completion report and stop.
- Never self-authorize the next phase.
- Never promote production/go-live without explicit owner / independent QA authorization.

## Architecture rule

Frozen governed architecture outranks implementation convenience. If code, old docs, prototypes, pending notes or runtime behavior conflict with frozen architecture or the current queue, report the conflict and stop rather than silently choosing.

Do not:
- work directly on `main`;
- redesign the frozen Canvas shell;
- make Malkom/runtime structures canonical Atlas truth;
- move client-specific values into canonical WorkDefinition;
- fabricate business knowledge or executability;
- hide unresolved blockers;
- overwrite frozen historical assets;
- treat historical deployment success as current production health.

## Completion rule

At the end of an authorized phase, return:
- objective;
- starting branch/SHA;
- files changed;
- migrations/backend changes;
- architecture decisions and any unresolved conflicts;
- tests/CI and exact results;
- evidence and counts;
- ending branch/SHA;
- governance/pointer changes;
- limitations/debt;
- recommended next action.

Then stop at `AWAITING_INDEPENDENT_QA`.

The next phase becomes executable only after the machine queue is updated by governance/owner QA.
