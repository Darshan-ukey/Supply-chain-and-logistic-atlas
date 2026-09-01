import { PerspectiveUnavailableError } from '../domain/errors.js';
import { countOf } from '../domain/identifiers.js';
import type { SqlClient } from '../ports/sql.js';
import type { SqlDialect } from '../sql/dialect.js';
import type { CaseFilter } from './filter.js';
import { buildLog } from './logquery.js';
import type { LogCapabilities } from './eventlog.js';
import type { BusinessCalendar } from './calendar.js';
import { agglomerate, cosineDistance, unitVector } from './vectors.js';

/**
 * The rest of the team picture.
 *
 * The organizational report answers who is busy and where work changes hands.
 * Three questions it does not answer are the ones that describe a team rather
 * than a workload, and each finds something an org chart does not record:
 *
 *   works alongside   who turns up on the same piece of work as whom. This is
 *                     the informal team — the people who in practice get
 *                     things done together, whatever the reporting lines say.
 *   delegates         who hands work to somebody and gets it back. A handover
 *                     is a transfer; this is a round trip, and a round trip is
 *                     a supervision or an escalation relationship.
 *   does alike        who does the same MIX of work as whom. Group those and
 *                     you have discovered the roles, from behaviour rather
 *                     than from a job title nobody has updated since 2019.
 *
 * Split from `organizational.ts` deliberately. That module already issues five
 * queries and every caller of it pays for all of them; these three are a
 * different question with a different cost profile, and a workbench panel that
 * wants a workload table should not be made to compute a similarity matrix to
 * get one.
 *
 * ## Where the work happens
 *
 * Counting stays in the database — it is O(events) and the events are there.
 * The similarity arithmetic runs here, on a matrix of at most `limit` people
 * by however many activities they touch, because at that size it is a few
 * hundred microseconds and moving it into SQL would mean a self-join per
 * feature. The dividing line throughout is: aggregate where the rows are,
 * compute where the aggregates are.
 *
 * ## Why everything is capped by headcount first
 *
 * Two of the three are pairwise, so cost is quadratic in the number of people.
 * Restricting to the busiest `limit` before any pairing bounds the work at
 * limit²/2 per case no matter how the log is shaped — including the case of a
 * badly chosen case notion that puts four hundred people on one "case". It is
 * also what keeps the answer readable: a network of four hundred nodes is a
 * hairball nobody has ever drawn a conclusion from. The cap is reported, never
 * silent.
 */

export interface TeamOptions {
  objectType: string;
  schema?: string | undefined;
  window?: { from?: Date | undefined; to?: Date | undefined } | undefined;
  lifecycle?: readonly string[] | undefined;
  filter?: CaseFilter | undefined;
  capabilities?: LogCapabilities | undefined;
  calendar?: BusinessCalendar | undefined;
  /** People considered, busiest first. Default 40, hard ceiling 200. */
  limit?: number;
  /** Roles to group people into. Default 0, meaning "decide from the data". */
  roles?: number;
  /**
   * Pairs below this similarity are not reported as doing alike. Default 0.6.
   *
   * A threshold rather than a top-N: on a team where everybody does everything
   * the honest answer is "they are all alike", and on a team of specialists it
   * is "nobody is". A fixed list length would invent structure in the second
   * case and hide it in the first.
   */
  minSimilarity?: number;
}

/** Two people who appear on the same pieces of work. */
export interface WorksAlongside {
  a: string;
  b: string;
  /** Pieces of work both touched. */
  cases: number;
  /**
   * Cases together as a share of cases either touched — the Jaccard index.
   *
   * Reported beside the raw count because the raw count ranks the two busiest
   * people top whether or not they have anything to do with each other. The
   * ratio is what says "these two work together", as opposed to "these two are
   * both busy".
   */
  affinity: number;
}

/** Somebody handed work on and got it back. */
export interface Delegation {
  from: string;
  to: string;
  /** Times the round trip happened. */
  count: number;
  cases: number;
  /** Share of `from`'s handovers to `to` that came back. */
  returnRate: number;
}

/** Two people whose mix of work looks the same. */
export interface DoesAlike {
  a: string;
  b: string;
  /** 1 = identical mix, 0 = no overlap at all. */
  similarity: number;
}

/** A group of people discovered from what they do, not from a job title. */
export interface DiscoveredRole {
  id: number;
  members: string[];
  /** The activities that characterise this group, most distinctive first. */
  signature: { activity: string; share: number }[];
  events: number;
  /**
   * How alike the members are, 0–1.
   *
   * A role of one is 1 by definition and says nothing; the field is only
   * meaningful from two members up, and a caller showing it should say so.
   */
  cohesion: number;
}

