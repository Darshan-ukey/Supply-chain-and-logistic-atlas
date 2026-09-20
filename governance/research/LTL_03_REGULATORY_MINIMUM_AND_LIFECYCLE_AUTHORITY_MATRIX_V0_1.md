# LTL-03 Regulatory Minimum & Lifecycle/Authority Matrix v0.1

Date: 2026-09-20
Workstream: ATL-35
Status: RESEARCH CANDIDATE — NOT FROZEN

## Purpose

Advance Track A authoritative execution-knowledge discovery while simultaneously mapping discoveries into the normalized rule system (Track B).

This artifact deepens:
1. U.S. regulatory minimum BOL/receipt information;
2. conditional hazardous-material shipping-paper information;
3. lifecycle/source-authority semantics;
4. normalization into existing reusable rule families.

## Evidence boundary

Exact NMFTA BOL_Request property-level schema remains unresolved because the indexed NMFTA documentation currently exposes the schema name and API/code families but not the full property body in a directly verifiable form.

Do not invent exact BOL_Request properties/cardinalities until the issuer artifact can be recovered and independently cited.

## A. Federal motor-carrier BOL / receipt minimum

49 CFR 373.101 establishes minimum information for covered interstate/foreign motor-carrier receipts or bills of lading:

1. consignor name;
2. consignee name;
3. origin point;
4. destination point;
5. number of packages;
6. description of freight;
7. weight, volume, or measurement of freight when applicable to rating.

### Generator mapping

| Regulatory element | Primitive(s) | Reusable family | Lifecycle/source authority implication |
|---|---|---|---|
| Consignor name | Party, Relationship | RF2, RF6 | Required regulatory presence at BOL/receipt issuance; client master may contextualize identity |
| Consignee name | Party, Relationship | RF2, RF6 | Required regulatory presence; role-first identity resolution |
| Origin point | Location, Relationship | RF2, RF6 | Required regulatory presence; preserve origin semantic role |
| Destination point | Location, Relationship | RF2, RF6 | Required regulatory presence; preserve destination semantic role |
| Number of packages | Collection/Cardinality, Package | RF4, RF12 | Required presence; package-count reconciliation where supporting structure exists |
| Description of freight | Commodity/Item, Evidence | RF15 | Required source text; preserve original description even if structured/enriched |
| Weight/volume/measurement when rating-relevant | Measure | RF13, RF9 | Conditional regulatory presence; semantic owner/source authority required |

### Normalization finding

No new reusable family is required for the 49 CFR 373.101 minimum set.

The regulation specializes existing primitives/families by adding:
- regulatory requiredness;
- applicability condition;
- lifecycle stage;
- evidence/provenance.

This supports normalization rather than new handcrafted rule families.

## B. Hazardous-material shipping-paper conditional expansion

49 CFR 172.202 requires a hazardous-material shipping description to include, as applicable:
- identification number;
- proper shipping name;
- hazard class/division;
- packing group where assigned;
- total quantity with unit for most highway cases;
- number and type of packages.

The basic-description elements identified in 172.202(a)(1)-(4) must be presented in sequence without unrelated information interspersed.

49 CFR 172.203 adds condition-specific information for categories such as:
- special permit notation;
- limited quantity notation;
- hazardous-substance identification and RQ notation;
- radioactive-material information;
- other subsection-specific conditions.

### Generator mapping

| Regulatory condition | Primitive(s) | Reusable family | Generated behavior |
|---|---|---|---|
| Hazmat applies | State/Condition, Commodity | RF7 | Activate expanded regulatory contract |
| Identification number | Identifier, Controlled Vocabulary | RF1, RF5 | Validate against regulatory reference source |
| Proper shipping name | Commodity, Controlled Vocabulary | RF5 | Validate governed description/reference |
| Hazard class/division | Controlled Vocabulary | RF5 | Validate code/class |
| Packing group | Controlled Vocabulary | RF5, RF7 | Required only when applicable |
| Total quantity + unit | Measure | RF13, RF7 | Validate quantity/unit pair |
| Number/type packages | Package, Collection | RF4, RF5, RF7 | Validate count and package type |
| Basic-description sequence | Representation | RF10, RF7 | Validate order/grouping |
| Limited Quantity notation | Condition/Representation | RF7, RF10 | Generate notation only when condition applies |
| RQ / hazardous substance details | Condition, Commodity, Representation | RF7, RF10 | Activate additional description rule |
| Special permit notation | Identifier/Reference, Condition | RF1, RF7, RF10 | Require permit reference and placement association |

### Normalization finding

Again, no new family is required.

The hazardous-material rules are compositions of:
- RF7 Conditional Activation;
- RF5 Controlled-Value Validation;
- RF13 Measure Semantics;
- RF4 Requiredness/Cardinality;
- RF10 Representation Constraint;
- RF1 Identity/Reference.

## C. NMFTA eBOL lifecycle semantics

Current NMFTA eBOL documentation establishes:
- POST /bol/v1/app/ = create;
- PUT /bol/v1/app/{pro} = update;
- DELETE /bol/v1/app/{pro} = delete;
- PRO is the unique document identifier for update/delete functions;
- the schema family includes BOL_Request, BOL_Response and controlled-code families.

