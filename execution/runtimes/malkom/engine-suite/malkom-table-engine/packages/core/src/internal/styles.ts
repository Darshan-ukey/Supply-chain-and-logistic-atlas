/**
 * Injected CSS, in two layers.
 *
 * STRUCTURAL_CSS is always injected: the parts that are mechanics rather
 * than taste — density switching, header-filter sizing, container queries
 * that keep the toolbar from overflowing, and the column-measurement
 * safeguards. It carries no colours of its own.
 *
 * SKIN_CSS is the default Malkom look for Tabulator's own markup, which we
 * cannot reach with theme class tokens. Every value in it comes from a CSS
 * custom property, so a host re-skins the grid by setting variables rather
 * than fighting our selectors. Hosts that want to style everything
 * themselves can turn it off (`features.injectSkin: false`) and pair that
 * with `presets.unstyled`.
 */

const STRUCTURAL_STYLE_ID = 'mte-structural-styles';
const SKIN_STYLE_ID = 'mte-skin-styles';

/** The full token set, with the default Malkom values. */
export const CSS_VARIABLES = `
.mte-shell {
  --mte-font: inherit;
  --mte-accent: #bd1874;
  --mte-accent-contrast: #ffffff;
  --mte-accent-soft: #fdf2f8;
  --mte-accent-border: #fbcfe8;
  --mte-surface: #ffffff;
  --mte-surface-muted: #f8fafc;
  --mte-surface-sunken: #f1f5f9;
  --mte-border: #e2e8f0;
  --mte-border-strong: #cbd5e1;
  --mte-text: #0f172a;
  --mte-text-muted: #64748b;
  --mte-text-subtle: #94a3b8;
  --mte-radius: 0.75rem;
  --mte-radius-sm: 0.375rem;
  /* Overlay scrim behind the settings drawer and the prefilter modal. */
  --mte-scrim: rgb(15 23 42 / 0.45);
  --mte-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
  --mte-row-hover: var(--mte-accent-soft);
  --mte-row-border: #f1f5f9;
  --mte-header-bg: var(--mte-surface-muted);
  --mte-footer-bg: var(--mte-surface);
  --mte-success: #059669;
  --mte-success-soft: #ecfdf5;
  --mte-info: #7c3aed;
  --mte-info-soft: #f5f3ff;
  --mte-danger: #e11d48;
}
`;

export const STRUCTURAL_CSS = `
/* The shell is the layout container the toolbar responds to — not the
   viewport. A grid in a 600px panel on a 1920px screen must behave like a
   600px grid, which viewport breakpoints get wrong. */
.mte-shell { container-type: inline-size; container-name: mte; font: var(--mte-font, inherit); }

/* Toolbar: never let the controls clip. They shrink, then wrap. */
.mte-shell .mte-topbar-inner { flex-wrap: wrap; }
.mte-shell .mte-topbar-controls { min-width: 0; flex-wrap: wrap; justify-content: flex-end; }
.mte-shell .mte-search-wrap { flex: 1 1 12rem; min-width: 8.5rem; max-width: 20rem; }

@container mte (max-width: 44rem) {
  /* Buttons drop their labels before anything is allowed to overflow. */
  .mte-shell .mte-btn-label { display: none; }
  .mte-shell .mte-topbar-meta { display: none; }
}
@container mte (max-width: 30rem) {
  .mte-shell .mte-search-wrap { flex-basis: 100%; max-width: none; order: 1; }
}

/* Density */
.mte-shell.mte-dense .tabulator-row .tabulator-cell { padding-top: 6px !important; padding-bottom: 6px !important; font-size: 0.8rem !important; }
.mte-shell.mte-dense .tabulator-col-title { font-size: 0.7rem !important; }

/* Header layout: title and funnel button share one line.
   The title holder must be able to grow, and must not be the thing that
   decides a column is 40px wide — see the measurement note in adapter.ts. */
.mte-shell .tabulator-col .tabulator-col-content { display: flex !important; align-items: center !important; }
.mte-shell .tabulator-col .tabulator-col-title-holder { flex: 1 1 auto !important; min-width: 0 !important; }
.mte-shell .tabulator-header-filter {
  margin-top: 0 !important;
  flex: 0 0 auto !important;
  min-width: 16px !important;
  width: 16px !important;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
}
.mte-shell .tabulator-header-filter .mte-hf-btn {
  width: 14px !important;
  height: 14px !important;
  min-width: 14px !important;
  min-height: 14px !important;
  padding: 0 !important;
  border: 0 !important;
  background: transparent !important;
  line-height: 1 !important;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.mte-shell .tabulator-header-filter .mte-hf-btn .material-symbols-rounded { font-size: 12px !important; line-height: 1 !important; }

/* Tabulator sets an inline height on the holder; let it collapse properly
   inside our flex column. */
.mte-shell .tabulator-tableholder { min-height: 0 !important; }

/* Floating surfaces inherit the host's typography. */
.mte-hf-menu, .mte-export-menu, .mte-popover, .mte-modal { font: inherit; }

.mte-shell button { cursor: pointer; }
.mte-shell button:disabled { cursor: not-allowed; }
`;

