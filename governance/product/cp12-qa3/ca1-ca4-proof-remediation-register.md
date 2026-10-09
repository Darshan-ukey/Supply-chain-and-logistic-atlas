# CP-12 QA3 REWORK — bounded proof-only remediation register

Date: 2026-10-09. Branch: `cp12-qa3-ca1-ca4-proof-only-20261009`. Base: S8-6 evidence head `21ab396cdad33bde35bbce4791228047b34d4585`. This branch is NOT a release candidate and carries no approval to merge or deploy.

## Authority and independent decision
Claude Sonnet 5.5 separate-session QA3: **REWORK**, reuse exact S8-6 frozen successor (tested commit `78a3b7c87f24d20f07c8fdb24c0202c33f5de6c2`, tree `e29b608555af535a972eef4461ada3d4fc58d82d`). See ATL-181 comment `7e837360-eb91-42c6-838e-31bfef98f418` and `CP-12-QA3-INDEPENDENT-REVIEW-2026-10-09.md` (independent reviewer record).

Owner decisions 2026-10-09: CA-5 public custody/code accepted **temporarily until build completion**, then reassess before release; CA-6 separate-session same-model-family independence accepted with disclosure. Neither grants release clearance.

## CA-1 — Universe V7.3 identity (OPEN; governance decision required)
Two distinct 499471-byte Universe variants:
- Frozen standalone `frozen-assets/inbox/supply-chain-logistics-universe-v7.3/Supply-Chain-Logistics-Universe-V7.3.html`, SHA-256 `31503394e84d01b4b50831e82cbcd674c5cf77ea83021d95cf2a0ba07e42debd`; Road LTL 1.2 / Ocean 0.4 pointers.
- Packaged Lab/Stable `reference/universe-v7.3.html`, SHA-256 prefix `d674a8f775dfd2f6`; Road LTL 1.3 / Ocean 0.5 pointers.
Eight 1-byte substitutions at offsets 178017, 178303, 178352, 178401, 493217, 498796, 498840, 498884 (independent review observation, to be independently verified before claiming test PASS).
**Do not select the canonical governed identity by inference.** Establish source provenance/authorization for pointer updates, record governed vs packaged projection roles, then add exact-hash pin, deterministic byte-diff test, Universe-to-Daughter resolution test, >=2 mutations. Until then CA-1 NOT CLOSED.

## CA-2 — Reuse scope (EVIDENCE SCOPED; target compatibility NOT CERTIFIED)
The only reusable QA basis is the exact S8-6 tested identity above. S8-6 RC suite independently reproduced 82/82 Node22/24, 41/41 mutations, 110/110 browser, 17/17 gating, 89/89 lineage, protected-derivative reproduction; DAU mutations 21/21 Node24.
`atl181-v15-remediation-successor` tip `e5f5029cd9551ae6c141a13be6221064f18d7c32` is excluded: the S8-6 RC suite gives 73/82 there, not a transferable PASS. Mandatory bounded delta paths: `index.html`, `execution/ui/runtime-access-shell.js`, `api/atlas.js`, `lib/api/_router.js`, `vercel.json`, `assets/universal-daughter-renderer-v2.js`. New RC required for changed target. Do not promote S8-6 manifest as current-target certification.

## CA-3 — Self-contained reproduction (OPEN)
RC mutations R04–R07 require non-ancestor historical objects `379f988c`, `9cf88a86` and commits `ef6e375`, `dba6968`; shallow clone previously yielded 78/82 until full history fetched. Pin durable references or minimal non-sensitive fixtures; validate from fresh shallow clone. Node24 historical re-execution is reviewer evidence, not a fresh run by this remediation branch.

## CA-4 — Load-race control (OPEN)
Known pre-existing root load race tolerated by DAU harness: 0/110 Node22 and 1/110 Node24 in independent QA3. A ceiling is NOT YET APPROVED. Require explicit fail-closed bound and report `rootLoadRaceTolerated` in each future gate; disallow masking unrelated errors with same text. Frozen root must not be edited under CP-12.

## Restrictions and next gates
No product-byte changes, no frozen-root edits, no merge/deploy/promotion, no QA3 PASS until CA-1..CA-4 evidence exists and Claude performs delta-only re-review. ATL-181 mechanism hold and release HOLD remain. GOV-002 and downstream security/RLS/release checks carried, not silently closed.
