# LTL-03 Graph-First Discovery — Change Event / Charge / Reconciliation Relationship v0.1

Date: 2026-09-20
Workstream: ATL-35
Status: RESEARCH CANDIDATE — GRAPH-FIRST INTAKE

## Source

NMFTA Digital LTL Council 2024 preliminary-freight-charge design states that:
- rated charges can be communicated after pickup;
- push notifications are triggered by predetermined events;
- some events have positive/negative charges and some do not;
- changes around weight, class, dimensions, accessorials and related items are detailed by date;
- updated rated freight charges are included;
- the last received rated charges should reconcile to the invoice.

## Domain facts

DF-CHANGE-EVENT-DATED:
Operational/rating changes are represented as dated events rather than silent field overwrites.

DF-CHANGE-EVENT-MAY-HAVE-CHARGE:
A change event may or may not carry a monetary impact.

DF-CHANGE-EVENT-CROSS-SEMANTIC:
The same event model can describe changes in weight, classification, dimensions, accessorials and other rating-relevant semantics.

DF-RATED-CHARGE-RECONCILES-INVOICE:
Latest rated charge state is expected to reconcile with the eventual invoice.

## Primitive mapping

- Event
- TemporalValue
- Measure
- Commodity/Consignment Item classification semantics
- TransportService / accessorial
- MonetaryAmount
- Relationship
- Evidence / Provenance
- Document / Invoice relationship where applicable

## Rule-family composition

- RF3 Lifecycle & State Transition
- RF18 Temporal & Version Semantics
- RF13 Measure Semantics
- RF5 Controlled-Value Validation
- RF17 Monetary Amount / Charge Semantics
- RF2 Relationship Integrity
- RF9 Source Authority & Precedence
- RF12 Aggregate/Reconciliation semantics where charge totals are reconciled
- RF11 Client Specialization where tariff/client rules determine charge interpretation

## Generated instance

GI-CHANGE-EVENT-RATED-CHARGE:
For each governed change event:
1. identify the changed semantic attribute;
2. preserve prior and new value where available;
3. timestamp/date the change event;
4. preserve change reason/type;
5. determine whether monetary impact exists;
6. attach updated rated charge where supplied;
7. preserve source authority and evidence;
8. reconcile latest rated-charge state against invoice when invoice becomes authoritative/available.

## Cross-family relationships

Event semantics
PRECEDES
value/source-authority update.

RF18 temporal semantics
CONSTRAINS
event ordering.

RF13 / RF5 / RF17
COMPOSE_WITH
depending on whether the changed semantic is measure, controlled classification/accessorial, or monetary charge.

RF9
CONSTRAINS
which value becomes current/canonical for the relevant lifecycle stage.

Latest rated-charge state
PRECEDES / RESOLVES_WITH
invoice reconciliation.

## Key architectural consequence

Atlas should not model reweigh, reclass, accessorial addition and similar changes as isolated field corrections.

They are better represented as:
Event
-> changed semantic
-> old/new value
-> time
-> reason
-> monetary impact
-> resulting rated state
-> invoice reconciliation.

This provides a reusable change-event pattern across multiple rule families without requiring a separate bespoke family for every change type.

## Scope

BROADER_BOL_UNIVERSE / rating and billing-adjacent execution semantics.
Not automatically LTL-03 core.

## Normalization result

New primitive required: 0.
New reusable family required: 0.

Existing Event + TemporalValue + MonetaryAmount + Measure + TransportService/Controlled Vocabulary primitives and RF3/RF18/RF13/RF5/RF17/RF2/RF9/RF12/RF11 compose the behavior.
