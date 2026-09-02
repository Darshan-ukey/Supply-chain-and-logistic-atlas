# P0 — Freeze, Inventory & Regression Baseline

**Status:** COMPLETE  
**Date:** 2026-09-02  
**Working branch:** `atlas-p0-presentation-freeze`  
**Baseline branch:** `atlas-v2.1.0-rc1`  
**Baseline commit:** `1b2b07c1690570203db148cabbb16ace3b7355de`  
**Rule:** P0 makes no functional product changes.

## 1. Frozen architecture registered

Frozen asset:

`ATLAS-DAUGHTER-EXECUTION-DEPTH-PRESENTATION-ARCHITECTURE-V1`

Canonical presentation:

**Overview → Operational Knowledge → Execution Readiness → [Protected] Work Decomposition → [Protected] WorkDefinition**

The frozen architecture is stored in:

`governance/frozen/ATLAS_DAUGHTER_EXECUTION_DEPTH_PRESENTATION_ARCHITECTURE_V1.md`

## 2. Immutable baseline anchors

P0 uses two levels of baseline control:

1. **Repository-level immutable anchor** — the complete V2.1 RC1 state at commit `1b2b07c1690570203db148cabbb16ace3b7355de`.
2. **Asset-level semantic version/status anchor** — records the exact governed version that downstream work is allowed to consume.

Where a newer candidate is not yet cleanly materialized as one independently hash-addressable artifact in the V2.1 RC1 repository, P0 records that explicitly rather than inventing a hash or treating the candidate as promoted.

| Asset | Frozen/version anchor | P0 repository/hash anchor | Baseline status |
|---|---|---|---|
| Universe | V7.3 | dedicated branch commit `4d6b3224caf32b6172fb0958ee94eeb63dc80c61`; V2.1 repo anchor above | FROZEN FOUNDATION |
| Road LTL | V1.4 | semantic version + V2.1 repo anchor | FROZEN CANDIDATE / NOT SILENTLY PROMOTED |
| Ocean FCL | V0.6 | semantic version + V2.1 repo anchor | FROZEN CANDIDATE / NOT SILENTLY PROMOTED |
| Ocean LCL | V0.6 | semantic version + V2.1 repo anchor | FROZEN CANDIDATE / NOT SILENTLY PROMOTED |
| Operational Knowledge Contract | V1 | contract version + V2.1 repo anchor | FROZEN CANONICAL CONTRACT |
| Client Binding Contract | V1 | contract version + V2.1 repo anchor | FROZEN CANONICAL CONTRACT |
| Universal Daughter Renderer | current pre-V2 renderer baseline | V2.1 repo anchor | REGRESSION BASELINE; UPDATE PLANNED P3 |
| Canvas | V2.0 | dedicated branch commit `e885ecb883881686dea5989a928a69b7db27324e`; V2.1 repo anchor | FROZEN VISUAL ARCHITECTURE; SEMANTIC-DEPTH PATCH PLANNED P4 |
| Ask Atlas | V2.0.1 universal Ask baseline | certification blob `d0dfd8b2e4343f7ea86af249407e33f158267959`; V2.1 repo anchor | REGRESSION BASELINE; ACCESS PATCH PLANNED P5 |
| Atlas Warehouse | V1 architecture/schema family | V2.1 repo anchor | GOVERNED STORAGE BASELINE; REGENERATION SEPARATE FROM PRESENTATION CHANGE |
| Admin/runtime UI | V2.1 RC1 | `admin.html` blob `c33f69dbd4d62739fc7be79110d3d160735b1537` | REGRESSION BASELINE |
| Execution Fabric build audit | V2.1 | blob `273419774097b49d0c2eb9c2a728365917b724ce` | AUDIT BASELINE |

## 3. Public/private payload inventory

### Public/normal daughter payload — permitted target surface

- A5 Overview
- Human-readable, allowlisted Operational Knowledge projection
- Execution Readiness statuses/metrics
- Approved Work Decomposition summary only
- WorkDefinition availability/status only
- Safe actor/system/object/context summaries
- Safe provenance/evidence classification where allowed

### Protected/admin/client-authorized payload

- Full canonical Operational Knowledge when restricted by policy
- Exact recursive Work Decomposition
- Full canonical WorkDefinition
- Detailed canonical field/schema contracts
- Exact decision/rule/transition decomposition where protected
- Detailed exceptions/retry/escalation/recovery logic where protected
- Exact client-binding requirements/mappings
- Client field/system/status/route/SLA/policy bindings
- Runtime-specific projections, including Malkom projection
- Protected source-to-claim/provenance/crosswalk details where classified as IP

## 4. Current exposure findings

P0 records the following as implementation risks for P2, not as reasons to mutate the frozen semantic assets:

1. **Candidate daughter HTML can carry richer canonical objects than the final public projection should expose.** Therefore final publication cannot rely on hiding sections in the UI; public payloads must be generated through a positive allowlist/projection boundary.
2. **Work Decomposition and WorkDefinition protection must be enforced before browser delivery.** CSS/JavaScript concealment is not an authorization mechanism.
3. **Ask Atlas must share the same projection policy.** Retrieval cannot expose protected execution assets that the page itself withholds.
4. **Client Binding must remain a separate authorization domain.** Canonical reference knowledge must not be overwritten with client values.
5. **Renderer/Canvas/runtime must remain consumers of governed projections rather than carrying duplicate business rules.**

## 5. Regression fixtures

The following fixtures are frozen for later P1–P6 verification.

### Repository fixture

- Baseline branch: `atlas-v2.1.0-rc1`
- Baseline commit: `1b2b07c1690570203db148cabbb16ace3b7355de`
- P0 work branch contains governance-only additions.

### Semantic fixtures

**Road LTL V1.4**
- 22 A5 tasks
- 152 required-information contracts
- 75 decision gates
- 150 branch transitions
- 128 client-binding slots
- 132 provenance claims

**Ocean FCL V0.6**
- 30 A5 tasks
- 113 required-information contracts
- 34 decision gates
- 68 branch transitions
- 99 client-binding slots
- 90 provenance claims

**Ocean LCL V0.6**
- 30 A5 tasks
- 127 required-information contracts
- 34 decision gates
- 68 branch transitions
- 99 client-binding slots
- 90 provenance claims

### Presentation fixture

Every selected A5 must resolve in this order:

1. Overview
2. Operational Knowledge
3. Execution Readiness
4. Protected Work Decomposition
5. Protected WorkDefinition

### Security fixture

For an unauthorized request/browser:

- no full Work Decomposition payload;
- no full WorkDefinition payload;
- no restricted client-binding mapping;
- no protected runtime projection;
- no protected execution/source detail retrievable via Ask Atlas.

### Lineage fixture

Every downstream Work Decomposition/WorkDefinition generated later must preserve lineage to the exact Universe, Daughter, A5 contract, source foundation and schema version that produced it.

## 6. P0 exit gate

**PASS.**

P0 can prove the pre-update platform state through the immutable V2.1 RC1 commit and the recorded semantic/version anchors. Known candidate-materialization differences are explicitly labelled and therefore cannot be mistaken for production promotion.

No product behavior, daughter semantics, Canvas behavior, Ask Atlas behavior, Warehouse schema or runtime implementation was changed in P0.

## 7. Next phase

**P1 — Presentation and Access Contracts** is mapped but must not start until explicitly initiated.
