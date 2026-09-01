# Atlas Canvas V2.0 — v1.1.8 Audit, Decisions & Initial Build

## Baseline audited

- Source package: `supply-chain-operations-intelligence-v1.1.8-final-github(1).zip`
- Package SHA-256: `90abb61637a0ec640c39333f1bbf21ea9d1496b49e1a027c4a7cd0c50504d78e`
- Canonical Road LTL V1.2 JSON SHA-256: `2d5c78d4480bb693747bcb18a2c006b3fe0a63e6150c506e84ea3e4c5f3f6cfd`
- Canonical Page 0 JSON SHA-256: `c8805c194f87cd795014e4a44f362d67c921f5e0e978b9a29014befafc0fbbd0`

The V2 work is additive. The v1.1.8 product surface, APIs, canonical Atlas data and legacy Reference Atlas remain unchanged.

## v1.1.8 audit verdict

### Reuse as-is — underlying logic / product capability

1. **Canonical Atlas data + module loader / data contract** — keep as source of truth.
2. **Governed Page-0 Context Composer + 711 pairwise / 20 cross-axis rules** — keep; expose through a cleaner left rail.
3. **Multiple entry routes** — keep and expand to the frozen set: Mode/Service, Enterprise Process, Operating Model/Actor, Logistics Node, System, Object/Document, Search/Ask/Trace.
4. **Semantic depth model** — keep, but present as `A2 → A3 → A4 → A5 → WorkDefinition` with progressive disclosure.
5. **A5 Inspector** — keep the canonical fields and source/provenance boundary.
6. **Playback / Step / Freeze Time** — keep the deterministic execution engine.
7. **Trace / Follow Object** — keep. This was a strong v1.1.8 capability and is now a first-class V2 control rather than a secondary toolbar action.
8. **Actor / System / Control / Source lenses** — keep the underlying query logic; regroup under a simpler Layers/Lenses model.
9. **Ask Atlas command boundary** — keep: LLM interprets intent; deterministic Atlas/rule engine controls actual state.
10. **Compare / Transform / Client AS-IS / Discovery / Validation / Opportunity / TO-BE / Saved Views** — preserve in the wider product; Canvas V2 changes the visualization surface, not these product capabilities.
11. **Reference Atlas coexistence** — keep. Canvas is not a replacement for Universe/Daughter reference pages.
12. **8-function Vercel architecture and pilot security/privacy controls** — untouched.

### Reuse, but update for Canvas V2.0

1. **Spatial canvas** — retain spatial reasoning but stop using a fixed island map as the only execution representation.
2. **15 territories** — retain as reference/orientation vocabulary, not fixed permanent screen coordinates for every daughter.
3. **Context panel** — convert from coverage/module registry into **Entry + Context**.
4. **Inspector** — keep but make collapsible and tabbed; deep detail appears only at A5/WorkDefinition.
5. **Five signals** — keep as typed relationships/layers, not five dots moving along the same route.
6. **Playback** — convert to one primary playhead on the resolved spine; supporting data/information/control/financial dependencies animate contextually into/out of active work.
7. **Trace** — preserve canonical lineage rules; redraw trace as a contextual thread over the hybrid spine instead of the older free-spatial path only.
8. **Systems mapping** — preserve Page-0 + A5 mapping; make System a first-class analytical entry and layer.
9. **Minimap / orientation** — retain in compact form inside the left rail; do not let it compete with the primary journey.
10. **Semantic zoom controls** — keep as fallback/precision controls; primary interaction is click/double-click/depth navigation without accidental wheel zoom.
11. **WorkDefinition** — add as a registered depth beneath A5 when a governed derived definition exists; never fabricate it for incomplete daughters.

### Scrap from the normal Canvas surface

1. **Five independent moving dots jumping between spatial towers.** This is visually interesting but semantically wrong when flows diverge.
2. **One fixed spatial arrangement serving every entry point.** The spine and adjacent nodes must resolve from entry/context.
3. **Toolbar overload.** Client map, Discovery, Validation, Opportunities, Future State, Findings, Lens, Compose, Trace, Play, etc. should not all compete in Execute.
4. **Coverage registry as the primary left-panel experience.** Coverage is admin/reference information, not the main execution control.
5. **Development/admin residue in normal Canvas** — renderer status, stage implementation labels, data-contract controls and internal release diagnostics.
6. **Permanent A3/A4/A5 labels across the entire universe.** Detail must be semantic-depth driven.
7. **Mode-specific renderer logic / hard-coded coordinates.** Module-specific presentation hints may exist as data/config adapters, but the universal renderer must not contain `if Road LTL ... place here` behavior.
8. **Permanent relationship spiderweb.** Real arrows appear only when they explain current journey, dependency, trace, compare or analysis state.

## Canvas V2.0 frozen visualization architecture implemented

### Left rail — Entry + Context

- Seven entry routes.
- Context refinement.
- Existing rule lattice used for compatibility status.
- Advanced context progressively disclosed.
- Compact orientation map.
- Independently collapsible.

### Center — Universal Hybrid Canvas

- Context-resolved **primary horizontal spine**.
- Spatial adjacent activities around the relevant stage.
- Connected directional arrows only where a governed relationship is being explained.
- Color differentiation by relationship type.
- Main playhead follows the spine.
- A2/A3 remain visually light.
- A4 expands selected workflow.
- A5 exposes exact dependencies + execution contract + work decomposition.
- WorkDefinition depth displays registered derived execution definitions.

