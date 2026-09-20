# LTL-03 Graph-First Research — In-Transit Delivery Planning and Exception Semantics v0.1

Status: RESEARCH CHECKPOINT — TWO-TRACK CONTINUOUS RECONCILIATION
Date: 2026-09-20
Task: ATL-35 / LTL-03
Prior graph checkpoint: 222f87d9c4c85f7b94a3d91e9c002832b3b40c90 (387 nodes / 1,973 typed edges / 114 generated instances / 11 reusable patterns)

## Track A — authoritative execution-knowledge discovery

Primary authority: NMFTA/DSDC In-Transit Visibility API Standard issuer page.

Source-backed findings:
1. The standard defines common milestone vocabulary including Picked-up, Arrived at Terminal, Unloaded at Terminal, Loaded at Terminal, Departed Terminal, In Transit, Interline, Out for Delivery and Delivered.
2. Updated delivery estimates, estimated days in transit and remaining-stop counts are planning/visibility values associated with shipment progress; they are not equivalent to a delivered state.
3. Exception vocabulary includes anticipated late delivery, damage, shortage/loss, reweigh, accessorial added, reconsignment, appointment scheduled/missed/rescheduled, missed delivery and customs information updated.
4. Normalized reason codes identify the general cause and responsible party while carriers may map internal codes underneath the shared standard.
5. Delivery completion and proof-of-delivery availability are separate semantics: the visibility lifecycle ends when delivery occurs and the receiver acknowledges receipt; POD availability is an associated document-availability condition.
6. Delivery Update notifications represent physical movement/milestone changes, while Delivery Information notifications cover non-movement operational information. This distinction remains a governing classification for delivery-planning events.

## Track B — normalization/materialization

Reuse:
- RPAT-LTL-EVENT-LIFECYCLE
- RPAT-LTL-CHANGE-EVENT
- RPAT-LTL-CUSTODY-HANDOFF
- existing temporal, event, state, location, party, document, indicator, controlled-vocabulary and relationship primitives.

New generated-instance candidates:
- preserve delivery estimate / days-in-transit / stop-count as planning values without inferring delivery;
- normalize delivery exceptions while retaining carrier-code provenance;
- preserve appointment lifecycle mutation separately from movement milestone;
- distinguish delivery completion/receiver acknowledgement from POD availability.

Client-binding dependencies:
- carrier/client ETA calculation and confidence policy;
- carrier/client exception escalation/action policy;
- appointment operational policy where client-specific;
- POD retrieval/retention/validation policy beyond industry availability semantics.

Projection remains generic and technology-neutral to governed runtime targets; client-specific behavior remains unresolved until binding evidence exists.

## Guardrails

- ETA, days-in-transit or stop-count must not be interpreted as delivery confirmation.
- Missed/rescheduled appointment is not a physical-movement milestone.
- Standard reason/responsibility code does not authorize Atlas to infer financial/legal liability.
- Delivered state, receiver acknowledgement and POD document availability must not be collapsed.
- Carrier-specific internal reason codes retain provenance beneath normalized vocabulary.
- Client-specific escalation thresholds/actions must not be promoted to reusable LTL truth.

No new semantic primitive, rule family or reusable pattern is required.

LTL-03 remains NOT FROZEN.
