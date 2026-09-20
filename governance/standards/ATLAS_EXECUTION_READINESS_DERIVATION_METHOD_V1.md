# Atlas Execution-Readiness Derivation Method v1

Status: WORKING GOVERNING METHOD
Date: 2026-09-20
Origin: ATL-35 / LTL-03 authoritative-decomposition research

## Purpose

Define how Atlas converts authoritative domain knowledge and client-specific operating evidence into technology-neutral, execution-ready specifications for downstream tools such as Malkom, RPA, APIs and AI agents.

Atlas does not execute. Atlas owns governed understanding, specification, readiness and projection. Downstream tools execute.

## Governing principle

Do not begin with an RPA flow, Malkom workflow or agent prompt.

First derive a governed execution contract:

Authoritative source -> domain primitive -> governed relationship -> lifecycle/state transition -> recursive Work Decomposition -> WorkDefinition -> execution queues -> authority/evidence/recovery controls -> downstream tool projection.

LLMs may research, extract, normalize, map and detect gaps. LLM-generated process decomposition is not authoritative evidence.

## P6.1-style recursive semantic contract

For each task/process/subprocess/work unit, determine:

1. Why does this work exist? — trigger / purpose.
2. What event activates it? — lifecycle event.
3. What must be known? — information objects, fields, references and dependencies.
4. What must be decided? — decision.
5. What governs the decision? — business rule / regulatory rule / client rule.
6. What must happen? — action.
7. What must be checked? — validation / control.
8. What proves it happened? — evidence / audit record.
9. What state changes? — before-state -> after-state / outcome.
10. What can prevent progression? — exception, knowledge gap, unresolved dependency or client binding.

Recursive decomposition continues until the work unit is sufficiently atomic for deterministic execution specification, or is explicitly blocked.

## Execution-readiness dimensions

Every candidate WorkDefinition should be tested across the following dimensions:

### 1. Lifecycle and state model
Identify valid states, transitions, triggers, prerequisites, terminal states and permitted create/update/cancel/delete/reopen behavior.

### 2. Identity and relationship model
Model all relevant identifiers and their relationships, including cardinality, ownership, uniqueness, cross-reference, versioning and reconciliation. Do not assume one carrier operating pattern is universal.

### 3. Information contract per transition
For every transition, classify required information as mandatory, optional, conditional, derived, prohibited or client-specific.

### 4. Decision and rule catalogue
Represent branches as explicit machine-readable rules: condition -> decision -> action/state transition.

### 5. Validation and control model
Define completeness, consistency, uniqueness, duplicate, reference, version, regulatory and business controls.

### 6. Exception taxonomy
Identify predictable failure modes and the governed response: reject, retry, enrich, request information, route, escalate, warn or stop.

### 7. Queue derivation
Execution queues must be computed from source-backed states, unresolved prerequisites, rules, exceptions or evidence requirements. Queues must not be manually invented without a governed basis.

### 8. Authority and action-rights model
Determine who or what may perform, approve, amend, override, retry or close each action: customer, carrier, operations, Malkom, RPA, API, AI agent, supervisor, etc.

### 9. Evidence and audit contract
Define the evidence required for every transition: source record/document, API response, timestamp, previous/new value, actor, rule fired, exception code and provenance.

### 10. Recovery and idempotency model
Define duplicate-safe execution, correlation identifiers, checkpointing, version checks, retry behavior and deterministic recovery after partial failure.

### 11. Source precedence
For conflicting values, define field-level or object-level authority and precedence among documents, client systems, carrier systems, regulatory sources and derived values.

### 12. Temporal logic
Define when information/rules are valid, which values may change at each lifecycle stage, amendment windows, locks and effective-date logic.

### 13. Confidence and knowledge-gap handling
For probabilistic extraction or inference, define thresholds and permitted actions. Low confidence or unresolved business knowledge must create an explicit gap/queue rather than silently become authoritative truth.

### 14. Downstream tool projection
Compile the same canonical execution contract into tool-specific specifications:
- RPA: UI steps, selectors/fields, deterministic branches, retries.
- Malkom/IDP: document schemas, extraction/validation, field rules, queues, exceptions.
- AI agent: tools, context, permissions, reasoning boundaries, confidence/escalation thresholds.
- API/integration: endpoint, payload, response/status contract, idempotency, correlation and recovery.

## Queue derivation rule

A queue is a governed operational state requiring work, not a manually named inbox.

Candidate queue classes may include creation, validation, identity reconciliation, amendment/change, cancellation/deletion, regulatory validation, exception, manual review, evidence closure and retry/recovery — but each queue must trace to an authoritative or client-governed lifecycle state, unmet precondition, rule, exception or evidence requirement.

## Source hierarchy

1. Applicable law/regulation and official regulatory interpretation.
2. Industry standards and issuer-maintained schemas/code sets.
3. Cross-industry semantic/reference models.
4. Carrier/customer contractual rules, tariffs and operating standards.
5. Client SOPs, system behavior, process evidence and SME validation.
6. Atlas deterministic synthesis derived from the above with explicit provenance.
7. LLM inference only as non-authoritative research assistance or gap hypothesis.

## Industry canonical vs client operating pattern

Atlas must separate:
- industry-authoritative canonical behavior; and
- carrier/client/BPO-specific operating models.

Example: Booking -> PRO assignment -> BOL creation is a valid operating pattern observed in carriers such as Estes, SEFL and ODFL, but must not be treated as the only universal sequence unless authoritative evidence supports that universality.

Likewise, identity assignment, pickup/booking orchestration and transport-document lifecycle should remain distinct canonical objects/processes until governed evidence proves a mandatory dependency.

## LTL-03 proof case

LTL-03: Create and validate shipment, consignment and transport-document identity.

Use LTL-03 as the first full proof:
- derive the authoritative document/identity landscape;
- decompose BOL and other in-scope transport-document work;
- derive fields/information objects independently from authoritative sources;
- only after independent derivation, crosswalk the authoritative BOL information universe to the known SEFL 76-field implementation;
- derive lifecycle states, rules, exceptions and execution queue candidates;
- identify client-specific extensions and knowledge gaps;
- test whether the resulting model can compile to Malkom/RPA/API/agent specifications without LLM-authored canonical process logic.

## Recovery requirement

For each completed research work package, preserve a recovery-ready custody package containing:
- authoritative source inventory and exact source locations;
- version/effective-date information;
- extracted domain primitives and information objects;
- field/code/value sets where available;
- process/lifecycle/state evidence;
- decomposition rules;
- decision/control/exception logic;
- queue derivation logic;
- client-pattern overlays;
- unresolved gaps;
- provenance/crosswalks;
- resulting WorkDefinition/execution-readiness artifacts.

The objective is that Atlas can be reconstructed from governed evidence and deterministic rules without relying on conversational memory or regenerating historical counts.
