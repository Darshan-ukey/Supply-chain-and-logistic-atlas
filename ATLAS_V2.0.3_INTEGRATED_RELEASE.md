# Supply Chain Atlas V2.0.3 — Superseded Integration Record

> Superseded by V2.1 RC1 because V2.0.3 did not carry forward the Atlas
> Execution Fabric implementation. Retained only for release lineage.

This branch-ready release physically materializes the latest frozen Atlas 2.0 stack:

- Universe V7.3
- Road LTL V1.3 canonical frozen module (A5 verified)
- Ocean FCL V0.5 (A5 verified)
- Ocean LCL V0.5 (A5 verified)
- Foundation V1.2
- Atlas Warehouse V1 (82 Work Decompositions, 82 WorkDefinitions, 82 dependency records)
- Canvas V2.0 frozen
- Universal Ask Atlas V2.0.1

The newer LTL Operations Knowledge V0.1 build is retained under
`prototypes/ltl-operations-knowledge/`. It is a standalone evidence prototype and is
not registered as a production Atlas module. The Road LTL enriched development build
is retained separately under `prototypes/road-ltl-v1.3-enriched-reference/`; the live
release uses the canonical frozen Road LTL JSON whose SHA-256 is locked in the final
integration manifest.

## Certification status

Frozen asset materialization, canonical integrity, Universal Ask, public/Admin IP
boundary, Admin authorization, API routing, and the eight-function serverless budget
pass locally. Browser certification remains a Lab/deployment gate because Chromium is
not installed in the packaging runtime.

Do not promote directly to production. Upload to an `atlas-v2-release` branch, deploy
that branch to Lab/Preview, run browser/mobile and end-to-end checks, then promote the
exact tested build.
