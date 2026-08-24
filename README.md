# Supply Chain Operations Intelligence Platform — Pilot V1.0

A single cumulative GitHub/Vercel project that consolidates the governed Supply Chain Atlas and the complete pilot workbench.

## Technical lineage

| Layer | Version carried into Pilot V1.0 |
|---|---|
| Atlas product / integrated release | **V6.2.3** |
| Frozen canonical Page 0 | **V6.2.2** |
| First production-grade child module | **Road LTL V1.2** |
| Intelligence baseline | **v0.6.6** |
| Platform evolution | **Stage 23 V1** |
| Consolidated product release | **Pilot V1.0** |

V6.2.3 is the product/release lineage; Page 0 V6.2.2 remains the deliberately frozen canonical foundation inside it. The exact frozen Page-0 and integrated Road-LTL HTML sources are preserved under `reference/source/` with their known hashes.

## What is included

### Governed reference foundation
- Page 0 V6.2.2 source architecture and extracted machine-readable Page-0 data.
- Road LTL V1.2 with 22 governed process/task records, 13 A3 parents, 39 process-flow relationships, 22 execution transitions, 27 enterprise lenses, 29 evidence sources and 10 reference configurations.
- V6.2.3 release lineage metadata and constitutional guardrails.
- Enterprise Core Ontology + Supply Chain domain pack + domain extension contracts.
- Rule/overlay registries, evidence contract, command contract and version policy.

### Intelligence v0.6.6 retained in the cumulative experience
- adaptive information density and context ribbon;
- deterministic reference-execution simulation;
- Play/Pause/Previous/Next/Freeze and speed control;
- Physical / Information / Data-Document / Financial / Control-Evidence signals;
- A5 Step Inspector and source evidence;
- trace / lineage;
- exception/recovery boundary;
- grounded Ask Atlas with deterministic command validation and no LLM path selection.

### Stage 23 V1 cumulative platform
- persistent operational canvas with semantic levels: Universe → Context → Execution → Inspect;
- Explore / Execute / Compare / Transform;
- data-driven module registry and depth-aware feature availability;
- domain-neutral core and non-SCM Accounts-Payable architecture fixture;
- deterministic transformation signals, findings, opportunities and future-state work;
- Reference ↔ Client mapping boundaries;
- investigation collections, Executive Summary, Presentation Mode and Transformation Pack export;
- authenticated Supabase workspace architecture and RLS migrations;
- session-ephemeral document intelligence;
- Admin/Pilot governance separation and foundation proposal workflow;
- collaboration/review and privacy-bounded telemetry;
- pilot evaluation corpus/harness;
- Stable/Lab packaging, health/readiness/version/integrity APIs and release runbooks.

## Critical epistemic rules

1. **Agents may reason over the Atlas; agents may not redefine the Atlas.**
2. Atlas Reference, Client Confirmed, Observed/Inferred, Unknown and Transformation Hypothesis remain distinct.
3. A difference from Atlas Reference is **not automatically a gap**.
4. No probability, severity, SLA impact, ROI, savings or financial loss is generated without evidence.
5. If a module is not published to the requested depth, Ask Atlas and Compare must refuse to fabricate deeper execution knowledge.
6. LLM output is never the state-machine or security boundary.

## Pilot privacy mode

Uploaded documents are processed in **SESSION-EPHEMERAL DOCUMENT MODE**:

`upload → parse in memory → structure/map → deterministic Atlas validation → current-session use → discard source/chunks/vectors`

The application does not write the raw source, parsed text, chunks or embeddings into canonical Atlas storage. Only an explicitly user-confirmed **normalized client fact** may be persisted to an authenticated workspace, and the current confirmed-fact schema intentionally omits the raw document, quote and locator.

A browser cannot guarantee a server callback when a device/app is killed. For any future server-side session cache, use a short server-enforced TTL in addition to best-effort explicit cleanup. Confirm the selected LLM provider's contractual/API retention controls before testing real confidential material.

## Local preview

The front-end is self-contained and can be served by any static HTTP server:

```bash
python -m http.server 8080
# open http://localhost:8080
```

Or:

```bash
npm run dev
```

Local preview uses browser-local work state and is for synthetic/non-confidential testing only.

## Vercel + Supabase deployment

1. Upload this folder **at repository root** to GitHub.
2. Create/connect the Vercel project to that repository.
3. Use Node **24.x**.
4. Create a Supabase project and apply migrations in `migrations/`.
5. Configure Vercel environment variables from `.env.example`.
6. Deploy **Lab** first.
7. Run `/api/health`, `/api/readiness`, `/api/release-integrity` and the pilot smoke/evaluation checks.
8. If an LLM is enabled, complete a live synthetic provider certification before confidential-document testing.
9. Promote the exact tested artifact to Stable.

## LLM configuration

The server supports `gemini`, `openai`, `anthropic`, or `none`. Secrets never enter the browser bundle.

```text
ATLAS_LLM_PROVIDER=gemini
ATLAS_LLM_MODEL=<approved Gemini model>
ATLAS_LLM_API_KEY=<server-side secret>
```

The provider interprets/structures/explains. Deterministic Atlas code validates process IDs, trace targets and canvas commands.

## Tests

```bash
npm test
npm run reaudit
npm run build
```

`npm run build` is a deterministic project validation step for this static + Vercel Functions architecture. It does not mutate the frozen Atlas sources.

## Exact frozen-source integrity

Expected SHA-256:

```text
Page 0 V6.2.2 frozen original
47a111bd72f8524ee1c1f2d67b85d6958156c5f1026659e9769f1c6a28639002

Page 0 V6.2.2 + Road LTL V1.2 integrated original
70850a00baac10253d263e41465ab80fe3a0e4c269e6d06391e6a4f333af2747
```

## Release note about consolidation

This is a **new consolidated Pilot V1.0 project folder** built from the exact recovered frozen source artifacts plus the Stage-23 functional/release contracts. The previous historical Stage-23 ZIP is not byte-for-byte reproduced; its capabilities and project structure were used as the cumulative release contract, while this package has a cleaner unified runtime under `assets/app.js`.
