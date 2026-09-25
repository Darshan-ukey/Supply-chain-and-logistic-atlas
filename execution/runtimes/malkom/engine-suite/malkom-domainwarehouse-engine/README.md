# Malkom Domain Warehouse Engine v0.2.4

Sibling engine for the Malkom 3.0 repository. It implements Hasmukh's Domain Warehouse direction while preserving the complete Road LTL V1.2 semantics from Domain Warehouse v2.3.

## Architecture

`Road LTL V1.2 -> lossless canonical WorkDefinition -> Domain Warehouse -> Malkom projection -> existing Malkom engines`

The canonical definition is richer than today's runtime. Unsupported runtime semantics are preserved and reported; they are never silently flattened.

## Packages

- `@malkom/domainwarehouse-contract` — Zod contracts for lossless WorkDefinition, KnowledgeNote, runtime projection metadata, client binding/extension, workflow lifecycle, blockers and coverage.
- `@malkom/domainwarehouse-core` — `compile · verify/guard · score`, Malkom compilation, existing Workflow Engine adapter, compiled Queue Flow Explorer graph/path engine and in-memory reference warehouse.
- `@malkom/domainwarehouse-react` — Studio, Queue Flow Explorer, Workflow Projection and Coverage UI components.

## Road LTL proof domain

- 22 definitions / queues
- 70 subqueues
- 70 work types
- 228 projection fields
- 69 outcomes
- 39 governed source process-flow edges
- 22 execution transitions
- 220 typed entity nodes
- 176 ontology edges
- 29 sources
- 19 unique STAY outcomes, producing 62 real subqueue return branches
- 402 finite guarded queue paths at the reference guard settings
- 3 canonical ESCALATE outcomes retained visibly

## Queue Flow Explorer

The explorer is derived from the **compiled Malkom queue projection**, not from a separately authored diagram:

`Start -> Subqueue -> Outcome -> Route / Status -> END | STAY return | canonical runtime gap`

Every outcome branch retains `outcome + route + status + nextStep`. `STAY_IN_QUEUE` is a real return edge. `enumerateQueuePaths()` uses `maxVisitsPerNode=2` and `maxDepth=64` by default, so loops remain visible without infinite traversal. BPMN, Flow, selected-path image export and playback all use the same graph.

The three Road LTL escalation outcomes (`LTL-15`, `LTL-18`, `LTL-22` -> `LTL-14`) remain visible as dashed canonical routes even though current Malkom cannot yet materialize native cross-queue escalation.

## Workflow Engine

The existing `malkom-workflow-engine` is reused. Domain Warehouse projects into its lifecycle contract (`initialState`, legal `to[]` transitions, terminal states, held-clock states and `slaMinutes`). No duplicate workflow engine is added.

## Host boundary

Persistence, Prisma, RBAC, audit and writing into Raw Materials belong in Malkom Command. Templates are under `integration/malkom-command/`. The supplied Hasmukh repository does not contain that host, so live Command materialization remains an integration gate.

## Reproducible validation

```bash
npm run generate
npm run compat
npm run audit
npm run deep-audit
```

A networked environment with dependencies installed is still required for the full `tsc -b` and Vitest run.
