# LTL-03 Domain Execution Contract v0.2

Date: 2026-09-20
Workstream: ATL-35
Status: RESEARCH CANDIDATE — GENERATED/ASSEMBLED FROM GOVERNED RULES, NOT FROZEN

## Purpose

First assembled Domain Execution Contract for:

**LTL-03 — Create and validate shipment, consignment and transport-document identity**

This contract is technology-neutral. It defines what an executor must know and validate. Tool-specific behavior belongs in Tool Projection.

Canonical generation chain:

Authoritative Sources
-> Governed Domain Primitives
-> Deterministic Generator Rules
-> Recursive P6.1 Work Decomposition
-> Domain Execution Contract
-> Tool Projection

## Source basis

Primary evidence classes used here:
- CURRENT_ISSUER_EXPLICIT — current issuer explicitly documents property/rule/lifecycle.
- CURRENT_ISSUER_SCHEMA_FAMILY — issuer confirms schema/object/code family but exact property extraction may remain pending.

Current primary authoritative evidence:
1. NMFTA Digital LTL eBOL 2.1.0 — eBOL lifecycle, PRO, schemas/code families.
2. NMFTA Digital LTL FAQ — create/update/delete semantics, error behavior, LocationID scope, PRO assignment/reference.
3. UN/CEFACT D23B transport-logistics semantic models — consignment, consignment item, package, party/location relationships, cardinalities, measures.
4. Applicable U.S. regulation/PHMSA evidence is incorporated where separately established in the regulatory rule artifacts.

## 1. Canonical business objects

### 1.1 Consignment / Shipment
Definition basis: separately identifiable collection of goods under one transport contract.

Candidate canonical attributes/relationships:
- carrier-assigned identifier;
- consignor-assigned identifier;
- other governed references;
- gross weight;
- gross volume;
- package quantity;
- included consignment items;
- consignor;
- consignee;
- carrier;
- origin/pickup/acceptance locations;
- consignee-receipt/final-destination locations;
- transport document(s);
- service/handling/accessorial instructions;
- applicable conditional regulatory information.

### 1.2 Transport Document / BOL
Represents transport-document identity and lifecycle, not merely a flat field container.

Lifecycle evidence from NMFTA eBOL:
- create via POST;
- update via PUT using PRO;
- delete/cancel via DELETE using PRO.

Required contract behavior:
- establish document identity;
- bind document to consignment;
- preserve document version/lifecycle;
- resolve update/delete target;
- prevent update/delete against unresolved identity;
- preserve evidence of transition.

### 1.3 Reference / Identifier
Attributes:
- value;
- reference type;
- assigning party/system;
- uniqueness scope;
- related object;
- relationship type;
- lifecycle state;
- provenance/evidence.

PRO-specific behavior:
- may be pre-assigned;
- carrier may assign when absent;
- returned/used as shipment/document reference;
- used for eBOL update/delete.

LocationID-specific behavior:
- optional at industry level;
- assigned within shipper/carrier system;
- not globally unique;
- client/carrier may impose stricter use.

### 1.4 Party
Role-specific party objects include:
- consignor/shipper;
- consignee;
- carrier;
- freight forwarder/requestor where applicable.

Party role and party identity are separate decisions.

### 1.5 Location
Role-specific location relationships may include:
- pickup/event location;
- carrier acceptance location;
- consignee receipt location;
- final destination;
- delivery event location;
- transit location(s).

Location identity can contain:
- identifier;
- name;
- type;
- country/subdivision;
- postal address;
- other governed location attributes.

### 1.6 Consignment Item / Commodity
Repeating child of consignment.

Candidate attributes:
- sequence;
- type;
- gross weight;
- gross volume;
- information/description;
- package quantity/type;
- trade-line-item quantity;
- special/delivery instructions where supported.

### 1.7 Package / Handling Unit
Repeating structure attached to consignment or item depending on source/model.

Candidate attributes:
- quantity;
- gross/net weight;
- volume;
- level;
- type;
- sequence;
- identifier;
- parent identifier;
- description/information;
- units per package.

Package hierarchy must not be flattened.

## 2. Three dimensions of correctness

The executor must evaluate correctness in this order.

### 2.1 Structural correctness
Questions:
- Is the required object present?
- Is occurrence/cardinality valid?
- Are repeating children preserved separately?
- Are parent-child relationships valid?
- Are lifecycle objects/states coherent?

Examples:
- expected 1..1 object missing;
- two values survive in a 0..1 semantic slot;
- package references missing parent;
- update references nonexistent BOL/PRO.

