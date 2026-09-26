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


## Retained frozen-reference enrichment — 2026-09-26

The bounded candidate above is now additionally reconciled against retained Drive **BOL Information Resolution Baseline v0.1 — Road LTL / Malkom — FROZEN_REFERENCE_BASELINE** (Drive ID `1oxEYH8mHZEZ4Y2D7mgLj2wlSl1d7bcmlBhT3lWV7J7Q`) and **Atlas Execution-Readiness Derivation Method v1** (Drive ID `12SRbTomHs-_sEZusn7JY2msMwEZ7zMCqOPhJE7q2vDs`). This enrichment does not alter the frozen references.

### Object/relationship detail now directly evidenced
- `TransportDocument/BOL → Consignment → Parties[] + References[] + HandlingUnits[] + LineItems[] + Instructions[] + ServiceEventWindows[]`.
- Party roles explicitly include Shipper/Consignor, Consignee and BillTo.
- LineItems may carry conditional DangerousGoods[].
- Reference is typed with value, type, issuer/role and related object; PRO remains distinct where the governing LTL standard defines it.
- Party information resolves to party instances before client-layout address bindings.
- Handling-unit/line-item/package relationships must be resolved from governing standard/client context rather than inferred from flat labels.

### Source-backed rule/validation families
- Hazardous Flag belongs to the correct line item; unrelated text is insufficient.
- UN/NA number, proper shipping name, hazard class/division and packing group where applicable form a linked DangerousGoods basic-description object and require cross-field validation.
- Technical Name and inhalation-hazard Zone are conditional in specified regulatory cases; requiredWhen/prohibitedWhen must be explicit.
- Emergency response phone and responsible person/ERI-provider identity are relationship-aware where applicable.
- Handling Unit Count/Type and Line Item Piece Count are distinct and require explicit object hierarchy/association.
- Description, packaging, NMFC/sub, dimensions/weight and freight class should be cross-validated where governing classification rules permit.

### Explicit unresolved semantics carried as governed gaps
Do not invent canonical meanings for: Code; SHC; Related Value; BOL Type; Reference Number Type Full Name; Handling Unit Line No; Shipper Code; exact Bill To/Consignee Account Number meanings; exact Instruction Type values; exact Time Critical Details coding. These remain `SOURCE_CONTEXT_PENDING` or `CLIENT_BINDING_REQUIRED`.

### Lifecycle/identity controls now directly evidenced
The retained execution-readiness method requires industry canonical semantics to remain separate from client operating patterns. PRO may be requestor-preassigned or carrier-assigned; it must not be hard-coded as universal booking output. Booking reference, PRO, BOL and other identifiers require a canonical reference object with assigning party/system, related object, relationship, status, uniqueness scope, creation event and authority. Source-backed eBOL operations include create, update and delete/cancel. Invalid-information and identity-not-found failures remain separate exception classes.

### Measurement-integrity control
The frozen BOL reference records 11 source-reported Accuracy values above 100%. They must be preserved as reported but cannot be interpreted as mathematical accuracy until metric name, numerator, denominator, population, sample size and counting event are defined. The retained target model is Extraction Recall; Value Accuracy; Object Association Accuracy; Semantic Classification Accuracy; Normalization Accuracy; Validation Pass Rate; Critical False-Negative Rate; HITL Rate; Validated STP Yield.

### Readiness disposition
This enrichment strengthens object, rule, identity/lifecycle and explicit-gap coverage, but does not make the candidate `DOMAIN_EXECUTION_READY`. A complete source-backed state-transition table, exhaustive rule expressions, queue authority, complete information-concept universe and unresolved client/source-context semantics remain open or separately gated. No Supabase knowledge rows are promoted by this change.


## Retained governed research integration — Stage 2

The candidate is now reconciled with four retained GitHub research artifacts already produced under ATL-35. These are consumed as retained governed research inputs; ATL-60 does not re-run their external research:

- `governance/research/LTL_03_INDEPENDENT_BOL_FIELD_UNIVERSE_V0_1.md` — blob `ea5c13cd113f58319b46875e60eca0a5a4600327`
- `governance/research/LTL_03_REGULATORY_MINIMUM_AND_LIFECYCLE_AUTHORITY_MATRIX_V0_1.md` — blob `cbe8a5519c853bdc33692c7de68cc6379f42b8d6`
- `governance/research/LTL_03_RULE_NORMALIZATION_RETROSPECTIVE_V0_1.md` — blob `55c32dbab8b8061c8b2cc988111828c3e2c39836`
- `governance/research/LTL_03_BOL_UNIVERSE_NORMALIZED_CROSSWALK_V0_1.md` — blob `2d52372d4bae36618d5635a7820cd7245eddd7c4`

