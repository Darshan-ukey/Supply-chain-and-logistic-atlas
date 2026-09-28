# ATL-137 — Atlas v1.5 Reuse Baseline Manifest V1

**Date:** 2026-09-28  
**Task:** ATL-137 — Baseline/Frozen-Asset & Current UX Reuse Audit  
**Release:** Atlas v1.5 — Malkom Domain Warehouse Demo/Live  
**Audit mode:** read-only / reconciliation-first  
**Frozen assets mutated:** none

## 1. Verified live production baseline

- Public production alias: `supplychainatlas.vercel.app`
- Vercel project: `logistic_atlas_v2`
- Deployment ID: `dpl_6Xa5N7TVSk7CwyqE52nR2EGQythx`
- Deployment state: `READY`
- Source: GitHub
- Source branch: `main`
- Source commit: `f9b08a951ca823ff8c23b64044fe1a7abb9dde79`
- Vercel project ID: `prj_zoyyLeFrvLKHFU8Unzq3Cr8zWDc0`

The production deployment identity is therefore explicit and provides the rollback/reference point for v1.5.

## 2. Current live product interaction baseline

The production source at the verified commit describes and tests the following established Atlas interaction identity:

- full 71-destination Page-0 navigator;
- four primary entry routes: Mode/Service, Enterprise Process/E2E Domain, Operating Model/Actor, Logistics Node;
- deterministic configuration → graph resolver → spatial Canvas;
- semantic zoom: Universe → focused A3 → scoped A4 → A5 contract;
- Ask Atlas with governed composer context;
- canonical-data-driven A5 Inspector;
- Playback / Freeze Time;
- Operational Trace;
- Actor / System / Control / Source lenses;
- Compare;
- Transform;
- Client AS-IS / discovery / validation / opportunities / TO-BE;
- Saved Views;
- protected/public API and workspace/document surfaces.

Production source evidence:
- `README.md` @ main
- `RELEASE_V1.1.8.md` @ main
- `tests/v1.1.8-feature-browser.mjs`
- `vercel.json`

## 3. Frozen/current asset classification for v1.5

### REUSE_AS_IS / preserve identity

- **Universe 7.3** — FROZEN_PRODUCTION_BASELINE. Use as current governed foundation; do not mutate.
- **Canvas 2.0.0** — FROZEN_PRODUCTION_BASELINE; asset-register disposition REUSE_AS_IS.
- **Road LTL 1.3** — current frozen production baseline; preserve as production/reference lineage.
- **Ocean FCL 0.5 / Ocean LCL 0.5** — frozen production baselines; preserve.

### REUSE_WITH_VALIDATION

- **Canvas 2.0.1 candidate** — additive successor candidate; may be used only after v1.5 validation and must not overwrite Canvas 2.0.0.
- **Universal Ask 2.0.1** — CERTIFIED_IN_BASELINE_PACKAGE; reuse with v1.5 route/context validation.
- **Road LTL 1.5 candidate** — current FROZEN_EXECUTION_REFERENCE_CANDIDATE; SHA-256 `22965f4b7ec2c3d192f86edf5bb073e4820fd3724cda02aa0502e4ff4404ac6f`.
- **Road LTL 1.5 Operational Knowledge / OKv2** — current FROZEN_OPERATIONAL_REFERENCE; SHA-256 `6bf09b05fef2967bda48800cf5ba926487f3df6ca467f0316ca52334045a22a9`.
- **Ocean FCL 0.6 candidate** — current frozen execution-reference candidate; SHA-256 `334d6a11595d33c46fa3b4675aa953f1fa6943906894f1cad7a8caf30cad034a`.
- **Ocean LCL 0.6 candidate** — current frozen execution-reference candidate; SHA-256 `73d416683f43357cd0eabfe96009405fa22d74008e452f977fa489f0c395850f`.

### STALE_OR_DEMO_ONLY / reference evidence only

- **Road LTL v2.3 Malkom 3.0 reference projection** — FROZEN_EXECUTION_REFERENCE_CANDIDATE but `demoOnly: true`; historical/reference projection only. It must not be presented as current Road LTL 1.5 output.
- **Ocean 0.6 public-safe projections bundle** — demo-only historical/reference projection. Useful for renderer/reference testing; not canonical current execution truth.
- historical Road LTL 1.4 / OK 1.4 remain immutable lineage/base evidence only.

## 4. Fresh-user root audit classification

### REUSE_AS_IS

The existing Atlas root/product shell already provides:
- recognizable Atlas identity;
- Page-0/domain entry structure;
- spatial Canvas;
- domain/context navigation;
- Ask Atlas;
- Inspector;
- Trace;
- Compare;
- Transform;
- playback/freeze;
- public/protected product layers.

These should remain the v1.5 shell rather than being replaced by a Malkom-specific dashboard.

### ADDITIVE_NAVIGATION_REQUIRED

