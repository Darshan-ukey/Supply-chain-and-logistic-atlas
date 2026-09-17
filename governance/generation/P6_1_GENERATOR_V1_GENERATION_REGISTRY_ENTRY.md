# Generation Registry Entry — P6.1 Successor Work Decomposition Generator V1

**Status:** DRAFT_CANDIDATE — NOT OWNER-FROZEN. This registry entry records identity and evidence for independent QA. It does not itself authorize freeze, closure, or restart of anything.

## Generator identity

| Field | Value |
|---|---|
| Generator ID | `atlas-canonical-work-decomposition-generator-v1` |
| Generator version | `1.1.0` |
| Implementation path | `tools/generate-canonical-work-decomposition-v1.mjs` |
| Implementation blob hash (hardened) | `05dbd99526825c2a3172dc8c7545a2788b7a22ac` |
| Implementation blob hash (pre-hardening original) | `c92c1094de8fb4e0b2458ecfae18a80db0a0f19d` |
| Original commit | `00bb8bb49691426e0d2e165b720914d9540b7170` |

## Generation Contract

| Field | Value |
|---|---|
| Contract ID | `P6_1_SUCCESSOR_GENERATION_CONTRACT_V1` |
| Contract path | `governance/generation/P6_1_SUCCESSOR_GENERATION_CONTRACT_V1.md` |
| Contract blob hash | `d075cc08551ee2f58afe4df8b342e28cb590e19b` |
| Contract commit | `3767e1159f959680329a80d60342b980a9cb62dc` |
| Contract status | `DRAFT_CANDIDATE — NOT OWNER-FROZEN` |

## Runtime / environment / dependency identity (F2)

| Field | Value |
|---|---|
| Node version (all results in this package) | `22.22.2` |
| Product's own pinned engine (`package.json`, untouched) | `24.x` — **not yet reconciled, see GENERATOR_V1_RUNTIME_PIN.md** |
| External runtime dependencies | none (generator imports only `node:crypto`, `node:fs`) |
| Scoped pin record | `governance/generation/GENERATOR_V1_RUNTIME_PIN.md` |
| Canonicalization algorithm | `atlas-stable-json-v1` (sorted-key stable stringify, hand-rolled, no engine-specific serialization dependency) |
| Hash algorithm | `sha256` |

**Note:** this generator does not have its own `package.json`. The branch's existing product-wide `package.json` (real dependencies: jszip, mammoth, pdf-lib, pptxgenjs, xlsx; `engines.node: 24.x`) was left completely untouched — a generic generator-only manifest was drafted and nearly committed over it before being caught and reverted. See the pin record for why this is scoped separately.

## Validators

| Validator | Path | Blob hash |
|---|---|---|
| Deterministic fixture suite (48 checks) | `tests/p6-1-generator-v1.mjs` | `a9911824b7cb03446bb62c041afa2b250473677a` |
| Self-QA proof harness (15 checks, 5 named properties) | `tools/p6-1-generator-self-qa.mjs` | `64c4b91e561fd179f1a4a26b9e905a25ba51bfb4` |

## Fixture-set identity

- **Coverage:** CR1–CR11 equivalents, negative/malformed input, graph integrity, ordering (task order, array-field order, seed order), hashing/determinism, child-split rules (audit trail, threshold, rejection traceability), runtime-contamination guards, historical-count non-influence.
- **Result:** 48/48 passed. Command: `node tests/p6-1-generator-v1.mjs`.
- Each fixture is an inline synthetic case, not real Road LTL data — no fixture in this suite is, or should be read as, a claim about Road LTL itself.

## Self-QA / recovery-test identity

- **Command:** `node tools/p6-1-generator-self-qa.mjs`
- **Representative input:** synthetic, explicitly labelled `SELF-QA-ONLY-NOT-REAL-SOURCE`, shaped to exercise ready/blocked/split/rejected/contaminated/unsupported-runtime cases together.
- **Representative input semantic hash:** `4dee2c330afe2565732ddfd930153900841afdcb3fb8c4684be09a5b4cce2656`
- **Result:** 15/15 properties proven, covering exactly the five the Owner named:

| Property | Proven by |
|---|---|
| P1 — identical frozen input → identical semantic hash | in-process repeat run AND a separate OS process reproducing the same hash from the same frozen JSON alone |
| P2 — historical counts do not influence output | function arity has no such channel; decoy historical fields in input produce zero hash change; no historical literal exists anywhere in generator source |
| P3 — no Malkom/client/runtime contamination | 6 known runtime-shaped keys confirmed absent from output; independent guard confirmed present in `validateGraph` |
| P4 — missing semantics fail closed | every under-grounded unit in a fully-ambiguous synthetic task blocks; zero incorrectly reach READY; empty-seed task blocks at root |
| P5 — deterministic graph/provenance/blocker integrity | no duplicate IDs, no orphan parents, universal provenance, universal per-unit content hash, closed status taxonomy, full unit-by-unit identity across repeated runs |

## What this registry entry does NOT claim

- Does not claim the generator has been run against real Road LTL source.
- Does not claim output has been compared to historical P6.1 counts.
- Does not claim the generation contract or generator implementation is `OWNER_FROZEN`.
- Does not claim P6.1 recovery is closed, Road LTL readiness is restored, or R0.4/P6.x is restarted.

See `governance/generation/GENERATOR_V1_STATUS_AND_BOUNDARIES.md` for the complete task-by-task status.
