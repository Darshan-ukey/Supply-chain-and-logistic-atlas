import type { SqlClient } from '../ports/sql.js';
import type { SqlDialect } from '../sql/dialect.js';
import {
  buildDfg,
  type ActivityStats,
  type Dfg,
  type DfgEdge,
  type DfgOptions,
} from './dfg.js';
import { allOf, describeFilter, type CaseFilter } from './filter.js';

/**
 * Two cohorts as one map.
 *
 * Reading two process maps side by side does not work. The layouts differ, the
 * eye cannot hold both, and the arcs that matter are the ones present in one and
 * absent in the other — which is exactly what side-by-side hides, because an
 * absent arc is invisible.
 *
 * One map, with every arc carrying which side uses it more, answers "where does
 * the slow fifth diverge from everyone else" directly. It is also the honest
 * shape for the question: a difference is a property of the PAIR, and giving it
 * to one of the two maps would be a choice about which one is normal.
 *
 * Shares, not counts. Cohorts are rarely the same size, and an arc used by 90%
 * of a small cohort and 10% of a large one has more raw traffic on the second.
 */

export interface ArcDelta {
  from: string;
  to: string;
  /** Share of cohort A's cases using this arc, 0-1. */
  shareA: number;
  shareB: number;
  /** shareA - shareB. Positive means A leans on it more. */
  difference: number;
  casesA: number;
  casesB: number;
  /** True when one side never uses it at all — the sharpest kind of difference. */
  exclusive: boolean;
}

export interface NodeDelta {
  activity: string;
  shareA: number;
  shareB: number;
  difference: number;
  exclusive: boolean;
}

export interface DeltaMap {
  objectType: string;
  labelA: string;
  labelB: string;
  casesA: number;
  casesB: number;
  /** Every arc in either cohort, biggest difference first. */
  arcs: ArcDelta[];
  nodes: NodeDelta[];
  /**
   * Both cohorts' structure in one graph, so a caller can lay one graph out
   * and shade it from `arcs`.
   *
   * The union rather than A's own structure, because an arc only B uses still
   * has to appear — being absent from A is the finding.
   */
  graph: Dfg;
  /** Plain statement of where the two differ most. */
  reading: string;
}

export interface DeltaMapOptions extends DfgOptions {
  /** The cohort under examination. */
  a: CaseFilter;
  /** What to compare it against. Omit for "everything else". */
  b?: CaseFilter | undefined;
  labelA?: string | undefined;
  labelB?: string | undefined;
}

/**
 * Compare two cohorts on one graph.
 *
 * Two full mining passes rather than one clever query. The DFG is already an
 * aggregate — hundreds of rows out of millions of events — so the second pass
 * costs a scan and nothing crosses into Node that would not have anyway.
 */
export async function deltaMap(
  client: SqlClient,
  dialect: SqlDialect,
  opts: DeltaMapOptions,
): Promise<DeltaMap> {
  const scope = opts.filter === undefined ? [] : [opts.filter];
  const filterA = allOf(...scope, opts.a);
  const filterB = allOf(...scope, opts.b ?? { kind: 'not', arg: opts.a });

  const [a, b] = await Promise.all([
    buildDfg(client, dialect, { ...opts, filter: filterA }),
    buildDfg(client, dialect, { ...opts, filter: filterB }),
  ]);

  const labelA = opts.labelA ?? describeFilter(opts.a);
  const labelB = opts.labelB ?? (opts.b === undefined ? 'everything else' : describeFilter(opts.b));

  const arcs = compareArcs(a, b);

  return {
    objectType: opts.objectType,
    labelA,
    labelB,
    casesA: a.caseCount,
    casesB: b.caseCount,
    arcs,
    nodes: compareNodes(a, b),
    graph: union(a, b),
    reading: readDelta(arcs, labelA, labelB, a.caseCount, b.caseCount),
  };
}

/** Share of a cohort's cases touching each arc. */
function arcShares(dfg: Dfg): Map<string, { share: number; cases: number }> {
  const shares = new Map<string, { share: number; cases: number }>();
  if (dfg.caseCount === 0) return shares;
  for (const edge of dfg.edges) {
    shares.set(key(edge.from, edge.to), {
      share: edge.caseCount / dfg.caseCount,
      cases: edge.caseCount,
    });
  }
  return shares;
}

function compareArcs(a: Dfg, b: Dfg): ArcDelta[] {
  const sharesA = arcShares(a);
  const sharesB = arcShares(b);
  const bothPopulated = a.caseCount > 0 && b.caseCount > 0;

  const arcs: ArcDelta[] = [];
  for (const id of new Set([...sharesA.keys(), ...sharesB.keys()])) {
    const [from, to] = splitKey(id);
    const inA = sharesA.get(id);
    const inB = sharesB.get(id);
    arcs.push({
      from,
      to,
      shareA: inA?.share ?? 0,
      shareB: inB?.share ?? 0,
      difference: (inA?.share ?? 0) - (inB?.share ?? 0),
      casesA: inA?.cases ?? 0,
      casesB: inB?.cases ?? 0,
      // Absent on one side entirely. Both cohorts must be non-empty for this to
      // mean anything: against an empty cohort every arc is "exclusive" and the
      // whole map lights up saying nothing.
      exclusive: bothPopulated && (inA === undefined || inB === undefined),
    });
  }

  return arcs.sort(
    (x, y) =>
      Math.abs(y.difference) - Math.abs(x.difference) ||
      x.from.localeCompare(y.from) ||
      x.to.localeCompare(y.to),
  );
}

