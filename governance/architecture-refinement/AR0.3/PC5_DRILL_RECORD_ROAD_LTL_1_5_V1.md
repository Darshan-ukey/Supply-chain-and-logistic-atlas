# PC-5 Recovery/Rebuild Drill Record — Road LTL 1.5

**Drill ID:** `pc5-drill:road-ltl-1.5:001`
**Executed by:** Claude (execution agent), on Owner authorization following ChatGPT implementation re-QA PASS
**Contract:** `READINESS_VERIFICATION_CONTRACT_DRAFT_V1.md` §9
**Standard:** `CONTROLLED_PHASE_EXECUTION_AND_RECOVERY_GATE_V1.md` PC-5
**Risk classification:** HIGH-RISK (not self-downgraded)

---

## Disposition

| | |
|---|---|
| **PC-5 recovery mechanism** | **PASS** |
| **Road LTL 1.5 readiness** | **BLOCKED** — and this is the correct, expected result |
| **Reproducibility** | Byte-identical semantic result across full environment destruction |

**These are two separate findings and must not be conflated.** The recovery mechanism works. Road LTL 1.5 is not ready. The drill proves the former by correctly and reproducibly demonstrating the latter.

---

## The nine required steps

| Step | Outcome |
|---|---|
| 1. Identify exact scope + upstream identities | 22 certified LTL tasks, 4 dependencies, from P6.1 certification at `0720853` |
| 2. Build frozen package without session memory | `tools/build-road-ltl-drill-package.mjs` — extracts from git by explicit SHA only |
| 3. Run independently implemented resolver | resolver v2.0.0 @ `0f9f695` |
| 4. Record blockers + proof identity | 25 blockers; `proof:DOMAIN_EXECUTION_READY:cd8df21a57c41b80` |
| 5. Freeze/custody baseline | `CUSTODY_MANIFEST.sha256` over package + proof |
| 6. Destroy working environment | working clone and all working evidence deleted; custody only survivor |
| 7. Restore from governed artifacts only | fresh `git clone` from GitHub at `aaf74f3` |
| 8. Reproduce + validate independently | package **byte-identical**; semantic hash **identical**; both proofs self-consistent |
| 9. Record result / closure / rollback / next phase | this document |

**Semantic result hash, both runs:** `66b136cdfbb17aa7716a164df432c395c657315e74b012343e5b533e03a37bea`

Run metadata differed between the two runs (distinct run IDs and timestamps), confirming these were genuinely separate executions rather than a copied artifact — while the semantic payload remained identical, exactly as the contract's determinism separation requires.

---

## Blockers — all 25 genuine, none synthetic

| Count | Type | Meaning |
|---|---|---|
| 22 | `COVERAGE_NOT_DECLARED` | No LTL task declares which semantic classes it provides. No upstream completeness contract exists to define them. |
| 1 | `INVENTORY_NOT_DECLARED` | No semantic coverage attestation exists for Road LTL 1.5. |
| 1 | `DEPENDENCY_CLOSURE_INCOMPLETE` | The P6.1 decomposition output is not retrievable from governed artifacts. |
| 1 | `UPSTREAM_CONTRACTS_UNFROZEN` | `GOVERNED_SCOPE` correctly blocks pending upstream AR0.3 contracts. |

The package builder **omitted** semantic classes and the coverage attestation rather than supplying plausible values. Fabricating either would have manufactured a false READY. Omission is the honest representation of a genuinely undeclared state.

---

## MATERIAL GOVERNANCE FINDING — P6.1 baseline recoverability gap

The drill surfaced a real gap that was not its target.

The P6.1 certification (`P6_1_RECURSIVE_WORK_DECOMPOSITION_CERTIFICATION.json`) records:

```
protectedBundle.committedToGitHub:      false
backend.store:                          SUPABASE_PROTECTED_EXECUTION_STORE
protectedBundle.workUnitCount:          603
independentExecutorProofStatus:         NOT_INDEPENDENTLY_PROVEN
workDefinitionCompilationStatus:        NOT_STARTED
```

**The 603 work units / 444 terminal leaves that P6.2 and every later phase consume are not recoverable from GitHub.** They exist only in a protected Supabase store. The certification itself states this; it is not a discrepancy in the record, but it is a live PC-5 exposure in the P6.1 baseline.

Measured against PC-5's own governing question — *if the working environment disappeared tomorrow, could Atlas recover and continue from the same governed state?* — the answer for the P6.1 decomposition output is currently **no from GitHub alone**. Recovery depends entirely on the Supabase protected store remaining intact and accessible.

This is a finding for the Owner and ChatGPT, not something the execution agent should resolve unilaterally. It is recorded, not actioned.

---

## Secondary finding — dependency closure spans branches

The P6.1 certification cites `baseModuleSha256` for the v1.4 semantic base. **That artifact is not present on the P6.1 branch.** It was located on later branches (AR0.x, recovery branches) with an exact content-hash match.

An initial read suggested the base was missing entirely. Exhaustive content-hash search across all branches disproved that before it was recorded. The correct finding is narrower: the closure is intact but **not branch-local** — checking out the P6.1 branch alone does not yield the full dependency chain.

PC-6 requires exact upstream dependencies be recorded. This drill records them with their actual retrieval locations, which differ from the branch a reader would naturally assume.

---

## Lineage verification

All three identity claims in the P6.1 certification were independently verified against actual artifact content:

| Claim | Result |
|---|---|
| `v15ModuleOverlayGitBlobSha` | VERIFIED |
| `v15OperationalOverlayGitBlobSha` | VERIFIED |
| `baseModuleSha256` | VERIFIED (via cross-branch retrieval) |

---

## Rollback point

`0f9f695dce0e3f0fcb3667c82784694a179601e0` — resolver v2.0.0, 90/90 tests passing, ChatGPT re-QA PASS. Known-good, immutable, independently verified.

Drill tooling added at `aaf74f3`. Neither the drill nor this record mutates any prior baseline.

---

## What this drill does NOT establish

- Road LTL 1.5 is **not** execution-ready. Nothing here should be cited as readiness progress.
- The resolver's DOMAIN rules remain proven only against fixtures and this one real BLOCKED scope. No real scope has yet produced a READY, by design.
- No Supabase state was read, written or mutated. The protected bundle's inaccessibility was established from the certification record, not by attempting access.
- R0.4/P6.x remain suspended. No production promotion.

---

## Recommended next actions — recommendation only

1. **Owner/ChatGPT decision** on the P6.1 recoverability gap: whether the protected decomposition bundle requires a governed, recoverable custody path before any later phase consumes it.
2. AR0.3 items 1–6 (identity envelope, Z1–Z5 contracts) remain the blocking prerequisite for Road LTL ever reaching a non-blocked evaluation — the 22 `COVERAGE_NOT_DECLARED` blockers are precisely their absence.
3. Independent ChatGPT verification of this drill record against the frozen evidence.

The execution agent does not self-authorize the next phase.
