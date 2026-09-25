import { ConfigInvalidError } from '../domain/errors.js';
import { countOf, numberOrNull } from '../domain/identifiers.js';
import type { SqlClient } from '../ports/sql.js';
import type { SqlDialect } from '../sql/dialect.js';
import type { HistogramBucket } from './charts.js';
import { perspectiveExpr } from './eventlog.js';
import {
  CASE_CYCLE_SECONDS,
  PREVIOUS_STEP_LAGS,
  buildLog,
  waitingSecondsExpr,
  type LogQueryOptions,
} from './logquery.js';
import type { Distribution } from './performance.js';

/**
 * One distribution service, rather than four bespoke ones.
 *
 * A box plot per activity, a violin per person, a ridgeline over every step and
 * a trace-length histogram are the same query with different words around it:
 * group some observations, describe each group's spread, optionally bin it. Four
 * separate implementations of that would drift, and the first symptom of drift
 * is two charts on one screen disagreeing about the same activity's median.
 *
 * **A mean is never enough and is never returned alone.** Durations are heavily
 * right-skewed — a handful of cases that took months drag the mean somewhere no
 * real case lives. The quartiles draw the box, the upper percentiles are what an
 * SLA is written against, and the count says whether any of it means anything.
 *
 * **An incoherent grouping is refused, not approximated.** Handling time is
 * recorded per event and cycle time per case, so "cycle time by resource" has no
 * single honest answer — a case touched by four people would have to be counted
 * four times or attributed to one of them arbitrarily. Both are wrong in ways a
 * reader cannot see, so the request is rejected by name instead.
 */

/** What is being measured. */
export type DistributionMeasure =
  /** Per case: first event to last. */
  | 'cycle'
  /** Per event: recorded time being worked. */
  | 'handling'
  /** Per event: idle time before it started. */
  | 'waiting'
  /** Per case: how many events. */
  | 'length';

/** What the observations are split by. */
export type GroupDimension =
  | { kind: 'none' }
  | { kind: 'activity' }
  | { kind: 'resource' }
  /** The case's full route, so routes can be compared as populations. */
  | { kind: 'variant' }
  /**
   * A case-scoped attribute, from the snapshot sources.
   *
   * Per-case measures only. For a per-event split by attribute, set the log's
   * `perspective` to that attribute and group by activity — the engine has one
   * re-projection mechanism and this is it.
   */
  | { kind: 'attribute'; key: string };

/** Measures with one observation per case rather than per event. */
const PER_CASE: ReadonlySet<DistributionMeasure> = new Set(['cycle', 'length']);
/** Groupings that describe a case rather than an event. */
const CASE_DIMENSIONS: ReadonlySet<GroupDimension['kind']> = new Set([
  'none',
  'variant',
  'attribute',
]);
/**
 * Groupings that describe an event rather than a case.
 *
 * No attribute here, and not an oversight: the projected log carries no event
 * attributes, because re-projecting them is what `perspective` already does.
 * "Waiting time by channel" is `perspective: attr:channel` grouped by activity,
 * which is one mechanism instead of two that could disagree.
 */
const EVENT_DIMENSIONS: ReadonlySet<GroupDimension['kind']> = new Set([
  'none',
  'activity',
  'resource',
]);

export interface GroupedDistribution {
  /** The group's name. `UNGROUPED` when nothing was split. */
  group: string;
  values: Distribution;
  /**
   * The shape, when bins were asked for.
   *
   * Null rather than empty when binning was not requested, so a caller can tell
   * "not asked" from "asked, and everything landed in one bar".
   */
  bins: HistogramBucket[] | null;
}

export interface DistributionReport {
  objectType: string;
  measure: DistributionMeasure;
  groupedBy: GroupDimension['kind'];
  /** Seconds, except `length`, which counts events. */
  unit: 'seconds' | 'events';
  /** Groups, largest population first. */
  groups: GroupedDistribution[];
  /** Groups dropped for holding too few observations to describe. */
  omittedGroups: number;
  /** True when bucket edges grow geometrically. Durations need it; counts do not. */
  logarithmic: boolean;
}

export interface DistributionOptions extends LogQueryOptions {
  measure?: DistributionMeasure | undefined;
  groupBy?: GroupDimension | undefined;
  /** Bins per group for a violin or ridgeline. Omit for box plots. */
  bins?: number | undefined;
  /** Groups with fewer observations than this are dropped. Default 1. */
  minObservations?: number | undefined;
  /** Cap on groups returned, largest first. Default 60. */
  limit?: number | undefined;
}

