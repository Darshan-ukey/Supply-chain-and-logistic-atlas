# LTL-03 Graph-First Discovery — NMFC Classification / Density Semantics v0.1

Date: 2026-09-20
Workstream: ATL-35
Status: RESEARCH CANDIDATE — GRAPH-FIRST INTAKE

## Authoritative evidence

NMFTA current classification guidance establishes:

1. Freight class is an LTL classification semantic, with classes ranging from 50 through 500.
2. NMFC classification evaluates four transportation characteristics:
   - density;
   - handling;
   - stowability;
   - liability.
3. Density of a handling unit is calculated from the handling unit as tendered:
   - determine cubage from greatest straight-line length × width × height, including projections;
   - convert cubic inches to cubic feet by dividing by 1,728;
   - divide handling-unit weight by cubic feet to obtain pounds per cubic foot (pcf).
4. Density is increasingly a primary classification factor, but items with handling, stowability or liability concerns are not necessarily pure-density classification.
5. NMFC is a voluntary industry standard. NMFTA guidance states that it should be used for class determination absent applicable carrier tariffs; therefore Atlas must not assume NMFC classification universally overrides carrier tariff provisions.
6. Current NMFC density/class structures are versioned and can change through FCDC dockets. Exact class mapping must therefore carry effective/version context rather than be treated as timeless domain truth.

## Domain facts

DF-NMFC-CLASS-SEMANTIC:
Freight class is an LTL classification value, not equivalent to commodity description, NMFC item number, generic item type, or density itself.

DF-NMFC-FOUR-CHARACTERISTICS:
NMFC classification considers density, handling, stowability and liability.

DF-HANDLING-UNIT-DENSITY:
Handling-unit density is weight divided by cubage in cubic feet, with cubage based on greatest straight-line dimensions including projections as tendered.

DF-CLASSIFICATION-NOT-PURE-DENSITY:
Density alone does not universally determine class because handling, stowability and liability may alter classification treatment.

DF-NMFC-TARIFF-PRECEDENCE-BOUNDARY:
NMFC is a voluntary standard and applicable carrier tariff provisions may govern classification in scoped implementations.

DF-NMFC-VERSIONED-CLASS-MAPPING:
Density/class breakpoints and classification provisions are versioned/effective-date governed and must not be treated as timeless constants.

## Semantic mapping

Existing primitives are sufficient:
- Commodity / Consignment Item
- Package / Handling Unit
- Measure
- Controlled Vocabulary
- Relationship
- Evidence / Provenance
- TemporalValue where effective dates/version applicability are required

Do not equate:
- UN/CEFACT Consignment Item Type Code with NMFC item number;
- density with freight class;
- freight class with commodity identity;
- chargeable weight with density;
- client/carrier tariff classification with universal NMFC truth.

## Family composition

- RF13 Measure Semantics
- RF2 Relationship Integrity
- RF5 Controlled-Value Validation
- RF7 Conditional Activation
- RF9 Source Authority & Precedence
- RF11 Client Specialization
- RF12 Aggregate/Reconciliation
- RF18 Temporal & Version Semantics

## Generated-rule candidates

GI-NMFC-DENSITY:
Resolve handling-unit owner; validate greatest L/W/H and weight; normalize units; compute cubage and pcf density only when required inputs are governed.

GI-NMFC-CLASSIFICATION-CONTEXT:
Preserve freight class separately from density, commodity/item identity and item number; evaluate handling/stowability/liability context before treating density as sufficient.

GI-NMFC-SOURCE-PRECEDENCE:
Resolve whether NMFC or scoped carrier tariff/client binding governs classification before automatic class assignment/correction.

GI-NMFC-VERSION:
Bind density/class mapping to applicable NMFC/FCDC version/effective context.

## Reuse assessment

No new rule family is required.

The behavior composes existing reusable patterns:
- RPAT-LTL-MEASURE-WITH-OWNER
- RPAT-LTL-CONDITIONAL-CONTRACT
- RPAT-LTL-CLIENT-OPTIONALITY-SPECIALIZATION

A dedicated classification-resolution reusable pattern is not promoted yet. More authoritative property-level evidence on NMFC item/class relationships and tariff application is required before promotion.

## Guardrail

Atlas may compute handling-unit density from authoritative NMFTA logic when governed dimensions and weight are available.

Atlas must NOT automatically infer a universal freight class solely from density unless the applicable classification provision/version and source-precedence context establish that density-only mapping is valid.
