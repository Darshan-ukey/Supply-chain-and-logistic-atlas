import { countOf, numberOrNull } from '../domain/identifiers.js';
import type { SqlClient } from '../ports/sql.js';
import type { SqlDialect } from '../sql/dialect.js';
import { businessElapsed } from './calendar.js';
import type { Granularity } from './charts.js';
import { eventLogTables } from './eventlog.js';
import {
  CASE_CYCLE_SECONDS,
  buildLog,
  perCaseSql,
  type LogQueryOptions,
} from './logquery.js';
import type { OpenCaseRule } from './signals.js';

/**
 * Where the work is, rather than how fast it moved.
 *
 * Every other view here is retrospective: it reads finished cases and reports
 * what happened to them. An operations lead is asking a different question —
 * how much is in flight, where is it piled up, is the pile growing. A log full
 * of fast cases and a growing backlog is a process that is failing, and no
 * median in this engine would say so.
 *
 * The three views below are the standard ones, and they are standard because
 * they are read correctly on sight by people who have never heard of process
 * mining.
 */

/** How many cases sat at one stage during one interval. */
export interface StageLoad {
  activity: string;
  /** Cases at this stage at the END of the interval. */
  cases: number;
  /** Cases that arrived at this stage during it. */
  entered: number;
  /** Cases that moved on or finished during it. */
  left: number;
}

export interface FlowInterval {
  /** Start of the interval. */
  at: Date;
  /** Stages carrying work, busiest first. Absent stages held nothing. */
  stages: StageLoad[];
  /** Cases in flight anywhere at the end of the interval. */
  wip: number;
  /** Cases that entered the process during it. */
  arrived: number;
  /** Cases that finished during it. */
  completed: number;
}

export interface CumulativeFlow {
  objectType: string;
  granularity: Granularity;
  /** Contiguous — every interval between the first and last event, gaps included. */
  intervals: FlowInterval[];
  /** Every stage seen, so a caller can allocate one band per stage up front. */
  activities: string[];
  /**
   * True when the last interval holds more work than the first.
   *
   * Stated rather than left to the reader, because a rising backlog is the
   * finding this chart exists for and it is easy to miss on a busy picture.
   */
  backlogGrowing: boolean;
}

export interface CumulativeFlowOptions extends LogQueryOptions {
  granularity?: Granularity | undefined;
  /** Cap on stages tracked, busiest first; the rest merge into one band. */
  stageLimit?: number | undefined;
}

const DEFAULT_STAGE_LIMIT = 12;
/** Guard on the returned series. A minute granularity over a year is not a chart. */
export const MAX_INTERVALS = 2000;

/**
 * Work in progress by stage, over time.
 *
 * Built from arrivals and departures rather than by asking "who was here" at
 * every instant. A case occupies a stage from the event that put it there until
 * the event that moved it on, so each of those two moments is counted once and
 * the level is their running difference. That is one GROUP BY instead of a join
 * per bucket, and it is exact rather than sampled.
 *
 * The running sum happens here rather than in the caller deliberately: it needs
 * the intervals contiguous and in order, and a caller who fetches a page of
 * them and sums what arrived would silently produce a level that resets.
 */
