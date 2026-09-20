# LTL-03 Deterministic Generator Rules v0.1

Date: 2026-09-20
Workstream: ATL-35
Status: RESEARCH CANDIDATE — NOT FROZEN

## Purpose

Convert authoritative source primitives into deterministic Work Decomposition and Domain Execution Contract structures using the preserved P6.1 recursive grammar.

This is the core of the P6.1 successor generator.

## Generator principle

Do not ask an LLM to invent the decomposition when the source already exposes a governed primitive.

Instead:
Source primitive -> deterministic generation rule -> P6.1 recursive expansion -> Domain Execution Contract.

## Rule family G1 — Identifier primitive

WHEN an authoritative source defines an identifier/reference for a business object,
GENERATE candidate work units for:
- identify / capture;
- validate format/scope;
- establish assigning authority;
- check uniqueness in the correct scope;
- bind identifier to business object;
- reconcile cross-references;
- handle missing/not-found/duplicate/conflict conditions;
- preserve identifier evidence/provenance.

Example evidence:
UN/CEFACT defines distinct consignor-assigned and carrier-assigned consignment identifiers. Carrier-assigned ID may be a booking reference.
NMFTA eBOL defines PRO as document reference for update/delete and supports pre-assigned or carrier-assigned PRO.

## Rule family G2 — Object relationship primitive

WHEN authoritative semantics define two related business objects,
GENERATE:
- relationship establishment;
- cardinality validation;
- relationship consistency check;
- orphan/missing-link exception;
- conflicting-link exception;
- relationship evidence.

Example:
Consignment <-> consignor/consignee;
Consignment <-> transport document;
Handling unit <-> commodity/line item;
Hazmat description <-> relevant commodity item.

## Rule family G3 — Lifecycle/action primitive

WHEN an authoritative source exposes create/update/delete/cancel or status transitions,
GENERATE:
- lifecycle state model;
- transition preconditions;
- transition action;
- state validity rule;
- not-found/invalid-transition exceptions;
- transition evidence;
- idempotency/retry requirements where execution is external.

Example:
NMFTA eBOL POST=create, PUT=update, DELETE=cancel/delete.

## Rule family G4 — Requiredness primitive

WHEN a source marks an attribute mandatory/optional/conditional,
GENERATE:
- presence rule;
- lifecycle applicability;
- missing-information exception;
- client-binding override point.

IF industry optional AND client/carrier binding makes mandatory,
THEN preserve canonical optional status and add client-specific mandatory rule rather than modifying canonical truth.

## Rule family G5 — Controlled vocabulary / code set primitive

WHEN a source publishes a controlled code family,
GENERATE:
- code/reference lookup;
- allowed-value validation;
- deprecated/unknown-code handling where source supports it;
- client mapping layer if local values differ;
- invalid-code exception.

NMFTA eBOL confirms code families for accessorials, classification, countries, currencies, handling-unit types, limited-access types, payment terms, packaging, requestor roles, label formats, state/province, time-critical and result status.

## Rule family G6 — Master/reference-data primitive

WHEN a field's semantics are scoped to an assigning organization or governed master,
GENERATE:
- master lookup;
- scope resolution;
- exact/fuzzy match policy;
- ambiguity threshold;
- canonicalization rule;
- no-match / multiple-match exception;
- extracted-value vs canonical-value audit trace.

Example:
NMFTA LocationID is optional and unique within a shipper/carrier system, not industry-global.

## Rule family G7 — Conditional regulatory primitive

WHEN regulation applies only under a condition,
GENERATE:
- activation condition;
- expanded required-information contract;
- value/reference validation;
- representation/order rule if applicable;
- relationship checks;
- regulatory-priority rule over permissive client defaults;
- failure severity and exception route;
- regulatory evidence/provenance.

Example:
Hazmat shipping-paper rules activate additional required description elements and prescribed sequence.

## Rule family G8 — Error semantic primitive

WHEN a source distinguishes error classes,
GENERATE separate exception types and remediation paths.

Example:
NMFTA recommends:
- 400 for invalid BOL data;
- 404 when update/delete target BOL cannot be found.

Therefore do not collapse both to generic BOL_ERROR.

## Rule family G9 — Multi-error primitive

WHEN a source permits multiple validation issues in one response,
GENERATE:
- aggregate validation result;
- one work item containing multiple defects where appropriate;
- precedence/severity ordering;
- avoid duplicate queue creation for the same transaction.

NMFTA recommends failure errors before informational/warning responses.

## Rule family G10 — Source-precedence primitive

WHEN multiple sources can legitimately provide the same semantic concept,
GENERATE:
- semantic attribute separation where meanings differ;
- field-level authority rules;
- lifecycle-dependent precedence;
- conflict exception;
- provenance retention.

Do not assume whole-document precedence.

Example:
declared weight, verified operational weight and billing weight may be separate governed attributes.

## Rule family G11 — Representation constraint primitive

WHEN a source governs not only values but order/format/representation,
GENERATE:
- structure/order validation;
- generation rule;
- representation-specific exception.

Example:
Hazmat basic description sequence.

## Rule family G12 — Client specialization primitive

WHEN industry standards explicitly allow partner-specific strengthening,
GENERATE a client-binding slot for:
- stricter requiredness;
- tighter min/max length;
- local endpoint/system;
- local master;
- warning/error threshold;
- local queue routing.

Client specialization must not rewrite the canonical industry contract.

## P6.1 recursion after deterministic rule generation

Each generated work unit is recursively expanded using P6.1 grammar:
- trigger/purpose;
- information;
- decision;
- rule;
- action;
- control;
- evidence;
- state change;
- blocker/client binding/knowledge gap.

Stop when:
- executor-ready and sufficiently atomic; or
- blocked by client binding; or
- blocked by unresolved knowledge/evidence.

## Worked micro-example — PRO

Source primitives:
- PRO may be pre-assigned or carrier-assigned.
- PRO is used for eBOL update/delete lookup.

Generator output:
1. Determine whether PRO is supplied.
2. If supplied, validate format/check digit where applicable.
3. Bind PRO to the correct shipment/document.
4. If not supplied and carrier assignment supported, request/receive PRO.
5. Persist assigning authority and provenance.
6. Before update/delete, resolve PRO to current BOL.
7. If not found, produce identity-not-found exception.
8. If conflicting relationship, produce reference-conflict exception.
9. Record resulting state/evidence.

Domain Execution Contract then specifies masters, confidence, client rules, queue routing and projection details.

## Worked micro-example — LocationID

Source primitive:
LocationID is optional and organization-scoped.

Generator output:
1. Detect whether client binding uses LocationID.
2. If present, resolve assigning organization.
3. Validate within that organization's location master.
4. Do not apply global uniqueness.
5. If client binding makes it mandatory, create client-required presence rule.
6. If multiple/no match, route reconciliation exception.
7. Preserve extracted and canonical values separately.

## Research conclusion at v0.1

Authoritative sources are sufficient not merely to populate domain knowledge but to drive deterministic generation of substantial parts of:
- Work Decomposition;
- P6.1 recursive units;
- Domain Execution Contract;
- exception and queue logic.

Remaining gaps are largely source coverage, client-specific bindings, master-data availability and exact schema/property extraction—not proof of the generator concept itself.
