import { filterFingerprint } from '../config/validate.js';
import { ConfigInvalidError } from '../domain/errors.js';
import type {
  CoverageRecord,
  StreamDefinition,
  TimeWindow,
} from '../config/schemas.js';
import { coverageRecordSchema } from '../config/schemas.js';
import { countOf } from '../domain/identifiers.js';
import type { Clock } from '../ports/clock.js';
import { systemClock } from '../ports/clock.js';
import type { Logger } from '../ports/logger.js';
import { noopLogger } from '../ports/logger.js';
import type { SqlClient } from '../ports/sql.js';
import type { SqlDialect } from '../sql/dialect.js';
import { extendCoverage, planReuse, type ReusePlan } from './coverage.js';
import {
  countBindingRows,
  extractBinding,
  sourceExtent,
} from './extract.js';
import {
  deleteWindow,
  dropEventLog,
  ensureEventLog,
  eventLogTables,
  insertCaseAttributes,
  insertEventObjects,
  insertEvents,
} from './eventlog.js';

/**
 * Refreshing a data stream.
 *
 * A stream's DuckDB file persists, so a refresh asks the host only for what
 * the file does not already hold — forward for newer data, and backward when
 * the request reaches further into the past than anything materialised. The
 * decision is coverage arithmetic, not a heuristic, so "we already have this"
 * is provable rather than hopeful.
 *
 * Where the host's connection points — production, a replica, a restored
 * backup, a warehouse — is the host's business. The engine reads what it is
 * pointed at.
 */

export interface RefreshOptions {
  /** The host database. Read-only; the engine writes nothing here, ever. */
  hostClient: SqlClient;
  hostDialect: SqlDialect;
  /** The stream's analytics store. */
  storeClient: SqlClient;
  storeDialect: SqlDialect;
  stream: StreamDefinition;
  /** Existing coverage. Omit for a stream that has never been materialised. */
  coverage?: CoverageRecord | undefined;
  /**
   * Slice to bring up to date. Omit to use the source's own full extent,
   * queried from the host rather than guessed.
   */
  window?: TimeWindow | undefined;
  /** Schema holding the engine's tables in a bring-your-own store. */
  schema?: string | undefined;
  /**
   * Rows fetched per slice before it is halved and retried. Bounds peak
   * memory: a slice is materialised in Node on its way to the store.
   */
  sliceRowLimit?: number;
  /** Guard against pathological subdivision of a dense window. */
  maxSliceDepth?: number;
  clock?: Clock;
  logger?: Logger;
}

export interface RefreshResult {
  streamId: string;
  plan: ReusePlan;
  /** Windows actually fetched from the host. Empty when everything was reused. */
  fetched: TimeWindow[];
  eventsWritten: number;
  rowsRead: number;
  /** Host queries issued. Zero on a full cache hit. */
  queries: number;
  coverage: CoverageRecord;
  /** True when the definition changed and the store was rebuilt from scratch. */
  rebuilt: boolean;
}

const DEFAULT_SLICE_ROW_LIMIT = 50_000;
const DEFAULT_MAX_SLICE_DEPTH = 12;

