# ATL-70 — Benchmark, Ground Truth & Metrics Contract v1.0

Status: FROZEN PRE-EXPERIMENT / READY FOR INDEPENDENT QA
Date: 2026-09-27
Governed input: ATL-69 commit 6a67854b75b567344f474ba59544717cd49770ce
Frozen field universe: 76 total; primary experiment scope = 66 testable; 10 excluded exactly as ATL-69.

## 1. Purpose and non-negotiable freeze
This contract defines ground truth, denominators, metrics, ambiguity handling, error taxonomy, control/treatment comparison, leakage controls, and reporting before any benchmark run. Results MUST NOT change field eligibility, metric definitions, denominators, thresholds, or adjudication rules. Any later change requires a versioned contract, evidence, rationale, and rerun; it cannot overwrite v1.0 results.

## 2. Evaluation unit and denominators
Primary atomic evaluation unit = (document_id, semantic field, semantic owner/item occurrence, ground-truth value).
- Source document universe: approximately 500 BOLs; actual immutable document IDs and count are frozen at benchmark-manifest creation before inference.
- Field scope: 66/76 from ATL-69.
- Ten excluded fields remain outside primary scoring: 6 CLIENT_BINDING_REQUIRED, 3 MASTER_DATA_REQUIRED, 1 SEMANTICS_UNRESOLVED.
- Conditional fields enter a metric denominator only where applicability is independently established from source/ground truth, never from model output.
- Repeating line/item structures are occurrence-aware; collapsing multiple items into one answer is an error.
- AREA is eligible where source evidence exists; value + unit are atomic and normalized unit is YDK when square yard is evidenced.
- Time Critical Details Type: literal source extraction may be scored; normalized-code correctness is not scored until a coding authority is frozen.

Every reported metric MUST disclose numerator, denominator, excluded count, unscorable count, and applicable population.

## 3. Ground-truth source and construction
Ground truth must be derived from the frozen source BOL image/PDF and, only where explicitly permitted, authoritative pre-existing labels whose provenance predates experiment output.
For each scored instance store:
- document_id and immutable source reference/hash;
- field canonical ID/name and semantic owner;
- occurrence/item index where repeating;
- raw source transcription;
- canonical/normalized expected value where rules are already frozen;
- unit where applicable;
- applicability: APPLICABLE / NOT_APPLICABLE;
- label state: RESOLVED / AMBIGUOUS / ILLEGIBLE / MISSING_SOURCE;
- provenance and adjudicator identity/version.

No model-generated output, Atlas treatment output, post-run correction, or benchmark prediction may create or alter ground truth.

## 4. Validation/adjudication method
1. First-pass annotation from source evidence using the frozen field definition.
2. Ambiguous, conflicting, illegible, or semantically uncertain cases go to adjudication before scoring.
3. Adjudication may resolve a label or mark it UNSCORABLE; it may not infer unsupported client/master semantics.
4. A sample of resolved labels must receive independent second review; all disagreements are logged and reconciled before final scoring.
5. Ground-truth version/hash is frozen before control or treatment inference is evaluated.

## 5. Missing and ambiguous labels
- NOT_APPLICABLE: excluded from that field's applicable denominator; reported separately.
- MISSING_SOURCE: source genuinely does not contain the applicable value; test false-positive behavior separately, not extraction recall.
- ILLEGIBLE: unscorable unless an independent authoritative label predating inference resolves it.
- AMBIGUOUS: unscorable until adjudicated.
- UNKNOWN CLIENT/MASTER SEMANTICS: remains excluded under ATL-69; never guessed.
Unscorable cases are never counted as correct and never silently dropped; counts and reasons are mandatory.

## 6. Frozen metrics
### M1 Field extraction exact accuracy
Correct exact/literal extraction / scorable applicable extraction instances. Normalization permitted only by frozen deterministic rules.

### M2 Field presence precision/recall
Presence precision = correct predicted presences / all predicted presences.
Presence recall = correct predicted presences / all ground-truth presences.
Report F1 as secondary; never substitute F1 for precision and recall.

### M3 Semantic/contextual resolution accuracy
Correct canonical semantic interpretation / scorable instances requiring contextual resolution. Requires correct semantic owner, relationship, and cardinality; literal text alone is insufficient.

### M4 Validation/exception accuracy
For instances with a frozen validation rule: correct VALID/EXCEPTION classification / scorable validation instances. Also report exception precision and exception recall separately.

### M5 Usable-output accuracy
An instance is usable only if value, required normalization, semantic owner, occurrence/cardinality, and required unit/relationship are all correct. Usable correct instances / scorable applicable instances.

### M6 Document-level completeness
For each document: correctly usable required applicable instances / all scorable required applicable instances. Report mean, median, distribution, and % documents at 100%; do not report only an aggregate field average.

### M7 Touchless eligibility
A document is touchless-eligible only if every required scorable applicable instance is usable-correct AND no unresolved validation exception requiring human action remains. Report eligible documents / documents with sufficient scorable ground truth. This is experimental eligibility, not production billability.

### M8 Error taxonomy rates
Every scored failure gets one primary error code:
E1 missed presence; E2 false presence; E3 transcription/extraction; E4 normalization/unit; E5 semantic owner/relationship; E6 cardinality/line association; E7 contextual resolution; E8 validation/exception; E9 unsupported inference/hallucination; E10 ground-truth/data-quality issue (reported but excluded from model-error numerator after adjudication).
Report counts and rates by field and document.

## 7. Control vs treatment
The same frozen document manifest, 66-field scope, ground truth, applicability rules, scoring code/version, and denominators must be used for both arms.
- Control = baseline extraction/execution path frozen before evaluation.
- Treatment = Atlas-enriched path frozen before evaluation.
- No arm-specific exclusions or label corrections.
- Pair comparisons by document/field instance wherever possible.
Report absolute metric for each arm plus absolute and relative delta. Do not claim causality if execution conditions differ.

## 8. Leakage controls
- Benchmark documents/labels may not be used to author treatment rules after ground truth is inspected.
- Ground truth and adjudication artifacts are inaccessible to inference prompts/runtime.
- No manual correction of model output before scoring.
- Prompt/rule/model/config versions are frozen and hashed before run.
- Any development subset must be disjoint from the final evaluation set and explicitly identified.
- Reruns after observing results require a new run ID and retain prior results.
- Exclusion or denominator changes after results require a new contract version and full comparable rerun.

## 9. Success-reporting format
Every benchmark report must include:
1. contract version/hash, run ID/date, control/treatment versions;
2. frozen document count and 66/76 scope statement;
3. 10 ATL-69 exclusions and any unscorable ground-truth counts;
4. M1-M8 with numerator/denominator and confidence interval where statistically appropriate;
5. per-field and per-document breakdowns, including conditional-field applicable Ns;
6. error taxonomy Pareto;
7. control vs treatment absolute/relative deltas;
8. touchless-eligibility count with explicit caveat that it is not production billability;
9. all deviations, adjudications, reruns, and contract-version changes.

## 10. Acceptance reconciliation
- Metrics frozen before experiment: YES.
- Denominators frozen before experiment: YES — 66/76 primary scope; applicability rules explicit.
- Ground-truth source and validation method frozen: YES.
- Missing/ambiguous-label handling frozen: YES.
- Success-reporting format frozen: YES.
- Control/treatment and leakage controls frozen: YES.
- No cherry-picking/post-result denominator changes: explicitly prohibited.

ATL-71 remains blocked until independent ATL-70 QA PASS and explicit Baton handoff.
