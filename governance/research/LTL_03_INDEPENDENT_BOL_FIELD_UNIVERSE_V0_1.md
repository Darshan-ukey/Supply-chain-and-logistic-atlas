# LTL-03 Independent BOL Field Universe v0.1

Date: 2026-09-20
Workstream: ATL-35
Status: PARTIAL INDEPENDENT UNIVERSE — NOT FROZEN
Important: This universe is being derived independently of the SEFL 76-field list.

## Purpose

Create the authoritative comparison basis against which the successor generator will later be tested.

The field universe is organized as:
Information Object -> Field / Relationship -> Requiredness / Cardinality -> Evidence Class -> Governing Source -> Generator Implication.

Evidence classes:
- A = CURRENT_ISSUER_EXPLICIT
- B = CURRENT_ISSUER_SCHEMA_FAMILY
- C = IMPLEMENTATION_CORROBORATION_ONLY

Only A/B evidence is used for canonical claims.

## 1. Consignment / Shipment

| Field / relationship | Requiredness / cardinality | Evidence | Source basis | Generator implication |
|---|---|---:|---|---|
| Carrier-assigned identifier | Optional / single semantic slot | A | UN/CEFACT | Generate carrier-reference capture, scope, bind and conflict logic |
| Consignor-assigned identifier | Optional / single semantic slot | A | UN/CEFACT | Keep distinct from carrier-assigned reference |
| Freight-forwarder-assigned identifier | Optional / single semantic slot | A | UN/CEFACT | Role-specific reference |
| Gross weight | Optional / single measure | A | UN/CEFACT | Measure+unit pair; consignment-level ownership |
| Net weight | Optional / single measure | A | UN/CEFACT | Distinct from gross weight |
| Gross volume | Optional / single measure | A | UN/CEFACT | Measure+unit pair |
| Package quantity | Optional / single aggregate quantity | A | UN/CEFACT | Reconcile only where relationship semantics support it |
| Included consignment items | 0..n | A | UN/CEFACT | Repeating child collection |
| Consignor party | role-specific relationship | A | UN/CEFACT | Separate party resolution |
| Consignee party | role-specific relationship | A | UN/CEFACT | Separate party resolution |
| Carrier party | role-specific relationship | A | UN/CEFACT | Separate carrier resolution |
| Consignee receipt location | 0..1 | A | UN/CEFACT | Role-before-identity location resolution |
| Final destination location | role-specific | A | UN/CEFACT | Preserve separately from consignee receipt unless client binding equates them |
| Pickup/acceptance location | role-specific | A | UN/CEFACT | Event/location role |
| Transit location(s) | repeating | A | UN/CEFACT | Repeating role-specific locations |

## 2. Transport Document / eBOL

| Field / relationship | Requiredness / cardinality | Evidence | Source basis | Generator implication |
|---|---|---:|---|---|
| BOL document identity | document-level | A/B | NMFTA eBOL | Create/update/delete lifecycle |
| PRO number | optional request input; carrier assignable; returned reference | A | NMFTA eBOL/FAQ | Assignment, binding, update/delete lookup |
| Request purpose / lifecycle action | CREATE/UPDATE/DELETE semantics | A | NMFTA FAQ | Generate transition rules |
| Result/error status | schema/code family | B | NMFTA eBOL | Controlled status handling |
| Shipping label format | schema/code family | B | NMFTA eBOL | Controlled-value projection |
| Requestor role | schema/code family | B | NMFTA eBOL | Role-specific validation |
| LocationID | optional industry field; org-scoped | A | NMFTA FAQ | Scoped master lookup; not globally unique |

## 3. Party

| Field / relationship | Requiredness / cardinality | Evidence | Source basis | Generator implication |
|---|---|---:|---|---|
| Party role | role-specific | A | UN/CEFACT | Resolve role before identity |
| Party identifier | source/model dependent | A/B | UN/CEFACT | Scoped master/reference lookup |
| Party name | source/model dependent | A | UN/CEFACT | Identity resolution input |
| Government registration / identifier type | controlled semantic family | A | UN/CEFACT | Role/reference validation |
| Postal address | nested relationship | A | UN/CEFACT | Address matching only after role classification |

## 4. Location

| Field / relationship | Requiredness / cardinality | Evidence | Source basis | Generator implication |
|---|---|---:|---|---|
| Location identifier | optional | A | UN/CEFACT | Identity/reference resolution |
| Location name | optional | A | UN/CEFACT | Matching candidate |
| Location type/function code | optional controlled semantic | A | UN/CEFACT | Role validation |
| Location description | optional | A | UN/CEFACT | Candidate context |
| Country | optional/source dependent | A | UN/CEFACT | Address/location validation |
| Country subdivision/state | optional/source dependent | A | UN/CEFACT | Address/location validation |
| Postal address | nested | A | UN/CEFACT | Master reconciliation |
| Coordinates | optional/source dependent | A/B | UN/CEFACT | Secondary location evidence |
| NMFTA LocationID | optional; shipper/carrier scoped | A | NMFTA FAQ | Client/carrier master key |

