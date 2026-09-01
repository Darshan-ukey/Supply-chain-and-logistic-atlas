/**
 * Export pipeline: an exporter registry with a built-in CSV exporter.
 * Future integrations (Google Sheets, Excel Online, ...) implement
 * `TableExporter` and are passed via `config.exporters`.
 */

import type {
  ExportContext,
  RowData,
  TableExporter
} from './types.js';

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export class ExporterRegistry<TRow extends RowData = RowData> {
  private readonly exporters = new Map<string, TableExporter<TRow>>();

  register(exporter: TableExporter<TRow>, opts: { replace?: boolean } = {}): void {
    if (!exporter.id) throw new Error('Exporter must have an id');
    if (this.exporters.has(exporter.id) && !opts.replace) {
      throw new Error(`Exporter "${exporter.id}" is already registered`);
    }
    this.exporters.set(exporter.id, exporter);
  }

  get(id: string): TableExporter<TRow> | undefined {
    return this.exporters.get(id);
  }

  list(): TableExporter<TRow>[] {
    return Array.from(this.exporters.values());
  }
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

export interface CsvExporterOptions {
  /** Field delimiter. Default ','. */
  delimiter?: string;
  /** Prepend a UTF-8 BOM so Excel opens the file correctly. Default true. */
  bom?: boolean;
  /** Line ending. Default '\r\n' (RFC 4180). */
  lineEnding?: string;
  /**
   * Guard against spreadsheet formula injection by prefixing dangerous
   * leading characters (= + - @ tab CR) in string cells with a quote.
   * Default true.
   */
  guardFormulas?: boolean;
  /** Override the browser download step (tests / custom delivery). */
  download?: (csv: string, fileName: string) => void;
}

function csvCell(value: unknown, delimiter: string, guardFormulas: boolean): string {
  if (value === null || value === undefined) return '';
  let text: string;
  if (typeof value === 'number') {
    text = Number.isFinite(value) ? String(value) : '';
  } else if (typeof value === 'boolean') {
    text = value ? 'true' : 'false';
  } else if (value instanceof Date) {
    text = Number.isNaN(value.getTime()) ? '' : value.toISOString();
  } else if (typeof value === 'object') {
    try {
      text = JSON.stringify(value);
    } catch {
      text = String(value);
    }
  } else {
    text = String(value);
  }

  if (guardFormulas && typeof value !== 'number' && /^[=+\-@\t\r]/.test(text)) {
    text = `'${text}`;
  }

  const mustQuote =
    text.includes('"') ||
    text.includes(delimiter) ||
    text.includes('\n') ||
    text.includes('\r');
  if (mustQuote) {
    text = `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

/** Pure CSV serialization (exported for tests and custom exporters). */
export function serializeCsv<TRow extends RowData>(
  ctx: Pick<ExportContext<TRow>, 'rows' | 'columns' | 'valueOf'>,
  options: CsvExporterOptions = {}
): string {
  const delimiter = options.delimiter ?? ',';
  const lineEnding = options.lineEnding ?? '\r\n';
  const guardFormulas = options.guardFormulas !== false;

  const header = ctx.columns
    .map((c) => csvCell(c.header, delimiter, guardFormulas))
    .join(delimiter);
  const lines = ctx.rows.map((row) =>
    ctx.columns
      .map((c) => csvCell(ctx.valueOf(row, c.field), delimiter, guardFormulas))
      .join(delimiter)
  );
  return [header, ...lines].join(lineEnding);
}

/**
 * Trigger a browser download of a text file.
 *
 * Uses an object URL where available and falls back to a `data:` URL
 * otherwise — jsdom implements neither `Blob` nor `URL.createObjectURL`, so
 * without the fallback every host test that exercises the real export path
 * would fail with a confusing TypeError.
 */
export function downloadTextFile(
  content: string,
  fileName: string,
  mimeType: string,
  doc: Document | undefined = globalThis.document
): void {
  if (!doc) {
    throw new Error('No document available for file download');
  }

  const canUseObjectUrl =
    typeof Blob === 'function' &&
    typeof URL !== 'undefined' &&
    typeof URL.createObjectURL === 'function';

  let url: string;
  let revoke: (() => void) | null = null;
  if (canUseObjectUrl) {
    url = URL.createObjectURL(new Blob([content], { type: mimeType }));
    revoke = () => URL.revokeObjectURL(url);
  } else {
    url = `data:${mimeType},${encodeURIComponent(content)}`;
  }

  const anchor = doc.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  doc.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Revoking on the next tick can abort a save that has only just started
  // in Firefox/Safari; a second is the conventional grace period.
  if (revoke) setTimeout(revoke, 1000);
}

export function createCsvExporter<TRow extends RowData = RowData>(
  options: CsvExporterOptions = {}
): TableExporter<TRow> {
  return {
    id: 'csv',
    label: 'CSV',
    icon: 'csv',
    run(ctx: ExportContext<TRow>): void {
      const csv = serializeCsv(ctx, options);
      const bom = options.bom !== false ? '\uFEFF' : '';
      const fileName = `${ctx.fileName}.csv`;
      if (options.download) {
        options.download(bom + csv, fileName);
      } else {
        downloadTextFile(bom + csv, fileName, 'text/csv;charset=utf-8');
      }
    }
  };
}
