# LTL-03 Field -> Lifecycle -> Authority -> Contextualization Matrix v0.2

Date: 2026-09-20
Workstream: ATL-35
Status: RESEARCH CANDIDATE — NOT FROZEN

## Purpose

Expand the independent LTL-03 field universe into an execution-readiness matrix and simultaneously normalize every discovery into existing semantic primitives and reusable rule families.

## Evidence classes

A = CURRENT_ISSUER_EXPLICIT
B = CURRENT_ISSUER_SCHEMA_FAMILY
C = IMPLEMENTATION_CORROBORATION_ONLY

Only A/B may support canonical claims.

## Track A — Authoritative execution knowledge

### 1. Regulatory minimum BOL / receipt elements

49 CFR 373.101 minimum information:
- consignor name;
- consignee name;
- origin point;
- destination point;
- number of packages;
- description of freight;
- weight, volume or measurement when relevant to rating.

These are regulatory presence/content requirements, not a complete modern LTL field universe.

### 2. Hazardous-material conditional expansion

49 CFR 172.202 currently requires, when applicable:
- identification number;
- proper shipping name;
- primary hazard class/division;
- subsidiary hazard class/division where required;
- packing group where assigned;
- total quantity with applicable unit for highway shipments subject to the rule;
- number and type of packages.

The basic-description sequence (identification number -> proper shipping name -> hazard class/division -> packing group) is governed and must not have unrelated information interspersed.

49 CFR 172.203 adds condition-specific information, including:
- special-permit notation tied to the relevant description;
- Limited Quantity / Ltd Qty notation;
- hazardous-substance naming when the proper shipping name does not identify it;
- RQ notation;
- additional radioactive-material data where applicable.

### 3. UN/CEFACT identifier semantics

UN/CEFACT D23B models distinct optional consignment identifiers:
- generic consignment identification;
- consignor-assigned identifier;
- carrier-assigned identifier;
- freight-forwarder-assigned identifier.

Carrier-assigned identifier explicitly includes booking reference as an example.

The identifier type includes:
- Identifier.Content = mandatory within the identifier structure;
- Identification Scheme Agency.Identifier = optional.

This strengthens the normalized Identifier primitive:
Identifier(value, type/role, assigningAuthority, schemeAgency, uniquenessScope, semanticOwner, source, lifecycleStage, confidence).

### 4. UN/CEFACT measure semantics

Consignment-level gross weight and gross volume are separate measures.

Consignment-item gross weight is 0..1 and, when supplied, includes:
- Measure.Content = mandatory;
- Measure Unit.Code = mandatory.

This confirms Measure(value, unit, semanticOwner, source, confidence) as a reusable primitive.

### 5. UN/CEFACT package semantics

Transport Package occurrence can be 0..n.

Package attributes include:
- item/package quantity;
- gross weight;
- net weight;
- other package semantics in the model.

Package-level controlled hierarchy values include:
- Inner;
- Intermediate;
- Outer;
- No packaging hierarchy.

This supports package hierarchy as parameters/instances of RF14 rather than a new family.

### 6. UN/CEFACT location-role semantics

Controlled location-type semantics differ by relationship context.

Examples include:
- place of departure;
- place of acceptance;
- goods receipt place;
- place of discharge;
- customs-clearance and other specialized locations.

The same physical address may therefore participate in different semantic roles.

### 7. NMFTA evidence boundary

Current public NMFTA documentation still verifies:
- BOL_Request schema family;
- create/update/delete lifecycle;
- PRO behavior;
- code/schema families;
- partner specialization;
- LocationID behavior.

The full exact BOL_Request property body is not yet directly recoverable from a verifiable issuer artifact in this research pass.

No exact property/cardinality is inferred from mirrors or assumed operational familiarity.

## Expanded field/lifecycle/authority matrix

