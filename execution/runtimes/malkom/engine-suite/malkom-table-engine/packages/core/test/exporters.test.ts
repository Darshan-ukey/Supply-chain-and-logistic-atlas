/**
 * Tests for the export pipeline: serializeCsv, createCsvExporter and
 * ExporterRegistry from packages/core/src/exporters.ts.
 */

import { describe, expect, test, vi } from 'vitest';
import {
  ExporterRegistry,
  createCsvExporter,
  serializeCsv
} from '@malkom/table-core';
import type {
  ExportColumn,
  ExportContext,
  RowData,
  TableExporter
} from '@malkom/table-core';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>;

/** Minimal serialization context: rows + columns + a direct field lookup. */
function ctxOf(rows: Row[], columns: ExportColumn[]) {
  return {
    rows,
    columns,
    valueOf: (row: Row, field: string) => row[field]
  };
}

/** Single-column context whose lone cell holds `value`. */
function singleCell(value: unknown) {
  return ctxOf([{ v: value }], [{ field: 'v', header: 'V' }]);
}

/** Serialize one value and return the single data cell (second line). */
function cell(value: unknown, options?: Parameters<typeof serializeCsv>[1]): string {
  const csv = serializeCsv(singleCell(value), options);
  return csv.split('\r\n')[1];
}

/** Full ExportContext for driving TableExporter.run. */
function fullCtx(
  rows: Row[],
  columns: ExportColumn[],
  fileName = 'report'
): ExportContext<Row> {
  return {
    rows,
    columns,
    valueOf: (row, field) => row[field],
    fileName,
    meta: {
      title: 'Report',
      exportedAt: new Date('2026-08-13T00:00:00.000Z'),
      totalRows: rows.length,
      filteredRows: rows.length
    },
    notify: () => {}
  };
}

function makeExporter(id: string, label = id.toUpperCase()): TableExporter<RowData> {
  return { id, label, run: () => {} };
}

// ---------------------------------------------------------------------------
// serializeCsv
// ---------------------------------------------------------------------------

describe('serializeCsv', () => {
  test('emits a header row from column headers followed by one line per row', () => {
    const csv = serializeCsv(
      ctxOf(
        [
          { name: 'Alice', age: 30 },
          { name: 'Bob', age: 25 }
        ],
        [
          { field: 'name', header: 'Name' },
          { field: 'age', header: 'Age' }
        ]
      )
    );
    expect(csv).toBe('Name,Age\r\nAlice,30\r\nBob,25');
  });

  test('produces only the header line when there are no rows', () => {
    const csv = serializeCsv(
      ctxOf([], [
        { field: 'a', header: 'A' },
        { field: 'b', header: 'B' }
      ])
    );
    expect(csv).toBe('A,B');
  });

  test('quotes cells containing double quotes and doubles the inner quotes', () => {
    expect(cell('say "hi"')).toBe('"say ""hi"""');
  });

  test('quotes cells containing the delimiter', () => {
    expect(cell('a,b')).toBe('"a,b"');
  });

  test('quotes cells containing a newline', () => {
    expect(cell('line1\nline2')).toBe('"line1\nline2"');
  });

  test('quotes cells containing an embedded carriage return', () => {
    // Split on the default CRLF line ending will not work here because the
    // cell itself holds a bare CR, so assert on the whole document.
    const csv = serializeCsv(singleCell('a\rb'));
    expect(csv).toBe('V\r\n"a\rb"');
  });

  test('honours a custom delimiter and quotes against it instead of the comma', () => {
    const csv = serializeCsv(
      ctxOf([{ a: 'x;y', b: 'p,q' }], [
        { field: 'a', header: 'A' },
        { field: 'b', header: 'B' }
      ]),
      { delimiter: ';' }
    );
    // 'x;y' contains the active delimiter -> quoted; 'p,q' no longer does.
    expect(csv).toBe('A;B\r\n"x;y";p,q');
  });

  test('honours a custom line ending', () => {
    const csv = serializeCsv(
      ctxOf([{ a: 1 }, { a: 2 }], [{ field: 'a', header: 'A' }]),
      { lineEnding: '\n' }
    );
    expect(csv).toBe('A\n1\n2');
  });

  test('serializes finite numbers as plain unquoted text', () => {
    expect(cell(42)).toBe('42');
    expect(cell(3.14)).toBe('3.14');
    expect(cell(0)).toBe('0');
  });

  test('does not formula-guard negative numbers', () => {
    expect(cell(-42)).toBe('-42');
    expect(cell(-0.5)).toBe('-0.5');
  });

  test('serializes NaN and Infinity as empty cells', () => {
    expect(cell(Number.NaN)).toBe('');
    expect(cell(Number.POSITIVE_INFINITY)).toBe('');
    expect(cell(Number.NEGATIVE_INFINITY)).toBe('');
  });

  test('serializes booleans as true and false', () => {
    expect(cell(true)).toBe('true');
    expect(cell(false)).toBe('false');
  });

  test('serializes Date objects as ISO 8601 strings', () => {
    expect(cell(new Date('2026-01-15T10:30:00.000Z'))).toBe(
      '2026-01-15T10:30:00.000Z'
    );
  });

  test('serializes invalid Dates as empty cells', () => {
    expect(cell(new Date('not a date'))).toBe('');
  });

  test('serializes plain objects as JSON with RFC 4180 quoting', () => {
    // JSON output contains double quotes, so the cell is wrapped and the
    // inner quotes doubled.
    expect(cell({ a: 1 })).toBe('"{""a"":1}"');
  });

  test('serializes arrays as JSON', () => {
    // '[1,2]' contains the default delimiter, so it is quoted.
    expect(cell([1, 2])).toBe('"[1,2]"');
  });

  test('falls back to String() for objects JSON.stringify cannot handle', () => {
    const circular: Row = {};
    circular.self = circular;
    expect(cell(circular)).toBe('[object Object]');
  });

  test('serializes null and undefined as empty cells', () => {
    expect(cell(null)).toBe('');
    expect(cell(undefined)).toBe('');
  });

  test('guards strings starting with = + - or @ against formula injection', () => {
    expect(cell('=SUM(A1:A2)')).toBe("'=SUM(A1:A2)");
    expect(cell('+1234')).toBe("'+1234");
    expect(cell('-danger')).toBe("'-danger");
    expect(cell('@cmd')).toBe("'@cmd");
  });

  test('guards strings starting with a tab or carriage return', () => {
    expect(cell('\tx')).toBe("'\tx");
    // After guarding, the cell still contains a CR so it also gets quoted.
    const csv = serializeCsv(singleCell('\rx'));
    expect(csv).toBe("V\r\n\"'\rx\"");
  });

  test('guards header cells too', () => {
    const csv = serializeCsv(ctxOf([], [{ field: 'a', header: '=Evil' }]));
    expect(csv).toBe("'=Evil");
  });

  test('leaves ordinary strings untouched by the guard', () => {
    expect(cell('hello')).toBe('hello');
    expect(cell('a=b')).toBe('a=b');
  });

  test('disables the formula guard when guardFormulas is false', () => {
    expect(cell('=SUM(A1)', { guardFormulas: false })).toBe('=SUM(A1)');
    expect(cell('@cmd', { guardFormulas: false })).toBe('@cmd');
  });
});