v1.5 must add discoverable navigation from the normal Atlas journey to:
- current-lineage Daughter/process/task detail generated from governed data where supported;
- **Deepen this scope**;
- bounded WorkDefinition/readiness/binding view;
- Malkom Domain Warehouse requirement crosswalk;
- Malkom package/export;
- Queue Flow Explorer / BPMN export.

No critical v1.5 feature may require a manually typed deep link.

### ADDITIVE_FUNCTION_REQUIRED

The current production baseline does not itself prove these v1.5 capabilities and they must be built by later ATL-177 tasks:
- ATL-138 Malkom consumption crosswalk/contract;
- ATL-153 governed Source/Universe baseline for bounded generation;
- ATL-161 explicit knowledge/gap states;
- ATL-155 bounded Daughter generation;
- ATL-171 Operational Knowledge/canonical information-semantic bridge;
- ATL-157 bounded On-Demand Depth;
- ATL-159 bounded Work Decomposition/Canonical WD;
- ATL-165 minimal Client Binding;
- ATL-163 Malkom-oriented readiness;
- ATL-139/169 current-lineage Malkom package/projection boundary;
- ATL-178 generated Queue Flow/BPMN;
- ATL-167/140 root-to-output product interaction;
- ATL-175 bounded API/version/release/rollback;
- ATL-173 utility proof;
- ATL-141 release/browser polish;
- ATL-143/142 continuity/final QA/custody.

### DEFER_TO_V2

Do not pull these into v1.5 merely because related foundations exist:
- continuous authoritative-source refresh and semantic delta;
- universal selective regeneration/impact graph;
- full generic cross-domain Daughter generation;
- downstream-triggered/scalable autonomous On-Demand Depth and compounding;
- complete generic recursive WorkDefinition coverage;
- generalized FIRI/information-resolution coverage;
- full enterprise-discovery ingestion;
- deterministic Domain→Enterprise→Runtime readiness across consumer classes;
- full universal Ask/Trace/Compare over every governed layer;
- multi-consumer projections beyond Malkom;
- full BPMN semantic coverage / workflow runtime;
- Operations + Transformation + Execution Intelligence full end state;
- full backend/schema migration/version-negotiation architecture;
- v2 economic kill test and final v2 production certification.

## 5. Public / protected / consumer boundary

### Public / ordinary consumption
- Atlas Canvas / domain navigation;
- published public-safe domain/process/task meaning;
- supported Ask/Inspector/Trace surfaces with safe disclosure.

### Protected / admin / implementation
- deeper Operational Knowledge;
- evidence/provenance detail where restricted;
- knowledge-state/gap administration;
- WorkDefinition;
- Client Binding;
- readiness blockers;
- Malkom requirement crosswalk;
- package/export controls;
- candidate/unresolved research state.

### Downstream consumer
- Malkom receives a governed projection/package, not canonical Atlas storage.
- runtime copies/consumer schemas remain projections.
- Atlas owns governed understanding/specification; downstream tooling executes.

## 6. Storage / pull / consumption implications for later tasks

The baseline constrains later implementation:

- **Canonical domain/work truth** must remain in governed Atlas structures, versioned and provenance-bearing.
- **Candidate/depth knowledge** must remain explicitly classified and cannot silently overwrite frozen truth.
- **Client-specific values** belong in Client Binding, not reusable domain truth.
- **Malkom shapes** belong in projection/package layers.
- UI reads canonical/projection APIs or generated data; UI text must not become hidden source of truth.
- Malkom must pull/receive a deterministic current-lineage package with version/hash/lineage and explicit loss/binding dispositions.
- Queue Flow/BPMN is generated from governed work/projection data and is not manually canonicalized.

## 7. Risks / gaps discovered by ATL-137

1. Production is still v1.1.8 source behavior; v1.5 capabilities are additive work, not already live.
2. Road LTL 1.5 / Canvas 2.0.1 / Ocean 0.6 are candidate/reference assets, not automatically production-promoted.
3. Historical Malkom and Ocean demo projections are useful references but unsafe as current-lineage product truth.
4. Actual fresh-user visual/browser certification of the v1.5 release candidate is still required under ATL-141.
5. Root-to-v1.5 navigation must be added explicitly; current shell capability does not prove Malkom crosswalk/package discoverability.

## 8. ATL-137 disposition

**First-party execution/audit result: COMPLETE — AWAITING INDEPENDENT QA.**

The exact reusable shell and additive boundaries are now defined. No frozen asset was mutated. The next governed action is Claude independent QA under `ATLAS_V1_5_QA_OUTCOME_ARCHITECTURE_STANDARD_V1.md`.

Claude must verify both:
- correctness of this reuse classification; and
- whether this baseline genuinely enables the intended v1.5 product outcome and future architecture without hidden storage/retrieval/consumption/interaction drift.

ATL-138 must not begin until Claude PASS is durably persisted and the Shared Baton routes ChatGPT forward.
