# LTL-03 Information Object Taxonomy v0.2

Date: 2026-09-20
Workstream: ATL-35
Canonical task: LTL-03 — Create and validate shipment, consignment and transport-document identity
Status: RESEARCH IN PROGRESS — CHECKPOINT

## Preserved findings

### Canonical information objects
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

### Governing modeling rule
Do not model a BOL as a flat field list. Fields must attach to business/information objects, relationships and lifecycle transitions.

### Field-universe structure
Information Object -> Field -> Source -> Cardinality -> Requiredness -> Lifecycle action -> Validation -> Source authority -> Exception -> Queue

### Source layering
1. Regulation / legal minimum
2. Industry operating/digital standards
3. Cross-industry semantic/reference model
4. Conditional regulation
5. Carrier/client implementation
6. Atlas deterministic synthesis with explicit provenance

### Current evidence
- 49 CFR 373.101 provides the U.S. minimum BOL information floor.
- NMFTA public BOL/NMFC guidance expands LTL operational content including commodity description, NMFC item/class, piece/handling-unit distinctions, dimensions, packaging, hazmat and accessorial/special-handling information.
- NMFTA Digital LTL eBOL 2.1 confirms BOL_Request / BOL_Response and controlled schema families for accessorials, classification, country, currency, handling unit, limited access, payment terms, packaging, requestor role, label format, state/province, time-critical and result status.
- UN/CEFACT provides separate semantic structures for consignment, parties, locations, identifiers, consignment items, packages, associated documents and dangerous goods.

### Open limitation
Exact BOL_Request property-level extraction from the issuer YAML/schema remains pending. Do not invent exact field names or cardinalities until issuer artefact recovery succeeds or equivalent authoritative evidence is found.

### Next tranche
1. Recover exact eBOL schema/property definitions where publicly accessible.
2. Create field-level provenance matrix.
3. Classify mandatory/optional/conditional and lifecycle applicability.
4. Map cardinalities and object relationships.
5. Build field-level source-precedence candidates.
6. Derive rule/exception/queue logic.
7. Crosswalk to SEFL 76 BOL fields only after independent derivation.
