# LTL-03 Field Provenance Matrix v0.1

Date: 2026-09-20
Workstream: ATL-35
Status: RESEARCH CANDIDATE — NOT FROZEN
SEFL 76-field list: NOT USED

## Evidence classes

A — CURRENT_ISSUER_EXPLICIT
Current authoritative issuer explicitly documents the property, behavior, rule or lifecycle requirement.

B — CURRENT_ISSUER_SCHEMA_FAMILY
Current authoritative issuer confirms the schema/object/code family, but exact property-level definition is not yet independently extracted from the issuer artefact.

C — IMPLEMENTATION_CORROBORATION_ONLY
Carrier/implementation/public mirror demonstrates a plausible implementation or older standard structure. Useful for completeness testing only; must not become canonical unless promoted by authoritative evidence.

## Current A-class findings

### referenceNumber.pro
Source: NMFTA/DSDC eBOL FAQ.
Semantics:
- PRO returned for reference after eBOL submission.
- Requestor may provide a pre-assigned PRO.
- If omitted, carrier can assign one.
- Check digit should be included when applicable.
Lifecycle relevance:
- create identity binding;
- lookup for update/delete per current eBOL guidance.
Execution implications:
- PRO_PRESUPPLIED validation path;
- CARRIER_PRO_ASSIGNMENT path;
- PRO_NOT_RESOLVED exception;
- PRO lookup before update/delete.

### LocationID
Source: NMFTA/DSDC eBOL FAQ.
Semantics:
- optional;
- assigned to a location by shipper/carrier;
- unique within an organization, not industry-global;
- format/length dependent on business process.
Execution implications:
- uniqueness scope = assigning organization;
- must not be globally validated as unique;
- client/carrier may elevate optional to mandatory;
- location-master lookup and reconciliation may be client-bound.

### HTTP lifecycle
Source: NMFTA/DSDC eBOL 2.1.
- POST = create.
- PUT = update.
- DELETE = cancel/delete.
- function variable CREATE/UPDATE/DELETE exists but REST verbs are recommended.
Execution implications:
- distinct lifecycle transitions;
- state/permission checks before update/delete.

### Error semantics
Source: NMFTA/DSDC eBOL FAQ.
- bad BOL data -> HTTP 400 recommended;
- BOL not found on update/delete -> HTTP 404 recommended;
- multiple validation issues may be returned;
- failure errors should precede informational/warning responses.
Execution implications:
- separate DATA_VALIDATION_FAILURE from IDENTITY_NOT_FOUND;
- multiple-error collection can produce one validation work item with multiple defects rather than multiple duplicate queue items.

### Client/carrier specialization
Source: NMFTA/DSDC eBOL FAQ.
- non-mandatory standard field may be made mandatory by carrier business process;
- backend-specific min/max string constraints are allowed;
- truncation may produce warning or error.
Execution implications:
- canonical requiredness is separate from client/carrier requiredness;
- client binding may strengthen constraints;
- warning vs failure disposition must be explicitly configured.

## Current B-class findings

NMFTA eBOL 2.1 confirms the presence of BOL_Request/BOL_Response and controlled schema/code families including:
- Accessorial_Codes
- Classification_Codes
- Country_Codes
- Currencies
- Handling_Unit_Types
- Limited_Access_Types
- Payment_Terms
- Packaging_Types
- Requestor_Roles
- Shipping_Label_Formats
- State_Province_Codes
- Time_Critical_Types
- Result_Status_Codes

These establish governed semantic/code families but exact request properties/cardinality remain pending issuer-artifact extraction.

## C-class corroboration — NOT canonical

A public Saia BOL schema implementation/mirror exposes structures consistent with the taxonomy, including:
- top-level bol, version, payment, commodities, origin, destination;
- referenceNumbers with pro, quoteId, PO and additional references;
- commodities with lineItemLayout, handlingUnits and lineItems;
- accessorials and hazardous details;
- origin/destination objects with account/locationId/address/contact structures.

Use only to:
- test whether Atlas taxonomy is missing object families;
- identify authoritative-source questions to research;
- test client-binding patterns.

Do NOT:
- copy Saia-specific requiredness, limits, unsupported-field comments or tariff rules into canonical Atlas;
- infer current NMFTA 2.1 exact field set from this implementation.

## First field-level execution logic pattern

For each field:
1. Canonical semantic object.
2. Evidence class.
3. Standard requiredness.
4. Client/carrier requiredness override.
5. Datatype/format.
6. Controlled vocabulary.
7. Cardinality.
8. Lifecycle actions where applicable.
9. Source authority.
10. Presence validation.
11. Value validation.
12. Relationship validation.
13. State validation.
14. Failure severity: warning/failure.
15. Exception code.
16. Queue routing.
17. Remediation authority.
18. Evidence retained.

## Initial mechanically derivable queues from A-class evidence

- BOL_CREATE_VALIDATION
  Basis: create request + field validation.

- BOL_UPDATE_VALIDATION
  Basis: update request + field validation.

- BOL_DELETE_VALIDATION
  Basis: delete request + identity/state validation.

- BOL_DATA_VALIDATION_EXCEPTION
  Basis: authoritative HTTP 400 bad-data semantics.

- BOL_IDENTITY_NOT_FOUND
  Basis: authoritative HTTP 404 for update/delete missing BOL.

- PRO_ASSIGNMENT_REQUIRED
  Basis: no pre-assigned PRO and carrier assignment path unresolved.

- LOCATION_ID_RECONCILIATION
  Basis: only when client binding requires/uses LocationID and lookup/reconciliation fails.

These queue names are Atlas candidate labels; their source basis is authoritative, but names remain subject to canonical queue taxonomy governance.

## Next research

1. Obtain issuer artefact or another issuer-explicit source for exact BOL_Request properties.
2. Build object-to-field matrix using A/B evidence only for canonical claims.
3. Use C-class implementations solely as completeness probes.
4. Derive queue logic from A-class lifecycle/error/requiredness rules.
5. Preserve field-evidence class in all downstream WorkDefinitions.
6. Crosswalk to SEFL 76 fields only after independent field universe stabilizes.
