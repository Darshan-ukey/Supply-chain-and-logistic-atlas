# LTL-03 Graph-First Discovery — Chargeable Weight / Volume / Rating Boundary v0.1

Date: 2026-09-20
Workstream: ATL-35
Status: RESEARCH CANDIDATE — GRAPH-FIRST INTAKE

## Track A — authoritative evidence

UN/CEFACT D23B models at consignment level:
- Gross Weight;
- Net Weight;
- Gross Volume;
- Loading Length;
- Chargeable Weight.

UN/CEFACT defines:
- Gross Volume as a separate measure, normally calculated from maximum length × width × height;
- Loading Length as the length along a means of transport over which full width/height is needed for loading;
- Chargeable Weight as a separate consignment measure.

Consignment Item separately exposes:
- Gross Weight;
- Net Weight;
- Gross Volume;
- Type / Type Extension;
- Tariff Quantity.

## Domain facts

DF-CHARGEABLE-WEIGHT-SEPARATE:
Chargeable Weight is a distinct semantic measure from gross/net/declared/verified weight.

DF-GROSS-VOLUME-DERIVABLE:
Gross Volume may be derived from governed dimensions, but remains a separate semantic slot.

DF-LOADING-LENGTH-SEPARATE:
Loading Length is distinct from ordinary object length and gross volume.

DF-RATING-FORMULA-UNRESOLVED:
Current authoritative evidence does not establish an LTL dimensional-weight divisor/formula or universal derivation from dimensions/volume to Chargeable Weight.

## Primitive mapping

- Measure
- Relationship
- Evidence/Provenance
- Commodity / Consignment Item where item-level values contribute
- MonetaryAmount only when rating produces charge values

## Rule-family composition

Existing:
- RF13 Measure Semantics
- RF2 Relationship Integrity
- RF9 Source Authority
- RF12 Reconciliation
- RF11 Client Specialization

No RF17 monetary logic is invoked until an actual monetary charge/rated amount is present.

## Generated instances

GI-CHARGEABLE-WEIGHT-PRESERVE:
preserve Chargeable Weight as a separate measure with its own provenance.

GI-GROSS-VOLUME-DERIVE-RECONCILE:
derive/reconcile Gross Volume from dimensions only where calculation inputs and governing rule are available.

## Knowledge gap

KG-LTL-CHARGEABLE-WEIGHT-RATING-FORMULA:
Authoritative LTL-specific rule for converting dimensions/volume/physical weight into Chargeable Weight has not yet been established.

This gap blocks:
- universal dimensional-weight calculation;
- universal DIM divisor;
- automatic replacement of carrier-provided Chargeable Weight;
- inference that Chargeable Weight always equals max(actual weight, dimensional weight).

Client/carrier tariffs may eventually supply such rules through Client Binding, but they must not be promoted to universal domain truth without appropriate evidence.

## Reuse implication

The existing RPAT-LTL-MEASURE-WITH-OWNER pattern is reusable here.

Parameterization:
- measureType = CHARGEABLE_WEIGHT | GROSS_VOLUME | LOADING_LENGTH;
- semanticOwner = consignment;
- sourceAuthority;
- derivationRule? only when governed.

No new reusable execution pattern is required.

## Normalization result

New primitive: 0.
New rule family: 0.
New reusable pattern: 0.
New explicit knowledge gap: 1.
