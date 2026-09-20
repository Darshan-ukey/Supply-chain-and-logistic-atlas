# LTL-03 Execution Logic Graph Registry v0.1

Date: 2026-09-20
Workstream: ATL-39 / ATL-35
Status: RECONCILIATION CANDIDATE — NOT FROZEN

## Purpose

Provide one machine-addressable conceptual registry for the existing LTL-03 evidence, domain facts, semantic primitives, reusable rule families, generated rule instances, dependencies, conflicts, client bindings and downstream projections.

The governing requirement is that no execution-relevant logic exists only as isolated prose.

## Node classes

- EVIDENCE
- DOMAIN_FACT
- SEMANTIC_PRIMITIVE
- RULE_FAMILY
- GENERATED_RULE_INSTANCE
- CLIENT_BINDING
- EXCEPTION
- RUNTIME_PROJECTION
- KNOWLEDGE_GAP

## Typed edge catalogue

- DERIVES_FROM
- INSTANTIATES
- SPECIALIZES
- COMPOSES_WITH
- DEPENDS_ON
- ACTIVATES
- CONSTRAINS
- RESOLVES_WITH
- OVERRIDES_WITHIN_SCOPE
- PRECEDES
- CORROBORATES
- CONFLICTS_WITH
- COEXISTS_AS_DISTINCT_SEMANTIC
- ROUTES_TO
- PROJECTS_TO
- BLOCKED_BY

## Stable evidence registry

### EV-49CFR-373-101
Source: 49 CFR 373.101.
Facts supported:
- consignor presence;
- consignee presence;
- origin point;
- destination point;
- package count;
- freight description;
- rating-relevant weight/volume/measurement.

### EV-49CFR-172-202
Source: 49 CFR 172.202.
Facts supported:
- hazmat ID number;
- proper shipping name;
- primary/subsidiary hazard class/division;
- packing group where applicable;
- total quantity and unit;
- number/type of packages;
- ordered basic-description representation.

### EV-49CFR-172-203
Source: 49 CFR 172.203.
Facts supported:
- special-permit notation;
- Limited Quantity notation;
- hazardous-substance naming;
- RQ notation;
- additional condition-specific description requirements.

### EV-NMFTA-EBOL-2.1-LIFECYCLE
Source: NMFTA Digital LTL eBOL 2.1.0.
Facts supported:
- POST create;
- PUT update by PRO;
- DELETE by PRO;
- BOL_Request/BOL_Response schema families;
- controlled-code schema families.

### EV-NMFTA-EBOL-2.1-PRO
Source: NMFTA eBOL 2.1 documentation/FAQ.
Facts supported:
- PRO may be pre-assigned;
- carrier may assign if absent;
- PRO identifies update/delete target.

### EV-NMFTA-EBOL-2.1-ERROR
Facts supported:
- invalid BOL data -> recommended 400;
- BOL not found on update/delete -> recommended 404;
- multiple validation issues may be returned;
- failure errors precede warnings/info.

### EV-NMFTA-EBOL-2.1-LOCATIONID
Facts supported:
- LocationID optional at standard level;
- assigning organization scope;
- not globally unique;
- carrier/client may strengthen requiredness.

### EV-NMFTA-EBOL-2.1-PARTNER-SPECIALIZATION
Facts supported:
- carrier can make non-mandatory standard field mandatory;
- backend min/max constraints may apply;
- warning/error behavior may be specialized.

### EV-UNECE-D23B-CONSIGNMENT-ID
Facts supported:
- generic/consignor/carrier/freight-forwarder assigned IDs are distinct semantics;
- carrier-assigned ID may include booking reference;
- identifier content mandatory within identifier structure;
- identification-scheme agency optional.

### EV-UNECE-D23B-CONSIGNMENT-MEASURE
Facts supported:
- consignment gross weight and gross volume are separate measures.

### EV-UNECE-D23B-ITEM-MEASURE
Facts supported:
- item gross weight 0..1;
- measure content mandatory when supplied;
- unit code mandatory when supplied.

### EV-UNECE-D23B-PACKAGE
Facts supported:
- transport packages repeat 0..n;
- package quantity/weight and hierarchy semantics exist.

### EV-UNECE-D23B-LOCATION-ROLE
Facts supported:
- semantically distinct location roles such as acceptance/receipt/departure/discharge.

### EV-UNECE-D23B-ASSOCIATED-DOCUMENT
Facts supported:
- associated document repeats 0..n;
- document identifier/type/issue date-time/remarks.

### EV-UNECE-D23B-MONETARY
Facts supported:
- associated invoice amount;
- COD amount;
- logistics service charges;
- charge categories;
- paying-party roles.

### EV-UNECE-D23B-INDICATOR
Facts supported:
- transshipment permission indicator.

