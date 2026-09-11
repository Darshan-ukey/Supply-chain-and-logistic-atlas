# AR0.1 Scenario S3 — Digital Twin / BPM Implementation Handoff

Status: AUDIT EVIDENCE CANDIDATE  
Stage: AR0.1  
Scenario: `S3_DIGITAL_TWIN_BPM_HANDOFF`

## 1. Test question
Can the current Atlas architecture provide a reusable, technology-neutral operating specification that materially accelerates creation of a process/BPM or customer-service digital twin, while keeping tool-specific model constructs downstream?

This audit distinguishes three meanings that must not be conflated:
1. **structural process model / BPM representation** — what work, states, decisions, events, waits, exceptions and outcomes exist;
2. **live operational/process twin** — a running representation synchronized to real work instances/events;
3. **simulation / what-if twin** — a model that additionally requires workload, service-time, resource/capacity and probabilistic behavior.

## 2. Structural BPM/process model — strong current fit
The frozen Execution Fabric already defines a Canonical Execution Flow Generator generated from Work Decomposition + WorkDefinition. It is intended to visualize:
- entry/start;
- executable work units;
- states/events;
- decisions/gateways;
- rules/controls;
- actions;
- outcomes;
- waits/timers;
- loops/retries;
- exceptions/escalations/recovery;
- HITL boundaries;
- evidence and state completion.

It also explicitly separates canonical flow from runtime projection flow and requires BPM/flow views to be generated from governed data rather than independently authored.

This is strongly aligned to a structural digital-twin/BPM handoff.

## 3. Requirement classification — structural model

| Requirement | AR0.1 classification | Assessment |
|---|---|---|
| Process/work identity and hierarchy | `FULLY_GOVERNED_EXISTING_CONTRACT` | Daughter/domain + decomposition own it. |
| States/events | `FULLY_GOVERNED_EXISTING_CONTRACT` | Canonical ownership explicit. |
| Decisions/gateways | `FULLY_GOVERNED_EXISTING_CONTRACT` | Semantic ownership explicit; exact machine grammar pending. |
| Rules/controls | `FULLY_GOVERNED_EXISTING_CONTRACT` | Operational Knowledge/WorkDefinition. |
| Actions/system interactions | `FULLY_GOVERNED_EXISTING_CONTRACT` | Present. |
| Actors/HITL/authority | `FULLY_GOVERNED_EXISTING_CONTRACT` + client binding where local | Correct split. |
| Waits/timers/SLAs | `FULLY_GOVERNED_EXISTING_CONTRACT` + client binding where local | Temporal contract exists. |
| Exceptions/retries/recovery | `FULLY_GOVERNED_EXISTING_CONTRACT` | Explicit architecture ownership. |
| Evidence/outcomes | `FULLY_GOVERNED_EXISTING_CONTRACT` | Present. |
| Client system/field/team/SLA mapping | `GOVERNED_CLIENT_ENTERPRISE_BINDING_REQUIRED` | Correctly downstream of reference semantics. |
| BPMN vendor element IDs/layout/style | `DOWNSTREAM_RUNTIME_SPECIFIC_OUTSIDE_ATLAS` | Representation/runtime concern. |

### Structural disposition
**STRONG CONCEPTUAL PASS, SUBJECT TO MACHINE-GRAMMAR COMPLETION.**

For a mature operation, Atlas should be able to provide most of the semantic source required to generate a BPM/process model without blank-sheet process discovery. The current gap is primarily deterministic Work Decomposition/WorkDefinition grammar and scope assembly, not absence of BPM-relevant business semantics.

## 4. Live operational/process twin — partial current fit
A live twin requires more than a reference process. It needs a generic way to correlate real work instances and events against the canonical model, including:
- work/process instance identity;
- current state;
- transition/event history;
- timestamps and clocks;
- correlation to canonical work unit and enterprise binding;
- evidence/state provenance;
- deviation classification;
- runtime source/system mapping.

