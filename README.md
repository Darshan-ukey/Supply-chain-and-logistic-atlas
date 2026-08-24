# Supply Chain Operations Intelligence — Road LTL + Foundation Hardening v1.1

A cumulative GitHub/Vercel project carrying the governed Atlas V6.2.3 foundation, Road LTL V1.2, Atlas Intelligence v0.6.6, the Stage-23 workbench, and the backward-compatible Foundation Hardening v1.1 layer for scaling additional modes and domains.

## Technical lineage

| Layer | Version |
|---|---|
| Atlas product / integrated release | **V6.2.3** |
| Frozen canonical Page 0 | **V6.2.2** |
| First A5-verified child module | **Road LTL V1.2** |
| Intelligence baseline | **v0.6.6** |
| Product/workbench baseline | **Stage 23 V1** |
| Foundation hardening | **v1.1** |

V6.2.3 remains the product/release lineage. Page 0 V6.2.2 and Road LTL V1.2 are deliberately preserved as canonical inputs. Foundation Hardening v1.1 strengthens the contracts and registries around them; it does **not** rewrite the frozen knowledge.

## What Foundation Hardening v1.1 adds

- unified **Source Registry**, source-version register, source-change register, Source→Atlas coverage register and gap register;
- six-month routine source-review policy, with earlier review on material framework releases;
- resolved catalogue of the **185 Page-0 reference placements across 17 authority domains** plus all module-specific Road-LTL sources;
- **Atlas Data Contract v1.1**, which requires the full A5 execution contract for an `A5_VERIFIED` publication;
- formal process-flow, ontology-execution, object/data and system-exchange relationship vocabularies;
- cross-module canonical process-concept alignment for meaningful LTL/FTL/Ocean comparisons;
- registry-driven Ask Atlas, command validation and session-document mapping rather than a hard-coded Road-LTL module path;
- fail-closed module validation/publication CLI with explicit admin approval;
- generic rule/overlay registration and evaluation layer;
- first-class contracts for execution instances/legs, document/legal state, temporal constraints, KPI/measurement and system exchanges;
- conservative Road-LTL sidecars for field-level provenance, structured timing migration and system-exchange migration without changing Road LTL itself;
- authoritative **Page-0 destination coverage registry** derived from the 71-entry governed universe; it is a roadmap/depth registry, not a claim of delivered execution coverage;
- **synthetic engine scale smoke** across 71 registry entries / 2,130 uniform synthetic processes; this validates generic-engine scale/performance only, not real-domain readiness.

See `FOUNDATION_HARDENING_V1.1.md` and the before/after audit files for the exact closure record.

## Current validation priority

Foundation breadth is now **frozen pending product evidence**. Do not add architecture merely to support unbuilt domains. The next priority sequence is:

1. exact deployed-environment / Vercel E2E certification;
2. live LLM synthetic certification with approved provider settings;
3. realistic non-confidential RFP/SOP engagement test across upload → extraction → mapping → findings → opportunity → TO-BE → export;
4. controlled team usage and feedback.

Architecture changes should now be driven by defects or evidence from these tests.

## Governed reference foundation

- Page 0 V6.2.2 source architecture and extracted machine-readable Page-0 data.
- Road LTL V1.2 with 22 governed process/task records, 13 A3 parents, 39 process-flow relationships, 22 execution transitions, 27 enterprise lenses, 29 evidence sources and 10 reference configurations.
- Enterprise Core Ontology + Supply Chain domain pack + domain extension contracts.
- Rule/overlay registries, evidence contract, command contract and version policy.
- Source/version/coverage/gap governance and module publication controls.

## Product capabilities retained

- persistent operational canvas with Universe → Context → Execution → Inspect;
- Explore / Execute / Compare / Transform and persistent Ask Atlas;
- semantic zoom, deterministic execution playback, Freeze Time and five synchronized signals;
- A5 Inspector, Trace/lineage and actor/system/source lenses;
- deterministic transformation signals, findings, opportunities and future-state work;
- Client Mapping, document intelligence, investigation collections, Executive Summary, Presentation Mode and Transformation Pack exports;
- authenticated Supabase workspace architecture, collaboration/review and privacy-bounded telemetry;
- Admin/user governance separation and foundation proposal workflow;
- session-ephemeral document mode;
- Stable/Lab packaging, health/readiness/version/integrity APIs and release runbooks.

## Critical epistemic rules

