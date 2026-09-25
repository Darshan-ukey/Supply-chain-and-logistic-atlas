# LTL-03 Graph-First Discovery — NMFTA eBOL Request-Change Property Evidence v0.1

Date: 2026-09-20
Workstream: ATL-35
Status: RESEARCH CANDIDATE — GRAPH-FIRST INTAKE

## Source boundary

NMFTA Digital LTL Council meeting deck dated 2024-01-22 documents eBOL API request changes.

This is issuer-explicit evidence of intended/request-change semantics, but it does not substitute for a complete current BOL_Request YAML body.

## Discovery A — Limited Access

NMFTA states that more granular Limited_Access_Types were added for carrier flexibility, including cases where a limited-access type is associated with a specific tariff charge.

The deck visual identifies limitedAccessType under accessorial logic and distinguishes origin and destination.

### Domain facts

DF-LIMITED-ACCESS-ACCESSORIAL:
Limited-access type is associated with limited-access accessorial semantics, not a generic location type alone.

DF-LIMITED-ACCESS-DIRECTION:
Limited-access semantics distinguish origin and destination context.

DF-LIMITED-ACCESS-TARIFF-RELATION:
A limited-access type can be associated with a specific charge identified in a carrier tariff.

### Primitive mapping
- TransportService
- Location
- Relationship
- Controlled Vocabulary
- MonetaryAmount
- Party/Client Binding where carrier tariff applies

### Family composition
- RF2 Relationship Integrity
- RF5 Controlled-Value Validation
- RF17 Monetary Amount / Charge Semantics
- RF11 Client Specialization
- RF9 Source Authority
- RF7 Conditional Activation if limited-access type activates additional execution requirements

### Generated instance
Resolve limited-access accessorial context as origin/destination, validate the type, and link tariff/charge semantics where applicable.

## Discovery B — Weight Unit

NMFTA states that an optional weightUnit attribute was added to several request objects that lacked it; Pounds or Kilograms are examples, and Imperial UOM defaults if omitted.

### Domain facts

DF-NMFTA-WEIGHT-UNIT-OPTIONAL:
Weight-bearing request objects may carry optional weightUnit.

DF-NMFTA-WEIGHT-UNIT-DEFAULT:
If weightUnit is omitted in the documented request-change behavior, Imperial UOM defaults.

### Primitive mapping
- Measure
- Controlled Vocabulary
- Source/Default provenance

### Family composition
- RF13 Measure Semantics
- RF5 Controlled-Value Validation
- RF9 Source Authority / provenance
- RF11 Client Specialization only if carrier/client behavior further specializes the standard

### Execution guard

A defaulted unit must be traceable as DEFAULTED_FROM_STANDARD, not represented as source-extracted.

## Discovery C — Trailer and Manifest References

NMFTA states:
- trailerId added to referenceNumbers; when passed, shipment is associated to a specific spotted trailer;
- manifestId added to referenceNumbers; when passed, shipment is associated to a manifest that includes multiple shipments and may span multiple spotted trailers.

### Domain facts

DF-TRAILER-REFERENCE:
trailerId is a shipment reference establishing a relationship to a specific spotted trailer.

DF-MANIFEST-REFERENCE:
manifestId is a shipment reference establishing a relationship to a manifest that can include multiple shipments and potentially multiple spotted trailers.

### Primitive mapping
- Identifier
- Reference
- Relationship
- TransportEquipment for trailer relationship
- Collection/Cardinality for manifest-to-multiple-shipment relation

### Family composition
- RF1 Identity & Reference Resolution
- RF2 Relationship Integrity
- RF4 Requiredness/Cardinality
- RF14 Hierarchy/structure where manifest grouping is represented
- RF9 Source Authority

### Generated instances
- resolve trailerId and bind shipment -> specific spotted trailer;
- resolve manifestId and bind shipment -> manifest;
- preserve manifest one-to-many shipment semantics rather than treating manifestId as an unrelated string.

## Knowledge-gap impact

The complete BOL_Request property tree remains unresolved.

However, these issuer-explicit request-change properties can now be admitted individually with provenance:
- limitedAccessType origin/destination semantics;
- weightUnit optional/default behavior;
- referenceNumbers.trailerId;
- referenceNumbers.manifestId.

Do not infer sibling properties or broader nesting beyond the explicit evidence.

## Normalization result

New primitive required: 0.
New reusable family required: 0.

Existing families compose successfully, while the evidence graph gains more exact property-level semantics.
