import { countOf, numberOrNull } from '../domain/identifiers.js';
import type { SqlClient } from '../ports/sql.js';
import type { SqlDialect } from '../sql/dialect.js';
import type { CaseFilter } from './filter.js';
import type { LogCapabilities, Perspective } from './eventlog.js';
import { buildLog } from './logquery.js';
import type { BusinessCalendar } from './calendar.js';

/**
 * The directly-follows graph — the substrate every discovery algorithm reads.
 *
 * Computed with a window function INSIDE the database and returned already
 * aggregated. A 40-million-event log produces a graph of a few hundred nodes,
 * so what crosses into Node is tiny and constant-ish regardless of log size.
 * Streaming events out to build this in JavaScript is the single most common
 * way process mining tooling falls over, and it is entirely avoidable.
 */

export interface DfgEdge {
  from: string;
  to: string;
  /** How many times this transition was directly observed. */
  frequency: number;
  /** Cases in which it occurred at least once. */
  caseCount: number;
  /** Median seconds between the two events — the waiting time on this arc. */
  medianSeconds: number | null;
  meanSeconds: number | null;
}

export interface ActivityStats {
  activity: string;
  frequency: number;
  caseCount: number;
  /** Median recorded handling time, where the source supplied one. */
  medianDurationSeconds: number | null;
  /**
   * What this activity cost across the whole selection, and per execution.
   *
   * Total as well as median, because they answer different questions: the
   * median says whether a step is expensive, the total says whether it is
   * worth attention. A cheap step run fifty thousand times outranks an
   * expensive one run twice, and only the total shows it.
   *
   * Null throughout when the log carries no cost — never zero, which would
   * read as free.
   */
  totalCost: number | null;
  medianCost: number | null;
}

export interface Dfg {
  objectType: string;
  activities: ActivityStats[];
  edges: DfgEdge[];
  /** Activities that begin a trace, with how many traces each begins. */
  starts: Map<string, number>;
  /** Activities that end a trace. */
  ends: Map<string, number>;
  caseCount: number;
  eventCount: number;
  /**
   * Collapsed clusters, present only after `groupRareActivities` has run.
   *
   * Each entry names a synthetic activity that appears in `activities` and
   * lists what it stands for, so a host can offer to open it.
   *
   * Absent means grouping never ran. **Empty means it ran and found nothing
   * worth collapsing** — every quiet step sits among busy ones rather than
   * beside another quiet one. The two are different answers and a caller
   * telling a reader "nothing was grouped" needs to know which it got.
   */
  groups?: ActivityGroup[];
}

/** One collapsed cluster of rare activities. */
export interface ActivityGroup {
  /** The synthetic activity standing in for the cluster, as it appears in `activities`. */
  id: string;
  /** What it collapsed, most frequent first. */
  activities: string[];
  /** Executions across every member. */
  frequency: number;
  /**
   * Cases touching any member.
   *
   * The largest member's case count, not the sum: one case can pass through
   * several members, and summing would report more cases than the log holds.
   */
  caseCount: number;
}

export interface DfgOptions {
  objectType: string;
  schema?: string;
  /**
   * Drop edges seen in fewer than this fraction of their source activity's
   * occurrences (0–1). The standard noise filter: real logs contain rare
   * transitions that turn a readable map into a hairball. 0 keeps everything.
   */
  edgeThreshold?: number;
  /** Restrict to events in this window. */
  window?: { from?: Date | undefined; to?: Date | undefined };
  /**
   * Keep only these lifecycle transitions, compared case-insensitively.
   *
   * Not a convenience — for many real logs it is the difference between a
   * readable model and a hairball. A log where some activities emit
   * schedule/start/complete triples and others emit only a completion has two
   * different event granularities interleaved in one trace, and the resulting
   * graph describes neither. BPI Challenge 2012 is the textbook case: its W_*
   * work items are triples while A_* and O_* are single completions.
   *
   * Filtering to one transition puts every activity on the same footing.
   */
  lifecycle?: readonly string[];
  /** Restrict to whole CASES matching this selection. */
  filter?: CaseFilter | undefined;
  /**
   * What goes in the boxes: the recorded step, the person, or an attribute.
   *
   * A resource perspective turns the same log into a handover map; an
   * attribute perspective turns it into the lifecycle of a business object.
   * No re-extraction — the events are projected differently.
   */
  perspective?: Perspective | undefined;
  /** Probe with detectCapabilities; omitting it projects absent columns as NULL. */
  capabilities?: LogCapabilities | undefined;
  /**
   * Measure durations in working time rather than wall-clock. See
   * `LogQueryOptions.calendar`; off by default, and every figure here is the
   * wall-clock one without it.
   */
  calendar?: BusinessCalendar | undefined;
}

