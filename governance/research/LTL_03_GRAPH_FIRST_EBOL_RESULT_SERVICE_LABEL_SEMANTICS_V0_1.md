# LTL-03 Graph-First Discovery — eBOL Result / Time-Critical / Shipping-Label Semantics v0.1

Date: 2026-09-20
Workstream: ATL-35
Status: RESEARCH CANDIDATE — GRAPH-FIRST INTAKE

## Authoritative NMFTA evidence

Current eBOL 2.1 issuer material confirms controlled schema families for:
- Shipping_Label_Formats
- Time_Critical_Types
- Result_Status_Codes

NMFTA FAQ further establishes:
- TCS / Time Critical Service specifies a level of service for which a carrier would likely charge extra;
- TCS must not be confused with guaranteed service;
- carrier-specific implementation may vary;
- bad BOL data should normally return HTTP 400;
- BOL not found for update/delete should normally return HTTP 404;
- multiple logical validation issues may be returned;
- HTTP 400 failure errors precede informational/warning non-critical results.

NMFTA eBOL 2.1 release material states:
- resultsStatusCodes standardizes numerical codes describing logical transaction outcomes;
- images.bol and images.shippingLabels require applicable PRO/check-digit handling in returned barcode images;
- eBOL 2.1 includes a SCAC attribute and create/update/delete lifecycle.

## Domain facts

DF-TIME-CRITICAL-SERVICE-SEMANTIC:
Time Critical Service is a service-level semantic and is not equivalent to guaranteed service or a delivery timestamp/deadline.

DF-RESULT-STATUS-LOGICAL-OUTCOME:
Result status code describes standardized logical API outcome and is distinct from HTTP transport status.

DF-FAILURE-BEFORE-WARNING:
Failure semantics have precedence over informational/warning non-critical results in eBOL response handling.

DF-SHIPPING-LABEL-REPRESENTATION:
Shipping-label format/image is a representation/output semantic and must not become canonical shipment identity itself.

DF-BARCODE-PRO-CHECK-DIGIT:
Where applicable, PRO/check-digit requirements constrain barcode representation in BOL/shipping-label images.

## Primitive mapping

Existing primitives:
- TransportService
- Controlled Vocabulary
- State
- Evidence / Provenance
- Document
- Identifier / Reference
- Indicator
- Relationship

No new primitive required.

## Family composition

- RF5 Controlled-Value Validation
- RF7 Conditional Activation
- RF8 Error & Exception Semantics
- RF10 Representation Constraint
- RF1 Identity & Reference Resolution
- RF2 Relationship Integrity
- RF9 Source Authority & Precedence
- RF17 Monetary Amount / Charge Semantics only when a concrete charge is represented

## Generated-rule candidates

GI-TIME-CRITICAL:
resolve time-critical type as TransportService/service-level context; do not convert it into guaranteed-service semantics or TemporalValue without separate evidence.

GI-RESULT-STATUS:
preserve HTTP transport status separately from standardized logical result status and message severity.

GI-RESULT-SEVERITY:
when multiple outcomes exist, process failure before warning/informational non-critical results.

GI-SHIPPING-LABEL:
bind shipping-label format/image to document/output representation; preserve underlying PRO/reference identity separately and enforce applicable check digit in barcode representation.

## Reuse assessment

Existing reusable patterns are sufficient:
- RPAT-LTL-CONDITIONAL-CONTRACT
- RPAT-LTL-IDENTITY-BEFORE-MUTATION

No new family or reusable execution pattern is required.

## Guardrails

- Time-critical service code is not a timestamp.
- Time-critical service is not guaranteed service unless separate governed evidence establishes that relationship.
- HTTP status and logical result-status code must not be collapsed.
- Shipping-label image/format is not the canonical PRO identity.
- Do not infer monetary charge merely because time-critical service commonly attracts extra charge; charge semantics activate only when governed charge data exists.