export const SKIN_CSS = `
.mte-shell .tabulator { border: none !important; background: transparent !important; }
.mte-shell .tabulator-header { border-bottom: 1px solid var(--mte-border) !important; background: var(--mte-header-bg) !important; color: var(--mte-text) !important; }
.mte-shell .tabulator-row { border-bottom: 1px solid var(--mte-row-border) !important; background: var(--mte-surface) !important; color: var(--mte-text) !important; }
.mte-shell .tabulator-row:hover { background: var(--mte-row-hover) !important; }
.mte-shell .tabulator-row.tabulator-selected { background: var(--mte-accent-soft) !important; }
.mte-shell .tabulator-footer {
  background-color: var(--mte-footer-bg) !important;
  border-top: 1px solid var(--mte-border) !important;
  color: var(--mte-text-muted) !important;
  padding: 6px 15px !important;
  position: sticky !important;
  bottom: 0;
  z-index: 30;
  box-shadow: 0 -4px 6px -1px rgba(0, 0, 0, 0.05);
  display: flex !important;
  justify-content: space-between !important;
  align-items: center !important;
  flex-wrap: wrap !important;
  gap: 6px;
}
.mte-shell .tabulator-footer .tabulator-paginator {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: flex-end;
  align-items: center;
}
.mte-shell .tabulator-page {
  border: 1px solid var(--mte-border) !important;
  background: var(--mte-surface) !important;
  color: var(--mte-text-muted) !important;
  border-radius: var(--mte-radius-sm) !important;
  padding: 4px 10px !important;
  margin: 0 2px !important;
  font-weight: 600;
  font-size: 0.75rem;
  transition: all 0.2s;
  cursor: pointer;
}
.mte-shell .tabulator-page:hover { background-color: var(--mte-surface-sunken) !important; color: var(--mte-accent) !important; }
.mte-shell .tabulator-page.active { background-color: var(--mte-accent) !important; color: var(--mte-accent-contrast) !important; border-color: var(--mte-accent) !important; }
.mte-shell .tabulator-page.disabled { color: var(--mte-text-subtle) !important; background: var(--mte-surface-muted) !important; border-color: var(--mte-border) !important; cursor: not-allowed; }
.mte-shell .tabulator-col-resize-handle { opacity: 0; }
.mte-shell .tabulator-col:hover .tabulator-col-resize-handle { opacity: 1; }
`;

function injectOnce(doc: Document, id: string, css: string): void {
  if (doc.getElementById(id)) return;
  const style = doc.createElement('style');
  style.id = id;
  style.textContent = css;
  doc.head.appendChild(style);
}

/**
 * Inject the engine stylesheets once per document.
 * `skin` mirrors `features.injectSkin`.
 */
export function ensureEngineStyles(doc: Document, skin = true): void {
  injectOnce(doc, STRUCTURAL_STYLE_ID, `${CSS_VARIABLES}\n${STRUCTURAL_CSS}`);
  if (skin) injectOnce(doc, SKIN_STYLE_ID, SKIN_CSS);
}

/** Back-compat alias for the previous single-sheet export. */
export const ENGINE_CSS = `${CSS_VARIABLES}\n${STRUCTURAL_CSS}\n${SKIN_CSS}`;
