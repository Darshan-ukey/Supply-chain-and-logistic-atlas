# LTL-03 Graph-First Discovery — Handling Unit / Packaging / Classification Relationships v0.1

Date: 2026-09-20
Workstream: ATL-35
Status: RESEARCH CANDIDATE — GRAPH-FIRST INTAKE

## Authoritative evidence

Current NMFTA guidance establishes:

- A Handling Unit is each piece/unit of freight tendered to the carrier that requires or promotes separate handling.
- A handling unit may be a loose article, one or more articles in a package, or articles palletized/unitized for loading/unloading as a single unit.
- When articles are unitized, Handling Unit refers to the complete unit as tendered, not the individual packages/pieces within it.
- Mixed/multiple handling-unit classification normally calculates density per handling unit; where shipping papers show only a total weight for all handling units, NMFC Item 110 Sec. 8(d) permits density to be calculated from total weight and total cube unless otherwise provided.
- Packaging may affect classification because minimum packaging requirements are commodity-specific.
- NMFTA interpretation requests require shipping-package type and form of shipment, confirming these are classification-relevant attributes rather than generic free text.
- NMFTA BOL guidance explicitly distinguishes piece count from handling-unit count and advises accurate dimensions/weight of each handling unit or the entire shipment.
- NMFTA eBOL adoption material identifies pallet/article relationships and packaging type as standardization targets.

## Domain facts

DF-HANDLING-UNIT-SEMANTIC:
Handling Unit is a tendered handling object and is not equivalent to individual package/piece count.

DF-UNITIZED-PACKAGE-HIERARCHY:
When packages/articles are unitized, the handling unit is the complete tendered unit while underlying packages/articles remain child cargo structure.

DF-DENSITY-PER-HANDLING-UNIT:
Multiple handling units normally retain individual density ownership unless the applicable rule permits total-weight/total-cube treatment.

DF-PACKAGING-CLASSIFICATION-RELEVANCE:
Packaging type and form of shipment can affect classification/application and must retain commodity/handling-unit relationship.

DF-PIECE-HANDLING-COUNT-DISTINCTION:
Piece count and handling-unit count are distinct quantity semantics.

## Existing primitive mapping

- Package
- Commodity / Item
- Collection / Cardinality
- Measure
- Relationship
- Controlled Vocabulary
- Evidence / Provenance

No new primitive required.

## Family composition

- RF14 Hierarchy
- RF4 Requiredness & Cardinality
- RF2 Relationship Integrity
- RF13 Measure Semantics
- RF12 Aggregate Reconciliation
- RF5 Controlled-Value Validation
- RF9 Source Authority & Precedence

## Generated-rule candidates

GI-HANDLING-UNIT-HIERARCHY:
instantiate handling unit separately from contained packages/articles and preserve parent-child structure.

GI-HANDLING-UNIT-DENSITY-OWNERSHIP:
calculate/reconcile density at handling-unit level unless governed rule/source permits aggregate treatment.

GI-PIECE-HANDLING-COUNT:
preserve piece count and handling-unit count as different quantity semantics and reconcile only where a governed relationship exists.

GI-PACKAGING-CLASSIFICATION-CONTEXT:
bind package type/form of shipment to the relevant commodity/handling unit for classification context.

## Reuse assessment

Existing reusable patterns are sufficient:
- RPAT-LTL-REPEATING-CHILD-OBJECT
- RPAT-LTL-MEASURE-WITH-OWNER
- RPAT-LTL-CONDITIONAL-CONTRACT

No new family or reusable pattern is promoted.

## Guardrails

- Do not equate pallets/handling units with pieces.
- Do not sum child package counts into handling-unit count without governed hierarchy semantics.
- Do not calculate each handling unit from shipment-total weight when unit weights are available.
- Do not assume packaging is classification-neutral.
