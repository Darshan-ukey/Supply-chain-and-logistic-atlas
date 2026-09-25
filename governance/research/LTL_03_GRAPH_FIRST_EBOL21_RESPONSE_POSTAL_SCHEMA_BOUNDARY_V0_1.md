# LTL-03 Graph-First Discovery — eBOL 2.1 Response / Postal Representation / Schema Boundary v0.1

Date: 2026-09-20
Workstream: ATL-35
Status: RESEARCH CANDIDATE — GRAPH-FIRST INTAKE

## Authoritative issuer evidence

NMFTA / DSDC current eBOL 2.1 material explicitly confirms:

1. Nine-digit postal codes are a valid eBOL 2.1 representation.
2. A response may include a four-character SCAC attribute to associate the responding carrier with returned data.
3. Carriers may return terms and conditions either as a URL to their website or as text within the API response body.
4. trailerid and manifestid exist under request referenceNumbers.
5. resultsStatusCodes exists on the response and describes logical transaction outcome.
6. The public API documentation identifies the authoritative OpenAPI asset as assets/ebol-apiv2.1.0.yaml and exposes the BOL_Request / BOL_Response schema families.

## Raw-schema recovery result

The issuer page names the OpenAPI asset and schema family, but the raw YAML body was not retrievable through the available web channel in this research session.

Therefore:
- exact complete BOL_Request property tree;
- exact full nesting;
- exact property cardinalities/required arrays;
- any undocumented property-level constraints

remain unresolved unless separately supported by issuer-explicit material.

No third-party schema copy is promoted to canonical truth.

## Domain facts

DF-POSTAL9-REPRESENTATION:
eBOL 2.1 permits nine-digit postal representation. This is a representation constraint, not a new location semantic.

DF-RESPONSE-SCAC-ASSOCIATION:
eBOL response may carry SCAC to associate the responding carrier with returned data. SCAC remains carrier identity governed by the existing master-reference semantics.

DF-TERMS-CONDITIONS-RESPONSE:
Carrier terms and conditions may be represented in response as either URL or text. Representation choice must not change the underlying contractual/document semantics.

DF-RAW-BOL-REQUEST-SCHEMA-GAP:
Issuer identifies authoritative OpenAPI asset and BOL_Request schema family, but exact complete property tree remains unrecovered in governed evidence.

## Existing primitive mapping

- Location
- Party
- Identifier
- Master Reference
- Document
- Instruction / Note
- Relationship
- Evidence / Provenance
- Controlled Vocabulary

No new primitive required.

## Family composition

- RF10 Representation Constraint
- RF1 Identity & Reference Resolution
- RF6 Master/Reference Reconciliation
- RF9 Source Authority & Precedence
- RF16 Instruction/Note Ownership
- RF2 Relationship Integrity
- RF8 Error & Exception Semantics (for unresolved evidence routing)

## Generated-rule candidates

GI-POSTAL9:
accept/validate nine-digit postal representation where eBOL 2.1 applies while preserving the semantic owner as Location.

GI-RESPONSE-CARRIER-SCAC:
associate returned SCAC with the responding carrier party and resolve through the existing SCAC master authority; do not create a second carrier identity semantic.

GI-TERMS-CONDITIONS:
preserve carrier terms/conditions as governed response content with representation type URL-or-text and provenance to the responding carrier.

## Knowledge-gap routing

KG-LTL-EBOL21-BOL-REQUEST-PROPERTY-TREE remains OPEN.

Until exact issuer property-level evidence is recovered:
- do not invent full BOL_Request fields/nesting/cardinality;
- do not infer request requiredness from response changes;
- do not use third-party generated clients as authoritative schema evidence.

## Reuse assessment

Existing rule families and patterns remain sufficient. No new family or reusable execution pattern is promoted.