/**
 * Event order within a case.
 *
 * Timestamp ties are routine — an interval source emits start and complete at
 * the same instant when handling was sub-second — so lifecycle breaks the tie
 * before event_id does. Without it a start can sort after its own completion,
 * and the graph gains an arc that runs backwards through time.
 *
 * The comparison is case-insensitive on purpose. XES specifies lowercase
 * transition names, but real logs do not comply: BPI Challenge 2012 ships
 * SCHEDULE / START / COMPLETE in capitals, and a case-sensitive test silently
 * matches none of them — the tie-break then does nothing on exactly the logs
 * that need it most. Unrecognised values sort last rather than being guessed
 * at.
 */
const LIFECYCLE_RANK = `CASE lower(COALESCE(lifecycle, ''))
    WHEN 'schedule' THEN 0
    WHEN 'assign'   THEN 1
    WHEN 'start'    THEN 2
    WHEN ''         THEN 3
    WHEN 'complete' THEN 4
    ELSE 5 END`;

const ORDER_BY = `ts, ${LIFECYCLE_RANK}, event_id`;

/**
 * Time along one arc: from an event to the next one in its case.
 *
 * A difference of two clock readings rather than of two timestamps, so a
 * configured working calendar reaches arc delays without a second calculation
 * here. Ordering guarantees the later reading is the larger, and the clock never
 * runs backwards, so no clamp is needed. Reads the columns `ordered` projects.
 */
const ARC_DELAY = '(next_business_s - business_s)';

export async function buildDfg(
  client: SqlClient,
  dialect: SqlDialect,
  opts: DfgOptions,
): Promise<Dfg> {
  const params: unknown[] = [];
  const { sql: log } = buildLog(dialect, params, opts);

  const ordered = `SELECT case_id, activity, ts, duration_s, business_s,
                          LEAD(activity)   OVER (PARTITION BY case_id ORDER BY ${ORDER_BY}) AS next_activity,
                          LEAD(business_s) OVER (PARTITION BY case_id ORDER BY ${ORDER_BY}) AS next_business_s,
                          ROW_NUMBER()     OVER (PARTITION BY case_id ORDER BY ${ORDER_BY}) AS rn,
                          COUNT(*)         OVER (PARTITION BY case_id) AS case_len
                   FROM (${log}) p`;

  const edgeSql = `
    SELECT activity AS from_activity,
           next_activity AS to_activity,
           COUNT(*) AS frequency,
           COUNT(DISTINCT case_id) AS case_count,
           ${dialect.medianOf(ARC_DELAY)} AS median_s,
           AVG(${ARC_DELAY}) AS mean_s
    FROM (${ordered}) o
    WHERE next_activity IS NOT NULL
    GROUP BY 1, 2`;

  const activitySql = `
    SELECT activity,
           COUNT(*) AS frequency,
           COUNT(DISTINCT case_id) AS case_count,
           ${dialect.medianOf('duration_s')} AS median_duration_s,
           SUM(cost) AS total_cost,
           ${dialect.medianOf('cost')} AS median_cost,
           COUNT(cost) AS cost_rows
    FROM (${log}) p
    GROUP BY 1`;

  const boundarySql = `
    SELECT activity,
           SUM(CASE WHEN rn = 1 THEN 1 ELSE 0 END) AS starts,
           SUM(CASE WHEN rn = case_len THEN 1 ELSE 0 END) AS ends
    FROM (${ordered}) o
    GROUP BY 1`;

  const totalsSql = `SELECT COUNT(*) AS events, COUNT(DISTINCT case_id) AS cases FROM (${log}) p`;

  const [edgeRows, activityRows, boundaryRows, totalRows] = await Promise.all([
    client.query(edgeSql, params),
    client.query(activitySql, params),
    client.query(boundarySql, params),
    client.query(totalsSql, params),
  ]);

  const activities: ActivityStats[] = activityRows.rows.map((r) => ({
    activity: String(r['activity']),
    frequency: countOf(r['frequency']),
    caseCount: countOf(r['case_count']),
    medianDurationSeconds: numberOrNull(r['median_duration_s']),
    // Null rather than zero when nothing recorded a cost. SUM over no rows is
    // already NULL, but SUM over rows that are all NULL is too — and a 0 here
    // would read as "this step is free", which is the opposite of "unknown".
    totalCost: countOf(r['cost_rows']) > 0 ? numberOrNull(r['total_cost']) : null,
    medianCost: countOf(r['cost_rows']) > 0 ? numberOrNull(r['median_cost']) : null,
  }));

  let edges: DfgEdge[] = edgeRows.rows.map((r) => ({
    from: String(r['from_activity']),
    to: String(r['to_activity']),
    frequency: countOf(r['frequency']),
    caseCount: countOf(r['case_count']),
    medianSeconds: numberOrNull(r['median_s']),
    meanSeconds: numberOrNull(r['mean_s']),
  }));

  const starts = new Map<string, number>();
  const ends = new Map<string, number>();
  for (const r of boundaryRows.rows) {
    const activity = String(r['activity']);
    const s = countOf(r['starts']);
    const e = countOf(r['ends']);
    if (s > 0) starts.set(activity, s);
    if (e > 0) ends.set(activity, e);
  }

  const totals = totalRows.rows[0] ?? {};
  const dfg: Dfg = {
    objectType: opts.objectType,
    activities: activities.sort((a, b) => b.frequency - a.frequency),
    edges,
    starts,
    ends,
    caseCount: countOf(totals['cases']),
    eventCount: countOf(totals['events']),
  };

  const threshold = opts.edgeThreshold ?? 0;
  if (threshold > 0) {
    edges = filterEdges(dfg, threshold);
    return { ...dfg, edges };
  }
  return dfg;
}

