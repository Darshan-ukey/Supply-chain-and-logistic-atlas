# LTL-03 Cardinality and Relationship Rules v0.1

Date: 2026-09-20
Workstream: ATL-35
Status: RESEARCH CANDIDATE — NOT FROZEN

## Purpose

Use authoritative cardinality and object-relationship evidence to generate deterministic Work Decomposition and Domain Execution Contract logic.

## Core generator rule

WHEN an authoritative model defines object/attribute cardinality,
GENERATE:
- expected occurrence rule;
- missing-object rule where minimum > 0;
- duplicate/excess-occurrence rule where maximum = 1;
- repeated-child iteration where maximum = n;
- parent-child relationship validation;
- aggregate/reconciliation logic where parent contains repeating children;
- exception/queue logic for cardinality or relationship failure.

## Source-backed examples

### Road Consignment
UN/CEFACT road-consignment model:
- specified road consignment occurrence = 1..1.

Generator effect:
- exactly one canonical consignment root is expected for the modeled road-consignment message/context;
- missing root => structural failure;
- multiple roots => structural ambiguity unless client/source model explicitly supports a different envelope.

### Carrier-assigned identifier
UN/CEFACT carrier-assigned consignment identifier occurrence = 0..1.

Generator effect:
- field may be absent at canonical level;
- if present, there must not be more than one value in this semantic slot;
- client binding may make presence mandatory;
- booking reference is an example of this semantic type.

### Consignor-assigned identifier
UN/CEFACT consignor-assigned consignment identifier occurrence = 0..1.

Generator effect:
- optional at canonical level;
- preserve distinct semantic role from carrier-assigned identifier;
- do not merge both into a generic reference without role metadata.

### Carrier party
UN/CEFACT Consignment -> Carrier Party occurrence = 0..1.

Generator effect:
- optional canonical relationship in the semantic model;
- at most one carrier relationship in this slot;
- client workflow may require carrier resolution before BOL creation;
- multiple candidate carriers must be treated as unresolved relationship, not accepted silently.

### Consignor / Consignee party
UN/CEFACT transport/BOL models represent consignor and consignee as distinct party relationships, each typically 0..1 in the modeled association.

Generator effect:
- generate separate party-resolution work units;
- do not treat shipper and consignee as one generic party type;
- client execution contract may strengthen presence to required.

### Consignment Item Quantity
UN/CEFACT defines Consignment Item Quantity occurrence = 0..1 as the count of separately defined consignment items.

Generator effect:
- optional aggregate quantity attribute;
- if present, reconcile it against the actual number of defined consignment-item children where the model/client contract requires that relationship.

### Included Consignment Items
UN/CEFACT supply-chain consignment may include 0..n consignment items.

Generator effect:
- generate repeating child iteration;
- each child requires its own semantic validation;
- aggregate checks may reconcile parent totals to child values;
- line-item-level exceptions should preserve child identity rather than collapse to a document-level error.

### Consignment Item Gross Weight / Volume
UN/CEFACT consignment-item gross weight and gross volume each occur 0..1.

Generator effect:
- at most one gross weight and one gross volume per item semantic slot;
- unit of measure is mandatory when measure content is supplied in the cited model;
- generate value + unit pair validation.

### Transport Packages
UN/CEFACT supply-chain consignment may contain 0..n transport/logistics packages.

Generator effect:
- package/handling-unit structures are repeating children;
- generate per-package count/weight/type validation;
- do not flatten repeated packages into a single scalar field.

### Applicable Notes
UN/CEFACT consignment item may have 0..n applicable notes.

Generator effect:
- preserve multiple item-level notes/instructions;
- contextualization must classify note semantics rather than overwrite to one free-text value.

### Service Charges
UN/CEFACT consignment may have 0..n applicable service charges.

Generator effect:
- repeating charge/accessorial structures;
- payment arrangement, category, amount and paying-party role can be validated per charge;
- do not model accessorial/service-charge information as one global string.

### Consignee Receipt Location
UN/CEFACT models a consignee-receipt logistics location at 0..1.

Generator effect:
- separate destination/receipt-location semantic slot;
- generate location identity + address/master resolution;
- avoid assuming every address printed on BOL maps to the same location role.

## New deterministic rule families

### G13 — Cardinality primitive
WHEN occurrence = 0..1:
- optional single-value semantic slot;
- if multiple extracted candidates survive contextualization => ambiguity/duplicate exception.

WHEN occurrence = 1..1:
- mandatory single object/value;
- missing => required-structure exception;
- multiple => ambiguity/duplicate exception.

WHEN occurrence = 0..n:
- optional repeating child collection;
- preserve each child separately;
- generate child iteration and child-level validation.

WHEN occurrence = 1..n:
- mandatory repeating collection;
- require at least one child;
- validate each child and collection-level reconciliation.

### G14 — Aggregate-to-child reconciliation primitive
WHEN a parent exposes an aggregate quantity/weight/count AND repeating child objects exist,
GENERATE:
- aggregate-vs-child reconciliation rule;
- tolerance/client-binding slot if arithmetic or operational variance is permitted;
- mismatch exception;
- source-precedence rule if authoritative totals differ.

### G15 — Role-specific party/location primitive
WHEN the semantic model defines distinct party/location roles,
GENERATE:
- separate capture/resolution unit per role;
- role-aware master lookup;
- role-specific source precedence;
- prevent generic name/address matching from collapsing different roles.

## Contextualization implication

These cardinality rules directly improve post-extraction contextualization.

Example:
If OCR extracts two possible consignee names, the executor should not simply choose the higher-confidence string. If the semantic slot is 0..1 and both candidates remain plausible after address/reference/master checks, the correct outcome is AMBIGUOUS_CONSIGNEE rather than an unsafe auto-correction.

Example:
If BOL text contains "4 pallets / 28 cartons", a flat extractor may emit two quantities. The semantic model allows repeating package/handling-unit structures and distinct consignment-item quantities. The Domain Execution Contract must determine which quantity belongs to which object instead of overwriting one with the other.

## Research conclusion

Authoritative cardinality materially strengthens the successor generator because it provides deterministic structure for:
- single vs repeating objects;
- mandatory vs optional slots;
- child iteration;
- aggregate reconciliation;
- role-specific resolution;
- ambiguity detection.

This reduces reliance on LLM judgment in both Work Decomposition and contextualization.
