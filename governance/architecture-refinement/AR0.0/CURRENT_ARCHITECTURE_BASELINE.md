# AR0.0 — Current Architecture Baseline

Status: BASELINE_RECORDED_FOR_OWNER_REVIEW  
Date: 11 September 2026  
Executor: ChatGPT  
Frozen V1 architecture mutated: NO

## 1. Baseline chain
The governed V1 execution architecture currently intends:

`Authoritative Sources -> Source Foundation -> Universe -> Verified Daughter Modules -> Operational Knowledge -> Work Decomposition V1.1 -> Canonical WorkDefinition V1 -> Client Binding -> Atlas Warehouse / Execution Fabric -> Runtime Adapter -> Runtime Projection -> Execution -> Evidence / Feedback`

The architecture is deliberately executor-neutral through canonical work. Runtime-specific lowering occurs only after client binding and runtime selection.

## 2. Frozen conceptual standards that exist
- `governance/ATLAS_EXECUTION_FABRIC_ARCHITECTURE_V1_FROZEN.md`
- `governance/standards/KNOWLEDGE_TO_EXECUTION_ARCHITECTURE_V1_FROZEN.md`
- `governance/standards/EXECUTABILITY_AND_RECURSIVE_DECOMPOSITION_STANDARD_V1_FROZEN.md`
- `governance/standards/CLIENT_BINDING_RESOLUTION_PRINCIPLE_V1_FROZEN.md`

These establish the conceptual architecture, recursive-decomposition principle, executor-neutral boundary, executor-specific stopping criteria, client-binding boundary and runtime-adapter responsibilities.

## 3. Canonical contracts that do NOT yet exist as implemented machine-readable standards
- `governance/standards/CANONICAL_WORK_DECOMPOSITION_CONTRACT_V1_PENDING.md` — `IMPLEMENTATION_PENDING`.
- `governance/standards/CANONICAL_WORKDEFINITION_CONTRACT_VNEXT_PENDING.md` — `IMPLEMENTATION_PENDING`.

Therefore the architecture challenge is occurring before the canonical decomposition/WorkDefinition contract is irreversibly implemented. Historical P6.1 output is not a substitute for these missing canonical contracts.

## 4. What the current architecture already owns
### Operational/domain semantics
Governed Daughter Module + Operational Knowledge own process/task meaning, conditions, information requirements, rules/controls, authority basis, exceptions, evidence and provenance.

### Work Decomposition / executability
The frozen executability standard recognizes executor classes:
- HUMAN
- DETERMINISTIC_RULES
- WORKFLOW
- RPA
- API_SYSTEM
- DOCUMENT_AI
- LLM_AGENT
- HYBRID_HITL

Recursive decomposition stops only when the leaf is unambiguous enough for an intended executor class. This is already stronger than a generic process hierarchy.

### Client Binding
Client Binding already owns environment-specific facts such as:
- systems and interfaces;
- fields and mappings;
- master/network data;
- SLA, cut-off and threshold values;
- client policy variants;
- organization, decision authority and escalation routing;
- communication binding;
- evidence/audit retention;
- security, credentials and environment.

Road LTL has 128 explicit binding requirements in `data/client-binding-requirements/road-ltl-v1.4-bindings.json`.

### Interface/exchange semantics
`data/contracts/system-exchange-contract-v1.schema.json` supports interface types API, EDI, EVENT, FILE, DOCUMENT, UI, MESSAGE and OTHER, with producer/consumer/payload/evidence relationships.

### Time and performance semantics
- `data/contracts/temporal-constraint-contract-v1.schema.json` covers CUT_OFF, DEADLINE, VALIDITY, FREE_TIME, DWELL, CONNECTION_WINDOW, RESPONSE_CLOCK, SLA and SCHEDULE.
- `data/contracts/measurement-contract-v1.schema.json` covers COUNT, RATE, DURATION, COST, REVENUE, QUALITY, SERVICE, RISK, SUSTAINABILITY and OTHER measures.

### Runtime adapters
The frozen execution-fabric architecture requires adapters to declare supported capabilities/constraints, assess a WorkDefinition, identify required client bindings, translate supported semantics, report unsupported capabilities/loss risks, produce a deployment-ready projection and verify it. The adapter must not invent business semantics.

## 5. Baseline gap hypothesis — not yet an approved architecture change
The documented client-binding flow assumes a target runtime adapter is selected before projection. The current governed artifacts do not yet show a first-class mechanism that:
1. derives execution-design requirements from canonical work + client binding;
2. generates more than one feasible executor/runtime pattern;
3. composes hybrid patterns across multiple executor/runtime capabilities;
4. evaluates trade-offs using workload, SLA, cost/value, risk, ambiguity, human capacity, technical constraints and non-functional requirements;
5. records why one candidate was selected or rejected; and
6. passes the selected design to one or more runtime adapters.

This is the principal AR0.0 challenge. It must be tested in AR0.1 before any new layer is approved.

## 6. Separate potential grammar gap inside canonical work
The conceptual V1 standards cover states, events, decisions, waits, retries, exceptions and recovery, but the pending machine contract needs explicit validation for production control-flow semantics such as:
- parallel branches and joins;
- correlation and multi-instance work;
- ordering constraints;
- idempotency;
- compensation / transaction boundaries;
- durable state ownership/persistence;
- timeout ownership and concurrency semantics.

AR0.1 must determine which belong in canonical WorkDefinition versus downstream execution design/runtime projection.

## 7. Baseline conclusion
V1 is not a weak process model. It already contains substantial executability and binding architecture. The architecture question is therefore not whether Atlas needs to become executable; it is whether Atlas needs a governed **design-selection bridge** between bound canonical work and runtime projection, and whether the pending WorkDefinition contract needs stronger control-flow/execution-characteristic semantics.

No answer is frozen at AR0.0.