/**
 * Drop arcs that are rare RELATIVE TO THEIR SOURCE, not relative to the whole
 * log. An absolute cutoff silently deletes the entire tail of a process whose
 * activities are all uncommon; a relative one removes a rare branch out of a
 * busy activity while leaving a quiet-but-consistent path intact.
 */
export function filterEdges(dfg: Dfg, threshold: number): DfgEdge[] {
  const outgoingTotal = new Map<string, number>();
  for (const e of dfg.edges) {
    outgoingTotal.set(e.from, (outgoingTotal.get(e.from) ?? 0) + e.frequency);
  }
  return dfg.edges.filter((e) => {
    const total = outgoingTotal.get(e.from) ?? 0;
    return total === 0 || e.frequency / total >= threshold;
  });
}

// ---------------------------------------------------------------------------
// Node abstraction
// ---------------------------------------------------------------------------

export interface NodeAbstractionOptions {
  /**
   * Share of activities to KEEP, 0–1, ranked by frequency. 1 keeps everything.
   *
   * The slider a user actually drags. Expressed as a share rather than a count
   * because a process with 8 activities and one with 300 need the same control.
   */
  keep?: number;
  /** Alternative cutoff: drop activities occurring fewer times than this. */
  minFrequency?: number;
  /** Activities never removed, whatever their frequency. */
  pin?: readonly string[];
}

/**
 * Remove infrequent activities and reconnect the paths that ran through them.
 *
 * The reconnection is the whole point. Simply hiding a node leaves its
 * neighbours dangling: predecessors lose their outgoing arc, successors lose
 * their incoming one, and the map acquires orphans and phantom start points
 * that describe no real behaviour. Every mining tool that ships a node slider
 * bridges instead — if A led to X and X led to B, then with X hidden, A leads
 * to B, and it did so for as many cases as actually took that route.
 *
 * Flow is apportioned rather than duplicated. A hidden activity with two
 * predecessors and three successors must not turn one case into six: each
 * bridged arc receives its share of the traffic through the node, so the
 * totals still describe the log.
 *
 * Time is added, not averaged. Waiting to reach X, handling X, and waiting to
 * reach B all still happened — the map hides the step, never the delay.
 */
