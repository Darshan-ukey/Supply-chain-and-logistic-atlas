# LTL-03 Conditional Regulatory Rules v0.1

Date: 2026-09-20
Workstream: ATL-35
Status: RESEARCH CANDIDATE — NOT FROZEN

## Purpose
Capture source-backed conditional rules that expand the LTL-03/BOL information contract and execution logic.

## Hazardous-material shipping-paper branch

Authoritative U.S. HMR evidence establishes that when hazardous materials shipping-paper rules apply, the description must include:
- identification number;
- proper shipping name;
- hazard class/division;
- packing group when applicable;
- total quantity with unit;
- number and type of packages.

The basic description elements must appear in the prescribed sequence without unrelated information interspersed. Additional information may be required depending on material/mode.

## Execution-readiness implications

### Conditional field expansion
IF shipment/commodity is governed as hazardous material under applicable HMR
THEN activate hazardous-material information contract.

### Presence controls
Validate required basic-description components and quantity/package information.

### Value controls
Validate identifiers, shipping names, hazard class/division and packing group against authoritative hazardous-material reference data where available.

### Representation/order controls
The rule is not only field presence. The required basic description has an ordering constraint. Execution projections that generate or validate a shipping paper must preserve the required sequence.

### Relationship controls
Hazardous-material information belongs to the relevant commodity/line item and must reconcile to package quantity/type and total quantity.

### Exception classes
Candidate classes:
- HAZMAT_REQUIRED_DATA_MISSING
- HAZMAT_BASIC_DESCRIPTION_INVALID
- HAZMAT_SEQUENCE_INVALID
- HAZMAT_PACKAGE_QUANTITY_MISMATCH
- HAZMAT_REFERENCE_DATA_MISMATCH

Names are Atlas candidate labels; source-backed conditions require later canonical naming.

### Authority
Regulatory rules override permissive client defaults. Client binding may add controls but cannot relax applicable regulation.

## Important distinction
NMFC number/class is not itself part of the federal hazardous-material basic description requirement. PHMSA interpretation confirms NMFC number/class may appear separately so long as it does not disrupt the required hazardous-material description sequence.

This supports Atlas separation of:
- commodity/classification semantics;
- hazardous-material regulatory semantics.

## Downstream projection implication
For Malkom/RPA/agent/API configuration, Atlas must output not just fields but:
- activation condition;
- required fields;
- allowed/reference values;
- sequence/format rule;
- validation logic;
- failure severity;
- exception code/queue;
- regulatory provenance.
