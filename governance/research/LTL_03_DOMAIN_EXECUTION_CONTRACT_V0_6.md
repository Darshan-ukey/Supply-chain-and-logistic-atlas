# LTL-03 Domain Execution Contract v0.6

Date: 2026-09-20
Workstream: ATL-39 / ATL-35
Status: GRAPH-FIRST RECONCILED CANDIDATE — NOT FROZEN

## Purpose

Reconcile LTL-03 execution-readiness logic to the governed execution-logic graph so every downstream-relevant rule can be traversed from authoritative evidence to runtime projection and back.

Canonical chain:

Authoritative Evidence
-> Domain Fact
-> Semantic Primitive
-> Reusable Rule Family
-> Generated Rule Instance
-> Client Binding
-> Tool Projection
-> External Executor

P6.1 remains the recursive work-decomposition grammar operating over this governed knowledge.

## 1. Governing correctness order

### Structural correctness
Determine:
- object presence;
- cardinality;
- hierarchy;
- lifecycle target/state;
- conditional activation;
- parent/child integrity.

### Semantic correctness
Determine:
- semantic owner;
- party/location/reference role;
- object relationship;
- lifecycle meaning;
- source-authority meaning.

### Value correctness
Only after structure and semantics are resolved:
- identifier validity;
- controlled vocabulary;
- master match;
- measure + unit;
- monetary amount + currency;
- format;
- sequence/representation.

Automatic correction is prohibited until structural and semantic resolution are sufficiently deterministic.

## 2. Current semantic primitive catalogue

Current candidates:
- Identifier
- Reference
- Document
- Party
- Location
- Measure
- Package / Handling Unit
- Commodity / Consignment Item
- Relationship
- State
- Event
- Controlled Vocabulary
- Master Reference
- Collection / Cardinality
- Instruction / Note
- Evidence / Provenance
- MonetaryAmount
- Indicator
- TemporalValue

The catalogue is evolvable.

## 3. Current reusable rule-family catalogue

RF1 Identity & Reference Resolution
RF2 Relationship Integrity
RF3 Lifecycle & State Transition
RF4 Requiredness & Cardinality
RF5 Controlled-Value Validation
RF6 Master/Reference Reconciliation
RF7 Conditional Activation
RF8 Error & Exception Semantics
RF9 Source Authority & Precedence
RF10 Representation Constraint
RF11 Client Specialization
RF12 Aggregate Reconciliation
RF13 Measure Semantics
RF14 Hierarchy
RF15 Candidate Parsing & Semantic Assignment
RF16 Instruction / Note Ownership
RF17 Monetary Amount / Charge Semantics

The family catalogue is not frozen. The normalization mechanism is governed.

## 4. Cross-family execution rules

### Identity before lifecycle mutation
RF1 PRECEDES RF3 where a lifecycle action targets an identified document/object.

Example:
resolve PRO -> bind PRO/BOL -> update/delete.

### Role/relationship before master canonicalization
RF2 PRECEDES RF6.

A master match without resolved semantic role is not sufficient contextualization.

### Conditional activation before conditional validation
RF7 ACTIVATES RF4/RF5/RF10/RF13 as applicable.

Example:
hazmat applicability activates required fields, controlled values, measure validation and sequence constraints.

### Semantic ownership before physical measure validation
RF2 may PRECEDE RF13.
RF14 may CONSTRAIN RF13 when hierarchy determines the owner/context.

### Source authority constrains canonicalization
RF9 CONSTRAINS RF6 and any automatic correction/enrichment decision.

### Client binding specializes but does not rewrite canonical truth
RF11 OVERRIDES_WITHIN_SCOPE RF4 or other behaviors only within declared client/carrier scope.

### Monetary semantics compose with existing families
RF17 COMPOSES_WITH:
- RF5 for charge category/payer role vocabulary;
- RF2 for payer/payee relationships;
- RF9 for monetary source authority;
- RF11 for client/tariff/billing specialization.

## 5. Core LTL-03 execution objects

### Consignment / Shipment
Includes identity, parties, locations, items/packages, measures, references and relevant conditional regulatory information.

### Transport Document / BOL
Own lifecycle:
- create;
- update;
- delete/cancel.

Must retain version, target identity and transition evidence.

### Reference / Identifier
Must preserve:
- value;
- reference type/role;
- assigning authority;
- scheme agency where applicable;
- uniqueness scope;
- semantic owner;
- lifecycle stage;
- provenance.

### Party / Location
Role resolution precedes identity/master resolution.

