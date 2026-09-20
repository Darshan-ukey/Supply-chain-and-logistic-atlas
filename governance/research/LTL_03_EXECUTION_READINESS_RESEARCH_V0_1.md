# LTL-03 Execution Readiness Research v0.1

Date: 2026-09-20
Workstream: ATL-35
Canonical task: LTL-03 — Create and validate shipment, consignment and transport-document identity
Status: RESEARCH IN PROGRESS

## Research checkpoint

This checkpoint preserves findings derived from authoritative/public sources before SEFL's known 76-field BOL implementation is used as a validation crosswalk.

### 1. Industry semantics vs client binding

Industry standards define a canonical information and lifecycle contract. Carrier/client bindings may specialize it by making optional fields mandatory, imposing additional length/format constraints, defining source-system authority, and routing failures differently.

Canonical standard must not be overwritten by a client implementation. Client binding specializes the canonical contract.

### 2. PRO identity assignment

DSDC/NMFTA evidence supports multiple PRO assignment patterns:
- shipper/requestor may supply a pre-assigned PRO;
- carrier may assign a PRO when one is not supplied;
- PRO becomes an important shipment/eBOL reference for subsequent lifecycle actions such as update/delete.

Therefore PRO assignment must be configurable and must not be hard-coded as a universal output of booking.

Observed carrier pattern from user operational experience:
Booking -> PRO assignment -> BOL creation
This may be represented as a client/carrier operating pattern for Estes, SEFL and ODFL, but not as the universal canonical sequence.

### 3. Pickup lifecycle

Source-backed pickup lifecycle includes:
- schedule/create;
- update/reschedule;
- track status;
- cancel;
- accepted;
- en route;
- arrived;
- departed;
- exception/delay/reason states.

Queues should be derived from supported lifecycle states and unresolved transitions rather than manually invented.

### 4. eBOL lifecycle

Source-backed eBOL operations include:
- create;
- update;
- delete/cancel.

Source-backed error classes include at least:
- invalid BOL information / validation failure;
- referenced document not found for lifecycle action.

These should remain separate exception classes because remediation differs.

### 5. Identifier graph

LTL-03 must model a graph of references/identifiers rather than a single PRO/BOL pair. Candidate governed identifier attributes include:
- identifier value;
- identifier type;
- assigning party;
- scheme;
- related object;
- validity period;
- status;
- cross-reference relationship.

UN/CEFACT evidence supports distinct consignor-, consignee-, carrier-, forwarding- and document-assigned identifiers and referenced-document structures.

### 6. Field contract

A field should carry execution semantics, not only a name:
- semantic object;
- datatype;
- controlled vocabulary/code set;
- occurrence/cardinality;
- mandatory/optional/conditional status;
- source/provenance;
- applicable lifecycle transition;
- validation rule;
- source precedence;
- client override;
- failure response;
- queue on failure.

### 7. Canonical contract + client execution binding

Execution readiness should explicitly separate:

Layer A — Domain Execution Contract
objects -> fields -> identifiers -> states -> actions -> rules -> controls -> exceptions

Layer B — Client Execution Binding
field requirements -> source systems -> reference assignment -> thresholds -> precedence -> permissions -> exception handling -> queue routing -> execution endpoints

Then compile into tool-specific projections:
- Malkom / IDP;
- RPA;
- AI agent;
- API / integration;
- BPM/workflow engine.

### 8. Candidate deterministic BOL creation rule pattern

EVENT: BOL_CREATE_REQUEST

PRECONDITIONS:
- shipment identity resolved;
- carrier resolved;
- required BOL information present;
- client-specific mandatory fields satisfied.

IDENTITY:
- if PRO supplied, validate and bind to shipment/consignment;
- else if carrier supports carrier assignment, obtain and persist returned PRO;
- else route identity-assignment exception.

VALIDATION:
- canonical field rules;
- controlled vocabularies;
- client overrides;
- cross-field consistency.

FAILURE:
- invalid data -> validation exception;
- unresolved identity -> identity reconciliation exception;
- unsupported transition -> lifecycle exception.

SUCCESS:
- create BOL/eBOL;
- persist PRO/reference graph;
- record document identity/version;
- preserve execution evidence;
- transition document state to CREATED.

### 9. Next research tranche

A. Build authoritative BOL field universe independently of SEFL 76 fields.
B. Build complete LTL-03 identity/reference graph.
C. Build lifecycle/state-transition table.
D. Build rule, validation and exception catalogue.
E. Derive execution queues mechanically.
F. Only then crosswalk against SEFL 76 fields.

## Recovery principle

The completed LTL-03 package must preserve exact source locations, versions/effective dates, extracted primitives, rules, lifecycle/state evidence, queue derivations, unresolved gaps and client-pattern overlays so Atlas can be rebuilt without conversation memory.
