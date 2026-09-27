# ATL-67 — Independent BOL Field Universe Freeze v1.0

Status: FROZEN INDEPENDENT COMPARISON BASELINE
Date: 2026-09-27
Scope: ATL-67 / LTL-03
Independence rule: derived from retained LTL-03 authoritative/generic research only. The SEFL/Malkom 76-field list was not used to shape this universe.

## Freeze basis

This freeze consumes the governed retained evidence already independently accepted under ATL-60, including:
- `governance/research/LTL_03_INDEPENDENT_BOL_FIELD_UNIVERSE_V0_1.md` (independent universe seed; blob recorded by ATL-60: `ea5c13cd113f58319b46875e60eca0a5a4600327`);
- `governance/research/LTL_03_NMFTA_EBOL21_BOL_REQUEST_SCHEMA_CLOSURE_V0_1.md` and recovered issuer file `ebol-apiv2.1.0.yaml`, exact source-byte SHA-256 `39715755793a2f39ee290e17f3997cb1bd7cadf001e5531f4a61093df1094e8c`;
- `governance/research/LTL_03_REGULATORY_MINIMUM_AND_LIFECYCLE_AUTHORITY_MATRIX_V0_1.md`;
- `governance/research/LTL_03_BOL_UNIVERSE_NORMALIZED_CROSSWALK_V0_1.md`;
- `governance/research/LTL_03_EXECUTION_LOGIC_GRAPH_V0_1.json` (ATL-60 verified retained structured substrate: 471 nodes / 2,538 typed edges);
- `governance/research/ATL_35_LTL_03_FREEZE_CANDIDATE_MANIFEST_V0_1.md`.

The ATL-60 independent QA PASS explicitly verified that the retained research chain is evidence-complete for its governed candidate baseline while preserving explicit gaps. This ATL-67 artifact freezes the unbiased BOL-side comparison universe; it does not promote Supabase knowledge and does not certify DOMAIN_EXECUTION_READY.

## Canonical information-object universe

The frozen comparison basis is object/relationship-first, not a flat client field list.

| Canonical information object | Canonical information / relationships | Aliases / representations admitted at freeze | Cardinality / ownership / conditionality boundary |
|---|---|---|---|
| Shipment / Consignment | carrier-, consignor-, freight-forwarder-assigned identifiers; gross/net weight; gross volume; package quantity; items; consignor; consignee; carrier; receipt/final-destination/pickup/transit locations | shipment, consignment; identifier/reference representations remain authority-scoped | items 0..n; transit locations repeating; measures owned by consignment; role-specific parties/locations remain distinct |
| Transport Document / BOL / eBOL | document identity; PRO; lifecycle purpose/action; result/error status; shipping-label format; requestor role; LocationID | BOL, Bill of Lading, eBOL/electronic BOL; PRO is a distinct reference, not a synonym for BOL | create/update/delete-cancel lifecycle; PRO may be requestor-preassigned or carrier-assigned; LocationID is organization-scoped |
| Reference / Identifier | value; type; assigning party/system; related object; relationship; status; uniqueness scope; creation event; authority | carrier/consignor/forwarder references; PRO; booking/other references only where source-backed | identifier meaning is scoped by issuer/role/object; no global uniqueness assumption |
| Party | role; identifier; name; government registration/identifier type; postal address | shipper/consignor; consignee; carrier; BillTo where source-backed | resolve role before identity/master; address belongs to resolved party instance |
| Location | identifier; name; function/type; description; country; subdivision/state; postal address; coordinates; NMFTA LocationID | origin/pickup/acceptance, consignee receipt, final destination, transit according to relationship role | role-specific; receipt and final destination are not collapsed absent binding evidence |
| Consignment Item / Commodity | sequence; type code; gross/net/chargeable weight; gross volume; description/information; package quantity/type; trade-line quantity; special/delivery instructions; damage remarks; transport packages | commodity/item/line-item representations preserved only when semantic owner is known | items repeat; measures and instructions remain item-owned; package quantity is not generic piece count |
| Package / Handling Unit | quantity; gross/net weight; gross volume; level; type; sequence; identifier; parent identifier; description; units per package | package, handling unit where source semantics support mapping | repeating hierarchy; parent-child integrity required; package-level measures stay package-owned |
| Service / Accessorial / Handling | accessorial, limited-access and time-critical controlled-value families | issuer/carrier/client codes mapped through governed binding | controlled-code family is canonical; local mappings do not rewrite canonical semantics |
| Payment Terms | governed payment-term family | source/client representation via controlled mapping | controlled-value validation; client specialization remains binding |
| Classification | classification-code family including NMFTA/NMFC-related governed semantics where directly supported | code/text representation where authority is known | classification remains distinct from hazardous-material semantics |
| Dangerous Goods / Hazmat | activation condition; UN/NA number; proper shipping name; hazard class/division; packing group where applicable; conditional technical name; inhalation-hazard zone; emergency response phone; responsible person/ERI-provider relationship; package/quantity relationships | hazmat, hazardous material, dangerous goods as contextual representations, not unconditional semantic equivalence | conditional requiredness and prescribed representation/sequence follow governing regulation; relationship to the correct line item/package is mandatory |
| Instruction / Note | special, delivery and other scoped instruction/note content | local labels only as representations after owner/type resolution | owner/scope must be preserved; exact Instruction Type vocabulary may require binding/source context |
| Error / Result | invalid-data and identity/target-not-found semantics; governed result/status families | API/result codes map to canonical error semantics | invalid information and target-not-found remain separate exception classes |

