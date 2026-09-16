# AR0.3 — Readiness Verification Contract / Resolver — DRAFT V1

**Status:** CLAUDE DRAFT — UNREVIEWED — NOT GOVERNED  
**Author:** Claude (execution agent)  
**Effective:** N/A until ChatGPT verification and Owner freeze  
**Governed by:** `CANONICAL_GENERATION_AND_FREEZE_ASSET_STANDARD_V1.md` @ `58d6d057`; `CONTROLLED_PHASE_EXECUTION_AND_RECOVERY_GATE_V1.md` @ `a523ad3a`; `BOUNDED_CORRECTIONS_CLOSURE_V1.md` @ `5041441` §5  
**AR0.3 sequence note:** this is AR0.3 item 7 (Z6 readiness/resolution contract). It is drafted ahead of items 1–6 (common identity envelope, Z1–Z5 contracts) as a **deliberate, scoped, Owner-directed exception** — a proof-of-concept demonstrating the recovery/verification mechanism can actually work, not a claim that AR0.3 items 1–6 are complete or that this contract is final. See §5.

## 0. Why this exists

The Owner approved AR0.2 V2 conditional on the build *process* itself being foolproof: no missed details, no drift, no unverified state becoming permanent truth, and the ability to resume from the last verified point without reconstructing product thinking from scratch on failure. `BOUNDED_CORRECTIONS_CLOSURE_V1.md` §5 (BC-3) already names the mechanism required to make that testable rather than aspirational: a readiness resolver that proves state, not one that asserts it. This draft is a first attempt at that mechanism, offered for independent verification before anything gets built.

## 1. Purpose

Given a declared scope (an exact, version-closed set of governed Atlas objects) and a target readiness state, deterministically compute whether that scope satisfies the state's criteria, and if not, return the exact blocking gaps rather than a bare pass/fail.

## 2. Engine classification

**G1 — Deterministic materializer/compiler/resolver**, per `CANONICAL_GENERATION_AND_FREEZE_ASSET_STANDARD_V1.md` §4.

Requirement this contract must satisfy: given the same frozen inputs, resolver version and ruleset version, the engine reproduces the same result. Output serialization must be deterministic (stable key ordering) so byte equality is achievable; if any input has non-deterministic identity, normalized semantic equality plus hashable canonical serialization applies instead.

## 3. Generator Contract

*(Following the mandatory 13-element template, `CANONICAL_GENERATION_AND_FREEZE_ASSET_STANDARD_V1.md` §3.)*

### 3.1 Engine ID and semantic purpose
`atlas-readiness-resolver-v1` — evaluates and proves execution-readiness state for a declared scope; does not create, approve or mutate business semantics.

### 3.2 Owned input contract(s) and required versions
A **Readiness Scope Declaration**: the exact set of governed object IDs+versions the check applies to (e.g. a Road LTL 1.5 domain slice, an enterprise binding set). Each referenced object must carry its own version/hash — this contract does not itself mint identity, it consumes identity that AR0.3 items 2–6 (Z1–Z5 contracts) must define. Until those exist, this section is intentionally underspecified — see §5.

### 3.3 Output contract/schema
```
ReadinessResult {
  state_evaluated: DOMAIN_EXECUTION_READY | ENTERPRISE_EXECUTION_READY | RUNTIME_IMPLEMENTATION_READY
  result: READY | NOT_READY | BLOCKED | NOT_APPLICABLE
  blockers: [{ blocker_id, zone, object_id, reason, severity }]   // ALL blockers, not first-found
  dependency_chain: [{ predecessor_state, predecessor_result }]
  proof: {
    resolver_version, ruleset_version,
    input_object_ids_versions_hashes: [...],
    evaluation_run_id, evaluation_timestamp
  }
  monotonicity_check: { passed: bool, explanation }
}
```

### 3.4 Transformation/resolution/generation rules
- `DOMAIN_EXECUTION_READY`: every in-scope Z1 object has no open semantic gap; decomposition resolves to terminal leaves only; no dangling/orphan canonical references; no unresolved "latest" (floating) version references.
- `ENTERPRISE_EXECUTION_READY`: requires `DOMAIN_EXECUTION_READY` = READY first (see monotonicity, §3.5). Then: every declared binding-required slot has a resolved Z2 value or an explicit, governed `NOT_APPLICABLE`.
- `RUNTIME_IMPLEMENTATION_READY`: requires `ENTERPRISE_EXECUTION_READY` = READY first. Then: the target downstream tool's capability/gap assessment is resolved or explicitly governed.

### 3.5 Ordering, precedence and conflict rules
States evaluate strictly in order DOMAIN → ENTERPRISE → RUNTIME. If an earlier mandatory state is not READY, the later state's result is `BLOCKED` — never independently evaluated, never silently treated as `NOT_READY` (which would imply "checked, and no"). This is the literal enforcement of RB-05's monotonicity invariant, closing the exact gap identified in BC-3.

### 3.6 Deterministic/non-deterministic classification
Deterministic (G1). No network calls, no live queries, no randomness during evaluation — the resolver runs entirely against the frozen input set named in the Readiness Scope Declaration. This is deliberate: it is what makes §7's recovery claim provable rather than asserted.

