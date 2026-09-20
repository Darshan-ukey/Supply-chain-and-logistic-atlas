# Atlas LTL Reusable Execution Pattern Governance v1

Date: 2026-09-20
Status: GOVERNING CANDIDATE

## Purpose

Separate task-specific generated instances from reusable LTL execution knowledge so future LTL tasks can consume already-governed logic instead of rediscovering it.

## Reuse layers

1. Semantic Primitive
Reusable business meaning:
Identifier, Reference, Measure, Event, State, Package, TransportEquipment, TransportService, MonetaryAmount, TemporalValue, etc.

2. Reusable Rule Family
Reusable execution behavior:
RF1-RF18 and future evidence-backed families.

3. Reusable Execution Pattern
A governed composition of primitives + families + typed relationships that recurs across multiple LTL tasks.

4. Task-Specific Generated Rule Instance
A concrete application of a reusable pattern to one task/object/lifecycle/scope.

5. Client Binding
Local specialization.

6. Runtime Projection
Executor-specific implementation.

## New governing rule

Every generated instance must be evaluated for promotion into a reusable execution pattern when:
- the logic is not inherently tied to one task;
- the same family composition is likely to recur;
- semantic owner / lifecycle parameters can vary without changing the core mechanism;
- authoritative evidence is general enough to support reuse.

Do not promote merely because two instances look similar.

## Candidate reusable LTL patterns from current LTL-03 research

### RPAT-LTL-IDENTITY-BEFORE-MUTATION
Pattern:
resolve identifier/reference
-> bind to business object
-> validate uniqueness/scope
-> permit lifecycle mutation.

Families:
RF1 + RF2 + RF3 + RF9.

Reusable across:
BOL, pickup, shipment, manifest, equipment, reference-linked updates.

### RPAT-LTL-ROLE-BEFORE-MASTER
Pattern:
resolve party/location role
-> resolve identity
-> reconcile against role-aware master
-> apply source authority
-> route ambiguity.

Families:
RF2 + RF6 + RF9 + RF8.

Reusable across:
shipper, consignee, pickup location, delivery location, requestor, payer.

### RPAT-LTL-CONDITIONAL-CONTRACT
Pattern:
evaluate trigger/condition
-> activate required fields
-> validate controlled values
-> enforce representation
-> route exceptions.

Families:
RF7 + RF4 + RF5 + RF10 + RF8.

Reusable across:
hazmat, limited-access, special-service, regulatory expansions.

### RPAT-LTL-MEASURE-WITH-OWNER
Pattern:
resolve semantic owner
-> validate measure type/value/unit
-> preserve source authority
-> reconcile with related measures when governed.

Families:
RF2 + RF13 + RF9 + RF12.

Reusable across:
weight, volume, dimensions, loading length, chargeable weight.

### RPAT-LTL-EVENT-LIFECYCLE
Pattern:
identify event
-> bind to shipment/object
-> classify state transition
-> preserve scheduled/estimated/actual time
-> attach exception/information events
-> preserve event provenance.

Families:
RF3 + RF18 + RF2 + RF5 + RF8 + RF9.

Reusable across:
pickup, in-transit, delivery, appointment, terminal movement.

### RPAT-LTL-CHANGE-EVENT
Pattern:
event
-> changed semantic
-> old/new value
-> timestamp
-> reason
-> optional monetary impact
-> resulting state/rated charge
-> downstream reconciliation.

Families:
RF3 + RF18 + RF13/RF5/RF17 + RF2 + RF9 + RF12 + RF11.

Reusable across:
reweigh, reclass, DIM change, accessorial change, reconsignment.

### RPAT-LTL-REPEATING-CHILD-OBJECT
Pattern:
instantiate repeating collection
-> bind child to owner
-> resolve child identity
-> validate child attributes
-> reconcile parent/child aggregates where governed.

Families:
RF4 + RF2 + RF1 + RF5 + RF12 + RF14.

Reusable across:
packages, items, associated documents, transport services, equipment references.

### RPAT-LTL-CLIENT-OPTIONALITY-SPECIALIZATION
Pattern:
preserve canonical industry optionality
-> apply scoped client/carrier requiredness
-> retain provenance of override
-> never rewrite industry truth.

Families:
RF11 + RF4 + RF9.

Reusable across:
LocationID, service requirements, local references, client-required fields.

### RPAT-LTL-MONETARY-CHARGE
Pattern:
identify amount purpose
-> validate value/currency
-> bind payer/payee/service owner
-> validate charge category
-> apply authority/client binding
-> reconcile where governed.

Families:
RF17 + RF5 + RF2 + RF9 + RF11 + RF12.

Reusable across:
accessorial charges, COD, rated charges, tariff-linked charges.

### RPAT-LTL-REFERENCE-GROUPING
Pattern:
resolve reference
-> identify grouping object
-> bind one-to-one / one-to-many relationship
-> preserve grouping cardinality and scope.

Families:
RF1 + RF2 + RF4 + RF14 + RF9.

Reusable across:
manifest, trailer, booking, pickup number, PRO, related transport documents.

## Promotion discipline

Each candidate pattern must carry:
- patternId
- evidenceIds
- primitiveIds
- familyIds
- typed edge template
- allowed parameters
- prohibited assumptions
- known task usages
- scope
- unresolved gaps

## Downstream usage

Future LTL tasks should search reusable patterns before generating new family compositions.

A task should instantiate a reusable pattern with parameters rather than recreate the full composition when semantics match.

## Scalability metrics extension

Track:
- reusable patterns available
- new generated instances using existing patterns
- new patterns introduced
- families introduced
- client bindings introduced
- bespoke logic

Pattern Reuse Ratio:
generated instances instantiated from existing reusable patterns / total generated instances.

This supplements, not replaces, Rule Reuse Ratio.

## Freeze boundary

The pattern catalogue evolves.
The promotion/search/trace mechanism is governed.
