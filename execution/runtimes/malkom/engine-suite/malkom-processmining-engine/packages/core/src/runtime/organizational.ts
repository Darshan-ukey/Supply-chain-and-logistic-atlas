import { PerspectiveUnavailableError } from '../domain/errors.js';
import { countOf, numberOrNull } from '../domain/identifiers.js';
import type { SqlClient } from '../ports/sql.js';
import type { SqlDialect } from '../sql/dialect.js';
import type { CaseFilter } from './filter.js';
import { buildLog, waitingSecondsExpr } from './logquery.js';
import type { LogCapabilities, Perspective } from './eventlog.js';
import type { BusinessCalendar } from './calendar.js';

/**
 * The organizational perspective: who does the work, and where it changes hands.
 *
 * Two findings come out of this that a process map alone cannot show. The
 * first is **handovers** — every time a case moves between people it waits,
 * and a path with six handovers is slow for reasons no amount of individual
 * speed will fix. The second is **specialisation** — whether a team is a set
 * of interchangeable generalists or a set of single points of failure.
 *
 * If no resource is mapped, this refuses rather than returning empty results
 * that read like "nobody did anything".
 */

export interface OrganizationalOptions {
  objectType: string;
  schema?: string | undefined;
  window?: { from?: Date | undefined; to?: Date | undefined } | undefined;
  lifecycle?: readonly string[] | undefined;
  /** Restrict to whole CASES matching this selection. */
  filter?: CaseFilter | undefined;
  /** Step, person, or an event attribute — what goes in the boxes. */
  perspective?: Perspective | undefined;
  /** Probe with detectCapabilities; omitting it projects absent columns as NULL. */
  capabilities?: LogCapabilities | undefined;
  /**
   * Measure durations in working time rather than wall-clock. See
   * `LogQueryOptions.calendar`; off by default, and every figure here is the
   * wall-clock one without it.
   */
  calendar?: BusinessCalendar | undefined;
  /** Handover pairs to return, busiest first. Default 100. */
  handoverLimit?: number;
}

export interface ResourceProfile {
  resource: string;
  events: number;
  cases: number;
  distinctActivities: number;
  /** Share of all events in the log this person handled, 0–1. */
  workloadShare: number;
  medianHandlingSeconds: number | null;
  totalHandlingSeconds: number | null;
  /** The activity they do most, and how much of their work it is. */
  primaryActivity: string | null;
  primaryActivityShare: number;
  /**
   * 0 = does one thing only, 1 = spread evenly across everything they touch.
   * Normalised entropy, so it can be compared between people who work on
   * different numbers of activity types.
   */
  specialisation: number;
}

export interface Handover {
  from: string;
  to: string;
  /** Times work passed from one to the other. */
  count: number;
  cases: number;
  /** Median idle time across the handover — what the handover actually costs. */
  medianWaitSeconds: number | null;
  totalWaitSeconds: number | null;
}

export interface ActivityOwnership {
  activity: string;
  events: number;
  distinctResources: number;
  /** Share handled by the single busiest person, 0–1. */
  topResourceShare: number;
  topResource: string | null;
  /** True when one person handles nearly all of it — a key-person risk. */
  singlePointOfFailure: boolean;
}

export interface OrganizationalReport {
  objectType: string;
  resourceCount: number;
  eventCount: number;
  resources: ResourceProfile[];
  handovers: Handover[];
  activityOwnership: ActivityOwnership[];
  /** Handovers per case — the blunt measure of how fragmented the work is. */
  medianHandoversPerCase: number | null;
  /** Cases handled start to finish by one person. */
  singleHandlerCases: number;
  /** Events with no resource recorded; they are excluded from every figure above. */
  unattributedEvents: number;
}

const ORDER = `ts, CASE lower(COALESCE(lifecycle, ''))
    WHEN 'schedule' THEN 0 WHEN 'assign' THEN 1 WHEN 'start' THEN 2
    WHEN '' THEN 3 WHEN 'complete' THEN 4 ELSE 5 END, event_id`;

