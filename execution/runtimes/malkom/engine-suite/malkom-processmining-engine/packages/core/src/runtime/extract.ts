import {
  eventsPerRow,
  grainYieldsSteps,
  type Attribute,
  type FilterExpr,
  type SourceBinding,
  type StreamDefinition,
  type TimeWindow,
} from '../config/schemas.js';
import { AdapterError, looksLikeSchemaError } from '../domain/errors.js';
import { instantMsOf, numberOrNull } from '../domain/identifiers.js';
import type { Logger } from '../ports/logger.js';
import { noopLogger } from '../ports/logger.js';
import type { SqlClient } from '../ports/sql.js';
import {
  activityExpr,
  andAll,
  compileFilter,
  eventTimestamps,
  fromClause,
  ParamBuilder,
  quoteColumn,
  whereClause,
} from '../sql/compile.js';
import type { SqlDialect } from '../sql/dialect.js';
import type {
  CanonicalCaseAttribute,
  CanonicalEvent,
  CanonicalEventObject,
} from './eventlog.js';

/**
 * Reading a bound source out of the host database.
 *
 * The engine issues ONE query shape per binding: the declared relation, the
 * declared filters, and a time slice — everything pushed down. Rows come back
 * already narrowed to the mapped roles, so a table with two hundred columns
 * transfers the six that mean something.
 *
 * The host decides what that connection points at. Production, a replica, a
 * restored backup, a reporting warehouse — the engine neither knows nor cares.
 */

export interface ExtractOptions {
  /** Time slice to fetch. Rows are selected on the binding's ordering timestamp. */
  window?: TimeWindow | undefined;
  /** Stream-level predicate for this binding, ANDed with the binding's own. */
  extraWhere?: FilterExpr | undefined;
  /** First event id to allocate. Ids must not collide with what is already stored. */
  firstEventId: number;
  /** Hard cap; the caller subdivides the window and retries when it is hit. */
  maxRows?: number;
}

export interface ExtractResult {
  events: CanonicalEvent[];
  objects: CanonicalEventObject[];
  caseAttributes: CanonicalCaseAttribute[];
  /** Rows read from the host, before unpivoting. */
  rowsRead: number;
  /** True when maxRows was reached, so the caller must split the window. */
  truncated: boolean;
  /** Newest source timestamp seen — the watermark for the next incremental fetch. */
  maxTimestamp: Date | null;
  nextEventId: number;
}

/** Stable aliases, so reading the result never depends on column order. */
const COL = {
  activity: 'mk_activity',
  resource: 'mk_resource',
  duration: 'mk_duration',
  cost: 'mk_cost',
  lifecycle: 'mk_lifecycle',
  ts: (i: number) => `mk_ts_${i}`,
  object: (i: number) => `mk_obj_${i}`,
  attribute: (i: number) => `mk_attr_${i}`,
};

/**
 * Fetch one slice of one binding and turn it into canonical events.
 *
 * An `interval` row unpivots here, into a start and a complete event carrying
 * the same object links — which is why handling time survives as its own
 * figure rather than being flattened into a single instant.
 */
