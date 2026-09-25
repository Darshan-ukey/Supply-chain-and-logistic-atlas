# LTL-03 Execution Readiness Checkpoint v0.3

Date: 2026-09-20
Workstream: ATL-35
Canonical task: LTL-03 — Create and validate shipment, consignment and transport-document identity
Status: PAUSED FOR OWNER CLARIFICATION

## Preserved current state

### Method
Atlas derives execution readiness through:
Authoritative source -> domain primitive -> governed relationship -> lifecycle/state transition -> recursive Work Decomposition -> WorkDefinition -> execution queues -> authority/evidence/recovery controls -> downstream tool projection.

LLM may research/extract/normalize/map; LLM-generated decomposition is not authoritative evidence.

### Current information objects
1. Shipment / Consignment
2. Reference / Identifier
3. Transport Document / BOL
4. Party
5. Location / Address
6. Consignment Item / Commodity
7. Handling Unit / Package
8. Service / Handling / Accessorial Instruction
9. Payment / Charge Terms
10. Dangerous Goods / Hazmat — conditional
11. Associated / Supporting Document

### Field contract
Information Object -> Field -> Evidence Class -> Cardinality -> Industry Requiredness -> Client Requiredness -> Lifecycle Action -> Validation -> Source Authority -> Exception -> Queue -> Remediation Authority -> Audit Evidence

### Evidence classes
A — current issuer-explicit
B — current issuer schema-family confirmed, exact property still pending
C — carrier/client implementation corroboration only

### Confirmed source-backed behaviors
- PRO can be pre-assigned or carrier-assigned.
- LocationID is optional at standard level and scoped to assigning organization; client/carrier may strengthen constraints.
- eBOL lifecycle includes create/update/delete-cancel.
- Bad-data validation and identity-not-found are separate failure classes.
- Client/carrier binding may strengthen requiredness and format constraints without altering canonical industry truth.
- Hazmat rules can add required fields, value/reference rules, relationship checks, and prescribed representation order.
- Commodity/NMFC semantics remain distinct from hazmat regulatory-description semantics.

### Current queue candidates
- BOL_CREATE_VALIDATION
- BOL_UPDATE_VALIDATION
- BOL_DELETE_VALIDATION
- BOL_DATA_VALIDATION_EXCEPTION
- BOL_IDENTITY_NOT_FOUND
- PRO_ASSIGNMENT_REQUIRED
- LOCATION_ID_RECONCILIATION (client binding dependent)
- HAZMAT_REQUIRED_DATA_MISSING
- HAZMAT_BASIC_DESCRIPTION_INVALID
- HAZMAT_SEQUENCE_INVALID
- HAZMAT_PACKAGE_QUANTITY_MISMATCH

Queue conditions have source support; Atlas queue nomenclature is not yet frozen.

### Guardrails
- Do not use SEFL 76-field list until independent BOL universe is sufficiently derived.
- Do not promote carrier implementation examples to canonical truth without authoritative corroboration.
- Do not flatten BOL into a single field list.
- Preserve industry canonical contract separately from client/carrier execution binding.
- No historical P6.1 reconstruction or count targeting.

### Pause point
Research is intentionally paused before the next field-by-field matrix expansion so Owner clarifications can be incorporated without contaminating the derivation.
