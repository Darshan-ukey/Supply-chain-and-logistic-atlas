# Atlas Canvas V2.0 — Frozen Integration Asset

Status: **FROZEN FOR ATLAS V2.0 INTEGRATION**

This folder is the frozen Canvas presentation/rendering asset to be plugged into the wider Atlas V2.0 application. It is additive to the certified v1.1.8 foundation and does not redefine canonical Atlas knowledge.

## Primary runtime files

- `index.html` — repository-integrated Canvas V2.0 surface.
- `assets/canvas-v2.css` — frozen responsive visual system.
- `assets/canvas-v2.js` — frozen hybrid Canvas renderer/interactions.
- `data/road-ltl-canvas-presentation-v2.json` — Road LTL presentation metadata adapter.
- `data/road-ltl-workdefinitions-v2.3.json` — registered derived WorkDefinition proof data for Road LTL.

## Portable review

- `preview-standalone.html` — self-contained functional preview.
- `visual-reference-approved.png` — approved visual benchmark for the V2.0 shell.
- `review/mobile-reference-approved.png` — approved mobile interaction reference.

## Frozen behavior

- Entry + Context left rail; independently collapsible.
- Dynamic primary horizontal spine resolved from entry/context.
- Spatial adjacent activities/dependencies around the spine.
- Typed Physical / Information / Data-Object / Financial / Control-Evidence relationships.
- Contextual arrows only when a governed relationship is being explained.
- Trace / Follow Object is first-class.
- Semantic depth: A2 → A3 → A4 → A5 → WorkDefinition.
- Work Decomposition appears at A5/deeper depth, not globally.
- Inspector right rail; independently collapsible.
- Mobile uses Canvas-first layout with side panels as drawers.
- No five independent moving dots and no permanent relationship spiderweb.
- No daughter-specific placement logic inside the renderer.

## Integration boundary

Canvas V2.0 consumes governed Atlas/module/context data and renders it. It does not become the knowledge source of truth. Canonical Universe/daughter assets, rule engine, context composer, security boundaries, Compare, Transform and Ask Atlas remain owned by the surrounding Atlas application.

## Verification

The frozen donor was tested against the complete v1.1.8 + Canvas V2.0 repository:

- `node canvas-v2/tests/canvas-v2-smoke.mjs` — PASS
- `npm run check` — PASS
- zero Canvas runtime errors in the smoke suite
- canonical Page 0 / Road LTL / Enterprise Core / Supply Chain Domain Pack hashes unchanged

See `FREEZE_CERTIFICATE.md`, `CANVAS_V2_0_INTEGRATION_CONTRACT.md`, and `SHA256SUMS.txt`.
