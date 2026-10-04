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

Exact fresh-checkout QA result and identities are recorded in `s8-3e-evidence/exact-qa.json` (committed in the closure commit after the implementation commit that was tested).
