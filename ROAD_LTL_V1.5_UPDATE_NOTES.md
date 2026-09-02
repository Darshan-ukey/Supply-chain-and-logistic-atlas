# Road LTL v1.5 Candidate — What Changed and Why

Date: 2 September 2026  
Branch: `road-ltl-v1.5-bol-operational-enrichment`

## Executive summary
Road LTL v1.4 remains an immutable frozen execution-reference candidate. The Malkom BOL use case exposed a material gap between task-level Operational Knowledge and the field/object-level semantics required for reliable execution. This branch therefore creates the governed Road LTL v1.5 enrichment candidate and Operational Knowledge Contract v2 candidate without modifying v1.4 or Supply Chain Universe 7.3.

## Materialized v1.5 daughter assets
Road LTL v1.5 is now an actual versioned daughter asset, not only a charter/baseline:
- `data/modules/road-ltl-v1.5.json` — SHA-256 `3d0a8fd02f0e2fd9864c5c1abcb6e6b54f8d14422d0063ec9fd8b3ffa04beade`
- `data/operational-knowledge/road-ltl-v1.5-operational.json` — SHA-256 `ef831f30134b7743313341de0621886c5c91459e1a77c1b720f68faff7534843`

Representation is `LOSSLESS_VERSIONED_OVERLAY`: inherit the complete frozen Road LTL v1.4 candidate (`data/modules/road-ltl-v1.4.json`, SHA-256 `c8a0af378ac114d684e79a0640871c73bfaa4493e96e3f5a4b413fa2f330b1d4`) and apply only the declared LTL-03 enrichment. All other v1.4 task/object/source content remains unchanged. This prevents accidental regression or reconstruction from the older v1.3 production asset.

## What changed
1. Added **Operational Knowledge Contract v2 candidate**. It embeds Information Resolution as a first-class Operational Knowledge component and adds structural requirements for object semantics, field applicability, evidence, association, normalization, validation, authority, exception/HITL handling, client binding and runtime feedback.
2. Added **Information Resolution Contract v1** as the reusable field/object contract used by Operational Knowledge v2.
3. Added **BOL Information Resolution Baseline v0.1 — Road LTL / Malkom** as the reference implementation.
4. Added authoritative source claims for applicable U.S. BOL/hazardous-shipping-paper semantics plus DSDC/NMFTA and UN/CEFACT source families.
5. Added the full 76-field source-reported Malkom BOL baseline and permanent five-class error taxonomy.
6. Materially enriched **LTL-03 — Create and validate shipment, consignment and transport-document identity** with canonical object resolution, requiredWhen/prohibitedWhen, association, normalization, cross-field/cross-object validation, authority/conflict policies, HITL/confidence logic and explicit client-binding boundaries.
7. Added a Road LTL v1.5 Operational Knowledge v2 payload that seeds the recursive Work Decomposition path without hard-coding Malkom as canonical truth.
8. Added explicit boundaries for unresolved runtime/client labels instead of inventing domain meanings.
9. Added measurement-integrity controls because 11 source-reported Accuracy values exceed 100%; these remain raw reported metrics until their denominator/method is resolved.
10. Added `governance/frozen-assets/ENRICHMENT_CANDIDATES.json` and updated `CURRENT.json` / `LATEST.md` so active v1.5 work is visible without falsely replacing frozen v1.4.

## Why it changed
The observed failure pattern shows that OCR/extraction alone cannot solve the use case. High extraction with poor reported correctness (for example Hazardous Flag) indicates missing semantic classification; piece/handling-unit issues indicate object-association gaps; hazmat technical/zone fields require conditional applicability; references require typed object semantics; party/address fields require relational resolution. These are Operational Knowledge responsibilities before Work Decomposition and WorkDefinition compilation.

## What did NOT change
- Supply Chain Universe remains **7.3**. No Page-0 taxonomy or canonical process-semantic change is evidenced by this use case.
- Road LTL **v1.4 is not edited**.
- Road LTL task identity for LTL-03 remains `a5-ltl-03` / `scp-shipment-transport-identity`; this is operational enrichment, not a canonical process renaming.
- All non-LTL-03 v1.4 content is inherited unchanged and must remain regression-identical after materialization.
- Canonical Atlas knowledge remains executor-neutral; Malkom runtime structures remain downstream projections.
- Client/runtime-specific labels remain bindings when authoritative sources do not define them.

## Version policy
Material enrichment of a frozen asset creates a new candidate version. Therefore:
- Road LTL v1.5 candidate — required and now materialized.
- Operational Knowledge Contract v2 candidate — required and persisted.
- BOL Information Resolution Baseline v0.1 — persisted reference baseline.
- Universe 7.4 — not required under current evidence.

## Freeze status
These v1.5/v2 assets are **candidate-for-freeze**, not yet production-promoted. Freeze/promotion requires source coverage, operational-depth validation, downstream regression, execution-contract compilation, metric-integrity and governance gates.
