# ATL-155 — v1.5 Bounded Daughter Generation — Frozen Custody Record

Status: **FROZEN**
Baseline authority: `f9b08a951ca823ff8c23b64044fe1a7abb9dde79`
Generator: `atl-155-bounded-daughter-generator@1.1.0`
Contract: `ATL-155-BOUNDED-DAUGHTER-GENERATION-V1`
Sequence controller: ATL-177

## Frozen assets
- Generator — `scripts/generate-bounded-daughter-v1.js` — blob `564f561e91c013fed1b97b1e95d8a7c1196819a5`
- Test — `tests/atl-155-bounded-daughter-generation.test.js` — blob `b3a1f2252014d64fe1d9130d0bbe7a11cfd8f587`
- Knowledge schema — blob `0dacf499eb9afff8a32fdb57c72f6e10de7e721f`
- Projection schema — blob `269e51dd76d7bc8c00fb2af693b879b073d26135`
- Road LTL model — blob `534aa47747707d869264e8d41f19622bd9263be8` — file SHA-256 `ab34587348ec490abbbab364f0acf620825f32c7cb594508de2f077e889dcf30`
- Road LTL projection — blob `6390457cc211d688d4ed7c8e93db684fe787145f` — file SHA-256 `98d82494ceb7bac0bc5a2814a33efed1663fa21b6085b1046a8006003d7d1486`
- Ocean FCL model — blob `15d52a8fae2f79cff8da6f8b2f9a09d5a5965cff` — file SHA-256 `088c0235a81c47b9fb71e95e2b36ffe2ab5ece4af9be3d079065fdc6a77b287d`
- Ocean FCL projection — blob `5819b37fb79905463f5acceb434c3ef07bcb7bf5` — file SHA-256 `b8d68d05b873e465f0b541cf09a2225db988e98564b18e4b3ac1cc0472628c2f`
- Ocean LCL model — blob `724b224743a2172e1b0540ac3a910fb0426ab842` — file SHA-256 `c051f173107056a33fb8217bffe2d6d3163d6e030f95f964e9f2b7b610ac52cf`
- Ocean LCL projection — blob `af6eeaf57f29d821c223c205bc44509989f02e84` — file SHA-256 `671bc8760564235c87601cc53843aa077ec64cd98ac63df51a9f171e0f8853ea`

## Verification contract
The committed executable test proves:
1. two independent Road LTL generations serialize byte-identically;
2. Road LTL reconciles exactly to 22 processes / 13 A3 / 39 edges / 29 sources;
3. all eight structural dimensions are present;
4. canonical model precedes projection and projection carries canonical-model hash;
5. Ocean FCL/LCL refuse requested A5 generation and remain REFERENCE_ONLY / RESEARCH_REQUIRED;
6. TEST_ONLY `accounts-payable-fixture` publication is refused.

Connector-level read-back independently confirmed every materialized output is FROZEN, Road LTL counts are 22/13/39/29, and Ocean projections are REFERENCE_ONLY. No claim of Claude QA PASS is made here.

## Ownership / consumption
Generator writes the frozen generated model/projection assets. ATL-155 tests validate. Promotion is Owner-gated at ATL-142. Road LTL is reached through `index.html` and existing `window.activateModule("road-ltl")`, feeding the existing spatial canvas and selected-item Inspector. Ocean reference-only daughters remain on the registry/reference coverage surface until governed depth exists.
