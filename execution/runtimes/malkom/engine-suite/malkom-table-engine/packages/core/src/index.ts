/**
 * @malkom/table-core — Malkom Table Engine.
 *
 * Config-driven grids for the Malkom stack: supply column metadata, a data
 * source and optional custom logic; get the full grid experience.
 */

export { MalkomTableEngine } from './engine.js';

// Types
export type {
  RowData,
  DeepPartial,
  MalkomTableConfig,
  MalkomTableFeatures,
  MalkomTableLabels,
  MalkomTableIcons,
  MalkomTableTheme,
  MalkomTableEventMap,
  MalkomTableEventName,
  MalkomColumn,
  MalkomFormatter,
  CellRenderContext,
  ColumnSorter,
  ColumnValueType,
  BuiltInSorter,
  RowUpdate,
  StateStorage,
  NotifyFn,
  NotifyKind,
  TableExporter,
  ExportContext,
  ExportColumn,
  TabulatorGrid,
  TabulatorConstructor,
  TabCellComponent,
  TabColumnComponent,
  TabRowComponent
} from './types.js';

// Conditions (smart prefilters)
export {
  compileCondition,
  validateCondition,
  describeCondition,
  operatorsForType,
  emptyGroup,
  emptyRule,
  cloneCondition,
  VALUELESS_OPERATORS,
  DEFAULT_OPERATOR_LABELS
} from './conditions.js';
export type {
  ConditionOperator,
  ConditionRule,
  ConditionGroup,
  ConditionNode,
  ConditionFieldInfo,
  ConditionValidationResult,
  SmartPrefilter,
  DescriptionNode,
  RuleDescription,
  GroupDescription
} from './conditions.js';

// Search
export { buildSearchPredicate, searchTargetsOf } from './search.js';
export type { SearchTarget } from './search.js';

// Storage
export {
  LocalStorageStateStorage,
  MemoryStateStorage,
  JsonStore,
  resolveWebStorage
} from './storage.js';

// Exporters
export {
  ExporterRegistry,
  createCsvExporter,
  serializeCsv,
  downloadTextFile
} from './exporters.js';
export type { CsvExporterOptions } from './exporters.js';

// Defaults (useful for host-side extension/theming)
export { DEFAULT_LABELS, formatLabel } from './defaults/labels.js';
export { DEFAULT_ICONS } from './defaults/icons.js';
export { DEFAULT_THEME, mergeTheme } from './defaults/theme.js';
export { presets, unstyledTheme, stripVisualClasses } from './defaults/presets.js';
export {
  CSS_VARIABLES,
  STRUCTURAL_CSS,
  SKIN_CSS,
  ENGINE_CSS,
  ensureEngineStyles
} from './internal/styles.js';

// Tabulator adapter helpers
export { dateSorter, defaultTabulatorConstructor } from './tabulator/adapter.js';