/** The name a single ungrouped population is returned under. */
export const UNGROUPED = 'all';

const DEFAULT_LIMIT = 60;
const MAX_BINS = 200;

export async function groupedDistribution(
  client: SqlClient,
  dialect: SqlDialect,
  opts: DistributionOptions,
): Promise<DistributionReport> {
  const measure = opts.measure ?? 'cycle';
  const groupBy = opts.groupBy ?? { kind: 'none' };
  const perCase = PER_CASE.has(measure);
  const limit = Math.max(1, Math.trunc(opts.limit ?? DEFAULT_LIMIT));
  const minObservations = Math.max(1, Math.trunc(opts.minObservations ?? 1));

  const allowed = perCase ? CASE_DIMENSIONS : EVENT_DIMENSIONS;
  if (!allowed.has(groupBy.kind)) {
    throw new ConfigInvalidError(
      `${measure} is measured per ${perCase ? 'case' : 'event'} and cannot be grouped by ${groupBy.kind}`,
      [
        perCase
          ? 'per-case measures group by variant, a case attribute, or nothing'
          : 'per-event measures group by activity, resource, or an event attribute',
      ],
    );
  }

  const params: unknown[] = [];
  const { sql: log, tables } = buildLog(dialect, params, opts);
  const observations = perCase
    ? perCaseObservations(dialect, log, measure, groupBy, params, opts.objectType, tables.caseAttrs)
    : perEventObservations(dialect, log, measure, groupBy, params);

  const { rows } = await client.query(
    `SELECT grp,
            COUNT(value) AS n,
            AVG(value) AS mean,
            MIN(value) AS lo,
            MAX(value) AS hi,
            SUM(value) AS total,
            ${dialect.quantileOf('value', 0.25)} AS p25,
            ${dialect.quantileOf('value', 0.5)} AS p50,
            ${dialect.quantileOf('value', 0.75)} AS p75,
            ${dialect.quantileOf('value', 0.9)} AS p90,
            ${dialect.quantileOf('value', 0.95)} AS p95
     FROM (${observations}) o
     WHERE value IS NOT NULL
     GROUP BY 1`,
    params,
  );

  const described = rows
    .map((row) => ({
      group: String(row['grp']),
      values: {
        count: countOf(row['n']),
        mean: numberOrNull(row['mean']),
        p25: numberOrNull(row['p25']),
        p50: numberOrNull(row['p50']),
        p75: numberOrNull(row['p75']),
        p90: numberOrNull(row['p90']),
        p95: numberOrNull(row['p95']),
        min: numberOrNull(row['lo']),
        max: numberOrNull(row['hi']),
        total: numberOrNull(row['total']),
      } satisfies Distribution,
      bins: null as HistogramBucket[] | null,
    }))
    .sort((a, b) => b.values.count - a.values.count || a.group.localeCompare(b.group));

  const usable = described.filter((g) => g.values.count >= minObservations);
  const kept = usable.slice(0, limit);

  // Counts are small integers and read wrong on a log axis; durations span
  // minutes to months and read wrong on a linear one.
  const logarithmic = measure !== 'length';

  if (opts.bins !== undefined && kept.length > 0) {
    const binCount = Math.min(MAX_BINS, Math.max(1, Math.trunc(opts.bins)));
    await fillBins(client, dialect, observations, params, kept, binCount, logarithmic);
  }

  return {
    objectType: opts.objectType,
    measure,
    groupedBy: groupBy.kind,
    unit: measure === 'length' ? 'events' : 'seconds',
    groups: kept,
    omittedGroups: described.length - kept.length,
    logarithmic,
  };
}

