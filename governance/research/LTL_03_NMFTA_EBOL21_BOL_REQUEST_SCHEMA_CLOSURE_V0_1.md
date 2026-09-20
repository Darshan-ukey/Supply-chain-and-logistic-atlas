# LTL-03 — NMFTA / DSDC eBOL 2.1 BOL_Request Authoritative Schema Closure

Status: AUTHORITATIVE SOURCE RECOVERED — PRIOR KNOWLEDGE GAP RESOLVED
Date: 2026-09-20
Source file: ebol-apiv2.1.0.yaml
Source-declared title: Electronic Bill Of Lading Service
Source-declared OpenAPI: 3.0.0
Source-declared version: 2.1.0
SHA-256 of uploaded source bytes: 39715755793a2f39ee290e17f3997cb1bd7cadf001e5531f4a61093df1094e8c
Authority: NMFTA / DSDC Digital LTL eBOL 2.1 issuer schema
ATL-35 / LTL-03

## Closure decision

The previous gap `KG-NMFTA-BOL-REQUEST-PROPERTIES` is resolved by the recovered issuer-maintained YAML. Atlas may now use the exact BOL_Request property hierarchy, schema-required members and issuer-described controlled vocabularies as A-class industry-standard evidence.

This closes the **schema-retrieval gap**. It does not convert optional industry-standard properties into universally mandatory business fields, and it does not remove carrier/client specialization permitted by the standard.

## Top-level BOL_Request contract

`BOL_Request` is an object.

Schema-required top-level properties:
- bol
- version
- commodities
- payment
- origin
- destination
- billTo

Optional top-level properties:
- images
- notifications
- referenceNumbers
- shipmentTotals
- accessorials
- customsBroker

## Exact object/property structure

### bol — required object
Required:
- requestedPickupDate : string
- function : string
- isTest : boolean
- requestorRole : string

Optional:
- specialInstructions : string

Issuer semantics:
- requestedPickupDate is intended Ship Date and explicitly does **not** serve as a Pickup Request.
- function intent is Create for the submitted create request.
- requestorRole uses Requestor_Roles.

### version — required string
Issuer-described valid values: 2.0.0, 2.0.1, 2.1.0.

### images — optional object
- includeBol : boolean
- includeShippingLabels : boolean
- shippingLabels : object
  - format : string
  - quantity : integer
  - position : integer
- email : object
  - includeBol : boolean
  - includeLabels : boolean
  - addresses : array

### notifications — optional array
Each item:
- phoneNumber : string
- email : string

### referenceNumbers — optional object
- pro : string
- quoteId : string
- shipmentId : string
- masterBol : string
- trailerId : string
- manifestId : string
- bol : array
- po : array
  - number : string
  - pieces : integer
  - weight : integer
  - weightUnit : string
  - palletized : boolean
  - additionalShipperInfo : string
- additionalReferences : array
  - name : string
  - value : string

### payment — required object
Required:
- terms : string
Uses Payment_Terms.

### commodities — required object
Required:
- lineItemLayout : string
- handlingUnits : array

lineItemLayout issuer-described values:
- Nested
- Stacked

Nested means the Handling Unit / Line Item relationship is known and each associated line item is conditionally required inside its handling-unit object.
Stacked means that relationship is not known and line items may be passed within any handling-unit object.

Each handlingUnits[] item requires:
- count : integer
- type : string
- weight : integer

Optional handling-unit properties:
- tareWeight : integer
- weightUnit : string
- length : integer
- width : integer
- height : integer
- dimensionsUnit : string
- stackable : boolean
- lineItems : array

Each lineItems[] item requires:
- description : string
- weight : integer
- pieces : integer
- packagingType : string
- classification : string
- hazardous : boolean

Optional line-item properties:
- weightUnit : string
- nmfc : string
- nmfcSub : string
- hazardousDescription : string
- hazardousDetails : object

hazardousDetails optional members:
- weight : integer
- weightUnit : string
- class : string
- unnaNumber : string
- propername : string
- technicalName : string
- packingGroup : string
- contractNumber : string

### shipmentTotals — optional object
- grossWeight : integer
- netWeight : integer
- weightUnit : string
- handlingUnits : integer
- linearLength : integer
- dimensionsUnit : string
- cube : integer
- cubeDimensionsUnit : string
- declaredValue : integer
- currency : string

### accessorials — optional object
- codes : array
- hazardousDetails.emergencyContact
  - name : string
  - phone : string
- cod
  - amount : string
  - currency : string
  - terms : string
  - customerCheckAcceptable : boolean
  - remitTo
    - name, address1, address2, city, stateProvince, postalCode, country
- sortAndSegregateDetails.pieces : integer
- fullValueCoverageDetails
  - monetaryValue : string
  - currency : string
- markDetails.pieces : integer
- limitedAccessType
  - origin : string
  - destination : string
- timeCriticalDetails
  - type : string
  - date.start : string
  - date.end : string
