# Malkom Table Engine — Architecture

## Position in the engine family

Fourth Malkom engine; first **client-plane** engine. Siblings
(work-allocation, rules, process-metrics) evaluate config server-side; this
one renders config as UI in the malkom-runtime client. Same family ground
rules apply: **everything configurable, nothing hardcoded** — behavioral
constants are config fields with documented defaults, all user-facing
strings live in `labels`, all icons in `icons`, all classes in `theme`.

## Design lineage

The engine is a strict-TS rebuild of the proven ONE_AP `TableManager`
(Tabulator v6 + Tailwind shell) with its known defects fixed:

- global search is scoped to configured searchable columns (the ancestor
  searched every row property, so derived HTML fields caused invisible
  matches);
- no stranded methods / global-singleton DOM ids — every instance owns its
  element refs;
- no domain logic in the core (timeline parsing, aging, PIC editing are
  host-side `formatData` + formatters);
- export is an interface + registry, not a hardwired Google Sheets client;
- the nested AND/OR condition builder is engine-owned (the ancestor
  depended on an external `window.ConditionBuilder`).

## Split of ownership

```
┌──────────────────────────────────────────────────────────┐
│ MalkomTableEngine (shell owner)                          │
│  top bar · search · chips · density · refresh · export   │
│  settings drawer · prefilter modal · header-filter menus │
│  skeleton · footer controls · persistence · exporters    │
│  ┌────────────────────────────────────────────────────┐  │
│  │ Tabulator (grid owner, host-provided peer)         │  │
│  │  virtual rendering · sorting · pagination ·        │  │
│  │  column layout persistence · movable columns       │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

## Module map (`packages/core/src`)

| Module | Responsibility |
| --- | --- |
| `types.ts` | Entire public type surface, incl. the structural `TabulatorGrid` contract |
| `conditions.ts` | Prefilter condition AST: validate, compile (evaluate), describe |
| `search.ts` | Column-scoped global search predicate |
| `storage.ts` | `StateStorage` + localStorage/memory impls + `JsonStore` |
| `exporters.ts` | `ExporterRegistry`, CSV serialization, browser download |
| `defaults/` | `DEFAULT_THEME` (Tailwind tokens), `DEFAULT_LABELS`, `DEFAULT_ICONS` |
| `internal/config.ts` | `resolveConfig` — all defaults applied once, up front |
| `internal/shell.ts` | Top bar + grid host DOM |
| `internal/drawer.ts` | Settings drawer (View Controls) |
| `internal/prefilterModal.ts` | Smart-filter modal + nested AND/OR builder |
| `internal/previewRender.ts` | Plain-English condition rendering (shared) |
| `internal/savedPreview.ts` | Saved-filter popover |
| `internal/headerFilter.ts` | Excel-style value-set header filters |
| `internal/footer.ts` / `skeleton.ts` / `styles.ts` / `dom.ts` / `emitter.ts` | Footer controls, loading skeleton, injected structural CSS, DOM helpers, typed events |
| `tabulator/adapter.ts` | The single Tabulator seam: column-def + options assembly, default constructor |
| `engine.ts` | Orchestration: state, filters composition, data pipeline, exports, lifecycle |

## Key decisions (adopted at build time)

- **D1** Family repo shape; packages `@malkom/table-core`, `@malkom/table-react`.
- **D2** Zero runtime deps. `tabulator-tables` is a peer imported at one
  seam; the engine types the Tabulator slice it uses **structurally**
  (`TabulatorGrid`), so tests inject fakes and version drift surfaces at
  the seam, not across the codebase. Tabulator 6.x ships no TS types; a
  minimal module declaration covers the import.
- **D3** Engine owns all shell DOM (vanilla TS, per-instance element refs);
  React binding is a thin wrapper. Works in any malkom-runtime page.
- **D4** Everything configurable: features, labels, icons, theme tokens,
  storage, exporters, notify/confirm sinks, Tabulator escape hatches
  (`tabulatorOptions`, `column.tabulatorOverrides`).
- **D5** Ancestor features ported with fixes (see lineage above).
- **D6** Prefilters use a self-contained typed condition AST (same shape
  philosophy as the rules engine's FilterExpr, no dependency on it).
- **D7** Pluggable `StateStorage`; Tabulator's own column/sort persistence
  rides the same `persistenceId`, restricted to layout keys
  (`columns: ['width','visible']` — full-definition persistence would pin
  stale titles/sorters over future config updates). Persisted payloads are
  treated as untrusted: prefilters are shape-validated on load, stale-field
  prefilters are deactivated (kept for editing), and a user's explicit
  "no grouping" choice is persisted as a sentinel so config defaults don't
  resurrect it. (Known boundary: Tabulator writes its layout keys directly
  to localStorage — custom storages don't capture column layout.)
- **D8** `TableExporter` registry; CSV ships in-box; hosts register
  Google Sheets / Excel Online later. Multiple exporters → chooser menu.

## Data pipeline

```
loadData() / setData(rows)
   → rawData (as supplied)
   → formatData(rows)          (host derivations, optional)
   → processedData             (what the grid, filters, search, export see)
   → tabulator.setData
