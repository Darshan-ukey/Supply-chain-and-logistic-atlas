# ATL-146 — Claude Independent Re-QA Result (V1)

**Date:** 2 Oct 2026
**QA agent:** Claude (independent; did not author or promote any ATL-146 artifact)
**Directive:** Owner re-QA directive, `claude_chatGPT.md` § "ATL-146 — OWNER RE-QA DIRECTIVE TO CLAUDE — 01 OCT 2026"
**Standard:** `governance/product/ATLAS_V1_5_QA_OUTCOME_ARCHITECTURE_STANDARD_V1.md`
**Subject:** `darshanukey/atl-146-bol-002-freeze-promotion`, frozen head `e476fb973eb72b0070b0ba1114a7eb93102ed110`
**Method:** every fact below was re-derived from the Git objects and by running code. Copilot PR #23 (`5cb4285`) and the freeze record were treated as evidence to test, not as conclusions.

## Verdict

**FINAL: `PASS_WITH_BINDING_CORRECTIONS` — bounded BOL-002 reference proof only.**
**ATL-147 remains LOCKED until binding corrections B1–B4 are applied and Claude re-verifies them.**

`FINAL_BYTE_HASH_VERIFICATION: PASS` (hash identity only; see §1). The package bytes are sound. The defects are in the regression guard, in the sufficiency claim attached to the package, and in missing ATL-146 closure deliverables.

## 1. What independently verified (PASS)

| Check | Result |
|---|---|
| Recompute digest at `dc4d24b` with the governed command (`bun scripts/hash-bol-intelligence.ts`) | `sha256:a11b6090baab7a02c6ec2e151d09276f664ec131a08e6fcf868ed9a6f39b27bc` — equals the persisted value |
| Same digest at `4ac2581` (pre-persistence) and `e476fb9` (freeze head) | identical at all three |
| Independent re-implementation (code-unit key sort, JSON round-trip, written separately) | identical digest |
| Persistence step `4ac2581 → dc4d24b` | word-level diff = exactly one token (`PENDING_DETERMINISTIC_REHASH` → the digest). After blanking only that value the two files are byte-identical (`ffcf72c1…a9f13`) |
| Blob identity | `dc4d24b:…/bol-intelligence.ts` = `fbb7b5e4872504c587758d5f5bec839afdb6ffdb`, matches the log and freeze record |
| Negative control | changing one character in a rule string changes the digest to `d01b1b22…587a7`, so the check can fail |
| Locale sensitivity | digest unchanged under C / en_US / tr_TR / sv_SE; all 74 distinct property names are lowercase snake_case, so `localeCompare` and code-unit orders coincide (see N1) |
| `vite build` and `tsc --noEmit` at `e476fb9` (bun, lockfile install) | both exit 0 |
| Package integrity | 76 fields, 0 duplicate IDs, FIRI payload on BOL-002 only, 8 rules (R01–R08) in both candidate JSON and TS package (IDs compared, not content) |
| Semantics unchanged by promotion/persistence | `a81ac36` only removes the BOL-002 override and relabels version/notice text; `dc4d24b` changes only the hash value |

## 2. Findings requiring correction

### F1 — HIGH — The required regression guard FAILS at the frozen head (BUILD_CORRECTNESS)

`npm run validate:bol002-firi` (run as `node scripts/validate-bol002-firi.mjs`), bisected per commit:

| Commit | Guard |
|---|---|
| `54a7d3c` | PASS |
| `a81ac36` | FAIL (stale `PENDING_INDEPENDENT_QA_REHASH` token; fixed by next commit) |
| `d223dd1` | PASS |
| `4ac2581` | PASS ← the commit Copilot actually tested |
| `dc4d24b` | **FAIL** — `missing required BOL-002 FIRI token: PENDING_DETERMINISTIC_REHASH` |
| `e476fb9` | **FAIL** (same) |

Cause: the guard requires the string `PENDING_DETERMINISTIC_REHASH` "until the hash is computed and independently verified", which is mutually exclusive with persisting the hash. Copilot's PASS applies to `4ac2581`, not to the frozen identity; the guard was never re-run after persistence, and no CI workflow runs it. This is the third lifecycle step at which this guard has broken (ATL-135 path/label defect, `a81ac36`, `dc4d24b`): it encodes the pre-transition state as text.

### F2 — HIGH — `EXECUTION_SUFFICIENT` is not derived from the FIRI content (ARCHITECTURE_FITNESS, PROMOTION_QA)