### 2.2 Semantic correctness
Questions:
- What business role does the extracted block represent?
- Which semantic object owns the value?
- Does the value belong to consignment, item, package, party, location or document?
- Is the relationship to other objects correct?

Examples:
- correct address assigned to wrong location role;
- 28 cartons interpreted as consignment-item count when it is package quantity;
- weight attached to document globally when it belongs to one item.

### 2.3 Value correctness
Only after structure and semantic ownership are resolved:
- format;
- allowed code;
- master match;
- measure/unit validity;
- regulatory representation/order;
- client min/max;
- cross-field reconciliation.

## 3. Contextualization pipeline

For each extracted value/block:

1. Preserve source text/value.
2. Normalize without overwriting source value.
3. Generate semantic object/role candidates.
4. Apply cardinality and structural constraints.
5. Establish object relationships.
6. Resolve role before identity.
7. Resolve identity/master/reference where required.
8. Validate value/code/measure/unit.
9. Apply source authority/precedence.
10. Apply lifecycle/state rule.
11. Apply conditional regulatory rule.
12. Reconcile aggregate-to-child values.
13. Apply client/carrier binding.
14. Determine confidence/ambiguity.
15. Disposition:
   - ACCEPT;
   - CORRECT;
   - ENRICH;
   - WARN;
   - REJECT;
   - ESCALATE.
16. Preserve audit evidence.

## 4. Safe auto-correction contract

Automatic correction is permitted only when:
- semantic object/role is resolved;
- cardinality/relationship constraints are satisfied;
- authoritative or governed master evidence supports the canonical value;
- correction does not destroy source value;
- no equally valid competing candidate remains;
- client/regulatory binding does not prohibit correction.

Otherwise escalate or warn.

Unsafe examples:
- selecting one of two plausible consignees only because OCR confidence is higher;
- replacing declared weight with billing/reweigh value without semantic/source-authority distinction;
- converting "4 pallets / 28 cartons" into one generic quantity;
- treating LocationID as globally unique.

## 5. Rule-to-contract mapping

G1 Identifier -> identifier capture/bind/reconcile/exception.
G2 Object relationship -> parent/child and cross-object validation.
G3 Lifecycle -> create/update/delete state and transition checks.
G4 Requiredness -> presence and client override.
G5 Controlled vocabulary -> code lookup/validation.
G6 Master/reference -> scoped resolution and ambiguity.
G7 Conditional regulation -> activation + expanded contract.
G8 Error semantics -> differentiated failure paths.
G9 Multi-error -> aggregate validation response.
G10 Source precedence -> field/semantic-attribute authority.
G11 Representation constraint -> sequence/format validation.
G12 Client specialization -> binding layer.
G13 Cardinality -> 0..1 / 1..1 / 0..n / 1..n behavior.
G14 Aggregate-child reconciliation -> totals/children checks.
G15 Role-specific party/location -> separate role units.
G16 Role-before-identity -> classify then match.
G17 Role-equivalence binding -> client-scoped equivalence.
G18 Role-aware master lookup -> master scope includes role.
G19 Semantic-level assignment -> consignment/item/package ownership.
G20 Measure+unit -> atomic semantic pair.
G21 Package hierarchy -> hierarchy and parent integrity.
G22 Quantity-type disambiguation -> separate quantity semantics.
G23 Weight semantic separation -> distinct weight concepts.
G24 Free-text structured candidates -> parse candidates, retain source.
G25 Aggregate reconciliation -> governed reconciliation/tolerance.
G26 Instruction/note ownership -> preserve semantic owner.

## 6. Exception taxonomy — candidate

### Identity/reference
REFERENCE_ASSIGNMENT_REQUIRED
PRO_NOT_ASSIGNED
PRO_DUPLICATE
BOL_IDENTITY_NOT_FOUND
PRO_TO_BOL_LINK_MISSING
REFERENCE_SOURCE_AUTHORITY_CONFLICT

### Party/location
PARTY_ROLE_AMBIGUOUS
PARTY_IDENTITY_AMBIGUOUS
LOCATION_ROLE_AMBIGUOUS
LOCATION_MASTER_NO_MATCH
LOCATION_MASTER_MULTIPLE_MATCH
ROLE_RELATIONSHIP_CONFLICT
CLIENT_ROLE_BINDING_MISSING

### Item/package/measure
SEMANTIC_LEVEL_AMBIGUOUS
QUANTITY_TYPE_AMBIGUOUS
MEASURE_UNIT_MISSING
MEASURE_UNIT_INVALID
PACKAGE_PARENT_MISSING
PACKAGE_HIERARCHY_CONFLICT
AGGREGATE_CHILD_MISMATCH
ITEM_PACKAGE_RELATIONSHIP_AMBIGUOUS
INSTRUCTION_OWNER_AMBIGUOUS

