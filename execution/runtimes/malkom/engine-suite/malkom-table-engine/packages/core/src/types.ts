/**
 * @malkom/table-core — public type surface.
 *
 * A Malkom table is described entirely by a `MalkomTableConfig<TRow>`:
 * column metadata, a data source, feature toggles, and optional custom
 * logic (sorters, filters, formatters, exporters). The engine renders the
 * whole shell around a host-provided Tabulator instance.
 */

import type { ConditionGroup, SmartPrefilter } from './conditions.js';

/** Base shape for a table row. Hosts narrow this with their own interfaces. */
export type RowData = Record<string, unknown>;

/** Recursive partial, used for theme overrides. */
export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends string
    ? T[K]
    : T[K] extends Record<string, unknown>
      ? DeepPartial<T[K]>
      : T[K];
};

// ---------------------------------------------------------------------------
// Tabulator structural surface (the slice of Tabulator the engine consumes).
// The real `tabulator-tables` classes satisfy these structurally; tests can
// inject lightweight fakes.
// ---------------------------------------------------------------------------

export interface TabRowComponent {
  getData(): RowData;
  getElement(): HTMLElement;
  update(data: RowData): Promise<void> | void;
}

export interface TabColumnComponent {
  getField(): string | undefined;
  getDefinition(): { title?: string; field?: string } & Record<string, unknown>;
  isVisible(): boolean;
  toggle(): void;
  show(): void;
  hide(): void;
  getElement(): HTMLElement;
  getHeaderFilterValue?(): unknown;
}

export interface TabCellComponent {
  getValue(): unknown;
  getElement(): HTMLElement;
  getRow(): TabRowComponent;
  getColumn(): TabColumnComponent;
  getTable(): TabulatorGrid;
}

export type TabEventCallback = (...args: never[]) => void;

/** Structural contract for a constructed Tabulator instance. */
export interface TabulatorGrid {
  element: HTMLElement;
  on(event: string, callback: (...args: any[]) => void): void;
  off(event: string, callback?: (...args: any[]) => void): void;
  setData(data: RowData[]): Promise<void>;
  getData(active?: 'active' | 'visible' | 'all'): RowData[];
  getDataCount(active?: 'active' | 'visible' | 'all'): number;
  setFilter(filter: unknown, params?: unknown): void;
  addFilter(filter: unknown, params?: unknown): void;
  clearFilter(includeHeaderFilters?: boolean): void;
  setHeaderFilterValue(field: string, value: unknown): void;
  getColumns(): TabColumnComponent[];
  showColumn(field: string): void;
  hideColumn(field: string): void;
  setGroupBy(groups: string | string[] | false): void;
  setColumnLayout?(
    layout: { field: string; visible?: boolean; width?: number }[]
  ): void;
  clearSort(): void;
  setPageSize(size: number): void;
  setPage(page: number | 'first' | 'prev' | 'next' | 'last'): Promise<void> | void;
  redraw(force?: boolean): void;
  updateOrAddData(rows: RowData[]): Promise<unknown>;
  deleteRow(id: unknown): Promise<void> | void;
  destroy(): void;
}

/** Structural contract for the Tabulator constructor. */
export type TabulatorConstructor = new (
  element: HTMLElement,
  options: Record<string, unknown>
) => TabulatorGrid;

// ---------------------------------------------------------------------------
// Columns
// ---------------------------------------------------------------------------

export type BuiltInSorter =
  | 'string'
  | 'number'
  | 'alphanum'
  | 'boolean'
  | 'date'
  | 'datetime';

/** Custom comparator. Return <0, 0 or >0 like Array.prototype.sort. */
export type ColumnSorter<TRow extends RowData = RowData> = (
  a: unknown,
  b: unknown,
  rowA: TRow,
  rowB: TRow
) => number;

