# Atlas QA Provenance Reconciliation Control

Status: MANDATORY
Effective: 2026-09-20
Scope: all Atlas reconciliation runs and all independent QA issues

## Mandatory provenance chain

Every QA state must be validated and preserved as:

**QA issue → independent reviewer → explicit QA disposition → governed evidence reference → Linear status**

## Rules

1. A QA issue may be marked Done only when the governed record preserves:
   - the independent reviewer;
   - the explicit QA disposition (for example PASS, FAIL, or PASS_WITH_BINDING_QA_CORRECTIONS);
   - a governed evidence reference sufficient to locate the QA result; and
   - the corresponding Linear status.
2. Builder commits, builder tests, builder self-review, or implementation completion never constitute independent QA PASS.
3. The original QA checklist/specification may remain in the Linear description after execution. Reconciliation must not interpret checklist text as proof that QA is still pending when governed execution evidence exists.
4. If a QA issue is Done but provenance linkage is incomplete, classify the defect as **QA provenance incomplete**. Verify and repair the evidence linkage before changing the underlying QA execution state.
5. Missing provenance must not be converted automatically into either QA PASS or QA-not-performed. The reconciliation must resolve the provenance first.
6. Shared-log/handoff evidence and Linear must agree on reviewer, disposition, evidence reference, and state.

## ATL-5 correction precedent

ATL-5 was independently QA'd by ChatGPT and its Done state is legitimate. A later reconciliation incorrectly questioned completion because the issue description still contained the original QA procedure and the QA provenance chain was not preserved strongly enough. This control prevents recurrence of that failure mode.

This file is a governed addendum to the Atlas shared-log/handoff reconciliation rules and must be applied on every future reconciliation.