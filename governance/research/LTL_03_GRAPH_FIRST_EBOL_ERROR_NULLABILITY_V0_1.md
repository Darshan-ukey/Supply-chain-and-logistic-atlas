# LTL-03 Graph-First Research — eBOL Error and Nullability Semantics v0.1

Status: RESEARCH CHECKPOINT — TWO-TRACK CONTINUOUS RECONCILIATION
Date: 2026-09-20
Task: ATL-35 / LTL-03
Prior graph checkpoint: fd4c353d512d5c0bf15fd712be87c1ddff1a8ecd (399 nodes / 2,056 typed edges / 118 generated instances / 11 reusable patterns)

## Track A — authoritative execution-knowledge discovery

Primary authority: NMFTA/DSDC eBOL API Standard Version 2.1 issuer page and issuer FAQ.

Source-backed findings:
1. For bad BOL data, the issuer recommends HTTP 400 and permits use of the standard error-response payload or implementation-specific custom errors.
2. If a BOL cannot be found for DELETE or UPDATE, the issuer recommends HTTP 404 rather than 400.
3. Therefore transport/protocol status and canonical business-validation/exception semantics must remain distinct. HTTP status is a representation of outcome, not the business error itself.
4. The issuer FAQ states that non-required fields can be nullable under OpenAPI 2.0. Optionality and nullability are therefore separate representation/contract concerns: a non-required field may be absent or nullable according to implementation/schema support, and Atlas must not reinterpret null as a business value.
5. Implementation stacks determine how error objects/arrays are returned. Stack-specific error serialization is not canonical LTL execution knowledge.
6. Custom errors may be appended as needed for an implementation, so implementation-specific error vocabulary must remain scoped and cannot be promoted to industry truth.

## Track B — continuous normalization/materialization

Reuse:
- existing error/exception, representation-constraint, requiredness/cardinality, source-authority and identity-before-mutation machinery;
- SP-STATE, SP-CONTROLLED-VOCABULARY, SP-EVIDENCE-PROVENANCE, SP-COLLECTION-CARDINALITY, SP-RELATIONSHIP;
- existing runtime projections.

Generated-instance candidates:
- map bad-data validation failure to canonical validation exception, then project recommended HTTP 400 separately;
- map update/delete identity-not-found to canonical not-found exception, then project recommended HTTP 404 separately;
- preserve optionality and nullability separately and prohibit null-as-business-value inference;
- retain custom implementation error vocabulary as scoped client/implementation binding.

Client-binding dependencies:
- implementation-specific custom error catalogue and payload structure;
- local nullable/serialization behavior where the implementation contract strengthens or specializes the standard.

## Guardrails

- HTTP 400/404 must not replace canonical business exception semantics.
- Do not classify identity-not-found as generic bad-data validation when operation context is UPDATE/DELETE.
- Do not infer that optional means null, or that null carries a domain value.
- Do not promote framework-specific error object/array behavior to LTL truth.
- Custom errors remain implementation/client scoped unless an authoritative industry standard defines them.

No new semantic primitive, rule family or reusable pattern is required.
LTL-03 remains NOT FROZEN.
