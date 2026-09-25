# v1.1.7 Full Release Audit

## Verdict

**PASS — full product parity + legacy Reference Atlas navigation parity.**

v1.1.7 keeps the certified v1.1.6 product runtime and restores direct access to the complete pre-canvas reference experience using exact donor HTMLs rather than reconstruction.

## Modern spatial runtime

- 15 spatial territories: PASS
- boxed `.territory` renderer absent: PASS
- ambient mesh: PASS
- 110 ambient dots: PASS
- minimap / ATLAS VIEW: PASS
- semantic zoom: PASS
- Play / Freeze / Trace / Lens / Compose / Fit / Inspector: PASS
- Stage 17–21 runtime objects initialized: PASS
- desktop runtime errors: 0
- mobile runtime errors: 0
- desktop/mobile horizontal overflow: 0

## Reference Atlas parity

Exact V6.2.3 Page 0 navigation preserved:

`Overview · Planned navigator · Ecosystem atlas · Source-native models · Enterprise coverage · Operating roles · Execution overlays · Systems & exchanges · L3–L5 contract · White-space discovery · Sources`

V6.2.3 `How to Read Atlas` guide control and guide opening: PASS.

Exact Road LTL V1.2 reference navigation preserved:

`Overview · Compose context · Execution graph · Reference configurations · Enterprise lenses · Sources`

Both reference pages pass real Chromium checks at 1440×900 and 390×844 with zero runtime errors and zero horizontal overflow.

## Canonical / foundation integrity

- Frozen Page 0 source hash unchanged: PASS
- Frozen integrated Page 0 + Road LTL source hash unchanged: PASS
- V6.2.3 Page 0 legacy donor hash exact: PASS
- Road LTL V1.2 legacy donor hash exact: PASS
- Page 0 canonical JSON hash unchanged: PASS
- Road LTL canonical JSON hash unchanged: PASS
- 13 Road LTL A3 parents: PASS
- 22 A5 processes: PASS
- 39 process flow edges: PASS
- 22 execution transitions: PASS
- 29 sources: PASS
- 27 lenses: PASS
- 15 child actors: PASS
- 176 ontology edges: PASS
- 220 node dual-shape parity: PASS
- Atlas Data Contract v1.1: PASS
- Foundation source governance / relationship vocabulary / rule + overlay registries: PASS

## Backend / release

- Vercel functions: 8
- Public API rewrite paths: 28
- `/api/version` release ID: `scoip-v1.1.7-reference-parity-2026.08.24`
- `/api/release-integrity`: PASS, 33 critical files
- Stable package contains Reference Atlas: PASS
- Lab package contains Reference Atlas: PASS
- Stable excludes AP fixture / pilot corpus: PASS
- Lab retains AP fixture / evaluation workbench: PASS

## Privacy / pilot guards

- Gemini request `store=false`: PASS
- Gemini key sent in header, not URL: PASS
- ephemeral response `no-store`: PASS
- ephemeral source persistence disabled: PASS
- pilot write roles OWNER/ADMIN/EDITOR only: PASS
- viewer write blocked: PASS
- direct foundation publication blocked: PASS
- Stage 23 prompt-injection / unpublished-FTL guard smoke: PASS

## Scale

71 destinations × 30 synthetic processes = 2,130 processes through the domain-neutral engine: PASS; measured runtime during certification ~8 ms in this environment.

## External gates

Not certified locally and deliberately left as deployment gates:

1. Live approved Gemini provider evaluation.
2. Exact deployed Vercel Lab E2E.
3. Dependency lockfile generation when registry access is available.
4. Isolated Supabase restore/PITR rehearsal if/when explicitly approved.

## Final semantic zoom / A4-A5 focus correction — certified

Post-release inspection identified one UX regression: a direct unfocused A4 depth request could render all A4 beacons without task labels. The final v1.1.7 artifact corrects the semantic-navigation contract rather than exposing all 22 A4 labels globally.

Certified behavior:

- Unfocused A4 request clamps to A3; the anonymous-dot A4 state is no longer reachable through the semantic zoom API.
- Desktop wheel zoom uses the pointer location to focus the nearest A3 and then enters A4.
- Mobile pinch zoom uses the pinch midpoint to focus the nearest A3 and then enters A4.
- At A4, labels are scoped only to the focused A3's child workflows.
- Desktop double-click on a focused A4 enters A5 focus.
- Mobile second pinch over a focused A4 enters A5 focus.
- The A5 execution contract opens in the Inspector; no unsupported extra A5 taxonomy is synthesized.
- Fit Universe resets the semantic focus.

Real Chromium certification passed at 1440×900 and 390×844 with zero runtime errors and zero horizontal overflow. The exact V6.2.3 Page 0 and Road LTL V1.2 Reference Atlas donors remain byte-identical; canonical Page 0/Road LTL JSON and Stage 17–21 clients remain unchanged.
