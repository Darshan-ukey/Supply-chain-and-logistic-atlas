# Atlas Daughter Module Production Standard V1

## Purpose
Create and maintain ~71 Atlas destinations with one quality system. A daughter is governed content, not a bespoke application. The Universal Daughter Renderer and Canvas are stable consumers of governed module data.

## Non-negotiable architecture

Universe V7.3 (frozen parent)
→ inside-out inheritance
→ outside-in authoritative domain research
→ daughter module package
→ automated quality gates
→ Universal Daughter Renderer
→ Canvas / Ask Atlas / Trace / Compare / WorkDefinition

A daughter may extend the parent but must not silently mutate it. Generic gaps found during daughter research become Universe change candidates. Daughter-specific knowledge remains in the daughter.

## Canonical package per daughter

Each published daughter must provide:

1. `manifest` — identity, semantic version, parent Universe version, publication depth/status, domain pack.
2. `model` — A3 parents, A4 workflows, A5 execution contracts, graph, ontology, objects/events/documents/systems.
3. `rulePack` — eligibility, compatibility, dependency, branch/bypass/recovery, source activation and overlay rules. No module-specific rules may be hard-coded into the renderer.
4. `contextProfile` — supported role, movement, node, jurisdiction, regime, condition, contract and domain axes.
5. `referenceConfigurations` — curated examples; configurations are not copied scenarios.
6. `uiProfile` — hero metadata, short labels, semantic-zoom labels, display ordering and optional presentation hints. No business semantics belong here.
7. `sourceDelta` — daughter sources plus references to inherited Universe sources, claim boundaries and provenance.
8. `validation` — machine-generated reports from every publication gate.

## Universal daughter experience

Every A5-verified daughter uses the same renderer and same interaction contract:

1. Global view switcher: **Canvas | Universe | Daughter**.
2. Breadcrumb/context strip.
3. Consumption-first Overview.
4. Compose Context.
5. Execution Graph.
6. Reference Configurations.
7. Enterprise / dependency lenses.
8. Systems, objects, documents and control projections.
9. Sources / evidence as a deep view, not front-page framing.
10. A5 Inspector with progressive disclosure.
11. Search, reset, deep-link and open-in-Canvas actions.
12. Desktop and mobile parity.

## Design system derived from Road LTL V1.2

Core tokens remain platform-wide:
- ink `#102f3c`
- muted `#5d737b`
- paper `#f2f6f5`
- card `#ffffff`
- line `#cbd9da`
- navy `#0b2f40`
- teal `#087d8f`
- cyan `#62d0dd`
- semantic success / warning / error / conditional treatments remain consistent.

Required design principles:
- consumption first; methodology later;
- one strong hero, not a wall of governance text;
- stable navigation positions across daughters;
- progressive disclosure rather than long static card dumps;
- same context-state vocabulary (`ENABLED`, `CONDITIONAL`, `LOCKED`, `INCOMPATIBLE`, `RESEARCH_REQUIRED`);
- same graph disposition vocabulary (`ACTIVE`, `AVAILABLE`, `BYPASSED`, `BLOCKED`, `INCOMPATIBLE`);
- same evidence/provenance badges;
- evidence is always available but does not dominate the first screen;
- no domain may invent its own visual grammar.

## Data-quality gates

### P0 — semantic/inheritance gates (hard fail)
- Parent Universe version declared.
- No unknown/duplicate canonical IDs.
- All A3 parent references valid.
- All graph endpoints valid.
- All source IDs valid.
- Every A5 contract contains trigger, state-before, event, decision, rule, control, clock, action, evidence, state-after and outcome.
- Every A5 has at least one participant and at least one source.
- Every execution transition maps to an existing process.
- Applicability object present and structurally valid.
- Existing verified daughter semantics remain regression-identical unless an approved change exists.

### P1 — richness gates (A5 VERIFIED publication blocker unless explicitly not applicable)
- Responsibilities are structured; generic placeholder prose is not accepted as task resolution.
- Document relevance is explicit for every task: linked documents or `NONE/NOT_APPLICABLE` with reason.
- Event relevance is explicit.
- System producer/authority/consumer semantics are explicit or deliberately `NOT_APPLICABLE`.
- Upstream/downstream lineage is structured from graph/object relationships rather than repeated generic prose.
- Temporal constraints are structured where known; unknown exact values remain unknown.
- Claim-level provenance is available for derived/synthesized assertions.
- Cross-module semantic concept IDs exist where equivalence/specialization is intended.
- Enterprise-lens coverage is audited; no arbitrary minimum count is imposed.

### P1 — composer/rule gates
- Module rules are declarative data, not renderer code.
- Invalid combinations fail closed.
- Conditional choices expose reason/prerequisite.
- Standard / permitted variant / exception / invalid path are distinguishable.
- Reference configurations run through the same rule engine as ad-hoc configurations.

### P1 — Canvas readiness gates
Every A4/A5 record must expose enough machine-readable metadata for Canvas without special-case code:
- stable canonical ID;
- A3 parent/territory;
- phase/order;
- `shortLabel` and `semanticZoomLabel` presentation metadata;
- path type;
- graph relationships;
- applicability;
- actors/responsibilities;
- objects/documents/events;
- systems/exchanges;
- control/evidence;
- source/provenance;
- confidence;
- optional visual hint only (never hard-coded process logic).

### P1 — UX/browser gates
- Same top-level sections and component hierarchy for every A5-verified daughter.
- No horizontal overflow at 390px and 1440px.
- No header/switcher overlap.
- Keyboard-accessible navigation and Inspector.
- Search, reset, context state and deep-link work.
- Sources are not front-loaded ahead of operating views.
- Long evidence/methodology text uses progressive disclosure.
- Browser runtime errors = 0.

## Three-stage audit for every daughter

### BEFORE BUILD
- Freeze parent hashes/version.
- Compare parent coverage against authoritative domain sources.
- Identify daughter-specific vs parent-level gaps.
- Capture current renderer and existing-module regression baseline.

### DURING BUILD
- Run schema, IDs, graph, source, applicability and placeholder checks continuously.
- Maintain Universe candidate queue separately.
- Maintain changed-file classification.
- Prevent renderer-specific domain code.
- Compare UI against benchmark daughter at every milestone.

### AFTER BUILD
- Outside-in completeness audit.
- Cross-module semantic alignment.
- Parent regression across every already-ACTIVE daughter.
- Browser desktop/mobile audit.
- Canvas resolver parity audit.
- Ask/Trace/Compare readiness audit.
- Freeze hashes and publication report.

## Versioning rule
- Renderer/UI improvement alone → renderer version changes; daughter semantic version does not.
- Derived structural metadata added without changing domain meaning → contract/profile version changes; semantic version may remain.
- New/corrected source-backed domain semantics → daughter semantic version increments.
- Parent generic correction → Universe version increments and all ACTIVE daughters revalidate.

## Publication status
`PLANNED → DRAFT → SOURCE_MAPPED → STRUCTURALLY_VALIDATED → SOURCE_VERIFIED → APPROVED → ACTIVE/A5_VERIFIED`.

A5_VERIFIED means semantic depth + quality gates + renderer/browser + Canvas readiness, not merely passing a minimal JSON schema.
