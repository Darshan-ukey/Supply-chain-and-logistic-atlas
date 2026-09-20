# LTL-03 Graph-First Discovery — In-Transit Access / Lookup / Exception / Notification Semantics v0.1

Date: 2026-09-20
Workstream: ATL-35
Status: RESEARCH CANDIDATE — GRAPH-FIRST INTAKE

## Authoritative DSDC evidence

Current DSDC In-Transit Visibility API material explicitly establishes:

1. In-transit visibility begins when the carrier acknowledges physical custody and necessary documentation has been executed, and ends after delivery plus receiver acknowledgement.
2. The standard supports two access scopes: Verified and Public. Verified access can expose full shipment detail to authenticated/account parties; Public access allows limited status retrieval for non-account scenarios such as collect, misbilled, or third-party-billed shipments.
3. Stakeholders may retrieve latest status by PRO number, BOL number, PO number, or account number.
4. The standard uses normalized exception/reason codes and can identify both what happened and the responsible party, while allowing carriers to map internal codes underneath the shared standard.
5. Delivery Update notifications cover physical-movement events and milestone changes; Delivery Information notifications cover related non-movement information such as appointments, accessorial changes, customs updates, and assigned reason codes.
6. Common milestone vocabulary includes Picked-up, Arrived at Terminal, Unloaded at Terminal, Loaded at Terminal, Departed Terminal, In Transit, Interline, Out for Delivery, and Delivered.
7. Cross-border status examples include In Bond, Hold, and Cleared Customs where applicable.

## Domain facts

DF-INTRANSIT-ACCESS-SCOPE:
Visibility data exposure is access-scope governed. Verified and Public access are distinct authorization/data-exposure contexts, not shipment-state semantics.

DF-INTRANSIT-MULTI-REFERENCE-LOOKUP:
Latest shipment status may be retrieved through multiple governed reference types: PRO, BOL, PO, or account number. Lookup key type must be preserved rather than collapsed into one generic identifier.

DF-EXCEPTION-RESPONSIBILITY:
Normalized exception/reason semantics may carry both event/reason meaning and responsible-party attribution; carrier internal codes may map beneath the shared standard.

DF-NOTIFICATION-TYPE-SEPARATION:
Delivery Update and Delivery Information notifications are semantically distinct: movement/milestone changes versus related non-movement operational information.

DF-CROSSBORDER-STATUS:
Cross-border visibility states are conditional shipment-status semantics and do not replace the main transport lifecycle.

## Primitive mapping

Existing primitives are sufficient:
- Identifier / Reference
- Party
- State
- Event
- Controlled Vocabulary
- Relationship
- Evidence / Provenance
- Indicator

No new primitive required.

## Family composition

- RF1 Identity & Reference Resolution
- RF2 Relationship Integrity
- RF3 Lifecycle & State Transition
- RF5 Controlled-Value Validation
- RF7 Conditional Activation
- RF8 Error & Exception Semantics
- RF9 Source Authority & Precedence
- RF11 Client Specialization (only where implementer exposure policy is scoped)

## Generated-rule candidates

GI-INTRANSIT-ACCESS:
resolve authorization/access scope before projecting shipment detail; Public and Verified exposure cannot be treated as equivalent payload authority.

GI-INTRANSIT-LOOKUP:
resolve lookup reference type and value across PRO/BOL/PO/account number before retrieving latest status.

GI-EXCEPTION-RESPONSIBILITY:
map normalized exception/reason code and responsible party while retaining underlying carrier code provenance when available.

GI-NOTIFICATION-TYPE:
classify notification as Delivery Update or Delivery Information before downstream routing; movement and non-movement semantics remain distinct.

GI-CROSSBORDER-STATUS:
activate cross-border status semantics only when applicable and retain them as conditional state context rather than universal lifecycle states.

## Reuse assessment

Existing reusable patterns appear sufficient:
- RPAT-LTL-IDENTITY-BEFORE-MUTATION
- RPAT-LTL-EVENT-LIFECYCLE
- RPAT-LTL-CONDITIONAL-CONTRACT
- RPAT-LTL-ROLE-BEFORE-MASTER

No new family or reusable pattern promoted at this checkpoint.

## Guardrails

- Do not infer shipment state from access scope.
- Do not collapse PRO/BOL/PO/account references into one semantic identifier.
- Do not discard carrier internal exception codes when mapping to normalized reason codes; retain provenance.
- Do not treat appointment/accessorial/customs notifications as physical-movement events.
- Do not activate cross-border status for domestic shipments without governed trigger.