```

Filters compose as one programmatic predicate:
`activePrefilters (AND across filters) AND globalSearch`, while Tabulator's
header filters (value-set semantics via `headerFilterFunc`) stack
independently. `dataFiltered` drives counts and blank-viewport scroll
resets (a Tabulator virtual-render quirk inherited knowledge from the
ancestor: reset scroll on shrink/pagesize/reload).

## Surgical updates

`applyRowUpdates([{ id, patch?, remove? }])` merges patches into
raw + processed caches, re-derives via `formatData`, and uses
`updateOrAddData`/`deleteRow` — no full reload, counts stay correct.

## Hardening pass (v0.1)

Built, then reviewed by a six-lens adversarial workflow (DOM lifecycle,
filter semantics, Tabulator-seam verification against the installed dist,
export/data integrity, persistence, React/API) with per-lens skeptic
refutation: 21 confirmed findings, all fixed. Highlights baked into the
design as a result:

- data ingestion **copies** caller arrays and clones row objects — the
  engine never mutates React state or shared `config.data`;
- the engine renders into an **inner shell element** it owns, so React's
  `className` diffing can never wipe the skin;
- auto-refresh runs in **background mode** (no skeleton, no scroll reset,
  no toast) — only manual refresh gets the full UX;
- Escape handling is a per-document **stack**: one keypress closes one
  overlay layer (drawer → modal → preview), not the whole pile;
- date-only prefilter values compare at **day granularity** in local time;
- blanks in the excel filter use an out-of-band sentinel key, so real
  "(Blanks)" text stays distinguishable;
- `resetView` restores full column layout via `setColumnLayout` (order +
  width + visibility), not just visibility;
- `config.index` must be a top-level field (fails loud instead of
  half-working with dot paths).

## Portability pass (v0.1)

A host reported storage tests failing on Node 25, which opened a wider
environment audit (SSR/import, runtime globals, packaging, multi-instance
lifecycle) with skeptic verification: 11 confirmed findings, all fixed.

- **Web storage is probed, not sniffed.** Node >= 25 ships a built-in
  `localStorage` global that is non-functional without `--localstorage-file`,
  and vitest's `populateGlobal` skips keys already present on the Node global
  while setting `window = globalThis` — so under jsdom there neither
  `globalThis.localStorage` nor `window.localStorage` is jsdom's.
  `resolveWebStorage()` write/read/removes a probe key (verdict cached per
  object) and `LocalStorageStateStorage` falls back to a process-wide memory
  store, so state round-trips identically everywhere.
- **Tabulator persists through the engine's own store.** Its default writer
  calls `localStorage.setItem` on the bare global (throws where that is
  unusable) and ignores host storage; `persistenceReaderFunc`/
  `persistenceWriterFunc` now route column layout and sort through the same
  `StateStorage`, which also closes the old "custom storage doesn't capture
  column layout" boundary.
- **Downloads degrade.** `downloadTextFile` uses an object URL when
  available and a `data:` URL otherwise, so the real CSV path is exercisable
  in jsdom instead of throwing `URL.createObjectURL is not a function`.
- **Prompts degrade.** A `confirm` that returns a non-boolean (jsdom's
  not-implemented stub, sandboxed iframes) is treated as "no usable prompt"
  and proceeds, matching the absent-confirm behaviour; it resolves against
  `doc.defaultView` so a second document prompts in the right window.
- **Containment is realm-agnostic.** `containsTarget()` replaces
  `target instanceof Node`, which is false for nodes from another document.
- **Containers own one engine.** A second engine built over a live one
  destroys it first (WeakMap registry), instead of wiping its DOM and
  leaving its interval, visibilitychange listener and Tabulator running.
- **Dual ESM + CJS packaging** with per-condition types, `files: [dist, src]`,
  `sideEffects: false` and a `prepare` build hook.

Guarded by two extra suites: `npm run test:node25` (whole suite against a
simulated Node >= 25 environment, from any Node version) and
`npm run test:consumers` (ESM require, CJS require, node16 type-check of the
built dist).

## Host conformance (v0.1)

Reported from a host: the grid imposed its own look, every column came out
at a default width, and the toolbar pushed the settings button out of view.

- **Styling is host-first.** All colours resolve from `--mte-*` custom
  properties (`cssVars` config or plain CSS on `.mte-shell`), typography
  inherits, and every element carries a stable `mte-*` hook class that
  survives theme overrides. `presets.unstyled` + `features.injectSkin:
  false` hands the entire look to the host. The injected CSS is split into
  STRUCTURAL_CSS (mechanics, always) and SKIN_CSS (default look, optional,
  variable-driven).
- **Column widths.** Tabulator measures rendered content, so a grid built
  with no container width sizes every column to its 40px minimum — and
  persisting widths froze that forever. Now: a `columnMinWidth` floor
  (default 90), a `ResizeObserver` that re-fits when a real width first
  arrives (`refitColumns()` is also public), and width persistence off by
  default while order and visibility still persist.
- **Toolbar.** Sizing responds to the shell via CSS container queries
  instead of Tailwind's viewport breakpoints, which lie about a grid living
  in a panel. Search flexes, button labels collapse to icons, controls wrap;
  nothing clips.

## Testing strategy

Pure modules (conditions, csv, search, storage, config, adapter) are tested
directly; the engine + React binding are tested in jsdom against a
`FakeTabulator` implementing the structural contract — the same seam a
future Tabulator major would have to satisfy.
