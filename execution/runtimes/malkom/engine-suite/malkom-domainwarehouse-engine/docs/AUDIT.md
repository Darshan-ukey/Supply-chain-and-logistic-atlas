# Malkom Domain Warehouse v0.2.4 — final audit

## Release basis
- Fresh-original Hasmukh repository content retained byte-for-byte.
- Added exactly one sibling root: `malkom-domainwarehouse-engine/`.
- Canonical content basis: Domain Warehouse v2.3 Lossless / Road LTL V1.2.

## Non-regression
- Original files: **887**
- Missing original files: **0**
- Changed original files: **0**
- Added top-level roots: **malkom-domainwarehouse-engine only**

## Road LTL / Domain Warehouse integrity
- WorkDefinitions / queues: **22**
- Subqueues: **70**
- Work types: **70**
- Projection fields: **228**
- Outcomes: **69**
- Governed source process-flow edges: **39**
- Execution transitions: **22**
- Typed entity nodes: **220**
- Ontology edges: **176**
- Sources: **29**
- Knowledge notes: **66**
- Runtime projection records: **22**
- Declared normalized Road LTL source SHA-256: `59a255cf14061cbfe9e375826d4082e4ec4f41745722b063a6a2a0f9b669d841`

## Queue Flow Explorer
- Graph source: **compiled Malkom queue/subqueue/outcome projection**.
- Unique STAY outcomes: **19**.
- Concrete subqueue STAY return branches: **62**.
- Finite guarded queue paths: **402**.
- Loop-guard terminations exercised in runtime audit: **120**.
- Default guards: `maxVisitsPerNode=2`, `maxDepth=64`, `maxPaths=1000`.
- Every outcome branch retains outcome + route + status + next step.
- BPMN, Flow, path selection/playback and image export use the same queue graph.

## Workflow Engine
- Reuses existing `malkom-workflow-engine`; no second workflow engine was added.
- Exact current lifecycle vocabulary inspected: `initialState`, state `to[]`, `terminal`, `holdsClock`, `slaMinutes`, `enabled`.
- Adapter compatibility audit: **PASS**.
- Numeric SLA is **not invented**. Road LTL semantic clocks remain canonical; numeric `slaMinutes` stays `0` until bound.

## Escalation handling
Three governed escalation outcomes exist and are retained:
- `LTL-15 -> LTL-14`
- `LTL-18 -> LTL-14`
- `LTL-22 -> LTL-14`

They are always visible. Because the same outcome can be available from multiple subqueues, they appear as **11 dashed branch edges** in the compiled queue explorers. Current Malkom materialization marks them `UNSUPPORTED_CURRENT_MALKOM`. No END/STAY substitution is used.

## Engine compatibility scan
Seven current Malkom target contracts scanned: Workflow, Validation, Integration, Work Allocation, Exception Management, Rules, Agentic AI. Result: **7/7 PASS**.

## Runtime/static verification
- Domain Warehouse offline semantic audit: **PASS / 0 errors**.
- Deep emitted-core runtime audit: **PASS / 0 errors**.
- `DomainWarehouse.snapshot()` with binding + extension: **PASS**.
- Combined repository dependency-free TS/TSX syntax transpile: **560 files / 0 failures**.
- All sibling JSON parse checks: **PASS**.
- All `.mjs` Node syntax checks: **PASS**.
- Prototype embedded JavaScript syntax: **PASS**.

## External build gate
The container cannot reliably install packages from the npm registry. Therefore a full `npm install -> tsc -b -> vitest` run remains a networked CI/dev gate. The actual `malkom-command` host is also absent, so live Prisma/RBAC/audit, Raw Materials writes and Assembler/Belt/Provision execution remain host-integration gates.
