# LTL-03 Rule-Normalization Retrospective v0.1

Date: 2026-09-20
Workstream: ATL-35
Status: RESEARCH CANDIDATE — NOT FROZEN

## Purpose

Retrospectively normalize previously discovered G1-G26 logic so candidate task-specific rule labels do not become an unbounded canonical rule catalogue.

## Initial normalized semantic primitives

1. Identifier
2. Reference
3. Measure
4. Party
5. Location
6. Document
7. Relationship
8. State
9. Event
10. Controlled Vocabulary
11. Master Reference
12. Collection / Cardinality
13. Package / Handling Unit
14. Commodity / Consignment Item
15. Instruction / Note
16. Evidence / Provenance

## Reusable rule families

### RF1 — Identity & Reference Resolution
Covers prior G1 and parts of G6/G18.
Parameters:
- referenceType;
- assigningAuthority;
- uniquenessScope;
- semanticOwner;
- lifecycleStage;
- requiredness;
- master/reference source.

Generated instances include:
- PRO resolution;
- BOL identifier resolution;
- booking-reference resolution;
- LocationID resolution;
- future PO/shipment-reference instances.

### RF2 — Relationship Integrity
Covers prior G2, G15, G16, G17, G19 and parts of G21.
Parameters:
- sourceObject;
- targetObject;
- role;
- cardinality;
- allowed equivalence binding;
- source authority.

Generated instances include:
- consignment->consignee;
- consignment->carrier;
- BOL->consignment;
- item->package;
- package->parent package;
- pickup location vs consignee receipt vs final destination.

### RF3 — Lifecycle & State Transition
Covers prior G3 and parts of G8.
Parameters:
- object;
- state;
- event/action;
- preconditions;
- allowed transition;
- not-found behavior;
- evidence requirements.

Generated instances:
- BOL create;
- BOL update;
- BOL delete/cancel.

### RF4 — Requiredness & Cardinality
Covers prior G4 and G13.
Parameters:
- semanticOwner;
- field/relationship;
- minOccurs;
- maxOccurs;
- activation condition;
- client override.

Generated instances:
- 0..1 carrier-assigned ID;
- 1..1 road-consignment root;
- 0..n item collection;
- client-mandatory LocationID.

### RF5 — Controlled-Value Validation
Covers prior G5 and portions of G11.
Parameters:
- vocabulary;
- value;
- authority;
- version;
- representation constraint;
- client mapping.

Generated instances:
- accessorial code;
- packaging type;
- handling-unit type;
- payment terms;
- time-critical type;
- result status.

### RF6 — Master/Reference Reconciliation
Covers prior G6 and G18.
Parameters:
- semantic role;
- master source;
- lookup keys;
- matching policy;
- ambiguity policy;
- canonicalization permission.

Generated instances:
- shipper identity;
- consignee identity;
- location identity;
- LocationID mapping.

### RF7 — Conditional Activation
Covers prior G7.
Parameters:
- activation predicate;
- activated requirements;
- representation/order requirements;
- severity;
- provenance.

Generated instances:
- hazmat shipping-paper requirements.

### RF8 — Error & Exception Semantics
Covers prior G8 and G9.
Parameters:
- failure class;
- severity;
- aggregation behavior;
- response ordering;
- retry/remediation behavior.

Generated instances:
- invalid BOL data;
- BOL not found;
- multi-error result set.

### RF9 — Source Authority & Precedence
Covers prior G10.
Parameters:
- semantic attribute;
- lifecycle stage;
- competing sources;
- authority order;
- coexistence vs overwrite policy.

Generated instances:
- declared vs verified vs billing weight;
- booking address vs document address vs master address.

### RF10 — Representation Constraint
Covers prior G11.
Parameters:
- semanticOwner;
- format;
- sequence/order;
- grouping;
- conditional activation.

Generated instances:
- hazmat basic-description sequence.

### RF11 — Client Specialization
Covers prior G12 and G17.
This is a binding family, not canonical domain truth.

Parameters:
- client/carrier;
- scope;
- base canonical rule;
- stricter requiredness;
- local min/max;
- local master;
- local routing;
- local role equivalence.

