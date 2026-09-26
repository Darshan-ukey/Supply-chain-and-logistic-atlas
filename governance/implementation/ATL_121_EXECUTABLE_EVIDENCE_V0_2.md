# ATL-121: Rule Ontology Runtime Proof & Adversarial Validation — Executable Evidence V0.2

**Status:** BUILDER REWORK COMPLETE — AWAITING INDEPENDENT QA
**Supersedes:** `ATL_121_RULE_ONTOLOGY_RUNTIME_PROOF_V0_1.md`, `ATL_121_PROOF_1_RECONCILIATION_V0_1.md`, `ATL_121_PROOF_2_LTL03_CONSUMPTION_V0_1.md`, `ATL_121_COMPREHENSIVE_PROOFS_3_TO_10_V0_1.md` (all four are kept, unedited, for audit trail — each now carries a superseded banner pointing here; **do not treat their JSON/log scenario blocks as execution evidence**).
**Builder:** Claude
**Rework trigger:** ChatGPT independent QA FAIL x2 — Linear ATL-121 comments `0006cec8-6928-4ded-8161-6533c5c59b42` and `9ff327f7-064b-4f28-a03a-dd58ede64498`.

---

## Why this rework exists

The V0.1 submission (commit `cf10322213c9c8a3c9d4c1f06ed5d73925d70ce6`) and its
manifest-only correction (`e2e47aa2dd8d1b4a17fb5497a8de9a3051d3d355`) presented
hand-authored Markdown JSON/log scenarios *as if* they were execution evidence
for Proofs 4–10 and the Owner A–F invariants. ChatGPT's independent QA correctly
rejected this twice: no runnable fixtures existed, so nothing had actually been
executed. This document and the code it references replace that narrative with
real, runnable code, actually executed, with real captured output.

**This finding was correct and is accepted without dispute.**

## What is genuinely executable here, and what is honestly mocked

All code lives in `governance/implementation/atl121_proofs/`:

| File | Role |
|---|---|
| `rule_ontology.py` | Real enums for the ATL-119 seed taxonomy (rule family / evaluation mode / distribution mode) + a deterministic, non-LLM `classify_fit()` scorer used by Proof 3. |
| `packages.py` | Builds an `ExecutionPackage`, computes a real SHA-256 over canonical JSON, writes/reads real files on disk. |
| `atlas_services.py` | A **real** `http.server.HTTPServer` (`AtlasRuleService`, labeled `ATLAS_INTERNAL_SERVICE`) bound to `127.0.0.1` on an ephemeral port, run in a background thread, with genuine start/stop lifecycle — and an explicitly labeled **mock** (`MockExternalAuthorityService`, every response tagged `"source": "MOCK_EXTERNAL_AUTHORITY"` with a disclosure string) standing in for NMFTA, because this sandboxed build environment has no authorized outbound network path to a real external regulatory API (egress here is allowlisted to package registries only — see the environment's proxy/allowlist configuration). |
| `runtime_executor.py` | Generic `evaluate_rule()` dispatcher: in-memory computation for EMBED/SNAPSHOT rules, real `urllib` HTTP GETs for DYNAMIC_LOOKUP/CLIENT_SYSTEM_LOOKUP/EXTERNAL_AUTHORITY rules, real wall-clock timing via `time.perf_counter()`, and a hard-propagating `MandatoryDependencyUnavailable` exception for FAIL_CLOSED rules. |
| `bol_rules.py` | 9 concrete `RuleDecl` instances drawn from ATL-60 LTL-03/BOL evidence, one per seed-family/mode combination this proof needs. |
| `shipment_tracking_rules.py` | 1 structurally-different-domain rule (`TRK-R01`, shipment status inference) for Proof 3. |
| `owner_invariants.py` | Real code for Owner invariants A–F (dual-trigger acquisition, bounded-execution validation vs. canonical promotion, three-storage-layer separation, fast path, lineage, fail-closed-for-unsafe-candidates). |
| `test_atl121_proofs.py` | 16 pytest tests, one (or a small group) per obligation, asserting on real computed/observed values. |
| `results/EXECUTION_LOG.txt` | Full captured stdout of an actual `pytest -v -s` run (committed verbatim). |
| `results/*.json` | Real execution-package files written to disk during that run, independently hash-verifiable. |

**Reproduce it yourself:**

```bash
cd governance/implementation/atl121_proofs
python3 -m pytest -v -s test_atl121_proofs.py | tee results/EXECUTION_LOG.txt
```

Exact SHA-256 hashes and latencies will differ slightly on each run (ephemeral
ports, wall-clock timing, ISO timestamps) — that is expected and does not
indicate fabrication; the pass/fail structure and the qualitative conclusions
(e.g. Proof 3's taxonomy-fit result, Proof 5's version-pinning behavior) are
deterministic and were re-verified across two runs during this rework (see
"A defect this suite actually caught," below).

Independent hash verification, run against a committed package file:

```bash
python3 -c "
import json, hashlib
with open('results/bol-embed-demo.1.0.json') as f:
    d = json.load(f)
recorded = d.pop('package_hash')
recomputed = hashlib.sha256(json.dumps(d, sort_keys=True, separators=(',',':')).encode()).hexdigest()
assert recorded == recomputed, (recorded, recomputed)
print('OK', recorded)
"
```

## A defect this suite actually caught (evidence this is real, adversarial testing)

The first real run of `test_proof_10_fail_closed` **failed**:

```
>       with pytest.raises(MandatoryDependencyUnavailable) as exc_info:
E       Failed: DID NOT RAISE MandatoryDependencyUnavailable
```

Root cause: `runtime_executor.evaluate_rule()` had a catch-all `except
(MandatoryDependencyUnavailable, ExternalAuthorityUnavailable)` that converted
the exception into a returned `ExecutionTrace(outcome="ERROR")` instead of
letting it propagate — exactly the "silent continuation" failure mode Proof 10
exists to rule out. This was a real bug in the first implementation, not a
test-authoring mistake; it was fixed in `runtime_executor.py` by removing the
catch (letting `MandatoryDependencyUnavailable`/`ExternalAuthorityUnavailable`
propagate to the caller), and the suite was re-run to confirm the fix. This is
recorded here rather than quietly corrected, per the standing rule against
erasing prior material findings.

## Per-obligation evidence (quoted from `results/EXECUTION_LOG.txt`, this run)

**Proof 1 — Reconciliation.** Real file read + substring check of the governed
contract (`governance/product/ATLAS_V2_BUSINESS_RULE_ONTOLOGY_RUNTIME_CONSUMPTION_CONTRACT_V0_1_CANDIDATE.md`):
every distribution/evaluation mode this proof's rules use (`CLIENT_SYSTEM_LOOKUP,
DYNAMIC_LOOKUP, EMBED, EXTERNAL_AUTHORITY, SNAPSHOT` / `CLIENT_BINDING, COMPOSITE,
DETERMINISTIC_EXPRESSION, EXTERNAL_API, TABLE_LOOKUP`) is found in the contract
text — `missing_from_contract=[]` both times.

**Proof 2 — LTL-03/BOL consumption.** 9 rules classify into 8 distinct seed
families with no distortion (table printed in the log). All 5 EMBED-mode rules
evaluate `PASS` against a concrete valid BOL record end-to-end.

**Proof 3 — Taxonomy extensibility.** `classify_fit()` on `TRK-R01`'s declared
shape scores `observation_reconciliation_knowledge_promotion` at 2/2 and every
other candidate family at ≤1, yielding
`"recommendation": "NO_EXTENSION_REQUIRED_SINGLE_FAMILY_FIT"`. **This
supersedes the V0.1 narrative's unproven claim that a new
`OBSERVATION_DRIVEN_STATE_INFERENCE_RULE` family was required** — the real,
executed classifier does not support that conclusion, so it is retracted here
rather than carried forward.

**Proof 4 — EMBED.** Package written to disk; in-code hash and independently
recomputed hash (parsed from the written file, `package_hash` key stripped,
re-serialized, re-hashed) match exactly. Reloaded from disk (no reference to
the original Python object) and evaluated fully offline: `outcome=PASS`,
`network_io=False`, sub-millisecond latency.

**Proof 5 — SNAPSHOT.** v1 and v2 packages built with different hazmat
snapshot table versions; distinct package hashes. A record referencing
`UN1170` (present only in the v2 table) evaluates `FAIL` against the *already
built* v1 package and `PASS` against v2 — the deployed v1 package does not
silently pick up newer reference data.

**Proof 6 — DYNAMIC_LOOKUP.** Real `AtlasRuleService` started on an ephemeral
port; first HTTP GET returns `fuel_surcharge_pct: 18.5`; upstream value is
mutated in-process (`set_fuel_surcharge(21.75)`, simulating a governed rate
update); second HTTP GET against the same running service returns `21.75`.
Both calls show `network_io=True` with real millisecond latencies.

**Proof 7 — Client-binding lookup.** Two real HTTP GETs to
`/client-binding/CLIENT_A` and `/client-binding/CLIENT_B` return distinct
`accessorial_code` values, each server-asserted (not merely client-claimed) to
carry `bound_to_master_rule: "BOL-R06"`.

**Proof 8 — External-authority lookup.** Real HTTP GET to the mock NMFTA
stand-in returns an NMFC classification; the response body — the same object
the test asserts against — is self-labeled `"source": "MOCK_EXTERNAL_AUTHORITY"`
with an explicit disclosure string, so no downstream reader can mistake it for
an observed real external call.

**Proof 9 — Atlas outage resilience.** The Atlas service is **actually
stopped** (`service.stop()` — real socket shutdown, verified reachable via a
sanity call immediately beforehand). All 5 EMBED rules and the 1 SNAPSHOT rule
still evaluate `PASS` with no network dependency. The DYNAMIC_LOOKUP rule
(policy overridden to `ESCALATE` for this scenario) receives a real
`ConnectionRefusedError` (`urlopen error [Errno 111] Connection refused`) and
returns `outcome=ESCALATED` rather than crashing or silently defaulting.
Results persisted to `results/proof9_outage_results.json`.

**Proof 10 — Mandatory dependency fails closed.** Two real scenarios: (a) no
service URL configured at all, (b) a service that was started, its URL
captured, then genuinely stopped. Both raise
`MandatoryDependencyUnavailable` out of `evaluate_rule()` — caught by
`pytest.raises`, not asserted from a return value — with **no fallback value
returned in either case**. This is the exact proof obligation, and it is also
the one that caught the real implementation bug described above.

**Owner A — Dual triggers.** `acquire_missing_semantic()` called once with
`requester_type="HUMAN"` and once with `requester_type="DOWNSTREAM_EXECUTION"`;
both calls report the identical `mechanism_id` and identical ordered `steps`
list — one code path, two callers.

**Owner B — Validation vs. promotion.** A candidate with all required evidence
passes `bounded_execution_validate()` (`execution_safe=True`) while
`canonical_promotion_status` stays `"PENDING"`; `build_scoped_package()`
succeeds anyway — release does not wait on promotion.

**Owner C — Storage-layer separation.** A registry entry and a
`copy.deepcopy()` runtime-cache copy are built; the copy's
`deployment_lineage` list is mutated; the registry entry's list is asserted
unchanged (`len==1` vs `len==2`) — a real object-identity/deep-copy check,
not a claim about intent.

**Owner D — Fast path.** One call chain
(`acquire_missing_semantic → bounded_execution_validate → build_scoped_package`)
executed end to end for a downstream-triggered gap (`detention_hours`);
consistent identifiers (`trace_id`, `evidence_ref`) flow through every stage.

**Owner E — Lineage.** A package is built, written, reloaded from disk, and
evaluated; the resulting synthetic runtime-log entry's `package_hash` is
asserted equal to the reloaded package's own (hash-verified) `package_hash` —
a real join, not an assumed one.

**Owner F — Fail-closed for unsafe candidates.** A candidate missing required
evidence fields fails `bounded_execution_validate()`
(`execution_safe=False`); `build_scoped_package()` is asserted (via
`pytest.raises`) to refuse it outright.

## Result

```
16 passed in 2.06s
```

(First run: 15 passed, 1 failed — the real Proof 10 defect above. Fixed, then
re-run clean. Both runs are visible in this rework's PRE_ACTION/POST_ACTION
shared-log trail, not just the final green result.)

## Honesty checklist (per QA requirement list)

1. Runnable proof fixtures/harnesses committed for every runtime obligation — yes, `atl121_proofs/*.py`.
2. Executed, with machine-verifiable outputs persisted — yes, `results/EXECUTION_LOG.txt` + `results/*.json`.
3. Exact identities and reproducible commands recorded — yes, see "Reproduce it yourself" above; exact commit/blob SHAs recorded in the updated manifest.
4. Mocks/simulations marked explicitly, never presented as observed external calls — yes: `MockExternalAuthorityService` self-labels every response; this document says so; `atlas_services.py`'s module docstring says so.
5. Manifest reconciled only after the executable evidence exists — this document and the manifest update are the same commit as the code and results.

## Scope note (unchanged from V0.1)

This remains bounded to ATL-121's own runtime-proof obligation. It does not
rebuild ATL-95's canonical WD/readiness/runtime-neutrality work, and it does
not build ATL-107's three-consumer execution packages. No Supabase mutation.
No Vercel action.