## 5. Consignment Item / Commodity

| Field / relationship | Requiredness / cardinality | Evidence | Source basis | Generator implication |
|---|---|---:|---|---|
| Item sequence | optional | A | UN/CEFACT | Child identity/order |
| Item type code | optional | A | UN/CEFACT | Controlled semantic code |
| Item gross weight | 0..1 measure | A | UN/CEFACT | Value+unit pair; item ownership |
| Item net weight | optional measure | A | UN/CEFACT | Distinct weight semantic |
| Item chargeable weight | optional measure | A | UN/CEFACT | Distinct from gross/net |
| Item gross volume | optional measure | A | UN/CEFACT | Value+unit pair |
| Item information / description | optional text | A | UN/CEFACT | Preserve source; structure as candidate commodity text |
| Package quantity | optional | A | UN/CEFACT | Quantity semantic distinct from item count |
| Package type text | optional | A | UN/CEFACT | Package semantic |
| Trade line item quantity | optional | A | UN/CEFACT | Separate quantity semantic |
| Special instructions | optional | A | UN/CEFACT | Preserve item ownership |
| Delivery instructions | optional | A | UN/CEFACT | Preserve item ownership |
| Damage remarks | optional | A | UN/CEFACT | Do not promote globally |
| Transport packages | 0..n | A | UN/CEFACT | Repeating package children |

## 6. Package / Handling Unit

| Field / relationship | Requiredness / cardinality | Evidence | Source basis | Generator implication |
|---|---|---:|---|---|
| Package quantity | optional | A | UN/CEFACT | Package-level quantity |
| Gross weight | optional | A | UN/CEFACT | Package-level weight |
| Net weight | optional | A | UN/CEFACT | Package-level weight |
| Gross volume | optional | A | UN/CEFACT | Package-level volume |
| Package level | optional code | A | UN/CEFACT | Hierarchy semantics |
| Package type | optional code/text | A | UN/CEFACT | Controlled/reference validation |
| Sequence | optional | A/B | UN/CEFACT | Ordering/identity |
| Identifier | optional | A/B | UN/CEFACT | Package identity |
| Parent identifier | optional | A/B | UN/CEFACT | Hierarchy validation |
| Description / information | optional | A/B | UN/CEFACT | Preserve package-level text |
| Units per package | optional/source dependent | A/B | UN/CEFACT | Quantity relationship |

## 7. Service / Handling / Accessorial

Current authoritative issuer evidence confirms schema/code families for:
- accessorial codes;
- limited-access types;
- time-critical types;
- payment terms.

Evidence class: B pending property-level extraction.

Generator implication:
- create controlled-code validation family;
- preserve local/carrier mapping through client binding;
- do not invent field-level cardinality until issuer property evidence is recovered.

## 8. Classification

NMFTA eBOL confirms a Classification_Codes schema/code family.

Evidence class: B.

Important boundary:
- This supports classification as a governed code family.
- It does not by itself establish every exact BOL property/cardinality or make NMFC/class equivalent to hazmat semantics.

## 9. Hazmat / dangerous-goods conditional information

Covered by separate regulatory rule artifact.

Canonical behavior:
- conditional activation;
- additional required description elements;
- prescribed representation/sequence where regulation requires;
- package/quantity relationships;
- regulatory failure exceptions.

The field universe will expand property-by-property from the regulatory matrix rather than flattening hazmat into a yes/no flag.

## 10. Current known universe categories

The independent BOL universe currently contains source-backed primitives across:
1. shipment/consignment identity;
2. transport-document identity and lifecycle;
3. references/identifiers;
4. parties;
5. locations;
6. consignment items/commodity;
7. packages/handling units;
8. service/accessorial families;
9. payment-term family;
10. classification family;
11. conditional hazmat/regulatory information;
12. instructions/notes;
13. error/result semantics.

## 11. Not yet admitted as canonical fields

Do not promote the following merely from operational familiarity:
- SEFL-specific 76-field names;
- carrier-specific screen/system fields;
- local billing-only attributes;
- local queue codes;
- undocumented client mandatory fields;
- inferred NMFC/class property names not yet extracted from authoritative schema;
- generic "piece count" where semantic ownership is not established.

## 12. Next expansion

1. Recover exact NMFTA BOL_Request property-level schema where technically accessible.
2. Add 49 CFR Part 373 minimum receipt/BOL elements to the field matrix with exact provenance.
3. Expand PHMSA hazmat property-level conditional matrix.
4. Build field-to-lifecycle/source-authority matrix.
5. Freeze independent universe before exposing SEFL 76 fields.
6. Run successor generator against frozen universe and calculate:
   - fields generated;
   - fields missed;
   - unsupported generated fields;
   - correctly generated relationships/cardinality/rules;
   - unresolved client/master gaps.

That crosswalk becomes core evidence for ATL-37 independent Claude QA.
