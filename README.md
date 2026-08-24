# Supply Chain Operations Intelligence Platform — v1.1.6

**Release Certified · Full Product Parity · Road LTL**

v1.1.6 is the release-clean successor to v1.1.5. It deliberately adds no new product behavior. It preserves the Stage 23 spatial canvas and real Stage 17–21 client layers, Foundation Hardening v1.1, and the v1.1.3 eight-function Vercel architecture while closing release-certification defects.

## Certified invariants

- Stage 23 spatial canvas: open `.field` geography, ambient complexity mesh, semantic zoom, minimap, playback, Lens, Compose, Trace and rich Inspector.
- No boxed `.territory{width:150px...}` renderer.
- Stage 17–21 client layers remain the real donor files, not compatibility stubs.
- Frozen Page 0 and integrated Road LTL source HTML are byte-anchored.
- Machine-readable Page 0 and Road LTL JSON remain byte-identical to the v1.1.5 certified donor.
- Foundation v1.1 contracts, registries, crosswalks and rule/overlay services remain present.
- 8 Vercel serverless functions preserve 28 public API paths.
- Ephemeral document/Gemini guardrails remain fail-closed and `store=false`.
- Release identity is normalized to v1.1.6 across UI, API, registry, env, manifests and deploy packages.
- Release certification uses a real Chromium session and fails if the browser cannot run.

## Main commands

```bash
npm run check            # inherited + security + pilot regressions
npm run browser:certify  # strict real-Chromium desktop/mobile gate
npm run release:all      # complete release certification + package build/check
```

## External go-live gates

The build is release-certified locally. Real deployment still requires Vercel Lab E2E and, when confidential document testing is enabled, live Gemini/provider certification. The isolated Supabase restore/PITR rehearsal remains deferred and is not a runtime dependency.

See `RELEASE_V1.1.6.md` and `audits/v1.1.6/`.