export interface TeamNetwork {
  objectType: string;
  /** People considered after the cap. */
  people: { resource: string; events: number; cases: number }[];
  /** People left out by the cap. 0 means the whole team is in the answer. */
  omittedPeople: number;
  worksAlongside: WorksAlongside[];
  delegations: Delegation[];
  doesAlike: DoesAlike[];
  roles: DiscoveredRole[];
  /** Plain-language summary of what the network looks like. */
  reading: string;
}

const DEFAULT_LIMIT = 40;
const MAX_LIMIT = 200;
const DEFAULT_MIN_SIMILARITY = 0.6;
/** Pairs returned per relation. Beyond this a network is not read, it is scrolled. */
const PAIR_LIMIT = 200;

/**
 * The event order every organizational analysis agrees on.
 *
 * Copied in shape from `organizational.ts` rather than imported, because it is
 * a private detail of how that module orders its window functions and exporting
 * it would make an internal ordering choice part of the module's contract.
 * Both must stay in step; a test pins the delegation counts against the
 * handover counts, which is what would catch it if they drifted.
 */
const ORDER = `ts, CASE lower(COALESCE(lifecycle, ''))
    WHEN 'schedule' THEN 0 WHEN 'assign' THEN 1 WHEN 'start' THEN 2
    WHEN '' THEN 3 WHEN 'complete' THEN 4 ELSE 5 END, event_id`;