### Lifecycle/validation
BOL_CREATE_VALIDATION
BOL_UPDATE_VALIDATION
BOL_DELETE_VALIDATION
BOL_DATA_VALIDATION_EXCEPTION

### Regulatory
HAZMAT_REQUIRED_DATA_MISSING
HAZMAT_BASIC_DESCRIPTION_INVALID
HAZMAT_SEQUENCE_INVALID
HAZMAT_PACKAGE_QUANTITY_MISMATCH
HAZMAT_REFERENCE_DATA_MISMATCH

These names are candidate Atlas nomenclature until final generator/audit freeze.

## 7. Resolution authority classification

Every unresolved field/decision must be classified:

A. INDUSTRY_DOMAIN_RESOLVABLE
Can be resolved using governed industry/regulatory semantics and rules.

B. CLIENT_CARRIER_RESOLVABLE
Requires carrier/client SOP, local requiredness, workflow, mapping or policy.

C. MASTER_REFERENCE_RESOLVABLE
Requires authoritative client/carrier/reference master lookup.

D. HUMAN_JUDGMENT_REQUIRED
Cannot be deterministically resolved from governed evidence currently available.

## 8. Minimum evidence trace per canonicalized value

Preserve:
- source/extracted value;
- normalized value;
- canonical value;
- semantic object;
- semantic role/owner;
- source document/location;
- authoritative source or master;
- evidence class;
- rule(s) fired;
- relationship checks;
- lifecycle/state;
- confidence if probabilistic;
- disposition;
- exception code if any;
- queue if any;
- timestamp/version.

## 9. Initial Malkom/IDP projection boundary

The Domain Execution Contract is technology-neutral. A future Malkom projection may implement:

document extraction
-> candidate semantic object recognition
-> role classification
-> scoped master lookup
-> relationship validation
-> controlled-code/value validation
-> source-precedence reconciliation
-> conditional rules
-> confidence/ambiguity handling
-> correction/enrichment
-> exception routing

This projection must not alter canonical business semantics.

## 10. Evidence-backed worked examples

### Example A — PRO
Input: no PRO supplied.
Evidence: NMFTA permits carrier assignment where shipper pre-assigned PRO is absent.
Generated work:
- detect absence;
- determine carrier/client assignment path;
- obtain/receive PRO;
- persist assignment authority;
- bind PRO to current BOL/consignment;
- use resolved PRO for later update/delete.

### Example B — LocationID
Input: LocationID "DC123".
Evidence: NMFTA describes LocationID as optional and scoped to shipper/carrier system rather than industry-global.
Generated work:
- determine assigning organization;
- query correct location master;
- validate within that scope;
- if client requires LocationID and none exists, raise client-binding requiredness exception;
- never enforce global uniqueness.

### Example C — "4 PLTS AUTO PARTS 2150 LBS"
Generated candidate semantics:
- 4 = package/handling quantity candidate;
- PLTS = package/handling type candidate;
- AUTO PARTS = commodity/item information candidate;
- 2150 LBS = weight measure candidate.

Contract then requires:
- semantic-level assignment;
- package/item relationship;
- unit validation;
- possible parent/child reconciliation;
- client classification/NMFC logic only when supported by appropriate governing evidence;
- retain original text even after canonicalization.

### Example D — two plausible consignee masters
If both candidates survive role-aware address/reference/master checks:
- do not auto-correct;
- classify ambiguity;
- route according to client resolution policy.

## 11. Open evidence gaps before v1 freeze

1. Recover exact NMFTA BOL_Request property-level schema where authoritative artifact access permits.
2. Expand authoritative field/provenance matrix into full independent BOL universe.
3. Complete field-level source authority/lifecycle matrix.
4. Formalize client/carrier binding schema.
5. Define deterministic confidence/correction thresholds without fabricating universal percentages.
6. Generate full LTL-03 Work Decomposition from the contract.
7. Build generator-output vs independent-BOL-universe crosswalk.
8. Only after independent universe is stable, compare with SEFL 76 fields.
9. Package frozen evidence for ATL-37 Claude independent audit.

## Current conclusion

The source-backed rule system is now sufficiently mature to assemble a coherent Domain Execution Contract.

The remaining question is no longer whether authoritative evidence can improve the generator. It can.

The remaining proof burden is:
- coverage;
- deterministic reproducibility;
- unsupported-synthesis rate;
- BOL-field coverage;
- client-binding separation;
- false-correction safety;
- independent Claude audit under ATL-37.
