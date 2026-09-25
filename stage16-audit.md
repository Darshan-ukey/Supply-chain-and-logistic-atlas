# Stage 16 — Rule + Overlay + Version Governance

**Static/build status: PASS**

## What Stage 16 adds
- Shared deterministic rule service over declared A5 applicability and `processFlowEdges`.
- 39 declared relationship rules registered from Road LTL V1.2.
- 59 module-scoped overlay records normalized from existing declared context options.
- No cross-module overlay reuse is claimed yet; the registry has the structure but keeps `crossModuleReusable=false` until a second real module validates reuse.
- Saved-work version pinning across Page 0, Data Contract, module version/hash and active overlays.
- No-silent-mutation behavior on version mismatch.
- Knowledge-gap queue for unvalidated / `RESEARCH_REQUIRED` interactions.
- Governance/Admin UI remains outside normal product chrome (`?admin=1` or Ctrl+Alt+G).

## Canonical regression
- Destinations: 71
- Page-0 domains: 15
- Road-LTL A3 parents: 13
- A5 tasks: 22
- Process relationships: 39
- Execution transitions: 22
- Sources: 29

No canonical object was edited. Runtime assets were extracted unchanged from the Stage 15.2 standalone inline store.

## Important limitation / correct guardrail
The current overlay registry is **structurally reusable but empirically validated against only Road LTL**. Stage 16 does not claim that Hazmat, jurisdiction, role, movement-pattern or other overlays automatically apply to future modes. Cross-module reuse is promoted only after another governed module proves the relationship.

## Runtime validation note
This container's Chromium is organization-blocked from localhost, file, and data URLs, so a fresh interactive browser regression cannot be executed here. The build preserves the Stage 15.2 browser-validated UI baseline and adds `AtlasPerf151` so the deployed/Lab runtime can collect the performance baseline directly. JavaScript syntax and governance-contract checks are run locally.
