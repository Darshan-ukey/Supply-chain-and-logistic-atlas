# Changelog

## 0.2.4
- Fixed `DomainWarehouse.snapshot()` runtime failure for client bindings/extensions.
- Rebuilt Queue Flow Explorer from compiled queue/subqueue/outcome data rather than the Road LTL source-task graph.
- Added outcome/route/status/next-step metadata to every managed-work branch.
- Added 62 explicit `STAY_IN_QUEUE` return edges and guarded `enumerateQueuePaths()` (`maxVisitsPerNode=2`, `maxDepth=64`).
- Added 402 finite reference queue paths plus path playback/selection in the standalone and React UI.
- Kept all 3 canonical Road LTL escalations always visible; they expand to 11 subqueue/outcome branch edges in queue views and remain current-Malkom blockers.
- Added first-class `KnowledgeNote` contracts/storage API and explicit runtime-projection metadata.
- Added dependency-free deep runtime audit covering compilation, verification, Warehouse snapshotting, Queue Flow paths, BPMN/SVG export and combined-repository TS/TSX syntax.
- Existing 15 Malkom engines remain byte-identical.

## 0.2.3
- Rebased on lossless Domain Warehouse v2.3 / Road LTL V1.2.
- Added exact 22-task Malkom projection from v2.3.
- Added adapter to the existing Malkom Workflow Engine lifecycle contract.
- Added initial Queue Flow Explorer model plus BPMN 2.0 and current-path SVG export.
- Made three governed Road LTL escalation routes always visible in flow.
- Added Reference-vs-Client `score` contract.
- Added Pipeline Atlas registration template.
- Added Malkom Command persistence/RBAC/materialization integration seam.
- Existing 15 Malkom engines remain untouched.
