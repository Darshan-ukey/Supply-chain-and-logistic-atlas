# LTL-03 Graph-First Research — In-Transit Cross-Border Customs State Semantics v0.1

Status: RESEARCH CHECKPOINT — TWO-TRACK CONTINUOUS RECONCILIATION
Date: 2026-09-20
Task: ATL-35 / LTL-03
Prior graph checkpoint: c96b572027e0f8cf49bf401a9e0dc5dba9448f75 (433 nodes / 2,250 typed edges / 130 generated instances / 11 reusable patterns)

## Track A — authoritative execution-knowledge discovery

Primary authority: NMFTA/DSDC In-Transit Visibility API Standard issuer page and DSDC API Standards catalogue.

Source-backed findings:
1. The LTL In-Transit Visibility standard includes cross-border capabilities and customs status updates where applicable.
2. Representative cross-border states include In Bond, Hold, and Cleared Customs.
3. Customs Information Updated is represented as Delivery Information / non-movement operational information, not a physical shipment-movement milestone.
4. A customs-state update can therefore coexist with an unchanged physical movement state; Atlas must preserve those dimensions independently.
5. Cross-border/customs semantics are conditional. They must not activate for every LTL shipment merely because the standard supports them.
6. The issuer material establishes the existence and representative vocabulary of these states, but does not support Atlas inventing jurisdiction-specific customs release rules, document sufficiency rules, brokerage logic, or regulatory clearance decisions.
7. Cleared Customs is a source-reported lifecycle/state value; Atlas must not infer legal admissibility, duty settlement, or permission for final delivery beyond what the authoritative source explicitly establishes.

## Track B — continuous normalization/materialization

Reuse:
- conditional-contract pattern;
- event-lifecycle pattern;
- state, event, controlled-vocabulary, location, relationship and evidence/provenance primitives;
- lifecycle/state, controlled-value, conditional-activation and source-authority rule families.

Generated-instance candidates:
- activate customs/cross-border contract only when authoritative shipment/source evidence indicates applicability;
- represent In Bond / Hold / Cleared Customs as source-governed customs state separately from physical movement milestone;
- route Customs Information Updated as a non-movement information event linked to the customs-state lifecycle;
- prohibit downstream legal/financial clearance inference from a status label alone.

Client-binding / knowledge dependencies:
- client/carrier source system and field mapping for customs-state evidence;
- jurisdiction/broker/client-specific customs decision rules remain outside reusable LTL truth unless separately sourced from the appropriate authority.

## Guardrails

- Customs Information Updated is not a movement milestone.
- Cross-border support does not imply every shipment is cross-border.
- Cleared Customs must not be expanded into unsourced legal, tax, duty, brokerage, or delivery authorization conclusions.
- In Bond / Hold / Cleared Customs retain source and temporal provenance.
- Jurisdiction-specific regulatory logic requires separate authoritative evidence.
- Missing customs evidence remains unresolved; do not infer from geography alone.

No new semantic primitive, rule family or reusable pattern is required.
LTL-03 remains NOT FROZEN.
