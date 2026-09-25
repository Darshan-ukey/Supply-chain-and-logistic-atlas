import { countOf } from '../domain/identifiers.js';
import type { SqlClient } from '../ports/sql.js';
import type { SqlDialect } from '../sql/dialect.js';
import type { Dfg } from './dfg.js';
import { eventOrderBy } from './eventlog.js';
import { buildLog, type LogQueryOptions } from './logquery.js';

/**
 * Dependency strength: telling a real ordering from a coincidence.
 *
 * The directly-follows graph counts how often one activity was observed
 * immediately after another, and a map drawn from those counts alone cannot
 * distinguish two very different situations:
 *
 *   Send Invoice -> Receive Payment    890 one way, 12 the other
 *   Update Address -> Update Phone     200 one way, 190 the other
 *
 * The first is a dependency. The second is two activities that happen to both
 * occur, in whatever order the day went, with no relationship at all. Drawn as
 * arcs they look alike, and the second asserts a causal ordering the log does
 * not support — which is how somebody ends up re-engineering a sequence that
 * was never a sequence.
 *
 * The measure below is the Heuristics Miner's dependency relation:
 *
 *   dep(a,b) = (|a>b| - |b>a|) / (|a>b| + |b>a| + 1)
 *
 * It ranges over -1..1: near 1 means a reliably leads to b, near 0 means the
 * two merely co-occur, negative means the arc points the wrong way. The `+ 1`
 * in the denominator is not cosmetic — it is what stops a single observed
 * transition scoring as confidently as ten thousand.
 *
 * This module deliberately produces an ANNOTATION, not a model. The Heuristics
 * Miner's own output carries no soundness guarantee, so it can deadlock, and a
 * model that deadlocks cannot be replayed, animated or conformance-checked.
 * Discovery stays with the Inductive Miner; what is added here is a per-arc
 * confidence the discovered map can be shaded by.
 *
 * Everything except `lengthTwoLoopCounts` is a pure function over a graph the
 * engine already holds, so no extraction, storage or configuration changes.
 */

/** How an observed ordering between two activities should be read. */
export type DependencyKind =
  /** One direction dominates: the ordering is real. */
  | 'dependency'
  /** Both directions occur about equally: the activities co-occur, unordered. */
  | 'co-occurrence'
  /** Part of an a -> b -> a alternation rather than a one-way step. */
  | 'short-loop';

export interface DependencyEdge {
  from: string;
  to: string;
  /** Times `to` was observed immediately after `from`. */
  frequency: number;
  /** Times the reverse was observed. Zero when the arc never runs backwards. */
  reverseFrequency: number;
  /** -1..1. See the module note for the formula and how to read it. */
  dependency: number;
  /**
   * Observations the measure rests on, both directions summed.
   *
   * Reported so a caller can decline to draw a conclusion from a handful of
   * events. The signals module already refuses to fire a mined trigger below a
   * support floor for the same reason: a prefix seen twice, both of which went
   * badly, is not a 100% risk.
   */
  support: number;
  /** False when `support` is below the configured floor. */
  reliable: boolean;
  kind: DependencyKind;
}

export interface SelfLoop {
  activity: string;
  /** Times the activity was immediately followed by itself. */
  frequency: number;
  /** |a>a| / (|a>a| + 1) — the length-one loop measure. */
  dependency: number;
}

export interface LengthTwoLoop {
  /** The pair, ordered lexically so it appears once rather than twice. */
  a: string;
  b: string;
  /** |a>b>a| + |b>a>b| — alternations observed in either phase. */
  occurrences: number;
  dependency: number;
}

/** Whether the branches leaving (or entering) an activity interleave. */
export type BranchKind =
  /** One branch only — nothing to decide. */
  | 'single'
  /** The branches were observed to interleave: they run together. */
  | 'and'
  /** The branches exclude each other: exactly one is taken. */
  | 'xor'
  /** Some pairs interleave and some do not. */
  | 'mixed';

export interface Branch {
  activity: string;
  /** Successors for a split, predecessors for a join. */
  branches: string[];
  kind: BranchKind;
  /**
   * 0..1, averaged across branch pairs.
   *
   * For a pair (b,c) leaving a: (|b>c| + |c>b|) / (|a>b| + |a>c| + 1). High
   * means the two were seen running in either order, which is what concurrency
   * looks like in a log — there is no parallel marker to read.
   */
  andMeasure: number;
}