/** Context handed to cell formatters. */
export interface CellRenderContext<TRow extends RowData = RowData> {
  value: unknown;
  row: TRow;
  field: string;
  /** Register a callback for after the cell element is attached to the DOM. */
  onRendered: (callback: () => void) => void;
  /** Raw Tabulator cell component (escape hatch). */
  cell: TabCellComponent;
}

export type MalkomFormatter<TRow extends RowData = RowData> = (
  ctx: CellRenderContext<TRow>
) => string | HTMLElement;

/** Logical value type of a column; drives prefilter inputs and coercion. */
export type ColumnValueType = 'string' | 'number' | 'date' | 'boolean';

export interface MalkomColumn<TRow extends RowData = RowData> {
  /** Row field this column reads (dot-nested paths supported by Tabulator). */
  field: string;
  /** Human header shown in the grid, settings drawer and prefilter builder. */
  header: string;
  /** Logical type; drives prefilter operators/inputs and value coercion. Default 'string'. */
  type?: ColumnValueType;
  /** Initially visible. Default true. */
  visible?: boolean;
  width?: number | string;
  minWidth?: number;
  frozen?: boolean;
  hozAlign?: 'left' | 'center' | 'right';
  vertAlign?: 'top' | 'middle' | 'bottom';
  /** Column participates in click-to-sort. Default true. */
  headerSort?: boolean;
  /** Built-in sorter name or custom comparator. Default 'string'. */
  sorter?: BuiltInSorter | ColumnSorter<TRow>;
  sorterParams?: Record<string, unknown>;
  /** Excel-style value-set header filter. Default true. */
  headerFilter?: boolean;
  /**
   * Custom value used for the header filter value set AND filter matching
   * (e.g. bucket a timestamp into a day). Default: raw field value.
   */
  filterValue?: (row: TRow) => unknown;
  /** Cell renderer: inline function or the name of a registered formatter. */
  formatter?: MalkomFormatter<TRow> | string;
  /** Participates in global search. Default true. */
  searchable?: boolean;
  /** Custom text the global search matches against for this column. */
  searchValue?: (row: TRow) => string;
  /** Included in exports. Default true. */
  exportable?: boolean;
  /** Custom export cell value. Default: raw field value. */
  exportValue?: (row: TRow) => string | number | boolean | null;
  /** Header label used in exports. Default: `header`. */
  exportHeader?: string;
  /** Appears in the Group-By select. Default true. */
  groupable?: boolean;
  /** Appears as a field choice in the prefilter builder. Default true. */
  filterable?: boolean;
  /** Cannot be hidden from the settings drawer. Default false. */
  locked?: boolean;
  cssClass?: string;
  /** Escape hatch: merged last into the generated Tabulator column definition. */
  tabulatorOverrides?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Features, labels, icons
// ---------------------------------------------------------------------------

export interface MalkomTableFeatures {
  /** Global search input, scoped to searchable columns. Default true. */
  globalSearch?: boolean;
  /** Debounce for the global search input (ms). Default 250. */
  searchDebounceMs?: number;
  /** Reload button. Default: true when `loadData` is provided. */
  refresh?: boolean;
  /** Export button + exporter registry. Default true. */
  export?: boolean;
  /** Settings drawer (view controls). Default true. */
  settings?: boolean;
  /** Density (compact/comfortable) toggle. Default true. */
  density?: boolean;
  /** Group-by select in the settings drawer. Default true. */
  grouping?: boolean;
  /** Smart prefilters (saved condition-AST filters). Default true. */
  prefilters?: boolean;
  /** Column visibility toggles in the settings drawer. Default true. */
  columnToggles?: boolean;
  /** Skeleton overlay while loading. Default true. */
  skeleton?: boolean;
  /** Number of skeleton rows. Default 12. */
  skeletonRows?: number;
  /** LIVE badge in the title bar. Default: true when `loadData` is provided. */
  liveBadge?: boolean;
  /** Record count + last-sync line under the title. Default true. */
  syncMeta?: boolean;
  /** Pagination. Default true. */
  pagination?: boolean;
  /** Initial page size. Default 15. */
  paginationSize?: number;
  /** Page-size choices in the footer. Default [15, 50, 100]. */
  paginationSizes?: number[];
  /** Auto refresh interval in ms (requires `loadData`). Off by default. */
  autoRefreshMs?: number;
  /**
   * When auto refresh is on and the tab regains visibility after this many ms,
   * refresh immediately. Default 20 minutes.
   */
  autoRefreshVisibilityMs?: number;
  /** Columns can be drag-reordered. Default true. */
  movableColumns?: boolean;
  /**
   * Tabulator layout mode. Default 'fitDataFill' (size to content, leave the
   * remainder empty). Use 'fitColumns' to divide the available width between
   * columns, or 'fitDataStretch' to size to content and stretch the last one.
   */
  layout?: string;
  /**
   * Floor for auto-sized columns, in px. Default 90. Tabulator's own default
   * is 40, which is what a column collapses to when it is measured while the
   * grid has no width — a floor keeps that from looking broken.
   */
  columnMinWidth?: number;
  /**
   * Re-fit columns when the container resizes (and when it first gains a
   * width). Default true; requires ResizeObserver, and is skipped silently
   * where that is unavailable.
   */
  refitOnResize?: boolean;
  /**
   * Persist user-resized column widths alongside order and visibility.
   * Default FALSE: a width measured while the grid was hidden would
   * otherwise be frozen across reloads with no way back but Master Reset.
   */
  persistColumnWidths?: boolean;
  /**
   * Inject the default skin for Tabulator's own markup. Default true.
   * Set false with `theme: presets.unstyled` to style the grid entirely
   * from the host's CSS.
   */
  injectSkin?: boolean;
  /** Grid height passed to Tabulator. Default '100%'. */
  height?: string | number;
}

/** Every user-facing string in the engine. Override any subset. */
export interface MalkomTableLabels {
  searchPlaceholder: string;
  records: string;
  lastSync: string;
  live: string;
  exportLabel: string;
  exporting: string;
  settingsLabel: string;
  refreshTitle: string;
  densityTitle: string;
  viewControls: string;
  clearFilters: string;
  clearSort: string;
  groupDataBy: string;
  noGrouping: string;
  groupedBy: string;
  clearGroupingTitle: string;
  smartPrefilters: string;
  createNewFilter: string;
  noSavedFilters: string;
  visibleColumns: string;
  masterReset: string;
  totalRows: string;
  filteredRows: string;
  rowsPerPage: string;
  noRecords: string;
  blanks: string;
  selectAll: string;
  clear: string;
  apply: string;
  cancel: string;
  save: string;
  close: string;
  noMatches: string;
  newSmartFilter: string;
  editSmartFilter: string;
  filterName: string;
  filterNamePlaceholder: string;
  filterLogic: string;
  filterLogicHint: string;
  addCondition: string;
  addGroup: string;
  showMyConditions: string;
  previewTitle: string;
  previewSubtitle: string;
  previewIntro: string;
  previewShowRowWhen: string;
  previewJoinHint: string;
  previewMatchEither: string;
  previewMatchEitherHint: string;
  previewNoConditions: string;
  previewFinishFirst: string;
  valuePlaceholder: string;
  oneOfPlaceholder: string;
  and: string;
  or: string;
  deleteFilterConfirm: string;
  filterSaved: string;
  filterApplied: string;
  filterRemoved: string;
  filtersCleared: string;
  sortCleared: string;
  viewReset: string;
  dataRefreshed: string;
  loadError: string;
  exportSuccess: string;
  exportFailed: string;
  exportNoData: string;
  exportNoColumns: string;
  nameRequired: string;
  conditionRequired: string;
  operatorLabels: Record<string, string>;
}

/** Material Symbols (Rounded) icon names used across the shell. */
export interface MalkomTableIcons {
  table: string;
  search: string;
  refresh: string;
  export: string;
  exportBusy: string;
  settings: string;
  densityCompact: string;
  densityComfortable: string;
  close: string;
  filter: string;
  filterActive: string;
  filterOff: string;
  sort: string;
  group: string;
  prefilter: string;
  add: string;
  addCircle: string;
  remove: string;
  removeCircle: string;
  edit: string;
  delete: string;
  visibility: string;
  visibilityOff: string;
  lock: string;
  reset: string;
  check: string;
  expandMore: string;
  moveUp: string;
  moveDown: string;
  calendar: string;
  info: string;
  gamepad: string;
}

// ---------------------------------------------------------------------------
// Theme (Tailwind class tokens per shell part)
// ---------------------------------------------------------------------------

export interface MalkomTableTheme {
  shell: string;
  topBar: {
    container: string;
    inner: string;
    titleBlock: string;
    iconBadge: string;
    iconBadgeIcon: string;
    titleWrap: string;
    titleRow: string;
    title: string;
    liveBadge: string;
    liveDot: string;
    syncMeta: string;
    syncDivider: string;
    syncLabel: string;
    syncValue: string;
    chips: string;
    groupChip: string;
    groupChipLabel: string;
    groupChipName: string;
    groupChipClear: string;
    prefilterChips: string;
    prefilterChip: string;
    prefilterChipRemove: string;
    controls: string;
    searchWrap: string;
    searchIcon: string;
    searchInput: string;
    iconButton: string;
    exportButton: string;
    settingsButton: string;
    /** Wraps button text so narrow containers can hide labels, not clip them. */
    buttonLabel: string;
    mobileSearchRow: string;
  };
  grid: {
    container: string;
    host: string;
  };
  skeleton: {
    overlay: string;
    row: string;
    cell: string;
  };
  footer: {
    container: string;
    pageSizeLabel: string;
    pageSizeSelect: string;
    divider: string;
    counts: string;
    countGroup: string;
    countLabel: string;
    countValue: string;
    filteredGroup: string;
    filteredLabel: string;
    filteredValue: string;
  };
  drawer: {
    overlay: string;
    backdrop: string;
    panel: string;
    panelOpen: string;
    panelClosed: string;
    header: string;
    headerTitleWrap: string;
    headerIcon: string;
    headerTitle: string;
    closeButton: string;
    body: string;
    quickActions: string;
    clearFiltersButton: string;
    clearSortButton: string;
    sectionTitle: string;
    groupSelect: string;
    prefilterSection: string;
    prefilterHeader: string;
    prefilterHeaderTitle: string;
    prefilterHeaderIcon: string;
    prefilterChevron: string;
    prefilterBody: string;
    prefilterList: string;
    prefilterEmpty: string;
    prefilterItem: string;
    prefilterItemActive: string;
    prefilterDot: string;
    prefilterDotActive: string;
    prefilterName: string;
    prefilterNameActive: string;
    prefilterActions: string;
    prefilterActionButton: string;
    createFilterButton: string;
    columnGrid: string;
    columnButtonVisible: string;
    columnButtonHidden: string;
    columnButtonLocked: string;
    footer: string;
    masterResetButton: string;
  };
  modal: {
    backdrop: string;
    backdropVisible: string;
    content: string;
    contentVisible: string;
    header: string;
    title: string;
    titleIcon: string;
    closeButton: string;
    body: string;
    nameLabel: string;
    nameInput: string;
    logicSection: string;
    logicHeader: string;
    logicTitle: string;
    logicHint: string;
    builderScroll: string;
    footer: string;
    footerLeft: string;
    previewButton: string;
    footerRight: string;
    cancelButton: string;
    saveButton: string;
    previewPopover: string;
    previewHeader: string;
    previewHeaderIcon: string;
    previewHeaderTitle: string;
    previewHeaderSubtitle: string;
    previewClose: string;
    previewBody: string;
  };
  builder: {
    group: string;
    groupHeader: string;
    logicToggleWrap: string;
    logicButtonActive: string;
    logicButtonInactive: string;
    headerActions: string;
    addRuleButton: string;
    addGroupButton: string;
    removeGroupButton: string;
    children: string;
    ruleRow: string;
    fieldSelect: string;
    operatorSelect: string;
    valueInput: string;
    ruleActions: string;
    ruleActionButton: string;
    emptyGroup: string;
  };
  preview: {
    card: string;
    cardHeader: string;
    cardHeaderIcon: string;
    cardHeaderTitle: string;
    cardHeaderHint: string;
    ruleList: string;
    ruleRow: string;
    ruleIndex: string;
    ruleText: string;
    ruleField: string;
    ruleOperator: string;
    ruleValue: string;
    andConnector: string;
    andConnectorLine: string;
    andConnectorLabel: string;
    orGroup: string;
    orGroupHeader: string;
    orGroupBadge: string;
    orGroupTitle: string;
    orGroupHint: string;
    orGroupChildren: string;
    orAlternative: string;
    orAlternativeBadge: string;
    errorCard: string;
    errorHeader: string;
    errorList: string;
    emptyCard: string;
  };
  headerFilterMenu: {
    button: string;
    buttonActive: string;
    menu: string;
    searchBox: string;
    searchInput: string;
    actionsRow: string;
    actionLink: string;
    list: string;
    listItem: string;
    checkbox: string;
    itemLabel: string;
    itemCount: string;
    footer: string;
    cancelButton: string;
    applyButton: string;
    empty: string;
  };
  savedPreviewPopover: {
    container: string;
    header: string;
    headerIcon: string;
    headerTitle: string;
    headerSubtitle: string;
    closeButton: string;
    body: string;
  };
  groupHeader: {
    value: string;
    count: string;
  };
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

/** Minimal string KV storage the engine persists UI state into. */
export interface StateStorage {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export interface ExportColumn {
  field: string;
  header: string;
}

export type NotifyKind = 'info' | 'success' | 'warning' | 'error';
export type NotifyFn = (message: string, kind: NotifyKind) => void;

export interface ExportContext<TRow extends RowData = RowData> {
  /** Rows currently passing all filters, in current sort order. */
  rows: TRow[];
  /** Visible, exportable columns. */
  columns: ExportColumn[];
  /** Resolves a row's export value for a column (applies `exportValue`). */
  valueOf: (row: TRow, field: string) => unknown;
  /** Suggested file name WITHOUT extension. */
  fileName: string;
  meta: {
    title: string;
    exportedAt: Date;
    totalRows: number;
    filteredRows: number;
  };
  notify: NotifyFn;
}

/**
 * A pluggable export integration. Ship your own (Google Sheets, Excel
 * Online, ...) by registering additional exporters on the engine config.
 */
export interface TableExporter<TRow extends RowData = RowData> {
  /** Unique id, e.g. 'csv', 'gsheets'. */
  id: string;
  /** Menu label when multiple exporters are registered. */
  label: string;
  /** Material Symbols icon name for the exporter menu. */
  icon?: string;
  run(ctx: ExportContext<TRow>): Promise<void> | void;
}

// ---------------------------------------------------------------------------
// Row updates
// ---------------------------------------------------------------------------

/** Surgical row change applied without a full reload. */
export interface RowUpdate<TRow extends RowData = RowData> {
  /** Value of the configured `index` field identifying the row. */
  id: string | number;
  /** Partial fields merged onto the existing row. */
  patch?: Partial<TRow>;
  /** Remove the row entirely. */
  remove?: boolean;
}

// ---------------------------------------------------------------------------
// Engine events
// ---------------------------------------------------------------------------

export interface MalkomTableEventMap<TRow extends RowData = RowData> {
  built: () => void;
  dataLoaded: (rows: TRow[]) => void;
  dataFiltered: (filteredCount: number) => void;
  searchChanged: (term: string) => void;
  prefiltersChanged: (active: SmartPrefilter[]) => void;
  groupingChanged: (field: string | null) => void;
  densityChanged: (dense: boolean) => void;
  rowClick: (row: TRow, event: UIEvent) => void;
  exportStarted: (exporterId: string) => void;
  exportCompleted: (exporterId: string) => void;
  exportFailed: (exporterId: string, error: unknown) => void;
  error: (error: unknown, context: 'load' | 'export' | 'internal') => void;
  destroyed: () => void;
}

export type MalkomTableEventName<TRow extends RowData = RowData> =
  keyof MalkomTableEventMap<TRow>;

// ---------------------------------------------------------------------------
// Main config
// ---------------------------------------------------------------------------

export interface MalkomTableConfig<TRow extends RowData = RowData> {
  /** Grid title shown in the top bar. */
  title: string;
  /** Row field uniquely identifying a row (Tabulator index). Required. */
  index: string;
  columns: MalkomColumn<TRow>[];
  /** Static initial data. Ignored when `loadData` is provided. */
  data?: TRow[];
  /** Async data source; enables refresh + LIVE badge + skeleton flows. */
  loadData?: () => Promise<TRow[]> | TRow[];
  /** Derive/normalize rows before they reach the grid. */
  formatData?: (rows: TRow[]) => TRow[];
  features?: MalkomTableFeatures;
  /** Initial grouping field(s). */
  groupBy?: string | string[];
  /** Custom group header renderer (return HTML string). */
  groupHeader?: (value: unknown, count: number) => string;
  /** Empty-grid placeholder text. Default from labels.noRecords. */
  placeholder?: string;
  /**
   * Namespace for persisted UI state (prefilters, density, page size,
   * grouping, Tabulator column/sort persistence). Persistence is disabled
   * when omitted.
   */
  persistenceId?: string;
  /** Storage backing persisted state. Default: localStorage (safe-guarded). */
  storage?: StateStorage;
  theme?: DeepPartial<MalkomTableTheme>;
  /**
   * CSS custom properties set on the grid shell — the quickest way to make
   * the engine adopt a host's design tokens, e.g.
   * `{ '--mte-accent': 'var(--brand-600)', '--mte-radius': '4px' }`.
   */
  cssVars?: Record<string, string>;
  labels?: Partial<MalkomTableLabels> & {
    operatorLabels?: Record<string, string>;
  };
  icons?: Partial<MalkomTableIcons>;
  /** Named formatter registry referenced by `column.formatter` strings. */
  formatters?: Record<string, MalkomFormatter<TRow>>;
  /** Extra exporters registered alongside the built-in CSV exporter. */
  exporters?: TableExporter<TRow>[];
  /** Exporter used by the export button when only one choice or as default. */
  defaultExporterId?: string;
  /** Export file name (without extension). Default derived from title. */
  exportFileName?: string | (() => string);
  /** Toast/notification sink. Default: no-op. */
  notify?: NotifyFn;
  /** Confirmation prompt (e.g. deleting a saved filter). Default: window.confirm. */
  confirmAction?: (message: string) => boolean | Promise<boolean>;
  onRowClick?: (row: TRow, event: UIEvent) => void;
  onDataLoaded?: (rows: TRow[]) => void;
  onError?: (error: unknown, context: 'load' | 'export' | 'internal') => void;
  /** Raw row element hook. */
  rowFormatter?: (element: HTMLElement, row: TRow) => void;
  /** Escape hatch: merged last into the Tabulator constructor options. */
  tabulatorOptions?: Record<string, unknown>;
  advanced?: {
    /** Inject a Tabulator constructor (tests / exotic builds). */
    tabulatorConstructor?: TabulatorConstructor;
    /** Document used for DOM creation. Default: globalThis.document. */
    documentRef?: Document;
  };
}

export type { ConditionGroup, SmartPrefilter };