export async function analyseTeam(
  client: SqlClient,
  dialect: SqlDialect,
  opts: TeamOptions,
): Promise<TeamNetwork> {
  const limit = Math.min(MAX_LIMIT, Math.max(2, Math.trunc(opts.limit ?? DEFAULT_LIMIT)));
  const minSimilarity = Math.min(1, Math.max(0, opts.minSimilarity ?? DEFAULT_MIN_SIMILARITY));

  const params: unknown[] = [];
  const { sql: log } = buildLog(dialect, params, opts);
  const attributed = `SELECT * FROM (${log}) r WHERE r.resource IS NOT NULL`;

  /*
   * Rank once, in SQL, and reuse the ranking everywhere below.
   *
   * `kept` is referenced by three later queries rather than being fetched and
   * sent back as a list of names: it keeps the cap and the analyses provably
   * consistent, and it avoids building an IN list whose length varies with the
   * data. DuckDB inlines the CTE, so this costs one aggregate rather than one
   * per use.
   */
  const roster = `
    SELECT resource,
           COUNT(*) AS events,
           COUNT(DISTINCT case_id) AS cases,
           ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC, resource) AS rank
    FROM (${attributed}) a
    GROUP BY resource`;
  const kept = `SELECT resource, events, cases FROM (${roster}) ranked WHERE rank <= ${limit}`;
  /*
   * Membership as a semi-join, not an inner join.
   *
   * `IN (SELECT …)` cannot multiply rows however the subquery is shaped, so
   * the counts below are structurally guaranteed to be counts of events rather
   * than of event-times-matches. An inner join to `kept` gives the same answer
   * only because the roster is grouped; a semi-join gives it because it cannot
   * give anything else. DuckDB plans it as a mark join, so it is no slower.
   */
  const inTeam = (column: string): string => `${column} IN (SELECT resource FROM (${kept}) m)`;

  const peopleRows = await client.query(
    `SELECT resource, events, cases, (SELECT COUNT(*) FROM (${roster}) all_r) AS total
     FROM (${kept}) k ORDER BY events DESC, resource`,
    params,
  );

  if (peopleRows.rows.length === 0) {
    throw new PerspectiveUnavailableError(
      'organizational',
      'no event in this selection records who performed the work',
      [
        'map roles.resource to the column naming the person or system that performed each step',
        'if the source genuinely does not record it, a team picture cannot be produced from this data',
      ],
    );
  }

  const people = peopleRows.rows.map((r) => ({
    resource: String(r['resource']),
    events: countOf(r['events']),
    cases: countOf(r['cases']),
  }));
  const omittedPeople = Math.max(0, countOf(peopleRows.rows[0]?.['total']) - people.length);
  const casesOf = new Map(people.map((p) => [p.resource, p.cases]));

  // One pass with LAG and LEAD rather than a self-join on positions. The sort
  // is needed for the ordering anyway, so the window operator is nearly free;
  // a self-join would be quadratic in the events of a case.
  const neighboured = `
    SELECT case_id,
           resource,
           LAG(resource)  OVER (PARTITION BY case_id ORDER BY ${ORDER}) AS before_r,
           LEAD(resource) OVER (PARTITION BY case_id ORDER BY ${ORDER}) AS after_r
    FROM (${attributed}) s`;

  const [togetherRows, delegationRows, handoverRows, mixRows] = await Promise.all([
    // Pairs on the same case. DISTINCT first so a person who touched a case
    // forty times counts once, and `a.resource < b.resource` gives each
    // unordered pair exactly once instead of both directions.
    client.query(
      `WITH on_case AS (
         SELECT DISTINCT s.case_id, s.resource
         FROM (${attributed}) s
         WHERE ${inTeam('s.resource')}
       )
       SELECT a.resource AS a, b.resource AS b, COUNT(*) AS cases
       FROM on_case a
       JOIN on_case b ON a.case_id = b.case_id AND a.resource < b.resource
       GROUP BY 1, 2
       ORDER BY cases DESC, a, b
       LIMIT ${PAIR_LIMIT}`,
      params,
    ),
    // A → B → A, immediately. Looser definitions ("A appears again later in
    // the case") infer a relationship the log does not show; this one is
    // visible in the sequence itself.
    client.query(
      `SELECT n.before_r AS from_r, n.resource AS to_r,
              COUNT(*) AS count, COUNT(DISTINCT n.case_id) AS cases
       FROM (${neighboured}) n
       WHERE n.before_r IS NOT NULL
         AND n.after_r IS NOT NULL
         AND n.before_r = n.after_r
         AND n.before_r <> n.resource
         AND ${inTeam('n.before_r')}
         AND ${inTeam('n.resource')}
       GROUP BY 1, 2
       ORDER BY count DESC, from_r, to_r
       LIMIT ${PAIR_LIMIT}`,
      params,
    ),
    // Every handover, for the denominator of the return rate. Without it a
    // pair that hands over twice and gets it back twice looks the same as one
    // that hands over two thousand times and gets it back twice.
    client.query(
      `SELECT n.before_r AS from_r, n.resource AS to_r, COUNT(*) AS count
       FROM (${neighboured}) n
       WHERE n.before_r IS NOT NULL AND n.before_r <> n.resource
       GROUP BY 1, 2`,
      params,
    ),
    client.query(
      `SELECT s.resource, s.activity, COUNT(*) AS events
       FROM (${attributed}) s
       WHERE ${inTeam('s.resource')}
       GROUP BY 1, 2`,
      params,
    ),
  ]);

  const worksAlongside: WorksAlongside[] = togetherRows.rows.map((row) => {
    const a = String(row['a']);
    const b = String(row['b']);
    const both = countOf(row['cases']);
    const either = (casesOf.get(a) ?? 0) + (casesOf.get(b) ?? 0) - both;
    return { a, b, cases: both, affinity: either > 0 ? both / either : 0 };
  });

  const handoverCounts = new Map<string, number>();
  for (const row of handoverRows.rows) {
    handoverCounts.set(`${String(row['from_r'])} ${String(row['to_r'])}`, countOf(row['count']));
  }

  const delegations: Delegation[] = delegationRows.rows.map((row) => {
    const from = String(row['from_r']);
    const to = String(row['to_r']);
    const count = countOf(row['count']);
    const handovers = handoverCounts.get(`${from} ${to}`) ?? 0;
    return { from, to, count, cases: countOf(row['cases']), returnRate: handovers > 0 ? count / handovers : 0 };
  });

  // ---- doing alike, and the roles that fall out of it ---------------------

  const mix = new Map<string, Map<string, number>>();
  for (const row of mixRows.rows) {
    const resource = String(row['resource']);
    let counts = mix.get(resource);
    if (counts === undefined) {
      counts = new Map<string, number>();
      mix.set(resource, counts);
    }
    counts.set(String(row['activity']), countOf(row['events']));
  }

  const named = people.map((p) => p.resource).filter((r) => mix.has(r));
  // Unit vectors once, not per pair: normalising inside the distance function
  // would repeat the same square root O(n²) times for no gain.
  const vectors = named.map((r) => unitVector(mix.get(r) ?? new Map()));

  const doesAlike: DoesAlike[] = [];
  for (let i = 0; i < named.length; i += 1) {
    for (let j = i + 1; j < named.length; j += 1) {
      const similarity = 1 - cosineDistance(vectors[i]!, vectors[j]!);
      if (similarity >= minSimilarity) {
        doesAlike.push({ a: named[i]!, b: named[j]!, similarity });
      }
    }
  }
  doesAlike.sort((x, y) => y.similarity - x.similarity || x.a.localeCompare(y.a));
  const alike = doesAlike.slice(0, PAIR_LIMIT);

  const roles = discoverRoles(named, vectors, mix, opts.roles);

  return {
    objectType: opts.objectType,
    people,
    omittedPeople,
    worksAlongside,
    delegations,
    doesAlike: alike,
    roles,
    reading: describe(people.length, roles, delegations, alike),
  };
}

