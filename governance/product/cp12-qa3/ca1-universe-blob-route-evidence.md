# CP-12 CA-1 — GitHub blob and Daughter route evidence (2026-10-09)

Status: **PARTIAL / NOT CLOSED**. Source-neutral evidence only. This record does not approve a governed canonical identity or authorize release.

## Exact source blobs retrieved
- Standalone: `frozen-assets/inbox/supply-chain-logistics-universe-v7.3/Supply-Chain-Logistics-Universe-V7.3.html`, Git blob `27695e6e633f4531da4e7dcb0dd6cb8d451f9039`.
- Packaged: `reference/universe-v7.3.html`, Git blob `d828f284c83a7a394970605552e4d0e4440017a7`.
- Both GitHub blob contents returned **498183 JavaScript string code units**. This is **not** a byte-count or SHA256 verification. QA3 previously reported both files at 499471 bytes and standalone SHA256 `31503394e84d01b4b50831e82cbcd674c5cf77ea83021d95cf2a0ba07e42debd`; packaged SHA256 prefix `d674a8f775dfd2f6`. Those SHA256 claims remain independently unverified in this run.

## Direct source comparison
Eight unequal code-unit positions, zero-based:
`177414, 177698, 177747, 177796, 491953, 497508, 497552, 497596`.
These are **not byte offsets**; Unicode prior to the differences accounts for the different offset system. Changes observed:
1. Road LTL depth label `V1.2` vs `V1.3`.
2–4. liveModuleRoutes: Road LTL `road-ltl-v1.2.html` vs `v1.3`; Ocean FCL `ocean-fcl-v0.4.html` vs `v0.5`; Ocean LCL `ocean-lcl-v0.4.html` vs `v0.5`.
5. Road LTL walkthrough `V1.2` vs `V1.3`.
6–8. default daughter route map repeats the three version changes.

## Route resolution on proof-only branch
All six referenced targets exist **within their corresponding source trees**, with exact Git blobs:
| Variant | Daughter | Relative target | Blob |
|---|---|---|---|
| Standalone | Road LTL | `frozen-assets/inbox/supply-chain-logistics-universe-v7.3/daughters/road-ltl-v1.2.html` | `1d9d62416df6f9488cb6e53f6fe96ed45cd55aa8` |
| Standalone | Ocean FCL | `frozen-assets/inbox/supply-chain-logistics-universe-v7.3/daughters/ocean-fcl-v0.4.html` | `00991fbf7439cec72233abaef417c77211ee6b29` |
| Standalone | Ocean LCL | `frozen-assets/inbox/supply-chain-logistics-universe-v7.3/daughters/ocean-lcl-v0.4.html` | `b8b08ec457c3a2c15275987d42304ddfe4b69191` |
| Packaged | Road LTL | `reference/daughters/road-ltl-v1.3.html` | `5bb5412ac361814762afc914258293897c0ac2e1` |
| Packaged | Ocean FCL | `reference/daughters/ocean-fcl-v0.5.html` | `78d9b26da2a67bade1bb4559b00c70435dfebc52` |
| Packaged | Ocean LCL | `reference/daughters/ocean-lcl-v0.5.html` | `22827b9403491d067823f678651575c91e8c4b79` |

This proves **relative target existence in both trees**, not that either is authorized as canonical or that full browser navigation passes. The old targets are absent from `reference/daughters`, but present in the frozen standalone tree.

## Governance interpretation / remaining CA-1 gates
- `DEC-001` in UN Decision Register establishes governed-source/Universe as baseline and provenance retention; it does **not** adjudicate these two distinct V7.3 source roles.
- The standalone file is a frozen-source candidate, and the packaged file is a current projection candidate. Those are **roles to verify**, not an authority decision.
- Before CA-1 PASS: locate explicit source authorization for Road/Ocean pointer upgrades; record governed vs packaged roles and exact SHA256 identities; execute byte-level diff and two+ mutation tests against real bytes; verify Daughter resolution at certified target identity; request independent QA3 delta review.
- No frozen source edits, no new RC, no release promotion or merge authorized.
