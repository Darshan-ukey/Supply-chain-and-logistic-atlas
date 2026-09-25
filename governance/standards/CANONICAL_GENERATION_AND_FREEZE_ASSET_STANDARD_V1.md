# Canonical Generation & Freeze-Asset Standard V1

Status: OWNER-AUTHORIZED GLOBAL GOVERNANCE  
Effective: 16 September 2026  
Applies to: every Atlas layer, engine, materializer, compiler, resolver, adapter, projection generator and governed derived artifact.

## 1. Purpose

Atlas must be reproducible after session loss, environment failure, deployment loss or operator/agent change.

A governed output is not considered reproducible merely because the final file exists. Atlas must preserve the exact inputs, generation logic, schemas/contracts, parameters, dependencies, validation evidence and output identity required either to regenerate the result deterministically or to restore the frozen canonical result exactly.

This standard distinguishes four things that must never be conflated:

1. **Canonical asset** — governed data/knowledge/state that is authoritative for its declared scope.
2. **Generator/engine** — versioned logic that creates, transforms, resolves, analyses or projects assets.
3. **Derived projection** — a regenerable view/package/tool-specific representation of canonical state.
4. **Runtime** — the environment/tool that executes or displays the result; runtime state is not automatically canonical truth.

## 2. Mandatory generation pattern

Where a layer contains generated or derived data, the governed pattern is:

`FROZEN INPUTS → VERSIONED GENERATOR CONTRACT → GENERATOR IMPLEMENTATION → VALIDATOR/QA → GOVERNED OUTPUT → HASH/IDENTITY → CUSTODY/RECOVERY RECORD`

No generated canonical asset may depend on an undocumented chat instruction, temporary prompt, untracked local script, browser state, ephemeral seed, or remembered manual sequence.

## 3. Generator Contract — mandatory for every governed engine

Every generator/engine must have a versioned Generator Contract defining at minimum:
- engine/generator ID and semantic purpose;
- owned input contract(s) and required versions;
- output contract/schema and lifecycle state produced;
- transformation/resolution/generation rules;
- ordering, precedence and conflict rules;
- deterministic/non-deterministic classification;
- external dependencies and versions;
- parameters/configuration/defaults;
- provenance/lineage emitted into outputs;
- validation rules and failure states;
- promotion rule from candidate/derived output to canonical output, where applicable;
- rollback/rebuild method;
- compatibility rules with prior/successor versions.

Generator code without a Generator Contract is not a governed Atlas engine.

## 4. Engine classes

The successor architecture may use different engine classes. The class must be explicit because the freeze/recovery requirement differs.

### G1 — Deterministic materializer/compiler/resolver
Examples: version resolver, Work Decomposition materializer where rules are deterministic, WorkDefinition compiler, readiness resolver, specification manifest generator, adapter projection generator where mapping rules are deterministic.

Requirement: given the same frozen inputs, implementation version and parameters, the engine must reproduce the same canonical/derived semantic result. Exact byte equality is required where serialization is deterministic; otherwise normalized semantic equality plus hashable canonical serialization is required.

### G2 — Evidence ingestion/normalization pipeline
Examples: client event/log ingestion, correction-history normalization, cycle-time/event normalization.

Requirement: preserve raw input snapshot/query identity, extraction timestamp/window, mapping rules, normalization code and resulting normalized evidence identity. Re-running against a changed live source is not considered reproduction of the earlier baseline.

### G3 — Analytical/decision engine
Examples: Operations Intelligence analysis, friction/conformance analysis, prioritisation/scoring.

Requirement: preserve exact governed input baseline, analysis rules/model, scoring logic, thresholds, parameters, output and evidence. Derived analysis cannot silently become canonical business truth.

### G4 — Generative/LLM-assisted engine
Examples: source synthesis, candidate rule extraction, candidate future-state design, solution-pattern generation.

Requirement: freeze prompt/template/instruction version, model/tool identifier, retrieval/input set, parameters, post-processing/validator version and the exact generated candidate output used for review.

Because exact generative replay may not be guaranteed, an approved canonical asset must never rely on future re-generation to recover its exact content. Once approved, preserve the exact canonical output bytes/structured records and their approval/QA evidence. A future regeneration creates a new candidate/version, not a silent replacement.

### G5 — Renderer/projection engine
Examples: Canvas/HTML views, public-safe projections, inspectors, human-readable exports.

Requirement: canonical source IDs/versions and rendering/projection logic must be versioned. The rendered artifact is not business truth unless separately declared as a frozen release artifact.

## 5. Proposed engine families under the three-product architecture

AR0.2/AR0.3 must decide the exact contracts, but the architecture should expect at least these governed engine families where automation is appropriate:

- Source ingestion / source-registry materializer;
- Domain semantic materialization / knowledge-resolution engine;
- effective-version / overlay resolver;
- Enterprise Context / Client Binding resolver;
- Operational Evidence ingestion/normalization engine;
- Operations Intelligence analysis engine;
- Transformation Intelligence opportunity/prioritisation engine;
- future-state candidate/materialization engine;
- Canonical Work Decomposition generator/materializer;
- Canonical WorkDefinition compiler;
- domain/enterprise/runtime readiness resolver;
- Governed Specification manifest generator;
- runtime/tool adapter generators;
- observation/conformance/reconciliation engine;
- public/protected/UI projection generators.

Not every engine must be AI-driven. Prefer deterministic rules/compilers where the business transformation can be expressed deterministically. Use generative assistance for candidate synthesis only where appropriate and always retain validation/promotion controls.

