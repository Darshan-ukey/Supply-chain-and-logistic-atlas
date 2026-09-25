# v1.1.7 — Full Product + Reference Atlas Parity

Release ID: `scoip-v1.1.7-reference-parity-2026.08.24`

v1.1.7 is a parity-integration release. It does not redesign the Stage-23 spatial canvas or alter canonical Page 0 / Road LTL data.

## What changed from v1.1.6

- Restored a first-class **Reference Atlas** surface beside Explore / Execute / Compare / Transform.
- `Ecosystem / Page 0` now opens the preserved V6.2.3 reference experience instead of silently resetting to the Universe canvas.
- Preserved exact legacy donor pages:
  - V6.2.3 Page 0, with original Page 0 navigation and additive How-to-Read guide.
  - Road LTL V1.2 reference page with original navigation.
  - Frozen V6.2.2 Page 0.
  - Frozen integrated Page 0 + Road LTL V1.2.
- Added fail-closed legacy/reference navigation browser certification on desktop and mobile.
- Expanded critical release integrity from 28 to 33 files.

## Preserved without product changes

- Stage-23 spatial canvas: 15 territories, ambient mesh, 110 ambient dots, minimap, semantic zoom.
- Play / Freeze / Trace / Lens / Compose / Inspector.
- Stage 17–21 client layers.
- Foundation Hardening v1.1.
- Road LTL V1.2 canonical model.
- Page 0 V6.2.2 canonical JSON.
- 8-function Vercel / 28-path routing architecture.
- Stage 22.x ephemeral Gemini guardrails and Stage 23 pilot evaluation gates.

## Reference donor hashes

- V6.2.3 Page 0: `45ea5ad55c6f0103bdb70ee33c05e2ca68587d98453a8c0c2c160e67d51e73c7`
- Road LTL V1.2: `a75ca386b0048af94aa8f8f9ea726dbe10f3c819c602d90daff4f90ddf942c92`
- Frozen Page 0 V6.2.2: `47a111bd72f8524ee1c1f2d67b85d6958156c5f1026659e9769f1c6a28639002`
- Frozen integrated Page 0 + Road LTL V1.2: `70850a00baac10253d263e41465ab80fe3a0e4c269e6d06391e6a4f333af2747`

## External gates unchanged

- Live Gemini synthetic certification once the approved provider is configured.
- Exact deployed Vercel Lab E2E.
- Dependency lockfile generation when registry access is available.
- Isolated Supabase restore/PITR rehearsal remains deferred and is not a runtime dependency.

## Final semantic-zoom correction

The final v1.1.7 package closes the A4 visibility regression found during post-release inspection. A4 and A5 are now focus-dependent semantic drill-down states rather than global depth toggles:

- An unfocused request to enter A4 clamps to A3 rather than rendering anonymous A4 beacons.
- Desktop wheel zoom uses the gesture location to focus the nearest A3, then reveals only that A3's A4 workflows.
- Mobile pinch zoom uses the pinch midpoint to focus the nearest A3 and reveal scoped A4 workflows.
- A second focused drill-down selects an A4 and enters the A5 execution-contract state.
- Desktop double-click and mobile pinch are live-browser certified for A4 → A5.
- Fit Universe remains the deterministic escape back to the full spatial landscape.

No canonical Page 0/Road LTL data, Stage 17–21 client code, Foundation v1.1 knowledge, legacy Reference Atlas donor HTML, API routing, migrations, or privacy architecture changed in this correction.