1. **Agents may reason over the Atlas; agents may not redefine the Atlas.**
2. Atlas Reference, Client Confirmed, Observed/Inferred, Unknown and Transformation Hypothesis remain distinct.
3. A difference from Atlas Reference is **not automatically a gap**.
4. No probability, severity, SLA impact, ROI, savings or financial loss is generated without evidence.
5. If a module is not published to the requested depth, Ask Atlas and Compare must refuse to fabricate deeper execution knowledge.
6. LLM output is never the state-machine or security boundary.
7. A module cannot become `A5_VERIFIED` unless the stronger v1.1 publication validator passes and the canonical process-concept alignment exists.

## Source governance

The new source governance layer deliberately separates the exhaustive source repository from Page 0:

`Authoritative Sources → Source Registry / Native Reference Registry → Coverage & Gap Registers → Curated Page 0 / Domain Modules`

The machinery is complete, but the **source-by-source native concept extraction program remains a governed research activity**. It is not falsely marked complete. Candidate additions currently in the gap register (CTU Code, IMO Compendium and EU eFTI) remain `RESEARCH_REQUIRED` until issuer-level review and approval.

## Session-ephemeral document mode

Uploaded documents are processed as:

`upload → parse in memory → structure/map → deterministic Atlas validation → current-session use → discard source/chunks/vectors`

The application does not write raw source, parsed text, chunks or embeddings into canonical Atlas storage. Only an explicitly user-confirmed normalized client fact may be persisted to an authenticated workspace, under the existing controlled-workspace rules.

## Local preview

```bash
python -m http.server 8080
# open http://localhost:8080
```

or:

```bash
npm run dev
```

Local preview is for synthetic/non-confidential testing.

## Module validation/publication

Validate a candidate module:

```bash
npm run atlas:validate-module -- path/to/module.json A5_VERIFIED module-id
```

Publication is fail-closed. Without explicit approval it validates but does not publish:

```bash
npm run atlas:publish-module -- path/to/module.json module-id "Module Label" 1.0 A5_VERIFIED
```

Approved publication additionally requires:

```text
ATLAS_ADMIN_APPROVAL=1
```

## Source governance audit

```bash
node scripts/source-governance-audit.mjs
```

This surfaces due reviews and open source/coverage gaps. Routine review cadence is six months or earlier for a material source release.

## Tests

```bash
npm test
npm run foundation:test
npm run build
npm run reaudit
npm run release:smoke
npm run pilot:eval:offline
```

`npm run build` is a deterministic validation step for this static + Vercel Functions architecture. It does not mutate the frozen Atlas sources.

## Exact frozen-source integrity

Expected SHA-256:

```text
Page 0 V6.2.2 frozen original
47a111bd72f8524ee1c1f2d67b85d6958156c5f1026659e9769f1c6a28639002

Page 0 V6.2.2 + Road LTL V1.2 integrated original
70850a00baac10253d263e41465ab80fe3a0e4c269e6d06391e6a4f333af2747

Machine-readable Page 0 V6.2.2
69872e9893703c6b1ad0c1b63b0dd5a58dc55351f1b4fdcf16e609f0366cb44d

Machine-readable Road LTL V1.2
ee1feea86c800d038c0f8836b729484cdc7d3ff18af5f6e2fcb84fce29ade209
```

## Deployment

1. Upload the complete repository root to GitHub.
2. Connect Vercel to that repository and use Node **24.x**.
3. Apply Supabase migrations and environment variables from `.env.example`.
4. Deploy/test the **Lab** candidate first.
5. Run health/readiness/integrity plus the full test and evaluation suites.
6. If an LLM is enabled, complete the live synthetic provider certification.
7. Promote the exact tested artifact to Stable.

External/deferred gates remain documented in `release/`: deployed Vercel E2E, provider certification when enabled, dependency lockfile generation with registry access, and isolated restore/PITR rehearsal before any future persistent confidential-data posture that requires it.

## GitHub deployment-source package

This repository package is intentionally trimmed for direct GitHub/Vercel deployment. Generated release snapshots (`release/packages/lab` and `release/packages/stable`), standalone previews, historical audit artifacts, offline pilot corpora, release-build tooling, and internal documentation are excluded because they are not required by the deployed runtime.

The package retains the complete application/API/data/governance runtime, the canonical originals required by the live integrity endpoint, and minimal `npm test` / `npm run build` regression gates. Road LTL V1.2 remains the only A5-verified execution module in this release.

## Vercel Hobby deployment compatibility · v1.1.2

The public `/api/*` contract is preserved, but all API endpoints are dispatched through one `api/router.js` Vercel Function. Handler modules live under `server/api/` and are bundled into that single function. This keeps the deployment below the Hobby plan's Serverless Function-count limit without changing frontend API URLs or canonical Atlas data.
