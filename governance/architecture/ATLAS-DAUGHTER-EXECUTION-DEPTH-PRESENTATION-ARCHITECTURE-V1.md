# Atlas Daughter Execution-Depth Presentation Architecture V1

**Status:** FROZEN  
**Effective date:** 2026-09-02  
**Asset ID:** `ATLAS-DAUGHTER-EXECUTION-DEPTH-PRESENTATION-ARCHITECTURE-V1`  
**Version:** `1.0.0`

## Canonical presentation sequence

**Overview → Operational Knowledge → Execution Readiness → [Protected] Work Decomposition → [Protected] WorkDefinition**

This is a presentation and access architecture layered over the existing Atlas semantic and execution architecture. It does not create a new semantic layer and it does not alter Daughter, Operational Knowledge, Work Decomposition, WorkDefinition, Client Binding, or runtime semantics.

## Frozen principles

1. **Overview** remains the concise A5 orientation surface: purpose, trigger, context/applicability, key actors/systems/objects, state and outcome.
2. **Operational Knowledge** is a first-class visible Daughter depth because it is the human validation bridge between domain truth and executable work.
3. Visible Operational Knowledge is a **governed human-readable projection**, never a wholesale browser delivery of the canonical operational record.
4. Canonical Operational Knowledge remains backend-governed and retains the complete required-information, decision, rule, control, branch, timing, responsibility, system, evidence, provenance and binding semantics.
5. **Execution Readiness** is visible and explains whether the selected A5 can safely proceed downstream. It may expose statuses and aggregate diagnostics such as decomposition requirement, coverage, unresolved knowledge/binding, HITL dependency and independent executor-proof status.
6. **Full recursive Work Decomposition is protected execution IP.** Unauthorized users may receive only an approved summary or aggregate counts.
7. **Full canonical WorkDefinition is protected execution IP.** Unauthorized users may receive only availability/status and approved summary information.
8. Protection is enforced at the **data/API projection boundary**, not by CSS, JavaScript hiding, collapsed panels, client-side filtering or obscured browser state.
9. Protected execution detail must never be sent to an unauthorized browser.
10. Public/normal projections use an **explicit allowlist**. New canonical fields are private by default until deliberately classified for presentation.
11. Daughter semantic versions do not change for presentation-only improvements. Renderer, projection and presentation-contract versions evolve independently.
12. Daughter, Canvas, Ask Atlas, Trace and future surfaces consume the same governed canonical records through authorization-aware projections; they do not maintain independent operational truth.
13. No business rule, decision rule, applicability rule or execution semantic may be re-authored inside the renderer.
14. Runtime projections and renderers are consumers of canonical knowledge; neither may become a second source of truth.
15. Full source-to-claim lineage, detailed client-binding mappings, runtime projections and other protected IP remain subject to the existing Atlas security/governance boundary.
16. The presentation architecture is generic across Daughter modules. No LTL-, Ocean-, Air- or other domain-specific rendering logic is permitted unless it is purely declarative data supplied by the governed module contract.

## Presentation contract by depth

### 1. Overview
Purpose: **What is this work?**

Safe concise material may include canonical task identity and hierarchy; purpose/scope; trigger and principal pre/post state; major actors, systems and objects; applicability/context; principal outcome; upstream/downstream orientation; and a safe evidence/confidence indicator.

### 2. Operational Knowledge
Purpose: **How does this operation actually work?**

The governed presentation projection may include, where safe: required information and canonical information concepts; when/why information is required; value-origin class; human-readable validation criteria; decision gates; business rules; controls; canonical actions; branch conditions and outcome/state families; exception/retry/recovery/escalation summaries; timing/clock semantics; performer/owner/authority; systems and exchanges; objects/documents; evidence/completion criteria; applicability boundaries; evidence/provenance class; and unresolved/client-dependent categories.

Exact protected mappings, machine expressions, client fields/codes, restricted provenance and other protected execution IP are excluded from unauthorized projections.

### 3. Execution Readiness
Purpose: **Can this knowledge safely become executable work?**

Standard presentation concepts include decomposition required/status; executor-ready status; independent executor-proof status; required-information coverage; decision/branch/evidence coverage; unresolved operational knowledge; unresolved client binding; deterministic vs judgement dependency; HITL dependency; system-action dependency; exception/recovery completeness; Work Decomposition status; and WorkDefinition status.

### 4. Protected Work Decomposition
Purpose: **What exact executable units were derived?**

Full recursive decomposition remains protected. Authorized views may expose the canonical decomposition tree/graph and node contracts. Unauthorized views may expose only deliberately approved summaries.

### 5. Protected WorkDefinition
Purpose: **What is the canonical machine-consumable execution contract?**

Full inputs, canonical fields, validations, decisions, rules, controls, actions, systems, actors, transitions, waits, retries, escalations, recovery, evidence, state/outcomes, client-binding points and machine-readable contract remain protected.

## Projection architecture

Canonical A5
→ Overview Projection
→ Operational Knowledge Presentation Projection
→ Execution Readiness Projection
→ Authorization Boundary
→ Full Work Decomposition
→ Full WorkDefinition

The authorization boundary is a server/data boundary. The renderer receives only the projection authorized for the active user/capability.

## Versioning rule

A presentation-only improvement may increment presentation/renderer/projection versions, but must not increment the Daughter semantic version, mutate canonical Operational Knowledge, or mutate Work Decomposition/WorkDefinition except through their own governed derivation/change process.

## Governance rule

Any future exception to this architecture requires an explicit superseding frozen architecture asset. This V1 file is immutable after registration.
