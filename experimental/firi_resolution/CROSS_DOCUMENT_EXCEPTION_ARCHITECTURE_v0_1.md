# Cross-document commodity intelligence — experimental architecture v0.1

**Status:** Proposed extension / not a canonical Atlas promotion. BOL-002 is first proof, not the engine boundary.

## Shared object and provenance model
- CommodityIdentityCandidate (not automatically a legally established commodity)
- DocumentLine / SourceSpan / PageRegion / OCRToken
- HandlingUnit / Package / Quantity / GrossWeight / NetWeight
- ClassificationReference (NMFC, HS/HTS, other jurisdiction-specific authority; never interchangeable)
- DocumentAssertion (observed wording, source, document type, date, authority, confidence)
- AssociationEdge (commodity-to-package, commodity-to-weight, commodity-to-classification, cross-document identity link) with cited source IDs and conflict state
- ResolutionDecision (supported, contradicted, ambiguous, insufficient evidence), next required evidence and audit trace

## Document adapters, not shared field equivalence
| Document | Commodity evidence | Cautions |
|---|---|---|
| BOL | goods/commodity description, NMFC, class, packages, weight | HU is not commodity; carrier description may be abbreviated |
| Air Waybill | nature and quantity of goods, pieces, gross weight | Consolidated descriptions may not represent invoice-level SKU cardinality |
| Commercial Invoice | goods description, item number, quantity, price, origin | Product description may be insufficient for customs classification |
| Packing List | package contents, cartons, units, marks, weight | Package-line cardinality differs from invoice commodity lines |
| Customs declaration / clearance docs | goods description, tariff code, origin, value | Jurisdiction/effective-date and declaration authority govern sufficiency |

## Failure taxonomy (shared)
F01 OMITTED_COMMODITY
F02 MERGED_COMMODITIES
F03 SPLIT_SINGLE_COMMODITY
F04 DESCRIPTION_ATTRIBUTE_CONTAMINATION
F05 WRONG_COMMODITY_ATTRIBUTE_ASSOCIATION
F06 HU_PACKAGE_COMMODITY_CARDINALITY_CONFUSION
F07 CONTINUATION_FRAGMENT_LOSS
F08 DUPLICATED_SOURCE_AS_NEW_COMMODITY
F09 CROSS_DOCUMENT_DESCRIPTION_CONFLICT
F10 CLASSIFICATION_DESCRIPTION_MISMATCH
F11 WRONG_AUTHORITY_OR_EFFECTIVE_DATE
F12 UNSUPPORTED_INFERENCE
F13 UNRESOLVED_AMBIGUITY
F14 MISSING_SOURCE_PROVENANCE

## Scientific failure localization
Record stage, document type, source span, baseline model output, candidate interpretation, competing hypotheses, violated rule, whether correction was attempted, result and adjudicated ground truth. Report failure rates by stage and type; separate detection, association, resolution, extraction and classification outcomes. Include harmful intervention rate and correct abstention.

## Transfer experiment
1. Frozen BOL exception corpus: build and debug rule implementation.
2. Held-out BOL exception corpus: verify non-circular improvement.
3. Held-out AWB/commercial-invoice/packing-list/customs exception corpora: assess shared rule transfer without retraining or silent per-document tuning.
4. Add adapters only where a documented semantic difference requires one; rerun original BOL holdout for regression.
5. No production claims until independently adjudicated real documents and legal/authority-specific validations pass.

## Governance
Retain existing ATL-134 BOL-002 rule IDs. Do not convert NMFC rules into universal HS/HTS rules. The later ATL-146 promotion/freeze custody must be reconciled before altering canonical FIRI. New cross-document capabilities remain experimental until approved.