`classify(row)` takes only the crosswalk row; it never reads rules, validations, or `identification_resolution`. BOL-002 is `EXECUTION_SUFFICIENT` solely because `row.source_classification === "Canonical BOL/domain"` — the same generic path as before FIRI existed.
- 48 fields are `EXECUTION_SUFFICIENT`; **47 of them have no FIRI payload at all**.
- Deleting BOL-002's FIRI payload would not change its classification.

This contradicts the governing text:
- ATL-132: BOL-002 "must not remain EXECUTION_SUFFICIENT merely because its canonical semantic object is known."
- ATL-134 freeze gate 7: "sufficiency reclassified based on actual identification/resolution coverage."
- `ATL_134_…_VALIDATION.md` "Sufficiency correction": ATL-134 "replaces that assumption with an explicit field-specific FIRI contract."

The only real change was removing a temporary hold (`if (n === 2) return "PARTIALLY_SUFFICIENT"`). Copilot saw the mechanism (its report cites a "Canonical BOL/domain" row and no BOL-002 force) but still graded PROMOTION_QA as PASS. The in-package rationale string ("Execution-sufficient … after independent QA PASS: field-specific FIRI covers …") asserts FIRI-derived sufficiency that the code does not implement.

### F3 — MEDIUM — Required ATL-146 closure deliverables are absent