export function abstractNodes(dfg: Dfg, opts: NodeAbstractionOptions): Dfg {
  const pinned = new Set(opts.pin ?? []);
  const ranked = [...dfg.activities].sort((a, b) => b.frequency - a.frequency || a.activity.localeCompare(b.activity));

  const keepSet = new Set<string>();
  if (opts.minFrequency !== undefined) {
    for (const a of ranked) if (a.frequency >= opts.minFrequency) keepSet.add(a.activity);
  } else {
    const share = Math.min(1, Math.max(0, opts.keep ?? 1));
    // At least one activity survives: an empty map is never the useful answer
    // to "simplify this", and 0 on a slider should mean "as simple as it goes".
    const n = Math.max(1, Math.round(ranked.length * share));
    for (const a of ranked.slice(0, n)) keepSet.add(a.activity);
  }
  for (const p of pinned) if (dfg.activities.some((a) => a.activity === p)) keepSet.add(p);

  const removed = ranked.filter((a) => !keepSet.has(a.activity));
  if (removed.length === 0) return dfg;

  const durationOf = new Map(dfg.activities.map((a) => [a.activity, a.medianDurationSeconds]));
  // NUL as the joiner: an activity name can contain any printable character,
  // so a visible separator could collide and merge two different arcs.
  const key = (from: string, to: string): string => `${from}\u0000${to}`;
  const edges = new Map<string, DfgEdge>();
  for (const e of dfg.edges) edges.set(key(e.from, e.to), { ...e });
  const starts = new Map(dfg.starts);
  const ends = new Map(dfg.ends);

  const merge = (edge: DfgEdge): void => {
    const existing = edges.get(key(edge.from, edge.to));
    if (existing === undefined) {
      edges.set(key(edge.from, edge.to), edge);
      return;
    }
    const total = existing.frequency + edge.frequency;
    existing.medianSeconds = weightedMerge(
      existing.medianSeconds,
      existing.frequency,
      edge.medianSeconds,
      edge.frequency,
    );
    existing.meanSeconds = weightedMerge(
      existing.meanSeconds,
      existing.frequency,
      edge.meanSeconds,
      edge.frequency,
    );
    existing.frequency = total;
    existing.caseCount = Math.max(existing.caseCount, edge.caseCount);
  };

  // Least frequent first: removing the quietest node first means later bridges
  // are built over traffic that has already been consolidated, so the result
  // does not depend on map iteration order.
  for (const node of [...removed].sort((a, b) => a.frequency - b.frequency)) {
    const x = node.activity;
    const incoming = [...edges.values()].filter((e) => e.to === x && e.from !== x);
    const outgoing = [...edges.values()].filter((e) => e.from === x && e.to !== x);
    const startCount = starts.get(x) ?? 0;
    const endCount = ends.get(x) ?? 0;

    const inTotal = incoming.reduce((s, e) => s + e.frequency, 0) + startCount;
    const outTotal = outgoing.reduce((s, e) => s + e.frequency, 0) + endCount;
    const through = Math.max(inTotal, outTotal, 1);
    const held = durationOf.get(x) ?? 0;

    for (const i of incoming) {
      for (const o of outgoing) {
        const share = (i.frequency * o.frequency) / through;
        if (share < 0.5) continue; // rounds to nothing; adding it would be noise
        merge({
          from: i.from,
          to: o.to,
          frequency: Math.round(share),
          caseCount: Math.min(i.caseCount, o.caseCount),
          medianSeconds: addDelays(i.medianSeconds, held, o.medianSeconds),
          meanSeconds: addDelays(i.meanSeconds, held, o.meanSeconds),
        });
      }
    }

    // A hidden first activity hands its start count to whatever followed it,
    // and a hidden last activity hands its end count back to its predecessors.
    // Skipping this is what produces a map with no entry point.
    if (startCount > 0) {
      for (const o of outgoing) {
        const share = Math.round((startCount * o.frequency) / Math.max(outTotal, 1));
        if (share > 0) starts.set(o.to, (starts.get(o.to) ?? 0) + share);
      }
      if (outgoing.length === 0 && endCount > 0) {
        // Ran alone: nothing to hand to. Its traffic leaves the map with it.
      }
    }
    if (endCount > 0) {
      for (const i of incoming) {
        const share = Math.round((endCount * i.frequency) / Math.max(inTotal, 1));
        if (share > 0) ends.set(i.from, (ends.get(i.from) ?? 0) + share);
      }
    }

    starts.delete(x);
    ends.delete(x);
    for (const k of [...edges.keys()]) {
      const e = edges.get(k);
      if (e !== undefined && (e.from === x || e.to === x)) edges.delete(k);
    }
  }

  return {
    ...dfg,
    activities: dfg.activities.filter((a) => keepSet.has(a.activity)),
    edges: [...edges.values()].sort(
      (a, b) => b.frequency - a.frequency || a.from.localeCompare(b.from) || a.to.localeCompare(b.to),
    ),
    starts,
    ends,
  };
}