- appointmentDetails
  - pickup.start : string
  - pickup.end : string
  - delivery.start : string
  - delivery.end : string

### origin — required object
Required:
- name
- address1
- city
- stateProvince
- postalCode
- country
- contact

Optional:
- account
- locationId
- address2

origin.contact requires phone when contact exists; contact itself is required.
Optional contact members: phoneExt, name, email.

### destination — required object
Same structural requiredness pattern as origin:
name, address1, city, stateProvince, postalCode, country, contact; contact.phone required.
Optional: account, locationId, address2, contact.phoneExt/name/email.

### billTo — required object
Same structural requiredness pattern as origin/destination:
name, address1, city, stateProvince, postalCode, country, contact; contact.phone required.
Optional: account, locationId, address2, contact.phoneExt/name/email.

### customsBroker — optional object
Optional:
- type
- name
- address1
- address2
- city
- stateProvince
- postalCode
- country
- contact

If customsBroker.contact is present, phone is schema-required within that contact object. phoneExt/name/email are optional.

## Controlled schema families in the recovered YAML

The file contains 15 component schemas:
BOL_Request, BOL_Response, Accessorial_Codes, Classification_Codes, Country_Codes, Currencies, Handling_Unit_Types, Limited_Access_Types, Payment_Terms, Packaging_Types, Requestor_Roles, Shipping_Label_Formats, State_Province_Codes, Time_Critical_Types, Result_Status_Codes.

Issuer-described vocabularies include:
- Requestor_Roles: Shipper, Consignee, Third Party.
- Payment_Terms: Prepaid, Collect, Third Party.
- Country_Codes: CAN, USA, MEX.
- Currencies: CAD, MXN, USD.
- Classification_Codes: standard class values 50 through 500 plus Not required.
- Time_Critical_Types: Deliver On Date; Deliver On or After Date; Deliver By Date; Delivery Window.
- Shipping_Label_Formats: Avery, Letter, Zebra representations.
- Result_Status_Codes: logical status families including informational, warning, data/format/business/carrier failures and specific operational failures such as Duplicate Pro and Duplicate PO.
- Accessorial_Codes includes appointment, COD, expedited, full-value coverage, guarantee, hazmat, inside service, in-bond, liftgate, limited access, notify, overdimension, temperature protection, residential, sort/segregate, single-shipment and time-critical categories.
- Handling_Unit_Types and Packaging_Types provide issuer-described packaging/handling vocabularies.
- State_Province_Codes and Limited_Access_Types provide issuer-described controlled values.

Important representation note: these controlled values are documented in schema descriptions rather than expressed as OpenAPI `enum` arrays. Atlas should preserve that source representation and not falsely claim the YAML uses formal enum constraints.

## BOL_Response

Top-level properties:
- version
- transactionDate
- referenceNumbers
- scac
- images
- termsAndConditions
- messageStatus
- resultStatusCodes

The recovered file therefore also closes the prior uncertainty that BOL_Request/BOL_Response were only named schema families without inspectable property structure.

## Material reconciliation against existing Atlas semantics

Confirmed / strengthened:
1. Handling Unit and Line Item are distinct hierarchical objects.
2. Piece count belongs to Line Item; handling-unit count belongs to Handling Unit.
3. PRO is one member of a broader typed reference structure.
4. NMFC, NMFC subitem, classification, packaging and hazardous attributes belong to line-item context.
5. shipmentTotals are separate from handling-unit and line-item measures.
6. Origin, Destination, BillTo and CustomsBroker are distinct role-bearing location/party structures.
7. Accessorial service detail, appointment windows and time-critical windows are nested operational objects.
8. requestedPickupDate must not be interpreted as a pickup request.
9. Requiredness is hierarchical: top-level requiredness, required nested object members, and conditional relationship semantics must not be flattened.
10. `lineItemLayout` explicitly governs whether handling-unit/line-item association is known.

No evidence in the YAML supports inventing:
- a universal DIM divisor;
- client-specific account meaning;
- legal customs-clearance decisions;
- carrier-specific source precedence;
- liability/charge outcomes merely from an accessorial or exception code.

## Graph materialization decision

Reuse existing primitives and rule families. No new semantic primitive or reusable execution pattern is required.

Materialize schema evidence/facts/rules around:
- exact BOL_Request hierarchy and requiredness;
- hierarchical requiredness/cardinality;
- lineItemLayout relationship semantics;
- role-specific location/contact structure;
- requestedPickupDate vs pickup-request boundary;
- issuer-described controlled vocabularies;
- exact referenceNumbers hierarchy.

Resolve `KG-NMFTA-BOL-REQUEST-PROPERTIES`; retain all unrelated knowledge gaps.

## Provenance control

The SHA-256 above fingerprints the exact uploaded bytes used for this extraction. Any later schema claiming to be eBOL 2.1.0 should be compared against this hash or explicitly versioned as a different source artifact.
