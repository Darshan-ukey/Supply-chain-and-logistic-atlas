# LTL-03 Domain Execution Contract — Contextualization v0.1

Date: 2026-09-20
Workstream: ATL-35
Canonical task: LTL-03 — Create and validate shipment, consignment and transport-document identity
Status: RESEARCH CANDIDATE — NOT FROZEN

## Purpose

Define the technology-neutral contextualization logic that sits between document extraction and downstream execution.

This layer does not improve OCR directly. It determines what extracted values mean, how they relate, whether they are valid, when they may be corrected/enriched, and when human judgment remains necessary.

## Three-layer placement

Layer 1 — Work Decomposition
Defines the business work.

Layer 2 — Domain Execution Contract
Defines the contextual knowledge/rules required to perform the work correctly.

Layer 3 — Tool Projection
Projects the same contract into Malkom/IDP, RPA, AI agent, API or workflow configuration.

## Contextualization decision classes

Every extracted field/value should be processed through up to four distinct tests:

1. Presence
Is required information present?

2. Value validity
Is the extracted value syntactically/semantically valid against authoritative rules, code sets or client constraints?

3. Relationship validity
Does the value reconcile with related business objects, identifiers, masters and other fields?

4. Lifecycle/state validity
Is the requested interpretation/action permitted at the object's current lifecycle state?

Do not collapse these into one generic validation result.

## Resolution authority classes

Each extracted value or unresolved decision must be classified as:

A. INDUSTRY_DOMAIN_RESOLVABLE
Resolvable from authoritative industry/domain rules, standards, code sets or regulations.

B. CLIENT_CARRIER_RESOLVABLE
Requires client/carrier-specific SOP, tariff, operating logic, thresholds or business rules.

C. MASTER_REFERENCE_RESOLVABLE
Requires governed master/reference data such as customer, location, commodity, carrier, SCAC/SPLC or client reference tables.

D. HUMAN_JUDGMENT_REQUIRED
Remains genuinely ambiguous after all governed sources are exhausted.

This classification is a required execution-readiness output.

## Contextualization examples

### Shipper / consignor identity

Inputs:
- extracted name
- extracted address
- postal code
- LocationID if present
- account/reference identifiers

Context:
- approved shipper/customer/location masters
- partner-scoped LocationID rules
- shipment/reference relationships

Candidate logic:
- normalize extracted name/address;
- search approved master using multiple attributes;
- resolve only when one permitted candidate remains;
- preserve extracted value separately from canonicalized value;
- record correction provenance.

Possible outcomes:
- RESOLVED_EXACT
- RESOLVED_BY_MASTER
- AMBIGUOUS_IDENTITY
- NO_MASTER_MATCH
- SOURCE_CONFLICT

### Consignee identity

Inputs:
- extracted consignee name/address/location information
- shipment/booking/PRO/reference context

Candidate logic:
- resolve against consignee/location master where available;
- use destination/postal/reference relationship to disambiguate;
- do not select a candidate solely from weak fuzzy-name similarity;
- escalate when multiple valid candidates remain.

### Reference / identifier contextualization

Inputs:
- booking reference
- PRO
- BOL/document number
- customer/PO/reference numbers

Candidate logic:
- identify reference type and assigning authority;
- validate uniqueness in correct scope;
- validate expected parent/child/cross-reference relationships;
- distinguish missing assignment from not-found lookup and conflicting relationship;
- never treat all reference numbers as interchangeable strings.

### Commodity / line-item contextualization

Inputs:
- extracted commodity text
- pieces/handling units
- weights
- dimensions
- packaging
- NMFC/class if present
- hazmat indicators/data

Context:
- NMFC/commodity knowledge
- handling-unit definitions
- client commodity masters where governed
- hazardous-material rules where applicable

Candidate logic:
- separate handling-unit quantity from piece count;
- map commodity description to commodity semantic object;
- validate NMFC/class relationship when governed evidence exists;
- keep declared/verified/billing weights as distinct semantic attributes when they differ;
- activate hazmat contract only when applicable;
- do not silently infer authoritative commodity classification from weak text similarity.

### Handling unit / piece relationship

Authoritative NMFTA terminology distinguishes handling units from pieces.

Candidate logic:
- pallet/skid may be a handling unit containing multiple pieces;
- do not map "4 pallets" automatically to pieceCount=4;
- validate handling-unit count, package count and piece count as distinct quantities unless client/source evidence equates them.

### Hazmat branch

When hazardous-material rules apply:
- require applicable basic-description elements;
- validate authoritative reference values;
- validate relationship to the relevant commodity/item;
- validate required sequence/order where generating or validating shipping-paper representation;
- preserve commodity/NMFC classification separately from hazmat regulatory description.

## Correction vs enrichment rules

For each field, Atlas must distinguish:

EXTRACTED_VALUE
What the document/IDP produced.

CANONICAL_VALUE
Governed normalized/resolved value.

CORRECTION_REASON
Why Atlas permits a change.

CORRECTION_AUTHORITY
Master, industry rule, client rule, regulatory rule or human decision.

CONFIDENCE
If probabilistic matching is involved.

PROVENANCE
Source(s) used to resolve the value.

No automatic correction should overwrite the source value without retaining this trace.

## Contextualization output contract

Each field/object should yield:
- extracted value;
- normalized value;
- canonical value, if resolved;
- semantic object/field;
- evidence class;
- resolution authority class;
- master/reference used;
- rule(s) fired;
- relationship checks;
- lifecycle/state check;
- confidence if probabilistic;
- disposition: accept / correct / enrich / warn / reject / escalate;
- exception code;
- queue;
- audit evidence.

## BOL proof metrics

Compare extraction-only vs extraction + Atlas Domain Execution Contract using:
- raw extraction accuracy;
- post-contextualization accuracy;
- auto-correction rate;
- auto-enrichment rate;
- ambiguity-resolution rate;
- false-correction rate;
- human-exception rate;
- touchless/billable completion rate.

False correction must be tracked separately; increasing touchless rate by making unsafe corrections is not success.

## Current authoritative anchors

- 49 CFR 373.101: regulatory BOL minimum information.
- NMFTA/DSDC eBOL 2.1: lifecycle, PRO behavior, LocationID behavior, carrier-specific constraint specialization, controlled schema families.
- NMFTA/NMFC terminology: handling unit and freight-classification semantics.
- PHMSA/49 CFR 172.202: conditional hazmat description content/sequence rules.
- UN/CEFACT transport models: distinct business objects and identifier/party/location/consignment semantics.

## Next research

1. Expand contextualization logic field-by-field for:
   - reference/identifier;
   - party;
   - origin/destination/location;
   - handling unit/package;
   - commodity/line item.
2. Assign each rule to industry, client/carrier, master/reference or human-judgment authority class.
3. Identify the minimum master-data interfaces required by Malkom projection.
4. Derive correction/enrichment thresholds and exception queues.
5. Only after independent contract stabilization, test against SEFL 76 fields.