| Semantic element | Lifecycle | Source authority | Master/reference | Structural rule | Semantic rule | Value rule | Normalized families |
|---|---|---|---|---|---|---|---|
| Consignor name | BOL create/validate | 49 CFR 373.101 source document | shipper/customer master | required regulatory presence | role=consignor | identity/name validation | RF2, RF4, RF6 |
| Consignee name | BOL create/validate | 49 CFR 373.101 | consignee/location master | required | role=consignee | identity/name validation | RF2, RF4, RF6 |
| Origin point | create/validate | 49 CFR 373.101 | location master | required | role=origin | address/location validation | RF2, RF4, RF6 |
| Destination point | create/validate | 49 CFR 373.101 | location master | required | role=destination | address/location validation | RF2, RF4, RF6 |
| Package count | create/validate | 49 CFR 373.101 | package children where present | required regulatory presence | owner=consignment/package aggregate | quantity reconciliation | RF4, RF12 |
| Freight description | create/validate | 49 CFR 373.101/source BOL | classification/master may enrich | required source evidence | owner=item/commodity or consignment context | preserve raw text; parse candidates | RF15, RF9 |
| Rating-relevant weight/volume/measurement | create/rating | 49 CFR 373.101 | unit/reference data | conditionally required | semantic owner must be resolved | measure + unit | RF7, RF13, RF9 |
| Consignment carrier-assigned ID | pre-create/create | UN/CEFACT/carrier | assigning authority/scheme | 0..1 | role=carrier-assigned reference | identifier + scheme agency | RF1, RF4 |
| Consignment consignor-assigned ID | pre-create/create | UN/CEFACT/consignor | assigning authority/scheme | 0..1 | role=consignor-assigned reference | identifier + scheme agency | RF1, RF4 |
| PRO | create/update/delete | NMFTA/carrier | carrier reference authority | single resolved target for update/delete | document/shipment reference | identifier/check logic where applicable | RF1, RF3, RF4, RF9 |
| LocationID | create/validate | NMFTA partner field | shipper/carrier location master | optional canonical / client override possible | location identity in assigning-org scope | identifier/master match | RF1, RF6, RF11 |
| Consignment gross weight | create/validate | UN/CEFACT/source | unit codes | optional semantic slot | owner=consignment | value+unit | RF13, RF9 |
| Consignment gross volume | create/validate | UN/CEFACT/source | unit codes | optional | owner=consignment | value+unit | RF13 |
| Item gross weight | create/validate | UN/CEFACT/source | unit codes | 0..1 | owner=consignment item | mandatory unit when measure supplied | RF4, RF13 |
| Transport package | create/validate | UN/CEFACT | package semantics | 0..n | child of consignment/item context | per-package values | RF2, RF4, RF14 |
| Package hierarchy level | create/validate | UN/CEFACT code list | controlled vocabulary | optional hierarchy attribute | package-level semantic | allowed hierarchy code | RF5, RF14 |
| Pickup/acceptance location type | booking/pickup/BOL context | UN/CEFACT | location/reference master | role-specific relationship | pickup/acceptance role | allowed location-type code | RF2, RF5, RF6 |
| Consignee receipt location type | BOL/delivery context | UN/CEFACT | location master | role-specific | receipt role | allowed location-type code | RF2, RF5, RF6 |
| Hazmat ID number | conditional shipping-paper/BOL | 49 CFR 172.202 / 172.101 | regulatory table | required when hazmat rule activated | owner=hazmat commodity description | controlled identifier | RF1, RF5, RF7 |
| Proper shipping name | conditional | 49 CFR 172.202 / 172.101 | regulatory table | required | hazmat commodity semantic | controlled/reference description | RF5, RF7 |
| Hazard class/division | conditional | 49 CFR 172.202 / 172.101 | regulatory table | required subject to rule | hazmat semantic | controlled class value | RF5, RF7 |
| Subsidiary hazard | conditional | 49 CFR 172.202 | regulatory table | condition-specific | subordinate hazard semantic | controlled class value | RF5, RF7 |
| Packing group | conditional | 49 CFR 172.202 / 172.101 | regulatory table | required when assigned/applicable | hazmat semantic | controlled Roman-numeral group | RF5, RF7 |
| Hazmat total quantity | conditional highway | 49 CFR 172.202 | unit semantics | required subject to exceptions | owner=hazmat description/package context | measure+unit | RF7, RF13 |
| Hazmat package number/type | conditional | 49 CFR 172.202 | package vocabulary | required | package relation | quantity/type validation | RF4, RF5, RF7 |
| Hazmat basic-description sequence | conditional representation | 49 CFR 172.202 | none | structure/order | same hazmat description group | sequence validation | RF7, RF10 |
| Special permit notation | conditional | 49 CFR 172.203 | permit reference | activate when special permit applies | association to relevant description | DOT-SP + permit reference representation | RF1, RF7, RF10 |
| Limited Quantity notation | conditional | 49 CFR 172.203 | none | activate when applicable | associated with material description | representation/text constraint | RF7, RF10 |
| Hazardous substance/RQ | conditional | 49 CFR 172.203 | regulatory substance/RQ data | activate when applicable | associated with hazmat description | substance identification + RQ notation | RF5, RF7, RF10 |

## Structural -> Semantic -> Value enforcement order

The matrix now explicitly distinguishes:

1. Structural correctness
   - presence;
   - occurrence/cardinality;
   - lifecycle target;
   - collection/hierarchy;
   - conditional activation.

2. Semantic correctness
   - object owner;
   - role;
   - relationship;
   - lifecycle meaning;
   - source-authority meaning.

3. Value correctness
   - identifier;
   - master match;
   - controlled code;
   - measure+unit;
   - format;
   - sequence/representation.

Auto-correction may proceed only after structural and semantic resolution is sufficiently deterministic.

## Track B — Normalization results

New detailed facts in this pass did not create a new family.

They parameterize existing families:
- Identifier gained schemeAgency and assigningAuthority detail under RF1.
- Measure confirms atomic value+unit behavior under RF13.
- Location type values instantiate RF5 + RF2 rather than a new location-validation family.
- Package hierarchy values instantiate RF14 + RF5.
- Hazmat subsidiary-hazard and condition-specific notations compose RF5/RF7/RF10.

### Scalability checkpoint

- Existing reusable family candidates: 16
- New family introduced this pass: 0
- New authoritative facts/constraints added: >20
- Architecture signal: positive, provisional

Rule Reuse Ratio remains intentionally unfrozen until complete generated-instance enumeration.

## Next

1. enumerate generated rule instances across the full v0.x independent universe;
2. mark each instance as reused-family vs new-family;
3. identify genuinely bespoke rules if any;
4. continue exact NMFTA issuer-schema recovery;
5. add source-authority distinctions for source-document vs master vs verified operational values;
6. freeze independent universe only after evidence gaps are explicitly classified;
7. then run generator-vs-universe coverage and safety tests for ATL-37.
