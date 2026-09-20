# LTL-03 Graph-First Research — Pickup Request and Visibility v1.0.0

Status: RESEARCH CHECKPOINT — CONTINUOUS RECONCILIATION
Date: 2026-09-20
Task: ATL-35 / LTL-03
Prior graph checkpoint: b5903891b20f787d77b57a255e1741c6758ef8b9 (371 nodes / 1,872 typed edges / 109 generated instances / 11 reusable patterns)

## Authoritative issuer evidence

Primary issuer sources:
- NMFTA/DSDC API Standards catalogue — Pickup Request and Visibility Version 1.0.0
- NMFTA/DSDC Pickup Request and Visibility API Standard issuer page

Authority: NMFTA/DSDC issuer material.

## Findings

1. Pickup Request and Visibility is a pre-possession lifecycle contract for digitally scheduling pickups and tracking pickup status. It precedes the In-Transit Visibility boundary, which begins when the carrier acknowledges physical possession.

2. The standard explicitly supports pickup initiation, request update/reschedule, cancellation, pickup-status tracking, delay information and updated arrival times. These are lifecycle mutations/events, not free-text notes.

3. Dock readiness and shipment readiness are distinct operational conditions. Readiness must therefore be represented as governed state/indicator semantics and must not be inferred from the mere existence of a pickup request.

4. Equipment needs, including examples such as liftgate requirements, are planning constraints attached to the pickup/shipment context. Equipment requirement must remain distinct from equipment actually assigned or supplied.

5. Pickup delays carry reason and updated-arrival information. Delay reason, revised estimate and pickup lifecycle state are separate semantics and should not be silently collapsed.

6. Carrier/shipper/3PL/technology-provider collaboration establishes party-role relationships around a pickup request; role semantics remain distinct from master identity.

7. The issuer catalogue distinguishes scheduling, status visibility, update/reschedule and cancellation. Atlas must preserve mutation intent and lifecycle transition rather than treating successive payloads as silent overwrite.

## Graph interpretation

Reuse existing Atlas semantics:
- RPAT-LTL-EVENT-LIFECYCLE
- RPAT-LTL-CHANGE-EVENT
- RPAT-LTL-CONDITIONAL-CONTRACT
- RPAT-LTL-ROLE-BEFORE-MASTER
- RPAT-LTL-IDENTITY-BEFORE-MUTATION

No new semantic primitive, rule family, or reusable execution pattern is required.

## Execution guardrails

- Do not infer pickup completion from request creation or confirmation.
- Do not infer physical possession from pickup scheduling/status alone.
- Do not infer dock/shipment readiness unless source evidence supplies the state.
- Do not equate requested equipment with assigned/provided equipment.
- Preserve create/update/reschedule/cancel intent and event chronology.
- Preserve delay reason separately from revised ETA.
- Hand off to in-transit semantics only when carrier possession is evidenced.

## Research boundary

Issuer public pages support lifecycle/function semantics but do not expose the complete downloadable YAML property tree, all field cardinalities, or all accepted controlled values in the retrieved research channel. Property-level generation remains source-bound.

## Reconciliation disposition

Expected graph additions:
- 1 evidence node
- 6 domain-fact nodes
- 5 generated rule instances
- no new primitive
- no new rule family
- no new reusable pattern

Research continues after this checkpoint; LTL-03 remains NOT FROZEN and ATL-37 remains downstream of the ATL-35 freeze candidate.
