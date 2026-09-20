# LTL-03 Graph-First Discovery — Classification / Limited Access / Time Critical v0.1

Date: 2026-09-20
Workstream: ATL-35
Status: RESEARCH CANDIDATE — GRAPH-FIRST INTAKE

## Track A — authoritative evidence

### NMFTA eBOL 2.1 controlled families

Issuer documentation explicitly confirms these schema families:
- Classification_Codes
- Limited_Access_Types
- Time_Critical_Types
- Handling_Unit_Types
- Packaging_Types
- Requestor_Roles
- Accessorial_Codes
- Payment_Terms
- Shipping_Label_Formats
- Result_Status_Codes
- Country_Codes
- Currencies
- State_Province_Codes

Evidence strength:
B — current issuer schema-family evidence.

What is NOT yet verified:
- exact BOL_Request property names;
- exact nesting;
- exact requiredness/cardinality;
- which object owns each code;
- whether any code family is singular/repeating;
- whether one family is semantically equivalent to a UN/CEFACT object/attribute.

### UN/CEFACT corroborating semantics

UN/CEFACT D23B Transport Service is a repeating 0..n object with controlled:
- condition type;
- priority;
- service requirement;
- payment arrangement;
- contract movement type;
- reason.

UN/CEFACT package semantics separately define package type and hierarchy level.

UN/CEFACT party-role semantics include a Requestor role.

## Track B — normalization decisions

### Classification_Codes

Current decision:
Treat as a controlled-vocabulary family only.

Do not infer:
- NMFC class;
- exact classification object;
- requiredness;
- relation to commodity;
- relation to rating;
- relation to hazmat.

Likely normalized composition once property ownership is known:
- RF5 Controlled-Value Validation;
- RF2 Relationship Integrity;
- RF9 Source Authority;
- possibly RF11 Client Specialization.

No new family yet.

### Limited_Access_Types

Current decision:
Treat as controlled vocabulary only.

Do not infer exact location/service ownership.

Potential composition once ownership is established:
- SP-LOCATION and/or SP-TRANSPORT-SERVICE;
- RF5 code validation;
- RF2 relationship;
- RF7 conditional activation if code activates downstream requirements;
- RF11 client specialization.

No new family yet.

### Time_Critical_Types

Current decision:
Treat as controlled vocabulary only.

Do not infer:
- promised delivery time;
- service-level deadline;
- guaranteed service;
- appointment semantics;
- exact temporal field linkage.

Potential composition once property placement is known:
- SP-TRANSPORT-SERVICE;
- SP-TEMPORAL-VALUE if actual time/date semantics are linked;
- RF5 controlled-value validation;
- RF18 temporal/version family only if the type governs temporal semantics;
- RF7 conditional activation where service type activates requirements.

No new family yet.

### Handling_Unit_Types

Current decision:
Schema-family existence is verified, but do not equate with UN/CEFACT Package Type.

Potential mapping remains unresolved:
- Package / Handling Unit primitive;
- RF5 controlled code;
- RF2 relationship;
- RF14 hierarchy only if evidence shows hierarchy linkage.

### Requestor_Roles

UN/CEFACT provides independent support for Requestor as a party role.
NMFTA independently confirms Requestor_Roles schema family.

This is a stronger cross-source relationship:
NMFTA CORROBORATES a controlled requestor-role family;
UN/CEFACT establishes role semantics.

Still do not infer exact BOL_Request property/cardinality.

## New graph facts

DF-NMFTA-CLASSIFICATION-FAMILY:
NMFTA exposes a Classification_Codes controlled schema family, but exact semantic ownership remains unresolved.

DF-NMFTA-LIMITED-ACCESS-FAMILY:
NMFTA exposes Limited_Access_Types; exact owner/activation semantics remain unresolved.

DF-NMFTA-TIME-CRITICAL-FAMILY:
NMFTA exposes Time_Critical_Types; exact temporal/service relationship remains unresolved.

DF-NMFTA-HANDLING-UNIT-FAMILY:
NMFTA exposes Handling_Unit_Types; equivalence to package type is not established.

DF-REQUESTOR-CROSS-SOURCE:
NMFTA Requestor_Roles and UN/CEFACT Requestor party-role evidence are mutually corroborating at the role-family level, while exact eBOL property placement remains unresolved.

## Knowledge-gap implication

The same root gap blocks all five property-level mappings:
KG-NMFTA-BOL-REQUEST-PROPERTIES.

This gap should explicitly BLOCK:
- canonical field ownership;
- exact cardinality;
- exact requiredness;
- precise object nesting;
- direct generator-instance promotion for these NMFTA families.

## Normalization result

New primitive required: 0.
New family required: 0.

The correct action is to retain these as controlled-family evidence plus explicit knowledge-gap edges rather than prematurely manufacturing field-level rules.
