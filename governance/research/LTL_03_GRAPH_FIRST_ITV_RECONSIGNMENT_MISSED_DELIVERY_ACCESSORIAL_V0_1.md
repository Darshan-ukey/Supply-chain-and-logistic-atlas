# LTL-03 Graph-First Research — Reconsignment, Missed Delivery and Accessorial-Added Semantics v0.1

Status: RESEARCH CHECKPOINT — TWO-TRACK CONTINUOUS RECONCILIATION
Date: 2026-09-20
Task: ATL-35 / LTL-03
Prior graph checkpoint: 51077ac0d4f4dcde1bd89366a5c6684cc0a3a468 (452 nodes / 2,387 typed edges / 138 generated instances / 11 reusable patterns)

## Track A — authoritative execution-knowledge discovery

Primary authority: NMFTA/DSDC In-Transit Visibility API Standard issuer material.

Source-backed findings:
1. The standardized Delivery Information / exception vocabulary includes reconsignment, missed delivery and accessorial-added conditions alongside appointment and other operational updates.
2. Reconsignment is a shipment-context change event. The existence of a reconsignment event does not itself identify which party, address, route, destination or billing term changed unless the source payload provides that evidence.
3. Missed delivery is an operational exception/event and must remain distinct from delivered state, appointment-missed state and any later redelivery event or fee.
4. Accessorial Added is an operational/service-change event. It does not by itself establish a monetary charge, amount, payer, liability or invoice outcome.
5. Preliminary Freight Charges independently supports accessorial additions/removals as charge-relevant changes. Atlas must therefore preserve the operational accessorial event separately from any preliminary monetary consequence and link them only when evidence supports the relationship.
6. A missed-delivery event may precede redelivery activity or a redelivery fee, but neither redelivery nor a fee may be inferred solely from missed delivery.
7. Client/carrier rules determine operational response, routing, approval, customer notification, reconsignment handling and any fee applicability unless separately established by authoritative evidence.

## Track B — continuous normalization/materialization

Reuse:
- GI-107 accessorial add/remove monetary separation;
- GI-117 appointment lifecycle;
- event-lifecycle, change-event, monetary-charge and conditional-contract patterns;
- event, state, party, location, controlled-vocabulary, monetary-amount, relationship and evidence/provenance primitives;
- lifecycle, exception, controlled-value, monetary and client-specialization families.

Generated-instance candidates:
- represent reconsignment as a typed context-change event and update only source-evidenced roles/locations/references;
- represent missed delivery as a typed exception separate from delivered, appointment-missed, redelivery and charge state;
- represent Accessorial Added as an operational service-change event and link monetary impact only when separately evidenced;
- prevent automatic derivation of redelivery action/fee from missed delivery.

Client-binding requirement:
- carrier/client reconsignment approval/routing, missed-delivery response, redelivery decision and accessorial charge/action policy.

## Guardrails

- Reconsignment event != inferred destination/address/party change without source fields.
- Missed delivery != delivered.
- Missed delivery != appointment missed.
- Missed delivery != automatic redelivery.
- Missed delivery != automatic redelivery fee.
- Accessorial Added != monetary charge unless amount/charge evidence exists.
- Operational service change and monetary consequence remain separate semantics.

No new semantic primitive, rule family or reusable pattern is required.
LTL-03 remains NOT FROZEN.
