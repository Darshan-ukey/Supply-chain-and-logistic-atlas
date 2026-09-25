# Architecture

## Canonical-first boundary

1. Road LTL V1.2 is the source truth.
2. Domain Warehouse v2.3 stores a lossless canonical WorkDefinition.
3. Malkom decomposition is explicitly `MALKOM_STANDARD`, not source truth.
4. Runtime adapters compile only what the target can represent.
5. Unsupported runtime capability remains visible and blocks materialization.
6. Client binding and client extensions stay separate from the reference definition.

## Current target

The current Malkom 3.0 repository is the implementation boundary. Existing engines are reused rather than changed.

## Future adapters

RPA, generic workflow, agent and other runtime adapters can be added later without remodeling Road LTL or Domain Warehouse.
