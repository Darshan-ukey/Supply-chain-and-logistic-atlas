# Road LTL v1.5 Candidate — What Changed and Why

Date: 2 September 2026  
Branch: `road-ltl-v1.5-bol-operational-enrichment`

## Executive summary
Road LTL v1.4 remains an immutable frozen execution-reference candidate. The Malkom BOL use case exposed a material gap between task-level Operational Knowledge and the field/object-level semantics required for reliable execution. This branch therefore creates the governed Road LTL v1.5 enrichment candidate and Operational Knowledge Contract v2 candidate without modifying v1.4 or Supply Chain Universe 7.3.

## What changed
1. Added **Operational Knowledge Contract v2 candidate**. It embeds Information Resolution as a first-class Operational Knowledge component and adds structural requirements for object semantics, field applicability, evidence, association, normalization, validation, authority, exception/HITL handling, client binding and runtime feedback.
2. Added **Information Resolution Contract v1** as the reusable field/object contract used by Operational Knowledge v2.
3. Added **BOL Information Resolution Baseline v0.1 — Road LTL / Malkom** as the reference implementation.
4. Added authoritative source claims for applicable U.S. BOL/hazardous-shipping-paper semantics plus DSDC/NMFTA and UN/CEFACT source families.
5. Added the full 76-field source-reported Malkom BOL baseline and permanent five-class error taxonomy.
6. Defined the primary A5 impact on **LTL-03 — Create and validate shipment, consignment and transport-document identity**, with downstream regression required for consumers of validated shipment/document identity.
7. Added explicit boundaries for unresolved runtime/client labels instead of inventing domain meanings.
8. Added measurement-integrity controls because 11 source-reported Accuracy values exceed 100%; these remain raw reported metrics until their denominator/method is resolved.

## Why it changed
The observed failure pattern shows that OCR/extraction alone cannot solve the use case. High extraction with poor reported correctness (for example Hazardous Flag) indicates missing semantic classification; piece/handling-unit issues indicate object-association gaps; hazmat technical/zone fields require conditional applicability; references require typed object semantics; party/address fields require relational resolution. These are Operational Knowledge responsibilities before Work Decomposition and WorkDefinition compilation.

## What did NOT change
- Supply Chain Universe remains **7.3**. No Page-0 taxonomy or canonical process-semantic change is evidenced by this use case.
- Road LTL **v1.4 is not edited**.
- Canonical Atlas knowledge remains executor-neutral; Malkom runtime structures remain downstream projections.
- Client/runtime-specific labels remain bindings when authoritative sources do not define them.

## Version policy
Material enrichment of a frozen asset creates a new candidate version. Therefore:
- Road LTL v1.5 candidate — required.
- Operational Knowledge Contract v2 candidate — required.
- Universe 7.4 — not required under current evidence.

## Freeze status
These v1.5/v2 assets are **candidate-for-freeze**, not yet production-promoted. Freeze/promotion requires source coverage, operational-depth validation, downstream regression, execution-contract compilation, metric-integrity and governance gates.
