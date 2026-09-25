# LTL-03 Graph-First Research — In-Transit Delivery Channel and Exposure Semantics v0.1

Status: RESEARCH CHECKPOINT — TWO-TRACK CONTINUOUS RECONCILIATION
Date: 2026-09-20
Task: ATL-35 / LTL-03
Prior graph checkpoint: 16e302d1c98e0b9d2b6e96c1ee44649a55db53d3 (416 nodes / 2,154 typed edges / 124 generated instances / 11 reusable patterns)

## Track A — authoritative execution-knowledge discovery

Primary authority: NMFTA/DSDC In-Transit Visibility API Standard issuer page.

Source-backed findings:
1. The standard supports two delivery modes for visibility information: automatic/event-triggered push notifications to subscribed stakeholders and on-demand retrieval of the latest shipment status.
2. Push versus pull is a delivery-channel/projection choice. It does not create different shipment states or different meanings for the underlying milestone/exception.
3. Subscription is a relationship/authorization condition for push delivery. A stakeholder being subscribed must not be interpreted as evidence that a shipment event occurred.
4. On-demand lookup supports multiple reference contexts, including PRO, BOL, PO and account number. The lookup key's semantic type must remain explicit rather than being flattened into a generic search string.
5. The standard distinguishes Verified and Public access structures. Public access can support non-account inquiries, including shipments outside an account relationship, while carriers retain discretion over what their systems expose.
6. Exposure scope and delivery channel are independent dimensions: Public/Verified governs what may be exposed; push/pull governs how information is delivered.
7. Carrier implementation discretion over supported data is an implementation capability constraint, not permission for Atlas to infer missing data or silently reinterpret an absent field.

## Track B — continuous normalization/materialization

Reuse existing:
- Verified/Public access-scope semantics (GI-100);
- identity/reference resolution;
- relationship, indicator and evidence/provenance primitives;
- event-lifecycle and conditional-contract patterns;
- source-authority, representation and client-specialization families.

Generated-instance candidates:
- preserve push notification versus on-demand pull as projection/channel semantics without duplicating shipment-state truth;
- require subscription/authorization relationship before push projection without treating subscription as an event;
- resolve the semantic type of PRO/BOL/PO/account lookup keys before retrieving status;
- combine access scope and delivery channel independently when producing client/runtime projections.

Client-binding requirements:
- partner subscription lifecycle and notification destination/configuration;
- carrier/client supported exposure matrix for Verified/Public fields;
- locally supported lookup-key combinations and endpoint behavior.

## Guardrails

- Push and pull must not create competing canonical shipment states.
- Subscription is not shipment-event evidence.
- Public access is not anonymous authorization to all shipment detail.
- Verified/Public access scope must not be conflated with shipment lifecycle state.
- PRO, BOL, PO and account number remain typed references.
- Unsupported/missing carrier data remains unresolved; do not synthesize it.
- Carrier exposure policy remains scoped to implementation/client binding.

No new semantic primitive, rule family or reusable pattern is required.
LTL-03 remains NOT FROZEN.
