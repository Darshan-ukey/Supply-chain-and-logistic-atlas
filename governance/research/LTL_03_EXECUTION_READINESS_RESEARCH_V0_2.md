# LTL-03 Execution Readiness Research v0.2

Date: 2026-09-20
Workstream: ATL-35
Canonical task: LTL-03 — Create and validate shipment, consignment and transport-document identity
Status: RESEARCH IN PROGRESS

## Checkpoint delta from v0.1

### A. BOL field universe must be layered

The authoritative BOL information universe must be constructed from multiple governed layers rather than a single flat list:
1. U.S. regulatory minimum.
2. LTL operating/digital standard.
3. Cross-industry semantic information model.
4. Conditional regulatory layers such as hazardous-material requirements.
5. Carrier/client implementation fields and system-only operational attributes.

Crosswalk dimensions:
field -> semantic object -> source -> regulatory/industry/client status -> mandatory/conditional/optional -> lifecycle applicability -> validation -> source authority -> queue on failure.

### B. Reference numbers require a canonical identity model

Do not model booking number, PRO, BOL number and other references as unrelated strings.

Canonical Reference/Identifier object should capture:
- value;
- type;
- assigning party;
- assigning system/scheme;
- referenced business object;
- parent/child or cross-reference relationship;
- validity/status;
- uniqueness scope;
- creation event;
- source authority.

Client bindings may specialize the graph, e.g. Estes/SEFL/ODFL pattern:
Booking reference -> PRO -> BOL.

### C. Relationship queues are a distinct execution class

Candidate queue types may arise from unresolved or conflicting identity relationships:
- REFERENCE_ASSIGNMENT_REQUIRED
- PRO_NOT_ASSIGNED
- PRO_DUPLICATE
- PRO_TO_BOL_LINK_MISSING
- BOOKING_TO_PRO_LINK_CONFLICT
- SHIPMENT_REFERENCE_CONFLICT
- DOCUMENT_REFERENCE_NOT_FOUND
- REFERENCE_SOURCE_AUTHORITY_CONFLICT

These remain candidates until each queue is grounded in a governed expected relationship and source/client rule.

### D. Four distinct execution-condition families

Do not collapse all failures into generic validation.

1. Presence condition — required information exists.
2. Validity condition — value conforms to datatype/code/rule.
3. Relationship condition — objects and identifiers reconcile correctly.
4. State condition — requested transition is permitted from current lifecycle state.

Each family may have different remediation and queue routing.

### E. Expanded WorkDefinition semantic depth

Atomic work units may need:
- purpose;
- trigger/event;
- input objects;
- identifiers;
- required information;
- source of truth;
- preconditions;
- decision rules;
- validation rules;
- relationship rules;
- state-transition rules;
- action;
- expected output;
- evidence;
- exceptions;
- queue routing;
- retry/idempotency;
- authority/permission;
- downstream dependency;
- client binding.

### F. Source precedence must be field-level

Conflicting values across Booking, BOL, carrier measurement and billing/rating records should not force one global document-level winner. Atlas must support semantic attributes that coexist by lifecycle/business meaning, with field-level authority rules.

Illustrative conceptual distinction:
- declared weight;
- verified operational weight;
- billing weight.

### G. Documentation boundaries remain task-governed

BOL is one document object within LTL-03. Freight/expense bill, claims documentation, delivery evidence and other document families belong to their correct canonical tasks unless source evidence shows direct LTL-03 responsibility.

## Next tranche

1. Build LTL-03 information-object taxonomy.
2. Build authoritative BOL field universe by source.
3. Map each field to semantic object, lifecycle transition and rule class.
4. Build identity/reference graph and cardinalities.
5. Build state-transition table.
6. Build rule/exception catalogue.
7. Derive queue candidates mechanically.
8. Only after independent derivation, crosswalk to SEFL 76 BOL fields.

## Recovery requirement

Preserve exact source locations, source/version metadata, extracted primitives, field definitions, code sets, rule logic, lifecycle evidence, queue derivation and client-pattern overlays in the final Drive custody package.
