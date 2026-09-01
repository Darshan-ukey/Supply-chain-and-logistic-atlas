import { countOf, numberOrNull } from '../domain/identifiers.js';
import type { SqlClient } from '../ports/sql.js';
import type { SqlDialect } from '../sql/dialect.js';
import { CASE_CYCLE_SECONDS, buildLog, type LogQueryOptions } from './logquery.js';
import { analyseVariants, type VariantOptions } from './variants.js';

/**
 * Where routes diverge, and what a case looked like on the way through.
 *
 * A variant list is a flat ranking: four thousand rows, each a complete path.
 * It answers "what are the routes" and cannot answer "where do they split",
 * which is the question anybody actually has. Two variants that differ only in
 * their last step are adjacent in reality and unrelated in a list.
 *
 * All three views here are built from the variant set rather than from the raw
 * events, which keeps them cheap: the aggregation has already happened, and a
 * process with a million cases still has a bounded number of distinct routes.
 */

export interface PrefixNode {
  /** Stable identity: the path from the root, joined. */
  id: string;
  /** The activity at this step. Empty at the root. */
  activity: string;
  /** How many steps in, 0 at the root. */
  depth: number;
  /** Cases whose route begins with this prefix. */
  cases: number;
  /** Cases whose route ENDS here — the ones that stop rather than continue. */
  ends: number;
  /** Child node ids, busiest first. */
  children: string[];
  /** Parent id, null at the root. */
  parent: string | null;
}

export interface PrefixTree {
  objectType: string;
  /** Every node, root first, then breadth-first. */
  nodes: PrefixNode[];
  totalCases: number;
  /** Depth the tree was cut at, if it was. */
  maxDepth: number;
  /** Cases whose route continues past `maxDepth`. */
  casesBeyondDepth: number;
  /**
   * The step where the process fans out most.
   *
   * Measured as the node with the most children weighted by the cases passing
   * through it, so a busy three-way split outranks a rare ten-way one.
   */
  widestSplit: { id: string; activity: string; branches: number; cases: number } | null;
}

export interface PrefixTreeOptions extends VariantOptions {
  /** Steps to follow before stopping. Default 12. */
  maxDepth?: number | undefined;
  /** Prefixes below this many cases are not expanded further. Default 1. */
  minCases?: number | undefined;
}

const DEFAULT_DEPTH = 12;
/** Enough routes that the tail is genuinely rare rather than merely unsorted. */
const VARIANT_PAGE = 2000;

/**
 * Routes as a tree of shared prefixes.
 *
 * The natural shape for exploring a branching process: every node is a real
 * selection ("cases that did A then B"), so clicking one is a filter rather
 * than a drill-down that has to be assembled by hand.
 */
export async function prefixTree(
  client: SqlClient,
  dialect: SqlDialect,
  opts: PrefixTreeOptions,
): Promise<PrefixTree> {
  const maxDepth = Math.max(1, Math.trunc(opts.maxDepth ?? DEFAULT_DEPTH));
  const minCases = Math.max(1, Math.trunc(opts.minCases ?? 1));

  const report = await analyseVariants(client, dialect, { ...opts, limit: VARIANT_PAGE });

  const nodes = new Map<string, PrefixNode>();
  const root: PrefixNode = {
    id: '',
    activity: '',
    depth: 0,
    cases: 0,
    ends: 0,
    children: [],
    parent: null,
  };
  nodes.set('', root);

  let casesBeyondDepth = 0;

  for (const variant of report.variants) {
    root.cases += variant.cases;
    let parentId = '';

    for (let depth = 0; depth < variant.path.length; depth += 1) {
      if (depth >= maxDepth) {
        // Counted once per variant, not per remaining step: the question is how
        // many cases the tree could not show, not how many steps were dropped.
        casesBeyondDepth += variant.cases;
        break;
      }
      const activity = variant.path[depth]!;
      const id = parentId === '' ? activity : `${parentId}${SEPARATOR}${activity}`;

      let node = nodes.get(id);
      if (node === undefined) {
        node = {
          id,
          activity,
          depth: depth + 1,
          cases: 0,
          ends: 0,
          children: [],
          parent: parentId,
        };
        nodes.set(id, node);
        nodes.get(parentId)!.children.push(id);
      }
      node.cases += variant.cases;
      // A route that stops here ends here — which is what makes a leaf a real
      // outcome rather than the edge of the diagram.
      if (depth === variant.path.length - 1) node.ends += variant.cases;
      parentId = id;
    }
  }

  // Prune late so a rare prefix is still counted into its parent's total: a
  // node's case count must be the truth about the log, not the truth about the
  // subset that survived pruning.
  for (const node of nodes.values()) {
    node.children = node.children
      .filter((id) => (nodes.get(id)?.cases ?? 0) >= minCases)
      .sort((a, b) => (nodes.get(b)?.cases ?? 0) - (nodes.get(a)?.cases ?? 0) || a.localeCompare(b));
  }

  const reachable: PrefixNode[] = [];
  const queue: string[] = [''];
  while (queue.length > 0) {
    const node = nodes.get(queue.shift()!);
    if (node === undefined) continue;
    reachable.push(node);
    queue.push(...node.children);
  }

  const splits = reachable.filter((n) => n.children.length > 1);
  const widest =
    splits.length === 0
      ? null
      : splits.reduce((best, n) =>
          n.children.length * n.cases > best.children.length * best.cases ? n : best,
        );

  return {
    objectType: opts.objectType,
    nodes: reachable,
    totalCases: report.totalCases,
    maxDepth,
    casesBeyondDepth,
    widestSplit:
      widest === null
        ? null
        : {
            id: widest.id,
            activity: widest.activity === '' ? 'the start' : widest.activity,
            branches: widest.children.length,
            cases: widest.cases,
          },
  };
}

