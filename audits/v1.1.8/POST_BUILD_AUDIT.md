# v1.1.8 Post-Build Audit

## Verdict

**PASS — locally release-certified candidate.** No production/live deployment was touched.

v1.1.8 is built from the exact certified v1.1.7 final GitHub master and implements the agreed governed-composition changes without modifying canonical Page 0 or Road LTL knowledge.

## Baseline

- Golden release: v1.1.7 final GitHub master
- Golden file count: 637
- Golden ZIP SHA-256: `a2e64c9e89f9739c3a2fc47556566d7fbc39c8f1afb70eace8bc9d2c86a7d5f5`
- Pre-build `npm run check`: PASS

## Core-tree byte diff (generated `release/packages/` excluded)

- v1.1.7 core files: 372
- v1.1.8 core files at audit: 402
- Existing files byte-identical: 364
- Existing files intentionally changed: 8
- Additive files: 30
- Removed files: **0**

Intentional existing-file changes:
1. `.env.example` — v1.1.8 release identity/configuration.
2. `README.md` — v1.1.8 release documentation.
3. `index.html` — additive v1.1.8 sidecar wiring / release identity; spatial engine preserved.
4. `lib/api/release-integrity.js` — v1.1.8 integrity baseline.
5. `package.json` — v1.1.8 scripts/release gates.
6. `preview-standalone.html` — self-contained certification preview synchronized with v1.1.8 runtime.
7. `release/release-meta.js` — v1.1.8 release identity.
8. `stage18-client.js` — explicit Ask Atlas integration with governed v1.1.8 composition state and command routing.

Stage 17, 19, 20, 21 and `legacy-reference-client.js` remain byte-identical to v1.1.7.

## Protected canonical hashes

- Page 0 JSON: `c8805c194f87cd795014e4a44f362d67c921f5e0e978b9a29014befafc0fbbd0`
- Road LTL V1.2 JSON: `2d5c78d4480bb693747bcb18a2c006b3fe0a63e6150c506e84ea3e4c5f3f6cfd`
- Enterprise Core: `43cb2e69b7b4203ad8418394f3aa7050b55fa06a11939bf0909c24a494438b9c`
- Supply Chain Domain Pack: `e2fb5a9eeb5c6906c3e5fd2fcf1f29d9b3e7e1a450f7346d163234cf978acab7`

## v1.1.8 functionality certified

### Governed composition
- 711 pairwise rules + 20 cross-axis rules.
- Four primary canvas entry routes.
- Full 71-destination Page-0 universe.
- 27 enterprise lenses + 9 executive cycles remain analytical-only.
- Invalid options cannot mutate state and retain reasons.
- Road LTL Shipper/BCO + Direct Shipment proves the new separate Execution Role/Perspective refinement.
- Customs Broker example proves the canvas narrows to 1 Active / 4 Conditional / 17 Quiet A5 tasks.
- Ocean FCL remains reference-only; Drayage requires Road supporting leg; no Ocean A5 is fabricated.

### Graph/canvas correctness
- Road LTL graph checks validate canonical nodes, A3 parents, source provenance, active canonical edges and active-only playback sequence.
- Active canvas semantic states are compared against resolver expectation.
- Enterprise lens/cycle changes emphasis only, not execution topology.

### Inspector
- Selected A5 Inspector fields are compared directly with the canonical Road LTL process object.
- Execution contract, responsibility, inputs/outputs, system authority/consumers and source IDs pass exact rendered-content checks.
- v1.1.8 governed composed context is additive.
- Freeze Time and canonical object Trace Inspector modes also pass.

### Ask Atlas
- Browser state includes `page0Composition` + `entryState`.
- Validated context commands route through `AtlasPage0Composer24.applyContextOption`.
- Grounded Road LTL API response returns citations in deterministic fallback.
- Ocean FCL coverage guardrail refuses unpublished A4/A5 synthesis.
- Dangerous Goods request produces a governed condition command.
- Provider remains server-side; Gemini `store:false` retained.

### v1.1.7 feature regression
- Playback / pause / step / Freeze Time PASS.
- Five synchronized signals + signal following PASS.
- Trace PASS.
- Actor/System/Control/Source lenses PASS.
- Compare PASS.
- Transform/findings PASS.
- Client AS-IS separation PASS.
- Discovery/validation/opportunity/TO-BE PASS.
- Saved Views now capture/restore governed v1.1.8 context PASS.
- Stage17/19/20/21 supporting runtimes present/callable PASS.
- Desktop/mobile zero runtime errors and zero horizontal overflow PASS.

### Reference/navigation parity
- Page 0 V6.2.3 nav PASS desktop/mobile.
- Road LTL V1.2 nav PASS desktop/mobile.
- Semantic zoom Universe → focused A3 → scoped A4 → A5 PASS desktop/mobile.
- 15 territories / no boxed renderer / ambient mesh / minimap retained.

## Release architecture

- Vercel function count: 8
- Public API paths: 28
- Critical integrity baseline: 37 files
- Road LTL V1.2 remains the only A5-verified execution module.
- Other modes/domains remain depth-aware reference coverage only.

## External gates not claimed

This audit is **local release certification**, not live production certification. Remaining external gates are deployed Vercel Lab E2E and live approved Gemini evaluation for confidential document/pilot use. The isolated Supabase restore/PITR rehearsal remains deferred.
