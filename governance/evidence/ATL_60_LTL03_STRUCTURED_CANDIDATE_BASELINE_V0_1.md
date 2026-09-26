# ATL-60 — LTL-03 Structured Candidate Baseline V0.1

Status: CANDIDATE / NON-CANONICAL
Scope: retained-evidence structuring only; no canonical promotion/freeze
Evidence inputs: Phase 2 Working Evidence (Drive `1BvcVg60x0tYp1AF-0sAW4i1X9UnuBCTLsSXBTY7CheI`); Phase 2 Source Register & Validation Ledger (Drive `1zbokPP84mZ-9HSX1BSjJdu3sQP0YUlw38ZPfIPOjC50`).

## Purpose and control
This checkpoint materializes source-backed candidate knowledge from the retained LTL-03 corpus. It does not convert strategy synthesis into authoritative domain fact. Assertions retain evidence class and unresolved gaps. Canonical Atlas promotion remains separately governed.

## Candidate operational scope
**Work node:** LTL-03 — Create/validate shipment, consignment and transport-document identity.

**Operational purpose (candidate):** establish and validate shipment/transport-document identity and associated parties, references, handling units, line items, classification and instructions before bad shipment information propagates downstream.

## Candidate knowledge records
| Candidate ID | Type | Candidate semantic | Evidence / authority | Support state | Explicit gap / boundary |
|---|---|---|---|---|---|
| LTL03-CAND-001 | INFORMATION_RESOLUTION_MODEL | BOL information resolution must distinguish detection/reading from object association, semantic classification, normalization/validation and conditional applicability. | Working Evidence §2; internal governed BOL Information Resolution Baseline v0.1 (SRC-P2-014). | INTERNAL_GOVERNED_REFERENCE | Production incidence by error class/client remains P2-V01 OPEN. Do not universalize the 76-field implementation reference. |
| LTL03-CAND-002 | LIFECYCLE_RULE | Shipment commercial truth may change after initial BOL creation through reweigh/reclassification, accessorial additions/removals, party/terms changes, storage, detention and redelivery. | NMFTA/DSDC Preliminary Freight Charges API, SRC-P2-003 / P2-DEN-07; HIGH. | SUPPORTED | Event incidence and client-specific implementation rules are not supplied by the standard. |
| LTL03-CAND-003 | CLASSIFICATION_RULE_CONTEXT | Freight classification is governed operational/business logic affecting rating and billing; it is not reducible to document extraction. | NMFTA 2025 NMFC changes, SRC-P2-001 and SRC-P2-011; HIGH. | SUPPORTED | Exact commodity/classification decision rules require current authoritative NMFC data and applicable client/carrier context. |
| LTL03-CAND-004 | OBJECT_RELATIONSHIP | Candidate information objects include BOL/PRO identity, parties, references, handling units, commodity/line items, classification and instructions; semantic association matters independently of character detection. | Working Evidence §§2,5,8 plus SRC-P2-014. | PARTIALLY_SUPPORTED | Complete BOL field universe/cardinality remains ATL-67 freeze scope; completeness is not claimed here. |
| LTL03-CAND-005 | EXCEPTION_CONTROL | Missing/conflicting evidence, ambiguous identity/association, rule ambiguity, authority/approval, novel/high-impact exceptions and cross-party resolution are candidate HITL/escalation classes rather than conditions to infer silently. | Source Register R1–R7, triangulated from SRC-P2-030–033. | PARTIALLY_SUPPORTED | Vendor evidence establishes patterns, not universal mandatory human ownership. |
| LTL03-CAND-006 | SOURCE_PRECEDENCE_REQUIREMENT | Executor-ready LTL-03 knowledge requires explicit source authority and conflict-resolution behavior; absent production/client precedence rules remain a knowledge gap. | Working Evidence P2-V07 explicitly OPEN. | KNOWLEDGE_GAP | Actual Operations precedence/conflict-resolution rules are not established in retained Phase 2 evidence. |
| LTL03-CAND-007 | CLIENT_BINDING_REQUIREMENT | Client-specific master data, overrides, production coverage and permitted decisions must remain binding/runtime context rather than be inferred into reusable LTL truth. | Working Evidence P2-V05/P2-V06 OPEN. | CLIENT_BINDING_REQUIRED | Per-client production scope, automation/HITL rates and master-data values unresolved. |
| LTL03-CAND-008 | EVIDENCE_CONTROL | Population-specific metrics must retain their denominators and cannot be blended into one LTL exception rate. | Working Evidence denominator controls; Source Register P2-DEN-01–10. | SUPPORTED | Representative cross-client/carrier incidence remains open; no market-wide extrapolation authorized. |

## Candidate rule-family mappings
Retained evidence supports candidate mappings—not canonical rule instances—to classification; source authority/precedence; conditional applicability; normalization/validation; object association/consistency; exception detection/handling; human-resolution/approval; client binding; evidence/audit; and lifecycle/state-change reconciliation.

No deterministic expression, decision table, client override or master-data lookup value is invented where the retained corpus does not supply one.

## Provenance-chain checkpoint
Observed retained chain: authoritative/public or internal governed evidence → evidence classification and limitations → candidate domain semantics → candidate rule/control families → explicit gaps/client bindings → future WorkDefinition/readiness projection.

This is sufficient for the candidate records above, but not yet sufficient to freeze the complete LTL-03 execution-knowledge baseline.

## Explicit unresolved register
1. P2-V01 — production incidence by governed Malkom error class/field/object/client.
2. P2-V05 — actual Malkom production support by Road LTL task/client.
3. P2-V06 — current accuracy/automation/HITL by process/input channel.
4. P2-V07 — Operations source-authority and conflict-resolution rules.
5. Complete BOL field universe/cardinality — ATL-67 gate.
6. Client master data/overrides and permitted authority — Client Binding.
7. Representative residual exception incidence/economics — retained P2 validation gates remain open.

## Determination
**STRUCTURED CANDIDATE CHECKPOINT: PASS.** Source-backed candidate knowledge can be materialized without new external research for the semantics above.

**ATL-60 FINAL BASELINE: NOT YET DECLARED COMPLETE.** Continue structuring retained evidence and preserve explicit gaps. No canonical promotion/freeze is authorized by this checkpoint.
