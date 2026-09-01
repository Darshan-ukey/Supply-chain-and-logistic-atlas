import { UnsupportedError } from '../domain/errors.js';
import type { SqlDialect } from '../sql/dialect.js';
import { businessElapsedExpr, type BusinessCalendar } from './calendar.js';
import {
  perspectiveExpr,
  eventOrderBy,
  type EventLogTables,
  type Perspective,
} from './eventlog.js';

/**
 * Selecting a subset of cases — the thing that turns a set of reports into
 * something explorable.
 *
 * The critical semantics: a filter selects **whole cases**, not individual
 * events. Clicking "Approve" in a process map means *show me the cases that go
 * through Approve*, with their complete traces — not just the Approve events.
 * Filtering at event level instead produces a log of disconnected fragments in
 * which every case looks one step long, and every downstream number is then
 * quietly wrong rather than obviously broken.
 *
 * Every filter compiles to a subquery over case ids, so the same selection can
 * be applied to discovery, performance, variants, resources, conformance and
 * root cause and give a consistent answer across all of them.
 */

export type CaseFilter =
  /** Cases whose case-scoped attribute matches. `values` is an OR over values. */
  | { kind: 'attribute'; key: string; value?: string; values?: readonly string[] }
  /** Cases that do (or never do) an activity. */
  | { kind: 'activity'; activity: string; present?: boolean }
  /** Cases involving (or never involving) a resource. */
  | { kind: 'resource'; resource: string; present?: boolean }
  /**
   * Cases whose timing falls in a window.
   *
   * `on` decides which instant is tested — where a case STARTED, where it
   * ENDED, or whether it was active at any point. They give materially
   * different populations near the edges of a window, and picking silently
   * would make two reports over "March" disagree.
   */
  | { kind: 'window'; from: Date; to: Date; on?: 'start' | 'end' | 'any' }
  /** Cases whose end-to-end duration falls in a range, in seconds. */
  | { kind: 'cycleTime'; minSeconds?: number; maxSeconds?: number }
  /** Cases whose trace has at least / at most this many events. */
  | { kind: 'length'; min?: number; max?: number }
  /** Explicit case ids — how a UI passes a lasso selection back. */
  | { kind: 'cases'; ids: readonly string[] }
  /**
   * Cases following exactly this path — the whole sequence, start to end.
   *
   * How clicking a row in the variant list filters everything else. A UI
   * cannot express this as a `cases` list: it is shown only a few sample ids
   * per variant, and the real membership can run to thousands.
   */
  | { kind: 'variant'; path: readonly string[] }
  /**
   * Cases where `from` led to `to`.
   *
   * `directly` distinguishes the two questions that look alike and are not:
   * *did Assess ever lead to Reject* (eventually), versus *did Reject come
   * straight after Assess* (directly, nothing in between).
   */
  | { kind: 'path'; from: string; to: string; directly?: boolean }
  /**
   * Cases where work was repeated.
   *
   * With `activity`, that one step ran at least `minTimes` times. Without it,
   * *some* step did — the general "show me the cases with rework in them",
   * which is where the cost usually hides.
   */
  | { kind: 'rework'; activity?: string; minTimes: number }
  | { kind: 'and'; args: readonly CaseFilter[] }
  | { kind: 'or'; args: readonly CaseFilter[] }
  | { kind: 'not'; arg: CaseFilter };

/**
 * Ambient context a filter is evaluated in.
 *
 * `lifecycle` matters for any filter that reasons about SEQUENCE. The log an
 * analysis sees is lifecycle-filtered, so the variant list a user clicked was
 * built from completions only; matching that click against the unfiltered
 * event stream would compare against a sequence nobody was ever shown, and the
 * filter would silently select nothing.
 */
export interface FilterContext {
  lifecycle?: readonly string[] | undefined;
  /**
   * The perspective the caller is looking at.
   *
   * Sequence filters compare against it rather than against the raw activity
   * column, so clicking a variant while viewing the RESOURCE perspective
   * filters on the sequence of people that was on screen. Comparing against
   * activities there would match nothing and look like an empty result.
   *
   * Presence filters (`activity`, `resource`) deliberately do NOT follow the
   * perspective: they name a real thing in the log, and should keep meaning
   * that whatever the map is currently drawn as.
   */
  perspective?: Perspective | undefined;
  /**
   * The working calendar the analysis is measuring on, if any.
   *
   * Only the duration filter reads it, and it has to: a caller asking for cases
   * longer than three days while the report counts working hours would select
   * on one clock and be read on another.
   */
  calendar?: BusinessCalendar | undefined;
}

