# ATL-60 LTL-03 Structured Execution-Knowledge Candidate Baseline V0.1

Status: CANDIDATE / NOT CANONICAL / NOT PROMOTED
Scope: retained-evidence structuring only. No Supabase knowledge promotion or freeze is authorized.

## Evidence boundary

This baseline is derived only from the retained Phase-2 Working Evidence and its reconciled Source Register / Validation Ledger, plus the already-governed ATL-60 transformation controls. The retained Working Evidence matches its Research-Closed backup and every source ID explicitly cited by that narrative is present in the retained Source Register. Claims below therefore preserve the evidence classifications and explicit limitations in those retained artifacts rather than filling gaps from general knowledge.

## Candidate records

| Knowledge ID | Z zone | Knowledge type | Candidate semantic statement | Evidence/support state | Explicit unresolved boundary |
|---|---|---|---|---|---|
| LTL03-OK-001 | Z1 | operational_purpose | LTL-03 establishes/validates shipment, consignment and transport-document identity so downstream execution does not inherit bad shipment master data. Material information objects include BOL/PRO identity, parties, references, handling units, line items/commodity-classification and instructions. | SUPPORTED by retained governed BOL reference + Phase-2 synthesis; problem definition strong | Production scope by client is not established. |
| LTL03-OK-002 | Z1 | semantic_resolution | Information resolution is not equivalent to character extraction. Retained evidence distinguishes detection/recall from object association, semantic classification, normalization/validation and conditional applicability. Structured digital intake can still carry semantic, association or applicability defects. | SUPPORTED; internal governed BOL reference reports 76 source-reported fields and five permanent error classes | Complete field-level universe must not be inferred from the Phase-2 narrative; ATL-67 independent field-universe freeze remains required. |
| LTL03-OK-003 | Z1 | object_relationship | LTL-03 requires association of values to business objects and linkage among shipment/document identity, parties, references, handling units, commodity/classification and instructions; later lifecycle work also depends on relationships among shipment facts, events, invoices and evidence. | SUPPORTED qualitatively | Exact relationship cardinalities and all aliases/representations are not fully enumerated in retained Phase-2 narrative. |
| LTL03-OK-004 | Z1 | lifecycle_semantics | Shipment/commercial truth can change after initial BOL creation. Retained NMFTA/DSDC evidence identifies post-pickup changes including reweigh, reclassification, accessorial, party/terms, storage, detention and redelivery; initial extraction therefore does not freeze lifecycle truth. | SUPPORTED by retained public industry-standard evidence | Incidence/adoption/financial denominator is not established by the standard. |
| LTL03-OK-005 | Z1 | validation_rule_family | Validation/reconciliation compares values against rules, authoritative sources, related objects or later shipment events. The candidate error/control families are detection recall, object association, semantic classification, normalization/validation and conditional applicability. | SUPPORTED | Concrete production rule inventory and actual client precedence rules remain unresolved. |
| LTL03-OK-006 | Z1 | exception_decision | A discrepancy may require correction, hold/release, reclassification, billing action, customer communication or another governed operational response. Normal transactions may automate while ambiguous/conflicting cases require exception handling and potentially human decision authority. | PARTIALLY_SUPPORTED; workflow pattern supported, production ownership unverified | Current Malkom exception incidence, HITL rate, handling time and permitted-action matrix are OPEN. |
| LTL03-OK-007 | Z1 | authority_provenance | Evidence completeness, source authority, conflict resolution and provenance are material to information resolution. The retained BOL reference contains source-hierarchy/evidence/unresolved-semantics controls. | SUPPORTED as architecture/reference evidence | P2-V07 remains OPEN: source-authority/conflict-resolution rules actually used by Operations today are not established. Do not invent a precedence order. |
| LTL03-OK-008 | Z2 boundary | client_binding | Client-specific SOP/customer rules, master data and operational knowledge can affect exception meaning and recovery action; these are bindings, not universal Z1 truth. | SUPPORTED as requirement/boundary | Actual client rules, client masters and cross-client generalizability remain unverified. |
| LTL03-OK-009 | Z1/Z5 boundary | execution_projection | Canonical operational knowledge should feed executor-specific projections; BOL digitisation is a proof use case, not the definition of LTL-03. Candidate decomposition preserves information/object → rule/decision → condition → evidence/authority → exception → output/state → binding/gap traceability. | GOVERNED ATL-60 transformation rule; candidate mapping only | No claim that Malkom currently executes the broader lifecycle. Production task/client coverage remains OPEN. |
| LTL03-OK-010 | Z6 boundary | measurement_control | Readiness/economic claims must preserve denominator semantics. Retained evidence explicitly forbids blending invoice errors, re-rate cases, accessorial spend, missed-pickup workload and claims-payment ratios into one LTL exception rate. | SUPPORTED by retained research control | Representative carrier/client incidence, per-resolution minutes/cost and double-count-free benefit bridge remain OPEN. |

## Candidate work-decomposition mapping

1. **Establish identity/context** — identify shipment/transport-document identity and associate parties, references, handling units, line items/commodity-classification and instructions.
2. **Resolve semantics** — distinguish extraction failure from association, semantic classification, normalization/validation and conditional applicability.
3. **Validate/reconcile** — compare candidate facts against applicable rules, authoritative evidence, related objects and lifecycle events.
4. **Classify exception/decision need** — determine whether discrepancy can be resolved deterministically or requires governed human/client/authority action.
5. **Produce controlled state/output** — corrected/validated information or explicit unresolved state; preserve evidence and rationale.
6. **Project only approved executor subset** — bind client/master data in Z2 and execution semantics in Z5 without converting client-specific logic into universal Z1 knowledge.

This decomposition is a candidate transformation of retained evidence, not a frozen WorkDefinition.

## Explicit gap register carried forward

- GAP-01 / P2-V01: production incidence of each governed error class by field/object/client.
- GAP-02 / P2-V05: current Malkom-supported Road LTL tasks by client.
- GAP-03 / P2-V06: accuracy, automation and HITL rates by process/input channel.
- GAP-04 / P2-V07: actual Operations source-authority and conflict-resolution rules.
- GAP-05: complete BOL field/concept universe, cardinalities and aliases/representations; must be independently frozen under ATL-67 rather than inferred here.
- GAP-06: exact client SOP/rule/master-data bindings and cross-client reuse.
- GAP-07: representative exception incidence, handling minutes/cost, financial impact and double-count-free benefit bridge.
- GAP-08: production proof for longitudinal/cross-lifecycle context resolution and downstream decisioning.

## Governance disposition

This artifact materially advances ATL-60 candidate structuring but does not satisfy ATL-60 exit by itself. It deliberately preserves unresolved areas rather than fabricating completion. Canonical Supabase knowledge promotion/freeze remains blocked. The next bounded step is to extend this candidate from retained governed evidence into the remaining required structures — especially complete information-concept/field semantics where evidence exists, actors/systems/interfaces, inputs/outputs, normalization rules and executor-consumable mappings — while retaining the gap states above.
