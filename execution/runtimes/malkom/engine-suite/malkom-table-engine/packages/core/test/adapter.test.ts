/**
 * Tests for the Tabulator adapter: column-definition mapping, options
 * assembly, and the Luxon-free date sorter.
 */

import { describe, expect, test, vi } from 'vitest';
import { dateSorter, DEFAULT_LABELS, DEFAULT_THEME } from '@malkom/table-core';
import type {
  MalkomColumn,
  MalkomTableConfig,
  RowData,
  TabCellComponent,
  TabRowComponent
} from '@malkom/table-core';
import {
  buildColumnDefinitions,
  buildTabulatorOptions
} from '../src/tabulator/adapter';
import { resolveConfig } from '../src/internal/config';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConfig(
  overrides: Partial<MalkomTableConfig> = {}
): MalkomTableConfig {
  return {
    title: 'Test Table',
    index: 'id',
    columns: [{ field: 'id', header: 'ID' }],
    ...overrides
  };
}

/** Build column definitions with no header filters bound. */
function defsFor(
  columns: MalkomColumn[],
  extra: Partial<MalkomTableConfig> = {}
): Record<string, unknown>[] {
  const resolved = resolveConfig(makeConfig({ columns, ...extra }));
  return buildColumnDefinitions(resolved, () => null);
}

function fakeRow(data: RowData): TabRowComponent {
  return {
    getData: () => data,
    getElement: () => document.createElement('div'),
    update: () => undefined
  };
}

function fakeCell(value: unknown, rowData: RowData): TabCellComponent {
  const row = fakeRow(rowData);
  return {
    getValue: () => value,
    getElement: () => document.createElement('div'),
    getRow: () => row,
    getColumn: () => {
      throw new Error('not used');
    },
    getTable: () => {
      throw new Error('not used');
    }
  };
}

// ---------------------------------------------------------------------------
// buildColumnDefinitions — basic fields and defaults
// ---------------------------------------------------------------------------

describe('buildColumnDefinitions basics', () => {
  test('maps header to title and field to field', () => {
    const [def] = defsFor([{ field: 'name', header: 'Full Name' }]);
    expect(def['title']).toBe('Full Name');
    expect(def['field']).toBe('name');
  });

  test('columns are visible and sortable by default', () => {
    const [def] = defsFor([{ field: 'name', header: 'Name' }]);
    expect(def['visible']).toBe(true);
    expect(def['headerSort']).toBe(true);
  });

  test('visible false and headerSort false are honoured', () => {
    const [def] = defsFor([
      { field: 'name', header: 'Name', visible: false, headerSort: false }
    ]);
    expect(def['visible']).toBe(false);
    expect(def['headerSort']).toBe(false);
  });

  test('alignment defaults to left and top', () => {
    const [def] = defsFor([{ field: 'name', header: 'Name' }]);
    expect(def['hozAlign']).toBe('left');
    expect(def['vertAlign']).toBe('top');
  });

  test('explicit alignment values pass through', () => {
    const [def] = defsFor([
      { field: 'amount', header: 'Amount', hozAlign: 'right', vertAlign: 'middle' }
    ]);
    expect(def['hozAlign']).toBe('right');
    expect(def['vertAlign']).toBe('middle');
  });

  test('width, minWidth, frozen and cssClass are omitted when not set', () => {
    const [def] = defsFor([{ field: 'name', header: 'Name' }]);
    expect(def).not.toHaveProperty('width');
    expect(def).not.toHaveProperty('minWidth');
    expect(def).not.toHaveProperty('frozen');
    expect(def).not.toHaveProperty('cssClass');
  });

  test('width, minWidth, frozen and cssClass appear when set', () => {
    const [def] = defsFor([
      {
        field: 'name',
        header: 'Name',
        width: 120,
        minWidth: 80,
        frozen: true,
        cssClass: 'sticky-col'
      }
    ]);
    expect(def['width']).toBe(120);
    expect(def['minWidth']).toBe(80);
    expect(def['frozen']).toBe(true);
    expect(def['cssClass']).toBe('sticky-col');
  });

  test('an explicit frozen false is still forwarded', () => {
    const [def] = defsFor([{ field: 'name', header: 'Name', frozen: false }]);
    expect(def['frozen']).toBe(false);
  });

  test('produces one definition per configured column in order', () => {
    const defs = defsFor([
      { field: 'a', header: 'A' },
      { field: 'b', header: 'B' },
      { field: 'c', header: 'C' }
    ]);
    expect(defs.map((d) => d['field'])).toEqual(['a', 'b', 'c']);
  });
});

