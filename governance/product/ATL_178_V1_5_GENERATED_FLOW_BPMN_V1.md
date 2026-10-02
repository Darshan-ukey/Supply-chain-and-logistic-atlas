# ATL-178 — Generated Queue Flow Explorer & BPMN Export v1

Status: BUILD_COMPLETE / AWAITING_INDEPENDENT_QA

The v1.5 explorer contract uses one generated runtime-neutral graph for two skins: Flow and BPMN. The bounded representative scope is Road LTL / LTL-04, derived from governed WorkDefinition `wd::road-ltl::LTL-04::v1` and current-lineage Malkom package `malkom-dw::road-ltl::LTL-04::v1`. Atlas canonical truth is not replaced by Malkom queue structures.

## Generation and redraw
The graph is a deterministic projection of source work semantics. Node and edge order is stable. A source semantic change must produce a changed graph/export; unchanged source produces byte-stable logical graph content. Both views consume the same graph, so redraw is data-driven rather than manually modelled.

## Supported mapping
START → BPMN startEvent; governed work action → task; mutually exclusive declared disposition routes → exclusiveGateway; terminal declared outcomes → endEvent; declared routes → sequenceFlow. The graph traverses all four declared outcomes: ACCEPTED, CONDITIONAL, REJECTED, CANCELLED. Selected-work-item trace is represented as an ordered path over graph node IDs.

## Unsupported/ambiguous semantics
Sub-queue is UNKNOWN in the bounded canonical source and is surfaced, not invented. Runtime orchestration is UNSUPPORTED. No universal BPMN, round-trip import/editing, manual modelling, simulation/process mining, collaborative authoring, or unsupported event/compensation/subprocess semantics are claimed.

## Exports
Machine-readable graph: `data/generated/flow-graphs/road-ltl-ltl04-v1.json`. BPMN 2.0 XML: `data/generated/flow-graphs/road-ltl-ltl04-v1.bpmn`. Image export contract: a renderer must render the same graph and embed/accompany graphId, WorkDefinition ID, Malkom package ID and version; the v1.5 repository freezes the deterministic export contract rather than a manually drawn image.

Production/runtime execution is not authorized.