/** Separator inside a variant path key. Matches the variants report default. */
export const VARIANT_SEPARATOR = ' → ';

/** Cap on an id list, so a pathological selection cannot build unbounded SQL. */
export const MAX_CASE_IDS = 10_000;

/**
 * Compile a filter to a boolean predicate over `caseIdExpr`.
 *
 * The expression is supplied rather than assumed so the predicate can be
 * dropped into whatever alias the calling query uses.
 */
export function caseFilterPredicate(
  filter: CaseFilter,
  tables: EventLogTables,
  dialect: SqlDialect,
  params: unknown[],
  objectType: string,
  caseIdExpr: string,
  ctx: FilterContext = {},
): string {
  const hole = (value: unknown): string => {
    params.push(value);
    return dialect.placeholder(params.length);
  };
  const timeHole = (value: Date): string => {
    params.push(dialect.timestampParam(value));
    return dialect.timestampPlaceholder(params.length);
  };

  /**
   * The ambient lifecycle restriction, as a predicate over an alias.
   *
   * Emitted into every sequence-aware subquery so the events a filter reasons
   * about are the same events the analysis will go on to see.
   */
  const lifecycleOf = (alias: string): string => {
    const values = ctx.lifecycle;
    if (values === undefined || values.length === 0) return 'TRUE';
    const list = values.map((v) => hole(v.toLowerCase())).join(', ');
    return `lower(COALESCE(${alias}.lifecycle, '')) IN (${list})`;
  };

  /** Events of this case, as a correlated subquery. */
  const events = (extra: string): string =>
    `EXISTS (SELECT 1 FROM ${tables.events} e
             JOIN ${tables.objects} o ON o.event_id = e.event_id
             WHERE o.object_type = ${hole(objectType)} AND o.object_id = ${caseIdExpr}
               AND ${extra})`;

  /** What a step is called under the perspective in view. */
  const named = (alias: string): string => perspectiveExpr(ctx.perspective, alias, dialect, params);

  /** This case's events, lifecycle-restricted — the base of every sequence filter. */
  const trace = (alias: string): string =>
    `FROM ${tables.events} ${alias}
     JOIN ${tables.objects} o${alias} ON o${alias}.event_id = ${alias}.event_id
     WHERE o${alias}.object_type = ${hole(objectType)}
       AND o${alias}.object_id = ${caseIdExpr}
       AND ${lifecycleOf(alias)}`;

  switch (filter.kind) {
    case 'and':
      if (filter.args.length === 0) return 'TRUE';
      return `(${filter.args
        .map((a) => caseFilterPredicate(a, tables, dialect, params, objectType, caseIdExpr, ctx))
        .join(' AND ')})`;

    case 'or':
      if (filter.args.length === 0) return 'FALSE';
      return `(${filter.args
        .map((a) => caseFilterPredicate(a, tables, dialect, params, objectType, caseIdExpr, ctx))
        .join(' OR ')})`;

    case 'not':
      return `(NOT ${caseFilterPredicate(filter.arg, tables, dialect, params, objectType, caseIdExpr, ctx)})`;

    case 'attribute': {
      const values =
        filter.values !== undefined && filter.values.length > 0
          ? filter.values
          : filter.value !== undefined
            ? [filter.value]
            : [];
      if (values.length === 0) {
        throw new UnsupportedError("attribute filter needs 'value' or a non-empty 'values'");
      }
      const list = values.map((v) => hole(v)).join(', ');
      return `EXISTS (SELECT 1 FROM ${tables.caseAttrs} ca
                      WHERE ca.object_type = ${hole(objectType)} AND ca.object_id = ${caseIdExpr}
                        AND ca.key = ${hole(filter.key)} AND ca.value IN (${list}))`;
    }

    case 'activity': {
      const predicate = events(`e.activity = ${hole(filter.activity)}`);
      return filter.present === false ? `(NOT ${predicate})` : predicate;
    }

    case 'resource': {
      const predicate = events(`e.resource = ${hole(filter.resource)}`);
      return filter.present === false ? `(NOT ${predicate})` : predicate;
    }

    case 'window': {
      const on = filter.on ?? 'any';
      const from = timeHole(filter.from);
      const to = timeHole(filter.to);
      if (on === 'any') {
        // Active at some point in the window: any event inside it.
        return events(`e.ts >= ${from} AND e.ts < ${to}`);
      }
      const aggregate = on === 'start' ? 'MIN' : 'MAX';
      return `(SELECT ${aggregate}(e.ts) FROM ${tables.events} e
               JOIN ${tables.objects} o ON o.event_id = e.event_id
               WHERE o.object_type = ${hole(objectType)} AND o.object_id = ${caseIdExpr})
              BETWEEN ${from} AND ${to}`;
    }

    case 'cycleTime': {
      // Elapsed on whichever clock the analysis is using. Built once and used
      // for both bounds, so the two comparisons share their bound parameters.
      const elapsed =
        ctx.calendar === undefined
          ? undefined
          : businessElapsedExpr(dialect, 'e.ts', ctx.calendar, params);
      const measured =
        elapsed === undefined
          ? dialect.durationSeconds('MIN(e.ts)', 'MAX(e.ts)')
          : `(MAX(${elapsed}) - MIN(${elapsed}))`;
      const span = `(SELECT ${measured}
                     FROM ${tables.events} e
                     JOIN ${tables.objects} o ON o.event_id = e.event_id
                     WHERE o.object_type = ${hole(objectType)} AND o.object_id = ${caseIdExpr})`;
      const bounds: string[] = [];
      if (filter.minSeconds !== undefined) bounds.push(`${span} >= ${Number(filter.minSeconds)}`);
      if (filter.maxSeconds !== undefined) bounds.push(`${span} <= ${Number(filter.maxSeconds)}`);
      if (bounds.length === 0) return 'TRUE';
      return `(${bounds.join(' AND ')})`;
    }

    case 'length': {
      const count = `(SELECT COUNT(*) FROM ${tables.events} e
                      JOIN ${tables.objects} o ON o.event_id = e.event_id
                      WHERE o.object_type = ${hole(objectType)} AND o.object_id = ${caseIdExpr})`;
      const bounds: string[] = [];
      if (filter.min !== undefined) bounds.push(`${count} >= ${Math.trunc(filter.min)}`);
      if (filter.max !== undefined) bounds.push(`${count} <= ${Math.trunc(filter.max)}`);
      if (bounds.length === 0) return 'TRUE';
      return `(${bounds.join(' AND ')})`;
    }

    case 'cases': {
      if (filter.ids.length === 0) return 'FALSE';
      if (filter.ids.length > MAX_CASE_IDS) {
        throw new UnsupportedError(
          `case id filter holds ${filter.ids.length} ids, above the ${MAX_CASE_IDS} limit — express the selection as a predicate instead of a list`,
        );
      }
      return `${caseIdExpr} IN (${filter.ids.map((id) => hole(id)).join(', ')})`;
    }

    case 'variant': {
      if (filter.path.length === 0) {
        throw new UnsupportedError('variant filter needs a non-empty path');
      }
      // Compare the whole assembled sequence, not a prefix: a variant IS the
      // complete path, and matching on a prefix would fold every longer case
      // into it.
      const key = filter.path.join(VARIANT_SEPARATOR);
      const agg = dialect.stringAgg(named('ev'), VARIANT_SEPARATOR, eventOrderBy('ev'));
      return `(SELECT ${agg} ${trace('ev')}) = ${hole(key)}`;
    }

    case 'path': {
      const from = hole(filter.from);
      const to = hole(filter.to);
      if (filter.directly === true) {
        // LEAD over the case's own events: the successor is computed once per
        // event rather than by searching for "nothing in between", which would
        // be a second correlated scan per candidate pair.
        return `EXISTS (SELECT 1 FROM (
                  SELECT ${named('ev')} AS a,
                         LEAD(${named('ev')}) OVER (ORDER BY ${eventOrderBy('ev')}) AS b
                  ${trace('ev')}
                ) step WHERE step.a = ${from} AND step.b = ${to})`;
      }
      // Eventually-follows. The tie-break on event_id matters: interval sources
      // routinely emit two events at the same instant, and comparing timestamps
      // alone would miss a genuine ordering the log does record.
      return `EXISTS (SELECT 1 ${trace('ea')}
                        AND ${named('ea')} = ${from}
                        AND EXISTS (SELECT 1 ${trace('eb')}
                                      AND ${named('eb')} = ${to}
                                      AND (eb.ts > ea.ts
                                           OR (eb.ts = ea.ts AND eb.event_id > ea.event_id))))`;
    }

    case 'rework': {
      const times = Math.max(1, Math.trunc(filter.minTimes));
      if (filter.activity !== undefined) {
        return `(SELECT COUNT(*) ${trace('ev')} AND ${named('ev')} = ${hole(filter.activity)}) >= ${times}`;
      }
      // Any activity at all repeating — the general "this case has rework in it".
      return `EXISTS (SELECT 1 ${trace('ev')}
                      GROUP BY ${named('ev')} HAVING COUNT(*) >= ${times})`;
    }
  }
}

