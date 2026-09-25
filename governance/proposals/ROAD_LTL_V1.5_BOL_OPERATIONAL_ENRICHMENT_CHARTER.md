# Road LTL V1.5 — BOL Operational Knowledge Enrichment Charter

**Status:** DRAFT / RESEARCHED / NOT PROMOTED  
**Date:** 2026-09-02  
**Parent frozen candidate:** Road LTL V1.4 (`FROZEN_EXECUTION_REFERENCE_CANDIDATE`)  
**Production baseline:** Road LTL V1.3 (`FROZEN_PRODUCTION_BASELINE`, A5_VERIFIED)  
**Universe:** 7.3 remains unchanged for this use case  
**Primary use case:** Malkom BOL extraction, validation and straight-through execution improvement

## 1. Executive decision

1. **Do not modify Road LTL V1.4.** It is an immutable frozen execution-reference candidate.
2. **Create Road LTL V1.5 candidate** for the BOL operational-information enrichment because the change materially deepens A5 operational information and execution contracts.
3. **Do not create Supply Chain Universe 7.4 solely for this use case.** The current findings do not change Page-0 taxonomy, canonical process identity or Universe semantics. Reassess only if later research changes a canonical Universe concept.
4. Add a first-class **Information Resolution Contract** beneath/alongside Operational Knowledge rather than forcing field-level semantics into the thin Operational Knowledge v1 schema.

## 2. Why V1.5 is required

The frozen Daughter Production Standard V2 already requires operational information at field/object level: meaning, `requiredWhen`, value origin, datatype/cardinality, validation, provenance and source basis. The current BOL research does not invent a new architecture; it exposes an implementation-depth gap between that standard and the current Operational Knowledge schema/candidate payload.

The BOL use case adds material governed knowledge to the A5 execution reference:
- canonical BOL object/relationship semantics;
- field-level information-resolution rules;
- object association and hierarchy rules;
- conditional regulatory applicability;
- cross-field and cross-object validation;
- conflict, confidence and HITL policy requirements;
- measurement/feedback contracts;
- explicit unresolved client-binding slots.

Those are versioned daughter/operational-contract changes, not a silent patch to a frozen candidate.

## 3. A5 scope

### Primary A5
**LTL-03 — Create and validate shipment, consignment and transport-document identity**

Required enrichment:
- instantiate canonical TransportDocument/BOL and Consignment objects;
- instantiate typed Party, Reference, HandlingUnit, LineItem, DangerousGoods, Instruction and Service/Event Window objects;
- resolve document values to the correct object instance before client/runtime mapping;
- attach evidence, applicability, authority and provenance to information-resolution decisions;
- validate regulatory and business dependencies;
- emit explicit unresolved client-binding requirements;
- preserve execution lineage for recursive Work Decomposition and canonical WorkDefinition compilation.

### Downstream A5 revalidation
Any task that consumes the validated shipment/transport-document identity must be regression-tested for richer inputs, controls and evidence. Do not change downstream task identity unless the governed business step itself changes.

## 4. Canonical BOL information model

`TransportDocument/BOL → Consignment → Parties[] + References[] + HandlingUnits[] + LineItems[] + Instructions[] + ServiceEventWindows[]`, with `DangerousGoods[]` conditionally associated to the relevant LineItem and HandlingUnit↔LineItem relationships resolved according to the governing standard/client conformance profile.

Layout-specific labels such as Address 2 / Address 3 are client/runtime bindings to canonical address lines, not global business concepts.

## 5. Information Resolution Contract

Schema: `schemas/information-resolution-contract-v1.json`

Every executable information element can carry:
- canonical field/object identity and business meaning;
- datatype/cardinality/unit/code authority;
- `requiredWhen` / `prohibitedWhen` / jurisdiction applicability;
- value origin and allowed evidence;
- extraction/derivation/association/normalization rules;
- allowed values;
- field, cross-field and cross-object validation;
- authority source/owner and system-of-record role;
- conflict/missing/confidence/HITL policies;
- exact source claims;
- client-binding and runtime-mapping slots;
- measurement and execution-feedback profile.

## 6. Source baseline

Claim pack: `data/source-claims/road-ltl-v1.5-bol-resolution-claims.json`

Authoritative hierarchy used:
1. regulation / competent authority;
2. industry operating/data standards;
3. canonical transport information models;
4. client/runtime schema only for local semantics.

