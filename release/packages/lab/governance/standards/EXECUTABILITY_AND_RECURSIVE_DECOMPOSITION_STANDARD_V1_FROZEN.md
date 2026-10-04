# Executability & Recursive Decomposition Standard V1 — FROZEN

Status: **FROZEN GOVERNING STANDARD**  
Effective: 2026-09-02

## Governing rule
**A5 is not assumed executable.** Work is recursively decomposed until each work unit is unambiguous enough for the intended executor class. Decomposition stops on an executability criterion, not on a fixed hierarchy depth.

## Executor classes
Human, deterministic rule engine, workflow, RPA, API/system, document AI, AI agent, hybrid/HITL, or future runtime.

## Executability criterion
An executable unit must define or explicitly bind:
- entry trigger and required pre-state;
- required information/business objects and validation;
- applicability/context;
- decision logic and authority boundary;
- rules/controls;
- permitted action;
- branch/state transition for each material result;
- timing/wait semantics where applicable;
- exception/retry/escalation/recovery behavior;
- evidence/output and completion criteria;
- system/actor authority or an explicit binding requirement.

Every unresolved value must be classified as known source truth, derived, transaction value, master data, client binding/configuration, contract/policy parameter, system generated, or UNKNOWN. Hidden operational knowledge is not permitted.

## Status vocabulary
- COMPOSITE_REQUIRES_DECOMPOSITION
- EXECUTABLE_HUMAN
- EXECUTABLE_RULE
- EXECUTABLE_SYSTEM
- EXECUTABLE_API
- EXECUTABLE_RPA
- EXECUTABLE_DOCUMENT_AI
- EXECUTABLE_AGENT
- EXECUTABLE_HYBRID
- BLOCKED_UNKNOWN

## Validation
A unit cannot be marked executable if a required decision, state transition, evidence requirement, exception path, or binding dependency is implicit.
