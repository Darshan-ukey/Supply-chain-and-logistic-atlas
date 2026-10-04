# S8-3E — ATL-178 bounded Flow/BPMN regeneration

Stage: S8-3E. Base: S8-3D final head `ae21689cce53511227207eac6c15e187da5fb52f` (not the stale `atl-178-v15-generated-flow-bpmn`, which is STALE_UPSTREAM and used only as behavioural evidence/donor ideas).
Classification of generated artifacts: `EXECUTION_PROTECTED`. This repository publishes only non-reconstructive evidence (hashes, counts); the graph, Flow view, BPMN and SVG are held in private custody.

## What was built

| Path | Role |
|---|---|
| `lib/compile/s8-flow-bpmn.js` | Derives one governed flow graph from the compiled canonical WorkDefinition (S8-3B) with S8-3C/3D lineage; renders Flow view, BPMN 2.0 and SVG from that single graph; mandatory-selection trace; pinned wrapper `generateFlowArtifacts`. |
| `lib/compile/s8-bpmn-structure.js` | Bounded BPMN 2.0 structural validator (strict XML well-formedness + references/order/semantic-scope checks, Node built-ins only). Not a full XSD validator. |
| `tests/s8-3e-atl178-flow-bpmn.test.mjs` | 36 deterministic cases (positive, regression and fail-visible negatives). |
| `governance/product/s8-3e-evidence/` | `flow-summary.json` (public, non-reconstructive), `run-exact-qa.cjs`, `exact-qa.json`. |

## Derivation (no hand-authored routing)

- START ← `trigger`; TASK ← the single compiled action; declared outcomes (`transitions`) → one exclusive gateway ("Declared outcome", structural label) and one END per outcome code carrying governed status (`stateAfter`) and required evidence.
- Every declared path is enumerated by traversing the graph itself; `verifyFlowGraph` rejects any graph whose paths do not exactly equal the governed outcomes.
- Lineage: `workDefinitionId` `road-ltl@1.5::LTL-04::LTL-04::ACT::02::WD`, WD/package/readiness/projection/binding/semantics hashes, source release tip `97459a5e…`, `canonicalMutation=false`.
- Scope: Atlas canonical WorkDefinition is the authority; Malkom is a projection consumer only and its queue structures are never canonical.
- Determinism: same governed input → byte-identical graph/BPMN/SVG regardless of key order; any governed change (add/remove/alter outcome) changes the graph hash and the diagram.
- Trace: an explicit selection (outcome or path id) is mandatory; there is no default happy path. Selected-path highlighting is identical in Flow view and SVG.

## Fail-visible (never invented)

Not modelled, surfaced explicitly in the graph, BPMN `extensionElements` and the SVG panel:

- 4 non-compiled leaves (2 `BLOCKED_BY_CLIENT_BINDING`, 2 `BLOCKED_BY_KNOWLEDGE_GAP`) — no edges, routing not asserted.
- Stage/sub-queue structure `UNKNOWN_NOT_GOVERNED`; outcome next-step `NOT_GOVERNED` (the WorkDefinition does not govern it).
- Client execution parameters `CLIENT_BINDING_REQUIRED`; Malkom interface requirement `REQUIREMENT_NOT_CONFIRMED`; clock/timer semantics not rendered; runtime orchestration `STOP_BOUNDARY`.
- Ambiguous routing (duplicate outcome codes) and scope violations throw; extra routing attributes on a transition (e.g. guards, targets) are surfaced as `UNSUPPORTED_ROUTING_ATTRIBUTE` and never interpreted.
- BPMN is descriptive and non-executable (`isExecutable="false"`); no conditions, timers, subprocesses, compensation or lanes are emitted.

## Out of scope (STOP boundaries held)

Generic/universal BPMN, manual modelling, round-trip import/editing, simulation/process mining, runtime orchestration, collaborative authoring, UI/explorer assembly (deferred to S8-4), invented routing, resolving bindings/knowledge gaps by inference. No runtime readiness is promoted: runtime BLOCKED, `materializable=false`, executor `NOT_INDEPENDENTLY_PROVEN`, ATL-181 blocked until S8-6, release DO NOT MERGE.

## Custody

Protected inputs were obtained by deterministic reproduction from the exact governed S8-3B/3C/3D lineage (not by recovery of prior ephemeral Work files); all four governed hashes matched exactly (WD `fcc3e6cf…`, package `6324ff24…`, readiness `c2d2e9ee…`, projection `703f3a5b…`). Reproduced artifacts are held privately outside this repository and are not committed.

## Closure

Stage closure: COMPLETE/PASS (bounded S8-3E scope only). Fresh clean-checkout QA 11/11 at tested commit `7c6b5ce12e8d10738d7370186c55d2fdfeac0879` / tree `e973ca832559a45113ce4092d5589fcbc069e6ed` (10 inherited suites + the 36-case S8-3E suite, clean checkout, Node v22.22.0, linux/x64). QA evidence SHA256 `89cf052a6820bcfa609d3bfe42fe44365e7f703c91199296f23cceb7ad6152e8` (`s8-3e-evidence/exact-qa.json`).

Generated artifact identities (protected; hashes only): graph `dfad5a029ce830e4c1bff68ea1a9ac7f482315c619495a7295aef3c50abe408e`; Flow view SHA256 `1b3839e0bde5e92216373b9ff232a5d20de5e84a7c25250f7d4ce4b93dbaba6f`; BPMN SHA256 `1ede708543a8906333646f010b082446ec75dbf371337ad6069481c4958dfd61`; SVG SHA256 `dbd7d34f978d21a7f81059b58b6de6cac78c89c66c047af6bf98c71ead237482`.

Supplementary, non-gating corroboration (`s8-3e-evidence/supplementary-bpmn-validation.json`): the exact BPMN validates against the OMG BPMN 2.0 XSD (xmllint) and imports into bpmn-moddle@9.0.4 with 0 warnings.

Residuals: runtime orchestration, sub-queue, next-step, client execution parameters, Malkom interface requirement and clock/timer semantics remain unsupported/unknown/blocked; no runtime readiness is promoted; ATL-181 stays blocked until S8-6; release remains DO NOT MERGE. The S8-3B suite reads pinned source commit `662c7847…`, which is reachable only from branch `s8-3a-atl155-daughter-regeneration` (not an ancestor of this head), so fresh-checkout QA requires a clone that carries all branches.
