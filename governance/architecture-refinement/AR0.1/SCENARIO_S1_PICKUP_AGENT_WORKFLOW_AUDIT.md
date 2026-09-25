# AR0.1 Scenario S1 — Road LTL Pickup Request → Agent / Workflow Handoff

Status: AUDIT EVIDENCE CANDIDATE  
Stage: AR0.1  
Scenario: `S1_ROAD_LTL_PICKUP_AGENT_WORKFLOW`

## 1. Test question
Assume a transformation team wants to automate a Road LTL customer-service pickup request initiated through a client channel such as mailbox/CRM/service-management tooling. If the relevant domain and client facts are resolved, can current Atlas semantics provide enough technology-neutral information for an independent agent/workflow platform to construct a minimum implementation skeleton without rediscovering the pickup business process?

This is an architecture sufficiency test. It does not invent a client mailbox, CRM, SLA, field name or business rule.

## 2. Governed reference evidence
Road LTL `LTL-04 — Request pickup and prove shipment readiness` already carries substantial execution-reference semantics.

### Required information already represented
The current task includes governed requirements for:
- pickup request identifier;
- shipment / consignment reference;
- pickup location;
- requested pickup window;
- dock / shipment readiness;
- handling-unit / physical summary;
- special equipment/service needs;
- carrier pickup policy including cut-off/serviceability/appointment rules.

Several facts are explicitly recognized as client/environment-variable rather than universal domain truth.

### Decisions / controls already represented
LTL-04 includes gates for:
- request completeness;
- freight/dock readiness;
- equipment/service availability.

It also includes a control objective covering request/response correlation, idempotency, change/cancel reason and stale-version rejection.

### Actions / states / outcomes already represented
The task includes actions to schedule/update/reschedule/cancel pickup and publish the response. It defines pre-state, controlled-failure state, recovery reference and outcomes:
- ACCEPTED;
- CONDITIONAL;
- REJECTED;
- CANCELLED.

### Interface semantics already represented
The task identifies producer/authority/consumer system roles, payload objects, acknowledgement expectation, retry behavior and a client-bound or standard-message interface.

### Client binding already represented
LTL-04 has explicit client-binding questions for items including:
- carrier pickup cut-off;
- serviceability/master/network configuration;
- equipment/accessorial policy;
- appointment response SLA;
- carrier status/reason-code crosswalk;
- client request field mapping.

These records carry `requiredWhen`, `why`, validation, source basis, authority/system role and a resolution status. This closely matches the intended Atlas operating model: the baseline tells the team what must be resolved; the client supplies the local value/mapping.

## 3. Minimum handoff semantics assessment

| Requirement | AR0.1 classification | Assessment |
|---|---|---|
| Pickup business purpose/outcome | `FULLY_GOVERNED_EXISTING_CONTRACT` | Present in daughter/OK semantics. |
| Trigger/pre-state | `FULLY_GOVERNED_EXISTING_CONTRACT` | Present for LTL-04. |
| Required business information | `FULLY_GOVERNED_EXISTING_CONTRACT` | Present at task level, subject to deeper object/field contract maturity. |
| Client field/API mappings | `GOVERNED_CLIENT_ENTERPRISE_BINDING_REQUIRED` | Correctly left to client binding. |
| Client serviceability, cut-off, SLA, policy | `GOVERNED_CLIENT_ENTERPRISE_BINDING_REQUIRED` | Correctly represented as binding requirements. |
| Decisions/rules/controls | `FULLY_GOVERNED_EXISTING_CONTRACT` | Present semantically. |
| States/outcomes | `FULLY_GOVERNED_EXISTING_CONTRACT` | Present semantically. |
| Material pass/fail transitions | `FULLY_GOVERNED_EXISTING_CONTRACT` at concept level | Present, but current records do not prove full ordering/composition grammar. |
| Retry/recovery/escalation | `FULLY_GOVERNED_EXISTING_CONTRACT` | Owned by frozen architecture; task references governed exception/recovery paths. |
| Evidence/completion | `FULLY_GOVERNED_EXISTING_CONTRACT` | Present. |
| Runtime agent nodes/prompts/models | `DOWNSTREAM_RUNTIME_SPECIFIC_OUTSIDE_ATLAS` | Correctly belongs to target agent/workflow platform. |
| Runtime queues/subqueues | `DOWNSTREAM_RUNTIME_SPECIFIC_OUTSIDE_ATLAS` | Canonical architecture correctly prohibits these as Atlas truth. |
| Mailbox/Salesforce/ServiceNow actual connectors/credentials | `DOWNSTREAM_RUNTIME_SPECIFIC_OUTSIDE_ATLAS` plus client binding for target system identity | Atlas may bind the system/interface requirement; connector implementation/credential is runtime responsibility. |
| End-to-end customer-service intake scope preceding LTL-04 | `INFERABLE_BUT_UNGOVERNED` | LTL-04 begins from a validated shipment/pickup context; a generic email-intake/classification step is not automatically part of this Road LTL task. Implementation-scope composition must explicitly include the upstream customer-service work if required. |
| Deterministic ordering of all gates/actions/waits | `INFERABLE_BUT_UNGOVERNED` | Current semantic records are rich but canonical machine grammar remains pending. |
| Scope-level READY/NOT_READY certification | `ABSENT_READINESS_BLOCKING` | No first-class aggregate readiness proof has been found. |
| Version-closed implementation handoff package | `INFERABLE_BUT_UNGOVERNED` | Facts are distributed; no generic assembled handoff manifest found. |