export async function extractBinding(
  client: SqlClient,
  dialect: SqlDialect,
  binding: SourceBinding,
  opts: ExtractOptions,
): Promise<ExtractResult> {
  const params = new ParamBuilder(dialect);
  const timestamps = eventTimestamps(binding, dialect);
  const activity = activityExpr(binding.roles, dialect, binding.from);
  const attributes = binding.attributes as Attribute[];

  const selects: string[] = [];
  if (activity !== undefined) selects.push(`${activity} AS ${COL.activity}`);
  for (const [i, ts] of timestamps.entries()) selects.push(`${ts.expr} AS ${COL.ts(i)}`);

  const { roles } = binding;
  if (roles.resource !== undefined) {
    selects.push(`${quoteColumn(roles.resource, dialect, binding.from)} AS ${COL.resource}`);
  }
  if (roles.duration !== undefined) {
    selects.push(`${quoteColumn(roles.duration, dialect, binding.from)} AS ${COL.duration}`);
  }
  if (roles.cost !== undefined) {
    selects.push(`${quoteColumn(roles.cost, dialect, binding.from)} AS ${COL.cost}`);
  }
  if (roles.lifecycle !== undefined) {
    selects.push(`${quoteColumn(roles.lifecycle, dialect, binding.from)} AS ${COL.lifecycle}`);
  }
  for (const [i, link] of binding.objects.entries()) {
    selects.push(`${quoteColumn(link.column, dialect, binding.from)} AS ${COL.object(i)}`);
  }
  for (const [i, attr] of attributes.entries()) {
    selects.push(`${quoteColumn(attr.column, dialect, binding.from)} AS ${COL.attribute(i)}`);
  }
  if (selects.length === 0) selects.push('1 AS mk_placeholder');

  // Windowing uses the FIRST event timestamp: for an interval that is the
  // start, so a unit of work belongs to the slice in which it BEGAN. Slicing
  // on the end instead would move long-running work into a later slice than
  // the one its start was already written to, and duplicate it.
  const orderExpr = timestamps[0]?.expr;
  const predicate = andAll([
    binding.where !== undefined ? compileFilter(binding.where, dialect, params, binding.from) : undefined,
    opts.extraWhere !== undefined
      ? compileFilter(opts.extraWhere, dialect, params, binding.from)
      : undefined,
    opts.window !== undefined && orderExpr !== undefined
      ? windowPredicate(orderExpr, opts.window, dialect, params)
      : undefined,
  ]);

  const limit = opts.maxRows;
  const text =
    `SELECT ${selects.join(', ')} FROM ${fromClause(binding.from, dialect)}${whereClause(predicate)}` +
    (orderExpr !== undefined ? ` ORDER BY ${orderExpr}` : '') +
    (limit !== undefined ? ` LIMIT ${limit + 1}` : '');

  let rows: Record<string, unknown>[];
  try {
    ({ rows } = await client.query(text, params.params));
  } catch (err) {
    throw new AdapterError(
      `extraction failed for binding ${JSON.stringify(binding.id)}: ${String(err)}`,
      { schemaClass: looksLikeSchemaError(err), binding: binding.id },
    );
  }

  const truncated = limit !== undefined && rows.length > limit;
  if (truncated) rows = rows.slice(0, limit);

  return buildEvents(binding, rows, timestamps, attributes, opts.firstEventId, truncated);
}

function windowPredicate(
  expr: string,
  window: TimeWindow,
  dialect: SqlDialect,
  params: ParamBuilder,
): string {
  // Half-open [from, to) so adjacent slices tile without double-counting the
  // boundary instant — an event exactly at `to` belongs to the next slice.
  const from = params.addTimestamp(window.from);
  const to = params.addTimestamp(window.to);
  return `(${expr} >= ${from} AND ${expr} < ${to})`;
}

function buildEvents(
  binding: SourceBinding,
  rows: readonly Record<string, unknown>[],
  timestamps: readonly { label: string; expr: string }[],
  attributes: readonly Attribute[],
  firstEventId: number,
  truncated: boolean,
): ExtractResult {
  const events: CanonicalEvent[] = [];
  const objects: CanonicalEventObject[] = [];
  const caseAttributes: CanonicalCaseAttribute[] = [];
  const seenCaseAttrs = new Set<string>();

  let eventId = firstEventId;
  let maxTs: number | null = null;
  const yieldsSteps = grainYieldsSteps(binding.grain);

  for (const row of rows) {
    const links: { type: string; id: string }[] = [];
    for (const [i, link] of binding.objects.entries()) {
      const raw = row[COL.object(i)];
      if (raw === null || raw === undefined || raw === '') continue;
      links.push({ type: link.type, id: String(raw) });
    }

    // Case-scoped attributes come from the row but describe the object, so
    // they are written once per (object, key) rather than once per event.
    for (const [i, attr] of attributes.entries()) {
      if (attr.scope !== 'case') continue;
      const value = row[COL.attribute(i)];
      const name = attr.as ?? attr.column;
      for (const link of links) {
        const key = `${link.type} ${link.id} ${name}`;
        if (seenCaseAttrs.has(key)) continue;
        seenCaseAttrs.add(key);
        caseAttributes.push({
          objectType: link.type,
          objectId: link.id,
          key: name,
          value: value === null || value === undefined ? null : String(value),
        });
      }
    }

    if (!yieldsSteps) continue; // snapshot: attributes only, never steps

    const activity = row[COL.activity];
    if (activity === null || activity === undefined) continue;
    if (links.length === 0) continue; // uncorrelatable: it belongs to no trace

    const eventAttributes: Record<string, unknown> = {};
    for (const [i, attr] of attributes.entries()) {
      if (attr.scope === 'case') continue;
      eventAttributes[attr.as ?? attr.column] = row[COL.attribute(i)] ?? null;
    }

    const resource = readString(row[COL.resource]);
    const duration = numberOrNull(row[COL.duration] ?? null);
    const cost = numberOrNull(row[COL.cost] ?? null);
    const declaredLifecycle = readString(row[COL.lifecycle]);

    for (const [i, ts] of timestamps.entries()) {
      const ms = instantMsOf(row[COL.ts(i)]);
      if (ms === null) continue; // no timestamp, no place in the trace
      maxTs = maxTs === null ? ms : Math.max(maxTs, ms);

      eventId += 1;
      events.push({
        eventId,
        activity: String(activity),
        timestamp: new Date(ms),
        // An interval unpivots into start/complete; a single-timestamp event
        // keeps whatever the host's own lifecycle column said.
        lifecycle: timestamps.length > 1 ? ts.label : declaredLifecycle,
        resource,
        // Handling time belongs to the work, not to each end of it — recording
        // it twice would double every duration that is later summed.
        durationSeconds: i === 0 ? duration : null,
        // Same reasoning as duration: the cost belongs to the work, so it is
        // recorded once. Charging both ends of an interval would double every
        // total the moment an interval source is bound.
        cost: i === 0 ? cost : null,
        bindingId: binding.id,
        attributes: eventAttributes,
      });
      for (const link of links) {
        objects.push({ eventId, objectType: link.type, objectId: link.id });
      }
    }
  }

  return {
    events,
    objects,
    caseAttributes,
    rowsRead: rows.length,
    truncated,
    maxTimestamp: maxTs === null ? null : new Date(maxTs),
    nextEventId: eventId,
  };
}

