# Malkom Table Engine

A first-class, **config-driven grid engine** for the Malkom runtime client.
Pages supply column metadata, a data source and any special filter/sort
logic — the engine drafts the whole grid: shell, global search, smart
prefilters, excel-style column filters, grouping, persistence, skeleton
loading and pluggable exports.

Fourth engine in the Malkom family (work-allocation, rules,
process-metrics, **table**). Unlike its siblings this one is a
**client-plane** engine: it renders UI. It is deliberately Malkom-specific —
it assumes the Malkom stack (Tailwind CSS + Google Material Symbols
Rounded) and wraps [Tabulator](https://tabulator.info/) as its grid muscle.

## Packages

| Package | What it is |
| --- | --- |
| `@malkom/table-core` | The engine. Fully typed TS, zero runtime dependencies. `tabulator-tables` is a **peer dependency** (the client bundles it). |
| `@malkom/table-react` | React bindings: `<MalkomTable config={...} ref={engineRef} />` mounts/destroys the engine inside React's lifecycle. |

Both ship **dual ESM + CommonJS** builds with `types` for each condition, so
ESM hosts, CommonJS hosts (Next.js server bundles, jest, ts-node) and
`moduleResolution: node16` type-checking all resolve them. `npm run
test:consumers` proves all three against the built output.

## Runs everywhere

| Environment | Status |
| --- | --- |
| Browser (React 19 + Vite + Tailwind v4) | Target runtime |
| jsdom under vitest, Node 24 | `npm test` |
| jsdom under vitest, **Node >= 25** | `npm run test:node25` (see Persistence) |
| Server / SSR / build-time import | Importing the package is side-effect free; pure helpers (`compileCondition`, `serializeCsv`, `describeCondition`, …) run without a DOM. Constructing an engine requires one and fails with a clear error. |
| Second document (iframe / popout) via `advanced.documentRef` | Supported — containment and prompts resolve against that document |

Two engines must not share one container: constructing a second engine over
a live one tears the first down (its timers, listeners and Tabulator
instance included) rather than orphaning it.

## Quick start (React)

```tsx
import { MalkomTable } from '@malkom/table-react';
import type { MalkomTableConfig } from '@malkom/table-react';

interface UserRow {
  email: string;
  department: string;
  region: string;
  createdAt: string;
  active: boolean;
  [key: string]: unknown;
}

const config: MalkomTableConfig<UserRow> = {
  title: 'Onshore Users',
  index: 'email',
  persistenceId: 'onshore_users',
  loadData: async () => fetchUsers(),
  columns: [
    { field: 'email', header: 'Email', locked: true },
    { field: 'department', header: 'Department' },
    { field: 'region', header: 'Region' },
    { field: 'createdAt', header: 'Created', type: 'date', sorter: 'date' },
    { field: 'active', header: 'Active', type: 'boolean' }
  ],
  notify: (message, kind) => toast(message, kind)
};

export function UsersPage() {
  return <MalkomTable config={config} className="h-full" />;
}
```

That's the whole page. The engine renders the title bar (record count,
LIVE badge, last sync), a debounced global search, density toggle, reload,
export, the settings drawer (grouping, smart prefilters, column toggles,
master reset), excel-style value-set filters on every column, pagination
with a page-size select and total/filtered counts — all of it themed and
persistent.

## Quick start (vanilla TS)

```ts
import { MalkomTableEngine } from '@malkom/table-core';

const engine = new MalkomTableEngine('grid-container', config);
// later: engine.refreshData(); engine.export(); engine.destroy();
```

## The config surface

Everything is configurable; nothing is hardcoded. Highlights:

- **Columns** (`MalkomColumn`): `field`, `header`, `type`
  (`string|number|date|boolean` — drives prefilter operators and coercion),
  `visible`, `width`, `frozen`, `sorter` (built-in name or custom
  comparator), `formatter` (function or registered name), `headerFilter`,
  `filterValue`, `searchable`/`searchValue`, `exportable`/`exportValue`/
  `exportHeader`, `groupable`, `filterable`, `locked`,
  `tabulatorOverrides` (escape hatch).
- **Data**: static `data` or async `loadData` (enables refresh + LIVE +
  skeleton + optional `autoRefreshMs`). `formatData` derives fields before
  rows reach the grid.
