# Canvas V2.0 — Frozen Integration Contract

## Purpose

Canvas V2.0 is the universal hybrid visualization surface for Atlas V2.0.

It accepts governed operational knowledge and context and resolves a presentation model:

`entry + context + verified daughter graph + relationships + semantic depth → spine + spatial dependencies + typed flows + inspector state`

## Inputs owned outside Canvas

Canvas must receive or resolve from the host application:

1. Active entry type and selected entry.
2. Governed Context Composer state and rule results.
3. Active verified module/daughter data.
4. Canonical process/task hierarchy and graph relationships.
5. Actors, systems, objects/documents, evidence and source/provenance references.
6. Playback/execution sequence and transition state.
7. Registered Work Decomposition / WorkDefinition assets when available.
8. Authorization state for protected execution-definition depth.

## Canvas outputs/state

Canvas owns only presentation state:

- resolved primary spine;
- spatial adjacent nodes;
- visible typed dependencies;
- current playhead;
- semantic depth;
- selected node/task;
- trace visualization;
- panel visibility;
- layer visibility.

No Canvas state may mutate canonical Atlas knowledge.

## Entry architecture

Frozen entry routes:

- Mode / Service
- Enterprise Process
- Operating Model / Actor
- Logistics Node
- System
- Object / Document
- Search / Ask / Trace

The primary spine is contextual. It must not be assumed to be a physical shipment flow.

## Context architecture

The left rail hosts Entry + Context. Available context dimensions/options come from governed metadata/rules. Canvas must not hardcode a fixed LTL form.

## Visualization rules

1. One dominant horizontal spine per resolved view.
2. Related activities remain spatially adjacent to the relevant spine stage.
3. Only governed relationships receive semantic arrows.
4. Five flow types are relationship classes, not five equivalent moving journeys.
5. Primary playhead moves on the resolved spine.
6. Supporting dependencies animate only when relevant to the current stage/lens/trace.
7. Spatial continuity should be preserved across small state changes.
8. No permanent spiderweb.
9. No generic BPMN-style box-flow regression in the main Canvas.

## Semantic depth

- A2 / Universe — sparse orientation and major journey/dependency structure.
- A3 / Process — process-level spine and major adjacent dependencies.
- A4 / Workflow — workflow activities and more precise relationships.
- A5 / Task — exact task, systems, objects, inputs/outputs, evidence and decomposition access.
- WorkDefinition — registered governed execution definition only; fail closed if unavailable/unauthorized.

## Trace

Trace is mandatory and first-class. It uses only Atlas-declared creation/authority/consumption/touchpoint relationships. Non-touchpoints mute. Trace does not infer missing lineage.

## Responsive shell

Desktop:
- left Entry + Context rail independently collapsible;
- right Inspector independently collapsible;
- center Canvas owns remaining width.

Mobile:
- Canvas owns the viewport;
- Entry + Context opens as an off-canvas drawer;
- Inspector opens as an off-canvas drawer;
- the application must not compress a desktop three-column layout into phone width.

## Visual benchmark

`visual-reference-approved.png` is the frozen visual benchmark: clean white/light surfaces, restrained blue/teal, high whitespace, circular/theatre journey nodes, subtle spatial territories, limited cards, and color used primarily for semantic state/flow.

## Non-negotiable zero-rebuild rule

New daughters may publish new metadata, rules, relationship vocabulary and presentation hints through common contracts. They must not require daughter-specific renderer branches or bespoke Canvas rebuilds.

## Go-live integration gate

After this asset is plugged into Atlas V2.0, run full host regression for:

- canonical asset hash parity;
- Context Composer rules;
- all entry routes;
- Trace;
- A2→WorkDefinition depth;
- Playback/Freeze/Step;
- Inspector;
- Systems/Objects/Actors/Evidence lenses;
- Compare and Transform integration;
- authorization/public-vs-protected boundary;
- desktop/mobile;
- zero runtime errors.

The Canvas asset is frozen; failures at this stage are integration defects, not reasons to redesign the Canvas architecture.
