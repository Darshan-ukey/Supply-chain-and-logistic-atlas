# ATL-169 — Atlas v1.5 Current-Lineage Malkom Projection Boundary & Handoff

## Status
BUILD_COMPLETE / AWAITING_INDEPENDENT_QA

## Purpose
Freeze the bounded canonical Atlas → Malkom projection boundary proven jointly by ATL-138 and ATL-139. This record does not create a second canonical model and does not authorize production promotion.

## Governed inputs
- ATL-138 consumption contract: independently QA-PASSed.
- ATL-139 current-lineage Road LTL / LTL-04 Malkom Domain Warehouse package: independently QA-PASSed at tip `a57ad4d4f9488f190737701736beb5f807a19867`.
- Canonical WorkDefinition: `wd::road-ltl::LTL-04::v1`, version `1.0.0`.
- ATL-165 client-binding state remains separate and fail-closed: 2 resolved / 1 unresolved.

## Frozen boundary
The machine-readable boundary artifact is `data/generated/malkom-domain-warehouse/road-ltl-ltl04-projection-boundary-v1.json` and its schema is `data/contracts/atlas-malkom-projection-boundary-v1.schema.json`.

It preserves canonical Atlas identity/version/lineage; declares supported projection semantics; carries explicit `CLIENT_BINDING_REQUIRED`, `UNKNOWN`, and `LOSS_OR_UNSUPPORTED` dispositions; forbids guessed Malkom API endpoints while the requirement remains unconfirmed; records deterministic package/release identity; and traces the Malkom package back to canonical WorkDefinition, client-binding, package, and source identities.

Mandatory unrepresentable or unresolved semantics fail closed. `canonicalMutation=false`.

## Malkom-facing handoff
Required consumer: MALKOM.
Interface: machine-readable JSON export/package.
API endpoint: not confirmed; deliberately null.
Readiness: `CLIENT_BINDING_REQUIRED` until the remaining required client binding is resolved.

## STOP boundary
v1.5 requires no downstream proof for agentic AI, RPA/BPM/workflow, SAP, TMS, WMS, or other runtime packages. This artifact does not authorize production promotion; ATL-142 remains Owner-gated.

## QA target
Claude must independently verify lineage, deterministic identity/manifest, capability/loss dispositions, fail-closed behavior, Malkom-only boundary, canonical non-mutation, and traceability to ATL-138/ATL-139/canonical semantics before marking ATL-169 PASS.
