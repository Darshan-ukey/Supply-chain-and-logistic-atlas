# LTL-03 BOL Universe -> Normalized Rule System Crosswalk v0.1

Date: 2026-09-20
Workstream: ATL-35
Status: PARTIAL RESEARCH CROSSWALK — NOT FROZEN

## Purpose

Test whether independently derived BOL fields/relationships can be represented by a relatively small reusable primitive/rule-family system.

This is not yet the final generator-coverage test. It is the first normalization/scalability crosswalk.

## Crosswalk examples

| Independent BOL element | Semantic primitive(s) | Reusable family/families | Generated rule instance |
|---|---|---|---|
| PRO number | Identifier, Reference, Document | RF1, RF3, RF4, RF9 | Resolve PRO; bind to BOL; apply requiredness; use for update/delete lookup |
| Carrier-assigned consignment ID | Identifier, Reference | RF1, RF4 | Resolve assigning authority, uniqueness scope and object binding |
| Consignor-assigned ID | Identifier, Reference | RF1, RF4 | Resolve consignor-scoped reference and bind to consignment |
| LocationID | Identifier, Location, Master Reference | RF1, RF4, RF6, RF11 | Resolve org-scoped LocationID; apply client mandatory override if configured |
| Shipper / consignor | Party, Relationship, Master Reference | RF2, RF6 | Resolve role then identity/master; bind party to consignment |
| Consignee | Party, Relationship, Master Reference | RF2, RF6 | Resolve consignee role then master identity; escalate ambiguity |
| Carrier | Party, Relationship | RF2, RF6 | Resolve carrier role and identity |
| Pickup location | Location, Relationship, Event | RF2, RF6 | Resolve pickup-event role then location identity |
| Consignee receipt location | Location, Relationship | RF2, RF6 | Resolve receipt role then identity |
| Final destination | Location, Relationship | RF2, RF6, RF11 | Preserve separately; optionally bind equivalence at client layer |
| Consignment gross weight | Measure | RF13, RF9 | Validate value/unit/owner; preserve source authority |
| Item gross weight | Measure, Commodity/Item | RF13, RF2 | Attach measure to item; validate unit |
| Package gross weight | Measure, Package | RF13, RF2, RF14 | Attach measure to package/hierarchy node |
| Gross volume | Measure | RF13 | Validate value/unit/semantic owner |
| Package quantity | Collection/Cardinality, Package | RF4, RF12 | Validate package-level quantity and reconcile to child structures when applicable |
| Item quantity | Collection/Cardinality, Commodity/Item | RF4, RF12 | Validate item-level quantity without conflating package quantity |
| Handling-unit/package type | Controlled Vocabulary, Package | RF5 | Validate code/type against governed vocabulary |
| Repeating consignment items | Collection/Cardinality, Commodity/Item | RF4, RF2 | Generate child collection and per-child validation |
| Repeating packages | Collection/Cardinality, Package, Relationship | RF4, RF14 | Generate child collection/hierarchy |
| Parent package ID | Identifier, Relationship, Package | RF1, RF14 | Resolve parent identifier and hierarchy integrity |
| Item/commodity description | Commodity/Item, Evidence | RF15 | Parse candidates but preserve source text and owner |
| Special instruction | Instruction/Note | RF16 | Preserve semantic owner and scope |
| Accessorial code | Controlled Vocabulary | RF5, RF11 | Validate canonical code; apply client mapping if required |
| Payment terms | Controlled Vocabulary | RF5 | Validate governed value/code family |
| Classification code | Controlled Vocabulary | RF5 | Validate classification code family; do not infer hazmat equivalence |
| Hazmat activation | State/Condition, Commodity/Item | RF7 | Activate regulatory field/representation requirements |
| Hazmat basic-description sequence | Controlled Vocabulary/Representation | RF7, RF10 | Validate conditional sequence/representation |
| BOL create | Document, Event, State | RF3 | Validate transition/preconditions and create document identity |
| BOL update | Document, Event, State, Identifier | RF3, RF1 | Resolve PRO target then validate/update state |
| BOL delete/cancel | Document, Event, State, Identifier | RF3, RF1 | Resolve target then validate allowed delete/cancel transition |
| Invalid BOL data | Evidence/Error | RF8 | Emit validation failure with governed severity/remediation |
| BOL not found | Identifier, Error | RF1, RF8 | Emit identity-not-found rather than generic validation failure |

## Early normalization finding

A large variety of BOL fields/relationships can already be represented through composition of a smaller set of reusable families.

The important mechanism is composition, not one-family-per-field.

Examples:
- PRO behavior = RF1 Identity/Reference + RF3 Lifecycle + RF4 Requiredness + RF9 Source Authority.
- LocationID = RF1 Identity + RF6 Master Reconciliation + RF11 Client Specialization.
- Package gross weight = RF13 Measure + RF2 Relationship + RF14 Hierarchy.
- Hazmat description = RF7 Conditional Activation + RF10 Representation Constraint + RF5 Controlled Values where applicable.

## Current architectural observation

No new canonical rule family was required to represent the crosswalk examples above.

This is evidence in favor of the normalization architecture, but it is not yet proof because:
- the independent BOL universe is not frozen;
- exact NMFTA property-level schema recovery remains incomplete;
- generated instances are not fully enumerated;
- client bindings are not fully enumerated;
- Rule Reuse Ratio cannot yet be calculated reliably.

## Prospective test

For each newly discovered BOL element:
1. classify the authoritative domain fact;
2. map to existing primitive(s);
3. compose existing RF1-RF16;
4. record a generated instance;
5. create a new family only if composition materially fails;
6. record the reason if a new family is introduced.

## Scalability checkpoint

At this crosswalk checkpoint:
- apparent prior generator behaviors: 26
- normalized reusable family candidates: 16
- crosswalk elements sampled here: 30
- new family required by this sample: 0
- full generated-instance total: not yet frozen
- Rule Reuse Ratio: not yet valid to calculate

This is an early positive scalability signal, subject to later full-universe and cross-task testing.