// ---------------------------------------------------------------------------
// buildColumnDefinitions — sorters
// ---------------------------------------------------------------------------

describe('buildColumnDefinitions sorters', () => {
  test('sorter defaults to the string built-in', () => {
    const [def] = defsFor([{ field: 'name', header: 'Name' }]);
    expect(def['sorter']).toBe('string');
  });

  test('number sorter name passes through untouched', () => {
    const [def] = defsFor([{ field: 'n', header: 'N', sorter: 'number' }]);
    expect(def['sorter']).toBe('number');
  });

  test('date sorter becomes a function that orders ISO strings', () => {
    const [def] = defsFor([{ field: 'd', header: 'D', sorter: 'date' }]);
    const sorter = def['sorter'] as (a: unknown, b: unknown) => number;
    expect(typeof sorter).toBe('function');
    expect(sorter('2024-01-01', '2024-06-15')).toBeLessThan(0);
    expect(sorter('2024-06-15', '2024-01-01')).toBeGreaterThan(0);
    expect(sorter('2024-06-15', '2024-06-15')).toBe(0);
  });

  test('datetime sorter also becomes a function and orders timestamps', () => {
    const [def] = defsFor([{ field: 'd', header: 'D', sorter: 'datetime' }]);
    const sorter = def['sorter'] as (a: unknown, b: unknown) => number;
    expect(typeof sorter).toBe('function');
    expect(sorter('2024-01-01T08:00:00Z', '2024-01-01T09:30:00Z')).toBeLessThan(0);
  });

  test('date sorter puts null and empty values before valid dates', () => {
    const [def] = defsFor([{ field: 'd', header: 'D', sorter: 'date' }]);
    const sorter = def['sorter'] as (a: unknown, b: unknown) => number;
    expect(sorter(null, '2024-01-01')).toBe(-1);
    expect(sorter('2024-01-01', null)).toBe(1);
    expect(sorter('', '2024-01-01')).toBe(-1);
    expect(sorter(null, '')).toBe(0);
  });

  test('custom sorter receives raw values plus both row data objects', () => {
    const custom = vi.fn(
      (_a: unknown, _b: unknown, rowA: RowData, rowB: RowData) =>
        (rowA['rank'] as number) - (rowB['rank'] as number)
    );
    const [def] = defsFor([{ field: 'name', header: 'Name', sorter: custom }]);
    const wrapped = def['sorter'] as (
      a: unknown,
      b: unknown,
      aRow: TabRowComponent,
      bRow: TabRowComponent
    ) => number;
    expect(typeof wrapped).toBe('function');

    const dataA = { name: 'alpha', rank: 5 };
    const dataB = { name: 'beta', rank: 2 };
    const result = wrapped('alpha', 'beta', fakeRow(dataA), fakeRow(dataB));

    expect(custom).toHaveBeenCalledTimes(1);
    expect(custom).toHaveBeenCalledWith('alpha', 'beta', dataA, dataB);
    expect(result).toBe(3);
  });

  test('sorterParams are forwarded when provided and omitted otherwise', () => {
    const [plain] = defsFor([{ field: 'a', header: 'A' }]);
    expect(plain).not.toHaveProperty('sorterParams');

    const [withParams] = defsFor([
      { field: 'a', header: 'A', sorter: 'number', sorterParams: { thousandSeparator: ',' } }
    ]);
    expect(withParams['sorterParams']).toEqual({ thousandSeparator: ',' });
  });
});

