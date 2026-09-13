# Atlas V2 Demo — Post-E2E Usability Hotfix Backlog

Date: 2026-09-13
Owner direction: fix quickly on demo branch; preserve governed architecture; no production merge/promotion.
Demo implementation branch: `atlas-v2-demo-2026-09-14`
Reference passed preview before these hotfixes: commit `5f3867f446b15304ceb9144563251c927f2b4e56`, deployment `dpl_8fVk5huR7vA6PcGWB5AnYKUs2fjm`.

## Why this backlog exists

The serial BQA defects are closed and the final rendered E2E journey passed, but Owner manual inspection exposed three demo-usability gaps that would make the stakeholder journey fragmented or misleading.

These are presentation/integration gaps, not permission to change Atlas semantic truth.

## DUX-01 — Canvas has no discoverable path to Daughter Execution Depth

### Owner-observed behavior
On Canvas, Road LTL task `LTL-03` can be selected and its execution state/composed context inspected, but there is no obvious UI control that opens the Daughter / Execution-Depth Inspector. The capability exists only if the user already knows the hidden URL.

### Required fix
1. Add a clear action in the selected A5 task Inspector, preferably labelled **Open Execution Depth**.
2. For the selected Road LTL task, route to the exact Daughter URL shape:
   `/daughter?moduleId=road-ltl&moduleVersion=1.5&taskId=<selected-task-id>`
3. For `LTL-03`, expected route:
   `/daughter?moduleId=road-ltl&moduleVersion=1.5&taskId=LTL-03`
4. Do not hard-code only `LTL-03`; derive `taskId` from the current selected A5 task.
5. Keep current Canvas behavior intact; this is additive navigation, not a restructuring of Execute/Inspector.
6. Do not alter BQA-01/BQA-02/BQA-03 fixes.

### Acceptance
- Select Road LTL `LTL-03` in Canvas.
- Click **Open Execution Depth**.
- Daughter opens with Road LTL `1.5` and the same selected task.
- Existing Daughter content still renders.
- Return via Canvas still works.

Status: `OWNER_AUTHORIZED_QUICK_FIX`

---

## DUX-02 — Ocean is still presented as Coming Soon despite ACTIVE A5 modules

### Owner-observed behavior
Universe/Canvas still presents Ocean pages as **Coming Soon**.

### Governed source truth already confirmed on demo branch
`data/module-catalog.json` states:
- `ocean-fcl` version `0.5` — `A5_VERIFIED`, `publicationState: ACTIVE`, `approved: true`
- `ocean-lcl` version `0.5` — `A5_VERIFIED`, `publicationState: ACTIVE`, `approved: true`

Therefore the UI is stale/inconsistent with the active module catalog.

### Required fix
1. Trace where Universe/Canvas derives `Coming Soon` for Ocean. Do not patch the label blindly.
2. Make Ocean FCL and Ocean LCL presentation derive from active module/catalog state or the existing runtime registry rather than stale hard-coded/planned logic.
3. Ocean FCL/LCL must appear available/active, not Coming Soon.
4. Do not promote unrelated genuinely planned domains. Road FTL, Air Cargo, Rail Freight, Inland Waterway, Pipeline, Parcel/CEP, Freight Forwarder, NVOCC, Warehousing, Planning, Procurement remain planned unless governed source says otherwise.
5. Preserve the exact active Ocean versions currently published (`0.5`) unless a separately governed newer version is already explicitly active in the demo branch.
6. Verify clicking/opening Ocean does not fabricate deeper content that the active module does not actually publish.

### Acceptance
- Universe/Canvas no longer labels active Ocean FCL/LCL as Coming Soon.
- Ocean active state agrees with `data/module-catalog.json`.
- Planned domains remain planned.
- No Road LTL regression.

Status: `OWNER_AUTHORIZED_QUICK_FIX`

---

## DUX-03 — Demo-only internal stakeholder visibility for Work Decomposition / WorkDefinition

### Owner-observed behavior
On Daughter Execution Depth, Work Decomposition and WorkDefinition tabs render the protected placeholder because real admin authorization was never wired for this demo. For the internal stakeholder demo, Owner does not want the blocked view.

### Required implementation principle
Do **not** delete or globally weaken the authorization architecture. Implement a reversible, demo-branch-only internal-stakeholder override.

### Required fix
1. Add an explicit demo/internal-stakeholder mode on `atlas-v2-demo-2026-09-14` only.
2. In this mode, Work Decomposition and WorkDefinition tabs should render the governed internal demo content directly instead of the protected placeholder.
3. Keep a small visible marker such as **Internal Demo View** / **Internal Stakeholder View** so the UI does not falsely imply production authorization has been configured.
4. Do not expose protected content on main/production or alter the long-term fail-closed policy.
5. Work Decomposition must use the current governed Road LTL 1.5 / P6.1 evidence.
6. WorkDefinition must not falsely claim persistence/completeness. P6.2 proves the canonical compiler; persisted canonical WDs are still pending. Show only compiler/output evidence or a governed sample/projection that is actually available.
7. Do not imply the old Road LTL v1.2 → Domain Warehouse 2.3 → Malkom reference implementation was generated from v1.5.
8. Keep the two-lineage truth visible where relevant.

### Acceptance
- Internal demo mode visibly identified.
- Work Decomposition tab shows real governed internal demo content.
- WorkDefinition tab shows truthful current compiler/sample evidence, not a fake persisted canonical WD state.
- No production/public authorization policy is removed.
- Reversible by switching demo mode off or removing the branch-only override.

Status: `OWNER_AUTHORIZED_QUICK_FIX`

---

## Execution order

For speed but controlled risk, Claude may implement these in one small demo-branch hotfix **only if** each change is independently traceable in the commit diff and individually verified after deploy.

Required order inside the change:
1. DUX-01 Canvas → Daughter navigation.
2. DUX-02 Ocean ACTIVE presentation correction.
3. DUX-03 demo-only internal stakeholder protected-depth override.

Before mutation, Claude must add PRE_ACTION to `claude_chatGPT.md` pointing to this backlog and record the files expected to change.

After implementation:
- run existing full-state certification;
- preserve 8-router invariant;
- obtain exact Git-triggered Vercel preview;
- rendered-test all three DUX items;
- recheck BQA-01/02/03 surfaces for regression;
- update this backlog and `claude_chatGPT.md` with PASS/FAIL and exact commit/deployment.

No main merge. No production promotion. D2.0.7 remains Owner-controlled.