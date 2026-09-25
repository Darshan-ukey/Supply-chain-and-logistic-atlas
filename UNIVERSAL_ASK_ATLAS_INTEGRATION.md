# Universal Ask Atlas — Atlas 2.0 Integration Note

## Status

Implemented as an additive V2 runtime capability. Canonical reference/domain data is unchanged.

## Included

1. Server API accepts generic `surfaceState` and legacy `canvasState`.
2. Universe reference indexing across domains, navigator entries, systems, objects, documents, events, relationships and context dimensions.
3. Daughter-scoped A5 retrieval for ACTIVE + A5_VERIFIED modules.
4. Canvas state-aware retrieval and validated deterministic commands.
5. Admin-only protected WorkDefinition retrieval after server-side authorization.
6. Coverage guardrail: unpublished A5 is never model-backfilled.
7. Cross-surface command contract and deterministic validation.
8. Daughter/Universe → Canvas context handoff.
9. Reusable floating Universal Ask client for standalone Universe/daughter renderers.
10. Reference wrapper so frozen canonical HTML remains byte-identical.

## Integration rule for the current frozen content stack

When the current Universe and daughter renderers are assembled into the Atlas 2.0 master, each generated page should mount:

```html
<script>
window.__ATLAS_ASK_CONFIG__ = {
  surface: 'universe' // or 'daughter',
  moduleId: null      // set for daughter pages
};
</script>
<script src="/runtime/universal-ask-atlas.js"></script>
```

The daughter renderer supplies `moduleId` from the publication registry. No daughter-specific Ask Atlas code is permitted.

## Acceptance gates

- Universe questions return Universe evidence.
- Daughter questions are scoped to that daughter.
- Canvas remains backward compatible.
- Reference → Canvas handoff preserves module/task context.
- Public Ask cannot retrieve protected WorkDefinitions.
- Admin Ask requires server-side Admin authorization.
- Unpublished A5 remains unavailable rather than synthesized.
- Canonical reference hashes remain unchanged.
- Existing Public/Admin desktop/mobile UI has zero runtime errors and zero horizontal overflow.