### Item / Commodity
Repeating child semantics; source text may be parsed but not destroyed.

### Package / Handling Unit
Repeating structure with hierarchy and package-level measures.

### Associated Document
Repeating child object with its own identity, type, issue time and remarks.

### MonetaryAmount
Broader BOL/domain-universe primitive for invoice/COD/service-charge semantics.
Not automatically part of LTL-03 core execution unless task scope requires it.

### Indicator
Reusable state/permission primitive such as transshipment permission.

### TemporalValue
Reusable date/time semantic. No dedicated temporal family yet.

## 6. Source authority and coexistence

Source precedence is field/semantic-attribute level.

Different values may:
- conflict;
- represent different lifecycle versions;
- represent different semantic attributes;
- represent client specialization;
- corroborate one another.

Examples:
- declared weight, verified/reweigh weight and billing weight may COEXIST_AS_DISTINCT_SEMANTIC.
- shipper address, pickup location and consignee receipt location may share a physical address while remaining different roles.
- industry optional + client mandatory is OVERRIDES_WITHIN_SCOPE, not canonical contradiction.

Original extracted/source value is immutable evidence even after canonicalization.

## 7. Generated-rule instance contract

Every generated instance must expose:

- instanceId
- taskId
- scope
- lifecycleStage
- semanticOwner
- sourceAuthorityClass
- evidenceIds[]
- domainFactIds[] when available
- primitiveIds[]
- familyIds[]
- typedEdges[]
- clientBindingIds[]
- dispositionPolicy
- exception/route behavior
- unresolvedEvidenceGaps[]

A flat list such as RF1+RF3 is insufficient without typed relationship semantics.

## 8. Evidence/provenance contract

Evidence nodes use stable IDs.

A single evidence node may support many facts/families/instances.

Evidence must not be cloned per family.

Bidirectional retrieval is mandatory:
- evidence -> all dependent facts/primitives/families/instances;
- generated instance -> all supporting evidence/facts/primitives/families.

## 9. Contextualization pipeline

For each extracted value/block:

1. preserve source;
2. normalize non-destructively;
3. generate semantic candidates;
4. apply structure/cardinality;
5. establish relationships;
6. resolve role;
7. resolve identity/master/reference;
8. validate code/value/measure/amount;
9. apply source authority;
10. apply lifecycle/state;
11. activate conditional rules;
12. reconcile aggregates/hierarchy;
13. apply client binding;
14. assess ambiguity/confidence;
15. disposition:
   ACCEPT / CORRECT / ENRICH / WARN / REJECT / ESCALATE;
16. preserve graph provenance and audit evidence.

## 10. Safe correction requirements

Automatic correction requires:
- resolved semantic owner/role;
- satisfied relationship/cardinality;
- authoritative/master support;
- no equally valid competing candidate;
- preserved original source;
- no client/regulatory prohibition;
- typed provenance explaining why correction is allowed.

Otherwise WARN or ESCALATE.

## 11. Representative execution graphs

### PRO update
Evidence:
EV-NMFTA-EBOL-2.1-PRO
EV-NMFTA-EBOL-2.1-LIFECYCLE
EV-NMFTA-EBOL-2.1-ERROR

Flow:
RF1 identity resolution
PRECEDES
RF3 lifecycle transition.

Update DEPENDS_ON successful PRO/BOL resolution.

Failure ROUTES_TO BOL identity-not-found.

### Consignee canonicalization
Regulatory presence:
EV-49CFR-373-101.

Role/relationship:
RF2.

Master resolution:
RF6.

Source authority:
RF9.

Flow:
role -> identity candidate -> master reconciliation -> authority decision -> accept/enrich/correct/escalate.

### Package gross weight
Package ownership:
RF2 / RF14.

Physical measure:
RF13.

Source authority:
RF9.

Flow:
resolve package owner/hierarchy -> validate measure+unit -> preserve distinct declared/verified/billing semantics.

### Hazmat description
Activation:
RF7.

Requiredness:
RF4.

Controlled values:
RF5.

Quantity/unit:
RF13.

Representation:
RF10.

The output is one composed regulatory execution contract, not isolated field validators.

### Associated document
Cardinality:
RF4.

Identity:
RF1.

Relationship:
RF2.

Type:
RF5.

Remarks:
RF16.

TemporalValue stores issue date/time.

### Monetary charge
MonetaryAmount + RF17.
Composes with RF5/RF2/RF9/RF11.