/** Waiting in, handling, waiting out — the delay the hidden step still cost. */
function addDelays(before: number | null, held: number, after: number | null): number | null {
  if (before === null && after === null) return null;
  return (before ?? 0) + held + (after ?? 0);
}

/** Frequency-weighted mean of two delays, either of which may be unmeasured. */
function weightedMerge(a: number | null, aw: number, b: number | null, bw: number): number | null {
  if (a === null) return b;
  if (b === null) return a;
  const total = aw + bw;
  return total === 0 ? a : (a * aw + b * bw) / total;
}

// ---------------------------------------------------------------------------
// Graph view — what the miner actually walks
// ---------------------------------------------------------------------------

/**
 * An adjacency view over a DFG, restrictable to a subset of activities.
 *
 * The Inductive Miner recurses by partitioning the activity set, so being able
 * to take a cheap sub-view rather than rebuilding a graph is what keeps the
 * recursion from being quadratic in allocation.
 */
export class DfgView {
  readonly activities: ReadonlySet<string>;
  private readonly out = new Map<string, Set<string>>();
  private readonly inc = new Map<string, Set<string>>();
  readonly starts: ReadonlySet<string>;
  readonly ends: ReadonlySet<string>;

  constructor(
    activities: Iterable<string>,
    edges: Iterable<{ from: string; to: string }>,
    starts: Iterable<string>,
    ends: Iterable<string>,
  ) {
    this.activities = new Set(activities);
    for (const a of this.activities) {
      this.out.set(a, new Set());
      this.inc.set(a, new Set());
    }
    for (const { from, to } of edges) {
      if (!this.activities.has(from) || !this.activities.has(to)) continue;
      this.out.get(from)!.add(to);
      this.inc.get(to)!.add(from);
    }
    this.starts = new Set([...starts].filter((a) => this.activities.has(a)));
    this.ends = new Set([...ends].filter((a) => this.activities.has(a)));
  }

  static fromDfg(dfg: Dfg): DfgView {
    return new DfgView(
      dfg.activities.map((a) => a.activity),
      dfg.edges,
      dfg.starts.keys(),
      dfg.ends.keys(),
    );
  }

  successors(a: string): ReadonlySet<string> {
    return this.out.get(a) ?? new Set();
  }

  predecessors(a: string): ReadonlySet<string> {
    return this.inc.get(a) ?? new Set();
  }

  hasEdge(from: string, to: string): boolean {
    return this.out.get(from)?.has(to) ?? false;
  }

  get size(): number {
    return this.activities.size;
  }

  /**
   * Restrict to `subset`.
   *
   * Start and end activities are RECOMPUTED, and the rule is entry/exit rather
   * than absence of neighbours: an activity begins this fragment when control
   * can ARRIVE at it from outside the subset (or it began a trace outright),
   * and ends the fragment when control can LEAVE from it.
   *
   * The distinction is not academic. Take two interleaved activities b and c
   * sitting between a and d. Both have a predecessor inside the subset (each
   * other), so a rule based on "no predecessor remains" marks neither as a
   * start, the parallel cut's start/end requirement fails, and a textbook
   * concurrent branch falls through to a flower model. Under the entry rule
   * both are reachable from a, both reach d, and the cut is found.
   */
  restrict(subset: ReadonlySet<string>): DfgView {
    const edges: { from: string; to: string }[] = [];
    for (const a of subset) {
      for (const b of this.successors(a)) {
        if (subset.has(b)) edges.push({ from: a, to: b });
      }
    }
    const starts = [...subset].filter(
      (a) => this.starts.has(a) || [...this.predecessors(a)].some((p) => !subset.has(p)),
    );
    const ends = [...subset].filter(
      (a) => this.ends.has(a) || [...this.successors(a)].some((s) => !subset.has(s)),
    );
    return new DfgView(subset, edges, starts, ends);
  }

  /** Every activity reachable from `from`, following edges forwards. */
  reachableFrom(from: Iterable<string>): Set<string> {
    const seen = new Set<string>();
    const stack = [...from];
    while (stack.length > 0) {
      const a = stack.pop()!;
      if (seen.has(a)) continue;
      seen.add(a);
      for (const b of this.successors(a)) if (!seen.has(b)) stack.push(b);
    }
    return seen;
  }
}

// ---------------------------------------------------------------------------
// Grouping — the other half of simplification
// ---------------------------------------------------------------------------

