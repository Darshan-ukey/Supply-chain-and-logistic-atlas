# Atlas Execution-Depth Presentation — Phased Update Backlog

**Backlog status:** FROZEN PLAN  
**Baseline:** `atlas-v2.1.0-rc1@1b2b07c1690570203db148cabbb16ace3b7355de`  
**Architecture:** `ATLAS-DAUGHTER-EXECUTION-DEPTH-PRESENTATION-ARCHITECTURE-V1`

## Governing rule

Execute phases sequentially. Do not combine semantic content promotion with presentation/security work unless the phase explicitly requires it. Each phase must pass its exit gate before the next begins.

## P0 — Freeze, Inventory & Regression Baseline

**Status: COMPLETE / PASS**

- [x] Register frozen presentation architecture.
- [x] Anchor immutable repository baseline.
- [x] Record per-asset semantic/version anchors.
- [x] Record public/private payload inventory.
- [x] Identify raw/protected execution exposure risks.
- [x] Create LTL/Ocean semantic regression fixtures.
- [x] Create authorization/security regression assertions.
- [x] Persist baseline in GitHub and Drive.

**Exit gate:** Later phases can prove no frozen semantic asset was silently mutated.

## P1 — Presentation & Access Contracts

**Status: COMPLETE / PASS**

- [x] Operational Knowledge Presentation Contract V1.
- [x] Execution Readiness Presentation Contract V1.
- [x] Authorization Projection Matrix covering Anonymous/Public, Authenticated Atlas User, Pilot User, Client Workspace User, Admin/Governor and Owner.
- [x] Explicit field-by-field/family classification: public-safe, authenticated-safe, client-authorized, internal-protected, admin-only, owner-only, masked/aggregated/not-rendered.
- [x] Provenance visibility rules.
- [x] Empty/unresolved rendering behavior.
- [x] Full canonical field-family coverage register across Operational Knowledge, Execution Readiness, Work Decomposition, WorkDefinition, Client Binding, Runtime Projection, Execution Evidence and Governance.
- [x] Positive-allowlist / deny-unless-classified rule frozen for P2 implementation.

**Frozen P1 assets:**

- `governance/contracts/operational-knowledge-presentation-contract-v1.json`
- `governance/contracts/execution-readiness-presentation-contract-v1.json`
- `governance/contracts/authorization-projection-matrix-v1.json`
- `governance/contracts/canonical-execution-field-coverage-v1.json`
- `governance/frozen/P1_PRESENTATION_AND_ACCESS_CONTRACTS.md`

**Exit gate: PASS.** Every canonical execution field family now has an explicit audience, presentation form and projection path. Unclassified future fields are denied by default until governed.

## P2 — Backend Projection Boundary

**Status: NOT STARTED**

Build authorization-aware projections:

- Overview Projection.
- Operational Knowledge Safe Projection.
- Execution Readiness Projection.
- Protected Execution Projection.
- Work Decomposition Summary.
- Full Work Decomposition endpoint for authorized users.
- Full WorkDefinition endpoint for authorized users.
- Positive allowlist public payload generation.
- Removal of protected execution/client-binding/runtime data from unauthorized browser payloads.
- Projection-version metadata and canonical traceability.

**Exit gate:** HTML source, browser state and network calls cannot expose protected execution assets to an unauthorized user.

## P3 — Universal Daughter Renderer V2

**Status: NOT STARTED**

Implement the frozen A5 sequence:

1. Overview.
2. Operational Knowledge.
3. Execution Readiness.
4. Protected Work Decomposition.
5. Protected WorkDefinition.

Additional requirements:

- Progressive disclosure for Operational Knowledge.
- Consistent execution-readiness rendering.
- Unauthorized decomposition summary only.
- Authorized recursive decomposition detail.
- Unauthorized WorkDefinition status only.
- Authorized WorkDefinition detail.
- Zero daughter-specific frontend business logic.
- Renderer version changes must not force semantic daughter version changes.

**Exit gate:** Road LTL V1.4, Ocean FCL V0.6 and Ocean LCL V0.6 render from the same universal renderer with no domain-specific presentation code.

## P4 — Canvas V2.0.1 Semantic-Depth Integration

**Status: NOT STARTED**

Preserve the frozen Canvas V2 visual architecture while changing the Inspector/depth contract to:

A2 → A3 → A4 → A5 → Operational Knowledge → Execution Readiness → Protected Work Decomposition → Protected WorkDefinition.

Preserve:

- Dynamic primary spine.
- Spatial adjacent activities.
- Typed Physical / Information / Data-Object / Financial / Control-Evidence relationships.
- Context Builder.
- Trace.
- Semantic zoom.
- Dynamic layout engine.
- No daughter-specific canvas code.

**Exit gate:** Daughter and Canvas resolve the same A5 IDs and presentation projections with no conflicting operational semantics.

## P5 — Ask Atlas, Trace & Governance Integration

**Status: NOT STARTED**

- Public Ask Atlas uses only Overview + safe Operational Knowledge + safe Execution Readiness.
- Protected Work Decomposition/WorkDefinition cannot be retrieved without authorization.
- Client Ask Atlas is scoped to authorized client bindings/data.
- Admin Ask Atlas can use the complete governed execution stack.
- Extend Trace: Source → Universe → Daughter claim → Operational Knowledge → Work Decomposition → WorkDefinition → Client Binding → Runtime Projection → Execution Evidence.
- Preserve suggested-gap governance: observed execution gap → proposed change → validation → correct canonical layer → impact analysis → selective regeneration.

**Exit gate:** Ask Atlas, Trace and UI enforce one consistent projection/authorization boundary.

## P6 — Operational Layer Compilation & Atlas V2 Integration

**Status: NOT STARTED**

For Road LTL V1.4, Ocean FCL V0.6 and Ocean LCL V0.6:

- compile recursive Work Decomposition;
- compile executor-neutral WorkDefinitions;
- persist governed assets in Atlas Warehouse;
- validate lineage and dependency impact;
- enrich/resolve client-binding requirements as far as reference knowledge allows;
- execute independent executor proof;
- create runtime projections such as Malkom only after canonical contracts pass;
- run promotion gates before any candidate replaces a current production baseline.

**Exit gate:** Canonical daughter knowledge can produce independently executor-proven WorkDefinitions without undocumented operational knowledge or semantic loss.

## Assets intentionally not semantically changed by this programme

- Universe V7.3 foundation.
- Road LTL V1.4 candidate semantics.
- Ocean FCL V0.6 candidate semantics.
- Ocean LCL V0.6 candidate semantics.
- Operational Knowledge Contract V1 semantics.
- Client Binding Contract V1 semantics.
- Recursive executability principle.
- Canonical WorkDefinition principle.
- Runtime-neutral Atlas architecture.
- Canvas V2 visual architecture.
- Five-depth presentation architecture V1.

Any semantic correction discovered during implementation must be raised as a separately governed change, not silently folded into a presentation/runtime phase.