### EV-NMFTA-EBOL-2.1-YAML-TARGET
Facts supported:
- issuer artifact path assets/ebol-apiv2.1.0.yaml exists;
- exact BOL_Request property body remains unresolved.

## Domain fact registry

### DF-IDENTIFIER-ROLE-DISTINCTION
DERIVES_FROM EV-UNECE-D23B-CONSIGNMENT-ID.
Carrier-, consignor-, freight-forwarder- and generic consignment identifiers are semantically distinct.

### DF-PRO-LIFECYCLE-IDENTIFIER
DERIVES_FROM EV-NMFTA-EBOL-2.1-PRO + EV-NMFTA-EBOL-2.1-LIFECYCLE.
PRO resolution is prerequisite to update/delete.

### DF-LOCATIONID-SCOPE
DERIVES_FROM EV-NMFTA-EBOL-2.1-LOCATIONID.
LocationID uniqueness is bounded by assigning organization.

### DF-REGULATORY-BOL-MINIMUM
DERIVES_FROM EV-49CFR-373-101.
The seven minimum BOL/receipt information categories are regulatory presence/content requirements.

### DF-HAZMAT-CONDITIONAL-CONTRACT
DERIVES_FROM EV-49CFR-172-202 + EV-49CFR-172-203.
Hazmat conditions activate an expanded content and representation contract.

### DF-MEASURE-VALUE-UNIT
DERIVES_FROM EV-UNECE-D23B-ITEM-MEASURE.
A supplied item measure is a value+unit semantic pair.

### DF-PACKAGE-REPEATING-HIERARCHY
DERIVES_FROM EV-UNECE-D23B-PACKAGE.
Packages are repeating semantic objects and may participate in hierarchy.

### DF-LOCATION-ROLE-SEPARATION
DERIVES_FROM EV-UNECE-D23B-LOCATION-ROLE.
Physical location identity and business role are separate semantics.

### DF-ASSOCIATED-DOCUMENT-OBJECT
DERIVES_FROM EV-UNECE-D23B-ASSOCIATED-DOCUMENT.
Associated documents are first-class repeating objects.

### DF-MONETARY-DISTINCT-FROM-MEASURE
DERIVES_FROM EV-UNECE-D23B-MONETARY.
Monetary amount/charge semantics are materially different from physical Measure semantics.

## Semantic primitive registry

SP-IDENTIFIER
SP-REFERENCE
SP-DOCUMENT
SP-PARTY
SP-LOCATION
SP-MEASURE
SP-PACKAGE
SP-COMMODITY-ITEM
SP-RELATIONSHIP
SP-STATE
SP-EVENT
SP-CONTROLLED-VOCABULARY
SP-MASTER-REFERENCE
SP-COLLECTION-CARDINALITY
SP-INSTRUCTION-NOTE
SP-EVIDENCE-PROVENANCE
SP-MONETARY-AMOUNT
SP-INDICATOR
SP-TEMPORAL-VALUE

## Rule-family registry — current candidate catalogue

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
RF16 Instruction/Note Ownership
RF17 Monetary Amount / Charge Semantics

Catalogue is evolvable. Mechanism is governed.

## Reconciled generated-instance graph

### GI-PRO-ASSIGN
Evidence:
- EV-NMFTA-EBOL-2.1-PRO
Facts:
- DF-PRO-LIFECYCLE-IDENTIFIER
Primitives:
- SP-IDENTIFIER, SP-REFERENCE, SP-DOCUMENT
Families:
- RF1, RF4
Edges:
- EV-NMFTA-EBOL-2.1-PRO DERIVES_FROM? No: GI DERIVES_FROM EV-NMFTA-EBOL-2.1-PRO
- GI-PRO-ASSIGN INSTANTIATES SP-IDENTIFIER
- RF4 CONSTRAINS GI-PRO-ASSIGN requiredness/absence behavior
- client preassignment policy OVERRIDES_WITHIN_SCOPE through RF11 when present
Outcome:
- preassigned PRO accepted if valid;
- otherwise carrier assignment path where supported;
- assignment authority/provenance retained.

### GI-PRO-RESOLVE-FOR-UPDATE
Evidence:
- EV-NMFTA-EBOL-2.1-PRO
- EV-NMFTA-EBOL-2.1-LIFECYCLE
Families:
- RF1, RF3, RF8
Edges:
- GI-PRO-RESOLVE-FOR-UPDATE DERIVES_FROM EV-NMFTA-EBOL-2.1-PRO
- RF1 PRECEDES RF3
- RF3 DEPENDS_ON successful GI-PRO-RESOLVE-FOR-UPDATE
- failed RF1 resolution ACTIVATES EX-BOL-IDENTITY-NOT-FOUND
- EX-BOL-IDENTITY-NOT-FOUND DERIVES_FROM EV-NMFTA-EBOL-2.1-ERROR
Runtime meaning:
downstream executor must not issue/update state before target identity resolves.