/** One row per case: the value, and the group the case belongs to. */
function perCaseObservations(
  dialect: SqlDialect,
  log: string,
  measure: DistributionMeasure,
  groupBy: GroupDimension,
  params: unknown[],
  objectType: string,
  caseAttrsTable: string,
): string {
  const value = measure === 'length' ? 'COUNT(*)' : CASE_CYCLE_SECONDS;

  if (groupBy.kind === 'variant') {
    // The route is the ordered activity sequence, which is what makes two cases
    // the same variant. An unordered concat would merge different routes.
    const path = dialect.stringAgg('activity', VARIANT_SEPARATOR, 'ts, event_id');
    return `SELECT ${path} AS grp, ${value} AS value
            FROM (${log}) v GROUP BY case_id`;
  }

  if (groupBy.kind === 'attribute') {
    // Read from the case-attribute table rather than from the events, because
    // this is one fact about the case. A case carrying no value is grouped
    // under a named bucket rather than dropped: "we do not know the channel for
    // 400 cases" is itself a finding, and silently omitting them would move
    // every other group's median.
    return `SELECT COALESCE(attr_value, ${hole(params, dialect, UNKNOWN_GROUP)}) AS grp, value
            FROM (
              SELECT k.case_id, k.value,
                     (SELECT ca.value FROM ${caseAttrsTable} ca
                      WHERE ca.object_type = ${hole(params, dialect, objectType)}
                        AND ca.object_id = k.case_id
                        AND ca.key = ${hole(params, dialect, groupBy.key)}
                      LIMIT 1) AS attr_value
              FROM (SELECT case_id, ${value} AS value FROM (${log}) a GROUP BY case_id) k
            ) g`;
  }

  return `SELECT ${hole(params, dialect, UNGROUPED)} AS grp, ${value} AS value
          FROM (${log}) c GROUP BY case_id`;
}

/** One row per event: the value, and the group the event belongs to. */
function perEventObservations(
  dialect: SqlDialect,
  log: string,
  measure: DistributionMeasure,
  groupBy: GroupDimension,
  params: unknown[],
): string {
  const stepped = `SELECT activity, resource, duration_s, business_s, case_id,
                          ${PREVIOUS_STEP_LAGS}
                   FROM (${log}) p`;
  const value = measure === 'handling' ? 'duration_s' : waitingSecondsExpr(dialect);

  let group: string;
  if (groupBy.kind === 'activity') group = 'activity';
  else if (groupBy.kind === 'resource') {
    group = perspectiveExpr({ kind: 'resource' }, '', dialect, params);
  } else {
    group = hole(params, dialect, UNGROUPED);
  }

  return `SELECT ${group} AS grp, ${value} AS value FROM (${stepped}) e`;
}

/** Bind a value and return its placeholder. */
function hole(params: unknown[], dialect: SqlDialect, value: unknown): string {
  params.push(value);
  return dialect.placeholder(params.length);
}

/** The label an absent grouping value is filed under. */
const UNKNOWN_GROUP = 'unknown';
/** Matches the variants report, so a route reads the same in both. */
const VARIANT_SEPARATOR = ' → ';

/**
 * Bin each group over ITS OWN range.
 *
 * Deliberate: a ridgeline exists to compare shapes, and a step lasting seconds
 * binned across a range that reaches months collapses into one bar and shows
 * nothing. Comparing positions across rows is not what the chart is for; the
 * axis label carries the scale.
 */
async function fillBins(
  client: SqlClient,
  dialect: SqlDialect,
  observations: string,
  params: unknown[],
  groups: GroupedDistribution[],
  binCount: number,
  logarithmic: boolean,
): Promise<void> {
  const wanted = new Map(groups.map((g) => [g.group, g]));

  // Edges are computed here rather than in SQL so the same arithmetic produces
  // the bucket a value falls in and the bucket reported back.
  const edges = new Map<string, number[]>();
  for (const group of groups) {
    const lo = group.values.min;
    const hi = group.values.max;
    if (lo === null || hi === null) continue;
    edges.set(group.group, binEdges(lo, hi, binCount, logarithmic));
    group.bins = [];
  }

  const { rows } = await client.query(
    `SELECT grp, value FROM (${observations}) o WHERE value IS NOT NULL`,
    params,
  );

  const counts = new Map<string, number[]>();
  for (const row of rows) {
    const key = String(row['grp']);
    const group = wanted.get(key);
    const edge = edges.get(key);
    if (group === undefined || edge === undefined) continue;

    const value = numberOrNull(row['value']);
    if (value === null) continue;
    const tally = counts.get(key) ?? new Array<number>(edge.length - 1).fill(0);
    tally[bucketOf(value, edge)] = (tally[bucketOf(value, edge)] ?? 0) + 1;
    counts.set(key, tally);
  }

  for (const group of groups) {
    const edge = edges.get(group.group);
    const tally = counts.get(group.group);
    if (edge === undefined || tally === undefined) continue;
    group.bins = tally.map((count, i) => ({ from: edge[i]!, to: edge[i + 1]!, count }));
  }
}

