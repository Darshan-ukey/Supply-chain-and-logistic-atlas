# Generator V1 — Scoped Runtime/Dependency Pin (F2)

**Why scoped, not in `package.json`:** this branch inherited the full product's `package.json` (name `supply-chain-operations-intelligence-v1.1.8`, real dependencies including `jszip`/`mammoth`/`pdf-lib`/`pptxgenjs`/`xlsx`, `engines.node: 24.x`). A generic generator-only `package.json` was drafted and nearly committed over it before this was noticed — reverted. Pinning here instead, so this record can never silently clobber the product's actual build configuration.

## Generator's own identity

| Field | Value |
|---|---|
| External runtime dependencies | **none** — the generator imports only `node:crypto` and `node:fs` |
| Canonicalization algorithm | `atlas-stable-json-v1` (sorted-key stable stringify, implemented in-file) |
| Hash algorithm | `sha256` |

## Node version — a real discrepancy, flagged rather than papered over

| | |
|---|---|
| Product's pinned engine (`package.json`) | `24.x` |
| Version this hardening/fixture/self-QA work actually ran under | `22.22.2` |

**This is not yet reconciled.** All results in this package (48/48 fixtures, 15/15 self-QA proofs, both hardening-defect probes) were produced and verified under `22.22.2`. The generator has zero dependencies whose behavior would plausibly differ across Node 22 vs 24, and the canonicalization is hand-rolled rather than relying on any engine-specific JSON serialization guarantee — so a difference is unlikely. But "unlikely" is an assumption, not a proof, and this file exists partly to make sure that assumption doesn't quietly become permanent.

**Before this generator is treated as fully F2-pinned, either:**
1. re-run the fixture suite and self-QA harness under Node `24.x` and confirm identical results, or
2. the product's `engines.node` requirement is confirmed not to apply to this standalone tool.

Neither has been done. Recorded as an open item, not resolved by assumption.