export async function cumulativeFlow(
  client: SqlClient,
  dialect: SqlDialect,
  opts: CumulativeFlowOptions,
): Promise<CumulativeFlow> {
  const granularity = opts.granularity ?? 'day';
  const stageLimit = Math.max(1, Math.trunc(opts.stageLimit ?? DEFAULT_STAGE_LIMIT));

  const params: unknown[] = [];
  const { sql: log } = buildLog(dialect, params, opts);

  // A case sits at an activity from this event until the next one.
  //
  // The final event of a case has no successor and is DROPPED, which is the
  // whole correctness of this chart. Kept, it would be an arrival that never
  // departs: every finished case would stay stacked on its last step forever
  // and the picture would show a backlog that is really just history. Every
  // span here is therefore a closed pair, and a case occupies nothing after its
  // last recorded event — which is exactly what `perCaseSql` means by `last_ts`.
  const spans = `SELECT case_id, activity, from_ts, to_ts FROM (
                   SELECT case_id, activity, ts AS from_ts,
                          LEAD(ts) OVER (PARTITION BY case_id ORDER BY ${ORDER}) AS to_ts
                   FROM (${log}) f
                 ) o WHERE to_ts IS NOT NULL`;

  const [{ rows: moves }, { rows: bounds }] = await Promise.all([
    client.query(
      `SELECT activity,
              DATE_TRUNC('${granularity}', from_ts) AS in_bucket,
              DATE_TRUNC('${granularity}', to_ts) AS out_bucket,
              COUNT(*) AS n
       FROM (${spans}) s
       GROUP BY 1, 2, 3`,
      params,
    ),
    client.query(`SELECT MIN(ts) AS lo, MAX(ts) AS hi FROM (${log}) b`, params),
  ]);

  const lo = asDate(bounds[0]?.['lo']);
  const hi = asDate(bounds[0]?.['hi']);
  if (lo === null || hi === null) {
    return {
      objectType: opts.objectType,
      granularity,
      intervals: [],
      activities: [],
      backlogGrowing: false,
    };
  }

  // Busiest stages keep their own band; the rest share one, so a wide process
  // still produces a readable chart instead of forty invisible slivers.
  const volume = new Map<string, number>();
  for (const row of moves) {
    const activity = String(row['activity']);
    volume.set(activity, (volume.get(activity) ?? 0) + countOf(row['n']));
  }
  const ranked = [...volume.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([activity]) => activity);
  const tracked = new Set(ranked.slice(0, stageLimit));
  const activities = [...tracked];
  const hasOther = ranked.length > tracked.size;
  if (hasOther) activities.push(OTHER_STAGE);

  const buckets = bucketRange(lo, hi, granularity);
  const index = new Map(buckets.map((at, i) => [at.getTime(), i]));

  const entered = blank(buckets.length, activities);
  const departed = blank(buckets.length, activities);
  const arrivedAt = new Array(buckets.length).fill(0) as number[];
  const completedAt = new Array(buckets.length).fill(0) as number[];

  for (const row of moves) {
    const raw = String(row['activity']);
    const activity = tracked.has(raw) ? raw : OTHER_STAGE;
    const n = countOf(row['n']);

    const inAt = index.get(asDate(row['in_bucket'])?.getTime() ?? -1);
    if (inAt !== undefined) entered[inAt]![activity] = (entered[inAt]![activity] ?? 0) + n;

    const outDate = asDate(row['out_bucket']);
    if (outDate === null) continue;
    const outAt = index.get(outDate.getTime());
    if (outAt !== undefined) departed[outAt]![activity] = (departed[outAt]![activity] ?? 0) + n;
  }

  // Case-level arrivals and completions, which are not the same as stage moves:
  // a case entering its second step arrived at a stage but not at the process.
  const perCase = perCaseSql(log, dialect);
  const { rows: caseRows } = await client.query(
    `SELECT DATE_TRUNC('${granularity}', first_ts) AS started,
            DATE_TRUNC('${granularity}', last_ts) AS ended,
            COUNT(*) AS n
     FROM (${perCase}) c GROUP BY 1, 2`,
    params,
  );
  for (const row of caseRows) {
    const n = countOf(row['n']);
    const startAt = index.get(asDate(row['started'])?.getTime() ?? -1);
    if (startAt !== undefined) arrivedAt[startAt] = (arrivedAt[startAt] ?? 0) + n;
    const endAt = index.get(asDate(row['ended'])?.getTime() ?? -1);
    if (endAt !== undefined) completedAt[endAt] = (completedAt[endAt] ?? 0) + n;
  }

  const level: Record<string, number> = {};
  for (const activity of activities) level[activity] = 0;

  const intervals: FlowInterval[] = buckets.map((at, i) => {
    for (const activity of activities) {
      level[activity] =
        (level[activity] ?? 0) + (entered[i]![activity] ?? 0) - (departed[i]![activity] ?? 0);
    }
    const stages = activities
      .map((activity) => ({
        activity,
        cases: level[activity] ?? 0,
        entered: entered[i]![activity] ?? 0,
        left: departed[i]![activity] ?? 0,
      }))
      .filter((s) => s.cases !== 0 || s.entered !== 0 || s.left !== 0)
      .sort((a, b) => b.cases - a.cases || a.activity.localeCompare(b.activity));

    return {
      at,
      stages,
      wip: stages.reduce((n, s) => n + s.cases, 0),
      arrived: arrivedAt[i]!,
      completed: completedAt[i]!,
    };
  });

  const first = intervals[0]?.wip ?? 0;
  const last = intervals[intervals.length - 1]?.wip ?? 0;
  return {
    objectType: opts.objectType,
    granularity,
    intervals,
    activities,
    backlogGrowing: last > first,
  };
}

/** The band rare stages merge into, named so a reader knows work is not missing. */
export const OTHER_STAGE = 'other steps';

const ORDER = `ts, event_id`;