## 4. What Atlas could legitimately hand off today at semantic level
With required client bindings resolved and content gaps closed, current semantics could support a technology-neutral skeleton broadly equivalent to:

`Pickup request context established`  
→ validate required information  
→ evaluate readiness/serviceability/equipment conditions  
→ schedule/update/reschedule/cancel as permitted  
→ publish response  
→ record acknowledgement/change history/evidence  
→ branch to controlled exception/escalation/recovery where required.

This is not a generated runtime workflow and should not be represented as one. It is a semantic execution skeleton.

## 5. What Atlas should not be required to specify
The current architecture is correct to leave the following downstream:
- which LLM/model performs interpretation;
- prompt design;
- agent count or role topology;
- n8n/Malkom/ServiceNow queue or node names;
- exact connector library;
- credential storage;
- hosting/deployment topology;
- runtime-specific retry implementation where it does not change business semantics.

## 6. Defects exposed by the scenario

### S1-D01 — Implementation scope composition is not first-class
A user request such as “automate pickup requests arriving by email” is broader than `LTL-04`. It includes channel intake, message interpretation/classification and possibly customer identity resolution before the canonical pickup task begins. Atlas needs a deterministic way to close the selected implementation scope across relevant canonical tasks/capabilities instead of pretending one A5 task equals the whole solution.

Classification: `INFERABLE_BUT_UNGOVERNED`.

### S1-D02 — WorkDefinition/decomposition grammar is not yet executable as a machine contract
The task contains rich states, gates, actions and transitions, but the canonical machine-readable Work Decomposition and WorkDefinition contracts are still pending. Therefore Atlas cannot yet prove deterministic generation/validation of the minimum workflow skeleton.

Classification: `INFERABLE_BUT_UNGOVERNED` as architecture grammar; implementation is pending.

### S1-D03 — Aggregate readiness is not first-class
Task-level readiness and `BLOCKED_UNKNOWN` concepts exist, but no generic artifact was found that closes every mandatory dependency across the selected implementation scope and certifies it READY or NOT_READY.

Classification: `ABSENT_READINESS_BLOCKING`.

### S1-D04 — Implementation handoff is not version-closed
A downstream platform would need a coherent package that identifies exactly which domain/OK/WorkDefinition/client-binding/object/field/interface/temporal versions constitute the approved requirement baseline. The frozen architecture has lineage/versioning principles, but no generic handoff manifest was found.

Classification: `INFERABLE_BUT_UNGOVERNED`.

## 7. Scenario disposition
**PARTIAL PASS — CORE SEMANTICS STRONG; DETERMINISTIC READINESS/HANDOFF NOT YET PROVEN.**

The current architecture contains most of the business semantics needed for the pickup-request example and correctly separates canonical truth from client binding and runtime implementation. It therefore supports the clarified Atlas vision materially better than the earlier architecture challenge assumed.

However, Atlas cannot currently claim that selecting a mature operation plus client bindings will deterministically produce an implementation-ready handoff because scope closure, aggregate readiness certification, assembled handoff packaging and machine-readable control-flow/decomposition grammar remain incomplete or ungoverned.

No broad new “Execution Requirements” layer is justified by S1. The defects are narrower and should be resolved at AR0.2 boundary analysis.
