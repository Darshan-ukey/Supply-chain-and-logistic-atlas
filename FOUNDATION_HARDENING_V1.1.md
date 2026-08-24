# Foundation Hardening v1.1

## Objective

Prepare the platform for Road FTL, Ocean, Air and the remaining Page-0 destinations **without rebuilding or destabilizing the existing Road-LTL product**.

## Non-negotiable invariants

The following assets were not modified:

- frozen Page 0 V6.2.2 source HTML;
- integrated Page 0 + Road LTL V1.2 source HTML;
- machine-readable Page 0 V6.2.2 JSON;
- machine-readable Road LTL V1.2 JSON.

All hardening is additive or wraps those assets through stricter registries, contracts, sidecars and generic runtime services.

## Closed platform gaps

1. Unified source/version/change/coverage/gap governance.
2. Strong A5 publication contract (`atlas-data-contract-v1.1`).
3. Complete declared relationship vocabulary for current LTL plus future namespaces.
4. Cross-module canonical process-concept alignment.
5. Registry-driven Ask Atlas retrieval and command validation.
6. Registry-driven document-domain mapping.
7. Fail-closed module validation/publication gate.
8. Generic rule/overlay runtime registration.
9. Claim-level provenance sidecar with effective-date fields.
10. Execution-instance / leg contract.
11. Typed document/legal-state contract.
12. Structured temporal-constraint contract and conservative LTL migration sidecar.
13. KPI/measurement contract.
14. System exchange/interface contract and conservative LTL migration sidecar.
15. Full 71-destination coverage registry.
16. Full-universe synthetic scale regression.

## Deliberately not rewritten

- Road LTL process IDs, labels, execution content, sources or relationships.
- Page-0 canonical domains, objects, systems or relationships.
- Existing UI/canvas semantics.
- Existing client privacy or transformation epistemic boundaries.

## Remaining research/content work — not architecture defects

- Full source-native concept extraction and outside-in disposition for each relevant framework/standard.
- Issuer-level assessment of open source candidates before adding them to canonical Page 0.
- FTL A5 content population and its process-concept crosswalk.
- Ocean/Air use of the new leg/document/time/exchange contracts as those modules are populated.
- Live LLM provider certification and deployed Vercel E2E when the candidate is deployed.

## Publication principle

A new module may be published only when:

`ingest → normalize → A5 validate → relationship validate → source/evidence validate → applicability validate → cross-module alignment validate → regression → admin approval → ACTIVE`

Any failure leaves production knowledge unchanged.