### Right rail — Inspector

- Summary
- Execution
- Systems
- Evidence
- WorkDefinition
- Independently collapsible.

### Trace retained and redesigned

- Trace/Follow Object is a primary action.
- Target list is built from Atlas-declared inputs, outputs, documents and authority objects.
- Trace uses only declared touchpoints.
- Non-touchpoint nodes mute.
- Trace remains compatible with semantic depth and the Inspector.
- Upstream/downstream trace shortcuts remain available from a selected task.

## Zero-hardcoding rule

The V2 renderer consumes:

`module knowledge + presentation hints + context/rules + entry intent`

and resolves:

`primary spine + adjacent activities + dependencies + semantic depth + layout`.

Road LTL currently supplies a **presentation-hints sidecar** because the legacy V1.2 data predates the new `semanticZoomLabel / journey grouping` contract. This is deliberately content/configuration, not renderer logic. Future daughters should publish their own presentation metadata through the common daughter contract.

## WorkDefinition integration in this prototype

The build registers the 22 Road LTL derived WorkDefinitions extracted from the lossless v2.3 Domain Warehouse prototype as a protected/admin prototype data source. They remain additive to, and separate from, the canonical Road LTL V1.2 Atlas model.

The Canvas behavior is fail-closed:

- registered WorkDefinition → WorkDefinition depth available;
- no registered WorkDefinition → remain at A5 and explicitly state that deeper execution definition is unavailable.

## Validation performed

### Existing v1.1.8 baseline

`npm run check` — PASS

Validated, among other gates:
- canonical hashes unchanged;
- 22 Road LTL processes / 13 A3 / 39 edges / 22 transitions / 29 sources;
- 71 destination coverage;
- 711 pairwise + 20 cross-axis rules;
- 8/12 Vercel serverless functions;
- pilot security + ephemeral LLM gates.

`npm run browser:features` — PASS

Explicitly re-confirmed:
- Inspector canonical A5 fields;
- Ask Atlas governed context;
- playback + Freeze Time;
- five signal focus;
- canonical object Trace;
- Actor/System/Control/Source lenses;
- Compare / Transform / Client AS-IS / Discovery / Validation / Opportunities / TO-BE / Saved Views;
- zero runtime errors.

### Canvas V2.0

`node canvas-v2/tests/canvas-v2-smoke.mjs` — PASS

Validated:
- 7 entry routes;
- Road LTL A3 hybrid journey;
- A2/A3/A4/A5/WorkDefinition depth controls;
- both side panels independently collapse;
- Trace first-class control;
- A5 contract + work decomposition;
- registered WorkDefinition depth;
- Shipment trace with 7 declared touchpoints;
- zero runtime errors.

## Current build status

**Canvas V2.0 = functional architecture prototype / development surface.**

It is intentionally isolated under `/canvas-v2/` and does not replace the current v1.1.8 `index.html` yet. This allows visual/interaction acceptance before we rebase the full Execute surface and then reconnect Compare/Transform into the new shell.

## Next implementation gates

1. User acceptance of the V2 shell and A2/A3/A5/Trace behavior.
2. Move V2 renderer into a reusable application module rather than the prototype page.
3. Replace the Road-LTL legacy presentation-hints adapter with common daughter presentation metadata in the daughter contract.
4. Connect full v1.1.8 Layers/Lenses into the simplified V2 Layers control.
5. Reconnect Compare and Transform to the V2 canvas without adding toolbar clutter.
6. Run the same renderer against Ocean FCL/LCL when those modules are present at the required verified depth.
7. Freeze Universal Canvas Renderer V2.0 only after Road LTL + Ocean FCL + Ocean LCL behavior regression passes with no daughter-specific renderer branches.

## UX correction after mobile review — 2026-09-01

A real-phone review exposed a regression in the first V2 development surface: the implementation preserved the new resolution logic but visually drifted back toward a dense node/box graph, and the phone could render the desktop three-column shell too literally.

This is treated as an implementation defect, not an architecture change.

Corrections applied:
- mobile/coarse-pointer breakpoint now forces the frozen hybrid theatre rather than squeezing three columns;
- Entry + Context and Inspector become off-canvas drawers on mobile and remain independently collapsible on desktop;
- the central Canvas owns the phone viewport;
- the primary spine remains the dominant orientation device;
- A3/A4 spine nodes use circular theatre-style markers instead of rounded boxes;
- adjacent A3 processes render as spatial satellite/territory shapes rather than ordinary flow boxes;
- dependency arrows remain typed and contextual, not a permanent spiderweb;
- local horizontal scrolling is confined to the Canvas; the page shell no longer intentionally depends on desktop-width rendering;
- playback remains a compact sticky control surface;
- Trace, A5 Inspector, Work Decomposition and WorkDefinition depth are unchanged.

The frozen UX hierarchy remains:

`Entry + Context -> resolved primary spine -> spatial dependencies -> semantic zoom -> A5 / WorkDefinition depth`.

The earlier Option 1 + Option 2 hybrid mockups remain the visual acceptance benchmark. Any future V2 implementation that reverts to a generic box-and-arrow graph is a regression.
