# LTL-03 Graph-First Discovery — Custody / Terminal / Interline / Delivery Semantics v0.1

Date: 2026-09-20
Workstream: ATL-35
Status: RESEARCH CANDIDATE — GRAPH-FIRST INTAKE

## Track A — authoritative evidence

### Carrier acceptance / possession

UN/CEFACT D23B models:
- Carrier Acceptance Location as the location where a consignment will be or has been accepted by the carrier;
- Carrier Acceptance Date Time as the time when the consignment will be or has been accepted by the carrier.

NMFTA In-Transit Visibility states that in-transit visibility begins when a carrier acknowledges physical custody/possession of the shipment and required documentation is executed.

This establishes a reusable possession-transition semantic:
pre-carrier-custody
-> carrier acceptance / possession
-> in-transit lifecycle.

### Terminal and interline

NMFTA In-Transit Visibility standard defines milestones including:
- Arrived at Terminal;
- Unloaded at Terminal;
- Loaded at Terminal;
- Departed Terminal;
- Interline.

NMFTA also states that interline handoffs may identify the partner carrier and SCAC where available.

UN/CEFACT location-role semantics distinguish acceptance, loading, discharge, transhipment and transfer-responsibility locations.

This establishes:
- terminal milestone events are location-bound lifecycle events;
- interline is not merely a status string; it is a carrier/relationship handoff;
- transfer-of-responsibility location is a distinct semantic from ordinary terminal location.

### Delivery

UN/CEFACT D23B models Supply Chain Consignment -> Delivery Event 0..1.
Delivery Event includes:
- Estimated Occurrence Date Time;
- Actual Occurrence Date Time;
- Occurrence Location 0..n;
- Occurrence Period 0..n.

NMFTA In-Transit Visibility ends when carrier delivery is completed and receiver acknowledges receipt.

This establishes delivery as:
event + state transition + actual/estimated time + occurrence location + receiving acknowledgement context.

## Domain facts

DF-CARRIER-ACCEPTANCE-POSSESSION:
Carrier acceptance time/location marks a possession/custody transition into carrier control.

DF-TERMINAL-MILESTONE-LOCATION:
Terminal arrival/load/unload/departure milestones are bound to event/location semantics.

DF-INTERLINE-HANDOFF:
Interline represents a handoff relationship to another carrier and may include partner carrier identity/SCAC.

DF-TRANSFER-RESPONSIBILITY-LOCATION:
Transfer-of-responsibility location is semantically distinct from generic terminal, loading or discharge location.

DF-DELIVERY-EVENT:
Delivery is a distinct consignment event with estimated/actual occurrence time and occurrence location.

DF-DELIVERY-RECEIPT-ACK:
Shipment lifecycle completion includes receiver acknowledgement/receipt semantics.

## Primitive mapping

Existing:
- Event
- State
- TemporalValue
- Location
- Party
- Identifier / Reference
- Relationship
- Document / Evidence where acknowledgement/signature is captured

No new primitive required.

## Rule-family composition

- RF3 Lifecycle & State Transition
- RF18 Temporal & Version Semantics
- RF2 Relationship Integrity
- RF1 Identity & Reference Resolution
- RF5 Controlled-Value Validation
- RF6 Master/Reference Reconciliation for partner carrier/location identity
- RF9 Source Authority
- RF8 Error & Exception Semantics
- RF11 Client Specialization

## Candidate reusable execution pattern — Custody Handoff

RPAT-LTL-CUSTODY-HANDOFF

Pattern:
current custodian / lifecycle state
-> handoff event
-> handoff time
-> handoff location
-> receiving party/carrier identity
-> responsibility/possession transition
-> resulting lifecycle state
-> evidence/acknowledgement.

Applicable examples:
- shipper -> carrier pickup possession;
- terminal/interline partner transfer;
- carrier -> receiver delivery.

Families:
RF3 + RF18 + RF2 + RF1 + RF6 + RF9 + RF8.

## Generated instances

GI-CARRIER-ACCEPTANCE:
record carrier acceptance possession transition with time/location.

GI-TERMINAL-MILESTONE:
record terminal arrival/load/unload/depart events with terminal/location identity.

GI-INTERLINE-HANDOFF:
resolve partner carrier identity/SCAC and record interline possession/responsibility handoff.

GI-DELIVERY-COMPLETE:
record delivery event with estimated/actual time, location and receipt acknowledgement context.

## Cross-family relationships

Carrier acceptance
PRECEDES
in-transit lifecycle.

Terminal milestone
DEPENDS_ON
event location semantics.

Interline handoff
DEPENDS_ON
partner carrier identity and current custody state.

Delivery completion
DEPENDS_ON
delivery event + actual/estimated temporal role + occurrence location.

Receiver acknowledgement
CONSTRAINS
whether delivery lifecycle can be treated as completed where the applicable standard requires acknowledgement.

## Normalization result

New primitive required: 0.
New reusable rule family required: 0.
New reusable execution pattern candidate: RPAT-LTL-CUSTODY-HANDOFF.
