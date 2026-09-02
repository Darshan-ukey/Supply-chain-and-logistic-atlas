# Atlas Presentation Architecture — Phased Update Backlog

**Governing frozen asset:** `ATLAS-DAUGHTER-EXECUTION-DEPTH-PRESENTATION-ARCHITECTURE-V1`

## Phase 0 — Freeze, inventory and regression baseline
**Status: COMPLETE**

Scope:
- register frozen presentation architecture;
- pin production/candidate semantic identities;
- inventory renderer/Canvas/Ask/Atlas Warehouse execution surfaces;
- establish current public/private payload boundary;
- identify candidate browser-exposure risk;
- create regression fixtures;
- make no functional changes.

Exit gate: later changes can be proven not to mutate frozen semantic assets.

## Phase 1 — Presentation and access contracts
**Status: COMPLETE — EXIT GATE PASS**

Delivered:
- Operational Knowledge Presentation Contract V1;
- Execution Readiness Presentation Contract V1;
- authorization projection matrix covering Public/Anonymous, authenticated Atlas, Pilot, Client Workspace, Admin/Governor and Owner;
- field-by-field classification covering canonical field/path, presentation type, visibility, masking, aggregation, unresolved behavior and provenance visibility;
- machine-readable authorization and field-classification companions for P2;
- deny-by-default classification for unmatched/new canonical fields;
- P1 completion audit confirming no semantic/runtime/UI changes.

Exit gate: **PASS** — every current canonical execution-depth field family has an explicit consumer, projection and authorization rule; unmatched future fields are private/not projected by default.

## Phase 2 — Backend projection boundary
**Status: NOT STARTED**

Deliver server/build-side projections:
- Overview Projection;
- Operational Knowledge Safe Projection;
- Execution Readiness Projection;
- Protected Execution Projection for full Work Decomposition + WorkDefinition.

Requirements:
- public allowlist;
- protected detail absent from unauthorized responses/browser state;
- authorization before retrieval;
- traceability from presentation object to canonical object.

Exit gate: network/HTML/browser inspection cannot reveal protected execution IP to unauthorized users.

## Phase 3 — Universal Daughter Renderer V2
**Status: NOT STARTED**

Implement the five-depth A5 experience:
1. Overview
2. Operational Knowledge
3. Execution Readiness
4. Protected Work Decomposition
5. Protected WorkDefinition

Rules:
- generic renderer;
- zero domain-specific frontend semantics;
- same renderer must support LTL and Ocean candidate projections;
- presentation-only release does not alter Daughter semantic versions.

Exit gate: same renderer renders all supported modules from governed projections without bespoke domain code.

## Phase 4 — Canvas V2.0.1 integration patch
**Status: NOT STARTED**

Amend semantic depth only:
A2/A3/A4/A5
→ Operational Knowledge
→ Execution Readiness
→ Protected Work Decomposition
→ Protected WorkDefinition.

Preserve:
- Canvas V2 visual architecture;
- dynamic spine/spatial model;
- Context Builder;
- typed flows;
- Trace;
- zoom principles;
- no new daughter-specific Canvas code.

Exit gate: Daughter and Canvas resolve the same canonical A5/projection and do not diverge semantically.

## Phase 5 — Ask Atlas, Trace and governance integration
**Status: NOT STARTED**

Deliver:
- authorization-aware retrieval for Ask Atlas;
- Trace extension through Operational Knowledge → Decomposition → WorkDefinition → binding/runtime/evidence where authorized;
- runtime-discovered-gap governance path;
- no protected-data bypass via conversational retrieval.

Exit gate: Ask/Trace cannot expose information that the active user is not authorized to receive.

## Phase 6 — Operational Layer compilation and Atlas V2 upgrade
**Status: NOT STARTED**

Only after P0–P5:
- compile recursive Work Decomposition from governed Daughter Operational Knowledge;
- compile canonical WorkDefinitions;
- populate/regenerate Atlas Warehouse;
- perform client-binding enrichment;
- generate runtime projections such as Malkom;
- perform independent executor proof;
- run promotion gates for Road LTL V1.4, Ocean FCL V0.6 and Ocean LCL V0.6.

Exit gate: operational layer is independently executor-proven and promotion is explicit.

## Sequencing invariant

P0 → P1 → P2 → P3 → P4 → P5 → P6.

No phase may silently promote semantic candidates or mutate a previous frozen architecture asset.
