# BOL Information Resolution Baseline v0.1 — Road LTL / Malkom

Status: **FROZEN_REFERENCE_BASELINE** — immutable reference candidate, not production promotion  
Freeze date: 2 September 2026  
Target daughter release: Road LTL v1.5 frozen execution-reference candidate  
Operational contract: Operational Knowledge Contract v2 frozen schema candidate

## Purpose
Establish the first governed reference implementation of field/object-level Information Resolution inside Atlas Operational Knowledge. The baseline converts the Malkom BOL extraction problem from a flat field-accuracy exercise into canonical object semantics, applicability, evidence, association, validation, exception and feedback contracts that can later compile into executor-neutral WorkDefinitions and Malkom runtime projections.

## Scope
76 source-reported Malkom BOL fields covering parties/addresses/contacts, references, handling units, line items, classification, payment, instructions/service windows, hazardous materials and transport-document identifiers.

## Canonical object model
TransportDocument/BOL -> Consignment -> Parties [Shipper/Consignor, Consignee, BillTo] + References[] + HandlingUnits[] + LineItems[] + Instructions[] + ServiceEventWindows[]. LineItems may carry conditional DangerousGoods[] objects. Handling-unit to line-item/package relationships must be resolved from governing standard/client context rather than inferred from flat labels.

## Permanent error taxonomy
1. DETECTION_RECALL
2. OBJECT_ASSOCIATION
3. SEMANTIC_CLASSIFICATION
4. NORMALIZATION_VALIDATION
5. CONDITIONAL_APPLICABILITY

## Measurement control
The supplied source contains 11 reported Accuracy values above 100%. These values are preserved exactly as source-reported metrics but MUST NOT be interpreted as mathematical correctness rates until metric name, numerator, denominator, population, sample size and counting event are defined.

Target measurement model: Extraction Recall; Value Accuracy; Object Association Accuracy; Semantic Classification Accuracy; Normalization Accuracy; Validation Pass Rate; Critical False-Negative Rate; HITL Rate; Validated STP Yield.

## Authoritative source hierarchy
1. Competent regulation/authority where applicable — U.S. 49 CFR 172.201, 172.202, 172.203, 172.604 and 373.101 for the researched U.S. scope.
2. DSDC/NMFTA — Digital LTL eBOL 2.1 and NMFC/LTL operational semantics.
3. UN/CEFACT — canonical transport/logistics object and relationship semantics.
4. Client/carrier/runtime schema — only for environment-specific bindings that authoritative sources do not define.

## Source-backed operational findings
- Hazardous Flag is a semantic/regulatory classification attached to the correct line item; under applicable 49 CFR 172.201 contexts, hazardous entries can be governed by specified shipping-paper identification methods. Do not infer from unrelated text.
- UN/NA number, proper shipping name, hazard class/division and packing group where applicable form a linked DangerousGoods basic-description object under 49 CFR 172.202; they should receive cross-field validation rather than independent extraction-only treatment.
- Technical Name and inhalation-hazard Zone are conditional fields under specified 49 CFR 172.203 cases; requiredWhen/prohibitedWhen must be explicit.
- Emergency response phone and responsible person/ERI-provider identity are relationship-aware under applicable 49 CFR 172.604 rules.
- Handling Unit Count/Type and Line Item Piece Count require explicit object hierarchy and association; they are not interchangeable counts.
- Reference Number must resolve as a typed Reference object with value, type, issuer/role and related object. PRO remains a distinct LTL/carrier transport identifier where the governing standard defines it.
- Party data must resolve into party instances first; Address/Address2/Address3 are client layout bindings over canonical addressLines[] + city/subdivision/postcode/country semantics, not three canonical business concepts.
- Description, packaging, NMFC/sub, dimensions/weight and freight class should be cross-validated where governing classification rules permit rather than treated as unrelated predictions.

## Explicit unresolved semantics
Do not invent canonical meanings for: Code; SHC; Related Value; BOL Type; Reference Number Type Full Name; Handling Unit Line No; Shipper Code; exact Bill To/Consignee Account Number meanings; exact Instruction Type values; exact Time Critical Details coding. These remain SOURCE_CONTEXT_PENDING or CLIENT_BINDING_REQUIRED until the actual governing schema resolves them.

## A5 impact
Primary A5: LTL-03 — Create and validate shipment, consignment and transport-document identity.

LTL-03 v1.5 enrichment must instantiate canonical document/consignment objects; resolve parties, references, handling units, line items, dangerous goods, instructions and service windows; apply applicability, association, normalization and validation; resolve ambiguity/conflict; determine confidence/HITL; emit source claims and client-binding requirements; and pass validated canonical objects downstream.

Downstream A5 consumers of validated shipment/document identity require regression validation, but no Page-0/Universe taxonomy change is currently evidenced.

## Version decision
- Road LTL v1.5: **FROZEN_EXECUTION_REFERENCE_CANDIDATE**.
- Operational Knowledge Contract v2: **FROZEN_SCHEMA_CANDIDATE**.
- Supply Chain Universe 7.4: **NOT REQUIRED** solely for this use case under current evidence.

## Related governed assets
- schemas/operational-knowledge-contract-v2.json
- schemas/information-resolution-contract-v1.json
- data/source-claims/road-ltl-v1.5-bol-resolution-claims.json
- data/operational-knowledge/road-ltl-v1.5-bol-resolution-baseline.json
- governance/proposals/ROAD_LTL_V1.5_BOL_OPERATIONAL_ENRICHMENT_CHARTER.md

## Promotion gates still open after reference freeze
Reference freeze does not equal production promotion. The following remain downstream gates: resolve the source-reported Malkom metric definition; obtain governing client/Malkom schemas for unresolved labels; complete recursive Work Decomposition; compile WorkDefinition VNext; execute downstream runtime regression and measured Validated STP proof before any production activation claim.

## Freeze basis
The GitHub executable freeze validation verified lossless v1.4 inheritance, LTL-03-only change scope, claim-reference integrity, Operational Knowledge v2 and Information Resolution linkage, canonical object depth, jurisdiction boundaries, metric-anomaly disclosure, and preservation of the production baseline. The immutable freeze is therefore authorized as a reference candidate only.