ATL-146 scope requires: classification as `APPROVED_REUSABLE | BOUNDED_REFERENCE | REWORK_REQUIRED`; source/provenance/version/**effective-date** and **epistemic state**; a promotable-vs-bounded decision; a decision on closing ATL-132. The freeze record contains none of these (0 occurrences of each term). The 7 provenance entries carry `id, authority, locator, claim` only — no version or effective date, though ATL-134 enrichment item 10 requires them.

### F4 — MEDIUM — Two records of truth with divergent lifecycle state (DATA_STORAGE_OWNERSHIP, LINEAGE_RECOVERY)

At the frozen head the canonical-source JSON (`BOL_002_…_CANDIDATE.json`, touched only by `2c7e1ab`) still reads `CANDIDATE_PENDING_INDEPENDENT_QA` with `sufficiency.candidate = EXECUTION_SUFFICIENT_PENDING_INDEPENDENT_QA`, while the TS package reads `firi-v1.0-approved`. The frozen hash covers only the TS projection; the JSON's identity is not frozen or referenced in the freeze record.

### F5 — MEDIUM — The 13 adversarial vectors are narrative, not reproducible

`ATL_134_…_VALIDATION.md` records T01–T13 as "PASS" in prose. There is no executable fixture or harness; the guard only checks that the vector *labels* occur in that markdown file. The vectors are a credible design-time specification, not reproduced test evidence.

## 3. Dimension dispositions

| Dimension | Disposition | Basis |
|---|---|---|
| BUILD_CORRECTNESS | **FAIL** (narrow, mechanical) | Build + tsc pass; required guard fails at frozen head (F1) |
| OUTCOME_FITNESS | PASS_WITH_CORRECTIONS | Contract structure covers the ATL-134 enrichment areas (9 mechanism steps, object model, 8 rules, 4 resolution states, 9 evidence requests, 2 fail-closed unresolved items); provenance lacks version/effective date (F3); vectors not executable (F5) |
| ARCHITECTURE_FITNESS | PASS_WITH_CORRECTIONS | Atlas/runtime boundary respected; sufficiency not FIRI-derived (F2) |
| FUTURE_SCOPE_COMPATIBILITY | **NOT_ESTABLISHED** (not PASS) | Rules, guard and package payload are BOL-002-specific; FIRI-blind classifier gives a future detector nothing to key on; no direct evidence of applicability to other fields/documents/work. Not inherited from Copilot |
| DATA_STORAGE_OWNERSHIP | PASS_WITH_CORRECTIONS | F4 |
| RETRIEVAL_CONSUMPTION | PASS on package/data access; API routes not independently exercised | Copilot's dev-server smoke check retained as evidence only |
| INTERACTION_MODEL | NOT_INDEPENDENTLY_VERIFIED | UI not exercised in this pass; anonymous read-only API (noted by Copilot) is an unassessed deployment-policy question |
| LINEAGE_RECOVERY | PASS | Hash reproducible four ways; persistence step proven single-value; history recoverable; (F4 identity gap tracked separately) |
| MALKOM_UTILITY | PASS (bounded) | Carried from the ATL-135 independent QA; consumer-contract structure re-confirmed; rules not re-challenged against authorities in this pass |
| CONSUMER_INDEPENDENCE | PASS (bounded) | Same basis |
| FINAL | **PASS_WITH_BINDING_CORRECTIONS** | Bounded BOL-002 reference proof only; B1–B4 required before closure |

**Scope limit, stated plainly:** this re-QA did not re-open ATL-135's rule-by-rule challenge of each FIRI rule against its cited authorities (NMFC / 49 CFR / GS1 / DSDC). It re-verified identity, reproducibility, classification mechanics, guard/build behavior, and conformance to the ATL-132/134/146 acceptance text.

## 4. Binding corrections (required before ATL-146 closes / ATL-147 unlocks)

**B1 — Repair the guard so it passes at the frozen state and cannot go stale.**
Remove the `PENDING_DETERMINISTIC_REHASH` token assertions (lines in `required[]` and the final `assert.ok(source.includes('PENDING_DETERMINISTIC_REHASH'))`). Replace with a self-verifying assertion: run the governed hash computation and assert it equals `bolIntelligencePackage.package_hash`. The guard script is outside the hashed package, so this requires **no rehash**. Re-run on the frozen head and record PASS with the commit hash. Preferably also run it in CI.

**B2 — Correct the sufficiency claim.** Minimum acceptable: record in the freeze record (outside the hashed bytes) that BOL-002's `EXECUTION_SUFFICIENT` is *inherited from the canonical-domain classification and is not derived from FIRI coverage*, and that FIRI-coverage-gated sufficiency is not established by ATL-146 (it belongs to ATL-147/148 detector/generator scope). Preferred: correct the in-package rationale string and re-hash as a new version, with ChatGPT/Owner choosing. **Owner decision flagged:** making `classify()` genuinely FIRI-gated would drop 47 fields from `EXECUTION_SUFFICIENT`, which is a product-semantics change, not an ATL-146 fix.

**B3 — Complete the ATL-146 closure record.** Add: disposition `BOUNDED_REFERENCE` (my recommendation; `APPROVED_REUSABLE` is not supported by F2/F5 and FUTURE_SCOPE is not established); effective date; epistemic state; explicit promotable-vs-bounded list; and a decision that **ATL-132 stays open** (its reusable-mechanism objective is not proven by one field).

**B4 — Freeze the source-of-record identity.** Record the candidate JSON's blob hash in the freeze record and state its relationship to the TS projection (either promote its lifecycle status, or mark it as the superseded candidate with the TS package as the frozen projection).

## 5. Non-binding recommendations

- **N1.** Change `localeCompare` to code-unit ordering in `hash-bol-intelligence.ts` before ATL-147 widens the key space (currently safe; I proved ordering identical on all 74 keys). The utility also cannot run under plain Node (extensionless import); Copilot had to alter a copy.
- **N2.** The frozen package carries stale text: `hash_scope` still says the hash "MUST be recalculated only after independent QA", `assessment_notice` says the hash "remains pending", `lifecycle_status` is still `EXPERIMENTAL_POC`, `generated_at` is `null`. Fixing it changes the digest; fold into any B2 re-hash.
- **N3.** Convert T01–T13 into executable fixtures; ATL-147's scale proof should consume them.
- **N4.** `eslint` is not runnable in the app (no flat config; ESLint 9). Pre-existing, not attributable to ATL-146.

## 6. Reproduction (so ChatGPT can re-derive rather than trust this file)

```bash
cd apps/atlas-bol-intelligence-explorer
git checkout dc4d24b && bun scripts/hash-bol-intelligence.ts            # sha256:a11b6090…27bc
# guard bisect
for c in 54a7d3c a81ac36 d223dd1 4ac2581 dc4d24b e476fb9; do
  git checkout -q $c -- src scripts package.json
  node scripts/validate-bol002-firi.mjs >/dev/null 2>&1 && echo "$c PASS" || echo "$c FAIL"; done
# classifier is FIRI-blind
sed -n '/^function classify/,/^}/p' src/data/bol-intelligence.ts
bun -e 'import {bolIntelligencePackage as p} from "./src/data/bol-intelligence";
 const es=p.fields.filter(f=>f.sufficiency.classification==="EXECUTION_SUFFICIENT");
 console.log(es.length, es.filter(f=>!f.identification_resolution).length)'   # 48 47
```

## 7. Custody

- Claude cannot self-close ATL-146 or unlock ATL-147. Next holder: **ChatGPT** (apply B1–B4), then **Claude** re-verifies B1–B4 against the resulting commits.
- Nothing on the promotion branch, Linear, or Supabase was modified by this QA.
- This QA's working evidence is reproducible from the commands above; no hashes or freeze records were written by Claude.