// ---------------------------------------------------------------------------
// createCsvExporter
// ---------------------------------------------------------------------------

describe('createCsvExporter', () => {
  test('exposes the csv id, CSV label and csv icon', () => {
    const exporter = createCsvExporter();
    expect(exporter.id).toBe('csv');
    expect(exporter.label).toBe('CSV');
    expect(exporter.icon).toBe('csv');
  });

  test('prepends a UTF-8 BOM by default and hands the csv to the injected download', () => {
    const download = vi.fn();
    const exporter = createCsvExporter<Row>({ download });
    exporter.run(fullCtx([{ a: 1 }], [{ field: 'a', header: 'A' }]));

    expect(download).toHaveBeenCalledTimes(1);
    const [csv] = download.mock.calls[0];
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toBe('﻿A\r\n1');
  });

  test('omits the BOM when bom is false', () => {
    const download = vi.fn();
    const exporter = createCsvExporter<Row>({ bom: false, download });
    exporter.run(fullCtx([{ a: 1 }], [{ field: 'a', header: 'A' }]));

    const [csv] = download.mock.calls[0];
    expect(csv.charCodeAt(0)).not.toBe(0xfeff);
    expect(csv).toBe('A\r\n1');
  });

  test('appends a .csv suffix to the context file name', () => {
    const download = vi.fn();
    const exporter = createCsvExporter<Row>({ download });
    exporter.run(
      fullCtx([{ a: 1 }], [{ field: 'a', header: 'A' }], 'quarterly report')
    );

    const [, fileName] = download.mock.calls[0];
    expect(fileName).toBe('quarterly report.csv');
  });

  test('passes serialization options through to serializeCsv', () => {
    const download = vi.fn();
    const exporter = createCsvExporter<Row>({
      delimiter: ';',
      lineEnding: '\n',
      bom: false,
      download
    });
    exporter.run(
      fullCtx([{ a: 'x', b: 'y' }], [
        { field: 'a', header: 'A' },
        { field: 'b', header: 'B' }
      ])
    );

    const [csv] = download.mock.calls[0];
    expect(csv).toBe('A;B\nx;y');
  });
});

// ---------------------------------------------------------------------------
// ExporterRegistry
// ---------------------------------------------------------------------------

describe('ExporterRegistry', () => {
  test('register then get returns the same exporter instance', () => {
    const registry = new ExporterRegistry();
    const csv = makeExporter('csv');
    registry.register(csv);
    expect(registry.get('csv')).toBe(csv);
  });

  test('registering an exporter without an id throws', () => {
    const registry = new ExporterRegistry();
    expect(() => registry.register(makeExporter(''))).toThrow(
      'Exporter must have an id'
    );
  });

  test('registering a duplicate id throws', () => {
    const registry = new ExporterRegistry();
    registry.register(makeExporter('csv'));
    expect(() => registry.register(makeExporter('csv'))).toThrow(
      'Exporter "csv" is already registered'
    );
  });

  test('replace:true overrides the existing exporter', () => {
    const registry = new ExporterRegistry();
    registry.register(makeExporter('csv', 'Old'));
    const replacement = makeExporter('csv', 'New');
    registry.register(replacement, { replace: true });
    expect(registry.get('csv')).toBe(replacement);
    expect(registry.list()).toHaveLength(1);
  });

  test('list returns exporters in registration order', () => {
    const registry = new ExporterRegistry();
    const a = makeExporter('a');
    const b = makeExporter('b');
    const c = makeExporter('c');
    registry.register(a);
    registry.register(b);
    registry.register(c);
    expect(registry.list()).toEqual([a, b, c]);
  });

  test('replacing an exporter keeps its original position in the list', () => {
    const registry = new ExporterRegistry();
    registry.register(makeExporter('a', 'A1'));
    registry.register(makeExporter('b'));
    const a2 = makeExporter('a', 'A2');
    registry.register(a2, { replace: true });
    expect(registry.list().map((e) => e.id)).toEqual(['a', 'b']);
    expect(registry.list()[0]).toBe(a2);
  });

  test('get returns undefined for an unknown id', () => {
    const registry = new ExporterRegistry();
    expect(registry.get('nope')).toBeUndefined();
  });
});