function compareNodes(a: Dfg, b: Dfg): NodeDelta[] {
  const shareOf = (dfg: Dfg): Map<string, number> =>
    new Map(
      dfg.caseCount === 0
        ? []
        : dfg.activities.map((s) => [s.activity, s.caseCount / dfg.caseCount] as const),
    );
  const sharesA = shareOf(a);
  const sharesB = shareOf(b);
  const bothPopulated = a.caseCount > 0 && b.caseCount > 0;

  return [...new Set([...sharesA.keys(), ...sharesB.keys()])]
    .map((activity) => {
      const shareA = sharesA.get(activity) ?? 0;
      const shareB = sharesB.get(activity) ?? 0;
      return {
        activity,
        shareA,
        shareB,
        difference: shareA - shareB,
        exclusive: bothPopulated && (!sharesA.has(activity) || !sharesB.has(activity)),
      };
    })
    .sort(
      (x, y) =>
        Math.abs(y.difference) - Math.abs(x.difference) || x.activity.localeCompare(y.activity),
    );
}

/**
 * Both cohorts' structure in one graph.
 *
 * Counts are summed because this graph is scaffolding for a layout rather than
 * a measurement — every number a reader acts on is in `arcs` and `nodes`, as a
 * share of its own cohort. Medians are refused outright: a median across two
 * populations is not a median of anything.
 */
function union(a: Dfg, b: Dfg): Dfg {
  const activities = new Map<string, ActivityStats>(
    a.activities.map((s) => [s.activity, { ...s }]),
  );
  for (const stat of b.activities) {
    const found = activities.get(stat.activity);
    if (found === undefined) {
      activities.set(stat.activity, { ...stat });
      continue;
    }
    found.frequency += stat.frequency;
    found.caseCount += stat.caseCount;
    found.medianDurationSeconds = null;
    found.medianCost = null;
    found.totalCost =
      found.totalCost === null && stat.totalCost === null
        ? null
        : (found.totalCost ?? 0) + (stat.totalCost ?? 0);
  }

  const edges = new Map<string, DfgEdge>(a.edges.map((e) => [key(e.from, e.to), { ...e }]));
  for (const edge of b.edges) {
    const found = edges.get(key(edge.from, edge.to));
    if (found === undefined) {
      edges.set(key(edge.from, edge.to), { ...edge });
      continue;
    }
    found.frequency += edge.frequency;
    found.caseCount += edge.caseCount;
    found.medianSeconds = null;
    found.meanSeconds = null;
  }

  const merge = (x: Map<string, number>, y: Map<string, number>): Map<string, number> => {
    const out = new Map(x);
    for (const [k, v] of y) out.set(k, (out.get(k) ?? 0) + v);
    return out;
  };

  return {
    objectType: a.objectType,
    activities: [...activities.values()],
    edges: [...edges.values()],
    starts: merge(a.starts, b.starts),
    ends: merge(a.ends, b.ends),
    caseCount: a.caseCount + b.caseCount,
    eventCount: a.eventCount + b.eventCount,
  };
}

/** Differences below this are noise on any real log. */
const MEANINGFUL = 0.1;

function readDelta(
  arcs: readonly ArcDelta[],
  labelA: string,
  labelB: string,
  casesA: number,
  casesB: number,
): string {
  if (casesA === 0 || casesB === 0) {
    return 'one side of the comparison is empty, so nothing can be compared';
  }
  const top = arcs[0];
  if (top === undefined || Math.abs(top.difference) < MEANINGFUL) {
    return 'the two cohorts take the same routes — whatever separates them is not in the control flow';
  }
  const heavier = top.difference > 0 ? labelA : labelB;
  const lighter = top.difference > 0 ? labelB : labelA;
  const gap = Math.round(Math.abs(top.difference) * 100);
  return top.exclusive
    ? `${top.from} then ${top.to} happens only in ${heavier}, never in ${lighter}`
    : `${top.from} then ${top.to} is ${gap} points more common in ${heavier} than in ${lighter}`;
}

/**
 * Arc key separator.
 *
 * A NUL, because an activity name may hold any printable character — including
 * arrows and pipes — and a separator that can appear inside a name would merge
 * two different arcs into one silently.
 */
const SEP = '\u0000';

function key(from: string, to: string): string {
  return `${from}${SEP}${to}`;
}

function splitKey(id: string): [string, string] {
  const at = id.indexOf(SEP);
  return [id.slice(0, at), id.slice(at + 1)];
}
