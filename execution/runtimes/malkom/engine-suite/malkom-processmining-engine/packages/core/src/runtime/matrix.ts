import { countOf } from '../domain/identifiers.js';
import type { SqlClient } from '../ports/sql.js';
import type { SqlDialect } from '../sql/dialect.js';
import { buildLog, type LogQueryOptions } from './logquery.js';

/**
 * Two grids, both answering questions a ranked list cannot.
 *
 * A list of activities by rework rate says which step repeats most. It does not
 * say whether that step repeats twice or eleven times, and those call for
 * opposite responses: a step that always runs twice is a two-pass design nobody
 * wrote down, and a step with a long tail of repeats is one that never
 * converges. Same rate, different problem.
 *
 * A list of people by workload says who is busy. It does not say who is the
 * only person who can do something, which is the finding that survives contact
 * with a holiday roster.
 */

export interface RepeatCell {
  activity: string;
  /** How many times the activity ran in one case. Always 1 or more. */
  runs: number;
  cases: number;
}

export interface RepeatMatrix {
  objectType: string;
  /** Activities carrying any repetition at all, worst first. */
  activities: RepeatActivity[];
  cells: RepeatCell[];
  /** Highest run count anywhere, so a caller can size the axis. */
  maxRuns: number;
}

export interface RepeatActivity {
  activity: string;
  cases: number;
  /** Cases where it ran more than once. */
  repeatedIn: number;
  /** Most times it ran within a single case. */
  maxRuns: number;
  /**
   * What the row's shape means, in words.
   *
   * A tight cluster at two and a long thin tail are different findings that
   * look similar in a summary statistic, and the distinction is the point of
   * the chart.
   */
  reading: string;
}

export interface RepeatMatrixOptions extends LogQueryOptions {
  /** Activities returned, most repetition first. Default 40. */
  limit?: number | undefined;
  /** Runs above this are gathered into the top row rather than widening the grid. */
  maxRuns?: number | undefined;
}

const DEFAULT_ACTIVITY_LIMIT = 40;
const DEFAULT_MAX_RUNS = 20;

/**
 * How many times each step ran, within one case.
 *
 * A row is a distribution, not a number: read across it and a step that always
 * runs exactly twice looks nothing like a step that usually runs once and
 * occasionally eleven times.
 */
export async function repeatMatrix(
  client: SqlClient,
  dialect: SqlDialect,
  opts: RepeatMatrixOptions,
): Promise<RepeatMatrix> {
  const limit = Math.max(1, Math.trunc(opts.limit ?? DEFAULT_ACTIVITY_LIMIT));
  const cap = Math.max(2, Math.trunc(opts.maxRuns ?? DEFAULT_MAX_RUNS));

  const params: unknown[] = [];
  const { sql: log } = buildLog(dialect, params, opts);

  // Runs above the cap are folded into the top row rather than dropped: a case
  // that ran a step forty times is the most interesting row on the chart, and
  // widening the grid to forty columns to show it makes the rest unreadable.
  const perCase = `SELECT activity, case_id, LEAST(COUNT(*), ${cap}) AS runs
                   FROM (${log}) r GROUP BY activity, case_id`;

  const { rows } = await client.query(
    `SELECT activity, runs, COUNT(*) AS cases FROM (${perCase}) p GROUP BY 1, 2`,
    params,
  );

  const cells = rows.map((row) => ({
    activity: String(row['activity']),
    runs: countOf(row['runs']),
    cases: countOf(row['cases']),
  }));

  const byActivity = new Map<string, RepeatCell[]>();
  for (const cell of cells) {
    const list = byActivity.get(cell.activity) ?? [];
    list.push(cell);
    byActivity.set(cell.activity, list);
  }

  const activities: RepeatActivity[] = [...byActivity.entries()]
    .map(([activity, own]) => {
      const cases = own.reduce((n, c) => n + c.cases, 0);
      const repeatedIn = own.filter((c) => c.runs > 1).reduce((n, c) => n + c.cases, 0);
      const maxRuns = own.reduce((n, c) => Math.max(n, c.runs), 0);
      return {
        activity,
        cases,
        repeatedIn,
        maxRuns,
        reading: readRow(own, cases, repeatedIn, maxRuns, cap),
      };
    })
    .sort((a, b) => b.repeatedIn - a.repeatedIn || a.activity.localeCompare(b.activity))
    .slice(0, limit);

  const kept = new Set(activities.map((a) => a.activity));
  return {
    objectType: opts.objectType,
    activities,
    cells: cells
      .filter((c) => kept.has(c.activity))
      .sort((a, b) => a.activity.localeCompare(b.activity) || a.runs - b.runs),
    maxRuns: cells.reduce((n, c) => Math.max(n, c.runs), 0),
  };
}