## 6. What must be frozen

The following asset classes are mandatory freeze candidates when they become the governed baseline for a phase, release, decision or downstream consumer.

### F0 — Product and architecture control assets
Freeze:
- Product Constitution/North Star version;
- architecture layer/ownership decision;
- cross-cutting invariants and hard boundaries;
- readiness-state definitions;
- phase-entry/exit governance.

### F1 — Schemas and semantic contracts
Freeze:
- IDs/namespaces and object schemas;
- domain/reference contracts;
- Enterprise Context/Client Binding contracts;
- Operational Evidence contracts;
- Transformation proposal/approval contracts;
- Work Decomposition and WorkDefinition schemas;
- readiness/resolution contracts;
- specification/manifest contracts;
- observation/evidence contracts;
- projection/adapter contracts where used downstream.

### F2 — Generator/engine packages
Freeze for each engine:
- Generator Contract;
- source code/script/compiler/resolver;
- prompts/templates/system instructions if applicable;
- mapping/decision tables;
- model/tool/runtime version identifiers;
- configuration/default parameters;
- dependency lockfile/environment manifest;
- validator/QA rules;
- golden fixtures/test vectors;
- migration logic required to reproduce the output.

### F3 — Authoritative input baselines
Freeze as applicable:
- source registry entries and exact source snapshots/references/hashes;
- source extraction/query/window identity;
- canonical parent model/version;
- client binding/context snapshot;
- raw operational evidence snapshot or immutable query/export identity;
- approved assumptions/decisions used as input.

### F4 — Canonical output baselines
Freeze exact governed outputs after approval:
- Domain Reference/Operational Knowledge versions;
- Enterprise Current-State/Context versions;
- approved future-state/target-state versions;
- Canonical Work Decomposition;
- Canonical WorkDefinitions;
- binding requirements/resolutions;
- readiness state/proof;
- version-closed specification manifests.

### F5 — Decision-significant derived outputs
Freeze when relied upon for an Owner/client decision, implementation handoff or audit:
- Operations Intelligence findings/metrics;
- Transformation Intelligence opportunity/prioritisation outputs;
- future-state comparison/impact assessments;
- capability/loss assessments;
- runtime projection packages.

A disposable UI rendering need not be frozen if it can be regenerated from canonical data and does not itself carry decision-significant information unavailable elsewhere.

### F6 — Physical/runtime recovery assets
Freeze/reference as applicable:
- database schema/migrations;
- release manifest;
- runtime/build dependency manifest;
- deployment configuration excluding secret values;
- secret names/ownership/restore procedure, never plaintext secrets in governance artifacts;
- adapter capability profiles;
- known-good deployment/rollback identity.

### F7 — Proof and custody assets
Freeze:
- QA/independent review evidence;
- hashes/checksums;
- Generation Registry entry;
- Source & Asset Registry entry;
- phase-closure record;
- backup/custody location;
- recovery/rebuild proof result.

## 7. Physical responsibility model

Use logical roles so the architecture is portable, with the current Atlas target implementation mapped as follows:

### GitHub — governed executable/control authority
Primary home for:
- Product/architecture/governance standards;
- schemas/contracts;
- generator/compiler/resolver code;
- prompts/templates/rules/decision tables;
- migrations;
- dependency/build manifests;
- adapter/projection code;
- release manifests and technical registries.

GitHub is not the sole live business-data store merely because the schema/code is canonical there.

### Canonical Structured Knowledge Store — governed structured-state authority
Logical role for queryable/versioned structured Atlas knowledge and state.

Current target implementation: **Supabase/Postgres where appropriate**, subject to AR0.3 schema/security design.

Expected to hold, as the architecture matures, structured versions of reusable domain knowledge, enterprise/protected context, evidence references/normalized evidence, transformation state, execution models and related governed relationships where live/queryable persistence is required.

The logical role is authoritative; Supabase is an implementation choice and can be replaced only through a governed migration without changing semantic contracts.

### Google Drive / immutable custody store — preservation authority
Primary custody for:
- original source files where appropriate;
- frozen release/export packages;
- immutable recovery copies;
- evidence bundles requiring independent preservation.

Drive custody does not supersede the canonical structured/source authority unless explicitly declared for a specific asset class.

### Vercel — presentation/runtime hosting only
Vercel may host UI/API runtime artifacts but is never the canonical knowledge, generator or governance authority.

## 8. Generation Registry record

Every governed generated artifact must have a Generation Registry entry containing at minimum:
- output asset ID/version/hash;
- generator ID/version;
- Generator Contract version;
- exact input asset IDs/versions/hashes;
- parameters/configuration hash;
- dependency/environment identity;
- generation timestamp/run identity;
- validator/QA result;
- promotion/approval state;
- canonical/derived classification;
- custody/backup references;
- rebuild/restore result.

## 9. Freeze and change rule

A frozen asset is immutable.

Any change to a frozen input, schema, engine, prompt, mapping rule, parameter that materially affects output semantics, or canonical output requires:
1. successor version;
2. dependency-impact analysis;
3. regeneration/revalidation of affected downstream artifacts;
4. new hashes/registry entries;
5. closure under the Controlled Phase Execution & Recovery Gate.

Do not overwrite the old baseline.

## 10. Recovery acceptance test

For every high-risk baseline, Atlas must be able to answer and prove:

> **Can a new operator/agent, without the original chat/session, locate the exact authoritative inputs, run or restore the correct versioned engine, validate the result, identify the exact canonical output, and continue from the same governed state?**

If not, the baseline is not safely frozen and the next phase is blocked.
