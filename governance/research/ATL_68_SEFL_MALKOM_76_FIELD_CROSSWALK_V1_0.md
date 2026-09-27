# ATL-68 — SEFL/Malkom 76-Field Crosswalk v1.1

Status: EXECUTION EVIDENCE — READY FOR INDEPENDENT QA
Date: 2026-09-27
Parent: ATL-59
Predecessor: ATL-67 — Independent BOL Field Universe Freeze v1.0

## Purpose and independence control

This artifact crosswalks every source-reported SEFL/Malkom field against the frozen independent ATL-67 BOL universe. ATL-67 remains immutable for this comparison: no canonical object or semantic field was added merely because a SEFL field exists.

## Authoritative inputs

1. **SEFL/Malkom denominator and field names:** `data/operational-knowledge/road-ltl-v1.5-bol-resolution-baseline.json` on retained branch `road-ltl-v1.5-bol-operational-enrichment`, array `fieldPerformanceBaseline`. It contains exactly **76 rows** and preserves source-reported accuracy/extraction metrics.
2. **Governed Drive corroboration:** `BOL Information Resolution Baseline v0.1 — Road LTL / Malkom — FROZEN_REFERENCE_BASELINE`, Drive ID `1oxEYH8mHZEZ4Y2D7mgLj2wlSl1d7bcmlBhT3lWV7J7Q`, which states scope = 76 source-reported Malkom BOL fields and preserves the same unresolved-semantics controls.
3. **Owner operational clarification (2026-09-27):** after BOL review, Code, SHC and Related Value were not identifiable on the BOL and may be Malkom-form/client-specific; Handling Unit Line No was clarified as shipment-item/line structure when multiple shipment items/descriptions occur; square yard was clarified as a legitimate area unit for area-based commodities; Hazardous Contract Number remains semantically unresolved pending Ops/source definition.
4. **Independent comparison universe:** `governance/research/ATL_67_INDEPENDENT_BOL_FIELD_UNIVERSE_FREEZE_V1_0.md` on `atlas-governance-registry-v2.1`.

## Coverage denominator

- Source-reported SEFL/Malkom fields: **76**
- Accounted for in this crosswalk: **76 / 76 (100%)**
- This is accounting coverage, **not** a claim that 100% are canonical domain fields or execution-ready.
- Reported accuracy/extraction values are preserved as source observations only. ATL-67/BOL baseline already records a metric-integrity warning because 11 reported accuracy values exceed 100%; this crosswalk does not normalize or reinterpret them.

## Classification summary

- **Canonical BOL/domain: 43**
- **Conditional domain: 14**
- **Derived/contextual: 8**
- **Atlas knowledge gap: 1**
- **Client-specific: 6**
- **Master-data-dependent: 3**
- **Unsupported SEFL field: 1**

Interpretation controls:
- **Canonical BOL/domain** = directly maps to a frozen ATL-67 semantic family/object, including client-layout aliases such as Address 2/3 → canonical `addressLines[]`.
- **Conditional domain** = valid domain information whose requiredness/meaning activates only under service, appointment, or dangerous-goods conditions.
- **Derived/contextual** = operationally useful context not frozen as a canonical ATL-67 core field; retained without falsely declaring an Atlas gap.
- **Client-specific** = canonical family exists but exact local code/type vocabulary requires client/source binding.
- **Master-data-dependent** = identity/account semantics require carrier/client master data; not an Atlas domain gap.
- **Unsupported SEFL field** = source label has no supported mapping in the frozen universe and requires authoritative evidence before expansion.
- **Atlas knowledge gap** = ATL-67 explicitly records the label as SOURCE_CONTEXT_PENDING; semantics must not be fabricated.
- **Runtime/system:** 0. No source row is proven to be purely runtime/system metadata under the frozen evidence.

## Field-by-field crosswalk

