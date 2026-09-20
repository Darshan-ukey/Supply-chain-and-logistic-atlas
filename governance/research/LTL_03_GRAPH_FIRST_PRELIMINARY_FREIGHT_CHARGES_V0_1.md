# LTL-03 Graph-First Research — Preliminary Freight Charges v0.1

Status: RESEARCH CHECKPOINT — CONTINUOUS RECONCILIATION
Date: 2026-09-20
Task: ATL-35 / LTL-03
Prior graph checkpoint: abf3ca99787617c14ff4c2ba247f675fe7ebf586 (359 nodes / 1,769 typed edges / 104 generated instances / 11 reusable patterns)

## Authoritative issuer evidence

Primary issuer sources:
- NMFTA/DSDC API Standards catalogue — Preliminary Freight Charges Version 1.0.0: https://dsdc.nmfta.org/apis
- NMFTA/DSDC Preliminary Freight Charges API Standard page: https://dsdc.nmfta.org/apis/preliminary-freight-charges-api-standard
- NMFTA release announcement: https://nmfta.org/news/nmfta-digital-ltl-council-launches-preliminary-freight-charges-api-standard-advancing-industry-wide-billing-transparency/

Authority: NMFTA/DSDC issuer material.
Release state: PFC Version 1.0.0 is listed as an LTL API Standard; the Digital LTL Council page and 2026 roadmap identify PFC as released/available.

## Findings

1. PFC is a proactive notification/visibility contract for freight-charge changes before final invoicing. It is not itself the final invoice semantic.

2. The current issuer page states that tracking begins once the shipment is in carrier possession and rated. Therefore preliminary-charge visibility is lifecycle-scoped; it must not be projected before its governed activation conditions.

3. Reweigh and reclassification are explicit preliminary-freight-charge change categories. Atlas must preserve the underlying operational/classification change as distinct from its monetary consequence.

4. Accessorial additions and removals are explicit charge-change categories. Addition/removal is a semantic change event; an accessorial label alone must not be treated as an immutable charge.

5. Changes in shipper, consignee, bill-to, or terms are identified as PFC-relevant changes. Party role and commercial/billing terms must therefore remain distinct from monetary amount while retaining their relationship to the charge-change event.

6. Storage, detention, redelivery, and other fees are explicit charge categories. These remain controlled charge semantics rather than generic free-text monetary adjustments.

7. The issuer exposes controlled event codes, including examples RWE, RCL, LFTP and APTD. Event code is representation/controlled vocabulary for the event and must not replace the canonical event/charge semantics.

8. The API's business purpose includes early discrepancy handling, payment accuracy and cost accrual. These are outcomes/use cases; they do not authorize Atlas to infer a correction, liability, payer, or final amount absent source evidence.

## Graph interpretation

Reuse existing Atlas semantics:
- RPAT-LTL-CHANGE-EVENT for reweigh, reclassification, accessorial and other charge-affecting changes.
- RPAT-LTL-MONETARY-CHARGE for monetary amount, charge category and payer relationships.
- RPAT-LTL-ROLE-BEFORE-MASTER for shipper/consignee/bill-to role semantics.
- RPAT-LTL-CONDITIONAL-CONTRACT for lifecycle activation.
- Existing RF3/RF5/RF7/RF9/RF11/RF12/RF13/RF17/RF18 as applicable.

No new semantic primitive, rule family, or reusable execution pattern is required.

## Execution guardrails

- Do not collapse operational change and monetary consequence into one semantic.
- Do not infer that every reweigh, reclassification, accessorial, appointment or party change necessarily creates a non-zero charge.
- Do not treat preliminary freight charges as a final invoice.
- Do not infer payer/liability from the presence of a charge event.
- Preserve event-code provenance and map controlled codes to canonical semantics.
- Activate PFC processing only after governed lifecycle prerequisites are satisfied.
- Preserve add/remove direction for accessorial changes.
- Keep party-role/terms changes distinct from monetary amount.

## Research boundary

This pass uses issuer-level public material for Version 1.0.0 semantics. It does not claim the complete downloadable PFC YAML property tree, field cardinalities, or every accepted event code. Property-level generation remains source-bound where the public issuer pages do not expose those details.

## Reconciliation disposition

Expected graph additions:
- 1 evidence node
- 6 domain-fact nodes
- 5 generated rule instances
- no new primitive
- no new rule family
- no new reusable pattern

Research continues after this checkpoint; LTL-03 remains NOT FROZEN and ATL-37 remains downstream of the ATL-35 freeze candidate.