/** Separator inside a prefix id. Matches the variants report default. */
const SEPARATOR = ' → ';

// ---------------------------------------------------------------------------

export interface AlluvialFlow {
  /** Which column this flow leaves, 0-based. */
  fromStage: number;
  from: string;
  to: string;
  cases: number;
}

export interface Alluvial {
  objectType: string;
  /** Column labels, left to right. */
  stages: string[];
  /** Distinct values in each column, largest first. */
  bands: { stage: number; label: string; cases: number }[];
  flows: AlluvialFlow[];
  totalCases: number;
}

export interface AlluvialOptions extends LogQueryOptions {
  /** The case attribute that segments the population, e.g. 'channel'. */
  attribute: string;
  /** Routes kept as their own band; the rest merge. Default 8. */
  routeLimit?: number | undefined;
}

const DEFAULT_ROUTE_LIMIT = 8;
/** The band rare routes merge into, named so nobody reads it as one route. */
export const OTHER_ROUTE = 'other routes';
/** Where a case with no recorded value for the attribute is filed. */
export const UNKNOWN_SEGMENT = 'unknown';

/**
 * Segment, route and outcome as one three-column flow.
 *
 * The chart that makes a segmentation argument in a single picture: phone cases
 * take the escalation route and end in rejection, web cases do not. Every other
 * view here would need three tables and a reader willing to join them.
 */
export async function alluvial(
  client: SqlClient,
  dialect: SqlDialect,
  opts: AlluvialOptions,
): Promise<Alluvial> {
  const routeLimit = Math.max(1, Math.trunc(opts.routeLimit ?? DEFAULT_ROUTE_LIMIT));

  const params: unknown[] = [];
  const { sql: log, tables } = buildLog(dialect, params, opts);

  const hole = (value: unknown): string => {
    params.push(value);
    return dialect.placeholder(params.length);
  };

  // ts and event_id travel into the subquery because the ordered aggregate
  // above reads them: an unordered concat would merge two different routes that
  // happen to share a set of activities.
  const perCase = `SELECT case_id,
                          ${dialect.stringAgg('activity', SEPARATOR, 'ts, event_id')} AS route,
                          MAX(CASE WHEN rn = 1 THEN activity END) AS outcome
                   FROM (SELECT case_id, activity, ts, event_id,
                                ROW_NUMBER() OVER (PARTITION BY case_id ORDER BY ts DESC, event_id DESC) AS rn
                         FROM (${log}) o) r
                   GROUP BY case_id`;

  const withSegment = `SELECT k.case_id, k.route, k.outcome,
                              COALESCE((SELECT ca.value FROM ${tables.caseAttrs} ca
                                        WHERE ca.object_type = ${hole(opts.objectType)}
                                          AND ca.object_id = k.case_id
                                          AND ca.key = ${hole(opts.attribute)}
                                        LIMIT 1), ${hole(UNKNOWN_SEGMENT)}) AS segment
                       FROM (${perCase}) k`;

  const { rows } = await client.query(
    `SELECT segment, route, outcome, COUNT(*) AS cases
     FROM (${withSegment}) w GROUP BY 1, 2, 3`,
    params,
  );

  const triples = rows.map((row) => ({
    segment: String(row['segment']),
    route: String(row['route']),
    outcome: String(row['outcome'] ?? UNKNOWN_SEGMENT),
    cases: countOf(row['cases']),
  }));

  // Only the busiest routes keep their own band. A hundred slivers is not a
  // picture, and the merged band still carries its cases so the widths add up.
  const routeVolume = new Map<string, number>();
  for (const t of triples) routeVolume.set(t.route, (routeVolume.get(t.route) ?? 0) + t.cases);
  const keptRoutes = new Set(
    [...routeVolume.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, routeLimit)
      .map(([route]) => route),
  );

  const flows = new Map<string, AlluvialFlow>();
  const bands = new Map<string, { stage: number; label: string; cases: number }>();
  const add = (stage: number, label: string, cases: number): void => {
    const key = `${stage}:${label}`;
    const band = bands.get(key) ?? { stage, label, cases: 0 };
    band.cases += cases;
    bands.set(key, band);
  };
  const link = (fromStage: number, from: string, to: string, cases: number): void => {
    const key = `${fromStage}:${from}:${to}`;
    const flow = flows.get(key) ?? { fromStage, from, to, cases: 0 };
    flow.cases += cases;
    flows.set(key, flow);
  };

  let totalCases = 0;
  for (const t of triples) {
    const route = keptRoutes.has(t.route) ? t.route : OTHER_ROUTE;
    totalCases += t.cases;
    add(0, t.segment, t.cases);
    add(1, route, t.cases);
    add(2, t.outcome, t.cases);
    link(0, t.segment, route, t.cases);
    link(1, route, t.outcome, t.cases);
  }

  return {
    objectType: opts.objectType,
    stages: [opts.attribute, 'route', 'outcome'],
    bands: [...bands.values()].sort(
      (a, b) => a.stage - b.stage || b.cases - a.cases || a.label.localeCompare(b.label),
    ),
    flows: [...flows.values()].sort(
      (a, b) => a.fromStage - b.fromStage || b.cases - a.cases || a.from.localeCompare(b.from),
    ),
    totalCases,
  };
}