| # | SEFL/Malkom field | Reported accuracy | Reported extraction | Classification | Frozen ATL-67 target / mapping | Rationale / evidence control |
|---:|---|---:|---:|---|---|---|
| 1 | Line Item Hazardous Flag | 19.83 | 96.71 | Conditional domain | Dangerous Goods activation condition | Domain-valid only when dangerous-goods applicability/relationship conditions are satisfied. |
| 2 | Line Item Description | 56.78 | 87.51 | Canonical BOL/domain | Consignment Item / Commodity — description | Direct semantic family/object exists in the frozen ATL-67 independent universe; preserve object ownership/cardinality. |
| 3 | Line Item Piece Count | 59.5 | 94.14 | Canonical BOL/domain | Consignment Item / Commodity — package/trade-line quantity | Direct semantic family/object exists in the frozen ATL-67 independent universe; preserve object ownership/cardinality. |
| 4 | Instruction | 60.96 | 75.2 | Canonical BOL/domain | Instruction / Note — scoped content | Direct semantic family/object exists in the frozen ATL-67 independent universe; preserve object ownership/cardinality. |
| 5 | Reference Number | 69.79 | 61.78 | Canonical BOL/domain | Reference / Identifier — value | Direct semantic family/object exists in the frozen ATL-67 independent universe; preserve object ownership/cardinality. |
| 6 | Reference Number Type Full Name | 74.98 | 77.73 | Client-specific | Reference / Identifier — type / local representation | Canonical family exists, but exact local vocabulary/type semantics require client/source binding. |
| 7 | Consignee Address 2 | 75.42 | 95.72 | Canonical BOL/domain | Party[Consignee] — postal address/addressLines | Client-layout representation of canonical postal addressLines[]; not a standalone global concept. |
| 8 | Line Item Packaging Type | 77.27 | 71.28 | Canonical BOL/domain | Consignment Item / Commodity — package type | Direct semantic family/object exists in the frozen ATL-67 independent universe; preserve object ownership/cardinality. |
| 9 | Consignee Address 3 | 78.15 | 99.56 | Canonical BOL/domain | Party[Consignee] — postal address/addressLines | Client-layout representation of canonical postal addressLines[]; not a standalone global concept. |
| 10 | Consignee Name | 78.51 | 99.95 | Canonical BOL/domain | Party[Consignee] — name | Direct semantic family/object exists in the frozen ATL-67 independent universe; preserve object ownership/cardinality. |
| 11 | Reference Number Type | 79.01 | 78.81 | Canonical BOL/domain | Reference / Identifier — type / local representation | Direct semantic family/object exists in the frozen ATL-67 independent universe; preserve object ownership/cardinality. |
| 12 | Bill To Name | 79.52 | 90.59 | Canonical BOL/domain | Party[BillTo] — name | Direct semantic family/object exists in the frozen ATL-67 independent universe; preserve object ownership/cardinality. |
| 13 | Consignee Address | 80.24 | 99.7 | Canonical BOL/domain | Party[Consignee] — postal address/addressLines | Direct semantic family/object exists in the frozen ATL-67 independent universe; preserve object ownership/cardinality. |
| 14 | Consignee Zip | 80.64 | 98.88 | Canonical BOL/domain | Party[Consignee] — postal address/addressLines | Direct semantic family/object exists in the frozen ATL-67 independent universe; preserve object ownership/cardinality. |
| 15 | Bill To Address | 80.7 | 90.27 | Canonical BOL/domain | Party[BillTo] — postal address/addressLines | Direct semantic family/object exists in the frozen ATL-67 independent universe; preserve object ownership/cardinality. |
| 16 | Bill To Address 2 | 82.67 | 91.65 | Canonical BOL/domain | Party[BillTo] — postal address/addressLines | Client-layout representation of canonical postal addressLines[]; not a standalone global concept. |
| 17 | Line Item Freight Class | 82.72 | 88.19 | Canonical BOL/domain | Classification — freight class | Direct semantic family/object exists in the frozen ATL-67 independent universe; preserve object ownership/cardinality. |
| 18 | Bill To Account Number | 84.41 | 84.77 | Master-data-dependent | Party[BillTo] — client master identifier binding | Meaning depends on client/carrier master identity and binding; not a missing domain concept. |
| 19 | Line Item NMFC Sub | 86.44 | 82.29 | Canonical BOL/domain | Classification — NMFC/NMFTA family | Direct semantic family/object exists in the frozen ATL-67 independent universe; preserve object ownership/cardinality. |
| 20 | Bill To Zip | 86.75 | 89.14 | Canonical BOL/domain | Party[BillTo] — postal address/addressLines | Direct semantic family/object exists in the frozen ATL-67 independent universe; preserve object ownership/cardinality. |
| 21 | Bill To Address 3 | 87.94 | 97.25 | Canonical BOL/domain | Party[BillTo] — postal address/addressLines | Client-layout representation of canonical postal addressLines[]; not a standalone global concept. |
| 22 | Line Item Weight | 88.04 | 88.69 | Canonical BOL/domain | Consignment Item / Commodity — owned weight | Direct semantic family/object exists in the frozen ATL-67 independent universe; preserve object ownership/cardinality. |
| 23 | Shipper Zip Code | 88.08 | 99.78 | Canonical BOL/domain | Party[Shipper/Consignor] — postal address/addressLines | Direct semantic family/object exists in the frozen ATL-67 independent universe; preserve object ownership/cardinality. |
| 24 | Shipper Name | 88.19 | 99.96 | Canonical BOL/domain | Party[Shipper/Consignor] — name | Direct semantic family/object exists in the frozen ATL-67 independent universe; preserve object ownership/cardinality. |
| 25 | Shipper Address | 88.42 | 99.94 | Canonical BOL/domain | Party[Shipper/Consignor] — postal address/addressLines | Direct semantic family/object exists in the frozen ATL-67 independent universe; preserve object ownership/cardinality. |
| 26 | Instruction Type | 88.89 | 75.58 | Client-specific | Instruction / Note — local type vocabulary binding | Canonical family exists, but exact local vocabulary/type semantics require client/source binding. |
| 27 | Payment Term | 89.58 | 89.26 | Canonical BOL/domain | Payment Terms — governed controlled-value family | Direct semantic family/object exists in the frozen ATL-67 independent universe; preserve object ownership/cardinality. |
| 28 | Bill To Phone Extension | 89.89 | 99.97 | Derived/contextual | Party — contact context (not frozen canonical core) | Useful party contact context, but not part of ATL-67 frozen canonical core; retain without declaring a domain gap. |
| 29 | Bill To City | 90.31 | 87.8 | Canonical BOL/domain | Party[BillTo] — postal address/addressLines | Direct semantic family/object exists in the frozen ATL-67 independent universe; preserve object ownership/cardinality. |
| 30 | Consignee Phone Extension | 90.36 | 99.8 | Derived/contextual | Party — contact context (not frozen canonical core) | Useful party contact context, but not part of ATL-67 frozen canonical core; retain without declaring a domain gap. |
| 31 | Code | 90.61 | 69.47 | Client-specific | Malkom-form/client binding — exact meaning pending Ops | Owner BOL review did not identify this field on the BOL. Probable Malkom-form/client-specific pending Ops confirmation; not an Atlas domain gap. |
| 32 | Consignee Account Number | 91.32 | 87.44 | Master-data-dependent | Party[Consignee] — client master identifier binding | Meaning depends on client/carrier master identity and binding; not a missing domain concept. |
| 33 | Line Item NMFC | 91.48 | 73.86 | Canonical BOL/domain | Classification — NMFC/NMFTA family | Direct semantic family/object exists in the frozen ATL-67 independent universe; preserve object ownership/cardinality. |
| 34 | Bill To State | 91.77 | 87.61 | Canonical BOL/domain | Party[BillTo] — postal address/addressLines | Direct semantic family/object exists in the frozen ATL-67 independent universe; preserve object ownership/cardinality. |
| 35 | Shipper Address 2 | 92.66 | 99.51 | Canonical BOL/domain | Party[Shipper/Consignor] — postal address/addressLines | Client-layout representation of canonical postal addressLines[]; not a standalone global concept. |
| 36 | Shipper Contact Phone | 93.58 | 98.28 | Derived/contextual | Party — contact context (not frozen canonical core) | Useful party contact context, but not part of ATL-67 frozen canonical core; retain without declaring a domain gap. |
| 37 | Shipper Phone Extension | 93.75 | 99.84 | Derived/contextual | Party — contact context (not frozen canonical core) | Useful party contact context, but not part of ATL-67 frozen canonical core; retain without declaring a domain gap. |
| 38 | Shipper City | 94.02 | 99.77 | Canonical BOL/domain | Party[Shipper/Consignor] — postal address/addressLines | Direct semantic family/object exists in the frozen ATL-67 independent universe; preserve object ownership/cardinality. |
| 39 | Consignee Phone | 94.27 | 93.53 | Derived/contextual | Party — contact context (not frozen canonical core) | Useful party contact context, but not part of ATL-67 frozen canonical core; retain without declaring a domain gap. |
| 40 | Consignee City | 94.36 | 98.11 | Canonical BOL/domain | Party[Consignee] — postal address/addressLines | Direct semantic family/object exists in the frozen ATL-67 independent universe; preserve object ownership/cardinality. |
| 41 | Bill To Phone | 95.55 | 98.36 | Derived/contextual | Party — contact context (not frozen canonical core) | Useful party contact context, but not part of ATL-67 frozen canonical core; retain without declaring a domain gap. |
| 42 | Shipper State | 96.43 | 99.44 | Canonical BOL/domain | Party[Shipper/Consignor] — postal address/addressLines | Direct semantic family/object exists in the frozen ATL-67 independent universe; preserve object ownership/cardinality. |
| 43 | SHC | 96.6 | 89.76 | Client-specific | Malkom-form/client binding — exact meaning pending Ops | Owner BOL review did not identify this field on the BOL. Probable Malkom-form/client-specific pending Ops confirmation; not an Atlas domain gap. |
| 44 | Weight | 96.8 | 99.93 | Canonical BOL/domain | Shipment / Consignment — gross/net weight (binding must select semantic owner) | Direct semantic family/object exists in the frozen ATL-67 independent universe; preserve object ownership/cardinality. |
| 45 | Emergency Contact Phone | 96.96 | 96.65 | Conditional domain | Dangerous Goods — emergency response phone | Domain-valid only when dangerous-goods applicability/relationship conditions are satisfied. |
| 46 | Time Critical Details Date Begin | 97.12 | 96.81 | Conditional domain | Service / Accessorial / Handling — time-critical family | Domain-valid service/event-window information; applicability depends on service/appointment context. |
| 47 | Consignee Email | 97.29 | 98.04 | Derived/contextual | Party — contact context (not frozen canonical core) | Useful party contact context, but not part of ATL-67 frozen canonical core; retain without declaring a domain gap. |
| 48 | Line Item Hazardous Contract Number | 97.34 | 99.25 | Unsupported SEFL field | No frozen canonical target | Exact label has no supported canonical meaning in ATL-67; possible local/typo semantics require source evidence. |
| 49 | Emergency Contact Name | 97.39 | 97.13 | Conditional domain | Dangerous Goods — responsible person / ERI-provider relationship | Domain-valid only when dangerous-goods applicability/relationship conditions are satisfied. |
| 50 | Piece Count | 97.89 | 99.97 | Canonical BOL/domain | Shipment/Consignment package quantity (must not collapse line-item/handling-unit counts) | Direct semantic family/object exists in the frozen ATL-67 independent universe; preserve object ownership/cardinality. |
| 51 | Delivery Appointment Date Begin | 97.91 | 97.58 | Conditional domain | ServiceEventWindow / delivery instruction context | Domain-valid service/event-window information; applicability depends on service/appointment context. |
| 52 | Delivery Appointment Date End | 98.34 | 99.92 | Conditional domain | ServiceEventWindow / delivery instruction context | Domain-valid service/event-window information; applicability depends on service/appointment context. |
| 53 | Bill To Country | 98.46 | 88.2 | Canonical BOL/domain | Party[BillTo] — postal address/addressLines | Direct semantic family/object exists in the frozen ATL-67 independent universe; preserve object ownership/cardinality. |
| 54 | Shipper Code | 98.6 | 85.4 | Master-data-dependent | Party — client/carrier master identifier binding | Meaning depends on client/carrier master identity and binding; not a missing domain concept. |
| 55 | Time Critical Details Date End | 98.69 | 99.96 | Conditional domain | Service / Accessorial / Handling — time-critical family | Domain-valid service/event-window information; applicability depends on service/appointment context. |
| 56 | Consignee State | 98.83 | 97.16 | Canonical BOL/domain | Party[Consignee] — postal address/addressLines | Direct semantic family/object exists in the frozen ATL-67 independent universe; preserve object ownership/cardinality. |
| 57 | BOL Type | 99.14 | 100 | Client-specific | Transport Document / BOL — local lifecycle/type binding | Canonical family exists, but exact local vocabulary/type semantics require client/source binding. |
| 58 | Related Value | 99.22 | 99.99 | Client-specific | Malkom-form/client binding — exact relationship pending Ops | Owner BOL review did not identify this field on the BOL. Probable Malkom-form/client-specific pending Ops confirmation; exact related object/value remains unresolved. |
| 59 | Pro Number | 99.3 | 100 | Canonical BOL/domain | Transport Document / BOL — PRO (distinct reference) | Direct semantic family/object exists in the frozen ATL-67 independent universe; preserve object ownership/cardinality. |
| 60 | Interline SCAC | 99.46 | 99.95 | Canonical BOL/domain | Party/Carrier identifier / reference | Direct semantic family/object exists in the frozen ATL-67 independent universe; preserve object ownership/cardinality. |
| 61 | Bill To Email | 99.55 | 97.87 | Derived/contextual | Party — contact context (not frozen canonical core) | Useful party contact context, but not part of ATL-67 frozen canonical core; retain without declaring a domain gap. |
| 62 | Time Critical Details Type | 99.56 | 93.41 | Conditional domain | Service / Accessorial / Handling — time-critical family | Domain-valid service/event-window information; applicability depends on service/appointment context. |
| 63 | Shipper Country | 99.88 | 99.62 | Canonical BOL/domain | Party[Shipper/Consignor] — postal address/addressLines | Direct semantic family/object exists in the frozen ATL-67 independent universe; preserve object ownership/cardinality. |
| 64 | Shipper Address 3 | 99.92 | 99.97 | Canonical BOL/domain | Party[Shipper/Consignor] — postal address/addressLines | Client-layout representation of canonical postal addressLines[]; not a standalone global concept. |
| 65 | Consignee Country | 99.97 | 97.16 | Canonical BOL/domain | Party[Consignee] — postal address/addressLines | Direct semantic family/object exists in the frozen ATL-67 independent universe; preserve object ownership/cardinality. |
| 66 | Handling Unit Dimensions | 100.63 | 85.01 | Canonical BOL/domain | Package / Handling Unit — owned measures | Direct semantic family/object exists in the frozen ATL-67 independent universe; preserve object ownership/cardinality. |
| 67 | Line Item Hazardous Technical Name | 100.91 | 96.45 | Conditional domain | Dangerous Goods — conditional technical name | Domain-valid only when dangerous-goods applicability/relationship conditions are satisfied. |
| 68 | Line Item Square Yards | 101.04 | 96.98 | Atlas knowledge gap | Consignment Item / Commodity — area measure + unit (square yard) | Owner operational clarification establishes square yard as a legitimate area unit for area-based commodities. ATL-67 lacks canonical item-level area-measure representation; record as Atlas model-coverage gap without retroactively expanding ATL-67. |
| 69 | Line Item Hazardous Packing Group | 101.24 | 96.61 | Conditional domain | Dangerous Goods — packing group | Domain-valid only when dangerous-goods applicability/relationship conditions are satisfied. |
| 70 | Line Item Hazardous UNNA Number | 101.28 | 97.04 | Conditional domain | Dangerous Goods — UN/NA number | Domain-valid only when dangerous-goods applicability/relationship conditions are satisfied. |
| 71 | Line Item Hazardous Class | 101.32 | 97.01 | Conditional domain | Dangerous Goods — hazard class/division | Domain-valid only when dangerous-goods applicability/relationship conditions are satisfied. |
| 72 | Handling Unit Type | 101.73 | 44.3 | Canonical BOL/domain | Package / Handling Unit — type | Direct semantic family/object exists in the frozen ATL-67 independent universe; preserve object ownership/cardinality. |
| 73 | Line Item Hazardous Zone | 102.2 | 97.25 | Conditional domain | Dangerous Goods — inhalation-hazard zone | Domain-valid only when dangerous-goods applicability/relationship conditions are satisfied. |
| 74 | Line Item Hazardous Proper Name | 102.27 | 94.23 | Conditional domain | Dangerous Goods — proper shipping name | Domain-valid only when dangerous-goods applicability/relationship conditions are satisfied. |
| 75 | Handling Unit Count | 105.3 | 37.33 | Canonical BOL/domain | Package / Handling Unit — quantity | Direct semantic family/object exists in the frozen ATL-67 independent universe; preserve object ownership/cardinality. |
| 76 | Handling Unit Line No | 120.83 | 10.26 | Canonical BOL/domain | Consignment Item / Package hierarchy — shipment-item line/sequence association | Owner clarification: identifies shipment-item/line structure when multiple shipment items are clubbed and more than one description line is present. Preserve item-to-handling-unit hierarchy; it is not another count. |

