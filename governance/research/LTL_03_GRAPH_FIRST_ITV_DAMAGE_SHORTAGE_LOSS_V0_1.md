# LTL-03 Graph-First Research — In-Transit Damage, Shortage and Loss Exception Semantics v0.1

Status: RESEARCH CHECKPOINT — TWO-TRACK CONTINUOUS RECONCILIATION
Date: 2026-09-20
Task: ATL-35 / LTL-03
Prior graph checkpoint: 096d78bc924e6d945fde55fea5cfab6a568a42ea (443 nodes / 2,311 typed edges / 134 generated instances / 11 reusable patterns)

## Track A — authoritative execution-knowledge discovery

Primary authority: NMFTA/DSDC In-Transit Visibility API Standard issuer material.

Source-backed findings:
1. The issuer's standardized exception vocabulary includes damage and shortage/loss conditions as visibility exceptions.
2. These are exception observations attached to the shipment lifecycle. They do not, by themselves, replace the current physical movement milestone.
3. Damage and shortage/loss are semantically different exception types and must not be collapsed into one generic "problem" state.
4. An exception observation does not by itself establish claim acceptance, carrier liability, financial responsibility, recoverable amount, disposition, salvage, or final loss.
5. Responsible-party/reason coding, where supplied through the visibility standard, is normalized operational attribution and must not be expanded into legal liability.
6. Quantity/measure evidence associated with shortage/loss or damage must retain semantic ownership and source provenance; Atlas must not manufacture affected quantity, weight, package count or monetary impact when absent.
7. Client/carrier operational response — notification, hold, inspection, exception queue, claims handoff or other action — remains a client/carrier policy unless separately governed by authoritative evidence.

## Track B — continuous normalization/materialization

Reuse:
- GI-102 normalized exception reason/responsible-party mapping;
- GI-116 delivery exception normalization;
- event-lifecycle and change-event patterns;
- event, state, measure, package, party, controlled-vocabulary, relationship and evidence/provenance primitives;
- lifecycle, controlled-value, exception, source-authority and measure-semantics rule families.

Generated-instance candidates:
- preserve damage as a typed exception event linked to shipment lifecycle without inferring liability or claim outcome;
- preserve shortage/loss as a typed exception event and retain any evidenced affected measure/package relationship separately;
- keep operational attribution separate from legal/financial responsibility;
- route client-specific response only after policy binding rather than deriving action from the exception label alone.

Client-binding requirements:
- carrier/client damage-shortage escalation, inspection, hold, claims-handoff and notification policy;
- mapping of local exception codes and affected-quantity fields where present.

## Guardrails

- Damage != shortage/loss.
- Exception event != shipment movement state.
- Responsible-party code != legal liability.
- Damage/shortage observation != accepted claim.
- Do not infer affected quantity, package count, weight or amount when absent.
- Do not infer final loss from an interim shortage/loss visibility event.
- Client response action requires client/carrier policy binding.

No new semantic primitive, rule family or reusable pattern is required.
LTL-03 remains NOT FROZEN.
