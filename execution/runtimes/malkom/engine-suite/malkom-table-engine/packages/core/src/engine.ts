/**
 * MalkomTableEngine — the config-driven grid engine for the Malkom stack.
 *
 * A page supplies a `MalkomTableConfig` (column metadata, a data source and
 * optional custom logic); the engine renders the full grid experience:
 * shell + search + smart prefilters + excel-style column filters + grouping
 * + persistence + skeleton + exports, on top of a host-provided Tabulator.
 */

import {
  compileCondition,
  validateCondition,
  type ConditionNode,
  type SmartPrefilter
} from './conditions.js';
import { buildSearchPredicate } from './search.js';
import { resolveWebStorage } from './storage.js';
import { createCsvExporter, ExporterRegistry } from './exporters.js';
import {
  groupableColumns,
  resolveConfig,
  type ResolvedConfig
} from './internal/config.js';
import { ensureEngineStyles } from './internal/styles.js';
import { buildShell, type ShellRefs } from './internal/shell.js';
import { SkeletonOverlay } from './internal/skeleton.js';
import { adoptShellTheme } from './internal/overlay.js';
import { injectFooterControls, type FooterControls } from './internal/footer.js';
import { HeaderFilterController } from './internal/headerFilter.js';
import { SettingsDrawer } from './internal/drawer.js';
import { PrefilterModal } from './internal/prefilterModal.js';
import { SavedPreviewPopover } from './internal/savedPreview.js';
import { Emitter } from './internal/emitter.js';
import {
  containsTarget,
  el,
  formatSyncTime,
  getByPath,
  icon,
  onOutsideClick
} from './internal/dom.js';
import { formatLabel } from './defaults/labels.js';
import {
  buildColumnDefinitions,
  buildTabulatorOptions,
  defaultTabulatorConstructor
} from './tabulator/adapter.js';
import type {
  ExportContext,
  MalkomTableConfig,
  MalkomTableEventMap,
  RowData,
  RowUpdate,
  TabRowComponent,
  TableExporter,
  TabulatorGrid
} from './types.js';

/**
 * Which engine currently owns which container.
 *
 * Building a second engine into a container that already has one (a vanilla
 * host remounting on a route change, a hand-rolled re-init) used to wipe the
 * first engine's DOM while its auto-refresh interval, visibilitychange
 * listener and Tabulator instance kept running forever. The previous owner
 * is torn down first instead.
 */
const enginesByContainer = new WeakMap<
  HTMLElement,
  { destroy: () => void }
>();

export class MalkomTableEngine<TRow extends RowData = RowData> {
  private readonly resolved: ResolvedConfig<TRow>;
  private readonly shell: ShellRefs;
  private readonly skeleton: SkeletonOverlay;
  private readonly headerFilters: HeaderFilterController<TRow>;
  private readonly drawer: SettingsDrawer;
  private readonly modal: PrefilterModal;
  private readonly savedPreview: SavedPreviewPopover;
  private readonly emitter = new Emitter<MalkomTableEventMap<TRow>>();
  private readonly registry = new ExporterRegistry<TRow>();

  private readonly container: HTMLElement;
  private tabulator: TabulatorGrid | null = null;
  private footerControls: FooterControls | null = null;

  private rawData: TRow[] = [];
  private processedData: TRow[] = [];
  private pendingData: TRow[] | null = null;

  private searchTerm = '';
  private prefilters: SmartPrefilter[] = [];
  private readonly activePrefilterIds = new Set<string>();
  private dense = false;
  private currentGroupField: string | null = null;
  /** True when the user explicitly cleared grouping (persisted choice). */
  private groupCleared = false;
  private currentPageSize: number;
  private exportMenuDispose: (() => void) | null = null;

  private built = false;
  private destroyed = false;
  private loading = false;
  private lastRefreshTime: number | null = null;
  private lastActiveCount = 0;

  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private visibilityHandler: (() => void) | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private lastLayoutWidth = 0;