This remains broader-domain evidence unless LTL-03 scope explicitly needs financial execution behavior.

## 12. Exception and route behavior

Core candidate exception classes remain machine-addressable:
- BOL_IDENTITY_NOT_FOUND
- PARTY_IDENTITY_AMBIGUOUS
- LOCATION_MASTER_NO_MATCH
- AGGREGATE_CHILD_MISMATCH
- MEASURE_UNIT_MISSING
- HAZMAT_SEQUENCE_INVALID
- other previously catalogued candidate exceptions.

Exception names remain evolvable.

A failure must link:
generated instance -> ROUTES_TO -> exception
with condition and supporting evidence.

## 13. Scope separation

Each graph node/instance must declare scope:
- LTL03_CORE
- LTL03_CONDITIONAL
- BROADER_BOL_UNIVERSE
- CLIENT_BINDING
- RUNTIME_ONLY

This prevents broader domain evidence from leaking into the task-level execution contract.

Example:
Monetary service charge semantics are source-backed but broader than core LTL-03 transport-document identity.

## 14. Knowledge gaps

KG-NMFTA-BOL-REQUEST-PROPERTIES:
issuer YAML path is known, but exact BOL_Request property body is not yet verified.

Impact:
do not infer exact NMFTA property names/nesting/cardinality.

Knowledge gaps are first-class graph nodes and may BLOCK generated logic or evidence freeze.

## 15. Downstream accessibility contract

Downstream tools must be able to query, for any field/object/rule:

- why does this rule exist?
- what evidence supports it?
- what primitive does it operate on?
- what other rules must execute first?
- what condition activates it?
- what master/reference does it need?
- what source authority applies?
- what client binding can specialize it?
- what exception occurs on failure?
- what projection is needed for this executor?

The Domain Execution Contract is therefore not a document-only artifact; it is a governed graph-backed specification.

## 16. Runtime projection boundary

Malkom/IDP, RPA, AI agents, APIs and BPM/workflow consume projected logic.

Runtime projection may translate:
- field schema;
- validation;
- lookup;
- branch;
- route;
- confidence threshold;
- retry/idempotency behavior;
- error/exception mapping.

Runtime projection must not invent canonical business semantics.

## 17. Reconciliation status

Current machine graph:
- 39 generated instances;
- all instances linked to evidence;
- all instances linked to at least one primitive;
- all instances linked to at least one reusable family;
- no broken graph edges;
- no stranded evidence nodes;
- scope metadata populated;
- unresolved NMFTA property gap explicit.

Remaining before ATL-39 closure:
- verify bidirectional traversal results on representative evidence and generated-instance nodes;
- verify no current business/execution logic remains solely in historical prose artifacts;
- update shared handoff and Drive with final reconciliation disposition.


## 18. Graph-first research update — Monetary and Temporal/Version semantics

### RF17 evidence strengthening

UN/CEFACT D23B now provides property-level support that:
- service charges may repeat at consignment and consignment-item levels;
- service-charge objects may carry payment arrangement, category, applied amount and paying-party role;
- monetary Amount content is mandatory within the amount structure;
- currency identifier is optional.

Execution consequence:
MonetaryAmount remains distinct from physical Measure.

Required relationship pattern:
service-charge object/cardinality
-> semantic ownership
-> amount/currency validation
-> category/payment/payer validation
-> source authority
-> client specialization where applicable.

### RF18 — Temporal & Version Semantics

New candidate family RF18 is introduced through the governed normalization mechanism.

Evidence supports distinct document semantics for:
- issue date/time;
- first-version issue date/time;
- revision date/time;
- cancellation date/time where applicable;
- version identifier;
- revision identifier;
- previous-revision identifier.

RF18 responsibilities:
- classify temporal role;
- preserve distinct version/revision temporal semantics;
- normalize representation/timezone where governed;
- relate version/revision identifiers;
- enforce evidence-backed temporal ordering;
- detect impossible/reversed lineage;
- preserve temporal source authority.

RF18 composes with:
- RF1 Identity & Reference Resolution;
- RF2 Relationship Integrity;
- RF3 Lifecycle & State Transition;
- RF9 Source Authority & Precedence;
- RF11 Client Specialization where local timing/version policy applies.

Scope:
these document-version semantics remain BROADER_BOL_UNIVERSE unless transport-document-specific evidence establishes LTL-03-core applicability.

### Updated graph state

Current graph after this update:
- 157 nodes;
- 586 typed edges;
- 44 generated rule instances;
- no broken edges;
- no generated instances missing evidence/primitive/family linkage;
- no stranded evidence;
- no unused families or primitives.