### GI-CONSIGNEE-CANONICALIZE
Evidence:
- EV-49CFR-373-101
- EV-UNECE-D23B-LOCATION-ROLE
Primitives:
- SP-PARTY, SP-RELATIONSHIP, SP-MASTER-REFERENCE
Families:
- RF2, RF4, RF6, RF9
Edges:
- EV-49CFR-373-101 CONSTRAINS consignee presence
- RF2 PRECEDES RF6
- RF6 DEPENDS_ON resolved role from RF2
- RF6 RESOLVES_WITH client consignee/location master
- RF9 CONSTRAINS whether master value may correct or only enrich source value
- two surviving candidates ACTIVATES EX-PARTY-IDENTITY-AMBIGUOUS
Runtime meaning:
correct OCR text cannot be auto-canonicalized until role and relationship resolve.

### GI-PACKAGE-COUNT-RECONCILE
Evidence:
- EV-49CFR-373-101
- EV-UNECE-D23B-PACKAGE
Primitives:
- SP-COLLECTION-CARDINALITY, SP-PACKAGE, SP-RELATIONSHIP
Families:
- RF4, RF12, RF2
Edges:
- EV-49CFR-373-101 CONSTRAINS presence of package count
- EV-UNECE-D23B-PACKAGE INSTANTIATES repeating package children
- RF2 establishes parent/child ownership
- RF4 validates cardinality
- RF12 DEPENDS_ON valid package-child interpretation
- mismatch ACTIVATES EX-AGGREGATE-CHILD-MISMATCH

### GI-PACKAGE-GROSS-WEIGHT
Evidence:
- EV-UNECE-D23B-PACKAGE
- EV-UNECE-D23B-ITEM-MEASURE / related measure semantics
Primitives:
- SP-PACKAGE, SP-MEASURE, SP-RELATIONSHIP
Families:
- RF2, RF13, RF14, RF9
Edges:
- RF2 PRECEDES RF13 by resolving semantic owner
- RF14 CONSTRAINS package hierarchy context
- RF13 validates value+unit
- RF9 CONSTRAINS source authority when competing weights exist
- declared/verified/billing weights COEXIST_AS_DISTINCT_SEMANTIC when evidence establishes different purposes
Runtime meaning:
never overwrite one weight merely because another source has a different value.

### GI-HAZMAT-DESCRIPTION
Evidence:
- EV-49CFR-172-202
- EV-49CFR-172-203
Primitives:
- SP-COMMODITY-ITEM, SP-IDENTIFIER, SP-CONTROLLED-VOCABULARY, SP-MEASURE, SP-PACKAGE
Families:
- RF7, RF1, RF5, RF4, RF13, RF10
Edges:
- RF7 ACTIVATES RF1/RF5/RF4/RF13/RF10 requirements
- RF4 CONSTRAINS required presence/cardinality
- RF5 validates controlled semantics
- RF13 validates total quantity+unit
- RF10 CONSTRAINS sequence/representation
- EV-49CFR-172-203 SPECIALIZES the activated contract for Limited Quantity/RQ/special permit cases
Runtime meaning:
hazmat logic is one composed execution contract, not isolated field rules.

### GI-LOCATIONID-RESOLVE
Evidence:
- EV-NMFTA-EBOL-2.1-LOCATIONID
- EV-NMFTA-EBOL-2.1-PARTNER-SPECIALIZATION
Primitives:
- SP-IDENTIFIER, SP-LOCATION, SP-MASTER-REFERENCE
Families:
- RF1, RF6, RF11, RF4
Edges:
- RF1 identifies LocationID semantic
- RF6 RESOLVES_WITH assigning-organization location master
- EV-NMFTA-EBOL-2.1-LOCATIONID CONSTRAINS uniqueness scope
- RF11 OVERRIDES_WITHIN_SCOPE optional->mandatory when carrier/client policy requires
- RF4 validates requiredness after applicable client binding
Runtime meaning:
global uniqueness must never be assumed.

### GI-ASSOCIATED-DOCUMENT
Evidence:
- EV-UNECE-D23B-ASSOCIATED-DOCUMENT
Primitives:
- SP-DOCUMENT, SP-IDENTIFIER, SP-TEMPORAL-VALUE, SP-INSTRUCTION-NOTE, SP-COLLECTION-CARDINALITY
Families:
- RF1, RF2, RF4, RF5, RF16
Edges:
- RF4 establishes 0..n collection
- RF1 resolves document identifier
- RF5 validates document type code
- SP-TEMPORAL-VALUE captures issue date/time
- RF16 preserves remarks ownership
- RF2 binds document to consignment
Runtime meaning:
associated documents are traversable child objects, not attachment text.

