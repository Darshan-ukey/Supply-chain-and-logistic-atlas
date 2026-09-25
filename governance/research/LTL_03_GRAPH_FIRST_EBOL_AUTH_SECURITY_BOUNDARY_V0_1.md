# LTL-03 Graph-First Research — eBOL Authentication and Transport-Security Boundary v0.1

Status: RESEARCH CHECKPOINT — TWO-TRACK CONTINUOUS RECONCILIATION
Date: 2026-09-20
Task: ATL-35 / LTL-03
Prior graph checkpoint: 1d6783500c51ba6e2de973dc464f63580f2eb6cc (410 nodes / 2,127 typed edges / 122 generated instances / 11 reusable patterns)

## Track A — authoritative execution-knowledge discovery

Primary authority: NMFTA/DSDC eBOL API Standard Version 2.1 issuer FAQ.

Source-backed findings:
1. The issuer states that the standard does not prescribe one authentication method. Authentication is agreed between trading partners / implementers.
2. API endpoint and connection details are implementation/runtime concerns rather than canonical shipment-domain semantics.
3. Consequently, authentication mechanism, credential/token form, secret handling, endpoint configuration and transport-security implementation must remain outside reusable LTL business truth unless an authoritative domain standard explicitly defines them.
4. The eBOL business contract can require an authenticated/authorized exchange without Atlas inventing the concrete security mechanism.
5. Partner-specific authentication is therefore a client/partner binding requirement that must be resolved before a deployable API projection can be considered execution-ready.
6. Security configuration evidence has different authority from BOL business semantics: it is implementation/partner evidence, not evidence for shipment facts.

## Track B — continuous normalization/materialization

Reuse existing:
- source authority / precedence;
- client specialization;
- relationship and evidence/provenance primitives;
- endpoint runtime-scope semantics already present in the graph;
- generic API projection.

Generated-instance candidates:
- require an explicit partner authentication binding before activating client-specific eBOL API exchange;
- keep authentication/credential/endpoint configuration out of canonical BOL semantic facts while retaining provenance and deployment dependency.

Client-binding requirement:
- partner authentication method, credential/token mechanism, endpoint/security configuration and operational ownership.

## Guardrails

- Do not invent OAuth, API key, mTLS, Basic Auth or another mechanism when the governing partner contract does not specify it.
- Do not persist secrets/credentials as domain knowledge.
- Do not interpret successful authentication as validation of BOL business content.
- Do not interpret valid BOL content as authorization to transmit.
- Do not promote one carrier's security configuration to reusable LTL truth.
- Runtime security configuration must be resolved before client-specific API activation.

No new semantic primitive, rule family or reusable pattern is required.
LTL-03 remains NOT FROZEN.
