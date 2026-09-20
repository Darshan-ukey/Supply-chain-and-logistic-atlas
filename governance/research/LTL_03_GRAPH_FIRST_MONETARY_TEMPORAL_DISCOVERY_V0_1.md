# LTL-03 Graph-First Discovery — Monetary & Temporal Semantics v0.1

Date: 2026-09-20
Workstream: ATL-35
Status: RESEARCH CANDIDATE — GRAPH-FIRST INTAKE

## Purpose

Record new authoritative discoveries only after mapping them through the governed execution-logic graph.

## Discovery A — Monetary amount and service-charge structure

### Evidence
UN/CEFACT D23B:
- consignment applicable service charge occurs 0..n;
- service charge may include payment arrangement code, category code, applied amount, paying-party role;
- monetary Amount has mandatory content and optional currency identifier;
- service charges also occur at consignment-item level 0..n.

### Domain facts
DF-MONETARY-AMOUNT-CURRENCY:
Monetary amount content is mandatory within the amount structure and currency is an optional identifier.

DF-SERVICE-CHARGE-REPEATS:
Service charges are repeating semantic child objects at consignment and consignment-item levels.

DF-SERVICE-CHARGE-ROLE:
A service charge can carry controlled category/payment semantics and a paying-party role.

### Primitive mapping
- MonetaryAmount
- Party
- Relationship
- Controlled Vocabulary
- Collection/Cardinality
- Identifier

### Rule-family composition
- RF17 Monetary Amount / Charge Semantics
- RF5 Controlled-Value Validation
- RF2 Relationship Integrity
- RF4 Requiredness/Cardinality
- RF9 Source Authority
- RF11 Client Specialization

### Generated instances
- validate service-charge amount and optional currency;
- instantiate repeating service-charge collection;
- bind service charge to consignment or consignment item;
- validate charge category/payment arrangement;
- resolve paying-party role;
- preserve financial source authority.

### Normalization result
New family required: 0.
RF17 is strengthened by property-level evidence.

## Discovery B — Temporal / document-version semantics

### Evidence
UN/CEFACT D23B document semantics expose:
- issue date/time;
- first-version issue date/time;
- revision date/time;
- version identifier;
- revision identifier;
- previous-revision identifier;
- cancellation date/time in applicable document structures.

### Domain facts
DF-DOCUMENT-TEMPORAL-ROLES:
Issue, first-version, revision and cancellation times are materially different temporal roles.

DF-DOCUMENT-VERSION-LINEAGE:
Document version/revision identifiers and previous-revision identifiers create explicit lineage, not merely independent timestamps.

DF-DOCUMENT-TEMPORAL-ORDER:
Version lineage can impose ordering/dependency across document states.

### Primitive mapping
- Document
- TemporalValue
- Identifier
- Relationship
- State
- Event

### Existing-family test
RF3 Lifecycle & State Transition covers lifecycle mutation.
RF1 covers version/revision identifiers.
RF2 covers lineage relationship.
RF9 covers source/version authority.

However, repeated cross-task semantics for:
- temporal role;
- time normalization;
- ordering;
- validity across revisions;
- first-version vs current-version lineage

are materially distinct from generic lifecycle transition alone.

### Candidate new reusable family — RF18 Temporal & Version Semantics

Candidate responsibilities:
- classify temporal role;
- validate temporal representation;
- normalize timezone/format where governed;
- preserve first-version/current/revision/cancellation distinctions;
- enforce evidence-backed temporal ordering;
- relate version/revision/previous-revision identifiers;
- detect impossible/reversed lineage;
- preserve temporal source authority.

RF18 composes with:
- RF1 Identity & Reference Resolution;
- RF2 Relationship Integrity;
- RF3 Lifecycle & State Transition;
- RF9 Source Authority & Precedence;
- RF11 Client Specialization.

### Scope
The generic document-version semantics are broader than LTL-03 core until direct transport-document evidence establishes exact applicability.

They enter the graph as BROADER_BOL_UNIVERSE / reusable-domain semantics and must not be forced into LTL-03 core merely because a BOL is a document.

### Normalization result
Candidate new family introduced: RF18.
Reason: materially distinct version-lineage and temporal-order semantics now supported by evidence.

## Graph-first conclusion

No discovery is accepted as standalone prose.

Each new fact has:
Evidence -> Domain Fact -> Primitive -> Family composition -> Generated Instance -> typed dependencies -> scope.

RF17 remains evidence-strengthened.
RF18 is a new evidence-driven candidate family, demonstrating governed catalogue evolution without changing the normalization mechanism.