## Canonical semantic controls frozen with the universe

1. Extraction is not semantic resolution. Detection/recall, object association, semantic classification, normalization/validation and conditional applicability are separate controls.
2. Role precedes identity for party/location resolution.
3. Identifier/reference values carry assigning authority, object relationship and uniqueness scope.
4. Measures carry semantic owner and unit; gross, net, chargeable weight and volume are not interchangeable.
5. Handling-unit, package and line-item quantities are not collapsed into generic piece count.
6. BOL/eBOL lifecycle supports source-backed create/update/delete-cancel semantics; later shipment truth may change after initial document creation.
7. Client/carrier optionality or mandatory overrides are Z2/client bindings and cannot rewrite the independent Z1 universe.
8. Hazardous-material requirements are conditionally activated and relationship-aware; a hazmat flag alone is not the complete regulatory object.
9. Source authority/provenance and conflict state must be preserved; unsupported precedence must not be invented.
10. Controlled vocabularies are normalized canonically while local codes remain mapped representations.

## Explicit unresolved / non-canonical items

The freeze does not fabricate semantics for retained unresolved labels or client-specific structures. The following remain SOURCE_CONTEXT_PENDING, CLIENT_BINDING_REQUIRED, MASTER_DATA_REQUIRED, or separate knowledge gaps as applicable:
- Code;
- SHC;
- Related Value;
- BOL Type;
- Reference Number Type Full Name;
- Handling Unit Line No;
- Shipper Code;
- exact Bill To / Consignee Account Number meanings;
- exact Instruction Type values;
- exact Time Critical Details coding;
- client SOP mandatory-field rules, local queue codes and carrier-specific screen fields;
- universal LTL chargeable-weight/DIM formula;
- unresolved DSDC publication-state conflicts;
- customs jurisdiction/broker/client-specific decision rules.

These unknowns do not authorize omission from later crosswalk analysis: ATL-68 must classify unmatched SEFL fields as canonical match, representation/alias, client binding/master-data requirement, source-context pending, or unsupported/client-local candidate.

## Freeze restrictions for ATL-68

ATL-68 must compare the SEFL/Malkom 76-field list *to this frozen independent universe*. It must not retroactively add a canonical object/field merely because it appears in SEFL. Any proposed expansion requires separate authoritative evidence and governed revision of this freeze.

## ATL-67 disposition

Acceptance satisfied for the independent side of the crosswalk:
- versioned field/information universe: this v1.0 artifact;
- canonical fields/information objects: frozen above;
- aliases/representations: explicitly bounded above;
- provenance: retained authoritative/generic evidence identities pinned above;
- conditionality/cardinality/object ownership: preserved above;
- unresolved gaps: explicit and non-fabricated above;
- independence from SEFL/Malkom 76-field shaping: explicit and enforced.

This is an evidence-backed comparison freeze, not a production-readiness or canonical-database promotion claim.
