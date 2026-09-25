# LTL-03 Associated Document & Temporal Normalization v0.1

Date: 2026-09-20
Workstream: ATL-35
Status: RESEARCH CANDIDATE — NOT FROZEN

## Track A — authoritative evidence

UN/CEFACT D23B models Consignment -> Associated Document as 0..n.

Associated Document attributes include:
- Document Identification Identifier;
- Document Type Code;
- Document Issue Date Time;
- Document Remarks Text.

Examples in the UN/CEFACT definition include certificate of origin, dangerous goods note and licence.

This means associated documents are repeating semantic objects, not generic free-text references or attachments.

## Track B — normalization

### Existing primitives/families reused

Document primitive already exists.

Associated-document execution can be generated through:
- RF2 Relationship Integrity;
- RF4 Requiredness/Cardinality;
- RF1 Identity & Reference Resolution;
- RF5 Controlled-Value Validation for document type;
- RF16 Instruction/Note Ownership for remarks where applicable.

### New primitive candidate — TemporalValue

The evidence exposes a reusable Date Time semantic that was not explicitly listed in the earlier primitive catalogue.

Candidate:

TemporalValue(
  value,
  temporalType,
  semanticOwner,
  source,
  lifecycleStage,
  timezone?,
  confidence
)

Examples:
- document issue date/time;
- carrier acceptance date/time;
- availability due date/time;
- future pickup/delivery event times.

### New rule family decision

Do NOT create a dedicated temporal rule family yet.

Current temporal requirements appear representable by compositions of:
- RF3 Lifecycle & State Transition;
- RF4 Requiredness/Cardinality;
- RF9 Source Authority & Precedence;
- RF11 Client Specialization.

Create a temporal family only if later evidence introduces materially distinct semantics such as:
- validity windows;
- ordering constraints across multiple timestamps;
- timezone normalization rules;
- deadline/tolerance computation;
- event-time reconciliation requiring dedicated reusable logic.

## Generated instances

1. instantiate repeating associated-document collection;
2. resolve document identifier;
3. validate document type code;
4. capture/validate issue date-time;
5. preserve document remarks;
6. bind each document to consignment;
7. detect duplicate/conflicting document identity where applicable.

## Scope implication

Associated documents belong to the independent transport-document/domain universe.

However, LTL-03 task generation must include only those document relationships needed for shipment/consignment/transport-document identity and validation.

Do not pull document-specific downstream processes (claims, customs processing, billing) into LTL-03 merely because the documents are associated.

## Normalization result

New primitive candidate: TemporalValue.
New reusable rule family required: 0.

This is another example where the catalogue evolves while the normalization mechanism remains unchanged.
