# LTL-03 Generated Rule Instance Catalogue v0.1

Date: 2026-09-20
Workstream: ATL-35
Status: PROVISIONAL ENUMERATED SUBSET — NOT FULL LTL-03 FREEZE

## Purpose

Create an explicit generated-rule-instance denominator for the first valid normalization/reuse measurement.

This catalogue covers the currently verified field/lifecycle/authority subset only. It must not be represented as the full LTL-03 instance universe.

## Instances

| # | Generated rule instance | Normalized family composition | Classification |
|---:|---|---|---|
| 1 | Resolve consignor role and required presence | RF2+RF4+RF6 | REUSED |
| 2 | Resolve consignee role and required presence | RF2+RF4+RF6 | REUSED |
| 3 | Resolve origin role and location identity | RF2+RF4+RF6 | REUSED |
| 4 | Resolve destination role and location identity | RF2+RF4+RF6 | REUSED |
| 5 | Validate package count presence | RF4 | REUSED |
| 6 | Reconcile package count to child packages where applicable | RF12 | REUSED |
| 7 | Preserve freight description source text | RF9+RF15 | REUSED |
| 8 | Parse freight description into structured candidates | RF15 | REUSED |
| 9 | Resolve rating-relevant measure semantic owner | RF13 | REUSED |
| 10 | Validate rating-relevant measure unit | RF13 | REUSED |
| 11 | Resolve carrier-assigned consignment identifier | RF1+RF4 | REUSED |
| 12 | Resolve consignor-assigned consignment identifier | RF1+RF4 | REUSED |
| 13 | Preserve identifier scheme agency | RF1 | REUSED |
| 14 | Determine PRO assignment path | RF1+RF4 | REUSED |
| 15 | Bind PRO to BOL/consignment | RF1+RF2 | REUSED |
| 16 | Resolve BOL update target by PRO | RF1+RF3 | REUSED |
| 17 | Resolve BOL delete target by PRO | RF1+RF3 | REUSED |
| 18 | Resolve LocationID within assigning organization | RF1+RF6 | REUSED |
| 19 | Apply client-mandatory LocationID override | RF11+RF4 | REUSED |
| 20 | Validate consignment gross weight value/unit | RF13 | REUSED |
| 21 | Validate consignment gross volume value/unit | RF13 | REUSED |
| 22 | Validate item gross weight value/unit | RF13+RF4 | REUSED |
| 23 | Instantiate repeating transport-package collection | RF4+RF2 | REUSED |
| 24 | Validate package hierarchy level | RF5+RF14 | REUSED |
| 25 | Resolve pickup/acceptance location role | RF2+RF5+RF6 | REUSED |
| 26 | Resolve consignee-receipt location role | RF2+RF5+RF6 | REUSED |
| 27 | Activate hazmat description contract | RF7 | REUSED |
| 28 | Validate hazmat identification number | RF1+RF5+RF7 | REUSED |
| 29 | Validate proper shipping name | RF5+RF7 | REUSED |
| 30 | Validate primary/subsidiary hazard class | RF5+RF7 | REUSED |
| 31 | Validate packing group when applicable | RF5+RF7 | REUSED |
| 32 | Validate hazmat total quantity and unit | RF7+RF13 | REUSED |
| 33 | Validate hazmat number/type of packages | RF4+RF5+RF7 | REUSED |
| 34 | Validate hazmat basic-description sequence | RF7+RF10 | REUSED |
| 35 | Validate special-permit notation association | RF1+RF7+RF10 | REUSED |
| 36 | Validate Limited Quantity / RQ conditional notation | RF5+RF7+RF10 | REUSED |

## Provisional scalability metrics

- Enumerated generated rule instances in this subset: 36
- Instances using existing RF1-RF16 families: 36
- Instances requiring a new canonical rule family: 0
- Instances identified as genuinely bespoke: 0
- Client-binding instances represented in subset: at least 1 explicit example (LocationID requiredness override); broader client-binding enumeration remains incomplete.

### Subset Rule Reuse Ratio

36 / 36 = 100.0%

This ratio is valid only for the explicitly enumerated subset above. It is not yet the final LTL-03 Rule Reuse Ratio.

## Interpretation

The current evidence supports an early scalability hypothesis:
- authoritative facts are increasing;
- generated instances are increasing;
- canonical reusable family count remains at RF1-RF16 for this tranche.

This is the desired architectural direction, but full proof requires the frozen independent BOL universe and complete generated-instance enumeration.

## New Rule Family Rate

For this research tranche:
- new reusable rule families introduced: 0.

Do not extrapolate this to all future tasks.

## Intake rule going forward

Every new authoritative discovery must produce:
1. domain fact;
2. semantic primitive mapping;
3. existing-family search;
4. generated rule instance;
5. reuse/new-family/bespoke/client-binding classification;
6. provenance.

## Remaining work

- enumerate non-regulatory service/accessorial/payment/classification instances when property-level evidence is sufficient;
- enumerate document/version/evidence/retry/idempotency instances where source support exists;
- recover exact NMFTA BOL_Request property body;
- complete client-binding inventory;
- freeze independent universe;
- compute final LTL-03 Rule Reuse Ratio;
- test generator coverage, unsupported-generation rate and safety for ATL-37.