export async function refreshStream(opts: RefreshOptions): Promise<RefreshResult> {
  const {
    hostClient,
    hostDialect,
    storeClient,
    storeDialect,
    stream,
    schema,
  } = opts;
  const clock = opts.clock ?? systemClock;
  const logger = opts.logger ?? noopLogger;
  const sliceRowLimit = opts.sliceRowLimit ?? DEFAULT_SLICE_ROW_LIMIT;
  const maxDepth = opts.maxSliceDepth ?? DEFAULT_MAX_SLICE_DEPTH;

  // A stream imported from a log has no host to re-read. Refusing here rather
  // than running and finding zero bindings makes the reason legible: it is not
  // that nothing was found, it is that there was nowhere to look.
  if (stream.file !== undefined) {
    throw new ConfigInvalidError(
      `stream ${JSON.stringify(stream.id)} was imported from ${JSON.stringify(stream.file.filename)}, so there is no source to refresh from`,
      ['upload a newer export of the same log to bring it up to date'],
    );
  }

  const fingerprint = filterFingerprint(stream);
  const coverage =
    opts.coverage ??
    coverageRecordSchema.parse({ streamId: stream.id, windows: [], filterFingerprint: fingerprint });

  await ensureEventLog(storeClient, storeDialect, schema);

  // Resolve the window before planning: an unbounded request has to become
  // real bounds, or there is nothing to compare coverage against.
  const window = opts.window ?? (await resolveExtent(opts));
  const plan = planReuse(coverage, window, fingerprint);

  let working = coverage;
  let rebuilt = false;

  if (plan.kind === 'rebuild') {
    // The definition changed, so materialised rows describe a different
    // question. Keeping them would silently mix two definitions in one file.
    logger.warn({ stream: stream.id, reason: plan.reason }, 'stream definition changed — rebuilding');
    await dropEventLog(storeClient, storeDialect, schema);
    await ensureEventLog(storeClient, storeDialect, schema);
    working = coverageRecordSchema.parse({
      streamId: stream.id,
      windows: [],
      filterFingerprint: fingerprint,
    });
    rebuilt = true;
  }

  // A rebuild refetches the whole resolved window; otherwise only the gaps.
  const toFetch: TimeWindow[] = rebuilt
    ? window === undefined
      ? []
      : [window]
    : plan.fetch;

  if (toFetch.length === 0) {
    logger.info({ stream: stream.id, reason: plan.reason }, 'refresh satisfied without querying the host');
    return {
      streamId: stream.id,
      plan,
      fetched: [],
      eventsWritten: 0,
      rowsRead: 0,
      queries: 0,
      coverage: working,
      rebuilt,
    };
  }

  let eventsWritten = 0;
  let rowsRead = 0;
  let queries = 0;
  let watermark = working.sourceWatermark ?? null;
  let nextEventId = await maxEventId(storeClient, storeDialect, schema);

  for (const gap of toFetch) {
    // Re-fetching a window REPLACES it: a source row deleted upstream must not
    // survive in the materialised log forever.
    await deleteWindow(storeClient, storeDialect, gap, schema);

    for (const binding of stream.bindings) {
      const extraWhere = stream.filters.where[binding.id];
      const slices: { window: TimeWindow; depth: number }[] = [{ window: gap, depth: 0 }];

      while (slices.length > 0) {
        const slice = slices.pop()!;
        const result = await extractBinding(hostClient, hostDialect, binding, {
          window: slice.window,
          extraWhere,
          firstEventId: nextEventId,
          maxRows: sliceRowLimit,
        });
        queries += 1;

        if (result.truncated && slice.depth < maxDepth) {
          // Too dense to hold in one pass. Halve it and retry both halves
          // rather than paging with OFFSET, which degrades badly on big tables
          // and can skip rows when the source shifts under a long read.
          for (const half of splitWindow(slice.window)) {
            slices.push({ window: half, depth: slice.depth + 1 });
          }
          continue;
        }
        if (result.truncated) {
          logger.warn(
            { stream: stream.id, binding: binding.id, from: slice.window.from, to: slice.window.to },
            'slice still exceeds the row limit at maximum depth — raise sliceRowLimit; this slice is INCOMPLETE',
          );
        }

        if (result.events.length > 0) {
          await insertEvents(storeClient, storeDialect, result.events, schema);
          await insertEventObjects(storeClient, storeDialect, result.objects, schema);
        }
        if (result.caseAttributes.length > 0) {
          await insertCaseAttributes(storeClient, storeDialect, result.caseAttributes, schema);
        }

        eventsWritten += result.events.length;
        rowsRead += result.rowsRead;
        nextEventId = result.nextEventId;
        if (result.maxTimestamp !== null) {
          watermark =
            watermark === null || result.maxTimestamp > watermark ? result.maxTimestamp : watermark;
        }
      }
    }
  }

  const totals = await storeTotals(storeClient, storeDialect, schema);
  const finalCoverage = extendCoverage(working, toFetch, {
    eventCount: totals.events,
    caseCount: totals.objects,
    at: clock.now(),
    ...(watermark !== null ? { watermark } : {}),
  });

  logger.info(
    { stream: stream.id, fetched: toFetch.length, events: eventsWritten, queries },
    'refresh complete',
  );

  return {
    streamId: stream.id,
    plan,
    fetched: toFetch,
    eventsWritten,
    rowsRead,
    queries,
    coverage: finalCoverage,
    rebuilt,
  };
}