/**
 * How many roles, when nobody says.
 *
 * The square root of headcount, clamped to 2–6. It is a heuristic and is
 * treated as one: it exists so the panel has something to show without asking
 * a question the reader cannot yet answer, and the caller can always pass a
 * number. Anything cleverer — a silhouette sweep, a gap statistic — would be
 * choosing a shape on the reader's behalf with more confidence than the input
 * supports, and on teams of this size the answers rarely differ.
 */
const defaultRoleCount = (headcount: number): number =>
  Math.min(6, Math.max(2, Math.round(Math.sqrt(headcount))));

function discoverRoles(
  named: readonly string[],
  vectors: readonly ReadonlyMap<string, number>[],
  mix: ReadonlyMap<string, ReadonlyMap<string, number>>,
  wanted: number | undefined,
): DiscoveredRole[] {
  if (named.length < 2) return [];
  const target =
    wanted !== undefined && wanted > 0
      ? Math.min(named.length, Math.trunc(wanted))
      : defaultRoleCount(named.length);

  const groups = agglomerate(vectors, target);

  return groups
    .map((indices, id) => {
      const members = indices.map((i) => named[i]!).sort();

      // What the group does, pooled. Shares of the group's own volume rather
      // than of the log's, because a role is defined by what its members spend
      // their time on, not by how much of the process they account for.
      const totals = new Map<string, number>();
      let events = 0;
      for (const index of indices) {
        for (const [activity, count] of mix.get(named[index]!) ?? []) {
          totals.set(activity, (totals.get(activity) ?? 0) + count);
          events += count;
        }
      }

      const signature = [...totals.entries()]
        .map(([activity, count]) => ({ activity, share: events > 0 ? count / events : 0 }))
        .sort((a, b) => b.share - a.share || a.activity.localeCompare(b.activity))
        .slice(0, 5);

      // Mean pairwise similarity inside the group. One member has no pairs, so
      // it is 1 by convention and the type says why.
      let pairs = 0;
      let total = 0;
      for (let i = 0; i < indices.length; i += 1) {
        for (let j = i + 1; j < indices.length; j += 1) {
          total += 1 - cosineDistance(vectors[indices[i]!]!, vectors[indices[j]!]!);
          pairs += 1;
        }
      }

      return {
        id,
        members,
        signature,
        events,
        cohesion: pairs === 0 ? 1 : total / pairs,
      };
    })
    .sort((a, b) => b.events - a.events);
}

/** What the network looks like, in one sentence the caller can print as-is. */
function describe(
  headcount: number,
  roles: readonly DiscoveredRole[],
  delegations: readonly Delegation[],
  alike: readonly DoesAlike[],
): string {
  if (headcount < 2) return 'only one person appears in this selection, so there is no team to describe';

  const interchangeable = alike.filter((p) => p.similarity > 0.9).length;
  const possiblePairs = (headcount * (headcount - 1)) / 2;
  const strongestDelegation = delegations[0];

  if (roles.length > 0 && interchangeable === 0 && alike.length === 0) {
    return `${headcount} people, and no two of them do the same mix of work — this is a team of specialists, so cover for any one of them is thin`;
  }

  if (possiblePairs > 0 && interchangeable / possiblePairs > 0.6) {
    return `${headcount} people who nearly all do the same mix of work — they are interchangeable, which is good for cover and means the roles below carry little information`;
  }

  const shape = `${headcount} people fall into ${roles.length} group${roles.length === 1 ? '' : 's'} by what they actually do`;
  return strongestDelegation === undefined
    ? `${shape}, and nobody hands work on and gets it back`
    : `${shape}. The clearest supervision is ${strongestDelegation.from} → ${strongestDelegation.to} → ${strongestDelegation.from}, happening ${strongestDelegation.count} time${strongestDelegation.count === 1 ? '' : 's'}`;
}
