# Atlas v2 — Deferred BOL/FIRI Continuation & Scale Backlog V1

**Decision date:** 2026-09-28  
**Status:** DEFERRED_BEHIND_ATLAS_V1_5  
**Linear parent:** ATL-144  
**v1.5 handover gate:** ATL-143

## Purpose

Preserve the exact post-v1.5 resume path for the BOL Domain-Brain experiment and Field Identification & Resolution Intelligence (FIRI), without restarting completed work or reconstructing history from chat.

This document does not authorize execution during Atlas v1.5.

## Completed checkpoints — preserve, do not rerun

- ATL-67 — Independent BOL Field Universe Freeze — independently QA PASS / Done.
- ATL-68 — SEFL/Malkom 76-field crosswalk v1.1 — independently QA PASS / Done.
- ATL-69 — Experimental Testable Field Scope — corrected frozen denominator 66 testable + 10 exclusions — independently QA PASS / Done.
- ATL-70 — Benchmark, Ground Truth & Metrics Contract — Done.
- ATL-73 — Atlas BOL Intelligence Explorer/API — remediated, independently QA PASS, production runtime evidence captured — Done.
- ATL-134 — BOL-002 FIRI candidate implementation — Done; independent QA remains ATL-135.

Historical superseded denominators/artifacts remain forensic evidence only.

## Existing open BOL empirical gates — reuse, do not duplicate

1. ATL-71 — actual isolated AWS staging deployment/runtime proof. Prior architecture/IaC QA PASS does not satisfy the Owner-reopened runtime gate.
2. ATL-72 — Generic IDP baseline run.
3. ATL-74 — Atlas-enriched experimental run / frozen POC arms.
4. ATL-75 — automated evaluation harness.
5. ATL-76 — independent experimental QA.
6. ATL-77 — LTL-03 execution-readiness verdict.

ATL-73 is an already-complete input to the experiment.

## Existing open FIRI gates

- ATL-132 — BOL-002 FIRI proof parent.
- ATL-135 — independent QA of BOL-002 FIRI v1 candidate.
- ATL-133 — v2 execution-readiness intelligence closure; must not close before ATL-151.

## v1.5 → v2 handover gate

ATL-143 runs before v1.5 final closure and must:
- read ATL-138/139/140/141 outputs;
- capture any Domain Warehouse gaps that belong in BOL/FIRI/v2;
- preserve completed gates;
- freeze exact GitHub/Drive/Linear resume pointers;
- update this backlog only for genuinely new findings.

## New v2 continuation tasks

### ATL-145 — Post-v1.5 Resume Reconciliation
Re-enter from ATL-143 authoritative state and produce one deterministic resume manifest.

### ATL-146 — BOL-002 QA Closure, Freeze & Promotion Decision
After ATL-135, resolve findings, freeze the exact candidate if valid, decide reusable/bounded/rework disposition, and close ATL-132 only if its proof objective is satisfied.

### ATL-147 — FIRI Applicability Triage Across 76-Field Universe
Determine which fields actually require FIRI vs direct extraction, structural resolution, client binding, master data or unresolved semantics. Freeze the real FIRI scale denominator before enrichment.

### ATL-148 — Prioritized FIRI Scale-Up & Adversarial Validation
Apply the approved mechanism to the prioritized fields using evidence-backed rules, explicit uncertainty/binding states and independent validation.

### ATL-149 — Non-BOL Transfer Proof
Prove FIRI is a reusable Atlas identification/resolution mechanism, not a BOL-specific artifact, using a materially different document/information/work pattern.

### ATL-150 — Integrate FIRI into Knowledge Store, On-Demand Depth & Readiness
Connect validated FIRI to governed persistence, knowledge-state lifecycle, On-Demand Depth, readiness interrogation and execution-package discovery.

### ATL-151 — Empirical Proof → Architecture Reconciliation
Converge ATL-77 empirical evidence with validated FIRI/transfer evidence and v1.5 learnings. ATL-133 may close/generalize only after ATL-151.

## Final convergence

ATL-143 handover
→ ATL-145 resume reconciliation
→ ATL-135 independent BOL-002 QA
→ ATL-146 FIRI closure/freeze
→ ATL-147 applicability triage
→ ATL-148 prioritized FIRI scale-up
→ ATL-149 non-BOL transfer proof
→ ATL-150 platform integration

In parallel after authorized resume:
ATL-71 runtime proof
→ ATL-72 baseline
→ ATL-74 enriched experiment
→ ATL-75 evaluation
→ ATL-76 independent QA
→ ATL-77 verdict

Then:
ATL-150 + ATL-77
→ ATL-151 reconciliation
→ ATL-133 architecture closure
→ ATL-107 production/multi-consumer integration where required
→ ATL-130 final execution-readiness QA.

## Anti-drift rules

1. Completed gates are immutable checkpoints, not backlog.
2. Do not re-run ATL-67/68/69/70/73/134 merely because work resumes later.
3. Do not treat ATL-71 architecture/IaC proof as runtime deployment proof.
4. Do not scale FIRI to all 76 fields before ATL-147 freezes the true FIRI-required denominator.
5. Do not generalize FIRI as a v2 capability before non-BOL transfer proof.
6. Do not treat experimental BOL/FIRI success as full Atlas v2 readiness.
7. Preserve held-out-corpus/no-answer-leakage controls.
8. Any v1.5-discovered gap is incorporated through ATL-143/145, not via ad hoc new parallel work.
