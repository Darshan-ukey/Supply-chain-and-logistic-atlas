# LTL-03 Information Object Taxonomy v0.1

Date: 2026-09-20
Workstream: ATL-35
Canonical task: LTL-03 — Create and validate shipment, consignment and transport-document identity
Status: RESEARCH CANDIDATE — NOT FROZEN
Method: Source-derived first; SEFL 76-field list intentionally not used yet.

## Governing rule

Fields must be attached to canonical business/information objects and lifecycle transitions. Do not treat a BOL as one flat document record.

## Candidate canonical information objects

### 1. Shipment / Consignment
Purpose: represent the separately identifiable goods movement / transport-contract subject.

Source-supported attributes include:
- consignment/shipment identifier;
- consignor-assigned identifier;
- carrier-assigned identifier;
- freight-forwarder-assigned identifier;
- gross weight;
- net weight where applicable;
- gross volume;
- package quantity;
- consignment item quantity;
- COD amount where applicable;
- consignment information text;
- contract / carriage references;
- pickup/delivery relationship.

Execution relevance:
- establishes primary business object;
- binds document, party, location and cargo objects;
- provides reference reconciliation anchor.

### 2. Reference / Identifier
Purpose: governed identity graph across booking, PRO, BOL and other references.

Candidate attributes:
- reference value;
- reference type;
- assigning party;
- assigning system/scheme;
- related business object;
- parent/child or cross-reference relation;
- uniqueness scope;
- lifecycle status;
- valid from/to;
- creation event;
- source authority.

Execution relevance:
- assignment;
- lookup;
- duplicate detection;
- reconciliation;
- not-found routing;
- cross-system correlation.

### 3. Transport Document / BOL
Purpose: represent the transport document independently from the consignment itself.

Candidate attributes:
- document identifier;
- document type/code;
- issue date/time;
- document status;
- revision/version identifier;
- previous-revision linkage;
- remarks;
- associated/referenced documents;
- requestor role;
- lifecycle action (create/update/delete-cancel).

Execution relevance:
- document lifecycle;
- amendment/version control;
- evidence/audit;
- update/delete identity lookup.

### 4. Party
Candidate roles:
- consignor/shipper;
- consignee;
- carrier;
- third-party/requestor;
- freight forwarder/broker where applicable;
- payer/bill-to party where applicable.

Candidate attributes:
- party identifier;
- party name;
- role;
- address/contact;
- relevant registrations/account identifiers.

Execution relevance:
- role validation;
- source authority;
- billing/payment responsibility;
- pickup/delivery identity.

### 5. Location / Address
Candidate roles:
- origin;
- destination;
- pickup location;
- delivery location;
- terminal/other operational location where applicable.

Candidate attributes:
- location identifier;
- address;
- city/state/province/postal/country;
- location type;
- contact details;
- carrier/client location master reference.

Execution relevance:
- location resolution;
- master-data validation;
- routing;
- limited-access or service applicability.

### 6. Consignment Item / Commodity
Candidate attributes:
- commodity description;
- NMFC item;
- NMFC subprovision where applicable;
- freight class;
- item quantity;
- weight;
- volume/dimensions where applicable;
- shipping form/packaging context;
- special markings/commodity-specific information.

Execution relevance:
- classification;
- rating inputs;
- description completeness;
- commodity-level validation;
- conditional regulatory routing.

### 7. Handling Unit / Package
Candidate attributes:
- handling-unit count;
- piece count;
- package count;
- handling-unit type;
- packaging type;
- length/width/height/extreme dimensions;
- handling-unit weight;
- shipping marks/labels.

Execution relevance:
- density/class validation;
- piece-vs-handling-unit reconciliation;
- packaging validation;
- label generation/verification.

### 8. Service / Handling / Accessorial Instruction
Candidate attributes:
- accessorial codes;
- special-handling instructions;
- limited-access type;
- time-critical type;
- delivery/pickup instructions;
- temperature or other handling settings where applicable.

Execution relevance:
- conditional service rules;
- queue/exception routing;
- additional data requirements;
- downstream service configuration.

### 9. Payment / Charge Terms
Candidate attributes:
- payment terms;
- prepaid/collect indicator or equivalent;
- payer role;
- COD amount where applicable;
- currency where applicable.

Execution relevance:
- commercial responsibility;
- billing handoff;
- validation against client/carrier rules.

### 10. Dangerous Goods / Hazmat — conditional
Candidate attributes:
- UN/NA identification number;
- proper shipping name / technical name as applicable;
- hazard class/division;
- packing group where applicable;
- regulation code;
- quantity;
- package type;
- emergency/transport expert contact where required;
- special handling information.

Execution relevance:
- regulatory conditional branch;
- required-information expansion;
- specialist validation;
- reject/escalate rules.

### 11. Associated / Supporting Document
Source model supports associated documents such as dangerous-goods notes, certificates/licences and other referenced transport documents.

Candidate attributes:
- document identifier;
- document type/code;
- issue date/time;
- remarks;
- relationship to consignment/BOL.

Execution relevance:
- documentary prerequisite;
- evidence completeness;
- retrieval/attachment requirement.

## Regulatory minimum for U.S. motor-carrier BOL

49 CFR 373.101 establishes minimum information:
- consignor name;
- consignee name;
- origin;
- destination;
- number of packages;
- freight description;
- weight/volume/measurement when applicable to rating.

These are minimum legal information requirements, not the complete LTL execution field universe.

## NMFTA/NMFC enrichment

Current NMFTA public guidance additionally identifies BOL information including:
- commodity description;
- NMFC item/class;
- piece count;
- extreme dimensions;
- weight;
- packaging;
- hazmat information when applicable;
- special handling/accessorial information when applicable.

Current NMFC guidance further distinguishes piece count from handling-unit count and emphasizes accurate weight/dimensions. Commodity descriptions should align to applicable NMFC tariff/item/subprovision/class requirements.

## eBOL schema families

NMFTA Digital LTL eBOL 2.1 publishes BOL_Request/BOL_Response plus controlled schema/code families including:
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

Exact BOL_Request property-level extraction remains an open subtask; public documentation confirms the schema artifact and code families.

## Initial execution-condition mapping

For every field/object relation classify:
1. Presence — is required information present?
2. Validity — does it conform to datatype/code/business rule?
3. Relationship — does it reconcile with related identifiers/objects?
4. State — is the requested action allowed in current lifecycle state?

## Next actions

1. Extract exact eBOL BOL_Request properties if accessible through issuer artifact/source.
2. Expand each object into a field-level source/provenance matrix.
3. Classify mandatory/optional/conditional by source and lifecycle action.
4. Build cardinalities and object relationships.
5. Build field-level source-authority/precedence candidates.
6. Derive rules, exceptions and queues.
7. Only then compare against SEFL's 76 BOL fields.