function blank(n: number, activities: readonly string[]): Record<string, number>[] {
  return Array.from({ length: n }, () => {
    const row: Record<string, number> = {};
    for (const activity of activities) row[activity] = 0;
    return row;
  });
}

// ---------------------------------------------------------------------------

export interface LittlesLaw {
  objectType: string;
  granularity: Granularity;
  /** Mean cases in flight across the observed intervals. */
  averageWip: number | null;
  /** Mean cases completed per interval. */
  throughputPerInterval: number | null;
  /** Median case cycle time, in intervals, so the three terms are comparable. */
  cycleIntervals: number | null;
  /** throughput x cycle time — what WIP should be if the log is complete. */
  predictedWip: number | null;
  /**
   * Observed WIP divided by predicted, or null when either is unusable.
   *
   * One means the identity holds. Far from one is not a process finding but a
   * DATA finding: the usual cause is a log that starts mid-flight, so cases
   * appear to complete having never arrived.
   */
  ratio: number | null;
  /** Plain statement of what the ratio means, including when it means nothing. */
  reading: string;
}

/**
 * Little's law, checked rather than assumed.
 *
 * WIP = throughput x cycle time holds for any stable queue, whatever its
 * discipline. That makes it a free consistency check on the log: the three
 * quantities are measured independently here, and when they disagree the log is
 * telling you it is incomplete.
 *
 * Reported as a ratio with a sentence rather than a bare pass or fail, because
 * the useful output is "your export is clipped at the left edge", which no
 * boolean conveys.
 */
export async function littlesLaw(
  client: SqlClient,
  dialect: SqlDialect,
  opts: CumulativeFlowOptions,
): Promise<LittlesLaw> {
  const granularity = opts.granularity ?? 'day';
  const flow = await cumulativeFlow(client, dialect, opts);

  const params: unknown[] = [];
  const { sql: log } = buildLog(dialect, params, opts);
  const { rows } = await client.query(
    `SELECT ${dialect.medianOf('cycle_s')} AS median_cycle
     FROM (SELECT case_id, ${CASE_CYCLE_SECONDS} AS cycle_s
           FROM (${log}) c GROUP BY case_id) k`,
    params,
  );

  const medianCycle = numberOrNull(rows[0]?.['median_cycle']);
  const intervals = flow.intervals;
  const seconds = INTERVAL_SECONDS[granularity];

  if (intervals.length === 0 || medianCycle === null) {
    return {
      objectType: opts.objectType,
      granularity,
      averageWip: null,
      throughputPerInterval: null,
      cycleIntervals: null,
      predictedWip: null,
      ratio: null,
      reading: 'not enough of the log is measurable to check the identity',
    };
  }

  const averageWip = intervals.reduce((n, i) => n + i.wip, 0) / intervals.length;
  const throughputPerInterval =
    intervals.reduce((n, i) => n + i.completed, 0) / intervals.length;
  const cycleIntervals = medianCycle / seconds;
  const predictedWip = throughputPerInterval * cycleIntervals;

  const ratio = predictedWip > 0 ? averageWip / predictedWip : null;
  return {
    objectType: opts.objectType,
    granularity,
    averageWip,
    throughputPerInterval,
    cycleIntervals,
    predictedWip,
    ratio,
    reading: readIdentity(ratio),
  };
}

const INTERVAL_SECONDS: Record<Granularity, number> = {
  hour: 3600,
  day: 86_400,
  week: 604_800,
  month: 2_629_800,
};

function readIdentity(ratio: number | null): string {
  if (ratio === null) return 'nothing completed in the window, so the identity cannot be checked';
  if (ratio >= 0.8 && ratio <= 1.25) return 'the identity holds — the log looks complete';
  if (ratio < 0.8) {
    return 'less work in flight than the throughput and cycle time imply — the log probably starts mid-process, so cases appear to finish without having arrived';
  }
  return 'more work in flight than the throughput and cycle time imply — the log probably ends mid-process, so cases appear to arrive without having finished';
}

// ---------------------------------------------------------------------------

export interface AgeBucket {
  /** Inclusive lower bound of the bucket, in seconds. */
  fromSeconds: number;
  /** Exclusive upper bound, or null for the open-ended oldest bucket. */
  toSeconds: number | null;
  label: string;
  cases: number;
  /** Cases here already past the SLA, when one was given. */
  breaching: number;
}

export interface OpenCaseAging {
  objectType: string;
  asOf: Date;
  /** How "open" was decided, stated so the number cannot be read as live truth. */
  openCaseRule: string;
  openCases: number;
  totalCases: number;
  buckets: AgeBucket[];
  /** The oldest open cases, for a click-through. */
  oldest: { caseId: string; ageSeconds: number; lastActivity: string | null }[];
}

