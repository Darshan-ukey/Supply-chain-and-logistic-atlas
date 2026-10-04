# ATL-129 Clean Rebuild — Executable Evidence

Status: BUILDER EVIDENCE — AWAITING CROSSED INDEPENDENT QA

## Lineage

- Supersedes ATL-121 implementation/evidence for acceptance.
- Repository: Darshan-ukey/Supply-chain-and-logistic-atlas
- Clean base branch: atlas-governance-registry-v2.1
- Clean base commit: b96bab3f67210079f0cc58161d635fa3d2fca76c
- Sole rebuild branch: darshanukey/atl-129-clean-rebuild-rule-ontology-proof
- Pull request: #20 (draft; do not merge before independent QA)
- Neither quarantined ATL-121 V0.3 branch was used as an implementation input.

## Machine execution

GitHub Actions workflow: ATL-129 clean proof
Run: 36289808455
Runner checkout: PR #20 merge of builder HEAD 5e293fa0950994cef57d7f05db4e93724f073287 into clean base b96bab3f67210079f0cc58161d635fa3d2fca76c.
Result: SUCCESS.
Test result: 25 tests run, 25 passed.
Command:
`cd governance/implementation/atl129_clean && python -m unittest -v test_clean_proof.py`

The suite proves the ten ATL-121 obligations plus Owner additions through explicit executable assertions, including both trigger paths, genuine governed-store gap, committed source read, normalization/alias resolution, ontology mapping, provenance persistence, EMBED/SNAPSHOT/DYNAMIC_LOOKUP, client lookup, explicitly mocked external authority, outage/fail-closed behavior, bounded validation distinct from promotion, release while promotion is pending, non-promotion disposition, immutable package hashing, runtime deployment/use, package→candidate→source lineage, and separation of knowledge store/package registry/runtime cache.

## Committed artifact identities at tested builder HEAD

- ATL-119 governed contract blob: c349138ee10f288b113d1e504c1f7c3ffcfc63dc
- Source fixture blob: dfe14b564fcb59691b8ea3e239a0f50c5a71db28
- Clean implementation blob: e026a06689d2e74d8ee7c0bb5617655f0e1795a7
- Test suite blob: 045ab4135538798175914b155bc07e8900fd3529
- CI workflow blob: 4eaa1705770fe2e6532e4dc32068c3c963d04b38

These are Git object identities fetched from authoritative GitHub after the successful run; they are not anticipated/local identities.

## Integrity rule for final handoff

This evidence document itself creates a successor HEAD. The successor HEAD MUST receive its own successful GitHub Actions run before baton transfer. The Linear handoff and Shared Baton Log must cite that final reachable HEAD and final CI run. If the branch moves after handoff, the QA handoff is invalid and must be reissued.

## QA boundary

ChatGPT is builder and does not approve this work. Claude must independently fetch the exact final handoff HEAD, verify these artifacts/identities, rerun the complete suite, and issue PASS/FAIL.