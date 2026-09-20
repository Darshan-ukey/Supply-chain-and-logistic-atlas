# LTL-03 Graph-First Discovery — Package Type / Handling Semantics / Requestor Role v0.1

Date: 2026-09-20
Workstream: ATL-35
Status: RESEARCH CANDIDATE — GRAPH-FIRST INTAKE

## Track A — authoritative evidence

### Package / handling semantics

UN/CEFACT D23B models Logistics Package as a distinct semantic object with:
- item/package quantity;
- gross/net weight;
- gross volume;
- packaging level code;
- package type code;
- package type text;
- sequence number;
- package identifier;
- global package identifier;
- parent package identifier;
- units per package.

Transport Package occurs 0..n at consignment and consignment-item levels.

UN/CEFACT also distinguishes packaging level from package type:
- packaging level = hierarchy semantics;
- package type = controlled package-type semantics.

### Requestor role

UN/CEFACT party-role codes include:
- HI = Requestor — the party requesting an action.

NMFTA eBOL 2.1 independently confirms a Requestor_Roles schema family.

Evidence boundary:
NMFTA Requestor_Roles existence is verified at schema-family level, but exact BOL_Request property placement/cardinality remains unresolved.

## Domain facts

DF-PACKAGE-TYPE-DISTINCT-FROM-HIERARCHY:
Package type and packaging hierarchy level are separate semantics.

DF-PACKAGE-IDENTITY-STRUCTURE:
A package may have local/global/parent identifiers and sequence semantics.

DF-PACKAGE-UNIT-COUNT:
Units per package is distinct from package quantity and must not be conflated.

DF-REQUESTOR-ROLE:
Requestor is a party role, not a free-text label.

## Primitive mapping

Existing:
- Package / Handling Unit
- Identifier / Reference
- Controlled Vocabulary
- Relationship
- Collection / Cardinality
- Party

## Rule-family composition

Package:
- RF1 Identity & Reference Resolution
- RF2 Relationship Integrity
- RF4 Requiredness/Cardinality
- RF5 Controlled-Value Validation
- RF12 Aggregate Reconciliation
- RF14 Hierarchy
- RF22? No new family. Quantity-type distinction remains represented through existing normalized logic/semantic ownership.

Requestor:
- RF2 Relationship Integrity
- RF5 Controlled-Value Validation
- RF6 Master/Reference Reconciliation where requestor identity is resolved
- RF11 Client Specialization where requestor role mapping differs locally

## Generated instances

- validate package type separately from packaging level;
- resolve package local/global/parent identifiers;
- validate package sequence and parent-child linkage;
- distinguish units-per-package from package quantity;
- resolve requestor role before requestor identity;
- validate requestor role against governed vocabulary when applicable.

## Cross-family implications

Package hierarchy:
RF14 CONSTRAINS package parent/child relation;
RF1 resolves package identifiers;
RF5 validates package type and level values;
RF12 depends on correctly separated package quantity vs units-per-package.

Requestor:
RF2 PRECEDES RF6;
role resolution precedes identity/master canonicalization.

## Normalization result

New primitive required: 0.
New reusable family required: 0.
Existing catalogue remains sufficient.

## Evidence boundary

Do not equate NMFTA Handling_Unit_Types with UN/CEFACT Package Type without property/object-level issuer evidence.

Do not collapse package quantity, units per package, item quantity or handling-unit quantity into one generic quantity.
