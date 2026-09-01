/**
 * The single seam between the engine and Tabulator.
 *
 * `tabulator-tables` is a peer dependency imported here (the Malkom client
 * bundles it); tests and exotic builds may inject their own constructor via
 * `config.advanced.tabulatorConstructor`.
 */

import { TabulatorFull } from 'tabulator-tables';
import type {
  MalkomColumn,
  MalkomFormatter,
  RowData,
  TabCellComponent,
  TabRowComponent,
  TabulatorConstructor
} from '../types.js';
import type { ResolvedConfig } from '../internal/config.js';
import { escapeHtml } from '../internal/dom.js';

export function defaultTabulatorConstructor(): TabulatorConstructor {
  return TabulatorFull as unknown as TabulatorConstructor;
}

// ---------------------------------------------------------------------------
// Sorters
// ---------------------------------------------------------------------------

function timeOf(value: unknown): number | null {
  if (value instanceof Date) {
    const t = value.getTime();
    return Number.isNaN(t) ? null : t;
  }
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const s = String(value ?? '').trim();
  if (s === '') return null;
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : t;
}

/** Date comparator that doesn't require Luxon (Tabulator's built-in does). */
export function dateSorter(a: unknown, b: unknown): number {
  const ta = timeOf(a);
  const tb = timeOf(b);
  if (ta === null && tb === null) return 0;
  if (ta === null) return -1;
  if (tb === null) return 1;
  return ta - tb;
}

// ---------------------------------------------------------------------------
// Column mapping
// ---------------------------------------------------------------------------

/** Column-definition fragment produced by the header-filter controller. */
export type HeaderFilterBinding = Record<string, unknown>;

export function buildColumnDefinitions<TRow extends RowData>(
  resolved: ResolvedConfig<TRow>,
  headerFilterFor: (column: MalkomColumn<TRow>) => HeaderFilterBinding | null
): Record<string, unknown>[] {
  const { config } = resolved;

  return config.columns.map((column) => {
    const def: Record<string, unknown> = {
      title: column.header,
      field: column.field,
      visible: column.visible !== false,
      headerSort: column.headerSort !== false,
      hozAlign: column.hozAlign ?? 'left',
      vertAlign: column.vertAlign ?? 'top'
    };
    if (column.width !== undefined) def['width'] = column.width;
    if (column.minWidth !== undefined) def['minWidth'] = column.minWidth;
    if (column.frozen !== undefined) def['frozen'] = column.frozen;
    if (column.cssClass !== undefined) def['cssClass'] = column.cssClass;

    // Sorter
    const sorter = column.sorter ?? 'string';
    if (typeof sorter === 'function') {
      def['sorter'] = (
        a: unknown,
        b: unknown,
        aRow: TabRowComponent,
        bRow: TabRowComponent
      ): number => sorter(a, b, aRow.getData() as TRow, bRow.getData() as TRow);
    } else if (sorter === 'date' || sorter === 'datetime') {
      def['sorter'] = (a: unknown, b: unknown): number => dateSorter(a, b);
    } else {
      def['sorter'] = sorter;
    }
    if (column.sorterParams !== undefined) def['sorterParams'] = column.sorterParams;

    // Formatter
    const formatter = resolveFormatter(resolved, column);
    if (formatter) {
      def['formatter'] = (
        cell: TabCellComponent,
        _params: unknown,
        onRendered: (cb: () => void) => void
      ): string | HTMLElement =>
        formatter({
          value: cell.getValue(),
          row: cell.getRow().getData() as TRow,
          field: column.field,
          onRendered,
          cell
        });
    }

    // Excel-style header filter
    const binding = column.headerFilter === false ? null : headerFilterFor(column);
    if (binding) {
      Object.assign(def, binding);
    }

    if (column.tabulatorOverrides) {
      Object.assign(def, column.tabulatorOverrides);
    }
    return def;
  });
}

function resolveFormatter<TRow extends RowData>(
  resolved: ResolvedConfig<TRow>,
  column: MalkomColumn<TRow>
): MalkomFormatter<TRow> | null {
  const formatter = column.formatter;
  if (!formatter) return null;
  if (typeof formatter === 'function') return formatter;
  const named = resolved.config.formatters?.[formatter];
  if (!named) {
    throw new Error(
      `Column "${column.field}" references unknown formatter "${formatter}"`
    );
  }
  return named;
}

// ---------------------------------------------------------------------------
// Options assembly
// ---------------------------------------------------------------------------

export function buildTabulatorOptions<TRow extends RowData>(
  resolved: ResolvedConfig<TRow>,
  columns: Record<string, unknown>[]
): Record<string, unknown> {
  const { config, features, labels, theme } = resolved;

  const options: Record<string, unknown> = {
    layout: features.layout,
    height: features.height,
    columns,
    movableColumns: features.movableColumns,
    index: config.index,
    placeholder: config.placeholder ?? labels.noRecords,
    // Tabulator's own minimum is 40px, which is what an auto-sized column
    // falls back to when it is measured before the grid has a width (a
    // hidden tab, a drawer, a pre-layout mount). The floor keeps that case
    // legible; `refitOnResize` then re-fits once the width is real.
    columnDefaults: { minWidth: features.columnMinWidth }
  };

  if (features.pagination) {
    options['pagination'] = true;
    options['paginationSize'] = features.paginationSize;
  }

  if (config.groupBy !== undefined) {
    options['groupBy'] = config.groupBy;
  }
  const groupHeader = config.groupHeader;
  options['groupHeader'] = (value: unknown, count: number): string => {
    if (groupHeader) return groupHeader(value, count);
    return (
      `<span class='${theme.groupHeader.value}'>${escapeHtml(value)}</span> ` +
      `<span class='${theme.groupHeader.count}'>(${count} items)</span>`
    );
  };

  const rowFormatter = config.rowFormatter;
  if (rowFormatter) {
    options['rowFormatter'] = (row: TabRowComponent): void =>
      rowFormatter(row.getElement(), row.getData() as TRow);
  }

  if (config.persistenceId) {
    // columns restricted to layout keys only: `columns: true` would persist
    // the FULL column definition and silently pin stale titles/aligns/sorters
    // over future config updates for returning users. Order still persists
    // via the stored array order; definitions stay config-driven.
    // Widths are opt-in: one measured while the grid was hidden would
    // otherwise be frozen across every future session. Order still persists
    // through the stored array order.
    options['persistence'] = {
      sort: true,
      columns: features.persistColumnWidths ? ['width', 'visible'] : ['visible']
    };
    options['persistenceID'] = config.persistenceId;

    // Route Tabulator's persistence through the engine's own StateStorage.
    // Its default writer calls `localStorage.setItem` on the bare global,
    // which THROWS where that global is unusable (jsdom on Node >= 25,
    // private mode) and ignores a host-supplied storage entirely. Sharing
    // one store keeps column layout, sort and engine state together.
    const store = resolved.store;
    if (store) {
      options['persistenceReaderFunc'] = (_id: string, type: string): unknown =>
        store.read<unknown>(`tabulator:${type}`, false);
      options['persistenceWriterFunc'] = (
        _id: string,
        type: string,
        data: unknown
      ): void => store.write(`tabulator:${type}`, data);
    }
  }

  if (config.tabulatorOptions) {
    Object.assign(options, config.tabulatorOptions);
  }
  return options;
}
