export { MalkomTable } from './MalkomTable.js';
export type { MalkomTableProps } from './MalkomTable.js';

// Re-export the core surface so React hosts can import from one place.
export { MalkomTableEngine } from '@malkom/table-core';
export type {
  MalkomTableConfig,
  MalkomTableFeatures,
  MalkomTableLabels,
  MalkomTableIcons,
  MalkomTableTheme,
  MalkomColumn,
  MalkomFormatter,
  CellRenderContext,
  RowData,
  RowUpdate,
  SmartPrefilter,
  TableExporter,
  ExportContext,
  StateStorage,
  NotifyFn
} from '@malkom/table-core';
