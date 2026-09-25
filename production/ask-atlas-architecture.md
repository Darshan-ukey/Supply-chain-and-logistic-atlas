# Atlas 2.0 — Universal Ask Atlas Architecture

## Product boundary

Ask Atlas is one governed intelligence layer shared across four product surfaces:

`Universe → Daughter → Canvas → Admin Execution Intelligence`

The surface changes retrieval scope and permitted UI commands. It does **not** create separate chatbots or separate knowledge stores.

## Request contract

Preferred request field:

```json
{
  "question": "...",
  "surfaceState": {
    "surface": "universe | daughter | canvas | admin",
    "moduleId": "optional-published-module-id",
    "selectedProcess": "optional-A5-id",
    "selectedEntity": {"id": "optional-reference-id", "type": "optional-type"},
    "section": "optional-current-section"
  }
}
```

Legacy `canvasState` remains accepted and is normalized to `surface = canvas`.

## Runtime flow

`User text/click → current surface state → governed retrieval → optional LLM interpretation → citation validation → command validation → deterministic UI action`

The LLM never mutates Atlas knowledge and never directly manipulates the DOM.

## Retrieval behavior

### Universe

Retrieval can use published Page-0/Universe reference records including:

- domains;
- navigator items;
- systems;
- business objects;
- documents;
- events;
- relationships;
- jurisdictions;
- carriage regimes;
- conditions;
- executive intents;
- destination coverage status.

Universe retrieval does not silently search A5 tasks unless a published A5 daughter is explicitly selected or named.

### Daughter

Retrieval is scoped to the selected ACTIVE + A5_VERIFIED daughter module and its governed sources, while retaining relevant Universe/reference evidence.

### Canvas

Retrieval uses the active module, selected process, playback position, semantic level, trace/lens/context state and client workspace where authorized.

### Admin

Admin requests are authorized server-side with `requireAdmin()` before protected WorkDefinition evidence is read. Protected definitions are loaded with the server-only Supabase service role and responses use `Cache-Control: private, no-store`.

## Coverage guardrail

If a requested module is not published at A5 depth, Ask Atlas can explain the available reference/coverage state but must not synthesize missing A4/A5 execution from model knowledge.

## Public / Admin boundary

Public surfaces can retrieve only public Atlas evidence.

Admin can additionally retrieve protected WorkDefinition evidence after server-side authorization.

The browser never receives the Supabase service-role key or LLM provider key.

## Command model

Existing Canvas commands remain governed by `governance/canvas-command-contract-v1.json`.

Cross-surface commands are governed by `governance/ask-atlas-surface-contract-v1.json`:

- `navigate_surface`
- `open_daughter`
- `open_in_canvas`
- `highlight_reference`

The model may propose these commands; deterministic Atlas validation accepts or rejects them.

## Cross-surface continuity

A daughter/reference view can hand its module and selected task to Canvas through a short-lived browser session handoff. Canvas consumes and deletes that handoff on entry.

The same conversation can therefore progress from reference explanation to execution inspection without the user re-specifying context.

## Reference-file protection

Frozen reference HTML assets are not edited to add Ask Atlas. The V2 host scopes its native Ask drawer to the currently open reference iframe. Separately opened reference pages use `reference/reference-with-ask.html`, which wraps the immutable reference file and mounts `runtime/universal-ask-atlas.js` outside it.

Future Universal Daughter Renderer output can mount `/runtime/universal-ask-atlas.js` directly and provide `window.__ATLAS_ASK_CONFIG__` with its surface/module identity.
