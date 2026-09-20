# LTL-03 Commodity, Consignment-Item & Handling/Package Contextualization Rules v0.1

Date: 2026-09-20
Workstream: ATL-35
Status: RESEARCH CANDIDATE — NOT FROZEN

## Purpose

Ground commodity/line-item/package contextualization in authoritative object structure so extracted BOL text is resolved to the correct semantic object before correction or enrichment.

## Authoritative structural findings

UN/CEFACT models:
- Consignment as a separately identifiable collection of goods under one transport contract.
- Consignment-level gross weight, gross volume and consignment-item quantity as distinct attributes.
- Repeating included consignment items (0..n).
- Consignment-item gross weight as its own 0..1 measure with a required unit when supplied.
- Repeating transport/logistics packages (0..n), including package quantity, gross/net weight, volume, level, type, sequence, identifier, parent identifier, description/information and units per package.

Therefore a flat BOL field model that treats quantity, weight, package type and commodity text as document-level scalars loses authoritative semantic structure.

## G19 — Semantic-level assignment before validation

WHEN an extracted value can belong to multiple authoritative levels (consignment, consignment item, package/handling unit),
GENERATE:
1. candidate semantic-level assignment;
2. relationship/context tests;
3. assignment confidence;
4. ambiguity exception if level cannot be resolved;
5. only then field-level validation/correction.

Do not correct a value until its semantic owner is known.

## G20 — Measure + unit atomic pair

WHEN authoritative model defines a Measure,
GENERATE:
- numeric content validation;
- unit-code validation;
- pair completeness;
- unit normalization/conversion only under governed conversion rules;
- semantic-level attachment;
- source/canonical value trace.

Example: item gross weight is not only "2150"; it is a measure whose unit is part of the semantic value.

## G21 — Package hierarchy primitive

WHEN package structures expose parent identifiers, levels or repeating children,
GENERATE:
- package identity;
- parent-child relationship;
- hierarchy validation;
- level/type validation;
- orphan-package exception;
- cycle/conflicting-parent exception;
- aggregation/reconciliation where appropriate.

This allows pallet/carton/unit structures to coexist instead of being flattened.

## G22 — Quantity-type disambiguation

WHEN multiple quantity semantics exist,
GENERATE separate candidates for:
- consignment-item quantity;
- package quantity;
- units per package;
- trade-line-item quantity;
- client-specific piece/handling-unit quantity.

Do not infer equivalence from numeric equality.

Example:
"4 pallets / 28 cartons" must not become one generic quantity field. The values require semantic assignment and relationship logic.

## G23 — Weight semantic separation

WHEN weight exists at multiple levels or business purposes,
GENERATE distinct semantic attributes for:
- consignment gross weight;
- consignment-item gross weight;
- package gross/net weight;
- chargeable weight where applicable;
- declared/verified/billing weight when client/source evidence establishes those concepts.

Do not overwrite one with another solely because values conflict.

## G24 — Free-text-to-structured candidate rule

WHEN extracted commodity/package text contains multiple concepts,
GENERATE candidate structured primitives but retain original text.

Example:
"4 PLTS AUTO PARTS 2150 LBS"

Candidate parse:
- package/handling-unit quantity = 4
- package/handling-unit type = pallet
- commodity description candidate = auto parts
- weight candidate = 2150 lb

Then apply semantic-level assignment and relationship checks.

No candidate becomes canonical merely because parsing succeeded.

## G25 — Aggregate reconciliation

WHEN consignment-level aggregates and child item/package measures coexist,
GENERATE:
- child-to-parent reconciliation;
- governed tolerance/client-binding slot;
- missing-child-data distinction;
- arithmetic mismatch exception;
- source-precedence logic where totals differ.

Do not assume parent gross weight must equal simple sum until applicable semantics/client rule are established.

## G26 — Instruction/note ownership

WHEN authoritative model permits information/instructions at consignment or consignment-item level,
GENERATE:
- ownership classification;
- preserve repeating notes/instructions;
- prevent item-specific instructions from being promoted to shipment-global instruction without evidence.

## Contextualization consequence for IDP/Malkom

Extraction may correctly return text and numbers but still fail operationally if semantic ownership is wrong.

Required post-extraction sequence:
extract -> normalize -> identify semantic object/level -> establish relationships -> validate value/unit/code -> reconcile aggregates -> apply client/master context -> canonicalize or escalate.

## Candidate exception classes

SEMANTIC_LEVEL_AMBIGUOUS
QUANTITY_TYPE_AMBIGUOUS
MEASURE_UNIT_MISSING
MEASURE_UNIT_INVALID
PACKAGE_PARENT_MISSING
PACKAGE_HIERARCHY_CONFLICT
AGGREGATE_CHILD_MISMATCH
ITEM_PACKAGE_RELATIONSHIP_AMBIGUOUS
INSTRUCTION_OWNER_AMBIGUOUS

Names remain candidate Atlas nomenclature.

## Generator significance

These rules directly support the successor-generator hypothesis: authoritative sources can generate not only a BOL field list but the semantic structure and contextualization logic required to interpret extracted BOL content.

They should later be tested against the independently derived BOL universe and then against SEFL's 76 fields only after the independent universe is frozen.
