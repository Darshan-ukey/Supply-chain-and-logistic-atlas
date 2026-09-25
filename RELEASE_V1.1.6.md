# v1.1.6 · Release Certified

## Purpose

v1.1.6 is a release-engineering correction over Claude v1.1.5. It does not redesign or simplify the product. It preserves the spatial/full-parity runtime and closes the remaining issues found in the v1.1.5 audit.

## Issues closed

1. **Release identity drift** — v1.1.5 still generated v1.1.4 manifests/deploy README files. v1.1.6 normalizes the package, UI, API, registry, environment template, manifest, baseline and Stable/Lab artifacts to one release ID: `scoip-v1.1.6-release-certified-2026.08.24`.
2. **Browser SKIP=PASS** — the release browser gate is now fail-closed. It drives installed Chromium directly through the Chrome DevTools Protocol; release certification fails if Chromium cannot run. It verifies desktop and mobile live DOM state, spatial territories, no boxes, ambient mesh/dots, minimap, semantic zoom, no overflow, core controls, and real Stage 17–21 runtime initialization.
3. **Integrity provenance ambiguity** — the active baseline is now `release/baselines/v1.1.6-critical-hashes.json`, generated only after the v1.1.6 release metadata changes. The stale v1.1.4-named baseline is archived under `audits/v1.1.5/`.
4. **Stronger canonical guard** — in addition to frozen source HTML hashes and semantic counts, v1.1.6 anchors the exact Page 0 and Road LTL machine-readable JSON hashes inherited from v1.1.5.
5. **Deploy-package identity validation** — package checks verify version/release identity, 8 functions, 28 routes, spatial renderer, Stage17–21 donor parity, Stable/Lab inclusion boundaries, and the active integrity baseline.

## Intentionally unchanged

- Canonical Page 0 content
- Road LTL A3/A4/A5 content and execution graph
- Stage 17–21 client behavior
- Enterprise Core / Supply Chain Domain Pack
- Foundation v1.1 ontology, source, crosswalk, rule and overlay content
- 8-function API routing architecture
- Supabase migrations
- Gemini/session-ephemeral document architecture

## External gates

- Vercel Lab deployed E2E
- Live Gemini synthetic evaluation when provider is enabled
- Dependency lockfile if registry access permits generation
- Isolated restore/PITR rehearsal before persistent confidential production retention (deferred; not runtime dependency)