## One-to-many / many-to-one controls

1. **Address families:** Address, Address 2 and Address 3 are multiple SEFL layout fields mapping to one canonical party postal-address structure with `addressLines[]`, city, subdivision/state, postcode and country. They are not three independent global concepts.
2. **Counts and line structure:** `Piece Count`, `Line Item Piece Count` and `Handling Unit Count` remain distinct quantities. `Handling Unit Line No` is a line/sequence association for shipment-item structure when multiple item/description lines occur; it must not be interpreted as another count.
3. **Weights:** `Weight` and `Line Item Weight` map to different ownership levels; neither may overwrite the other without source/object association.
4. **References:** Reference Number, Reference Number Type, Reference Number Type Full Name and PRO participate in the broader Reference/Identifier model. PRO remains distinct; local type vocabulary cannot redefine canonical reference semantics.
5. **Dangerous goods:** hazardous flag, UN/NA, proper shipping name, class/division, packing group, technical name, zone, emergency phone and responsible-person identity form a conditional relationship-aware object. They are not independent universally mandatory fields.
6. **Service windows:** Time Critical and Delivery Appointment begin/end values map to scoped service/event-window semantics and remain conditional on the relevant service/instruction context.
7. **Party identity:** Shipper/Consignee/BillTo names and postal-address fields map to role-resolved party instances. Account numbers and Shipper Code remain master/client bindings rather than canonical domain expansion.