export interface AgingOptions extends LogQueryOptions {
  /** How to tell a running case from a finished one. */
  openCases: OpenCaseRule;
  /** Evaluation instant. Injected so a historical run is reproducible. */
  now: Date;
  /** Bucket edges in seconds, ascending. Defaults to 1/3/7/14/30 days. */
  edges?: readonly number[] | undefined;
  /** Age past which a case is breaching. Omitted means no breach column. */
  slaSeconds?: number | undefined;
  /** Cap on the oldest-cases list. Default 20. */
  limit?: number | undefined;
}

const DEFAULT_EDGES = [86_400, 259_200, 604_800, 1_209_600, 2_592_000];
const DEFAULT_OLDEST = 20;

/**
 * Work in flight, bucketed by how long it has been waiting.
 *
 * The morning chart. A healthy process has a fat young bucket and a thin old
 * tail; the reverse is a queue nobody is clearing.
 *
 * Age is measured on whichever clock the analysis uses, so a case untouched
 * since Friday evening is not four days old on a Tuesday morning if the office
 * was shut for two of them.
 */
export async function openCaseAging(
  client: SqlClient,
  dialect: SqlDialect,
  opts: AgingOptions,
): Promise<OpenCaseAging> {
  const edges = [...(opts.edges ?? DEFAULT_EDGES)].sort((a, b) => a - b);
  const limit = Math.max(1, Math.trunc(opts.limit ?? DEFAULT_OLDEST));

  const params: unknown[] = [];
  // Nothing after the evaluation instant may be consulted, or a case looks
  // finished because of an event that had not happened yet.
  const scoped: LogQueryOptions = {
    ...opts,
    window: { ...(opts.window ?? {}), to: opts.now },
  };
  const { sql: log } = buildLog(dialect, params, scoped);
  const perCase = perCaseSql(log, dialect);

  const { rows: totals } = await client.query(
    `SELECT COUNT(*) AS n FROM (${perCase}) t`,
    params,
  );
  const totalCases = countOf(totals[0]?.['n']);

  const open = openPredicate(opts, dialect, params, log);

  // The last activity travels with the case so a bucket can be read as "twelve
  // cases stuck at Credit Check" rather than twelve anonymous rows.
  const lastActivity = `(SELECT activity FROM (${log}) la
                         WHERE la.case_id = pc.case_id
                         ORDER BY ts DESC, event_id DESC LIMIT 1)`;

  const age =
    opts.calendar === undefined
      ? dialect.durationSeconds('pc.last_ts', dialect.timestampPlaceholder(pushNow(dialect, params, opts.now)))
      : `(${dialect.placeholder(pushNumber(params, businessElapsed(opts.now, opts.calendar)))} - pc.last_business_s)`;

  const { rows } = await client.query(
    `SELECT pc.case_id, ${age} AS age_s, ${lastActivity} AS last_activity
     FROM (${perCase}) pc
     WHERE ${open}
     ORDER BY age_s DESC`,
    params,
  );

  const buckets = edgeBuckets(edges).map((b) => ({ ...b, cases: 0, breaching: 0 }));
  const oldest: OpenCaseAging['oldest'] = [];

  for (const row of rows) {
    const ageSeconds = numberOrNull(row['age_s']) ?? 0;
    // A negative age means the case's last event is after `now`, which is
    // outside the horizon rather than a case aged below zero.
    if (ageSeconds < 0) continue;

    const bucket = buckets.find(
      (b) => ageSeconds >= b.fromSeconds && (b.toSeconds === null || ageSeconds < b.toSeconds),
    );
    if (bucket !== undefined) {
      bucket.cases += 1;
      if (opts.slaSeconds !== undefined && ageSeconds >= opts.slaSeconds) bucket.breaching += 1;
    }
    if (oldest.length < limit) {
      const activity = row['last_activity'];
      oldest.push({
        caseId: String(row['case_id']),
        ageSeconds,
        lastActivity: activity === null || activity === undefined ? null : String(activity),
      });
    }
  }

  return {
    objectType: opts.objectType,
    asOf: opts.now,
    openCaseRule: describeOpenRule(opts.openCases),
    openCases: buckets.reduce((n, b) => n + b.cases, 0),
    totalCases,
    buckets,
    oldest,
  };
}

function pushNow(dialect: SqlDialect, params: unknown[], now: Date): number {
  params.push(dialect.timestampParam(now));
  return params.length;
}