export interface DependencyThresholds {
  /** Above this absolute dependency, an arc is called a dependency. */
  dependency: number;
  /** Observations below which an arc is reported as unreliable. */
  minSupport: number;
  /** Above this and-measure, branches are called concurrent. */
  and: number;
}

export interface DependencyGraph {
  objectType: string;
  /** One entry per observed arc, in the DFG's own order. */
  edges: DependencyEdge[];
  selfLoops: SelfLoop[];
  /**
   * Alternating pairs, when counts were supplied.
   *
   * Empty with `lengthTwoLoopsMeasured: false` when they were not — an absent
   * measurement is not an absence of loops.
   */
  lengthTwoLoops: LengthTwoLoop[];
  lengthTwoLoopsMeasured: boolean;
  splits: Branch[];
  joins: Branch[];
  /** Echoed so a reader knows what produced the classification. */
  thresholds: DependencyThresholds;
}

/** One a -> b -> a alternation count, as `lengthTwoLoopCounts` returns them. */
export interface LengthTwoCount {
  from: string;
  via: string;
  occurrences: number;
}

export interface DependencyOptions {
  /** Default 0.8. */
  dependencyThreshold?: number;
  /** Default 5. */
  minSupport?: number;
  /** Default 0.5. */
  andThreshold?: number;
  /** Counts from `lengthTwoLoopCounts`. Omitted means not measured. */
  lengthTwoCounts?: readonly LengthTwoCount[] | undefined;
}

const DEFAULT_DEPENDENCY = 0.8;
const DEFAULT_MIN_SUPPORT = 5;
const DEFAULT_AND = 0.5;

/**
 * NUL joins the halves of a pair key.
 *
 * The same choice `abstractNodes` makes, for the same reason: an activity name
 * may contain any printable character, so a visible separator could collide and
 * silently merge two different arcs.
 */
const SEP = '\u0000';

function pairKey(from: string, to: string): string {
  return `${from}${SEP}${to}`;
}

/** Order-independent key, so a>b and b>a land on the same pair. */
function unorderedKey(a: string, b: string): string {
  return a <= b ? pairKey(a, b) : pairKey(b, a);
}

export function dependencyGraph(dfg: Dfg, opts: DependencyOptions = {}): DependencyGraph {
  const thresholds: DependencyThresholds = {
    dependency: opts.dependencyThreshold ?? DEFAULT_DEPENDENCY,
    minSupport: opts.minSupport ?? DEFAULT_MIN_SUPPORT,
    and: opts.andThreshold ?? DEFAULT_AND,
  };

  const frequency = new Map<string, number>();
  for (const edge of dfg.edges) frequency.set(pairKey(edge.from, edge.to), edge.frequency);
  const freq = (from: string, to: string): number => frequency.get(pairKey(from, to)) ?? 0;

  // Alternations are keyed unordered: a>b>a and b>a>b are the same loop seen in
  // its two phases, and reporting them separately doubles one problem.
  const alternations = new Map<string, number>();
  for (const count of opts.lengthTwoCounts ?? []) {
    const key = unorderedKey(count.from, count.via);
    alternations.set(key, (alternations.get(key) ?? 0) + count.occurrences);
  }

  const edges: DependencyEdge[] = [];
  const selfLoops: SelfLoop[] = [];

  for (const edge of dfg.edges) {
    if (edge.from === edge.to) {
      selfLoops.push({
        activity: edge.from,
        frequency: edge.frequency,
        dependency: edge.frequency / (edge.frequency + 1),
      });
      continue;
    }

    const forward = edge.frequency;
    const reverse = freq(edge.to, edge.from);
    const support = forward + reverse;
    const dependency = (forward - reverse) / (support + 1);

    // Order of tests matters. An alternating pair scores LOW on the plain
    // dependency measure because both directions are frequent, so testing for
    // co-occurrence first would file every genuine loop as "unrelated".
    const kind: DependencyKind = alternations.has(unorderedKey(edge.from, edge.to))
      ? 'short-loop'
      : Math.abs(dependency) >= thresholds.dependency
        ? 'dependency'
        : 'co-occurrence';

    edges.push({
      from: edge.from,
      to: edge.to,
      frequency: forward,
      reverseFrequency: reverse,
      dependency,
      support,
      reliable: support >= thresholds.minSupport,
      kind,
    });
  }

  const lengthTwoLoops: LengthTwoLoop[] = [...alternations.entries()]
    .map(([key, occurrences]) => {
      const [a = '', b = ''] = key.split(SEP);
      return { a, b, occurrences, dependency: occurrences / (occurrences + 1) };
    })
    .sort((x, y) => y.occurrences - x.occurrences || x.a.localeCompare(y.a));

  const successors = new Map<string, string[]>();
  const predecessors = new Map<string, string[]>();
  for (const edge of dfg.edges) {
    if (edge.from === edge.to) continue;
    push(successors, edge.from, edge.to);
    push(predecessors, edge.to, edge.from);
  }

  return {
    objectType: dfg.objectType,
    edges,
    selfLoops: selfLoops.sort(
      (a, b) => b.frequency - a.frequency || a.activity.localeCompare(b.activity),
    ),
    lengthTwoLoops,
    lengthTwoLoopsMeasured: opts.lengthTwoCounts !== undefined,
    splits: branches(successors, freq, thresholds, 'split'),
    joins: branches(predecessors, freq, thresholds, 'join'),
    thresholds,
  };
}