### GI-MONETARY-CHARGE
Evidence:
- EV-UNECE-D23B-MONETARY
Primitives:
- SP-MONETARY-AMOUNT, SP-PARTY, SP-CONTROLLED-VOCABULARY, SP-RELATIONSHIP
Families:
- RF17, RF5, RF2, RF9, RF11
Edges:
- EV-UNECE-D23B-MONETARY DERIVES_FROM? No: GI-MONETARY-CHARGE DERIVES_FROM EV-UNECE-D23B-MONETARY
- RF17 validates amount/currency/purpose
- RF5 validates charge category/payer role vocabulary
- RF2 binds payer/payee role relationships
- RF9 CONSTRAINS monetary source authority
- RF11 may SPECIALIZE local tariff/billing/client behavior
Runtime meaning:
monetary semantics remain distinct from physical Measure.

## Cross-field dependency registry

DEP-PRO-UPDATE:
GI-PRO-RESOLVE-FOR-UPDATE PRECEDES BOL update transition.

DEP-CONSIGNEE-MASTER:
consignee role resolution PRECEDES master canonicalization.

DEP-PACKAGE-WEIGHT:
package ownership/hierarchy PRECEDES package weight validation.

DEP-HAZMAT:
hazmat applicability ACTIVATES required description fields and representation rules.

DEP-PACKAGE-RECON:
package child interpretation PRECEDES aggregate reconciliation.

DEP-LOCATIONID:
assigning-organization resolution PRECEDES LocationID master lookup.

DEP-ASSOCIATED-DOCUMENT:
document collection/cardinality PRECEDES child-level identity/type/date validation.

DEP-MONETARY:
amount purpose/semantic owner PRECEDES financial validation and payer-role resolution.

## Conflict/coexistence registry

### CF-WEIGHT-PURPOSE
Potential values:
- declared weight;
- verified operational/reweigh;
- billing weight.
Relationship:
COEXISTS_AS_DISTINCT_SEMANTIC unless evidence proves same semantic slot.
Do not overwrite by default.

### CF-LOCATION-ROLE
Same physical address may represent:
- shipper;
- pickup;
- consignee;
- receipt;
- final destination.
Relationship:
same identity can COEXIST_AS_DISTINCT_SEMANTIC across roles.

### CF-OPTIONAL-VS-CLIENT-MANDATORY
Industry optional field + client mandatory policy.
Relationship:
client binding OVERRIDES_WITHIN_SCOPE requiredness only.
It does not rewrite canonical industry semantics.

### CF-SOURCE-VS-MASTER
Source-document value vs master canonical value.
Relationship:
master may RESOLVE_WITH / ENRICH / CORRECT only under RF9 authority rules.
Original source value remains immutable evidence.

## Knowledge-gap registry

KG-NMFTA-BOL-REQUEST-PROPERTIES
BLOCKED_BY inability to retrieve issuer YAML body.
Evidence:
EV-NMFTA-EBOL-2.1-YAML-TARGET.
Impact:
exact NMFTA property names/nesting/cardinality cannot yet be canonicalized.

KG-TEMPORAL-FAMILY
No dedicated temporal family yet.
Trigger for reconsideration:
validity windows, ordering, timezone normalization or deadline computation demonstrating materially distinct reusable semantics.

## Downstream accessibility contract

A downstream consumer must be able to query, for any generated instance:
- what business fact caused it;
- what authoritative evidence supports that fact;
- which primitive(s) it operates on;
- which family/families generate its behavior;
- what must execute before it;
- what conditions activate it;
- what other rule instances constrain it;
- what source/master resolves it;
- what exception results from failure;
- what client binding can specialize it;
- what runtime projection implements it.

Conversely, for any evidence node, Atlas must return every fact, primitive, family and generated rule instance that depends on that evidence.

## Known reconciliation note

Two provisional prose edges above are intentionally written with correction notes ("DERIVES_FROM? No") to document a discovered directionality ambiguity. Canonical graph serialization must use:
Generated Instance DERIVES_FROM Evidence
or
Domain Fact DERIVES_FROM Evidence
not Evidence DERIVES_FROM Generated Instance.

This must be enforced by the machine-readable schema.

## Exit criteria for ATL-39

- stable IDs assigned to all current canonical evidence and material domain facts;
- all current generated instances mapped with typed edges;
- all cross-field dependencies and conflicts represented;
- DEC reconciled to RF1-RF17 and SP catalogue;
- no known execution-relevant logic stranded only in prose;
- representative graph traversal verified bidirectionally;
- unresolved gaps explicitly registered.
