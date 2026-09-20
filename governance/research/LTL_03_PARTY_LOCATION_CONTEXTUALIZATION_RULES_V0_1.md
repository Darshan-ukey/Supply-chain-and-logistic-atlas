# LTL-03 Party & Location Contextualization Rules v0.1

Date: 2026-09-20
Workstream: ATL-35
Status: RESEARCH CANDIDATE — NOT FROZEN

## Purpose

Define deterministic contextualization rules for party and location data extracted from transport documents.

## Core rule

Resolve semantic role first, then resolve identity.

Do not run one generic name/address matcher across all extracted party/location blocks.

## Source-backed location roles

UN/CEFACT models distinct logistics-location relationships including:
- consignee receipt location (0..1);
- final destination location (0..1);
- pickup-event occurrence location (0..1);
- delivery-event occurrence location (0..1);
- transit locations (0..n);
- other context-specific locations.

Location objects may carry:
- identifier;
- name;
- type;
- country;
- country subdivision;
- postal address;
- geographic coordinates;
- subordinate locations where applicable.

## Deterministic generator rule G16 — Role-before-identity

WHEN a source defines distinct party/location roles,
GENERATE:

1. role classification;
2. role-specific candidate extraction;
3. role-specific master/reference lookup;
4. relationship validation to shipment/consignment/document;
5. ambiguity handling if multiple candidates survive;
6. role-conflict exception if the same extracted block is being assigned inconsistently;
7. evidence/provenance of role and identity resolution.

## Contextualization examples

### Consignee
Extracted:
XYZ STORE
1201 BROADWAY
DALLAS TX

Do not resolve solely against any address master.

First establish semantic role = CONSIGNEE / CONSIGNEE_RECEIPT relationship.

Then resolve identity using:
- consignee/customer/location master;
- postal/address;
- shipment/booking/PRO relationships;
- client-specific destination rules.

If multiple candidates remain:
CONSIGNEE_IDENTITY_AMBIGUOUS.

### Pickup location
A pickup-event location is not automatically the shipper legal address.

Generator must allow:
- shipper party identity;
- pickup-location identity;
- shipper postal address;
- event occurrence location

to be distinct but related objects.

### Final destination vs consignee receipt
These may coincide operationally, but the semantic model treats them as distinct roles.

Client binding may assert equivalence for a specific workflow, but Atlas canonical model should not hard-code equivalence.

## Deterministic generator rule G17 — Role-equivalence binding

WHEN two canonical roles may be equivalent in a client operating model,
GENERATE a client-binding rule rather than merging the canonical roles.

Example:
IF client policy says FINAL_DESTINATION = CONSIGNEE_RECEIPT for standard domestic LTL
THEN bind roles for that scope.
ELSE preserve them separately.

## Deterministic generator rule G18 — Role-aware master lookup

WHEN a field requires master/reference resolution,
lookup scope must include semantic role.

A perfect address match to the wrong role is not contextual success.

Required output:
- extracted role candidate;
- canonical role;
- candidate master entity;
- matched attributes;
- relationship evidence;
- confidence;
- disposition;
- exception/queue if unresolved.

## Queue candidates

PARTY_ROLE_AMBIGUOUS
PARTY_IDENTITY_AMBIGUOUS
LOCATION_ROLE_AMBIGUOUS
LOCATION_MASTER_NO_MATCH
LOCATION_MASTER_MULTIPLE_MATCH
ROLE_RELATIONSHIP_CONFLICT
CLIENT_ROLE_BINDING_MISSING

Names remain candidate Atlas nomenclature.

## Execution impact

For Malkom/IDP:
- extract party/location blocks;
- classify role;
- resolve against the correct master;
- canonicalize only when role + identity are sufficiently resolved.

For RPA:
- choose system lookup screen/master based on role.

For AI agent:
- prohibit resolving a party/location solely from fuzzy similarity without satisfying role-aware relationship rules.

## Generator significance

This rule family directly addresses contextualization failures where OCR is correct but the extracted name/address is assigned to the wrong business role.