  constructor(container: string | HTMLElement, config: MalkomTableConfig<TRow>) {
    this.resolved = resolveConfig(config);
    const { doc, theme, labels, icons, features } = this.resolved;

    const containerEl =
      typeof container === 'string'
        ? doc.getElementById(container.replace(/^#/, ''))
        : container;
    if (!containerEl) {
      throw new Error(
        `MalkomTableEngine: container ${String(container)} not found`
      );
    }

    // Never strand a live engine whose DOM we are about to replace.
    enginesByContainer.get(containerEl)?.destroy();
    enginesByContainer.set(containerEl, this);
    this.container = containerEl;

    ensureEngineStyles(doc, features.injectSkin);
    this.currentPageSize = features.paginationSize;
    this.loadPersistedState();

    // Exporters: built-in CSV first, host exporters may add or replace.
    this.registry.register(createCsvExporter<TRow>());
    for (const exporter of config.exporters ?? []) {
      this.registry.register(exporter, { replace: true });
    }

    // Shell
    this.shell = buildShell({
      doc,
      container: containerEl,
      theme,
      labels,
      icons,
      features,
      title: config.title,
      cssVars: config.cssVars,
      callbacks: {
        onSearch: (term) => this.handleSearch(term),
        onRefresh: () => void this.refreshData(),
        onExport: (anchor) => void this.handleExport(anchor),
        onSettings: () => this.openSettings(),
        onDensityToggle: () => this.toggleDensity(),
        onClearGrouping: () => this.setGroupBy(null)
      }
    });
    this.skeleton = new SkeletonOverlay(
      doc,
      this.shell.skeletonOverlay,
      theme,
      features.skeletonRows
    );
    this.applyDensityClass();

    // Header filters
    this.headerFilters = new HeaderFilterController<TRow>({
      doc,
      theme,
      labels,
      icons,
      getAllRows: () => this.processedData,
      shellRoot: this.shell.root
    });

    // Tabulator
    const columnDefs = buildColumnDefinitions(this.resolved, (column) =>
      this.headerFilters.binding(column)
    );
    const options = buildTabulatorOptions(this.resolved, columnDefs);
    if (this.groupCleared) {
      delete options['groupBy'];
    } else if (this.currentGroupField) {
      options['groupBy'] = this.currentGroupField;
    }

    const Ctor =
      config.advanced?.tabulatorConstructor ?? defaultTabulatorConstructor();
    this.tabulator = new Ctor(this.shell.gridHost, options);
    this.wireTabulatorEvents();

    // Overlays
    this.drawer = new SettingsDrawer({
      doc,
      theme,
      labels,
      icons,
      features,
      mountRoot: this.shell.root,
      getGroupableColumns: () =>
        groupableColumns(config.columns).map((c) => ({
          field: c.field,
          header: c.header
        })),
      getCurrentGroupField: () => this.currentGroupField,
      getColumns: () => this.drawerColumns(),
      getPrefilters: () => this.prefilters,
      getActivePrefilterIds: () => this.activePrefilterIds,
      callbacks: {
        onClearFilters: () => this.clearFilters(),
        onClearSort: () => this.clearSort(),
        onGroupChange: (field) => this.setGroupBy(field),
        onMasterReset: () => this.resetView(),
        onCreateFilter: () => this.openPrefilterModal(),
        onEditFilter: (pf) => this.openPrefilterModal(pf),
        onDeleteFilter: (id) => void this.deletePrefilter(id),
        onTogglePrefilter: (pf) => this.togglePrefilter(pf),
        onToggleColumn: (field) => this.toggleColumn(field),
        onShowSavedPreview: (pf, anchor) => this.savedPreview.toggle(pf, anchor)
      }
    });
    this.modal = new PrefilterModal({
      doc,
      theme,
      labels,
      icons,
      fields: this.resolved.conditionFields,
      notify: this.resolved.notify,
      onSave: (pf) => this.savePrefilter(pf)
    });
    this.savedPreview = new SavedPreviewPopover({
      doc,
      theme,
      labels,
      icons,
      fields: this.resolved.conditionFields,
      shellRoot: this.shell.root
    });

    this.setupAutoRefresh();
    this.setupResizeRefit();
  }

  /**
   * Re-fit columns to the container.
   *
   * Auto-sized columns are measured from rendered header and cell widths, so
   * a grid built while its container has no width (hidden tab, closed
   * drawer, pre-layout mount) sizes every column to the minimum. Re-fitting
   * once a real width arrives is what makes `fitDataFill` behave.
   */
  refitColumns(): void {
    const grid = this.tabulator;
    if (!grid || !this.built) return;
    try {
      grid.redraw(true);
    } catch {
      /* a redraw during teardown is not worth surfacing */
    }
  }

  // ========================================================================
  // Public API
  // ========================================================================

  on<K extends keyof MalkomTableEventMap<TRow>>(
    event: K,
    listener: MalkomTableEventMap<TRow>[K]
  ): () => void {
    return this.emitter.on(event, listener);
  }

  off<K extends keyof MalkomTableEventMap<TRow>>(
    event: K,
    listener: MalkomTableEventMap<TRow>[K]
  ): void {
    this.emitter.off(event, listener);
  }

  isBuilt(): boolean {
    return this.built;
  }

  /** The raw rows as supplied by the data source (shallow copy). */
  getRawData(): TRow[] {
    return this.rawData.slice();
  }

  /** Rows after `formatData` — what the grid renders (shallow copy). */
  getProcessedData(): TRow[] {
    return this.processedData.slice();
  }

  /** Escape hatch to the underlying Tabulator instance. */
  getTabulator(): TabulatorGrid | null {
    return this.tabulator;
  }

  getActivePrefilters(): SmartPrefilter[] {
    return this.prefilters.filter((pf) => this.activePrefilterIds.has(pf.id));
  }

  getPrefilters(): SmartPrefilter[] {
    return [...this.prefilters];
  }

  /** Replace the table data (static-data flows). */
  setData(data: TRow[]): void {
    // Copy: the engine must never mutate a caller-owned array (React state,
    // shared config.data) via applyRowUpdates later.
    const rows = Array.isArray(data) ? data.slice() : [];
    if (!this.built || !this.tabulator) {
      this.pendingData = rows;
      return;
    }
    this.rawData = rows;
    this.processedData = this.processRows(rows);
    const result = this.tabulator.setData(this.processedData);
    Promise.resolve(result)
      .catch(() => undefined)
      .then(() => {
        this.defensiveRedraw();
        this.updateHeaderMeta();
      });
  }

  /**
   * Reload from `loadData` (no-op without one).
   *
   * `background: true` (used by auto-refresh) reloads quietly: no skeleton
   * overlay, no scroll reset, no "data refreshed" notification — so a user
   * reading the grid is not interrupted every tick.
   */
  async refreshData(options: { background?: boolean } = {}): Promise<void> {
    const background = options.background === true;
    const { config, features, labels, notify } = this.resolved;
    if (!config.loadData || this.destroyed || this.loading) return;
    this.loading = true;
    const showSkeleton = features.skeleton && !background;
    if (showSkeleton) this.skeleton.show();
    try {
      const data = await config.loadData();
      if (this.destroyed) return;
      if (Array.isArray(data)) {
        this.rawData = data.slice();
        this.processedData = this.processRows(this.rawData);
        if (this.built && this.tabulator) {
          await this.tabulator.setData(this.processedData);
          if (!background) this.resetScroll();
        } else {
          this.pendingData = this.rawData;
        }
        this.lastRefreshTime = Date.now();
        this.updateHeaderMeta();
        config.onDataLoaded?.(data);
        this.emitter.emit('dataLoaded', data);
        if (!background) notify(labels.dataRefreshed, 'info');
      }
    } catch (error) {
      if (!this.destroyed) {
        notify(labels.loadError, 'error');
        this.resolved.config.onError?.(error, 'load');
        this.emitter.emit('error', error, 'load');
      }
    } finally {
      this.loading = false;
      if (showSkeleton) this.skeleton.hide();
    }
  }

  /** Programmatic global search. */
  setSearchTerm(term: string): void {
    for (const input of this.shell.searchInputs) input.value = term;
    this.handleSearch(term);
  }

  getSearchTerm(): string {
    return this.searchTerm;
  }

  /** Set (or clear with null) single-field grouping. */
  setGroupBy(field: string | null): void {
    if (!this.tabulator) return;
    const { labels, notify } = this.resolved;
    this.currentGroupField = field;
    this.groupCleared = field === null;
    this.tabulator.setGroupBy(field ?? false);
    // '' is the persisted sentinel for "user explicitly cleared grouping" —
    // distinguishable from an absent key, so a config default groupBy does
    // not resurrect on reload.
    this.resolved.store?.write('groupBy', field ?? '');
    this.renderGroupChip();
    this.drawer.refresh();
    if (field) {
      const column = this.resolved.config.columns.find((c) => c.field === field);
      notify(`${labels.groupedBy} ${column?.header ?? field}`, 'success');
    }
    this.emitter.emit('groupingChanged', field);
  }

  getGroupBy(): string | null {
    return this.currentGroupField;
  }

  toggleDensity(): void {
    this.dense = !this.dense;
    this.applyDensityClass();
    this.resolved.store?.write('density', this.dense);
    this.emitter.emit('densityChanged', this.dense);
  }

  isDense(): boolean {
    return this.dense;
  }

  /** Toggle a saved prefilter on/off. */
  togglePrefilter(prefilter: SmartPrefilter): void {
    const { labels, notify } = this.resolved;
    if (this.activePrefilterIds.has(prefilter.id)) {
      this.activePrefilterIds.delete(prefilter.id);
      notify(formatLabel(labels.filterRemoved, { name: prefilter.name }), 'info');
    } else {
      this.activePrefilterIds.add(prefilter.id);
      notify(formatLabel(labels.filterApplied, { name: prefilter.name }), 'success');
    }
    this.persistActivePrefilters();
    this.applyAllFilters();
    this.renderPrefilterChips();
    this.drawer.refresh();
    this.emitter.emit('prefiltersChanged', this.getActivePrefilters());
  }

  /** Save (create or update) a prefilter and activate it. */
  savePrefilter(prefilter: SmartPrefilter): void {
    const existingIndex = this.prefilters.findIndex((p) => p.id === prefilter.id);
    if (existingIndex >= 0) this.prefilters[existingIndex] = prefilter;
    else this.prefilters.push(prefilter);
    this.activePrefilterIds.add(prefilter.id);
    this.persistPrefilters();
    this.persistActivePrefilters();
    this.applyAllFilters();
    this.renderPrefilterChips();
    this.drawer.refresh();
    this.resolved.notify(this.resolved.labels.filterSaved, 'success');
    this.emitter.emit('prefiltersChanged', this.getActivePrefilters());
  }

  async deletePrefilter(id: string): Promise<void> {
    const { labels } = this.resolved;
    const confirmed = await this.resolved.confirmAction(labels.deleteFilterConfirm);
    if (!confirmed) return;
    this.prefilters = this.prefilters.filter((p) => p.id !== id);
    this.activePrefilterIds.delete(id);
    this.persistPrefilters();
    this.persistActivePrefilters();
    this.applyAllFilters();
    this.renderPrefilterChips();
    this.drawer.refresh();
    this.emitter.emit('prefiltersChanged', this.getActivePrefilters());
  }

  openSettings(): void {
    this.drawer.open();
  }

  closeSettings(): void {
    this.drawer.close();
  }

  openPrefilterModal(existing: SmartPrefilter | null = null): void {
    this.modal.open(existing);
  }

  /** Clear search, prefilters, programmatic and header filters. */
  clearFilters(options: { silent?: boolean } = {}): void {
    this.searchTerm = '';
    for (const debouncer of this.shell.searchDebouncers) debouncer.cancel();
    for (const input of this.shell.searchInputs) input.value = '';
    this.activePrefilterIds.clear();
    this.persistActivePrefilters();
    this.tabulator?.clearFilter();
    this.clearHeaderFiltersSafe();
    this.headerFilters.refreshIcons();
    this.renderPrefilterChips();
    this.drawer.refresh();
    if (!options.silent) {
      this.resolved.notify(this.resolved.labels.filtersCleared, 'info');
    }
    this.emitter.emit('prefiltersChanged', []);
    this.emitter.emit('searchChanged', '');
  }

  clearSort(options: { silent?: boolean } = {}): void {
    this.tabulator?.clearSort();
    if (!options.silent) {
      this.resolved.notify(this.resolved.labels.sortCleared, 'info');
    }
  }

  /** Master reset: filters, sort, grouping, column layout, persistence. */
  resetView(): void {
    this.clearFilters({ silent: true });
    this.clearSort({ silent: true });
    this.setGroupBy(null);

    if (this.tabulator) {
      // Restore the full config layout — order, width AND visibility.
      // (show/hide alone would leave user-dragged order/widths in place,
      // and Tabulator would immediately re-persist them.)
      const layout = this.resolved.config.columns.map((column) => {
        const entry: { field: string; visible: boolean; width?: number } = {
          field: column.field,
          visible: column.visible !== false
        };
        if (typeof column.width === 'number') entry.width = column.width;
        return entry;
      });
      let layoutRestored = false;
      if (typeof this.tabulator.setColumnLayout === 'function') {
        try {
          this.tabulator.setColumnLayout(layout);
          layoutRestored = true;
        } catch {
          /* fall through to visibility-only restore */
        }
      }
      if (!layoutRestored) {
        for (const column of this.resolved.config.columns) {
          try {
            if (column.visible === false) this.tabulator.hideColumn(column.field);
            else this.tabulator.showColumn(column.field);
          } catch {
            /* unknown column — ignore */
          }
        }
      }
    }

    this.clearTabulatorPersistence();
    this.drawer.refresh();
    this.resolved.notify(this.resolved.labels.viewReset, 'info');
  }

  /** Run an exporter (default when id omitted). */
  async export(exporterId?: string): Promise<void> {
    const exporter = this.pickExporter(exporterId);
    if (!exporter) return;
    await this.runExport(exporter, this.shell.exportBtn);
  }

  /** Apply surgical row changes without a full reload. */
  applyRowUpdates(updates: RowUpdate<TRow>[]): void {
    if (!Array.isArray(updates) || updates.length === 0) return;
    const indexField = this.resolved.config.index;
    const toUpsert: TRow[] = [];
    const toDelete: (string | number)[] = [];

    for (const update of updates) {
      if (update.id === undefined || update.id === null) continue;
      const matches = (row: TRow): boolean =>
        String(getByPath(row, indexField)) === String(update.id);

      const rawIndex = this.rawData.findIndex(matches);
      const processedIndex = this.processedData.findIndex(matches);

      if (update.remove === true) {
        if (rawIndex >= 0) this.rawData.splice(rawIndex, 1);
        if (processedIndex >= 0) this.processedData.splice(processedIndex, 1);
        toDelete.push(update.id);
        continue;
      }

      const oldRaw = rawIndex >= 0 ? this.rawData[rawIndex] : undefined;
      const merged = {
        ...(oldRaw ?? {}),
        ...(update.patch ?? {}),
        [indexField]: update.id
      } as TRow;
      const processed = this.processRows([merged])[0] ?? merged;

      if (rawIndex >= 0) this.rawData[rawIndex] = merged;
      else this.rawData.push(merged);
      if (processedIndex >= 0) this.processedData[processedIndex] = processed;
      else this.processedData.push(processed);
      toUpsert.push(processed);
    }

    if (this.tabulator) {
      if (toUpsert.length > 0) {
        void Promise.resolve(this.tabulator.updateOrAddData(toUpsert)).catch(
          () => undefined
        );
      }
      for (const id of toDelete) {
        // Tabulator rejects (async) for missing rows rather than throwing —
        // attach a handler so stray deletes never surface as unhandled
        // promise rejections.
        try {
          void Promise.resolve(this.tabulator.deleteRow(id)).catch(
            () => undefined
          );
        } catch {
          /* defensive: synchronous throw from an exotic implementation */
        }
      }
    }
    this.updateHeaderMeta();
  }

  /** Register an additional exporter at runtime. */
  registerExporter(exporter: TableExporter<TRow>, opts: { replace?: boolean } = {}): void {
    this.registry.register(exporter, opts);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    if (this.refreshTimer !== null) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
    if (this.visibilityHandler) {
      this.resolved.doc.removeEventListener(
        'visibilitychange',
        this.visibilityHandler
      );
      this.visibilityHandler = null;
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    this.closeExportMenu();
    this.headerFilters.dispose();
    this.savedPreview.close();
    this.modal.dispose();
    this.drawer.dispose();
    this.footerControls?.dispose();
    this.footerControls = null;
    try {
      this.tabulator?.destroy();
    } catch {
      /* Tabulator teardown must never break host unmount */
    }
    this.tabulator = null;
    this.shell.dispose();
    if (enginesByContainer.get(this.container) === this) {
      enginesByContainer.delete(this.container);
    }
    this.emitter.emit('destroyed');
    this.emitter.clear();
  }

  // ========================================================================
  // Internals
  // ========================================================================

  private loadPersistedState(): void {
    const store = this.resolved.store;
    if (!store) return;

    // Persisted payloads are untrusted (version skew, other writers on the
    // same origin): deep-validate shapes so corrupt entries can neither
    // crash construction nor break filtering.
    this.prefilters = sanitizePrefilters(store.read<unknown>('prefilters', []));
    const activeIds = store.read<unknown>('activePrefilterIds', []);
    if (Array.isArray(activeIds)) {
      for (const id of activeIds) {
        if (typeof id !== 'string') continue;
        const prefilter = this.prefilters.find((p) => p.id === id);
        if (!prefilter) continue;
        // Deactivate saved filters that no longer validate against the
        // current column config (renamed/removed fields would otherwise
        // silently degrade to wrong comparisons). They stay in the list
        // for the user to edit or delete.
        if (!validateCondition(prefilter.root, this.resolved.conditionFields).valid) {
          continue;
        }
        this.activePrefilterIds.add(id);
      }
    }

    this.dense = store.read<boolean>('density', false) === true;
    const pageSize = store.read<unknown>('pageSize', this.currentPageSize);
    if (
      typeof pageSize === 'number' &&
      this.resolved.features.paginationSizes.includes(pageSize)
    ) {
      this.currentPageSize = pageSize;
    }

    const groupBy = store.read<unknown>('groupBy', null);
    if (groupBy === '') {
      // Sentinel: user explicitly cleared grouping in a previous session.
      this.groupCleared = true;
      this.currentGroupField = null;
    } else if (
      typeof groupBy === 'string' &&
      this.resolved.config.columns.some((c) => c.field === groupBy)
    ) {
      this.currentGroupField = groupBy;
    }
  }

  private wireTabulatorEvents(): void {
    const grid = this.tabulator;
    if (!grid) return;

    grid.on('tableBuilt', () => this.handleTableBuilt());

    grid.on('dataFiltered', (_filters: unknown, rows: TabRowComponent[]) => {
      const count = Array.isArray(rows) ? rows.length : 0;
      this.updateHeaderMeta(count);

      // If the user was scrolled down and filtering shrank the result set,
      // Tabulator can render a blank viewport; reset scroll when it matters.
      const holder = grid.element?.querySelector?.('.tabulator-tableholder');
      if (holder) {
        const prev = this.lastActiveCount || count;
        if (count === 0 || (holder.scrollTop > 0 && count < prev)) {
          holder.scrollTop = 0;
        }
      }
      this.lastActiveCount = count;
      this.emitter.emit('dataFiltered', count);
    });

    grid.on('pageSizeChanged', (size: number) => {
      if (typeof size === 'number' && Number.isFinite(size)) {
        this.currentPageSize = size;
        this.resolved.store?.write('pageSize', size);
        this.footerControls?.setPageSize(size);
      }
      this.resetScroll();
      setTimeout(() => {
        try {
          grid.redraw(true);
        } catch {
          /* ignore */
        }
      }, 0);
    });

    grid.on('rowClick', (event: UIEvent, row: TabRowComponent) => {
      const data = row.getData() as TRow;
      this.resolved.config.onRowClick?.(data, event);
      this.emitter.emit('rowClick', data, event);
    });

    grid.on('scrollVertical', () => {
      this.headerFilters.closeMenu();
    });
  }

  private handleTableBuilt(): void {
    this.built = true;
    const grid = this.tabulator;
    if (!grid) return;
    const { features, labels, theme, doc } = this.resolved;

    if (features.pagination) {
      this.footerControls = injectFooterControls({
        doc,
        gridRoot: grid.element,
        theme,
        labels,
        sizes: features.paginationSizes,
        currentSize: this.currentPageSize,
        onPageSizeChange: (size) => {
          try {
            grid.setPageSize(size);
          } catch {
            /* ignore */
          }
        }
      });
      if (this.currentPageSize !== features.paginationSize) {
        try {
          grid.setPageSize(this.currentPageSize);
        } catch {
          /* ignore */
        }
      }
    }

    // Initial grouping chip (config or persisted single-field grouping);
    // an explicit user "no grouping" choice wins over the config default.
    if (
      !this.groupCleared &&
      !this.currentGroupField &&
      typeof this.resolved.config.groupBy === 'string'
    ) {
      this.currentGroupField = this.resolved.config.groupBy;
    }
    this.renderGroupChip();

    // Restore active prefilters + chips
    this.applyAllFilters();
    this.renderPrefilterChips();

    // Data
    if (this.pendingData) {
      const pending = this.pendingData;
      this.pendingData = null;
      this.setData(pending);
    } else if (!this.resolved.config.loadData && this.resolved.config.data) {
      this.setData(this.resolved.config.data);
    }
    if (this.resolved.config.loadData) {
      void this.refreshData();
    }

    this.updateHeaderMeta();
    this.emitter.emit('built');
  }

  private processRows(rows: TRow[]): TRow[] {
    // Always return a DISTINCT array of DISTINCT row objects: rawData and
    // processedData are spliced independently in applyRowUpdates, and
    // Tabulator merges row updates INTO the row objects it was given — so
    // grid rows must never alias caller-owned row objects.
    const cloneRows = (list: TRow[]): TRow[] => list.map((row) => ({ ...row }));
    const format = this.resolved.config.formatData;
    if (typeof format !== 'function') return cloneRows(rows);
    try {
      const formatted = format(rows);
      if (!Array.isArray(formatted)) return cloneRows(rows);
      return formatted === rows ? cloneRows(formatted) : formatted;
    } catch (error) {
      this.resolved.config.onError?.(error, 'internal');
      this.emitter.emit('error', error, 'internal');
      return cloneRows(rows);
    }
  }

  private handleSearch(term: string): void {
    this.searchTerm = term;
    // Keep desktop + mobile inputs in sync
    for (const input of this.shell.searchInputs) {
      if (input.value !== term) input.value = term;
    }
    this.applyAllFilters();
    this.resetScroll();
    this.emitter.emit('searchChanged', term);
  }

  private applyAllFilters(): void {
    const grid = this.tabulator;
    if (!grid || !this.built) return;

    const activePrefilters = this.getActivePrefilters();
    const predicates = activePrefilters.map((pf) =>
      compileCondition(pf.root, this.resolved.conditionFields)
    );
    const term = this.searchTerm.trim();
    const searchPredicate =
      term === ''
        ? null
        : buildSearchPredicate<TRow>(term, this.resolved.searchTargets);

    if (predicates.length === 0 && searchPredicate === null) {
      grid.clearFilter();
      return;
    }

    grid.setFilter((data: TRow): boolean => {
      for (const predicate of predicates) {
        if (!predicate(data)) return false;
      }
      if (searchPredicate && !searchPredicate(data)) return false;
      return true;
    });
  }

  private clearHeaderFiltersSafe(): void {
    const grid = this.tabulator;
    if (!grid) return;
    for (const column of grid.getColumns()) {
      const field = column.getField();
      if (!field) continue;
      const def = column.getDefinition();
      if (!def['headerFilter']) continue;
      try {
        grid.setHeaderFilterValue(field, '');
      } catch {
        /* per-column reset failures must not break Clear Filters */
      }
    }
  }

  private clearTabulatorPersistence(): void {
    const id = this.resolved.config.persistenceId;
    if (!id) return;
    // Tabulator persists through the engine's own store (see the reader/
    // writer wiring in tabulator/adapter.ts).
    this.resolved.store?.remove('tabulator:columns');
    this.resolved.store?.remove('tabulator:sort');
    // Also drop anything left by Tabulator's default writer, so a layout
    // saved before this wiring existed cannot resurrect after a reset.
    try {
      const storage = resolveWebStorage();
      storage?.removeItem(`tabulator-${id}-columns`);
      storage?.removeItem(`tabulator-${id}-sort`);
    } catch {
      /* ignore */
    }
  }

  private drawerColumns(): { field: string; title: string; visible: boolean; locked: boolean }[] {
    const grid = this.tabulator;
    if (!grid) return [];
    const configByField = new Map(
      this.resolved.config.columns.map((c) => [c.field, c] as const)
    );
    const result: { field: string; title: string; visible: boolean; locked: boolean }[] =
      [];
    for (const column of grid.getColumns()) {
      const field = column.getField();
      if (!field) continue;
      const def = column.getDefinition();
      const config = configByField.get(field);
      result.push({
        field,
        title: String(def.title ?? config?.header ?? field),
        visible: column.isVisible(),
        locked: config?.locked === true
      });
    }
    return result;
  }

  private toggleColumn(field: string): void {
    const grid = this.tabulator;
    if (!grid) return;
    const column = grid.getColumns().find((c) => c.getField() === field);
    if (!column) return;
    column.toggle();
    this.drawer.refresh();
  }

  private renderGroupChip(): void {
    const { groupChipWrap, groupChipName } = this.shell;
    if (!this.currentGroupField) {
      groupChipWrap.style.display = 'none';
      return;
    }
    const column = this.resolved.config.columns.find(
      (c) => c.field === this.currentGroupField
    );
    groupChipName.textContent = column?.header ?? this.currentGroupField;
    groupChipWrap.style.display = '';
  }

  private renderPrefilterChips(): void {
    const wrap = this.shell.prefilterChipsWrap;
    const { doc, theme, icons: ic } = this.resolved;
    const active = this.getActivePrefilters();
    wrap.innerHTML = '';
    if (active.length === 0) {
      wrap.style.display = 'none';
      return;
    }
    wrap.style.display = '';
    for (const prefilter of active) {
      const chip = el(doc, 'div', { className: theme.topBar.prefilterChip });
      chip.appendChild(
        icon(doc, ic.prefilter, 'material-symbols-rounded text-[14px]')
      );
      chip.appendChild(el(doc, 'span', { text: prefilter.name }));
      const removeBtn = el(doc, 'button', {
        className: theme.topBar.prefilterChipRemove,
        type: 'button'
      });
      removeBtn.appendChild(
        icon(doc, ic.close, 'material-symbols-rounded text-[14px]')
      );
      removeBtn.addEventListener('click', () => this.togglePrefilter(prefilter));
      chip.appendChild(removeBtn);
      wrap.appendChild(chip);
    }
  }

  private persistPrefilters(): void {
    this.resolved.store?.write('prefilters', this.prefilters);
  }

  private persistActivePrefilters(): void {
    this.resolved.store?.write('activePrefilterIds', [...this.activePrefilterIds]);
  }

  private applyDensityClass(): void {
    this.shell.root.classList.toggle('mte-dense', this.dense);
    const iconEl = this.shell.densityIconEl;
    if (iconEl) {
      iconEl.textContent = this.dense
        ? this.resolved.icons.densityComfortable
        : this.resolved.icons.densityCompact;
    }
  }

  private updateHeaderMeta(activeCount?: number): void {
    const { labels } = this.resolved;
    const total = this.processedData.length;
    let active = activeCount;
    if (active === undefined) {
      try {
        active = this.tabulator?.getDataCount('active') ?? total;
      } catch {
        active = total;
      }
    }
    if (this.shell.syncCountEl) {
      this.shell.syncCountEl.textContent = `${active} ${labels.records}`;
    }
    if (this.shell.syncTimeEl) {
      this.shell.syncTimeEl.textContent =
        this.lastRefreshTime === null ? '—' : formatSyncTime(this.lastRefreshTime);
    }
    this.footerControls?.updateCounts(total, active ?? total);
  }

  private resetScroll(): void {
    const holder = this.tabulator?.element?.querySelector?.(
      '.tabulator-tableholder'
    );
    if (holder) holder.scrollTop = 0;
  }

  private defensiveRedraw(): void {
    const grid = this.tabulator;
    if (!grid) return;
    try {
      void grid.setPage(1);
    } catch {
      /* pagination may be off */
    }
    try {
      grid.redraw(true);
    } catch {
      /* ignore */
    }
    this.resetScroll();
  }

  private setupResizeRefit(): void {
    if (!this.resolved.features.refitOnResize) return;
    const view = this.resolved.doc.defaultView as
      | (Window & { ResizeObserver?: typeof ResizeObserver })
      | null;
    const Observer = view?.ResizeObserver ?? globalThis.ResizeObserver;
    if (typeof Observer !== 'function') return;

    this.resizeObserver = new Observer((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      if (width === 0) return;
      // Only re-fit on a real change: the first non-zero width (the grid was
      // measured while hidden) or a container resize past a small threshold.
      if (Math.abs(width - this.lastLayoutWidth) < 2) return;
      const wasUnmeasured = this.lastLayoutWidth === 0;
      this.lastLayoutWidth = width;
      if (!this.built) return;
      if (wasUnmeasured) this.refitColumns();
      else {
        try {
          this.tabulator?.redraw();
        } catch {
          /* ignore */
        }
      }
    });
    this.resizeObserver.observe(this.shell.root);
  }

  private setupAutoRefresh(): void {
    const { features, config, doc } = this.resolved;
    if (!config.loadData || features.autoRefreshMs <= 0) return;

    this.refreshTimer = setInterval(() => {
      if (!doc.hidden) void this.refreshData({ background: true });
    }, features.autoRefreshMs);

    this.visibilityHandler = (): void => {
      if (doc.hidden) return;
      const elapsed = Date.now() - (this.lastRefreshTime ?? 0);
      if (elapsed > features.autoRefreshVisibilityMs) {
        void this.refreshData({ background: true });
      }
    };
    doc.addEventListener('visibilitychange', this.visibilityHandler);
  }

  // ------------------------------------------------------------ Export

  private pickExporter(exporterId?: string): TableExporter<TRow> | null {
    const id = exporterId ?? this.resolved.config.defaultExporterId;
    if (id) {
      const exporter = this.registry.get(id);
      if (!exporter) {
        this.resolved.notify(
          `${this.resolved.labels.exportFailed}: unknown exporter "${id}"`,
          'error'
        );
        return null;
      }
      return exporter;
    }
    return this.registry.list()[0] ?? null;
  }

  private async handleExport(anchor: HTMLElement): Promise<void> {
    const exporters = this.registry.list();
    if (exporters.length === 0) return;
    const defaultId = this.resolved.config.defaultExporterId;
    if (exporters.length === 1 || defaultId) {
      const exporter = this.pickExporter();
      if (exporter) await this.runExport(exporter, anchor);
      return;
    }
    this.showExporterMenu(exporters, anchor);
  }

  private closeExportMenu(): void {
    if (this.exportMenuDispose) {
      this.exportMenuDispose();
      this.exportMenuDispose = null;
    }
  }

  private showExporterMenu(
    exporters: TableExporter<TRow>[],
    anchor: HTMLElement
  ): void {
    const { doc, theme } = this.resolved;
    this.closeExportMenu();

    const menu = el(doc, 'div', {
      className: `mte-export-menu ${theme.headerFilterMenu.menu}`
    });
    for (const exporter of exporters) {
      const item = el(doc, 'button', {
        className:
          'flex items-center gap-2 w-full text-left px-3 py-2 text-xs font-bold text-slate-700 hover:bg-pink-50 hover:text-pink-700 transition cursor-pointer',
        type: 'button'
      });
      if (exporter.icon) {
        item.appendChild(
          icon(doc, exporter.icon, 'material-symbols-rounded text-[16px]')
        );
      }
      item.appendChild(doc.createTextNode(exporter.label));
      item.addEventListener('click', () => {
        this.closeExportMenu();
        void this.runExport(exporter, anchor);
      });
      menu.appendChild(item);
    }
    adoptShellTheme(this.shell.root, menu);
    doc.body.appendChild(menu);

    const rect = anchor.getBoundingClientRect();
    menu.style.left = `${Math.max(8, rect.right - (menu.offsetWidth || 180))}px`;
    menu.style.top = `${rect.bottom + 6}px`;

    const disposeOutside = onOutsideClick(
      doc,
      (target) => containsTarget(menu, target),
      () => this.closeExportMenu()
    );
    this.exportMenuDispose = (): void => {
      disposeOutside();
      menu.remove();
    };
  }

  private async runExport(
    exporter: TableExporter<TRow>,
    button: HTMLElement | null
  ): Promise<void> {
    const { labels, notify, icons: ic, doc } = this.resolved;
    const grid = this.tabulator;
    if (!grid) return;

    const rows = (grid.getData('active') as TRow[]) ?? [];
    if (rows.length === 0) {
      notify(labels.exportNoData, 'warning');
      return;
    }
    const columns = this.exportColumns();
    if (columns.length === 0) {
      notify(labels.exportNoColumns, 'warning');
      return;
    }

    const exportValueByField = new Map(
      this.resolved.config.columns
        .filter((c) => typeof c.exportValue === 'function')
        .map((c) => [c.field, c.exportValue as (row: TRow) => unknown] as const)
    );
    const ctx: ExportContext<TRow> = {
      rows,
      columns,
      valueOf: (row, field) => {
        const custom = exportValueByField.get(field);
        return custom ? custom(row) : getByPath(row, field);
      },
      fileName: this.resolved.exportFileName(),
      meta: {
        title: this.resolved.config.title,
        exportedAt: new Date(),
        totalRows: this.processedData.length,
        filteredRows: rows.length
      },
      notify
    };

    // Busy state
    const btn = button as HTMLButtonElement | null;
    const originalHtml = btn?.innerHTML ?? null;
    const originalDisabled = btn?.disabled ?? false;
    if (btn) {
      btn.disabled = true;
      btn.classList.add('opacity-60', 'cursor-not-allowed');
      btn.innerHTML = '';
      btn.appendChild(
        icon(doc, ic.exportBusy, 'material-symbols-rounded text-[17px] animate-spin')
      );
      btn.appendChild(doc.createTextNode(labels.exporting));
    }

    this.emitter.emit('exportStarted', exporter.id);
    try {
      await exporter.run(ctx);
      notify(labels.exportSuccess, 'success');
      this.emitter.emit('exportCompleted', exporter.id);
    } catch (error) {
      notify(labels.exportFailed, 'error');
      this.resolved.config.onError?.(error, 'export');
      this.emitter.emit('exportFailed', exporter.id, error);
      this.emitter.emit('error', error, 'export');
    } finally {
      if (btn) {
        btn.disabled = originalDisabled;
        btn.classList.remove('opacity-60', 'cursor-not-allowed');
        if (originalHtml !== null) btn.innerHTML = originalHtml;
      }
    }
  }

  private exportColumns(): { field: string; header: string }[] {
    const grid = this.tabulator;
    const configByField = new Map(
      this.resolved.config.columns.map((c) => [c.field, c] as const)
    );
    if (!grid) {
      return this.resolved.config.columns
        .filter((c) => c.exportable !== false && c.visible !== false)
        .map((c) => ({ field: c.field, header: c.exportHeader ?? c.header }));
    }
    const result: { field: string; header: string }[] = [];
    for (const column of grid.getColumns()) {
      const field = column.getField();
      if (!field || !column.isVisible()) continue;
      const config = configByField.get(field);
      if (config?.exportable === false) continue;
      result.push({
        field,
        header:
          config?.exportHeader ??
          config?.header ??
          String(column.getDefinition().title ?? field)
      });
    }
    return result;
  }
}


// ---------------------------------------------------------------------------
// Persisted-state sanitization
// ---------------------------------------------------------------------------

function isValidConditionNode(node: unknown): node is ConditionNode {
  if (!node || typeof node !== 'object') return false;
  const n = node as Record<string, unknown>;
  if (n['kind'] === 'rule') {
    return typeof n['field'] === 'string' && typeof n['operator'] === 'string';
  }
  if (n['kind'] === 'group') {
    return (
      (n['logic'] === 'and' || n['logic'] === 'or') &&
      Array.isArray(n['children']) &&
      (n['children'] as unknown[]).every((child) => isValidConditionNode(child))
    );
  }
  return false;
}

/** Keep only structurally valid SmartPrefilter entries from untrusted storage. */
export function sanitizePrefilters(raw: unknown): SmartPrefilter[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((entry): entry is SmartPrefilter => {
    if (!entry || typeof entry !== 'object') return false;
    const p = entry as Record<string, unknown>;
    return (
      typeof p['id'] === 'string' &&
      p['id'] !== '' &&
      typeof p['name'] === 'string' &&
      isValidConditionNode(p['root']) &&
      (p['root'] as unknown as Record<string, unknown>)['kind'] === 'group'
    );
  });
}