function readRow(
  cells: readonly RepeatCell[],
  cases: number,
  repeatedIn: number,
  maxRuns: number,
  cap: number,
): string {
  if (repeatedIn === 0) return 'never repeats';

  const twice = cells.find((c) => c.runs === 2)?.cases ?? 0;
  const share = repeatedIn / cases;

  // Nearly always exactly twice: this is a design, not a failure. Somebody
  // built a two-pass step and it was never written down as one.
  if (twice / repeatedIn > 0.9 && share > 0.5) {
    return 'runs twice in most cases — that is a two-pass step, not rework';
  }
  if (maxRuns >= cap) {
    return `a long tail, reaching ${cap} runs or more in one case — this step does not converge`;
  }
  if (maxRuns >= 4) {
    return `usually once, but reaching ${maxRuns} runs — the tail is where the cost is`;
  }
  return `repeats in ${Math.round(share * 100)}% of cases`;
}

// ---------------------------------------------------------------------------

export interface SkillCell {
  resource: string;
  activity: string;
  events: number;
  cases: number;
}

export interface ActivityCover {
  activity: string;
  /** People who have ever performed it. */
  people: number;
  events: number;
  /**
   * The only person who does it, when there is exactly one.
   *
   * The finding this grid exists for. A step one person can do is a step that
   * stops when they are on holiday, and no workload chart shows it.
   */
  soleOwner: string | null;
  /** Share of the activity done by its busiest person, 0-1. */
  concentration: number;
}

export interface SkillMatrix {
  objectType: string;
  /** People, busiest first. */
  resources: { resource: string; events: number; activities: number }[];
  /** Activities, most concentrated first — the ones at risk lead. */
  activities: ActivityCover[];
  /** Sparse: only the pairs that actually occurred. */
  cells: SkillCell[];
  /** Activities exactly one person performs. */
  singlePersonActivities: number;
}

export interface SkillMatrixOptions extends LogQueryOptions {
  /** People returned, busiest first. Default 60. */
  limit?: number | undefined;
}

const DEFAULT_PEOPLE_LIMIT = 60;

/**
 * Who does what, and who is the only one who can.
 *
 * Sparse rather than dense: people times activities is mostly empty in any real
 * organisation, and an absent cell plainly means "never did this".
 */
export async function skillMatrix(
  client: SqlClient,
  dialect: SqlDialect,
  opts: SkillMatrixOptions,
): Promise<SkillMatrix> {
  const limit = Math.max(1, Math.trunc(opts.limit ?? DEFAULT_PEOPLE_LIMIT));

  const params: unknown[] = [];
  const { sql: log } = buildLog(dialect, params, opts);

  // Unattributed events are dropped rather than filed under a placeholder: this
  // grid is a statement about named people, and an "unknown" column would be
  // read as a person who can do everything.
  const { rows } = await client.query(
    `SELECT resource, activity, COUNT(*) AS events, COUNT(DISTINCT case_id) AS cases
     FROM (${log}) s WHERE resource IS NOT NULL
     GROUP BY 1, 2`,
    params,
  );

  const cells = rows.map((row) => ({
    resource: String(row['resource']),
    activity: String(row['activity']),
    events: countOf(row['events']),
    cases: countOf(row['cases']),
  }));

  const perPerson = new Map<string, { events: number; activities: number }>();
  const perActivity = new Map<string, SkillCell[]>();
  for (const cell of cells) {
    const person = perPerson.get(cell.resource) ?? { events: 0, activities: 0 };
    person.events += cell.events;
    person.activities += 1;
    perPerson.set(cell.resource, person);

    const list = perActivity.get(cell.activity) ?? [];
    list.push(cell);
    perActivity.set(cell.activity, list);
  }

  const resources = [...perPerson.entries()]
    .map(([resource, own]) => ({ resource, ...own }))
    .sort((a, b) => b.events - a.events || a.resource.localeCompare(b.resource))
    .slice(0, limit);

  const activities: ActivityCover[] = [...perActivity.entries()]
    .map(([activity, own]) => {
      const events = own.reduce((n, c) => n + c.events, 0);
      const busiest = own.reduce((best, c) => (c.events > best.events ? c : best), own[0]!);
      return {
        activity,
        people: own.length,
        events,
        soleOwner: own.length === 1 ? own[0]!.resource : null,
        concentration: events === 0 ? 0 : busiest.events / events,
      };
    })
    .sort((a, b) => b.concentration - a.concentration || a.activity.localeCompare(b.activity));

  const kept = new Set(resources.map((r) => r.resource));
  return {
    objectType: opts.objectType,
    resources,
    activities,
    cells: cells.filter((c) => kept.has(c.resource)),
    singlePersonActivities: activities.filter((a) => a.soleOwner !== null).length,
  };
}
