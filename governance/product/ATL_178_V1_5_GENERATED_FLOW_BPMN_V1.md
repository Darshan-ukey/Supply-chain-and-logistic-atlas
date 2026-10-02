# ATL-178 — Generated Queue Flow Explorer & BPMN Export v1

Status: REWORK_COMPLETE / AWAITING_INDEPENDENT_RE-QA

The v1.5 explorer uses one governed runtime-neutral graph for Flow and BPMN skins in bounded Road LTL / LTL-04 scope, derived from WorkDefinition `wd::road-ltl::LTL-04::v1` and current-lineage Malkom package `malkom-dw::road-ltl::LTL-04::v1`. Atlas canonical truth is not replaced by Malkom queue structures.

## Reachable capability
`atl-178-flow-explorer.html` is linked from product `index.html`. It presents Flow and BPMN views, a selected-path visual trace, and a downloadable SVG image export. The export artifact is `data/generated/flow-graphs/road-ltl-ltl04-v1.svg`.

## Supported mapping
START maps to start event; governed work action to task; mutually exclusive declared disposition routes to gateway; terminal declared outcomes to end states; declared routes to edges. All four declared outcomes are surfaced: ACCEPTED, CONDITIONAL, REJECTED, CANCELLED.

## Unsupported / fail-closed boundary
Sub-queue remains UNKNOWN and is surfaced rather than invented. Runtime orchestration remains UNSUPPORTED. No universal BPMN, round-trip import/editing, manual modelling, simulation/process mining, collaborative authoring, or unsupported event/compensation/subprocess semantics are claimed. Production/runtime execution is not authorized.

## Validation
`tests/atl-178-generated-flow-bpmn.test.cjs` now uses Node built-ins only; the undeclared `fast-xml-parser` dependency was removed. It validates governed IDs, canonicalMutation=false, outcome coverage, unsupported-subqueue surfacing, BPMN structural markers/node-edge identity, and presence/reachability of Flow/BPMN/trace/export UI controls.