export interface NodeGroupingOptions {
  /** Share of activities to KEEP, 0–1, ranked by frequency. Same meaning as `abstractNodes`. */
  keep?: number;
  /** Alternative cutoff: keep activities occurring at least this many times. */
  minFrequency?: number;
  /** Activities never collapsed, whatever their frequency. */
  pin?: readonly string[];
  /**
   * Smallest cluster worth collapsing. Default 2.
   *
   * A lone rare step collapsed into a box is not a simplification — it is the
   * same step under a name nobody recognises. One is left visible; two or more
   * that sit next to each other become one box.
   */
  minClusterSize?: number;
}

/**
 * Collapse rare activities into openable clusters instead of hiding them.
 *
 * `abstractNodes` answers "make this readable" by removing the quiet steps and
 * bridging the paths that ran through them. That is the right answer when the
 * reader wants the shape of the busy process and nothing else, and the wrong
 * one when they want to know what they are not being shown — a map with twelve
 * steps silently absent looks exactly like a map of a twelve-step-simpler
 * process.
 *
 * Grouping is the other answer. The quiet steps stay on the map as a single
 * box carrying its own membership, so the traffic through them is visible,
 * the count is stated, and a host can offer to open it.
 *
 * Clusters are **connected components of the rare subgraph**, not one global
 * bucket. A single box wired to everything is a hub that did not exist and
 * makes the map worse; rare steps that actually follow one another belong in
 * one box, and rare steps in different corners of the process belong in
 * different ones.
 *
 * Run this INSTEAD of `abstractNodes`, not after it — bridging first would
 * remove the very activities this is meant to represent.
 */
