# LTL-03 Graph-First Discovery — Transport Service / Accessorial Semantics v0.1

Date: 2026-09-20
Workstream: ATL-35
Status: RESEARCH CANDIDATE — GRAPH-FIRST INTAKE

## Track A — authoritative evidence

### UN/CEFACT D23B Transport Service

UN/CEFACT models Supply Chain Consignment -> Transport Service as a repeating relationship (0..n).

Transport Service may include:
- description text;
- condition type code;
- priority code;
- service requirement code;
- payment arrangement code;
- contract movement type code;
- reason code;
- charge amount.

This demonstrates that a transport service/accessorial requirement is not merely a flat code value. It can be a repeating business object with its own attributes and monetary semantics.

### NMFTA eBOL 2.1 controlled schema families

NMFTA issuer documentation confirms schema families:
- Accessorial_Codes;
- Payment_Terms;
- Time_Critical_Types;
- Limited_Access_Types;
- Handling_Unit_Types;
- Packaging_Types;
- Classification_Codes;
- Requestor_Roles;
- Shipping_Label_Formats;
- Result_Status_Codes;
- Country_Codes;
- Currencies;
- State_Province_Codes.

Evidence class:
B — CURRENT_ISSUER_SCHEMA_FAMILY.

Important boundary:
The issuer page confirms the controlled families but does not expose exact BOL_Request property placement/cardinality in the currently retrievable documentation.

Do not infer that a particular schema family is mandatory, singular, nested at a specific location, or equivalent to a UN/CEFACT Transport Service object until property-level issuer evidence is recovered.

## Track B — normalization

### New semantic primitive candidate — TransportService

Candidate:

TransportService(
  serviceType?,
  requirementCode?,
  conditionType?,
  priority?,
  paymentArrangement?,
  movementType?,
  reason?,
  description?,
  charge?,
  semanticOwner,
  source,
  lifecycleStage,
  confidence
)

Why a primitive is justified:
Transport Service is a reusable first-class business object, distinct from:
- a Controlled Vocabulary value;
- a MonetaryAmount;
- a free-text instruction.

### New rule family decision

No new reusable rule family is required at this point.

TransportService behavior can be composed from:
- RF2 Relationship Integrity;
- RF4 Requiredness & Cardinality;
- RF5 Controlled-Value Validation;
- RF17 Monetary Amount / Charge Semantics;
- RF9 Source Authority;
- RF11 Client Specialization.

If future evidence introduces materially distinct service-eligibility, service-combination, or service-performance rules that cannot be expressed compositionally, reconsider a dedicated family.

## Domain facts

DF-TRANSPORT-SERVICE-REPEATS:
A consignment may carry 0..n Transport Service objects.

DF-TRANSPORT-SERVICE-COMPOSITE:
A Transport Service may carry multiple controlled semantics and an optional charge rather than being one flat accessorial code.

DF-NMFTA-CONTROLLED-FAMILIES:
NMFTA eBOL 2.1 explicitly publishes accessorial/payment/time-critical/handling-unit/packaging/classification and other controlled schema families, but exact BOL_Request placement remains unresolved.

## Generated instances

GI-TRANSPORT-SERVICE-COLLECTION:
Instantiate repeating Transport Service children and bind them to consignment.

GI-TRANSPORT-SERVICE-VALIDATE:
Validate condition/priority/requirement/payment/movement/reason controlled values where present.

GI-TRANSPORT-SERVICE-CHARGE:
Validate and relate optional service charge through MonetaryAmount/RF17.

## Cross-family relationship

TransportService object
-> RF4 establishes repeating cardinality;
-> RF2 binds service to consignment;
-> RF5 validates controlled service attributes;
-> RF17 validates optional charge;
-> RF9 constrains authority if competing service instructions exist;
-> RF11 applies client/carrier specialization.

No standalone accessorial logic is created.

## Scope

Generic TransportService semantics are admitted to the broader independent BOL/domain universe.

Exact NMFTA accessorial/payment/time-critical field placement remains a knowledge gap until the issuer BOL_Request schema body is recovered.

## Normalization result

New semantic primitive candidate: TransportService.
New reusable rule family required: 0.
Existing catalogue reused compositionally.
