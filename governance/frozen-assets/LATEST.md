# Atlas — Latest Frozen Assets (READ THIS FIRST)

Updated: **2026-09-02**  
Canonical frozen registry: `governance/frozen-assets/ASSET_REGISTER.json`  
Machine latest pointer: `governance/frozen-assets/CURRENT.json`  
Integration lock: `governance/frozen-assets/history/frozen-stack-lock-v2.2.json`

## Production baseline — unchanged
- Universe **7.3**
- Road LTL **1.3** — `FROZEN_PRODUCTION_BASELINE`
- Ocean FCL **0.5** — `FROZEN_PRODUCTION_BASELINE`
- Ocean LCL **0.5** — `FROZEN_PRODUCTION_BASELINE`
- Canvas **2.0.0**
- Universal Ask **2.0.1**
- Atlas Warehouse **1**

## Latest frozen execution-reference candidates
- Canvas **2.0.1** — `FROZEN_EXECUTION_REFERENCE_CANDIDATE`
  - Shell + governed Canvas→Daughter bridge. The frozen 2.0.0 visual shell is byte-identical and unchanged; 2.0.1 is additive routing, not a shell revision.
  - Governed targets: Road LTL → Daughter 1.5 (sample LTL-03), Ocean FCL/LCL → Daughter 0.6 (approved go-live target).
  - Verified 2026-09-12: existing 37-assertion integration suite PASS, JS syntax-validated, local structural serve confirmed. Live/visual DOM rendering not yet observed (Vercel action prohibited this sprint) — this is why it is a candidate, not a production baseline, mirroring Road LTL 1.5's own treatment below.
  - Registered under explicit Owner direction as permanent scaffolding, not demo-only.
  - Asset register: `canvas-2.0.1-candidate`.
- Road LTL **1.5** — `FROZEN_EXECUTION_REFERENCE_CANDIDATE`
  - Lossless successor of frozen Road LTL 1.4.
  - Only `LTL-03 — Create and validate shipment, consignment and transport-document identity` is materially enriched.
  - All unchanged Road LTL 1.4 content is inherited unchanged.
  - SHA-256: `22965f4b7ec2c3d192f86edf5bb073e4820fd3724cda02aa0502e4ff4404ac6f`
- Ocean FCL **0.6** — `FROZEN_EXECUTION_REFERENCE_CANDIDATE`
- Ocean LCL **0.6** — `FROZEN_EXECUTION_REFERENCE_CANDIDATE`

These are immutable reference candidates. **They do not replace production baselines** until separate promotion gates pass.

## Newly frozen reference assets
- Road LTL 1.5 Operational Knowledge — `FROZEN_OPERATIONAL_REFERENCE`
  - `data/operational-knowledge/road-ltl-v1.5-operational.json`
  - SHA-256: `6bf09b05fef2967bda48800cf5ba926487f3df6ca467f0316ca52334045a22a9`
- Operational Knowledge Contract **v2** — `FROZEN_SCHEMA_CANDIDATE`
  - Information Resolution is embedded as a first-class component of Operational Knowledge.
  - `schemas/operational-knowledge-contract-v2.json`
  - SHA-256: `d58d33c38adc0ac3e63400b66680115699c0cfa5c4c831e44b22c19eedfa4a18`
- Information Resolution Contract **v1** — `FROZEN_SCHEMA_REFERENCE`
  - `schemas/information-resolution-contract-v1.json`
  - SHA-256: `77224aaaef03689f1d918e41c6c2a4bd6e126dd5872782f09894c818a76dda73`
- **BOL Information Resolution Baseline v0.1 — Road LTL / Malkom** — `FROZEN_REFERENCE_BASELINE`
  - `data/operational-knowledge/BOL_INFORMATION_RESOLUTION_BASELINE_V0.1.md`
  - SHA-256: `8d1593ca7133c6c0ebe72099e01e18feccd5bb906851a6affa1a36ccbddb8400`

Supporting BOL evidence snapshot locked by stack lock v2.2:
- `data/operational-knowledge/road-ltl-v1.5-bol-resolution-baseline.json` — `b130da47c06a849c53980201027b6eaa05e440afd349e949c4bc8f3f4ac25480`
- `data/source-claims/road-ltl-v1.5-bol-resolution-claims.json` — `4a799a8cfa9252b8ebf0f191aa054d5c4942d8f9e35ffe670d1cfdefba6ae69c`

## Freeze validation
GitHub Actions workflow **Frozen Asset Registry** passed the dedicated Road LTL v1.5 freeze validator. Validation covered base-hash integrity, lossless inheritance, LTL-03-only scope, task identity preservation, source-claim references, OKv2/Information Resolution linkage, canonical BOL object depth, jurisdiction boundaries, 76-field baseline preservation, metric-anomaly disclosure, and preservation of the production baseline.

Freeze type: **immutable reference-candidate freeze, not production promotion**.

## Universe decision
**Supply Chain Universe remains 7.3.** No Universe 7.4 change is required by this BOL/Operational Knowledge enrichment under current evidence.

## Frozen production method
1. Daughter Production Standard V2
2. Inside-Out / Outside-In Operational Research Standard V1
3. Executability & Recursive Decomposition Standard V1
4. Evidence / Epistemic Classification Vocabulary V1
5. Knowledge-to-Execution Architecture V1
6. Client Binding Resolution Principle V1
7. Operational Knowledge Contract V2
8. Information Resolution Contract V1
9. Client Binding Requirement Contract V1

## Remaining production-promotion work
1. Resolve the source-reported Malkom Accuracy metric numerator/denominator/counting method for the 11 values above 100%.
2. Obtain governing Malkom/client schemas for unresolved client/runtime labels.
3. Implement Recursive Work Decomposition and WorkDefinition VNext compilation.
4. Complete downstream runtime regression and measured **Validated STP Yield** proof before production promotion.

## How to use this registry
Never determine the latest asset from filenames in chat history. Start with this file or `CURRENT.json`. Historical frozen versions remain immutable under `governance/frozen-assets/history/`.