### 3.7 External dependencies and versions
Runtime: Node.js (version pinned at implementation time, matching existing repo convention). No external services during evaluation.

### 3.8 Parameters/configuration/defaults
- `ruleset_version` — which governed version of §3.4's rules is applied.
- `strict_mode` — default `true`. Ambiguous or partially-missing input never defaults to READY; it fails closed to `BLOCKED`.

### 3.9 Provenance/lineage emitted into outputs
Every result embeds: exact input object IDs/versions/hashes checked, resolver code version (commit hash), ruleset version, run ID, timestamp. This is what makes a stored result independently checkable later without needing the original session — directly serving the Owner's "pick up from the last verified point" requirement.

### 3.10 Validation rules and failure states
Following the fail-closed pattern already used in this repo's prior certification-gate work (studied for reference only, not restarted): a missing, unreadable or malformed input is a hard failure, never a warning and never silently skipped. An undefined/unrecognized readiness state requested is a hard failure. Partial data is `BLOCKED`, never inferred as READY.

### 3.11 Promotion rule
A `READY` result is a derived proof, not new canonical truth (per the Constitution's own rule that presentation/derived analysis is never authority). It should be logged for audit but re-evaluated whenever any input object's version changes — never cached indefinitely as if permanent.

### 3.12 Rollback/rebuild method
Because this engine is a pure deterministic function of frozen, versioned inputs, "rebuild" means: re-run the resolver against the same frozen input set with the same resolver/ruleset version, and confirm the same result. This is the PC-5 recovery proof, built into the engine's own design rather than bolted on afterward.

### 3.13 Compatibility rules with prior/successor versions
A new resolver or ruleset version must never silently reinterpret a previously stored `ReadinessResult`. Old results remain valid evidence under the version they were computed with. A new version produces a new evaluation instance; it does not overwrite history — matching the Generation Standard's "do not overwrite the old baseline" rule.

## 4. Traceability to BC-3's seven requirements

| BC-3 requirement | Satisfied by |
|---|---|
| 1. evaluate exact version-closed scope and dependencies | §3.2 Readiness Scope Declaration |
| 2. fail closed on unresolved predecessor-state gaps | §3.5 ordering rule; §3.10 fail-closed validation |
| 3. enforce monotonicity | §3.5 — later state is `BLOCKED`, not independently evaluated, if earlier state isn't READY |
| 4. expose blocker IDs and dependency chain | §3.3 output schema — `blockers[]`, `dependency_chain[]` |
| 5. distinguish NOT_READY / BLOCKED / NOT_APPLICABLE | §3.3 output schema `result` enum; §3.4 rules |
| 6. record verifier/rule-set/proof identity | §3.9 provenance/lineage |
| 7. deterministic for same frozen inputs/rules | §2, §3.6 |

## 5. Open dependencies — honestly flagged, not silently assumed

This contract **cannot** fully specify how Z1/Z2/Z4/Z5 objects obtain their version/hash identity, because AR0.3 items 1–6 (the common identity envelope and the Z1–Z5 contracts) have not been written yet. What this draft does instead: it states exactly what the resolver *needs* from those upstream contracts — a stable, hashable, versioned identity for every governed object it might reference. That requirement should inform how items 1–6 get designed, which is a genuine (if unplanned) benefit of drafting this out of sequence. It is not a substitute for writing them.

This draft is **specification only**. No implementation, schema or engine code exists yet, consistent with the current hard stop on AR0.3 implementation pending design review.

## 6. Worked example (illustrative, non-binding)

Road LTL 1.5 is the natural first test case — it already has governed decomposition evidence (603 work units / 444 terminal leaves, zero cycles/orphans, per P6.1's certified record). A `DOMAIN_EXECUTION_READY` check on a Road LTL 1.5 scope would, under this contract: walk every terminal leaf, confirm no open Z1 semantic gap and no dangling reference, and either return `READY` with full provenance or `BLOCKED` with every specific gap named. This example is illustrative of the mechanism only — no such check has actually been run against real data through this design yet, and it should not be read as a completed evaluation.

## 7. How this satisfies the Owner's actual requirement

The Owner's standard was explicit: not just "does the architecture support the vision," but "if something fails mid-build, can we resume from the last verified point instead of rebuilding the thinking." Restating the Recovery Gate's own governing question: *"If the current working environment disappeared tomorrow, could Atlas reproduce or restore this phase exactly enough to prove what was approved, recover the working system, and continue safely from the same governed state?"*

This contract, if correctly implemented, answers yes for readiness state specifically: any stored `ReadinessResult` carries everything needed (§3.9) for a new operator or agent, with no access to the original session, to re-run §3.12's rebuild method and independently confirm the state was real — not re-derive it from memory or trust.

## 8. What this draft is not

- Not implementation. Not a schema. Not authorized to run against production data.
- Not a claim that AR0.3 items 1–6 are complete.
- Not reviewed. Every rule above is Claude's first-pass reasoning and may be wrong, incomplete, or in tension with something ChatGPT knows that this draft doesn't account for.

## 9. Required next step

Independent verification by ChatGPT, per the work division already in the shared log: check this against the governing standards line by line, and either correct it in place or write a replacement following the same Generator Contract mechanism — whichever produces the more defensible contract. Full latitude; nothing here is precious.
