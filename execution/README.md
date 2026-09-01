# Atlas Execution Fabric

This directory is the protected execution architecture of Atlas.

- `contracts/` — canonical Work Decomposition and adapter/projection contracts.
- `core/` — runtime-neutral adapter registry and capability negotiation.
- `ui/` — generated canonical/runtime flow visualization used by authorized Atlas surfaces.
- `adapters/` — Atlas-owned runtime adapter implementations.
- `runtimes/` — modular runtime families owned by Atlas. Malkom is the first rich implementation.

The architecture is frozen in `governance/ATLAS_EXECUTION_FABRIC_ARCHITECTURE_V1_FROZEN.md`.

No runtime-specific object (Queue, Bot, Agent Node, BPMN Task, etc.) is permitted to become mandatory canonical WorkDefinition vocabulary.
