# Claude Handoff — Post-E2E Demo Hotfixes

Owner authorization: **YES — fix quickly, demo branch only.**
Implementation branch: `atlas-v2-demo-2026-09-14`
Governance/backlog source: `governance/backlog/ATLAS_V2_DEMO_USABILITY_HOTFIX_BACKLOG_2026-09-13.md`

## Read first

Before touching code:
1. Read the backlog above in full.
2. Read latest `claude_chatGPT.md`.
3. Add a PRE_ACTION entry to `claude_chatGPT.md` with:
   - DUX-01 / DUX-02 / DUX-03 scope,
   - files you expect to change,
   - confirmation no main/production merge is authorized,
   - confirmation BQA-01/02/03 must remain passed.

## Exact work to perform

### DUX-01 — Add visible Canvas → Execution Depth path

Current problem: Road LTL A5 task can be selected in Canvas and inspected, but there is no discoverable way to open Daughter Execution Depth.

Implement:
- Add a clear Inspector action: **Open Execution Depth**.
- The action must use the currently selected A5 task.
- For Road LTL, use governed Daughter semantic version `1.5` for this execution-depth route.
- URL shape:
  `/daughter?moduleId=road-ltl&moduleVersion=1.5&taskId=${selectedTaskId}`
- Validate with `LTL-03`.
- Do not hard-code only LTL-03.
- Do not replace existing Compose/Trace/Lens behavior.

Rendered acceptance:
- select `LTL-03` on Canvas;
- button is visible in Inspector without hidden URL knowledge;
- click opens Daughter with `road-ltl`, `1.5`, `LTL-03`;
- Daughter real content renders;
- Canvas return remains functional.

### DUX-02 — Remove stale Ocean Coming Soon state

Governed source truth already confirmed on demo branch in `data/module-catalog.json`:
- Ocean FCL `0.5` = ACTIVE / A5_VERIFIED / approved
- Ocean LCL `0.5` = ACTIVE / A5_VERIFIED / approved

Implement:
- Trace the actual source of the `Coming Soon` presentation before editing.
- Correct Universe/Canvas so active Ocean FCL/LCL are presented as available/active.
- Prefer deriving the UI from module catalog/runtime registry state rather than adding a one-off Ocean string override.
- Do NOT activate unrelated planned domains.
- Do NOT fabricate depth that Ocean does not contain.

Rendered acceptance:
- Ocean FCL/LCL no longer show Coming Soon;
- they can be opened to the depth genuinely published;
- Road LTL remains unchanged;
- planned domains still appear planned/coming soon as appropriate.

### DUX-03 — Temporary internal-demo visibility for Work Decomposition / WorkDefinition

Current problem: Daughter marks both depths protected and displays the authorization placeholder. Real admin auth was never configured for this demo.

Owner direction: internal stakeholder demo does not need the blocked view now. Real enforcement will be set up after demo.

Implement this narrowly:
- demo branch only;
- reversible internal stakeholder/demo mode;
- keep authorization architecture in source; do NOT delete fail-closed production logic;
- mark UI visibly **Internal Demo View** or **Internal Stakeholder View**;
- in that mode, render governed internal content directly for Work Decomposition and WorkDefinition.

Truth constraints:
- Work Decomposition: use current governed Road LTL 1.5 / P6.1 evidence.
- WorkDefinition: P6.2 compiler is proven, but persisted canonical WDs are pending. Do not claim persisted completeness. Show only actual compiler/output evidence or governed sample/projection available in repo.
- Never imply Road LTL v1.5 generated the older v1.2 → DW2.3 → Malkom reference implementation.
- Do not expose secrets or arbitrary protected repository internals; expose only the governed demo content required for these two views.

Rendered acceptance:
- Work Decomposition tab no longer shows only authorization placeholder in internal demo mode;
- WorkDefinition tab no longer shows only authorization placeholder in internal demo mode;
- both contain truthful, useful demo content;
- visible internal-demo marker exists;
- switching/removing demo mode restores protected/fail-closed behavior.

## Implementation discipline

You may implement all three in one compact hotfix commit for speed, but:
- keep each change independently traceable;
- do not touch unrelated architecture;
- preserve eight top-level API routers;
- preserve BQA-01/BQA-02/BQA-03 fixes;
- preserve dual-lineage truth;
- no manual Vercel deployment;
- no main merge;
- no production promotion.

Before push:
- run full-state certification;
- run any focused tests for Canvas navigation, catalog state, and Daughter demo mode;
- inspect diff for accidental semantic/source changes.

After push:
1. Record commit SHA in `claude_chatGPT.md`.
2. If Claude cannot obtain Vercel deployment details, request ChatGPT lookup exactly as before.
3. On exact READY preview, browser-test DUX-01, DUX-02, DUX-03.
4. Regression-check:
   - root Canvas;
   - Road LTL Daughter LTL-03;
   - `/app` return;
   - POC Journey;
   - Execution Readiness.
5. Update both this handoff/backlog and `claude_chatGPT.md` with exact evidence.

Pass wording:
- `DUX-01 = CLOSED_RENDERED_PASS`
- `DUX-02 = CLOSED_RENDERED_PASS`
- `DUX-03 = CLOSED_RENDERED_PASS`

If any fails, leave only that item open and record the exact rendered failure. Do not declare D2.0.7 complete or merge-ready on your own.