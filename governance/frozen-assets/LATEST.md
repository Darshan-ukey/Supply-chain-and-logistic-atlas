# Atlas — Latest Frozen Assets (READ THIS FIRST)

Updated: **2026-09-02**  
Canonical frozen registry: `governance/frozen-assets/ASSET_REGISTER.json`  
Machine latest pointer: `governance/frozen-assets/CURRENT.json`  
Active enrichment registry: `governance/frozen-assets/ENRICHMENT_CANDIDATES.json`  
Integration lock: `governance/frozen-assets/history/frozen-stack-lock-v2.1.json`

## Production baseline
- Universe **7.3**
- Road LTL **1.3** — frozen production baseline
- Ocean FCL **0.5** — frozen production baseline
- Ocean LCL **0.5** — frozen production baseline
- Canvas **2.0.0**
- Universal Ask **2.0.1**
- Atlas Warehouse **1**

## Latest frozen execution-reference candidates
- Road LTL **1.4** — `FROZEN_EXECUTION_REFERENCE_CANDIDATE`
- Ocean FCL **0.6** — `FROZEN_EXECUTION_REFERENCE_CANDIDATE`
- Ocean LCL **0.6** — `FROZEN_EXECUTION_REFERENCE_CANDIDATE`

These candidates are immutable regression inputs but **do not replace the production baselines** until promotion gates pass.

## Active enrichment candidates — not frozen yet
- Road LTL **1.5** — `CANDIDATE_FOR_FREEZE`; lossless successor of frozen 1.4; LTL-03 materially enriched for BOL/information resolution while all other 1.4 content is inherited unchanged.
- Road LTL 1.5 Operational Knowledge payload — `CANDIDATE_FOR_FREEZE`; implements Operational Knowledge Contract v2 for LTL-03.
- Operational Knowledge Contract **v2** — `CANDIDATE_FOR_FREEZE`; embeds Information Resolution as a first-class operational-knowledge component.
- **BOL Information Resolution Baseline v0.1 — Road LTL / Malkom** — `CANDIDATE_REFERENCE_BASELINE`.

Machine paths:
- `data/modules/road-ltl-v1.5.json`
- `data/operational-knowledge/road-ltl-v1.5-operational.json`
- `schemas/operational-knowledge-contract-v2.json`
- `data/operational-knowledge/BOL_INFORMATION_RESOLUTION_BASELINE_V0.1.md`
- `data/operational-knowledge/road-ltl-v1.5-bol-resolution-baseline.json`
- `data/source-claims/road-ltl-v1.5-bol-resolution-claims.json`

**Universe remains 7.3. No Universe 7.4 change is required by this enrichment under current evidence.**

## Frozen production method
1. Daughter Production Standard V2
2. Inside-Out / Outside-In Operational Research Standard V1
3. Executability & Recursive Decomposition Standard V1
4. Evidence / Epistemic Classification Vocabulary V1
5. Knowledge-to-Execution Architecture V1
6. Client Binding Resolution Principle V1
7. Operational Knowledge Contract V1 — current frozen schema candidate; v2 is the active successor candidate above
8. Client Binding Requirement Contract V1

## Next implementation
1. Validate/freeze Road LTL 1.5 + Operational Knowledge v2 candidate set after regression/source/metric gates.
2. **Canonical Work Decomposition Contract V1 — IMPLEMENTATION_PENDING**
3. **Canonical WorkDefinition Contract VNext — IMPLEMENTATION_COMPILATION_PENDING**
4. Compile Road LTL 1.5 Information Resolution into executor-ready work and Malkom projection, then measure Validated STP Yield.

## How to use this registry
Never determine the latest asset from filenames in chat history. Start with this file or `CURRENT.json`. Historical frozen versions remain immutable under `governance/frozen-assets/history/`. Candidate work remains separate until its explicit freeze/promotion gates pass.
