# Controlled Phase Execution & Recovery Gate V1

Status: OWNER-AUTHORIZED GLOBAL EXECUTION GOVERNANCE  
Effective: 15 September 2026  
Applies to: ChatGPT, Prod/production execution agents, Claude when authorized, and any future Atlas execution agent or human operator advancing governed phases.

## 1. Purpose

Atlas phases must not advance merely because their output appears complete or works in the current environment.

A phase is CLOSED only when its result is independently understandable, version-identified, recoverable, protected from unintended mutation, and safe for the next phase to consume.

The governing question at every phase boundary is:

> If the current working environment disappeared tomorrow, could Atlas reproduce or restore this phase exactly enough to prove what was approved, recover the working system, and continue safely from the same governed state?

If the answer is no, the phase is not closed.

## 2. Mandatory execution sequence

Every major phase and any sub-phase that creates a new governed baseline must follow:

`BUILD → QA → FREEZE → CUSTODY/BACKUP → RECOVERY/REBUILD PROOF → DEPENDENCY CLOSURE → ROLLBACK POINT → NEXT-PHASE AUTHORIZATION`

No agent may skip directly from BUILD/QA to the next phase.

## 3. Phase Closure Gate

Before a phase may be marked COMPLETE/CLOSED, all seven checks below are mandatory.

### PC-1 — Output and QA closure
- Exact outputs are enumerated.
- QA result is recorded.
- Known gaps, exceptions and deferred items are explicit.
- No hidden or informal “fix later” dependency may be required for the next phase.

### PC-2 — Authoritative source-of-truth freeze
- Exact authoritative files/data/rules/code/contracts are identified.
- Stable version/commit/hash or equivalent immutable identity is recorded where available.
- The authoritative location is recorded.
- No required information may exist only in chat history, browser state, a temporary deployment, an individual's memory, or an untracked local file.

### PC-3 — Control-system protection
The control mechanism required to understand and reproduce the phase is preserved, including as applicable:
- architecture rules and decisions;
- schemas/contracts;
- generation/compiler/transformation logic;
- configuration and parameters;
- source/version/dependency registries;
- approval/freeze state;
- QA and verification evidence.

Preserving output bytes without the control mechanism is insufficient where those outputs are derived.

### PC-4 — Working-system protection
The known-good operational state is preserved where applicable, including:
- canonical data / database state;
- application configuration;
- security/auth configuration required for restore;
- deployment identity;
- storage state or backup reference;
- known-good UI/projection baseline;
- external dependencies necessary for restart.

### PC-5 — Recovery / rebuild proof
A backup existing is not sufficient.

For every major milestone, and for any high-risk phase identified by the governing agent, perform an appropriate recovery/rebuild proof from the preserved artifacts. The proof must establish that the important output or working state can be restored/reproduced without relying on the original working session.

For lower-risk sub-phases, a documented deterministic reconstruction path may satisfy this check if a full recovery drill would be disproportionate; the reason must be recorded.

### PC-6 — Dependency and immutability closure
Before the next phase consumes the result:
- exact upstream dependencies are recorded;
- downstream consumers are identified where material;
- the completed baseline is treated as immutable unless a governed change process explicitly supersedes it;
- the next phase must reference the exact closed baseline, not a floating label such as “latest P6.1.”

### PC-7 — Rollback point and next-phase authorization
- A known-good rollback point is recorded.
- The expected effect of the next phase on the closed baseline is stated.
- The next phase is not allowed to mutate the closed baseline unless explicitly authorized through a governed successor/change path.
- A named next-phase entry decision is recorded: `AUTHORIZED`, `BLOCKED`, or `OWNER_DECISION_REQUIRED`.

## 4. Two protection layers are always considered

Each closure assessment must explicitly distinguish:

### A. Control-system protection
Can Atlas still explain, regenerate, verify and govern the phase?

### B. Working-system protection
Can Atlas still restore the functioning application/data/environment to the known-good state?

A phase is not safely closed if only one of these survives.

## 5. Consumption rule

No phase may consume a prior-phase output unless that prior output has:
- stable identity;
- authoritative location;
- recorded lineage/dependencies;
- QA/freeze status;
- recovery/rebuild method;
- rollback point where applicable.

Example: P6.2 may not consume “the P6.1 output” generically. It must consume an exact P6.1 governed baseline with explicit identity and closure evidence.

## 6. Change-after-freeze rule

If a supposedly closed phase must change:
1. do not silently edit the frozen baseline;
2. open a governed successor/change record;
3. record why the prior baseline is insufficient;
4. create a new version/identity;
5. rerun the affected closure checks;
6. update downstream dependency references explicitly.

## 7. Mandatory checkpoint record

Each closed phase must leave a compact closure record containing at minimum:
- phase/stage ID and name;
- closure status/date;
- authoritative outputs and identities;
- source-of-truth locations;
- QA result/evidence;
- control-system backup/custody state;
- working-system backup/custody state;
- recovery/rebuild proof result;
- dependency closure result;
- rollback point;
- next-phase entry decision;
- Owner decision if required.

This record may live in the existing canonical execution queue/control log or another already-authorized governance artifact. Do not create redundant logs merely to satisfy this requirement.

## 8. Failure states

Use these minimum failure states consistently:
- `BLOCKED_OUTPUT_QA_OPEN`
- `BLOCKED_SOURCE_OF_TRUTH_UNFROZEN`
- `BLOCKED_CONTROL_CUSTODY_INCOMPLETE`
- `BLOCKED_WORKING_SYSTEM_BACKUP_INCOMPLETE`
- `BLOCKED_RECOVERY_NOT_PROVEN`
- `BLOCKED_DEPENDENCY_CLOSURE_INCOMPLETE`
- `BLOCKED_ROLLBACK_POINT_MISSING`
- `OWNER_DECISION_REQUIRED`

A blocked closure state prevents automatic phase advancement.

## 9. Scope and proportionality

This standard applies most strictly at major phase/milestone boundaries such as P0→P1, R0.x transitions, P6.1→P6.2 and later production gates.

For small low-risk tasks, the same principles apply but the evidence may be lighter. The governing agent must not use proportionality as a reason to omit stable identity, authoritative location, dependency closure or explicit next-step authorization.

## 10. Governing principle

> Atlas advances only from a recoverable governed checkpoint, never merely from a successful working session.
