# Supply Chain & Logistics Process Atlas V6.2.3 + Atlas Intelligence v0.6.6

Complete GitHub/Vercel replacement folder for the governed Atlas runtime.

## Frozen foundation
This release does **not** change Atlas V6.2.3 content, frozen Page 0 V6.2.2, Road LTL V1.2, the extracted Road LTL model, or the V6.2.3 Constitution. v0.6.6 is a runtime presentation, simulation and explanation release.

`/api/integrity` proves:
- frozen Page 0 V6.2.2 hash;
- frozen integrated V6.2.2 + Road LTL V1.2 hash;
- deployed V6.2.3 guide hash;
- Road LTL V1.2 model hash;
- Constitution V6.2.3 hash;
- stripping the additive V6.2.3 guide block reproduces the original integrated V6.2.2 bytes.

## v0.6.6 additions
### Adaptive Information Density
- **Work / Learn** modes.
- Source-native reference models, directional crosswalk and planned execution universe collapse in Work mode.
- Full governed content remains in the DOM and can be expanded at any time.
- **Active Context Ribbon** replaces repeated selector detail after the user chooses `Apply & collapse context`.
- `Edit context` restores Page 0 selectors.
- Display preferences persist locally and never become Atlas governance data.
- Contextual `ⓘ` help uses the same V6.2.3 Constitution as the chatbot.

### Simulation Studio — Reference Execution Digital Twin
- Full main-workspace simulator; chat remains a collapsible side drawer.
- Deterministic 13-step STANDARD Road LTL PRECEDES spine derived from the governed graph.
- Play, pause, previous, next, reset, timeline position and playback speed.
- Process / Actor / System / Node swimlane views. Node lanes are explicitly labeled as **applicability context**, not live shipment location.
- Physical, Information, Financial, Controls and Evidence execution threads with repeated semantic playback animation and reduced-motion support.
- Step Inspector, all 39 governed Handoff relationships, Data Exchange Registry, Risk & Control view, Systems & Actors view, Reference ↔ AS-IS ↔ TO-BE comparison.
- Explicit exception injection and recovery selection. When multiple recovery routes exist, the simulator refuses to choose one automatically.
- Simulation playback is client-side and consumes no LLM tokens.

### Handoff / data guardrails
- Canonical objects are shown only when explicitly modeled.
- Identifiers are shown only when explicitly present in Road LTL records.
- If field-level payload data is absent, it remains `NOT_MODELED`; no EDI/API payload is invented.
- Handoffs expose actor, systems, state, custody, data/object continuity, evidence, controls, financial context, risk signals and provenance.

### Risk guardrails
- Risk signals carry provenance such as `ATLAS-DERIVED HYPOTHESIS` or `CLIENT-EVIDENCED`.
- No probability, severity, SLA impact, monetary impact or expected loss is generated without evidence.
- A difference from Atlas Reference is **not automatically a gap**.

### Chat refinement
- Query Trust Gate is separate from Evidence Intake Trust Gate.
- `explain the page`, `explain the page in short`, current-step, next-step, handoff, data-exchange and risk questions are explicit intents.
- Page-summary requests can no longer resolve to an arbitrary high-scoring Atlas term.
- Chat receives current simulation state when Simulation Studio is open.
- UI actions pass through a strict allowlist and valid-process/valid-edge validator.
- Gemini may explain grounded state but cannot select simulation paths, applicability, branches or recovery routes.

## Tests
```bash
npm test
npm run reaudit
npm run build
```

- `npm test`: 18 regression/governance suites.
- `npm run reaudit`: independent Stage‑6 finished-package audit.
- `npm run build`: mandatory final Next.js production compile.

The build environment used to assemble this package has no DNS access to `registry.npmjs.org`, so the local Next.js compile cannot be truthfully marked passed here. Vercel must pass `npm install` + `npm run build` before production promotion.

## GitHub / Vercel
Place this folder's contents at the repository root. `package.json`, `app/`, `public/`, `lib/`, `data/`, `frozen/`, `tests/`, `docs/`, `supabase/` and `vercel.json` all belong at root.

Existing server-side Gemini variables remain:
```text
LLM_PROVIDER=gemini
LLM_MODEL=gemini-2.5-flash
GEMINI_API_KEY=<server-side secret>
```
Never commit `.env` or real API keys.

See:
- `docs/V0.6.6_BUILD_CONTRACT.md`
- `docs/V0.6.6_GUARDRAILS.md`
- `docs/V0.6.6_POSTBUILD_AUDIT.md`
- `docs/V0.6.6_STAGE6_REAUDIT.md`
- `docs/V0.6.6_VERCEL_ACCEPTANCE.md`
