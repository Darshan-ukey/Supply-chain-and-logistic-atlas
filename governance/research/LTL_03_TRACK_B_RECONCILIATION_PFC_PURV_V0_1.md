# LTL-03 Track B Reconciliation — PFC + Pickup Request/Visibility v0.1

Date: 2026-09-20
Status: GOVERNED RECONCILIATION CHECKPOINT
Scope: ATL-35 / LTL-03

## Reason for reconciliation

Review of the two research tranches created in this session found that Track A had advanced correctly and Track B had materialized primitives/families/patterns, generated instances and generic runtime projections, but client-binding dependencies for the new PFC and Pickup Request/Visibility semantics were only described as guardrails rather than represented as graph objects.

This was a Track B completeness gap, not a source-research defect.

## Repair

Added four unresolved client-binding requirement nodes:
- CBRQ-PFC-CHARGE-LIABILITY: payer/liability/dispute policy for client-specific PFC automation.
- CBRQ-PURV-READINESS-POLICY: client/carrier definitions/requiredness for dock and shipment readiness.
- CBRQ-PURV-EQUIPMENT-POLICY: pickup-equipment vocabulary/requiredness and requested-vs-assigned interpretation.
- CBRQ-PURV-DELAY-POLICY: client/carrier delay-reason vocabulary and revised-arrival handling.

Generated instances now explicitly REQUIRES_CLIENT_BINDING where execution cannot be safely specialized from industry evidence alone.

## Projection check

GI-105 through GI-114 already project to the governed generic runtime targets:
- Malkom/IDP
- RPA
- AI Agent
- API
- BPM

No additional runtime projection type was required.

## Integrity

Post-reconciliation graph:
- 387 nodes
- 1,973 typed edges
- 114 generated rule instances
- 11 reusable patterns
- 0 broken edges

No new semantic primitive, rule family or reusable pattern was introduced.

## Governance interpretation

Track A = authoritative execution-knowledge discovery.
Track B = continuous normalization/materialization into governed primitives, reusable families/patterns, generated instances, client-binding requirements and projections.

ATL-37 remains a separate downstream independent QA gate and is not one of the two research tracks.