/** Halve a window. The midpoint is floored, so both halves are non-empty. */
function splitWindow(window: TimeWindow): TimeWindow[] {
  const from = window.from.getTime();
  const to = window.to.getTime();
  const mid = from + Math.floor((to - from) / 2);
  if (mid <= from || mid >= to) return [window]; // already one millisecond wide
  return [
    { from: new Date(mid), to: window.to },
    { from: window.from, to: new Date(mid) },
  ];
}

/** The union of every binding's own extent, asked of the host. */
async function resolveExtent(opts: RefreshOptions): Promise<TimeWindow | undefined> {
  let lo: number | null = null;
  let hi: number | null = null;

  for (const binding of opts.stream.bindings) {
    const extent = await sourceExtent(
      opts.hostClient,
      opts.hostDialect,
      binding,
      opts.stream.filters.where[binding.id],
    );
    if (extent === null) continue;
    const from = extent.from.getTime();
    const to = extent.to.getTime();
    lo = lo === null ? from : Math.min(lo, from);
    hi = hi === null ? to : Math.max(hi, to);
  }
  if (lo === null || hi === null) return undefined;
  return { from: new Date(lo), to: new Date(hi) };
}

async function maxEventId(
  client: SqlClient,
  dialect: SqlDialect,
  schema: string | undefined,
): Promise<number> {
  const tables = eventLogTables(dialect, schema);
  const { rows } = await client.query(
    `SELECT COALESCE(MAX(event_id), 0) AS m FROM ${tables.events}`,
    [],
  );
  return countOf(rows[0]?.['m']);
}

async function storeTotals(
  client: SqlClient,
  dialect: SqlDialect,
  schema: string | undefined,
): Promise<{ events: number; objects: number }> {
  const tables = eventLogTables(dialect, schema);
  const events = await client.query(`SELECT COUNT(*) AS n FROM ${tables.events}`, []);
  const objects = await client.query(
    `SELECT COUNT(DISTINCT object_id) AS n FROM ${tables.objects}`,
    [],
  );
  return {
    events: countOf(events.rows[0]?.['n']),
    objects: countOf(objects.rows[0]?.['n']),
  };
}

// ---------------------------------------------------------------------------
// Cost preview
// ---------------------------------------------------------------------------

export interface CostPreview {
  streamId: string;
  plan: ReusePlan;
  /** Rows the host would return for the windows that still need fetching. */
  rowsToFetch: number;
  /** Events those rows would produce, after interval unpivoting. */
  eventsToWrite: number;
  perBinding: { bindingId: string; rows: number; events: number }[];
}

/**
 * What a refresh would cost, before running it.
 *
 * Aggregate COUNT queries only. Nobody should discover the size of an
 * extraction by waiting for it.
 */
export async function previewRefresh(opts: RefreshOptions): Promise<CostPreview> {
  const fingerprint = filterFingerprint(opts.stream);
  const coverage =
    opts.coverage ??
    coverageRecordSchema.parse({
      streamId: opts.stream.id,
      windows: [],
      filterFingerprint: fingerprint,
    });

  const window = opts.window ?? (await resolveExtent(opts));
  const plan = planReuse(coverage, window, fingerprint);
  const windows: TimeWindow[] =
    plan.kind === 'rebuild' ? (window === undefined ? [] : [window]) : plan.fetch;

  const perBinding: { bindingId: string; rows: number; events: number }[] = [];
  let rowsToFetch = 0;
  let eventsToWrite = 0;

  for (const binding of opts.stream.bindings) {
    let rows = 0;
    for (const w of windows) {
      rows += await countBindingRows(opts.hostClient, opts.hostDialect, binding, {
        window: w,
        extraWhere: opts.stream.filters.where[binding.id],
      });
    }
    const events = rows * (binding.grain === 'interval' ? 2 : binding.grain === 'event' ? 1 : 0);
    perBinding.push({ bindingId: binding.id, rows, events });
    rowsToFetch += rows;
    eventsToWrite += events;
  }

  return { streamId: opts.stream.id, plan, rowsToFetch, eventsToWrite, perBinding };
}