- **Features** (`features`): every shell capability has a toggle and
  documented default (`globalSearch`, `refresh`, `export`, `settings`,
  `density`, `grouping`, `prefilters`, `columnToggles`, `skeleton`,
  `liveBadge`, `syncMeta`, `pagination`, sizes, debounce, layout, height).
- **Theme** (`theme`, `cssVars`): see [Theming](#theming) — colours come
  from CSS custom properties, every element carries a stable `mte-*` hook,
  and `presets.unstyled` hands the whole look to the host.
- **Labels / icons** (`labels`, `icons`): every user-facing string and every
  Material Symbols icon name is overridable.
- **Integration**: `notify` (toast sink), `confirmAction`, `onRowClick`,
  `onDataLoaded`, `onError`, typed events via `engine.on(...)`.

## Theming

The engine is meant to look like *your* app, not like itself. Three levels,
cheapest first.

**1. Map your design tokens onto the engine's variables.** Every colour,
radius and shadow the engine draws — including inside Tabulator's own
markup, which class tokens cannot reach — resolves from a `--mte-*` custom
property. Set them once and the whole grid follows:

```ts
const config: MalkomTableConfig<Row> = {
  // ...
  cssVars: {
    '--mte-accent': 'var(--brand-600)',
    '--mte-surface': 'var(--card)',
    '--mte-border': 'var(--border)',
    '--mte-text': 'var(--fg)',
    '--mte-radius': '6px'
  }
};
```

or in your own stylesheet, which also covers grids you don't configure:

```css
.mte-shell { --mte-accent: var(--brand-600); --mte-radius: 6px; }
```

The full set: `--mte-accent`, `--mte-accent-contrast`, `--mte-accent-soft`,
`--mte-accent-border`, `--mte-surface`, `--mte-surface-muted`,
`--mte-surface-sunken`, `--mte-border`, `--mte-border-strong`, `--mte-text`,
`--mte-text-muted`, `--mte-text-subtle`, `--mte-radius`, `--mte-radius-sm`,
`--mte-shadow`, `--mte-row-hover`, `--mte-row-border`, `--mte-header-bg`,
`--mte-footer-bg`, `--mte-success`, `--mte-success-soft`, `--mte-info`,
`--mte-info-soft`, `--mte-danger`, `--mte-font`. Typography inherits from
the host by default.

**2. Target the `mte-*` hooks.** Every part of the shell carries a stable
class regardless of theme config, so plain CSS can restyle anything:
`mte-shell`, `mte-topbar`, `mte-title`, `mte-search`, `mte-btn` (plus
`mte-btn-export`, `mte-btn-settings`, `mte-btn-icon`, `mte-btn-primary`),
`mte-chip`, `mte-grid`, `mte-drawer-panel`, `mte-modal`, `mte-popover`,
`mte-hf-menu`, `mte-footer-controls`, `mte-prefilter`, `mte-col-toggle`.

**3. Take the look over entirely.** `presets.unstyled` keeps layout and the
hooks and drops every visual class; pair it with `injectSkin: false` so the
default Tabulator skin stays out of your way too:

```ts
import { presets } from '@malkom/table-core';

const config = {
  // ...
  theme: presets.unstyled,
  features: { injectSkin: false }
};
```

`theme` also accepts a deep partial for surgical overrides
(`theme: { topBar: { exportButton: 'my-btn my-btn-primary' } }`), and
`stripVisualClasses` is exported if you want to strip a theme of your own.

## Sizing and layout

Columns are auto-sized by Tabulator from rendered content, which fails in
one specific case: a grid built while its container has no width — a hidden
tab, a collapsed drawer, a mount before layout settles. Every column then
falls back to the minimum. The engine defends against that:

- `features.columnMinWidth` (default **90**) raises Tabulator's own 40px
  floor, so a bad measurement never looks broken.
- `features.refitOnResize` (default **true**) watches the shell and re-fits
  columns the first time a real width arrives, and on later resizes. Call
  `engine.refitColumns()` yourself after revealing a hidden grid if you have
  disabled it.
- `features.persistColumnWidths` (default **false**) keeps a width measured
  in that state from being frozen across sessions. Column order and
  visibility still persist; set it to `true` if you want user-resized widths
  to stick.
- `features.layout` picks the strategy: `fitDataFill` (default — size to
  content, leave the remainder), `fitColumns` (divide the available width
  between columns), `fitDataStretch` (size to content, stretch the last).
  For a handful of columns in a wide panel, `fitColumns` usually looks best.

The toolbar sizes itself against the **shell**, not the viewport, using CSS
container queries — a grid in a 600px panel on a 1920px screen behaves like
a 600px grid. Search flexes between 8.5rem and 20rem, button labels drop to
icons before anything overflows, and controls wrap rather than clip.

## Smart prefilters

Saved, named filters built in a nested **AND/OR condition builder**
(engine-owned, no external dependency), stored through a pluggable
`StateStorage` (localStorage by default), applied multi-active, surfaced as
removable chips, and explained to the user in plain English ("Show a row
when…") via the preview popover. The condition AST
(`ConditionGroup`/`ConditionRule`) is exported, so hosts can also build
conditions programmatically and call `engine.savePrefilter(...)`.

## Global search — scoped on purpose

Search matches **only configured, searchable columns** (plus optional
`searchValue` overrides). Derived/internal fields never cause invisible
matches — this fixes a real bug class from the engine's ancestor.

## Exports

Built-in **CSV** exporter (RFC 4180 quoting, UTF-8 BOM, formula-injection
guard). Exports respect visible columns, current filters and sort, and
`exportValue`/`exportHeader` overrides. More integrations (Google Sheets,
Excel Online, …) plug in through the `TableExporter` interface:

```ts
const gsheets: TableExporter<UserRow> = {
  id: 'gsheets', label: 'Google Sheets', icon: 'table_view',
  async run(ctx) { /* create sheet, append ctx.rows via ctx.valueOf */ }
};
// config.exporters: [gsheets]  → export button shows a chooser menu
```

## Persistence

With `persistenceId` set, the engine persists prefilters, active prefilter
ids, density, page size and grouping through `StateStorage`, and enables
Tabulator's own column-layout/sort persistence under the same id. Master
Reset clears the view back to config.

The default storage resolves real web storage by **probing** it (write /
read / remove), not by checking that a `localStorage` global exists — and
falls back to an in-memory store when none works. So state round-trips the
same way everywhere; only durability across reloads differs:

| Environment | Backing store |
| --- | --- |
| Browser | `localStorage` (durable) |
| Browser, private mode / quota exceeded | memory (session) |
| jsdom on Node < 25 | jsdom's `localStorage` |
| jsdom on **Node >= 25** | memory — see below |
| SSR / plain Node | memory |

**Node >= 25 note.** Node ships a built-in `localStorage` global that is
non-functional without `--localstorage-file`. vitest's `populateGlobal`
skips keys that already exist on the Node global and sets
`window = globalThis`, so under jsdom on Node >= 25 *neither*
`globalThis.localStorage` nor `window.localStorage` is jsdom's — both are
Node's broken one. The engine detects this and uses its memory fallback;
nothing throws and no host test needs `NODE_OPTIONS`. If your own tests
assert against `localStorage` directly, assert through
`resolveWebStorage()` (exported) instead, or run them on Node 24.

`npm run test:node25` runs this repo's whole suite against a simulated
Node >= 25 environment, from any Node version.

## Tailwind note

The default theme expresses layout with Tailwind utilities (colours come
from CSS variables, so no palette classes are involved). Point your Tailwind
content/`@source` globs at this package so those classes survive purging,
e.g. (Tailwind v4):

```css
@source "../node_modules/@malkom/table-core";
```

Hosts that don't use Tailwind should use `presets.unstyled` with
`injectSkin: false` and supply their own CSS against the `mte-*` hooks.

Material Symbols Rounded must be loaded by the host page (it is the Malkom
default icon font).

## Development

```
npm install
npm run build        # ESM (tsc -b) + CommonJS (scripts/build-cjs.mjs)
npm test             # vitest (jsdom)
npm run test:node25  # same suite, simulating Node >= 25 web storage
npm run test:consumers # ESM require, CJS require, node16 type-check of the built dist
```

`prepare` runs the build, so `npm i <git-url>` and `npm pack` ship a
populated `dist` even though it is gitignored.

Node >= 22.5. Strict TypeScript (`exactOptionalPropertyTypes`,
`noUncheckedIndexedAccess`) matching the Malkom engine family conventions.