// ---------------------------------------------------------------------------

export interface Fingerprint {
  caseId: string;
  /** Indices into `activities`, in order. */
  steps: number[];
  cycleSeconds: number | null;
  /** True when the trace was longer than the cap and was cut. */
  truncated: boolean;
}

export interface FingerprintStrip {
  objectType: string;
  /** The palette: index into this to name a step. */
  activities: string[];
  /** One row per case, ordered as requested. */
  cases: Fingerprint[];
  totalCases: number;
  /** Longest trace returned, so a caller can size the strip. */
  maxSteps: number;
}

export type FingerprintSort = 'duration' | 'length' | 'start';

export interface FingerprintOptions extends LogQueryOptions {
  /** Cases returned. Default 500. */
  limit?: number | undefined;
  /** Steps per case before cutting. Default 60. */
  maxSteps?: number | undefined;
  /** What to order rows by. Default 'duration', which groups like with like. */
  sort?: FingerprintSort | undefined;
}

const DEFAULT_FINGERPRINT_LIMIT = 500;
const DEFAULT_MAX_STEPS = 60;

/**
 * Every case as a row of coloured blocks.
 *
 * Stack several hundred sorted by duration and the exceptions announce
 * themselves without anybody defining what an exception is — a band of rows
 * with an extra block in the middle is a detour, and it is visible before it is
 * named.
 *
 * Activities are returned as indices into a palette rather than as repeated
 * strings, which is what keeps a five-hundred-row strip small enough to send.
 */
export async function fingerprints(
  client: SqlClient,
  dialect: SqlDialect,
  opts: FingerprintOptions,
): Promise<FingerprintStrip> {
  const limit = Math.max(1, Math.trunc(opts.limit ?? DEFAULT_FINGERPRINT_LIMIT));
  const maxSteps = Math.max(1, Math.trunc(opts.maxSteps ?? DEFAULT_MAX_STEPS));
  const sort = opts.sort ?? 'duration';

  const params: unknown[] = [];
  const { sql: log } = buildLog(dialect, params, opts);

  const perCase = `SELECT case_id,
                          ${dialect.stringAgg('activity', SEPARATOR, 'ts, event_id')} AS route,
                          COUNT(*) AS events,
                          MIN(ts) AS first_ts,
                          ${CASE_CYCLE_SECONDS} AS cycle_s
                   FROM (${log}) f GROUP BY case_id`;

  const order =
    sort === 'length' ? 'events DESC' : sort === 'start' ? 'first_ts ASC' : 'cycle_s DESC';

  const [{ rows }, { rows: totals }] = await Promise.all([
    client.query(
      `SELECT * FROM (${perCase}) p ORDER BY ${order}, case_id ASC LIMIT ${limit}`,
      params,
    ),
    client.query(`SELECT COUNT(*) AS n FROM (${perCase}) t`, params),
  ]);

  const palette: string[] = [];
  const index = new Map<string, number>();
  const indexOf = (activity: string): number => {
    const found = index.get(activity);
    if (found !== undefined) return found;
    index.set(activity, palette.length);
    palette.push(activity);
    return palette.length - 1;
  };

  const cases: Fingerprint[] = rows.map((row) => {
    const path = String(row['route'] ?? '').split(SEPARATOR).filter((s) => s !== '');
    const truncated = path.length > maxSteps;
    return {
      caseId: String(row['case_id']),
      steps: path.slice(0, maxSteps).map(indexOf),
      cycleSeconds: numberOrNull(row['cycle_s']),
      truncated,
    };
  });

  return {
    objectType: opts.objectType,
    activities: palette,
    cases,
    totalCases: countOf(totals[0]?.['n']),
    maxSteps: cases.reduce((n, c) => Math.max(n, c.steps.length), 0),
  };
}
