# Road LTL Operations Knowledge Layer — Research Findings

**Date:** 1 September 2026  
**Prototype location:** Road LTL → Work Definitions → Operations Knowledge

## Verdict

**PROVEN AS A VIABLE ENRICHMENT METHOD — WITH SOURCE BOUNDARIES**

All four cases expose material operational detail beyond the current WorkDefinition projection. Claims and U.S. hazmat provide near execution-ready decision/timer/control logic from public regulation; GS1 provides precise identity/event semantics for terminal receipt; NMFTA provides the correct LTL pickup lifecycle but full field-level completeness requires access to the full downloadable standard.

## What is actually missing today

The audit of the supplied Road LTL V1.2 + V2.3 projection shows two different gaps:

1. **Projection loss:** Road LTL contains a business decision for all 22 tasks, but the current Malkom-oriented projection has null decision arrays for **22/22** definitions and null system arrays for **22/22** definitions.
2. **Operational depth:** even in the Atlas source, task logic is generally expressed as one decision sentence + one rule sentence + one control sentence. That is good process semantics, but not yet a decision table / field-validation / timer / evidence contract.

Additional signals:
- 1.0 rule statement per current projected definition on average.
- 1.0 control statement per projected definition on average.
- 65/70 projected work types default to `HUMAN_IN_LOOP`.
- Six generic fields appear on all 22 projected definitions: shipmentID, consignmentID, handlingUnitID, partyLocationIDs, evidenceRef, reasonCode.

## Four proof cases

### 1. LTL-04 — Pickup request & readiness
NMFTA DSDC gives the correct LTL-specific lifecycle: schedule, update/reschedule, cancel, status, delay and readiness/equipment coordination. This can materially deepen LTL-04. However, the public page gates the full API standard, so exact field names/cardinality cannot yet be called source-verified.

**Conclusion:** viable; exact schema requires the full standard.

### 2. LTL-06 — Origin terminal receipt
GS1 supplies precise logistic-unit identity and event semantics: SSCC, event time/timezone, read point, business location, business step, disposition and transaction context. It also provides semantic distinctions such as `receiving` vs `accepting`.

**Conclusion:** strong open-source foundation for machine-consumable receiving logic.

### 3. LTL-18 — U.S. cargo claims
49 CFR Part 370 is highly operational: claim sufficiency, what is not a claim, acknowledgment within 30 days, claim file/number, evidence and investigation controls, 120-day disposition, and recurring 60-day status notices if unresolved.

**Conclusion:** near execution-ready reference logic can be derived with high defensibility when U.S. Part 370 scope is active.

### 4. LTL-19 — U.S. hazardous-material hold/release
49 CFR Parts 172 and 177 provide structured classification, shipping-paper/certification requirements, labels/placards, securement, loading/unloading, segregation, training and retention controls.

**Conclusion:** very rich source-backed conditional logic, but only after exact material/quantity/exception scope is resolved.

## Architecture implication

Add a governed `operationalKnowledge` layer beneath each A5/WorkDefinition:

```text
A5 task
  -> knowledge claims (claim-level provenance)
  -> canonical fields + validation
  -> decision tables
  -> timers / clocks
  -> controls / evidence requirements
  -> states / transitions / exceptions
  -> client-binding-required items
  -> executor-neutral WorkDefinition
```

Every statement should be classified as one of:

`SOURCE_EXPLICIT` · `SOURCE_DERIVED` · `ATLAS_DERIVED` · `CLIENT_POLICY` · `CLIENT_SYSTEM_BINDING` · `UNKNOWN`

This prevents AI-derived operating logic from being presented as if it were directly stated by the source.

## What this prototype does not claim

- It does not claim that all 22 LTL WorkDefinitions are now execution-ready.
- It does not invent client carrier cut-offs, policies, system fields, queues or thresholds.
- It does not make U.S. regulations global.
- It does not reproduce gated NMFTA standards.
- It does not treat a source family as sufficient for every part of the task; source boundaries are shown explicitly.
