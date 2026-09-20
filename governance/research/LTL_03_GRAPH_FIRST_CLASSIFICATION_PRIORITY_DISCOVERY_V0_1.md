# LTL-03 Graph-First Discovery — Item Classification & Transport-Service Priority v0.1

Date: 2026-09-20
Workstream: ATL-35
Status: RESEARCH CANDIDATE — GRAPH-FIRST INTAKE

## Track A — authoritative evidence

### Consignment-item classification semantics

UN/CEFACT D23B models Consignment Item as a first-class object and exposes:
- Type Code;
- Type Extension Code;
- item identifier;
- package quantity;
- gross/net weight;
- gross volume;
- other item attributes.

This establishes an evidence-backed item classification/type semantic owned by Consignment Item.

Important boundary:
This does NOT establish equivalence to NMFTA eBOL Classification_Codes, NMFC item number, freight class, or rating class.

NMFTA currently proves only the existence of the Classification_Codes schema family.

### Transport-service priority semantics

UNECE transport standards define Transport Service Priority Code as a code specifying the priority of a transport service.

UNECE Transport Service Requirements structures separate:
- contract/carriage conditions;
- service requirement;
- transport priority;
- nature-of-cargo classification.

This establishes transport priority as a controlled service semantic, distinct from:
- actual pickup/delivery timestamps;
- appointment dates;
- service deadlines;
- document issue/revision times.

Important boundary:
NMFTA Time_Critical_Types may be related to service-level priority, but exact equivalence/placement is not yet verified.

## Domain facts

DF-ITEM-TYPE-CLASSIFICATION:
Consignment-item Type Code / Type Extension Code are item-owned classification semantics.

DF-CLASSIFICATION-NOT-YET-NMFC:
Current evidence does not justify equating item type/classification semantics or NMFTA Classification_Codes with NMFC/freight class.

DF-TRANSPORT-PRIORITY-SERVICE-SEMANTIC:
Transport priority is a controlled TransportService semantic.

DF-TIME-CRITICAL-NOT-TIMESTAMP:
A time-critical/service-priority code is not inherently a TemporalValue; actual timestamp/deadline semantics require separate evidence.

## Primitive mapping

Classification:
- Commodity / Consignment Item
- Controlled Vocabulary
- Identifier where classification scheme identifiers exist
- Relationship

Priority:
- TransportService
- Controlled Vocabulary
- TemporalValue only if future evidence links an actual time/deadline
- Relationship

## Rule-family composition

Item classification:
- RF5 Controlled-Value Validation
- RF2 Relationship Integrity
- RF9 Source Authority
- RF11 Client Specialization where client/carrier mappings apply

Transport priority:
- RF5 Controlled-Value Validation
- RF2 Relationship Integrity
- RF7 Conditional Activation if service priority activates requirements
- RF11 Client Specialization

RF18 Temporal & Version Semantics is NOT automatically invoked merely because a service is time-critical.

## Generated instances

GI-ITEM-TYPE-CLASSIFY:
validate Consignment Item Type / Type Extension while preserving item ownership.

GI-TRANSPORT-PRIORITY:
validate transport-service priority as a controlled service attribute.

## Cross-family relationships

Consignment Item role/ownership
PRECEDES
classification-code validation.

TransportService object resolution
PRECEDES
priority-code validation.

Time-critical code
MAY_ACTIVATE
temporal/service requirements only when explicit evidence links them.

## Normalization result

New primitive required: 0.
New reusable family required: 0.

The key outcome is semantic separation:
item classification != NMFC by assumption;
service priority != timestamp by assumption.