function pushNumber(params: unknown[], value: number): number {
  params.push(value);
  return params.length;
}

/** The open-case predicate, over an alias `pc` holding the per-case summary. */
function openPredicate(
  opts: AgingOptions,
  dialect: SqlDialect,
  params: unknown[],
  log: string,
): string {
  const rule = opts.openCases;
  if (rule.kind === 'all') return 'TRUE';

  if (rule.kind === 'missing-end-activity') {
    const holes = rule.endActivities.map((a) => {
      params.push(a);
      return dialect.placeholder(params.length);
    });
    // The windowed log, not the raw events table: the window ends at `now`, so
    // an end activity performed tomorrow must not close this case today.
    return `NOT EXISTS (
      SELECT 1 FROM (${log}) le
      WHERE le.case_id = pc.case_id AND le.activity IN (${holes.join(', ')}))`;
  }

  const within = Number(rule.withinSeconds);
  if (opts.calendar === undefined) {
    params.push(dialect.timestampParam(opts.now));
    const nowHole = dialect.timestampPlaceholder(params.length);
    const age = dialect.durationSeconds('pc.last_ts', nowHole);
    return `${age} >= 0 AND ${age} <= ${within}`;
  }
  params.push(businessElapsed(opts.now, opts.calendar));
  const age = `(${dialect.placeholder(params.length)} - pc.last_business_s)`;
  return `${age} >= 0 AND ${age} <= ${within}`;
}

function describeOpenRule(rule: OpenCaseRule): string {
  switch (rule.kind) {
    case 'all':
      return 'every case treated as open';
    case 'missing-end-activity':
      return `open until one of: ${rule.endActivities.join(', ')}`;
    case 'recent-activity':
      return `open if touched within ${rule.withinSeconds}s`;
  }
}

function edgeBuckets(edges: readonly number[]): Omit<AgeBucket, 'cases' | 'breaching'>[] {
  const buckets: Omit<AgeBucket, 'cases' | 'breaching'>[] = [];
  let from = 0;
  for (const edge of edges) {
    buckets.push({ fromSeconds: from, toSeconds: edge, label: spanLabel(from, edge) });
    from = edge;
  }
  buckets.push({ fromSeconds: from, toSeconds: null, label: `${roundDays(from)}+ days` });
  return buckets;
}

function spanLabel(from: number, to: number): string {
  return from === 0 ? `under ${roundDays(to)} day${to === 86_400 ? '' : 's'}` : `${roundDays(from)}-${roundDays(to)} days`;
}

function roundDays(seconds: number): number {
  return Math.round((seconds / 86_400) * 10) / 10;
}

function asDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (typeof value === 'string') {
    const ms = Date.parse(value);
    return Number.isNaN(ms) ? null : new Date(ms);
  }
  return null;
}

/**
 * Every bucket start between two instants, contiguous.
 *
 * Contiguity is the point. A gap in the data is a real quiet period and must
 * appear as one, not be closed up so the chart reads as continuous work.
 */
export function bucketRange(from: Date, to: Date, granularity: Granularity): Date[] {
  const buckets: Date[] = [];
  let at = truncate(from, granularity);
  const end = truncate(to, granularity);
  while (at.getTime() <= end.getTime() && buckets.length < MAX_INTERVALS) {
    buckets.push(at);
    at = step(at, granularity);
  }
  return buckets;
}

/** UTC truncation, matching what DATE_TRUNC produced on the same instants. */
function truncate(at: Date, granularity: Granularity): Date {
  const d = new Date(at.getTime());
  d.setUTCMilliseconds(0);
  d.setUTCSeconds(0);
  d.setUTCMinutes(0);
  if (granularity === 'hour') return d;
  d.setUTCHours(0);
  if (granularity === 'day') return d;
  if (granularity === 'week') {
    // Monday, matching DATE_TRUNC('week') in both dialects.
    const weekday = (d.getUTCDay() + 6) % 7;
    d.setUTCDate(d.getUTCDate() - weekday);
    return d;
  }
  d.setUTCDate(1);
  return d;
}

function step(at: Date, granularity: Granularity): Date {
  const d = new Date(at.getTime());
  if (granularity === 'hour') d.setUTCHours(d.getUTCHours() + 1);
  else if (granularity === 'day') d.setUTCDate(d.getUTCDate() + 1);
  else if (granularity === 'week') d.setUTCDate(d.getUTCDate() + 7);
  else d.setUTCMonth(d.getUTCMonth() + 1);
  return d;
}