const DEFAULT_HANDOVER_LIMIT = 100;
/** Above this share, one person effectively owns an activity outright. */
const SINGLE_POINT_THRESHOLD = 0.9;

export async function analyseOrganizational(
  client: SqlClient,
  dialect: SqlDialect,
  opts: OrganizationalOptions,
): Promise<OrganizationalReport> {
  const handoverLimit = opts.handoverLimit ?? DEFAULT_HANDOVER_LIMIT;

  const params: unknown[] = [];
  const { sql: log } = buildLog(dialect, params, opts);

  // Refuse before computing. Returning empty tables here would read as "the
  // team did nothing", which is a different and much worse claim than "this
  // log does not say who did the work".
  const presence = await client.query(
    `SELECT COUNT(*) AS events, COUNT(resource) AS attributed FROM (${log}) p`,
    params,
  );
  const eventCount = countOf(presence.rows[0]?.['events']);
  const attributed = countOf(presence.rows[0]?.['attributed']);
  if (attributed === 0) {
    throw new PerspectiveUnavailableError(
      'organizational',
      eventCount === 0
        ? 'the log is empty'
        : `none of the ${eventCount.toLocaleString()} events records who performed the work`,
      [
        'map roles.resource to the column naming the person or system that performed each step',
        'if the source genuinely does not record it, this perspective cannot be produced from this data',
      ],
    );
  }

  const attributedLog = `SELECT * FROM (${log}) r WHERE r.resource IS NOT NULL`;

  const stepped = `
    SELECT case_id, activity, resource, ts, duration_s, business_s,
           LAG(resource)    OVER (PARTITION BY case_id ORDER BY ${ORDER}) AS prev_resource,
           LAG(business_s)  OVER (PARTITION BY case_id ORDER BY ${ORDER}) AS prev_business_s,
           LAG(duration_s)  OVER (PARTITION BY case_id ORDER BY ${ORDER}) AS prev_duration
    FROM (${attributedLog}) s`;

  // The same definition of waiting the bottleneck ranking uses, rather than a
  // second one: a handover delay and the step delay it is made of must agree.
  const handoverWait = `COALESCE(${waitingSecondsExpr(dialect)}, 0)`;

  const [resourceRows, pairRows, handoverRows, ownershipRows, perCaseRows] = await Promise.all([
    client.query(
      `SELECT resource,
              COUNT(*) AS events,
              COUNT(DISTINCT case_id) AS cases,
              COUNT(DISTINCT activity) AS activities,
              ${dialect.medianOf('duration_s')} AS median_handling,
              SUM(duration_s) AS total_handling
       FROM (${attributedLog}) a GROUP BY resource`,
      params,
    ),
    // Per-resource activity mix, for specialisation and primary activity.
    client.query(
      `SELECT resource, activity, COUNT(*) AS events
       FROM (${attributedLog}) a GROUP BY resource, activity`,
      params,
    ),
    client.query(
      `SELECT prev_resource AS from_r, resource AS to_r,
              COUNT(*) AS count,
              COUNT(DISTINCT case_id) AS cases,
              ${dialect.medianOf(handoverWait)} AS median_wait,
              SUM(${handoverWait}) AS total_wait
       FROM (${stepped}) h
       WHERE prev_resource IS NOT NULL AND prev_resource <> resource
       GROUP BY 1, 2 ORDER BY count DESC LIMIT ${Math.max(1, handoverLimit)}`,
      params,
    ),
    client.query(
      `SELECT activity,
              SUM(events) AS events,
              COUNT(*) AS distinct_resources,
              MAX(events) AS top_events,
              ${dialect.stringAgg('resource', String.fromCharCode(31), 'events DESC, resource ASC')} AS ranked
       FROM (SELECT activity, resource, COUNT(*) AS events
             FROM (${attributedLog}) a GROUP BY activity, resource) per
       GROUP BY activity`,
      params,
    ),
    client.query(
      `SELECT ${dialect.medianOf('handovers')} AS median_handovers,
              COUNT(*) FILTER (WHERE distinct_resources = 1) AS single_handler
       FROM (
         SELECT case_id,
                COUNT(DISTINCT resource) AS distinct_resources,
                SUM(CASE WHEN prev_resource IS NOT NULL AND prev_resource <> resource THEN 1 ELSE 0 END) AS handovers
         FROM (${stepped}) c GROUP BY case_id
       ) pc`,
      params,
    ),
  ]);

  // Activity mix per resource, used for both primary activity and entropy.
  const mix = new Map<string, { activity: string; events: number }[]>();
  for (const r of pairRows.rows) {
    const resource = String(r['resource']);
    const list = mix.get(resource) ?? [];
    list.push({ activity: String(r['activity']), events: countOf(r['events']) });
    mix.set(resource, list);
  }

  const totalAttributed = attributed;
  const resources: ResourceProfile[] = resourceRows.rows
    .map((r) => {
      const resource = String(r['resource']);
      const events = countOf(r['events']);
      const own = (mix.get(resource) ?? []).sort((a, b) => b.events - a.events);
      const top = own[0];
      return {
        resource,
        events,
        cases: countOf(r['cases']),
        distinctActivities: countOf(r['activities']),
        workloadShare: totalAttributed > 0 ? events / totalAttributed : 0,
        medianHandlingSeconds: numberOrNull(r['median_handling']),
        totalHandlingSeconds: numberOrNull(r['total_handling']),
        primaryActivity: top?.activity ?? null,
        primaryActivityShare: top !== undefined && events > 0 ? top.events / events : 0,
        specialisation: normalisedEntropy(own.map((o) => o.events)),
      };
    })
    .sort((a, b) => b.events - a.events);

  const handovers: Handover[] = handoverRows.rows.map((r) => ({
    from: String(r['from_r']),
    to: String(r['to_r']),
    count: countOf(r['count']),
    cases: countOf(r['cases']),
    medianWaitSeconds: numberOrNull(r['median_wait']),
    totalWaitSeconds: numberOrNull(r['total_wait']),
  }));

  const activityOwnership: ActivityOwnership[] = ownershipRows.rows
    .map((r) => {
      const events = countOf(r['events']);
      const topEvents = countOf(r['top_events']);
      const ranked = String(r['ranked'] ?? '').split(String.fromCharCode(31));
      const share = events > 0 ? topEvents / events : 0;
      return {
        activity: String(r['activity']),
        events,
        distinctResources: countOf(r['distinct_resources']),
        topResourceShare: share,
        topResource: ranked[0] ?? null,
        singlePointOfFailure: share >= SINGLE_POINT_THRESHOLD && events > 1,
      };
    })
    .sort((a, b) => b.events - a.events);

  const perCase = perCaseRows.rows[0] ?? {};

  return {
    objectType: opts.objectType,
    resourceCount: resources.length,
    eventCount,
    resources,
    handovers,
    activityOwnership,
    medianHandoversPerCase: numberOrNull(perCase['median_handovers']),
    singleHandlerCases: countOf(perCase['single_handler']),
    unattributedEvents: eventCount - attributed,
  };
}

/**
 * Shannon entropy over a work mix, normalised to 0–1.
 *
 * Raw entropy grows with the number of categories, so a person doing three
 * things evenly would score higher than one doing two things evenly and look
 * "more generalist" for no real reason. Dividing by log(n) removes that, and
 * makes two people comparable even when they touch different parts of the
 * process.
 */
export function normalisedEntropy(counts: readonly number[]): number {
  const total = counts.reduce((s, c) => s + c, 0);
  if (total <= 0 || counts.length <= 1) return 0;
  let entropy = 0;
  for (const c of counts) {
    if (c <= 0) continue;
    const p = c / total;
    entropy -= p * Math.log(p);
  }
  return entropy / Math.log(counts.length);
}
