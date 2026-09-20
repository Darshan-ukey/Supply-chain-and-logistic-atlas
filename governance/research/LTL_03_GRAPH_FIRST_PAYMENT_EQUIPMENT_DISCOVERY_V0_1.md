# LTL-03 Graph-First Discovery — Payment Arrangement & Transport Equipment v0.1

Date: 2026-09-20
Workstream: ATL-35
Status: RESEARCH CANDIDATE — GRAPH-FIRST INTAKE

## Discovery A — Payment Arrangement

### Evidence

UN/CEFACT / UNCL 4237 defines Transport Service Payment Arrangement with controlled values including:
- A = Payable elsewhere;
- B = Third party to pay;
- C = Collect;
- P = Prepaid.

UN/CEFACT D23B models Payment Arrangement Code as an optional consignment/service semantic.

NMFTA eBOL 2.1 separately confirms a Payment_Terms schema family, but exact BOL_Request property placement remains unresolved.

### Domain facts

DF-PAYMENT-ARRANGEMENT-CONTROLLED:
Payment arrangement is a controlled semantic, not arbitrary free text.

DF-PAYMENT-ARRANGEMENT-ROLE:
The code carries operational meaning about who/where freight charges are expected to be paid.

### Primitive mapping
- Controlled Vocabulary
- TransportService
- Party/Relationship where payer role is resolved
- MonetaryAmount where charges are also present

### Family composition
- RF5 Controlled-Value Validation
- RF2 Relationship Integrity
- RF17 Monetary Amount / Charge Semantics when monetary charge exists
- RF11 Client Specialization for client/carrier mapping

### Normalization result
New family required: 0.

## Discovery B — Logistics Transport Equipment

### Evidence

UN/CEFACT D23B models Logistics Transport Equipment as a first-class business object used to hold/protect/secure cargo.

Attributes include:
- equipment identifier;
- loaded package quantity;
- equipment category code (e.g. container/trailer category);
- equipment characteristic code;
- sealed indicator;
- returnable indicator.

### Domain facts

DF-TRANSPORT-EQUIPMENT-OBJECT:
Transport equipment is distinct from package/handling-unit semantics.

DF-TRANSPORT-EQUIPMENT-PACKAGE-RELATION:
Transport equipment can carry a loaded-package quantity and therefore relates to package/handling-unit structures.

DF-TRANSPORT-EQUIPMENT-INDICATORS:
Sealed and returnable are indicator semantics owned by Transport Equipment.

### New semantic primitive candidate — TransportEquipment

TransportEquipment(
  identifier?,
  category?,
  characteristics?,
  loadedPackageQuantity?,
  sealed?,
  returnable?,
  semanticOwner,
  source,
  lifecycleStage,
  confidence
)

Why separate from Package:
Transport Equipment is the equipment that holds/protects/secures cargo; a package/handling unit is cargo packaging/handling structure. Their identity, hierarchy, and operational roles differ.

### Family composition
- RF1 Identity & Reference Resolution;
- RF2 Relationship Integrity;
- RF4 Requiredness/Cardinality;
- RF5 Controlled-Value Validation;
- RF12 Aggregate Reconciliation for loaded-package quantity where applicable;
- RF14 Hierarchy where equipment/package relationships require structure;
- RF9 Source Authority;
- existing Indicator primitive for sealed/returnable.

### Generated instances
- resolve equipment identifier;
- validate equipment category/characteristics;
- capture/validate sealed and returnable indicators;
- reconcile loaded-package quantity to package collection where semantics support it;
- bind equipment to consignment/movement/package structures.

### Normalization result
New primitive candidate: TransportEquipment.
New family required: 0.

## Cross-family relationship implications

Payment arrangement:
RF5 validates code
COMPOSES_WITH RF17 when a monetary charge exists
and RF2 where paying-party relationships are explicit.

Transport equipment:
RF1 resolves equipment identity;
RF2 binds equipment to consignment/package/movement;
RF5 validates equipment category/characteristics;
RF12 depends on valid package/equipment ownership before reconciliation;
Indicator semantics represent sealed/returnable.

No execution logic is admitted outside the graph.