## Unmatched / unresolved disposition

### Probable Malkom-form / client-specific fields pending Ops confirmation — 3
- **Code**
- **SHC**
- **Related Value**

Owner BOL review did not find these on the BOL. Exact definitions remain pending Operations/client-source confirmation; they are not treated as Atlas domain gaps at this stage.

### Resolved through Owner operational clarification — 1
- **Handling Unit Line No** — shipment-item/line structure when multiple shipment items are clubbed and multiple description lines occur. Classified as canonical domain relationship/sequence information.

### Atlas model-coverage gap — 1
- **Line Item Square Yards** — square yard is a legitimate area unit for area-based commodities. Frozen ATL-67 lacks canonical item-level area-measure representation. Retain as an Atlas model gap for governed downstream expansion; ATL-67 remains frozen.

### Semantically unresolved — 1
- **Line Item Hazardous Contract Number** — exact source label/meaning remains unconfirmed. It may be client/Malkom specific, a source-label issue, or a missing hazardous-material concept. Ops/source definition is required before deciding.

### Existing client/master-data bindings — 6
- Reference Number Type Full Name
- Instruction Type
- BOL Type
- Bill To Account Number
- Consignee Account Number
- Shipper Code

These remain non-gap bindings whose exact semantics depend on client/carrier vocabulary or master data.

## ATL-68 acceptance reconciliation

- **All available SEFL fields accounted for:** PASS — 76/76.
- **Coverage denominator explicit:** PASS — 76 source rows, 76 crosswalk rows.
- **Unmatched items classified with rationale/evidence:** PASS — revised with Owner evidence: 3 probable Malkom/client fields pending Ops, 1 operationally resolved domain field, 1 Atlas area-measure model gap, and 1 unresolved hazardous label.
- **No field treated as Atlas gap merely because client/runtime specific:** PASS — client/master-data/contextual classes separated.
- **One-to-many/many-to-one preserved:** PASS — address, count, weight, reference, hazmat, service-window and party families explicitly controlled.
- **Independent baseline preserved:** PASS — no ATL-67 expansion performed.

## Downstream handoff

ATL-68 provides the governed input for ATL-69 experimental testable field scope. ATL-69 must select testable fields using this classification and must not treat unresolved/client-bound fields as equivalent to independently canonical fields without the missing source/binding evidence.

This artifact is crosswalk evidence only. It does not itself certify production readiness, metric validity, or Supabase promotion.
