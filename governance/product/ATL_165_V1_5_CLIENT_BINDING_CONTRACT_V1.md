# ATL-165 — Minimal Client Binding Requirements & Manual Resolution

Status: FROZEN v1.5 bounded contract.

This artifact binds ATL-159's generic `CLIENT_BINDING_REQUIRED` state without changing reusable Atlas domain truth. The frozen demo scope is Road LTL / LTL-04 only.

The contract makes each missing client binding actionable through a reason, expected value/source/system/authority, and collection question. It permits only explicit governed manual resolution in this demo. Resolved values remain in the client-binding layer with evidence IDs; they are never written back into the canonical WorkDefinition.

Readiness is fail-closed while any required binding remains unresolved. The same resolved/unresolved state is projected into the bounded Malkom consumer package with `canonicalMutation=false`.

STOP boundary: this is not enterprise discovery, SOP ingestion, automated extraction/mapping, or enterprise-model onboarding.
