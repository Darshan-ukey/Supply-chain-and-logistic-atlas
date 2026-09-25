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

## ATL-5 provenance repair completed — 2026-09-20

The ATL-5 analytical QA disposition remains **PASS / Done**. The previously incomplete repository provenance has now been repaired without rerunning or reopening ATL-5.

Exact ATL-6 evidence was copied from Owner-governed Google Drive custody to the authoritative AR0.3 resolver branch using a raw-byte/base64 connector-to-connector path, not LLM-generated text reconstruction.

Authoritative evidence commit on `atlas-architecture-ar0-3-readiness-resolver`:

`d938a440e0c8b77492df5074ea248a3a6ae4075f`

Landed exact artifacts:
- `governance/architecture-refinement/AR0.3/AR0_3_CLOSURE_CHECKPOINT_V1.md`
  - SHA-256 `ba27fe0b3d3f0294d5f6f96aee3b9fea06c1335513b1894b8bbfd0d6bfbc963a`
  - Git blob `41316ce83b333b27761765ab50524e0f34c4efd4`
- `governance/architecture-refinement/AR0.3/evidence/atl6-rerun/proof-rerun-atl6.json`
  - SHA-256 `1635471074b974d68e346eae447cc212ec5e886ce175a2001d9637bde2575414`
  - Git blob `76c7b446c1125df57db9c1283435602cad34e45a`
- `governance/architecture-refinement/AR0.3/evidence/atl6-rerun/road-ltl-1.5-drill-package-rerun.json`
  - SHA-256 `9b080cff0ea377a5ce939e3708787f9d790759f1f5d16e637bfd14021ca7b963`
  - Git blob `5cb95a68b633d06f86fce4bec6470af74e75c7b6`

Post-write verification compared the GitHub-stored bytes against the Drive raw-file bytes for all three artifacts: **exact byte match 3/3**.

A dated disposition file was also committed at:
`governance/architecture-refinement/AR0.3/ATL5_QA_PROVENANCE_RECONCILIATION_2026-09-20.md`

Historical Claude local commit `aa16775` remains non-canonical and is preserved only as builder traceability.
