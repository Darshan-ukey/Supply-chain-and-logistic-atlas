# LTL-03 Monetary Amount & Service-Charge Normalization v0.1

Date: 2026-09-20
Workstream: ATL-35
Status: RESEARCH CANDIDATE — NOT FROZEN

## Why this checkpoint matters

New authoritative evidence exposes monetary semantics that are materially different from physical Measure semantics.

The normalization mechanism therefore permits catalogue evolution rather than forcing the evidence into RF13 Measure Semantics.

## Track A — authoritative evidence

UN/CEFACT D23B Consignment includes optional:
- Associated Invoice Amount;
- COD Amount;
- Consignment Information Text;
- Transshipment Permission Indicator.

UN/CEFACT D23B also models repeating applicable Logistics Service Charges with controlled category semantics, including:
- additional charges;
- other charges;
- transport costs/carriage charges;
- weight/valuation charge;
- customs-formality charges.

Service Charge also includes a controlled Paying Party Role semantic with roles including:
- Carrier;
- Consignee;
- Consignee's agent;
- Consignor;
- Consignor's representative.

## Track B — normalization decision

### Existing primitive rejected: Measure

Physical Measure(value, unit, semanticOwner, source, confidence) is not sufficient for monetary amounts.

Material semantic differences:
- monetary values require currency rather than physical unit semantics;
- charge/amount may have payer/payee roles;
- amount purpose matters (COD, invoice amount, carriage charge, valuation charge, etc.);
- monetary source authority may be contractual/rating/billing rather than physical observation;
- arithmetic/aggregation behavior is financial rather than physical-measure semantics.

Forcing Amount into Measure would reduce rule count at the cost of operational meaning, violating the normalization governance.

## New semantic primitive candidate — MonetaryAmount

Candidate canonical structure:

MonetaryAmount(
  value,
  currency,
  amountType,
  semanticOwner,
  source,
  sourceAuthority,
  payerRole?,
  payeeRole?,
  lifecycleStage,
  confidence
)

Examples:
- associated invoice amount;
- COD amount;
- carriage charge;
- weight/valuation charge;
- customs-formality charge.

This is a candidate primitive and may evolve with evidence.

## New reusable family candidate — RF17 Monetary Amount / Charge Semantics

A new family is justified because existing RF1-RF16 do not fully represent monetary execution semantics without semantic distortion.

Candidate parameters:
- amountType;
- semanticOwner;
- currency;
- payerRole;
- payeeRole;
- chargeCategory;
- sourceAuthority;
- lifecycleStage;
- requiredness;
- aggregation/reconciliation rule;
- client override/binding.

Candidate generated behaviors:
1. identify monetary amount semantic;
2. resolve amount type/purpose;
3. validate numeric value;
4. validate currency where applicable;
5. resolve payer/payee role where applicable;
6. validate controlled charge category;
7. apply source authority/lifecycle rule;
8. reconcile or aggregate where governed;
9. preserve source/canonical value and evidence;
10. route exception if amount/currency/role/category semantics are unresolved.

RF5 Controlled-Value Validation remains composed for controlled charge categories/payer roles.
RF2 Relationship Integrity may be composed for payer/payee relationships.
RF9 Source Authority remains composed for competing monetary sources.
RF11 Client Specialization remains composed for local tariff/billing/client bindings.

## New semantic primitive candidate — Indicator

UN/CEFACT Transshipment Permission Indicator also shows a reusable primitive not explicitly listed in the prior catalogue.

Candidate:
Indicator(value, semanticOwner, meaning, source, lifecycleStage, confidence)

No new rule family is required yet.

Indicator validation can currently be represented through existing:
- RF5 Controlled-Value Validation, where the permitted state set is governed;
- RF9 Source Authority, where competing values exist;
- RF11 Client Specialization, where local policy alters operational handling.

Create a dedicated Indicator family only if future evidence demonstrates materially different execution semantics beyond these compositions.

## Mechanism validation

This is a positive test of the freeze boundary:

1. New evidence discovered.
2. Existing primitive/family catalogue searched.
3. Parameterization/composition tested.
4. Physical Measure rejected because semantics differ materially.
5. New MonetaryAmount primitive proposed.
6. New RF17 proposed with explicit insufficiency rationale.
7. Existing families retained compositionally for controlled values, relationships, authority and client binding.
8. Indicator primitive added without automatically creating a new family.

The mechanism remains unchanged while the catalogue evolves.

## Effect on scalability metrics

Prior candidate reusable family count: 16.
Candidate family introduced by this evidence: RF17.
Reason: materially distinct monetary/charge execution semantics.

This is not architectural failure. It is evidence-driven catalogue evolution.

The New Rule Family Rate should record this addition against the current LTL-03 task.

## Evidence implications for LTL-03 scope

These monetary/service-charge semantics may be adjacent to rather than central to LTL-03 transport-document identity.

They remain in the broader independent BOL/domain universe where source-backed, but task-level generation must respect LTL-03 boundaries.

Do not automatically pull downstream billing execution into LTL-03 merely because the semantic object can occur in the consignment model.

## Next

- determine whether currency attributes are explicitly present in the relevant UN/CEFACT amount structure and capture exact cardinality;
- distinguish document-carried monetary facts from downstream rating/billing decisions;
- continue service/accessorial/payment-term evidence recovery;
- update the generated-instance catalogue only for instances genuinely within LTL-03 scope;
- retain RF17 as candidate until broader evidence confirms reuse.