/** Bucket edges, geometric or even. Always `binCount + 1` of them. */
export function binEdges(
  lo: number,
  hi: number,
  binCount: number,
  logarithmic: boolean,
): number[] {
  if (hi <= lo) return [lo, lo + 1];

  // Log of a zero or negative duration is undefined, and zero durations are
  // ordinary in a real log. Shifting by one keeps the shape and stays defined.
  const useLog = logarithmic && lo >= 0;
  const shift = useLog ? 1 : 0;
  const from = useLog ? Math.log(lo + shift) : lo;
  const to = useLog ? Math.log(hi + shift) : hi;
  const width = (to - from) / binCount;

  return Array.from({ length: binCount + 1 }, (_, i) => {
    const at = from + width * i;
    return useLog ? Math.exp(at) - shift : at;
  });
}

/** Index of the bucket a value falls in, last bucket inclusive of the top. */
function bucketOf(value: number, edges: number[]): number {
  // Linear scan: bin counts are bounded at 200 and a binary search here would
  // be harder to read for no measurable gain.
  for (let i = 1; i < edges.length; i += 1) {
    if (value < edges[i]!) return i - 1;
  }
  return edges.length - 2;
}

// ---------------------------------------------------------------------------

export interface TraceLengthBucket {
  /** Events in a case. */
  events: number;
  cases: number;
}

export interface TraceLengths {
  objectType: string;
  /** Ascending by length. Every length between the shortest and longest, gaps included. */
  buckets: TraceLengthBucket[];
  distribution: Distribution;
  /**
   * Cases holding exactly one event.
   *
   * Called out because it is usually a data fault rather than a finding: a
   * binding that lost its second source, or a case key that is really an event
   * key. The profiler raises it in words; this is the same fact as a number.
   */
  singleEventCases: number;
}

/**
 * How many steps a case takes.
 *
 * Integer buckets, one per length, rather than a binned histogram — trace
 * lengths are small counts, and binning them hides the spike at one that is the
 * whole reason to look.
 */
export async function traceLengths(
  client: SqlClient,
  dialect: SqlDialect,
  opts: LogQueryOptions,
): Promise<TraceLengths> {
  const params: unknown[] = [];
  const { sql: log } = buildLog(dialect, params, opts);

  const { rows } = await client.query(
    `SELECT events, COUNT(*) AS cases
     FROM (SELECT case_id, COUNT(*) AS events FROM (${log}) c GROUP BY case_id) k
     GROUP BY 1 ORDER BY 1`,
    params,
  );

  const observed = rows.map((row) => ({
    events: countOf(row['events']),
    cases: countOf(row['cases']),
  }));

  if (observed.length === 0) {
    return {
      objectType: opts.objectType,
      buckets: [],
      distribution: EMPTY_DISTRIBUTION,
      singleEventCases: 0,
    };
  }

  // Contiguous: a length nobody produced is a zero, not a missing bar.
  const counts = new Map(observed.map((o) => [o.events, o.cases]));
  const lo = observed[0]!.events;
  const hi = observed[observed.length - 1]!.events;
  const buckets: TraceLengthBucket[] = [];
  for (let events = lo; events <= hi; events += 1) {
    buckets.push({ events, cases: counts.get(events) ?? 0 });
  }

  return {
    objectType: opts.objectType,
    buckets,
    distribution: describeCounts(observed),
    singleEventCases: counts.get(1) ?? 0,
  };
}

const EMPTY_DISTRIBUTION: Distribution = {
  count: 0,
  mean: null,
  p25: null,
  p50: null,
  p75: null,
  p90: null,
  p95: null,
  min: null,
  max: null,
  total: null,
};

/** Describe a weighted set of integer observations without expanding it. */
function describeCounts(observed: readonly TraceLengthBucket[]): Distribution {
  const n = observed.reduce((sum, o) => sum + o.cases, 0);
  if (n === 0) return EMPTY_DISTRIBUTION;

  const total = observed.reduce((sum, o) => sum + o.events * o.cases, 0);
  const at = (q: number): number => {
    // Nearest-rank on the cumulative counts: exact for integer data, and it
    // returns a length that some case actually had.
    const target = Math.min(n, Math.max(1, Math.ceil(q * n)));
    let seen = 0;
    for (const o of observed) {
      seen += o.cases;
      if (seen >= target) return o.events;
    }
    return observed[observed.length - 1]!.events;
  };

  return {
    count: n,
    mean: total / n,
    p25: at(0.25),
    p50: at(0.5),
    p75: at(0.75),
    p90: at(0.9),
    p95: at(0.95),
    min: observed[0]!.events,
    max: observed[observed.length - 1]!.events,
    total,
  };
}
