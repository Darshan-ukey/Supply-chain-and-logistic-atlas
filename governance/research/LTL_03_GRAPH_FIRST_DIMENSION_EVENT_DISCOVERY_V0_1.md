# LTL-03 Graph-First Discovery — Dimension & Pickup/In-Transit Event Semantics v0.1

Date: 2026-09-20
Workstream: ATL-35
Status: RESEARCH CANDIDATE — GRAPH-FIRST INTAKE

## Track A — authoritative evidence

### A. Dimension semantics

UN/CEFACT vocabulary and D23B transport/supply-chain models distinguish:
- linear dimensions associated with Consignment Item, Package, Packaging, Product and Transport Equipment;
- gross volume as a separate measure;
- gross volume commonly defined as the result of maximum length × width × height;
- loading length as a distinct consignment-level measure;
- chargeable weight as a distinct consignment-level measure.

This establishes that:
- Length / Width / Height are axis-specific linear measures owned by an object;
- Gross Volume is not semantically identical to the individual dimensions;
- Loading Length is not the same as item/package length;
- Chargeable Weight is not the same as gross weight.

### Domain facts

DF-DIMENSION-AXIS-SEMANTICS:
Linear dimensions are object-owned axis measures and must preserve axis role and semantic owner.

DF-VOLUME-DISTINCT-FROM-DIMENSION:
Gross volume is a separate measure and may be derived from dimensions, but must not overwrite or replace source dimensions.

DF-LOADING-LENGTH-DISTINCT:
Loading length is a transport-use measure distinct from ordinary object length.

DF-CHARGEABLE-WEIGHT-DISTINCT:
Chargeable weight is a rating semantic distinct from declared/gross physical weight.

### Primitive mapping

Existing:
- Measure
- Relationship
- Package
- Commodity/Consignment Item
- TransportEquipment
- Evidence/Provenance

No new primitive is required yet.

Represent dimensions as Measure instances parameterized by:
- measureType = LENGTH | WIDTH | HEIGHT;
- semanticOwner;
- unit;
- source;
- confidence.

### Family composition

- RF13 Measure Semantics
- RF2 Relationship Integrity
- RF9 Source Authority & Precedence
- RF12 Aggregate/Reconciliation where derived volume or chargeable measures reconcile to inputs
- RF14 Hierarchy where package/equipment nesting determines owner
- RF11 Client Specialization for rating/tolerance logic

### Generated instances

GI-DIMENSION-OWNER:
resolve semantic owner before dimension validation.

GI-DIMENSION-AXIS:
validate axis role, numeric value and unit.

GI-VOLUME-DIMENSION-RELATION:
preserve gross volume separately; derive/reconcile only when governed evidence permits.

GI-CHARGEABLE-WEIGHT:
preserve chargeable weight as a distinct semantic from gross/declared/verified/billing weight.

## B. Pickup visibility events

NMFTA Pickup Request & Visibility standard defines pickup lifecycle/status semantics including:
- Pickup Accepted;
- Driver Assigned / En Route;
- ETA / Stops Away;
- Driver Arrived;
- Departed Location;
- pickup number returned;
- PRO may be returned/used for tracking;
- reschedule/cancel paths with reason information.

Pickup visibility is keyed primarily by Pickup Number, with PRO used as an additional shipment reference where applicable.

### Domain facts

DF-PICKUP-EVENT-MODEL:
Pickup is a sequence of operational events/states, not a single status string.

DF-PICKUP-ID-TRACKING:
Pickup Number is the primary pickup-visibility identifier; PRO can participate in tracking/association.

DF-PICKUP-EXCEPTION-PATH:
Reschedule/cancel/reject outcomes carry explicit reason semantics and do not represent normal forward progression.

DF-PICKUP-TEMPORAL:
Pickup events may carry ETA / timing semantics and therefore compose Event with TemporalValue.

### Primitive mapping

- Event
- State
- TemporalValue
- Identifier / Reference
- Relationship
- Location
- TransportEquipment
- Controlled Vocabulary

### Family composition

- RF3 Lifecycle & State Transition
- RF18 Temporal & Version Semantics
- RF1 Identity & Reference Resolution
- RF2 Relationship Integrity
- RF5 Controlled-Value Validation
- RF8 Error & Exception Semantics
- RF9 Source Authority
- RF11 Client Specialization

## C. In-transit visibility events

NMFTA/DSDC In-Transit Visibility standard defines milestone vocabulary including:
- Picked-up;
- Arrived at Terminal;
- Unloaded at Terminal;
- Loaded at Terminal;
- Departed Terminal;
- In Transit;
- Interline;
- Out for Delivery;
- Delivered.

It also distinguishes:
- physical movement updates;
- delivery-information/non-movement notifications;
- common exception notifications such as late, damage, short/lost, reweigh, accessorial added, reconsignment, appointment changes, missed delivery and customs updates;
- updated ETA / estimated transit days / stops remaining.

### Domain facts

DF-INTRANSIT-MILESTONE-VOCAB:
In-transit visibility uses governed shipment milestone events/states.

DF-MOVEMENT-VS-INFORMATION-EVENT:
Physical-movement events and information/exception events are distinct event categories.

DF-INTRANSIT-EXCEPTION-RELATION:
Exception notifications attach to the shipment lifecycle without replacing the core milestone state model.

DF-EVENT-ESTIMATED-VS-ACTUAL:
Transport event models distinguish estimated, scheduled and actual occurrence times.

### Family composition

- RF3 lifecycle/state
- RF18 temporal semantics
- RF5 controlled milestone/reason values
- RF8 exception semantics
- RF2 shipment/event/location relationships
- RF9 source authority
- RF11 client/runtime specialization

## Cross-family relationship consequence

The same event model now connects:
Pickup lifecycle
-> possession transition
-> in-transit milestone progression
-> exception events
-> change events (reweigh/reclass/accessorial)
-> charge/reconciliation logic where monetary impact exists.

Atlas should therefore model these as an event graph with typed edges, not as unrelated status fields.

## Normalization result

New primitive required: 0.
New reusable family required: 0.

Existing Event / State / TemporalValue / Identifier / Measure / Relationship primitives and RF1/RF2/RF3/RF5/RF8/RF9/RF12/RF13/RF18/RF11 compose the behavior.