/** Human-readable description, for report headers and log lines. */
export function describeFilter(filter: CaseFilter): string {
  switch (filter.kind) {
    case 'and':
      return filter.args.length === 0 ? 'all cases' : filter.args.map(describeFilter).join(' and ');
    case 'or':
      return filter.args.length === 0 ? 'no cases' : `(${filter.args.map(describeFilter).join(' or ')})`;
    case 'not':
      return `not ${describeFilter(filter.arg)}`;
    case 'attribute': {
      const values = filter.values ?? (filter.value !== undefined ? [filter.value] : []);
      return `${filter.key} = ${values.join(' or ')}`;
    }
    case 'activity':
      return filter.present === false ? `never doing ${filter.activity}` : `doing ${filter.activity}`;
    case 'resource':
      return filter.present === false ? `not involving ${filter.resource}` : `involving ${filter.resource}`;
    case 'window': {
      const on = filter.on ?? 'any';
      const range = `${filter.from.toISOString().slice(0, 10)}..${filter.to.toISOString().slice(0, 10)}`;
      return on === 'any' ? `active in ${range}` : `${on}ed in ${range}`;
    }
    case 'cycleTime': {
      const parts: string[] = [];
      if (filter.minSeconds !== undefined) parts.push(`>= ${fmt(filter.minSeconds)}`);
      if (filter.maxSeconds !== undefined) parts.push(`<= ${fmt(filter.maxSeconds)}`);
      return `taking ${parts.join(' and ')}`;
    }
    case 'length': {
      const parts: string[] = [];
      if (filter.min !== undefined) parts.push(`>= ${filter.min}`);
      if (filter.max !== undefined) parts.push(`<= ${filter.max}`);
      return `with ${parts.join(' and ')} events`;
    }
    case 'cases':
      return `${filter.ids.length} selected cases`;
    case 'variant':
      return `following ${filter.path.join(VARIANT_SEPARATOR)}`;
    case 'path':
      return filter.directly === true
        ? `where ${filter.to} came straight after ${filter.from}`
        : `where ${filter.from} led to ${filter.to}`;
    case 'rework':
      return filter.activity === undefined
        ? `repeating any step ${filter.minTimes}+ times`
        : `doing ${filter.activity} ${filter.minTimes}+ times`;
  }
}

function fmt(seconds: number): string {
  if (seconds < 3600) return `${(seconds / 60).toFixed(0)}m`;
  if (seconds < 86_400) return `${(seconds / 3600).toFixed(1)}h`;
  return `${(seconds / 86_400).toFixed(1)}d`;
}

/** Combine filters, dropping undefined ones. Returns undefined when nothing is left. */
export function allOf(...filters: (CaseFilter | undefined)[]): CaseFilter | undefined {
  const present = filters.filter((f): f is CaseFilter => f !== undefined);
  if (present.length === 0) return undefined;
  if (present.length === 1) return present[0];
  return { kind: 'and', args: present };
}