### Information-concept / field-semantic baseline

The independent universe provides source-backed semantics across thirteen categories: shipment/consignment identity; transport-document identity/lifecycle; references/identifiers; parties; locations; consignment items/commodity; packages/handling units; service/accessorial families; payment terms; classification; conditional hazmat/regulatory information; instructions/notes; error/result semantics.

Examples directly carried into this candidate include role-specific party/location relationships, scoped identifiers, measure ownership, package hierarchy, repeating item/package collections, controlled-value families, and explicit separation of classification from hazardous-material semantics.

The retained evidence boundary remains binding: exact NMFTA BOL_Request property/cardinality claims not directly established by issuer evidence are not invented here. SEFL-specific field names are not promoted as canonical solely because they exist in a client implementation.

### Actors / systems / interfaces

Evidence supports distinct authority/interaction roles for consignor/shipper, consignee, carrier, requestor/partner and client operations. System/interface semantics directly evidenced include NMFTA eBOL create/update/delete operations, carrier/shipper-scoped LocationID, carrier/client specialization of optional fields/constraints, client master/reference reconciliation, and downstream executor projections.

The complete production Malkom/client system topology remains OPEN where retained internal evidence does not establish it.

### Inputs / outputs / dependencies

Source-backed input classes now include transport-document/eBOL evidence, shipment/consignment identity, party/location data, references, item/commodity data, package/handling-unit structures, instructions/accessorial/payment/classification codes, and conditional dangerous-goods data.

Controlled outputs are validated/canonical information, explicit unresolved/binding state, provenance/evidence, governed exception state and executor-specific projection only after canonical resolution. Dependencies include applicable regulation/industry standards, controlled vocabularies/reference masters, client/carrier masters/bindings, lifecycle target identity and source-authority context.

### Normalization / transformation semantics

Retained normalization architecture:
`Authoritative Evidence → Domain Fact → Semantic Primitive → Reusable Rule Family → Generated Rule Instance → Client Binding → Runtime/Tool Projection`.

The retained candidate grammar includes RF1–RF16: identity/reference resolution; relationship integrity; lifecycle/state transition; requiredness/cardinality; controlled-value validation; master/reference reconciliation; conditional activation; error/exception semantics; source authority/precedence; representation constraints; client specialization; aggregate reconciliation; measure semantics; hierarchy; candidate parsing/semantic assignment; instruction/note ownership.

A retained 30-element BOL crosswalk demonstrated composition through these families without introducing a new family for that sample. This remains a scalability signal, not a claim that the full universe is frozen or that Rule Reuse Ratio is proven.

### Source-backed lifecycle / validation / exception structure

Directly retained:
- create/update/delete-cancel document lifecycle;
- PRO resolution for update/delete and configurable assignment authority;
- invalid-data vs target-not-found error separation;
- regulatory requiredness for consignor, consignee, origin, destination, package count, freight description and rating-relevant measure under the researched U.S. scope;
- conditional hazardous-material information and representation constraints;
- structural → semantic → value correctness ordering;
- client specialization must not rewrite canonical domain semantics.

### Remaining explicit gaps after retained-artifact integration

1. The independent BOL universe artifact is marked PARTIAL / NOT FROZEN; ATL-67 remains the independent freeze gate.
2. Exact issuer property/cardinality detail must remain bounded to the recovered authoritative raw eBOL artifact / independently governed field-universe work; do not infer absent properties.
3. Production client/Malkom actors, system topology, source precedence and permitted-action matrix remain unresolved where internal evidence is absent.
4. Complete state-transition coverage outside directly evidenced eBOL lifecycle remains incomplete.
5. Full generated rule-instance enumeration and Rule Reuse Ratio remain unproven.
6. Exact client SOP/master-data bindings and production exception/HITL routing remain client-specific/open.
7. Executor-ready WorkDefinition compilation is downstream governed work; this candidate records the traceable knowledge substrate and does not self-certify it.

### Stage-2 determination

For ATL-60's retained-evidence structuring objective, the material knowledge dimensions requested by the issue are now represented either by source-backed structured content or explicit governed gaps. This does not freeze the BOL field universe, validate execution readiness, or promote canonical knowledge.


## Stage 3 — canonical retained execution-graph reconciliation

