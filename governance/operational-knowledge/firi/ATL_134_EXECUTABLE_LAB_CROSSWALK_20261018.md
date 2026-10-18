# ATL-134 FIRI executable lab integration — 2026-10-18

Status: EXPERIMENTAL / NOT RUNTIME CERTIFIED. This is an additive engineering crosswalk, not a change to the governed BOL-002 JSON.

## Sources inspected
- ATL-134 BOL-002 FIRI v1 candidate JSON (Git blob f47139811dad5a346c9ad894029e3dbcc1c780ea): 9 mechanism stages, R01–R08.
- ATL-134 validation evidence (Git blob fe8ad263a9b4332ac461dfe1dcaec03d05ef3cb4): T01–T13 are specification/adversarial PASS, **not executable runtime PASS**.
- Drive ATL-132 FIRI Candidate Architecture — Disaster Recovery Custody: 13 proof dimensions including source/layout, lexical, association, conditional grammar, conflicts, authority, confidence, provenance.
- Drive Atlas Execution-Readiness Intelligence Closure V1: Field Identification and Resolution Intelligence; Atlas governance vs consumer execution boundary.
- Drive ATL-146 BOL-002 FIRI v1 Promotion Freeze Custody: a later approved/promotion package exists on a different branch, with a final byte/hash verification gate recorded as pending in the retrieved Drive custody document. This must be reconciled before asserting that ATL-134 candidate is the latest canonical source.
- Local FIRI BOL Pilot Test Protocol v1.2 and FIRI Resolution Lab v0.3: four-arm A/B/C/D, evidence graph, six pre-integration unit tests; local artifacts are not GitHub runtime evidence.

## Rule-to-code status
| Rule | Experimental implementation | Remaining gap |
|---|---|---|
| R01 separate | Token-level contamination detection | Semantic decomposition and correct field/row association |
| R02 cardinality | Description-bearing group vs output count warning | Independent positively established commodity count |
| R03 HU/commodity distinction | No forced pallet-count inference | Proven many-to-many graph edges |
| R04 NMFC specificity | Fail closed / UNRESOLVED | Licensed, versioned classification authority |
| R05 packaging corroboration | Fail closed / UNRESOLVED | Corroboration semantics |
| R06 preserve observed text | Preserve observed text; no fabricated expansion | Full source-aware resolution state |
| R07 ClassIT+ | Fail closed / UNRESOLVED | Authority adapter and subitem logic |
| R08 unresolved | Explicit abstention/no guessed corrections | Pointed additional-evidence requests |

## Experimental implementation checkpoint
A local Python bridge `firi/canonical_rules.py` was built against the exact eight rule IDs/stages and verified by six additional unit tests; combined local suite: **12 passed**. This is not yet uploaded as source code in this GitHub branch and cannot be claimed as GitHub CI. No real BOL pilot, OCR adapter, Gemini integration or correction engine has been completed.

## Test gates
A = model-only baseline; B = same frozen A + deterministic FIRI; C = same frozen A + bounded semantic FIRI; D = guided extraction plus full resolution, separately attributed. Do not expose ground truth to any arm. Preserve immutable source evidence, prompt/version hashes, per-rule traces and regression accounting. No forced accuracy target.

## Governance
Keep existing ATL-134 JSON and 13 historical scenarios unchanged. The later ATL-146 promotion evidence means source authority must be reconciled before promoting executable rules. Do not silently downgrade/overwrite approved semantics, or infer production readiness from a schema or a test count.