function push(map: Map<string, string[]>, key: string, value: string): void {
  const existing = map.get(key);
  if (existing === undefined) map.set(key, [value]);
  else existing.push(value);
}

/**
 * Classify each activity's branches as concurrent or exclusive.
 *
 * A split asks about its successors and a join about its predecessors, but the
 * arithmetic is identical once the neighbours are known: the question is
 * whether those neighbours were ever observed running in both orders relative
 * to one another.
 */
function branches(
  neighbours: Map<string, string[]>,
  freq: (from: string, to: string) => number,
  thresholds: DependencyThresholds,
  direction: 'split' | 'join',
): Branch[] {
  const out: Branch[] = [];

  for (const [activity, raw] of neighbours) {
    const list = [...new Set(raw)].sort();
    if (list.length < 2) {
      out.push({ activity, branches: list, kind: 'single', andMeasure: 0 });
      continue;
    }

    const measures: number[] = [];
    for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        const b = list[i]!;
        const c = list[j]!;
        const between = freq(b, c) + freq(c, b);
        const through =
          direction === 'split'
            ? freq(activity, b) + freq(activity, c)
            : freq(b, activity) + freq(c, activity);
        measures.push(between / (through + 1));
      }
    }

    const concurrent = measures.filter((m) => m >= thresholds.and).length;
    const kind: BranchKind =
      concurrent === measures.length ? 'and' : concurrent === 0 ? 'xor' : 'mixed';

    out.push({
      activity,
      branches: list,
      kind,
      andMeasure: measures.reduce((a, b) => a + b, 0) / measures.length,
    });
  }

  return out.sort((a, b) => a.activity.localeCompare(b.activity));
}

/**
 * Count a -> b -> a alternations, in the database.
 *
 * Two activities that alternate produce a high count in both directions, so the
 * plain dependency measure reads them as unrelated. They are neither unrelated
 * nor a one-way step, and the distinction matters: an alternation is usually a
 * negotiation, a chase or a correction cycle — a finding rather than noise.
 *
 * Counted at the second `a`, so a case running a>b>a>b>a contributes two, which
 * is the number of completed alternations it actually performed.
 */
export async function lengthTwoLoopCounts(
  client: SqlClient,
  dialect: SqlDialect,
  opts: LogQueryOptions,
): Promise<LengthTwoCount[]> {
  const params: unknown[] = [];
  const { sql: log } = buildLog(dialect, params, opts);
  const order = eventOrderBy('');

  const lagged = `
    SELECT activity,
           LAG(activity, 1) OVER (PARTITION BY case_id ORDER BY ${order}) AS prev1,
           LAG(activity, 2) OVER (PARTITION BY case_id ORDER BY ${order}) AS prev2
    FROM (${log}) p`;

  const { rows } = await client.query(
    `SELECT prev2 AS a, prev1 AS b, COUNT(*) AS n
     FROM (${lagged}) w
     WHERE prev1 IS NOT NULL AND prev2 IS NOT NULL
       AND activity = prev2 AND activity <> prev1
     GROUP BY 1, 2
     ORDER BY 3 DESC, 1, 2`,
    params,
  );

  return rows.map((r) => ({
    from: String(r['a']),
    via: String(r['b']),
    occurrences: countOf(r['n']),
  }));
}
