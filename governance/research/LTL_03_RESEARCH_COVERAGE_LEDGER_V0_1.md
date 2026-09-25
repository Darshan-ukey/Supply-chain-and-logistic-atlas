# LTL-03 Research Coverage Ledger & Residual Knowledge Estimate v0.1

Status: GOVERNED ESTIMATE — NOT A COMPLETENESS CERTIFICATION
Date: 2026-09-20
Owner workstream: ATL-35 / LTL-03
Purpose: preserve how much authoritative research has been completed, what was actually materialized into Atlas knowledge, and what remains unresolved so the research depth is recoverable later.

## 1. Current materialized research state

Graph checkpoint before closure packaging:
- 461 nodes
- 2,462 typed edges
- 69 evidence nodes
- 144 domain facts
- 21 semantic primitives
- 18 rule families
- 142 generated rule instances
- 31 explicit exceptions
- 11 reusable execution patterns
- 15 client-binding requirements
- 4 explicit knowledge gaps
- 5 runtime projection types
- 0 broken edges
- 0 generated instances missing evidence / primitive / family linkage

Authority classes represented in the graph:
- U.S. federal regulation
- NMFTA
- NMFTA/DSDC
- UN/CEFACT

Research also used carrier implementations only as corroboration/research-question generators where appropriate; carrier/runtime behavior was not silently promoted to industry-canonical truth.

## 2. What has been researched deeply enough to materialize

### BOL / shipment-document core
- shipper/consignor, consignee, bill-to and party-role semantics;
- origin/destination/location identity;
- BOL/PRO/reference identity and assignment;
- BOL create/update/delete lifecycle;
- package/handling-unit/line-item hierarchy;
- freight/commodity description;
- gross weight/volume and measure ownership;
- associated/supporting documents;
- instructions/notes ownership;
- service/payment/equipment semantics;
- document temporal/version lineage.

### Classification / rating-adjacent
- NMFC/classification semantics;
- density and dimensions;
- packaging/handling-unit distinctions;
- freight class vs commodity/NMFC item/density separation;
- chargeable-weight boundary and explicit unresolved universal DIM formula.

### Conditional regulatory
- hazardous-material shipping-paper activation;
- UN/NA identifier;
- proper shipping name;
- hazard class/division;
- packing group;
- quantity/unit;
- package count/type;
- basic-description ordering;
- limited quantity / RQ / special-permit relationships and other conditional controls where sourced.

### LTL lifecycle beyond initial BOL
- pickup request/create/update/reschedule/cancel/status;
- readiness/equipment/delay semantics;
- possession/custody handoff;
- terminal/in-transit/interline/delivery lifecycle;
- ETA/planning values;
- appointment lifecycle;
- POD availability boundary;
- delivery exceptions and reason attribution;
- cross-border customs-state visibility;
- damage / shortage / loss;
- reconsignment / missed delivery;
- operational accessorial-added event.

### Preliminary commercial changes
- preliminary freight-charge lifecycle;
- reweigh/reclassification;
- accessorial additions/removals;
- shipper/consignee/bill-to/terms changes;
- storage/detention/redelivery/other fee categories;
- operational change vs monetary consequence separation.

### API/runtime boundary
- eBOL create/update/delete HTTP semantics;
- bad-data vs not-found status;
- optionality vs nullability;
- custom-error scoping;
- partner-defined authentication/security;
- endpoint/runtime configuration boundary;
- push vs pull visibility;
- subscription and exposure scope;
- source publication-state conflict handling.

## 3. SEFL/Malkom 76-field comparison — provisional estimate

Internal frozen reference reviewed:
BOL Information Resolution Baseline v0.1 — Road LTL / Malkom.
It states that the 76 source-reported BOL fields span:
- parties / addresses / contacts;
- references;
- handling units;
- line items;
- classification;
- payment;
- instructions / service windows;
- hazardous materials;
- transport-document identifiers.

At semantic-object/family level, the current Atlas LTL-03 corpus covers all of these major categories.

The same frozen baseline explicitly records unresolved/source-context-dependent semantics for approximately 10–11 named implementation fields or field meanings, including:
Code; SHC; Related Value; BOL Type; Reference Number Type Full Name; Handling Unit Line No; Shipper Code; exact Bill To / Consignee Account Number meanings; Instruction Type; Time Critical Details.

Therefore a reasonable provisional estimate is:
- semantic object/category coverage: HIGH, approximately 85–95%;
- field-level semantic closure against the 76-field SEFL implementation: approximately 80–90%;
- exact NMFTA eBOL property-name / nesting / cardinality closure: materially lower than semantic coverage because the authoritative BOL_Request YAML/property tree has not yet been retrieved.

These are estimates, not certified percentages. The frozen SEFL baseline available in Drive describes the 76-field scope and unresolved fields but does not enumerate the complete 76-row list in the document body, so exact field-by-field coverage cannot yet be calculated from that artifact alone.

## 4. NMFTA BOL_Request schema closure attempt — 2026-09-20

Authoritative portal confirmed:
- Digital LTL eBOL 2.1 documentation page is publicly indexed;
- it explicitly identifies the source asset as assets/ebol-apiv2.1.0.yaml;
- it exposes BOL_Request and BOL_Response schema names and the controlled schema families;
- the current DSDC eBOL page offers Version 2.1 for download.

Automated retrieval limitation:
The public search/indexing channel can read the documentation wrapper but cannot retrieve the raw YAML asset body from the issuer host. A connected interactive browser was also attempted but the browser connector was not connected in this session.

This is a retrieval limitation, not evidence that the schema is unavailable.

### Manual recovery target
Retrieve the issuer-maintained Version 2.1 file named:
ebol-apiv2.1.0.yaml

Preferred route:
1. Open the official Digital LTL v2.1.0 API documentation portal.
2. Locate the displayed asset reference assets/ebol-apiv2.1.0.yaml or use the official DSDC eBOL Download Standard action.
3. Save/upload the raw YAML file without editing it.
4. Atlas will then extract BOL_Request properties, nesting, required arrays/cardinalities, references to controlled schemas and BOL_Response relationships directly from the authoritative file.
5. Preserve original filename and source URL/download date for provenance.

Do not substitute a carrier-specific Swagger schema for the missing issuer YAML. Carrier schemas may be used only for corroboration.

## 5. Residual knowledge register

### Research-close candidates — leave explicit rather than loop
- universal LTL chargeable-weight / DIM formula: no universal authoritative rule established;
- DSDC publication-state conflict: first-party pages conflict; preserve provenance/conflict;
- jurisdiction/broker/client-specific customs rules: requires separate regulatory/client authority;
- client/carrier operating policies represented by 15 client-binding requirements.

### One active source-closure item
- exact NMFTA BOL_Request property tree, nesting and cardinality from issuer YAML.

### Coverage work still required
- exact SEFL 76-field row-level crosswalk if the original 76-row source is recovered;
- ATL-35 22-task evidence/decomposition coverage matrix;
- source-derived execution queue/state-transition packaging;
- freeze-candidate assembly and reproducibility package.

## 6. Stop-control

Do not resume broad LTL-03 research from this ledger.

New research is justified only when:
1. the 22-task matrix exposes an execution-relevant dimension not covered by current primitives/families/patterns;
2. an exact SEFL field crosswalk exposes a material semantic hole;
3. the authoritative NMFTA YAML resolves or contradicts an existing gap; or
4. independent ATL-37 QA identifies a source/evidence deficiency after freeze.

This ledger is the durable answer to: what did we research, how much was materialized, and what remained.