The frozen architecture does envision runtime evidence/outcome reconciliation and comparison of canonical → runtime projection → actual. This is directionally correct.

However, the current `execution-instance-contract-v1` is transport-leg-oriented: it requires transport legs with mode/service, origin and destination. It is not a generic process/work-instance contract suitable for an arbitrary customer-service case.

### Live twin requirement classification

| Requirement | AR0.1 classification | Assessment |
|---|---|---|
| Canonical-to-runtime evidence reconciliation | `FULLY_GOVERNED_EXISTING_CONTRACT` at architecture principle level | Directionally present. |
| Generic work/process instance identity and state | `INFERABLE_BUT_UNGOVERNED` | No generic contract found. |
| Generic event/transition history | `INFERABLE_BUT_UNGOVERNED` | Architecture implies it; no reusable machine contract found. |
| Correlation between live event and canonical work/object | `INFERABLE_BUT_UNGOVERNED` | Partial/prose semantics exist, not generic contract. |
| Runtime telemetry connector | `DOWNSTREAM_RUNTIME_SPECIFIC_OUTSIDE_ATLAS` | Adapter/runtime concern. |

### Live twin disposition
**PARTIAL.** Atlas has the canonical model and evidence-reconciliation concept, but lacks a generic work-instance/event contract needed to make “live digital twin” a reusable platform capability across non-transport operations.

## 5. Simulation / what-if twin — materially incomplete
A simulation-grade twin may need, depending on use case:
- arrival volume and arrival distribution;
- seasonality/peak profile;
- service/processing-time distributions;
- queue/capacity constraints;
- staffing/resource calendars and skills;
- branching probabilities;
- rework/retry frequency;
- abandonment/time-out behavior;
- resource contention;
- cost/service measures;
- scenario assumptions.

Some measurement and temporal semantics exist, but no first-class owner/contract has been found for workload/arrival/concurrency/resource-capacity distributions or simulation parameters.

These are not necessarily mandatory for **execution readiness of the business operation**. They become mandatory only when the downstream target is a simulation/optimization twin.

Classification: `INFERABLE_BUT_UNGOVERNED` as optional implementation-context semantics pending AR0.2 boundary decision.

### Simulation disposition
**NOT CURRENTLY SUFFICIENT AS A GENERAL SIMULATION-TWIN INPUT MODEL.**

That does not invalidate the Atlas North Star. It means a simulation twin has additional downstream input requirements beyond the core operational execution specification.

## 6. Defects exposed by the scenario

### S3-D01 — “Digital twin” must be capability-scoped
Atlas should not claim generic digital-twin readiness without distinguishing structural model, live operational twin and simulation/what-if twin. Their input requirements are materially different.

### S3-D02 — Generic execution-instance/event semantics are missing
The current execution-instance schema is transportation-leg-specific and therefore cannot serve as a reusable live-work-instance model across customer service or other enterprise processes.

Classification: `INFERABLE_BUT_UNGOVERNED`.

### S3-D03 — Simulation context has no clear owner
Workload, arrival, concurrency, service-time distribution and resource-capacity semantics are not first-class current contracts. AR0.2 must decide whether these belong in an optional implementation-context/simulation profile rather than canonical WorkDefinition.

Classification: `INFERABLE_BUT_UNGOVERNED`.

### S3-D04 — Canonical control-flow grammar remains pending
A BPM diagram can be visually inferred from current semantics, but deterministic generation of non-trivial gateways/joins/correlation must be proven by the future machine contract.

Classification: `INFERABLE_BUT_UNGOVERNED`.

## 7. Scenario disposition
**PASS FOR STRUCTURAL PROCESS/BPM READINESS; PARTIAL FOR LIVE TWIN; NOT SUFFICIENT FOR GENERAL SIMULATION TWIN.**

The scenario supports the Atlas execution-readiness North Star. It does not justify putting BPMN/tool constructs into canonical truth. It does show that optional downstream implementation profiles may require additional context contracts, and that a generic work-instance/event model is a plausible architecture refinement if live digital-twin support is an intended platform capability.