Initial authoritative sources:
- 49 CFR 373.101 — motor-carrier BOL required contents;
- 49 CFR 172.201 / .202 / .203 / .604 — hazardous shipping-paper identification, basic description, conditional additional descriptions and emergency-response contact semantics;
- DSDC/NMFTA Digital LTL eBOL v2.1;
- NMFTA/NMFC;
- UN/CEFACT transport/logistics models.

U.S. regulatory claims are jurisdiction-gated and must never be universalized globally.

## 7. Malkom baseline and error taxonomy

The supplied 76-field baseline is preserved verbatim in `data/operational-knowledge/road-ltl-v1.5-bol-resolution-baseline.json`.

Permanent diagnostic classes:
1. Detection / recall
2. Object association
3. Semantic classification
4. Normalization / validation
5. Conditional applicability

Key remediation signatures:
- **Line Item Hazardous Flag:** 96.71% extraction vs 19.83% reported accuracy → semantic/regulatory classification, not primary OCR capture failure.
- **Line Item Piece Count vs Handling Unit Count/Type:** hierarchy/object association.
- **Reference Number/Type:** typed Reference object/classification.
- **Handling Unit Line No/Count/Type:** structural detection + association.
- **Hazmat proper/technical name, class, packing group, zone, UN/NA:** one conditional DangerousGoods object, not independent universally-required fields.

## 8. Measurement integrity gate

Eleven source-reported `Accuracy %` values exceed 100%. Therefore the current column must not be treated as mathematical correctness until its metric definition is resolved.

Required measurement metadata:
- metric name;
- numerator / denominator;
- population and field applicability;
- document count and occurrence count;
- ground-truth method;
- sample size;
- model/runtime/version;
- client/template/document population;
- measurement date.

Target performance model:
`Extraction Recall → Value Accuracy → Object Association Accuracy → Semantic Classification Accuracy → Normalization Accuracy → Validation Pass Rate → Critical False-Negative Rate → HITL Rate → Validated STP Yield`.

**Validated STP Yield is the business outcome KPI; raw OCR/extraction accuracy is not.**

## 9. Explicit unresolved bindings

Do not invent semantics for:
- Code;
- SHC;
- Related Value;
- BOL Type;
- Reference Number Type Full Name;
- Handling Unit Line No;
- Shipper Code;
- exact Bill-To/Consignee Account Number meaning;
- exact Instruction Type values;
- exact Time Critical Details coding.

These remain `SOURCE_CONTEXT_PENDING` or `CLIENT_BINDING_REQUIRED` until the actual governing schema is available.

## 10. Workstreams

| Workstream | Status | Exit gate |
|---|---|---|
| Source & Operational Research | IN_PROGRESS | Every field family source-resolved or explicitly pending |
| Information Resolution Contract | BASELINE CREATED | Schema approved and instantiated for all 76 fields/families |
| Daughter/A5 Enrichment | STARTED | LTL-03 V1.5 candidate passes operational-depth/source gates |
| Downstream A5 Regression | NOT_STARTED | No semantic loss; richer dependencies verified |
| Recursive Work Decomposition | BLOCKED_BY_IMPLEMENTATION | Executor-ready work units generated |
| Canonical WorkDefinition | BLOCKED_BY_IMPLEMENTATION | Compiles without semantic loss |
| Malkom Projection/Compiler | NOT_STARTED | Canonical contracts project cleanly to runtime |
| Validation/Measurement | BLOCKED_BY_METRIC_DEFINITION | Reproducible nine-metric baseline + STP yield |
| Governance/Promotion | IN_PROGRESS | V1.5 frozen only after all gates pass |

## 11. Promotion gates

V1.5 cannot be frozen/promoted until:
- claim-level source/provenance coverage is sufficient;
- every information element is source-resolved or explicitly bound/pending;
- LTL-03 operational-depth revalidation passes;
- downstream dependency regression passes;
- Work Decomposition compatibility is demonstrated;
- WorkDefinition compilability is demonstrated once VNext is implemented;
- metric integrity is resolved;
- runtime neutrality is maintained;
- UI/trace/regression gates pass.

## 12. Definition of done for the Malkom proof

A weak field can be traced end-to-end:
`runtime metric → error class → canonical field/object → authoritative claim → information-resolution rule → A5 operational knowledge → decomposed work unit → WorkDefinition → Malkom projection → execution evidence → post-change metric`.

That trace is the proof that Atlas is improving Malkom through governed operational knowledge rather than through ad-hoc prompt/OCR tuning.