// ---------------------------------------------------------------------------
// buildColumnDefinitions — formatters
// ---------------------------------------------------------------------------

describe('buildColumnDefinitions formatters', () => {
  test('no formatter key is emitted when the column has no formatter', () => {
    const [def] = defsFor([{ field: 'name', header: 'Name' }]);
    expect(def).not.toHaveProperty('formatter');
  });

  test('function formatter is wrapped and receives the full render context', () => {
    const formatter = vi.fn(() => 'RENDERED');
    const [def] = defsFor([{ field: 'status', header: 'Status', formatter }]);
    const wrapped = def['formatter'] as (
      cell: TabCellComponent,
      params: unknown,
      onRendered: (cb: () => void) => void
    ) => string | HTMLElement;
    expect(typeof wrapped).toBe('function');

    const rowData = { id: 1, status: 'open' };
    const cell = fakeCell('open', rowData);
    const onRendered = vi.fn();
    const result = wrapped(cell, {}, onRendered);

    expect(result).toBe('RENDERED');
    expect(formatter).toHaveBeenCalledTimes(1);
    const ctx = formatter.mock.calls[0]![0] as Record<string, unknown>;
    expect(ctx['value']).toBe('open');
    expect(ctx['row']).toBe(rowData);
    expect(ctx['field']).toBe('status');
    expect(ctx['onRendered']).toBe(onRendered);
    expect(ctx['cell']).toBe(cell);
  });

  test('string formatter name resolves from the registered formatters', () => {
    const badge = vi.fn(() => 'BADGE!');
    const [def] = defsFor(
      [{ field: 'status', header: 'Status', formatter: 'badge' }],
      { formatters: { badge } }
    );
    const wrapped = def['formatter'] as (
      cell: TabCellComponent,
      params: unknown,
      onRendered: (cb: () => void) => void
    ) => string | HTMLElement;

    const result = wrapped(fakeCell('closed', { status: 'closed' }), {}, vi.fn());
    expect(result).toBe('BADGE!');
    expect(badge).toHaveBeenCalledTimes(1);
    expect(badge.mock.calls[0]![0]).toMatchObject({
      value: 'closed',
      field: 'status'
    });
  });

  test('unknown formatter name throws at build time with a helpful message', () => {
    expect(() =>
      defsFor([{ field: 'status', header: 'Status', formatter: 'missing' }])
    ).toThrow('Column "status" references unknown formatter "missing"');
  });
});

// ---------------------------------------------------------------------------
// buildColumnDefinitions — header filters and overrides
// ---------------------------------------------------------------------------

describe('buildColumnDefinitions header filters and overrides', () => {
  test('header-filter binding from the callback is merged into the definition', () => {
    const resolved = resolveConfig(
      makeConfig({ columns: [{ field: 'name', header: 'Name' }] })
    );
    const headerFilterFor = vi.fn(() => ({
      headerFilter: 'custom',
      headerFilterLiveFilter: false
    }));
    const [def] = buildColumnDefinitions(resolved, headerFilterFor);

    expect(headerFilterFor).toHaveBeenCalledTimes(1);
    expect(headerFilterFor).toHaveBeenCalledWith(resolved.config.columns[0]);
    expect(def['headerFilter']).toBe('custom');
    expect(def['headerFilterLiveFilter']).toBe(false);
  });

  test('headerFilter false skips the binding callback entirely', () => {
    const resolved = resolveConfig(
      makeConfig({
        columns: [
          { field: 'a', header: 'A', headerFilter: false },
          { field: 'b', header: 'B' }
        ]
      })
    );
    const headerFilterFor = vi.fn(() => ({ headerFilter: 'bound' }));
    const [defA, defB] = buildColumnDefinitions(resolved, headerFilterFor);

    expect(headerFilterFor).toHaveBeenCalledTimes(1);
    expect(headerFilterFor).toHaveBeenCalledWith(resolved.config.columns[1]);
    expect(defA).not.toHaveProperty('headerFilter');
    expect(defB!['headerFilter']).toBe('bound');
  });

  test('a null binding leaves the definition untouched', () => {
    const [def] = defsFor([{ field: 'name', header: 'Name' }]);
    expect(def).not.toHaveProperty('headerFilter');
  });

  test('tabulatorOverrides merge last and can override the generated title', () => {
    const [def] = defsFor([
      {
        field: 'name',
        header: 'Name',
        tabulatorOverrides: { title: 'Overridden', editor: 'input' }
      }
    ]);
    expect(def['title']).toBe('Overridden');
    expect(def['editor']).toBe('input');
  });
});

