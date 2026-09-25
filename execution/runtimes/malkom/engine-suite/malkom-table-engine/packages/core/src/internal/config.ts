/** Config resolution: apply defaults once, up front, in one place. */

import type {
  MalkomColumn,
  MalkomTableConfig,
  MalkomTableIcons,
  MalkomTableLabels,
  MalkomTableTheme,
  NotifyFn,
  RowData,
  StateStorage
} from '../types.js';
import type { ConditionFieldInfo } from '../conditions.js';
import { DEFAULT_LABELS } from '../defaults/labels.js';
import { DEFAULT_ICONS } from '../defaults/icons.js';
import { DEFAULT_THEME, mergeTheme } from '../defaults/theme.js';
import { JsonStore, LocalStorageStateStorage } from '../storage.js';
import { searchTargetsOf, type SearchTarget } from '../search.js';

export interface ResolvedFeatures {
  globalSearch: boolean;
  searchDebounceMs: number;
  refresh: boolean;
  export: boolean;
  settings: boolean;
  density: boolean;
  grouping: boolean;
  prefilters: boolean;
  columnToggles: boolean;
  skeleton: boolean;
  skeletonRows: number;
  liveBadge: boolean;
  syncMeta: boolean;
  pagination: boolean;
  paginationSize: number;
  paginationSizes: number[];
  autoRefreshMs: number;
  autoRefreshVisibilityMs: number;
  movableColumns: boolean;
  layout: string;
  columnMinWidth: number;
  refitOnResize: boolean;
  persistColumnWidths: boolean;
  injectSkin: boolean;
  height: string | number;
}

export interface ResolvedConfig<TRow extends RowData = RowData> {
  config: MalkomTableConfig<TRow>;
  features: ResolvedFeatures;
  labels: MalkomTableLabels;
  icons: MalkomTableIcons;
  theme: MalkomTableTheme;
  notify: NotifyFn;
  confirmAction: (message: string) => Promise<boolean>;
  doc: Document;
  storage: StateStorage;
  /** Null when persistence is disabled (no persistenceId). */
  store: JsonStore | null;
  conditionFields: ConditionFieldInfo[];
  searchTargets: SearchTarget<TRow>[];
  exportFileName: () => string;
}

function sanitizeFileName(name: string): string {
  const cleaned = name.replace(/[\\/:*?"<>|]+/g, '_').trim();
  return cleaned === '' ? 'malkom-export' : cleaned;
}

export function resolveConfig<TRow extends RowData>(
  config: MalkomTableConfig<TRow>
): ResolvedConfig<TRow> {
  if (!config.title) throw new Error('MalkomTableConfig.title is required');
  if (!config.index) throw new Error('MalkomTableConfig.index is required');
  if (config.index.includes('.')) {
    // Tabulator resolves the index with flat property access only; a nested
    // path half-works (render/filter fine, row updates corrupt) — fail loud.
    throw new Error(
      'MalkomTableConfig.index must be a top-level row field (Tabulator uses flat index access)'
    );
  }
  if (!Array.isArray(config.columns) || config.columns.length === 0) {
    throw new Error('MalkomTableConfig.columns must be a non-empty array');
  }
  const seenFields = new Set<string>();
  for (const column of config.columns) {
    if (!column.field) throw new Error('Every column requires a field');
    if (!column.header) {
      throw new Error(`Column "${column.field}" requires a header`);
    }
    if (seenFields.has(column.field)) {
      throw new Error(`Duplicate column field "${column.field}"`);
    }
    seenFields.add(column.field);
  }

  const doc = config.advanced?.documentRef ?? globalThis.document;
  if (!doc) {
    throw new Error('MalkomTableEngine requires a DOM document');
  }

  const f = config.features ?? {};
  const hasLoadData = typeof config.loadData === 'function';
  const features: ResolvedFeatures = {
    globalSearch: f.globalSearch ?? true,
    searchDebounceMs: f.searchDebounceMs ?? 250,
    refresh: f.refresh ?? hasLoadData,
    export: f.export ?? true,
    settings: f.settings ?? true,
    density: f.density ?? true,
    grouping: f.grouping ?? true,
    prefilters: f.prefilters ?? true,
    columnToggles: f.columnToggles ?? true,
    skeleton: f.skeleton ?? true,
    skeletonRows: f.skeletonRows ?? 12,
    liveBadge: f.liveBadge ?? hasLoadData,
    syncMeta: f.syncMeta ?? true,
    pagination: f.pagination ?? true,
    paginationSize: f.paginationSize ?? 15,
    paginationSizes: f.paginationSizes ?? [15, 50, 100],
    autoRefreshMs: f.autoRefreshMs ?? 0,
    autoRefreshVisibilityMs: f.autoRefreshVisibilityMs ?? 20 * 60 * 1000,
    movableColumns: f.movableColumns ?? true,
    layout: f.layout ?? 'fitDataFill',
    columnMinWidth: f.columnMinWidth ?? 90,
    refitOnResize: f.refitOnResize ?? true,
    persistColumnWidths: f.persistColumnWidths ?? false,
    injectSkin: f.injectSkin ?? true,
    height: f.height ?? '100%'
  };

  const labels: MalkomTableLabels = {
    ...DEFAULT_LABELS,
    ...config.labels,
    operatorLabels: {
      ...DEFAULT_LABELS.operatorLabels,
      ...config.labels?.operatorLabels
    }
  };
  const icons: MalkomTableIcons = { ...DEFAULT_ICONS, ...config.icons };
  const theme = mergeTheme(DEFAULT_THEME, config.theme);

  const notify: NotifyFn = config.notify ?? (() => undefined);
  const confirmAction = async (message: string): Promise<boolean> => {
    if (config.confirmAction) return config.confirmAction(message);
    // Resolve against the engine's own window so a second document
    // (iframe/popout via advanced.documentRef) prompts in the right place.
    const win = (doc.defaultView ?? globalThis) as {
      confirm?: (m: string) => unknown;
    };
    if (typeof win.confirm !== 'function') return true;
    try {
      const result = win.confirm(message);
      // jsdom's confirm is a function that logs "Not implemented" and returns
      // undefined. Treat any non-boolean answer as "no usable prompt" and
      // proceed, matching the behaviour when confirm is absent entirely —
      // otherwise the more degraded environment silently cancels the action.
      return typeof result === 'boolean' ? result : true;
    } catch {
      return true;
    }
  };

  const storage = config.storage ?? new LocalStorageStateStorage();
  const store = config.persistenceId
    ? new JsonStore(storage, `mte:${config.persistenceId}`)
    : null;

  const conditionFields: ConditionFieldInfo[] = config.columns
    .filter((c) => c.filterable !== false)
    .map((c) => ({ field: c.field, label: c.header, type: c.type ?? 'string' }));

  const exportFileName = (): string => {
    if (typeof config.exportFileName === 'function') {
      return sanitizeFileName(config.exportFileName());
    }
    if (typeof config.exportFileName === 'string') {
      return sanitizeFileName(config.exportFileName);
    }
    const date = new Date().toISOString().slice(0, 10);
    return sanitizeFileName(`${config.title.replace(/\s+/g, '_')}_${date}`);
  };

  return {
    config,
    features,
    labels,
    icons,
    theme,
    notify,
    confirmAction,
    doc,
    storage,
    store,
    conditionFields,
    searchTargets: searchTargetsOf(config.columns),
    exportFileName
  };
}

/** Columns eligible for the Group-By select. */
export function groupableColumns<TRow extends RowData>(
  columns: MalkomColumn<TRow>[]
): MalkomColumn<TRow>[] {
  return columns.filter((c) => c.groupable !== false);
}