Current NMFTA FAQ further establishes:
- CREATE/UPDATE/DELETE may also be represented in a function variable, though REST verbs are recommended;
- bad BOL data should generally return HTTP 400;
- update/delete when BOL cannot be found should generally return 404;
- multiple validation errors may be returned;
- failure errors should precede informational/warning responses;
- LocationID is optional at standard level and unique only within shipper/carrier systems;
- carriers may make a standard non-mandatory field mandatory;
- carriers may impose backend-specific min/max string constraints;
- PRO may be shipper pre-assigned or carrier-assigned.

### Generator mapping

| Lifecycle fact | Primitive(s) | Family | Generated instance |
|---|---|---|---|
| POST create | Document, Event, State | RF3 | Create-BOL transition |
| PUT update by PRO | Document, Event, State, Identifier | RF3, RF1 | Resolve current BOL by PRO then update |
| DELETE by PRO | Document, Event, State, Identifier | RF3, RF1 | Resolve target then validate delete/cancel |
| PRO pre-assigned or carrier-assigned | Identifier, Reference | RF1, RF4 | Assignment-path decision + provenance |
| 400 invalid data | Error/Evidence | RF8 | Data-validation failure |
| 404 target not found | Identifier, Error | RF1, RF8 | Identity-not-found failure |
| multiple errors | Collection/Error | RF8 | Aggregate validation response |
| optional LocationID | Identifier, Location, Master | RF1, RF6 | Scoped resolution; not global uniqueness |
| carrier makes optional field mandatory | Client Binding | RF11 | Client-specific requiredness specialization |
| carrier min/max string constraint | Client Binding, Representation | RF11, RF10 | Runtime/client constraint, not canonical semantic rewrite |

## D. Field -> lifecycle -> authority -> contextualization matrix

| Semantic field/object | Lifecycle stage | Canonical/source authority | Master/reference dependency | Contextualization rule |
|---|---|---|---|---|
| Consignor | BOL create / validation | Regulatory BOL source requires presence | Client shipper/customer master may canonicalize identity | Role-first then identity resolution |
| Consignee | BOL create / validation | Regulatory BOL source requires presence | Client consignee/location master | Role-first; ambiguity escalates |
| Origin | BOL create / validation | Regulatory BOL source requires origin point | Location master optional for canonicalization | Preserve origin role; resolve identity separately |
| Destination | BOL create / validation | Regulatory BOL source requires destination point | Location master optional | Preserve destination role |
| Number of packages | BOL create / validation | Regulatory BOL source | Package child structures if present | RF4 + RF12 reconciliation |
| Freight description | BOL create / validation | Source BOL/receipt text is evidentiary | Classification/reference sources may enrich | Preserve raw description; structured parsing cannot destroy source |
| Rating-relevant weight/volume/measurement | BOL create/rating | Regulatory source requires when rating-applicable | Unit/reference conversion as governed | Measure + semantic owner + source precedence |
| PRO | Pre-create/create/update/delete | NMFTA eBOL / carrier assignment path | Carrier identifier authority | Resolve assignment authority, bind to BOL, preserve provenance |
| LocationID | Create/validation | Partner-supplied/local standard field | Shipper/carrier location master | Resolve within assigning organization only |
| Hazmat identification number | Conditional BOL/shipping paper | 49 CFR 172.202 / 172.101 table | Regulatory table | Activate only when hazmat rule applies |
| Hazmat proper shipping name | Conditional | 49 CFR 172.202 / 172.101 | Regulatory table | Controlled/reference validation |
| Hazmat class/division | Conditional | 49 CFR 172.202 / 172.101 | Regulatory table | Controlled validation |
| Hazmat packing group | Conditional | 49 CFR 172.202 / 172.101 | Regulatory table | Conditional presence |
| Hazmat quantity/unit | Conditional | 49 CFR 172.202 | Unit semantics | Measure validation |
| Hazmat package number/type | Conditional | 49 CFR 172.202 | Package type semantics | Package/count validation |
| Hazmat description order | Conditional representation | 49 CFR 172.202 | none | RF10 sequence constraint |

## E. Structural -> Semantic -> Value correctness

This tranche reinforces the governing correction order.

### Structural correctness
- required object/value present?
- valid cardinality?
- lifecycle target exists?
- required conditional expansion activated?

### Semantic correctness
- correct role?
- correct semantic owner?
- correct relationship?
- correct lifecycle meaning?

### Value correctness
- valid identifier/code?
- valid measure/unit?
- valid master match?
- valid format/sequence?

Automatic correction remains prohibited until structural and semantic correctness are sufficiently resolved.

## F. Track B scalability checkpoint

New authoritative discoveries in this tranche:
- 7 federal BOL minimum information elements;
- multiple hazmat conditional description/representation requirements;
- NMFTA lifecycle/error/partner-specialization facts.

New reusable rule families required: **0**.

All discoveries fit existing RF1-RF16 through specialization/composition.

This is additional evidence that domain facts can grow substantially faster than the canonical rule-family catalogue.

## G. Open items

1. Recover exact NMFTA BOL_Request properties from issuer-maintained YAML/OpenAPI artifact.
2. Extract exact property/cardinality constraints once issuer artifact is accessible.
3. Expand 49 CFR 172.203 conditional cases only as relevant to highway/LTL scope.
4. Add field-level source-authority distinctions for declared, verified and billing values from authoritative/client evidence.
5. Enumerate generated rule instances for full LTL-03 universe.
6. Calculate valid Rule Reuse Ratio only after instance set is frozen.
7. Freeze independent BOL universe.
8. Run generator-vs-universe test for ATL-37 Claude audit.