export function groupRareActivities(dfg: Dfg, opts: NodeGroupingOptions): Dfg {
  const pinned = new Set(opts.pin ?? []);
  const ranked = [...dfg.activities].sort(
    (a, b) => b.frequency - a.frequency || a.activity.localeCompare(b.activity),
  );

  const keepSet = new Set<string>();
  if (opts.minFrequency !== undefined) {
    for (const a of ranked) if (a.frequency >= opts.minFrequency) keepSet.add(a.activity);
  } else {
    const share = Math.min(1, Math.max(0, opts.keep ?? 1));
    const n = Math.max(1, Math.round(ranked.length * share));
    for (const a of ranked.slice(0, n)) keepSet.add(a.activity);
  }
  for (const p of pinned) if (dfg.activities.some((a) => a.activity === p)) keepSet.add(p);

  const rare = ranked.filter((a) => !keepSet.has(a.activity));
  if (rare.length === 0) return { ...dfg, groups: [] };

  // --- connected components over the rare subgraph --------------------------
  const rareNames = new Set(rare.map((a) => a.activity));
  const neighbours = new Map<string, Set<string>>(
    [...rareNames].map((a) => [a, new Set<string>()]),
  );
  for (const edge of dfg.edges) {
    if (edge.from === edge.to) continue;
    if (rareNames.has(edge.from) && rareNames.has(edge.to)) {
      neighbours.get(edge.from)!.add(edge.to);
      neighbours.get(edge.to)!.add(edge.from);
    }
  }

  const componentOf = new Map<string, number>();
  let componentCount = 0;
  // Iterated in frequency order so the components — and therefore their
  // labels — come out the same on every run over the same graph.
  for (const activity of rare.map((a) => a.activity)) {
    if (componentOf.has(activity)) continue;
    const id = componentCount++;
    const stack = [activity];
    componentOf.set(activity, id);
    while (stack.length > 0) {
      const node = stack.pop()!;
      for (const next of neighbours.get(node) ?? []) {
        if (componentOf.has(next)) continue;
        componentOf.set(next, id);
        stack.push(next);
      }
    }
  }

  const members = new Map<number, string[]>();
  for (const activity of rare.map((a) => a.activity)) {
    const id = componentOf.get(activity)!;
    const list = members.get(id);
    if (list === undefined) members.set(id, [activity]);
    else list.push(activity);
  }

  const minSize = Math.max(1, opts.minClusterSize ?? 2);
  const statsOf = new Map(dfg.activities.map((a) => [a.activity, a]));

  // Which clusters qualify has to be settled BEFORE any of them is named,
  // because a name only collides with an activity that is staying. A cluster of
  // one is that activity — it must keep its own name, not be renamed to dodge
  // itself.
  const qualifying = [...members.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, list]) => list)
    .filter((list) => list.length >= minSize);

  const leaving = new Set(qualifying.flat());
  const taken = new Set(
    dfg.activities.map((a) => a.activity).filter((a) => !leaving.has(a)),
  );
  const label = (activities: readonly string[]): string => {
    const head = activities[0] ?? 'rare steps';
    const base = activities.length === 1 ? head : `${head} +${activities.length - 1} more`;
    // An activity name may hold any printable character, so a generated label
    // can collide with a real one. Disambiguate rather than merge two nodes.
    let name = base;
    let n = 2;
    while (taken.has(name)) name = `${base} (${n++})`;
    taken.add(name);
    return name;
  };

  const groups: ActivityGroup[] = [];
  /** Every collapsed activity, mapped to the synthetic node standing in for it. */
  const standsFor = new Map<string, string>();

  for (const list of qualifying) {
    const sorted = [...list].sort(
      (a, b) => (statsOf.get(b)?.frequency ?? 0) - (statsOf.get(a)?.frequency ?? 0),
    );
    const id = label(sorted);
    for (const activity of sorted) standsFor.set(activity, id);
    groups.push({
      id,
      activities: sorted,
      frequency: sorted.reduce((n, a) => n + (statsOf.get(a)?.frequency ?? 0), 0),
      caseCount: Math.max(...sorted.map((a) => statsOf.get(a)?.caseCount ?? 0)),
    });
  }

  // Ran, found nothing to collapse. Reported as an empty list rather than as
  // absence, so a caller can say WHY nothing was grouped instead of leaving a
  // reader to conclude the control is broken.
  if (groups.length === 0) return { ...dfg, groups: [] };

  const nameOf = (activity: string): string => standsFor.get(activity) ?? activity;

  // --- fold the activities --------------------------------------------------
  const activities: ActivityStats[] = dfg.activities
    .filter((a) => !standsFor.has(a.activity))
    .map((a) => ({ ...a }));

  for (const group of groups) {
    const inside = group.activities.map((a) => statsOf.get(a)).filter((a): a is ActivityStats => a !== undefined);
    const costs = inside.map((a) => a.totalCost).filter((c): c is number => c !== null);
    activities.push({
      activity: group.id,
      frequency: group.frequency,
      caseCount: group.caseCount,
      // Additive quantities add. A median across twelve different steps is not
      // the median of anything, so it is refused rather than blended into a
      // number that would be read as one step's duration.
      medianDurationSeconds: null,
      totalCost: costs.length === 0 ? null : costs.reduce((x, y) => x + y, 0),
      medianCost: null,
    });
  }

  // --- fold the edges -------------------------------------------------------
  const key = (from: string, to: string): string => `${from}\u0000${to}`;
  const edges = new Map<string, DfgEdge>();

  for (const edge of dfg.edges) {
    const from = nameOf(edge.from);
    const to = nameOf(edge.to);
    // An edge between two members of one cluster is now internal to the box.
    // Drawing it as a self-loop would invent a repetition that the process
    // does not have.
    if (from === to && standsFor.has(edge.from) && standsFor.has(edge.to)) continue;

    const existing = edges.get(key(from, to));
    if (existing === undefined) {
      edges.set(key(from, to), { ...edge, from, to });
      continue;
    }
    const total = existing.frequency + edge.frequency;
    existing.medianSeconds = weightedMerge(
      existing.medianSeconds,
      existing.frequency,
      edge.medianSeconds,
      edge.frequency,
    );
    existing.meanSeconds = weightedMerge(
      existing.meanSeconds,
      existing.frequency,
      edge.meanSeconds,
      edge.frequency,
    );
    existing.frequency = total;
    existing.caseCount = Math.max(existing.caseCount, edge.caseCount);
  }

  const remap = (counts: ReadonlyMap<string, number>): Map<string, number> => {
    const out = new Map<string, number>();
    for (const [activity, n] of counts) {
      const name = nameOf(activity);
      out.set(name, (out.get(name) ?? 0) + n);
    }
    return out;
  };

  return {
    ...dfg,
    activities: activities.sort((a, b) => b.frequency - a.frequency || a.activity.localeCompare(b.activity)),
    edges: [...edges.values()].sort(
      (a, b) => b.frequency - a.frequency || a.from.localeCompare(b.from) || a.to.localeCompare(b.to),
    ),
    starts: remap(dfg.starts),
    ends: remap(dfg.ends),
    groups,
  };
}
