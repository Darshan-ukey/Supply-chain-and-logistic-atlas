# Controlled Phase Execution & Recovery Gate V1

Status: OWNER-AUTHORIZED GLOBAL EXECUTION GOVERNANCE  
Effective: 15 September 2026  
Refined: 16 September 2026  
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

Where a phase creates or consumes generated/derived governed assets, it must also comply with `governance/standards/CANONICAL_GENERATION_AND_FREEZE_ASSET_STANDARD_V1.md`.

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
- Generator Contract and Generation Registry entry for governed generated assets;
- prompts/templates/model identifiers and post-processing/validator versions when generative assistance is used;
- configuration and parameters;
- source/version/dependency registries;
- approval/freeze state;
- QA and verification evidence.

Preserving output bytes without the control mechanism is insufficient where those outputs are derived.

For generated/derived governed assets, PC-3 is not satisfied unless the applicable F0–F7 freeze-asset requirements in the Canonical Generation & Freeze-Asset Standard are closed or explicitly declared not applicable with rationale.

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

For every major milestone and every **HIGH-RISK** phase/sub-phase, perform an actual recovery or deterministic rebuild proof from the preserved artifacts. The proof must establish that the important output or working state can be restored/reproduced without relying on the original working session.

For generated assets, the proof must use the recorded frozen inputs, Generator Contract/implementation version, parameters, validation path and Generation Registry identity. If the generator is non-deterministic/generative, the proof may restore the exact approved canonical output rather than claim impossible byte-identical future generation; any new generation is a new candidate/version.

A phase/sub-phase is **HIGH-RISK by default** if any one of the following is true:
1. it creates, mutates, migrates or deletes canonical knowledge, governed database state, protected/client data, authentication/security state, production configuration or production deployment state;
2. it creates a new frozen/canonical baseline that a later phase will consume;
3. it introduces or changes generation/compiler/transformation logic, schemas/contracts, version-resolution logic, lineage/dependency logic or authorization boundaries;
4. failure or loss would require manual reconstruction from chat history, temporary files, browser state, memory or unavailable external state;
5. rollback is not trivially reversible from an already-proven immutable baseline;
6. it changes more than one governed layer/system boundary or creates a cross-system dependency;
7. it is a production/release gate, data migration, security change, destructive operation, bulk materialization, domain-wide regeneration or major phase transition.

A phase may be treated as **LOWER-RISK** only when all of the following are true and recorded:
- no canonical/protected/production state is mutated;
- no new downstream-consumed baseline is created;
- the change is fully reversible from an existing proven baseline;
- all inputs and generation logic already have stable governed identity;
- deterministic reconstruction can be demonstrated without the original session.

For such lower-risk work, a documented deterministic reconstruction proof may satisfy PC-5 instead of a full environment recovery drill. The record must state why the work qualifies as lower-risk and identify the exact reconstruction path.

**No executing agent may self-downgrade a phase from HIGH-RISK merely to avoid a recovery drill.** If classification is ambiguous, treat it as HIGH-RISK or escalate to `OWNER_DECISION_REQUIRED`.

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

If the prior output is generated/derived, the consuming phase must also be able to identify its Generator Contract/implementation and Generation Registry record.

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
- risk classification (`HIGH-RISK` or `LOWER-RISK`) and rationale;
- Generator Contract/Generation Registry identities for generated outputs, where applicable;
- freeze-asset coverage or applicable F0–F7 references for generated/high-risk baselines;
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
- `BLOCKED_GENERATOR_CONTRACT_INCOMPLETE`
- `BLOCKED_GENERATION_REGISTRY_INCOMPLETE`
- `BLOCKED_FREEZE_ASSET_SET_INCOMPLETE`
- `BLOCKED_WORKING_SYSTEM_BACKUP_INCOMPLETE`
- `BLOCKED_RECOVERY_NOT_PROVEN`
- `BLOCKED_RISK_CLASSIFICATION_UNRESOLVED`
- `BLOCKED_DEPENDENCY_CLOSURE_INCOMPLETE`
- `BLOCKED_ROLLBACK_POINT_MISSING`
- `OWNER_DECISION_REQUIRED`

A blocked closure state prevents automatic phase advancement.

## 9. Scope and proportionality

This standard applies most strictly at major phase/milestone boundaries such as P0→P1, R0.x transitions, P6.1→P6.2 and later production gates.

For small lower-risk tasks, the same principles apply but the evidence may be lighter only when the PC-5 lower-risk criteria are explicitly satisfied. Proportionality may never be used to omit stable identity, authoritative location, dependency closure, rollback logic where applicable, or explicit next-step authorization.

## 10. Deferred-item discipline

Any phase-closure exception or deferred control must point to a **real, trackable future governance gate/stage** with an owner or decision authority and a defined closure condition. “Later,” “future phase,” or an unnamed backlog item is not a valid deferral target.

## 11. Governing principle

> Atlas advances only from a recoverable governed checkpoint, never merely from a successful working session.
