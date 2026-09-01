# Build scope

Built now:
- lossless Road LTL v2.3 WorkDefinition fixture
- first-class KnowledgeNote and runtime-projection contract records
- Malkom queue/subqueue/work-type/field/outcome projection
- pure Domain Warehouse contract/core/react packages
- compile / verify / score
- existing Workflow Engine adapter
- compiled Queue Flow Explorer graph
- outcome + route + status + next-step semantics on every branch
- explicit STAY return edges
- guarded finite path enumeration
- BPMN/Flow/path playback and current-path SVG export
- canonical escalation visibility
- client binding and extension contracts
- Pipeline Atlas registration template
- Malkom Command persistence/RBAC/materialization seam

Documented but not forced into current Malkom:
- native cross-queue escalation
- WAIT_FOR_EVENT
- RETRY
- richer recovery routing
- other future runtime capability extensions

Not built because host repo is absent:
- live Prisma migration inside `malkom-command`
- live C_ADMIN/RBAC handlers
- live audit/event writes
- actual Raw Materials materialization endpoint
- Assembler/Belt/Provision E2E proof