### NMFTA property-level gap

Issuer artifact target remains:
assets/ebol-apiv2.1.0.yaml

Verified:
- eBOL 2.1.0;
- OAS 3.0;
- BOL_Request/BOL_Response schema families;
- controlled-code families;
- create/update/delete endpoints;
- PRO update/delete identity semantics.

Still unresolved:
- exact BOL_Request property names;
- nested object structure;
- property-level requiredness/cardinality.

No inferred or third-party property schema may be promoted to canonical truth while this gap remains.


## 19. Graph-first update — classification, service priority, NMFTA request properties and change events

### Item classification ownership

UN/CEFACT Consignment Item Type Code and Type Extension Code are item-owned classification semantics.

Guardrail:
do not equate these automatically to NMFTA Classification_Codes, NMFC item number or freight class.

### Service priority vs time

Transport service priority is a controlled TransportService semantic.

Guardrail:
a time-critical/service-priority code does not automatically instantiate TemporalValue or RF18. Actual timestamp/deadline semantics require separate evidence.

### NMFTA request-change property evidence

Issuer-explicit evidence now supports:
- limitedAccessType associated with limited-access accessorial context;
- origin and destination limited-access distinctions;
- limited-access types may relate to carrier tariff charges;
- optional weightUnit with Imperial UOM default behavior when omitted;
- referenceNumbers.trailerId linking shipment to a spotted trailer;
- referenceNumbers.manifestId linking shipment to a multi-shipment manifest.

These are admitted individually. The full BOL_Request schema gap remains open.

### Change-event / rated-charge relationship

NMFTA preliminary-freight-charge design supports a reusable cross-family event pattern:

Event
-> changed semantic
-> old/new value
-> date/time
-> optional monetary impact
-> updated rated charge
-> invoice reconciliation.

Examples include:
- reweigh;
- reclass;
- dimensions;
- accessorial changes.

This pattern composes RF3, RF18, RF13, RF5, RF17, RF2, RF9, RF12 and RF11 rather than creating bespoke change families.

### Current graph state

- 221 nodes
- 902 typed edges
- 62 generated rule instances
- no broken edges
- no generated instances missing evidence/primitive/family linkage
- no stranded evidence
- no unused rule families or primitives


## 20. Graph-first update — Dimension and pickup/in-transit event semantics

### Dimension semantics

UN/CEFACT evidence distinguishes:
- linear dimensions attached to Consignment Item, Package, Product and Transport Equipment;
- gross volume as a separate measure;
- loading length as a separate consignment-level measure;
- chargeable weight as a separate rating semantic.

Execution implications:
- Length / Width / Height are axis-specific Measure instances with semantic owner;
- gross volume must not overwrite source dimensions;
- loading length must not be confused with ordinary object length;
- chargeable weight must remain distinct from gross/declared/verified/billing weight.

Applicable family composition:
RF13 + RF2 + RF9 + RF12 + RF14 + RF11 where rating/client logic applies.

### Pickup event graph

NMFTA Pickup Request & Visibility standard establishes pickup as an event/state sequence with:
- Pickup Accepted;
- Driver Assigned / En Route;
- ETA / Stops Away;
- Driver Arrived;
- Departed Location;
- Pickup Number;
- PRO association;
- reject/reschedule/cancel paths with reason semantics.

Execution implications:
pickup is not one status field.
Pickup identifier resolution, temporal state and exception branches must remain graph relationships.

### In-transit event graph

NMFTA In-Transit Visibility establishes milestone vocabulary including:
Picked-up, Arrived at Terminal, Unloaded at Terminal, Loaded at Terminal, Departed Terminal, In Transit, Interline, Out for Delivery and Delivered.

It also distinguishes movement events from informational/exception notifications and includes exception patterns such as:
late, damage, short/lost, reweigh, accessorial added, reconsignment, appointment updates, missed delivery and customs updates.

Execution implication:
exception/information events attach to the milestone lifecycle and may compose with change-event/charge logic without replacing the core shipment state.

### Temporal roles

Transport events preserve separate:
- scheduled;
- estimated;
- actual occurrence.

RF18 must retain these temporal roles and may not collapse them to a single timestamp.

### Current graph state

- 244 nodes
- 1029 typed edges
- 70 generated rule instances
- no broken edges
- no generated instances missing evidence/primitive/family linkage
- no stranded evidence
- no unused rule families or primitives
