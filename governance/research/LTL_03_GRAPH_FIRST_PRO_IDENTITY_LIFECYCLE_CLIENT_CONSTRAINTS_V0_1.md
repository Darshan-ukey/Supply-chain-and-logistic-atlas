# LTL-03 Graph-First Discovery — PRO Identity / Lifecycle / Client Constraints v0.1

Date: 2026-09-20
Workstream: ATL-35
Status: RESEARCH CANDIDATE — GRAPH-FIRST INTAKE

## Authoritative NMFTA evidence

Current NMFTA eBOL 2.1 issuer documentation and FAQ establish:

1. PRO is the key document/shipment reference used for eBOL update and delete operations.
2. After eBOL submission, the PRO number is returned for subsequent reference.
3. A shipper may provide a pre-assigned PRO for the requested carrier; if not provided, the carrier automatically assigns one.
4. The PRO value should include a check digit when applicable.
5. REST lifecycle intent is represented by POST=create, PUT=update, DELETE=cancel/delete; using a generic function variable is discouraged.
6. Carrier/shipper/3PL endpoints are implementation-specific rather than canonical domain semantics.
7. A standard non-mandatory field may be made mandatory by a carrier/business process and rejected with a 400 failure if absent.
8. Carrier backend min/max string constraints may be more restrictive than the standard; truncation should be surfaced as warning/error/information rather than silently changing canonical domain truth.
9. LocationID is optional industry-level and scoped to shipper/carrier systems; it is not globally unique across the industry.

## Domain facts

DF-PRO-ASSIGNMENT-AUTHORITY:
PRO assignment may originate from a shipper pre-assignment or carrier assignment; assignment authority and provenance must be retained.

DF-PRO-LIFECYCLE-KEY:
PRO is the key reference for update/delete eBOL lifecycle operations.

DF-REST-INTENT:
Create/update/delete lifecycle intent is distinct from the BOL business object and is represented through operation semantics.

DF-CLIENT-MANDATORY-SPECIALIZATION:
A carrier/client may strengthen standard optionality within its scoped implementation without rewriting canonical standard optionality.

DF-CLIENT-REPRESENTATION-CONSTRAINT:
Carrier backend length/format constraints are scoped representation constraints and must not be promoted to universal domain truth.

DF-ENDPOINT-RUNTIME-SCOPE:
API endpoint is runtime/partner configuration, not canonical domain knowledge.

## Primitive mapping

Existing primitives:
- Identifier
- Reference
- Evidence/Provenance
- State
- Event
- Document
- Relationship
- Master Reference

No new primitive required.

## Family composition

- RF1 Identity & Reference Resolution
- RF3 Lifecycle & State Transition
- RF4 Requiredness & Cardinality
- RF8 Error & Exception Semantics
- RF9 Source Authority & Precedence
- RF10 Representation Constraint
- RF11 Client Specialization

## Generated-rule candidates

GI-PRO-ASSIGNMENT:
resolve PRO value, assigning authority and provenance; accept governed shipper pre-assignment or carrier-assigned response.

GI-PRO-BEFORE-MUTATION:
resolve target PRO before PUT/DELETE mutation and route not-found according to governed error semantics.

GI-CLIENT-OPTIONALITY:
preserve standard optionality and layer carrier/client mandatory specialization separately.

GI-CLIENT-REPRESENTATION:
apply carrier/client min/max/format constraints at binding/runtime projection and preserve warning/error/truncation evidence.

GI-ENDPOINT-PROJECTION:
resolve carrier/shipper/3PL endpoint only at runtime/client binding; never encode endpoint as canonical domain fact.

## Reuse assessment

Existing reusable patterns are sufficient:
- RPAT-LTL-IDENTITY-BEFORE-MUTATION
- RPAT-LTL-CLIENT-OPTIONALITY-SPECIALIZATION
- RPAT-LTL-ROLE-BEFORE-MASTER

No new family or reusable execution pattern required.

## Guardrails

- Do not assume booking always creates the PRO; authoritative eBOL evidence supports both pre-assigned and carrier-assigned PRO paths.
- Do not treat endpoint URL as domain truth.
- Do not convert carrier-specific mandatory/length constraints into universal eBOL rules.
- Do not silently truncate without governed evidence/result semantics.