ATL-60 now consumes the retained ATL-35 freeze-candidate package as the principal structured research substrate rather than reconstructing equivalent knowledge from prose.

### Verified machine artifact
- `governance/research/LTL_03_EXECUTION_LOGIC_GRAPH_V0_1.json`
- verified current blob: `25b7a49649fa91799e45e08c9ff892113d6cb347`
- graph-declared validation: 471 nodes; 2,538 typed edges; 148 generated rule instances; 11 reusable patterns; 0 broken edges; 0 stranded evidence; 0 unused families/primitives; no generated instance missing evidence, primitive or family linkage.
- graph governance declares research closed and broad-research reopen only for a specific QA/closure defect.

### Retained freeze-candidate manifest
- `governance/research/ATL_35_LTL_03_FREEZE_CANDIDATE_MANIFEST_V0_1.md`
- verified blob: `942ecd6e7e140bbc76db0a1c64593f74cb3e281c`
- records 69 evidence nodes, 149 domain facts, 21 semantic primitives, 18 rule families, 148 generated instances, 31 explicit exceptions, 11 reusable execution patterns, 15 explicit client-binding requirements, 3 explicit knowledge gaps and 5 runtime projection types.
- records exact NMFTA eBOL 2.1 raw-source SHA-256 `39715755793a2f39ee290e17f3997cb1bd7cadf001e5531f4a61093df1094e8c`; prior exact BOL_Request property/nesting/cardinality gap is recorded as resolved.
- records ATL-37 independent disposition `PASS_WITH_BINDING_CORRECTIONS` and the correction-cycle identities. ATL-60 does not reinterpret that as unconditional QA PASS.

### Reconciliation evidence
`governance/research/LTL_03_EXECUTION_GRAPH_RECONCILIATION_VERIFICATION_V0_1.md` (blob `5b668c7d225c841027b796e01cf937c22ce73d43`) records PASS for the governed graph relationship mechanism and bidirectional downstream accessibility at its reconciliation boundary.

### ATL-60 materialization decision

The structured execution-knowledge baseline is the combination of:
1. the retained reconciled evidence/provenance corpus;
2. the verified execution-logic graph above as the machine-addressable structured knowledge substrate;
3. the retained freeze-candidate manifest defining source hierarchy, rule/primitives, bindings/gaps and QA boundary;
4. this ATL-60 reconciliation artifact, which records scope, retained-evidence integration, unresolved boundaries and promotion restrictions.

ATL-60 must not copy the 471-node graph into a second competing canonical graph merely to satisfy its exit wording. The verified retained graph is the source-backed structured baseline candidate; ATL-60's role is reconciliation/materialization governance and explicit gap preservation.

### Exit-criterion assessment

ATL-60 issue dimensions are now accounted for as follows:
- operational purpose / trigger / outcomes / process context — REPRESENTED;
- canonical objects / relationships — REPRESENTED;
- BOL/information concepts / sections / cardinality / aliases — REPRESENTED in retained graph/schema closure, with client aliases/bindings explicit;
- field semantics / object association — REPRESENTED;
- actors / roles / systems / interfaces — REPRESENTED where source-backed; production-client topology remains explicit gap/binding;
- inputs / outputs / dependencies — REPRESENTED;
- decision logic / rules / validations — REPRESENTED through 18 retained families + generated instances;
- conditional applicability / jurisdiction — REPRESENTED with explicit jurisdiction gaps;
- lifecycle/state semantics — REPRESENTED for researched scope; non-universal client patterns remain bindings;
- exceptions / HITL — REPRESENTED through explicit exceptions and client-binding requirements;
- authority / source precedence / conflict resolution — REPRESENTED;
- provenance/evidence — REPRESENTED and graph-linked;
- normalization/transformation — REPRESENTED;
- client binding / master data — REPRESENTED as explicit governed requirements;
- knowledge gaps / uncertainty — REPRESENTED as first-class gaps;
- executor-consumable decomposition / WorkDefinition / execution-contract mappings — represented as governed machine substrate and downstream mappings, but downstream execution-readiness certification remains ATL-59/ATL-67 and related governed stages.

### Builder disposition

**ATL-60 BUILD SCOPE: QA_READY_CANDIDATE.**

This is not self-approval and not canonical Supabase knowledge promotion. Independent crossed QA must verify this reconciliation/exit determination, including that the retained graph + manifest genuinely satisfy ATL-60's issue exit criterion and that no unresolved item has been incorrectly hidden as complete.
