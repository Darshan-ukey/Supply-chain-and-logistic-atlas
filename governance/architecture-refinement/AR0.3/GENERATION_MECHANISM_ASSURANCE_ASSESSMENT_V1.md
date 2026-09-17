# Generation Mechanism Assurance Assessment — can we defend the output?

**Question assessed (Owner):** not whether 38 matches 43, but whether the generation mechanism is controlled and governed enough to produce accurate output without missing, drifting or hallucinating — and specifically, whether 38 is defensible and the 5 absent units are accounted for.

**Short answer:** the mechanism is genuinely strong and the controls are real. **38 is defensible at structural level. The 5 are NOT yet accounted for at unit level — and cannot be, from GitHub alone.**

---

## 1. What is genuinely controlled — verified, not assumed

These are real controls with evidence behind them, not aspirational statements.

| Control | Where | Why it matters |
|---|---|---|
| Rules derived forensically, not invented | `TREE_DELTA_ANALYSIS_RESULT` → R1–R10 → CR1–CR11 | An earlier attempt produced 64 units / 38 ready. Root cause was diagnosed (over-decomposition + post-hoc semantic completion) before rules were written. |
| Generated wording cannot become its own readiness evidence | CR4 / R4 | This is the specific anti-hallucination control. A generator that elaborates a vague parent into precise-looking children, then cites its own elaboration as proof of readiness, is the exact failure mode — and it is explicitly forbidden. |
| Counts can never be generation targets | CR9 / R10 | Prevents the worst failure: steering output to match a number, which would manufacture false agreement. |
| Fail-closed on missing semantics | CR5, CR6, R6 | Unresolved → blocker, never an invented default. |
| Structural inference ≠ operational knowledge | CR3 / R5 | Sequence can establish order, never decision criteria or authority. |
| Two-round independent QA with a real FAIL | `INDEPENDENT_QA_RESULT` → bounded corrections → `R2_FOCUSED_RE_QA_RESULT` | The first QA failed and forced corrections. A process that only ever passes is not evidence of control. |
| Per-leaf determinations verified as non-template | Focused re-QA Check 4 | All 14 read in full; confirmed individually reasoned, not copy-paste. |
| Discretionary units confirmed still blocked | Focused re-QA Check 4 | The four genuinely decision-dependent units (`03`, `14`, `16`, `17`) remained blocked rather than being swept into false NOT_MATERIAL claims. This is the check that would have caught optimistic drift. |
| No collateral drift during correction | Focused re-QA Check 5 | Full fingerprint recomputed pre/post correction — every figure identical. |

**Strongest single corroboration:** `EXECUTOR_READY` came out at **14, identical to historical 14**, with counts explicitly forbidden as targets. Two independent derivations converging on the same readiness count is meaningful evidence — not proof, but not nothing.

---

## 2. What the delta actually is, post-regeneration

The post-generation comparison **was** performed (`R2_REGENERATION_SELF_QA`):

| | Δ vs historical |
|---|---|
| work units | −5 |
| leaves | −5 |
| EXECUTOR_READY | **0** |
| BLOCKED_BY_CLIENT_BINDING | −1 |
| BLOCKED_BY_KNOWLEDGE_GAP | −4 |

With a structural rationale: the 20-step source seed was preserved as the spine, and only **five** areas were expanded because frozen source independently supports distinct child contracts — Parties, Handling units, Line items/hierarchy, DangerousGoods, Instructions/service windows.

**That is a category-level explanation. It is not a unit-level reconciliation.**

---

## 3. The gap — stated plainly

**No artifact enumerates the 5 absent historical units and shows, for each, that it was either (a) correctly collapsed into a retained unit, or (b) correctly excluded as source-unsupported.**

CR9/R10 requires that any delta be "investigated semantically" after generation. What exists is a quantified delta plus a structural narrative. What does not exist is the per-unit account.

**The −4 knowledge gaps is the line that most deserves that account.** Four things the historical run flagged as *unknown* are not flagged now. Under fail-closed discipline, losing blockers is the dangerous direction — a missing blocker is indistinguishable, from the outside, between "correctly resolved" and "silently dropped." The ready count matching exactly makes accidental optimism less likely, but it does not substitute for naming the four.

This is not a claim that anything is wrong. It is a claim that **the evidence currently available cannot distinguish "correctly absent" from "missed."**

---

## 4. Why this makes Task B load-bearing, not bureaucratic

The historical certification in GitHub records, per task, only:

```
taskId · contentHashSha256 · workUnitCount · leafCount
· executorReadyLeafCount · blockedByClientBindingLeafCount
· blockedByKnowledgeGapLeafCount · semanticSourceVersion · inheritance
```

**There is no per-work-unit detail in GitHub.** Verified: no unit tree, no leaf identities, no blocker-level records.

The historical unit-level tree exists only in `SUPABASE_PROTECTED_EXECUTION_STORE`, which the certification itself marks `committedToGitHub: false`.

**Therefore the question "which 5, and were they correctly absent?" is currently unanswerable in principle — not through lack of effort, but because the comparison baseline is not retrievable.**

Task B (freeze + restore-test the existing Supabase bundle) is the prerequisite for ever closing this. Reconstruction cannot substitute for it: reconstruction produces the new artifact, not the historical one being compared against.

---

## 5. Scope reality check

LTL-03 is **1 of 22 tasks**. The mechanism has one worked example, closed under independent QA. The remaining 21 are unproven, and the baseline's own procedure (step 9) requires advancing one task at a time with QA per task.

Aggregate historical totals are 603 / 444 / 185 / 163 / 96. A per-task delta of −5 units, if it generalised, would compound across 22 tasks — which is precisely why per-unit reconciliation should be settled on task 1 rather than discovered at task 22.

---

## 6. Assessment

**Can we confidently say the process is controlled and governed?** Yes, substantially — the anti-hallucination, anti-drift and fail-closed controls are real, specific, and have already caught genuine defects in practice.

**Can we defend 38 as correct?** Structurally yes, with an identical ready count as independent corroboration. **Per-unit, not yet.**

**Can we say we didn't miss the remaining 5?** **Not yet — and not from GitHub alone.** This requires the historical unit-level tree from Supabase.

**Recommended closure condition:** a per-unit delta reconciliation for LTL-03 naming each of the 5 absent units and each of the 4 absent knowledge gaps, with a disposition of collapsed / correctly-excluded / genuinely-missed for each — performed once Task B makes the historical tree retrievable, and independently QA'd.

Until then the correct status is: **mechanism trustworthy, single output structurally defensible, delta unreconciled at unit level.**

---

No Supabase access occurred. No P6.x restart, no P6.1 regeneration, no production promotion, no prior baseline modified. This document assesses; it closes nothing.
