# Frozen Asset Registry — Operating Protocol

This directory is the canonical pointer system for Atlas frozen assets. It exists so the team never has to search prior chat threads to decide which file/version is current.

## Files
- `LATEST.md` — human-readable current-state dashboard.
- `CURRENT.json` — machine-readable latest pointers.
- `ASSET_REGISTER.json` — full asset inventory with version/status/path/hash/lineage.
- `history/` — immutable integration locks/snapshots.

## Update protocol
1. Create a new versioned asset; never overwrite a frozen payload.
2. Compute SHA-256 and capture lineage (`derivedFrom`, `supersedes`, source/module version).
3. Validate the asset and assign an explicit status.
4. Append/update the inventory record in `ASSET_REGISTER.json`.
5. Update only the pointer in `CURRENT.json`.
6. Update `LATEST.md` and `CHANGELOG.md`.
7. Run `node scripts/frozen-assets-registry.mjs validate`.
8. Commit the registry + new versioned asset together.

## Status discipline
`FROZEN_PRODUCTION_BASELINE` and `FROZEN_EXECUTION_REFERENCE_CANDIDATE` are different. A candidate can be immutable/frozen without being production-active.

## Future-session rule
When continuing Atlas work, read `LATEST.md`/`CURRENT.json` before relying on conversation history. The registry is the authoritative locator; conversation is supporting context.