// ---------------------------------------------------------------------------
// buildTabulatorOptions
// ---------------------------------------------------------------------------

describe('buildTabulatorOptions', () => {
  function optionsFor(
    overrides: Partial<MalkomTableConfig> = {},
    columns: Record<string, unknown>[] = []
  ): Record<string, unknown> {
    return buildTabulatorOptions(resolveConfig(makeConfig(overrides)), columns);
  }

  test('applies documented defaults for layout, height, movableColumns, index and placeholder', () => {
    const options = optionsFor();
    expect(options['layout']).toBe('fitDataFill');
    expect(options['height']).toBe('100%');
    expect(options['movableColumns']).toBe(true);
    expect(options['index']).toBe('id');
    expect(options['placeholder']).toBe(DEFAULT_LABELS.noRecords);
  });

  test('passes the prebuilt columns array straight through', () => {
    const columns = [{ field: 'x' }];
    const options = optionsFor({}, columns);
    expect(options['columns']).toBe(columns);
  });

  test('explicit feature values override the defaults', () => {
    const options = optionsFor({
      features: { layout: 'fitColumns', height: 420, movableColumns: false }
    });
    expect(options['layout']).toBe('fitColumns');
    expect(options['height']).toBe(420);
    expect(options['movableColumns']).toBe(false);
  });

  test('custom placeholder text wins over the default label', () => {
    const options = optionsFor({ placeholder: 'Nothing here' });
    expect(options['placeholder']).toBe('Nothing here');
  });

  test('pagination is on by default with the default page size', () => {
    const options = optionsFor();
    expect(options['pagination']).toBe(true);
    expect(options['paginationSize']).toBe(15);
  });

  test('pagination options are absent when the feature is off', () => {
    const options = optionsFor({ features: { pagination: false } });
    expect(options).not.toHaveProperty('pagination');
    expect(options).not.toHaveProperty('paginationSize');
  });

  test('a custom pagination size is forwarded', () => {
    const options = optionsFor({ features: { paginationSize: 50 } });
    expect(options['paginationSize']).toBe(50);
  });

  test('groupBy passes through when set and is absent otherwise', () => {
    expect(optionsFor()).not.toHaveProperty('groupBy');
    expect(optionsFor({ groupBy: 'dept' })['groupBy']).toBe('dept');
    expect(optionsFor({ groupBy: ['dept', 'team'] })['groupBy']).toEqual([
      'dept',
      'team'
    ]);
  });

  test('default group header escapes HTML in the value and shows the count', () => {
    const options = optionsFor();
    const groupHeader = options['groupHeader'] as (
      value: unknown,
      count: number
    ) => string;
    const html = groupHeader('<b>Ops & "QA"</b>', 3);
    expect(html).toContain('&lt;b&gt;Ops &amp; &quot;QA&quot;&lt;/b&gt;');
    expect(html).not.toContain('<b>');
    expect(html).toContain('(3 items)');
    expect(html).toContain(DEFAULT_THEME.groupHeader.value);
    expect(html).toContain(DEFAULT_THEME.groupHeader.count);
  });

  test('custom groupHeader is used verbatim instead of the default', () => {
    const custom = vi.fn((value: unknown, count: number) => `CUSTOM ${value}/${count}`);
    const options = optionsFor({ groupHeader: custom });
    const groupHeader = options['groupHeader'] as (
      value: unknown,
      count: number
    ) => string;
    expect(groupHeader('Ops', 7)).toBe('CUSTOM Ops/7');
    expect(custom).toHaveBeenCalledWith('Ops', 7);
  });

  test('rowFormatter wrapper calls the config hook with element and row data', () => {
    const hook = vi.fn();
    const options = optionsFor({ rowFormatter: hook });
    const wrapped = options['rowFormatter'] as (row: TabRowComponent) => void;
    expect(typeof wrapped).toBe('function');

    const element = document.createElement('div');
    const data = { id: 9, name: 'zed' };
    wrapped({ getData: () => data, getElement: () => element, update: () => undefined });

    expect(hook).toHaveBeenCalledTimes(1);
    expect(hook).toHaveBeenCalledWith(element, data);
  });

  test('no rowFormatter option is emitted without a config hook', () => {
    expect(optionsFor()).not.toHaveProperty('rowFormatter');
  });

  test('persistence keys appear only when a persistenceId is configured', () => {
    const without = optionsFor();
    expect(without).not.toHaveProperty('persistence');
    expect(without).not.toHaveProperty('persistenceID');

    const withId = optionsFor({ persistenceId: 'my-table' });
    // columns is restricted to layout keys: `columns: true` would persist the
    // full column definition and pin stale titles/sorters over config updates.
    // Widths are excluded unless asked for, so a width measured while the grid
    // was hidden cannot be frozen across sessions.
    expect(withId['persistence']).toEqual({ sort: true, columns: ['visible'] });
    expect(withId['persistenceID']).toBe('my-table');

    const withWidths = optionsFor({
      persistenceId: 'my-table',
      features: { persistColumnWidths: true }
    });
    expect(withWidths['persistence']).toEqual({
      sort: true,
      columns: ['width', 'visible']
    });
  });

  test('tabulatorOptions escape hatch merges last and overrides assembled values', () => {
    const options = optionsFor({
      features: { layout: 'fitColumns' },
      tabulatorOptions: { layout: 'fitData', selectable: 1 }
    });
    expect(options['layout']).toBe('fitData');
    expect(options['selectable']).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// dateSorter
// ---------------------------------------------------------------------------

describe('dateSorter', () => {
  test('orders two valid ISO dates chronologically', () => {
    expect(dateSorter('2023-03-01', '2024-03-01')).toBeLessThan(0);
    expect(dateSorter('2024-03-01', '2023-03-01')).toBeGreaterThan(0);
    expect(dateSorter('2024-03-01', '2024-03-01')).toBe(0);
  });

  test('accepts Date objects and numeric timestamps', () => {
    const early = new Date('2024-01-01T00:00:00Z');
    const late = new Date('2024-12-31T00:00:00Z');
    expect(dateSorter(early, late)).toBeLessThan(0);
    expect(dateSorter(late.getTime(), early.getTime())).toBeGreaterThan(0);
    expect(dateSorter(early, early.getTime())).toBe(0);
  });

  test('treats unparseable strings as missing and sorts them first', () => {
    expect(dateSorter('not a date', '2024-01-01')).toBe(-1);
    expect(dateSorter('2024-01-01', 'not a date')).toBe(1);
  });

  test('returns 0 when both values are null or empty', () => {
    expect(dateSorter(null, null)).toBe(0);
    expect(dateSorter(undefined, '')).toBe(0);
    expect(dateSorter('  ', null)).toBe(0);
  });

  test('sorts a single null before any valid date', () => {
    expect(dateSorter(null, '2024-01-01')).toBe(-1);
    expect(dateSorter('2024-01-01', undefined)).toBe(1);
  });

  test('an invalid Date object counts as missing', () => {
    expect(dateSorter(new Date('garbage'), '2024-01-01')).toBe(-1);
  });
});