### RF12 — Aggregate Reconciliation
Covers prior G14 and G25.
Parameters:
- parent aggregate;
- child collection;
- reconciliation function;
- tolerance/binding;
- source authority.

Generated instances:
- package count vs package children;
- parent weight vs child measures where semantics allow.

### RF13 — Measure Semantics
Normalizes prior G20, G22, G23 and portions of G19/G24.

Primitive:
Measure(value, unit, semanticOwner, source, confidence)

Parameters:
- measureType;
- semanticOwner;
- unit;
- allowed unit family;
- lifecycle/source role;
- aggregation behavior.

Generated instances:
- consignment gross weight;
- item gross weight;
- package gross weight;
- package net weight;
- gross volume;
- future dimensions.

### RF14 — Hierarchy
Covers prior G21.
Parameters:
- node type;
- identifier;
- parent identifier;
- level;
- allowed parent/child relationship;
- cycle policy.

Generated instances:
- pallet/carton/package hierarchy.

### RF15 — Candidate Parsing & Semantic Assignment
Covers prior G19 and G24.
Parameters:
- source text/block;
- candidate primitives;
- candidate semantic owners;
- structural constraints;
- relationship evidence;
- ambiguity policy.

Generated instance:
"4 PLTS AUTO PARTS 2150 LBS" -> candidate quantity/type/commodity/measure structures.

### RF16 — Instruction/Note Ownership
Covers prior G26.
Parameters:
- instruction/note;
- semantic owner;
- scope;
- repetition;
- downstream relevance.

Generated instances:
- item-level special instruction;
- shipment-level instruction;
- damage remark.

## What changed vs G1-G26

The prior G1-G26 labels should now be treated primarily as discovered **generator behaviors / candidate specializations**, not automatically as 26 independent canonical rule families.

Current normalized result:
- 16 semantic primitives/classes above;
- 16 reusable rule-family candidates;
- multiple generated instances beneath them.

Further compression may be possible after additional tasks demonstrate overlap. Do not compress solely for aesthetic rule-count reduction.

## Reuse examples

### Weight
Previously:
- item weight;
- package weight;
- consignment weight;
- declared/verified/billing distinctions.

Normalized:
Measure + RF13 Measure Semantics + RF9 Source Authority + RF12 Aggregate Reconciliation as needed.

### Identifiers
Previously:
PRO, BOL reference, carrier ID, consignor ID, LocationID.

Normalized:
Identifier/Reference + RF1 Identity & Reference Resolution + RF4 Requiredness/Cardinality + RF6 Master Reconciliation where applicable.

### Party/location
Previously:
role-before-identity, role equivalence, role-aware master lookup.

Normalized:
Party/Location + RF2 Relationship Integrity + RF6 Master Reconciliation + RF11 Client Specialization.

## Baseline scalability metrics for LTL-03

At this checkpoint:
- Apparent candidate generator behaviors discovered: 26
- Normalized reusable rule-family candidates: 16
- Semantic primitive/classes currently used: 16
- Generated rule instances: not yet fully enumerated
- Client-specific bindings: not yet fully enumerated
- Bespoke-treatment rules: not yet established

Do NOT calculate Rule Reuse Ratio yet because the denominator (full generated rule-instance set) is not frozen.

## Prospective rule-intake gate

For every new discovery:
1. Record authoritative evidence/domain fact.
2. Map to semantic primitive.
3. Search RF1-RF16.
4. Parameterize or compose existing family if semantics fit.
5. Create a new candidate family only with explicit insufficiency rationale.
6. Classify any local variation as client binding where appropriate.
7. Generate concrete rule instance.
8. Preserve provenance.
9. Update scalability metrics.

## Research hypothesis

LTL-03 is already showing early compression from many apparent rules into a smaller family system.

This is not yet proof of scalable normalization. Proof requires:
- complete LTL-03 rule-instance enumeration;
- coverage against frozen independent BOL universe;
- Rule Reuse Ratio;
- New Rule Family Rate;
- reuse behavior across additional LTL tasks;
- ATL-37 independent Claude audit.
