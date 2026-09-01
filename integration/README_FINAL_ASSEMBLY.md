# Supply Chain Atlas 2.0 — Final Integration Pack

This package contains the certified V2.0.1 Universal Ask runtime and the final integration machinery for the frozen Atlas stack.

## Locked target stack

- Universe V7.3
- Road LTL V1.3 — A5 VERIFIED
- Ocean FCL V0.5 — A5 VERIFIED
- Ocean LCL V0.5 — A5 VERIFIED
- Foundation V1.2
- Atlas Warehouse V1 — 82 Work Decompositions / 82 WorkDefinitions / 82 dependency records
- Canvas V2.0 frozen
- Universal Ask Atlas V2.0.1

## Why the package is fail-closed

The exact latest frozen files live in the project File Library, but those file payloads are not mounted in the current execution container. GitHub `main` still contains the older V1.1.8 line. This package therefore **does not silently copy the older Page 0/LTL assets and label them V2.0**.

Place the frozen assets (or an extracted Atlas Production Foundation V1 directory plus Canvas V2.0) under `frozen-assets/inbox/` and run:

```bash
npm run final:materialize
npm run final:verify
```

The materializer searches recursively for the canonical basenames, validates the known SHA-256 locks for the three daughter JSONs and Canvas ZIP, updates module publication metadata, installs the Universe/daughter reference surfaces, installs Atlas Warehouse, and records a final release manifest.

If any required asset is absent or has a hash mismatch, it stops with a non-zero exit code. That behavior is intentional.

## Required frozen inputs

At minimum:

- `universe-v7.3.html` or `Supply-Chain-Logistics-Universe-V7.3.html`
- `road-ltl-v1.3.json`
- `road-ltl-v1.3.html`
- `ocean-fcl-v0.5.json`
- `ocean-fcl-v0.5.html`
- `ocean-lcl-v0.5.json`
- `ocean-lcl-v0.5.html`
- `atlas-warehouse-v1.json`
- `atlas-canvas-v2.0-frozen.zip` OR an extracted `canvas-v2` directory

Recommended: use the complete **Atlas Production Foundation V1** output as the inbox source so Foundation V1.2 governance/registries travel with the release.

## Release boundary

`Universal Ask` is already certified in this pack. The final integration certificate can be emitted only after the exact frozen content is present and the assembled package passes:

- module/hash validation;
- registry/catalog validation;
- no-backfill tests;
- Universal Ask cross-surface tests;
- public/Admin IP-boundary tests;
- Canvas V2 smoke/regression;
- desktop/mobile browser checks;
- serverless budget check;
- exact ZIP verification.