function readString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value);
  return text === '' ? null : text;
}

/** Rows a binding is expected to contribute per source row, for cost preview. */
export function eventsPerSourceRow(binding: SourceBinding): number {
  return eventsPerRow(binding.grain);
}

/**
 * Count rows a binding would return for a window, without transferring them.
 *
 * The basis of the cost preview: nobody should discover the size of an
 * extraction by waiting for it.
 */
export async function countBindingRows(
  client: SqlClient,
  dialect: SqlDialect,
  binding: SourceBinding,
  opts: { window?: TimeWindow | undefined; extraWhere?: FilterExpr | undefined } = {},
): Promise<number> {
  const params = new ParamBuilder(dialect);
  const timestamps = eventTimestamps(binding, dialect);
  const orderExpr = timestamps[0]?.expr;
  const predicate = andAll([
    binding.where !== undefined ? compileFilter(binding.where, dialect, params, binding.from) : undefined,
    opts.extraWhere !== undefined
      ? compileFilter(opts.extraWhere, dialect, params, binding.from)
      : undefined,
    opts.window !== undefined && orderExpr !== undefined
      ? windowPredicate(orderExpr, opts.window, dialect, params)
      : undefined,
  ]);

  const text = `SELECT COUNT(*) AS n FROM ${fromClause(binding.from, dialect)}${whereClause(predicate)}`;
  try {
    const { rows } = await client.query(text, params.params);
    const raw = rows[0]?.['n'];
    return typeof raw === 'bigint' ? Number(raw) : Number(raw ?? 0);
  } catch (err) {
    throw new AdapterError(`count failed for binding ${JSON.stringify(binding.id)}: ${String(err)}`, {
      schemaClass: looksLikeSchemaError(err),
      binding: binding.id,
    });
  }
}

/**
 * The full time span a stream's sources cover, asked of the host directly.
 *
 * Used when a refresh has no window: the engine needs real bounds to slice
 * against, and guessing them would either miss data or scan empty centuries.
 */
export async function sourceExtent(
  client: SqlClient,
  dialect: SqlDialect,
  binding: SourceBinding,
  extraWhere?: FilterExpr,
): Promise<TimeWindow | null> {
  const timestamps = eventTimestamps(binding, dialect);
  const first = timestamps[0];
  const last = timestamps[timestamps.length - 1];
  if (first === undefined || last === undefined) return null;

  const params = new ParamBuilder(dialect);
  const predicate = andAll([
    binding.where !== undefined ? compileFilter(binding.where, dialect, params, binding.from) : undefined,
    extraWhere !== undefined ? compileFilter(extraWhere, dialect, params, binding.from) : undefined,
  ]);

  const text =
    `SELECT MIN(${first.expr}) AS lo, MAX(${last.expr}) AS hi ` +
    `FROM ${fromClause(binding.from, dialect)}${whereClause(predicate)}`;
  try {
    const { rows } = await client.query(text, params.params);
    const lo = instantMsOf(rows[0]?.['lo']);
    const hi = instantMsOf(rows[0]?.['hi']);
    if (lo === null || hi === null) return null;
    // The window is half-open, so the newest event needs one millisecond of
    // headroom or it falls outside its own extent and is never fetched.
    return { from: new Date(lo), to: new Date(hi + 1) };
  } catch (err) {
    throw new AdapterError(`extent query failed for binding ${JSON.stringify(binding.id)}: ${String(err)}`, {
      schemaClass: looksLikeSchemaError(err),
      binding: binding.id,
    });
  }
}

export function describeExtraction(
  stream: StreamDefinition,
  logger: Logger = noopLogger,
): void {
  logger.info(
    { stream: stream.id, bindings: stream.bindings.map((b) => b.id) },
    'extraction plan',
  );
}
