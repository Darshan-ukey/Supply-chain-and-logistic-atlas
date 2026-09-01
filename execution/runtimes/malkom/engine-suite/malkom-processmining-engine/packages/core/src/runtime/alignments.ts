import type { SqlClient } from '../ports/sql.js';
import type { SqlDialect } from '../sql/dialect.js';
import type { ProcessTree } from './inductive.js';
import {
  NetIndex,
  finalMarking,
  initialMarking,
  markingKey,
  treeToPetriNet,
  type Marking,
  type PetriNet,
} from './petrinet.js';
import { analyseVariants, type VariantOptions } from './variants.js';

/**
 * Where a trace departs from the model, rather than how much.
 *
 * Token replay answers "does this fit" with a number. An alignment answers
 * "what happened instead", which is the question anybody actually has: 82%
 * fitness tells a compliance officer nothing they can act on, and "the credit
 * check was skipped, here, on these 340 cases" tells them everything.
 *
 * The difference matters because replay's number is not decomposable. A token
 * left behind says a transition could not fire; it does not say whether the log
 * did something extra, missed something required, or did the right things in
 * the wrong order — and those have different owners and different fixes.
 *
 * This is the standard A* alignment over the synchronous product of trace and
 * net. The cost model is the usual one and the reason it works is that it is
 * SYMMETRIC about what it blames: skipping a log event and firing a model
 * transition both cost one, so the cheapest explanation is not biased towards
 * calling the log wrong or the model wrong.
 *
 * Silent transitions cost nothing. They are structure — a skip, a loop back, a
 * parallel split — and were never going to appear in a log, so charging for
 * them would make every model with a tau in it look violated.
 */

/** What one step of an alignment did. */
export type MoveKind =
  /** The log and the model agreed. */
  | 'sync'
  /** The log did something the model did not allow at that point. */
  | 'log'
  /** The model required something the log never did. */
  | 'model'
  /** Structural model step, invisible in any log. Free. */
  | 'silent';

export interface Move {
  kind: MoveKind;
  /** The activity involved. Null on a silent move, which has no label. */
  activity: string | null;
  /** Position in the trace this move sits at, 0-based. */
  at: number;
}

export interface Alignment {
  moves: Move[];
  /** Total cost: one per log move, one per visible model move. */
  cost: number;
  /**
   * Cost as a share of the worst it could have been, inverted. 1 is perfect.
   *
   * The denominator is the trace length plus the shortest run through the
   * model, which is what an alignment would cost if nothing matched at all.
   */
  fitness: number;
  /**
   * False when the search hit its bound before finding an optimal alignment.
   *
   * Stated rather than swallowed: a truncated search returns the best it found,
   * which may not be the cheapest explanation, and a fitness computed from it
   * is a lower bound rather than the answer.
   */
  optimal: boolean;
}

/** Expansions before the search gives up on one trace. */
export const MAX_EXPANSIONS = 200_000;

/**
 * Align one trace against a net.
 *
 * Returns the cheapest sequence of moves that walks the trace from the initial
 * marking to the final one.
 */
export function alignTrace(
  net: PetriNet,
  trace: readonly string[],
  maxExpansions = MAX_EXPANSIONS,
): Alignment {
  const index = new NetIndex(net);
  const goal = finalMarking(net);
  const goalKey = markingKey(goal);

  // Admissible heuristic: every remaining event whose activity the net cannot
  // produce at all must become a log move, so it costs at least one each.
  // Anything the net CAN produce might still align for free, so it contributes
  // nothing to the estimate — an over-estimate here would make A* return a
  // cheap-looking alignment that is not the cheapest.
  const unmatchable: number[] = new Array(trace.length + 1).fill(0);
  for (let i = trace.length - 1; i >= 0; i -= 1) {
    unmatchable[i] = unmatchable[i + 1]! + (index.hasLabel(trace[i]!) ? 0 : 1);
  }

  interface State {
    at: number;
    marking: Marking;
    cost: number;
    priority: number;
    /** Linked back to the previous state, so the path is rebuilt without copying it. */
    move: Move | null;
    parent: State | null;
  }

  const start: State = {
    at: 0,
    marking: initialMarking(net),
    cost: 0,
    priority: unmatchable[0]!,
    move: null,
    parent: null,
  };

  const open = new Heap<State>((a, b) => a.priority - b.priority || b.at - a.at);
  open.push(start);
  const best = new Map<string, number>([[stateKey(start.at, start.marking), 0]]);

  let expansions = 0;
  let fallback: State = start;

  while (!open.isEmpty()) {
    const state = open.pop()!;
    const key = stateKey(state.at, state.marking);
    if ((best.get(key) ?? Infinity) < state.cost) continue;

    if (state.at === trace.length && markingKey(state.marking) === goalKey) {
      return finish(state, trace.length, index, net, true);
    }

    // Kept so a bounded search can still say something: the furthest the walk
    // got, rather than nothing at all.
    if (state.at > fallback.at) fallback = state;

    expansions += 1;
    if (expansions > maxExpansions) break;

    const consider = (next: State): void => {
      const nextKey = stateKey(next.at, next.marking);
      if ((best.get(nextKey) ?? Infinity) <= next.cost) return;
      best.set(nextKey, next.cost);
      open.push(next);
    };

    const event = state.at < trace.length ? trace[state.at]! : null;

    for (const transition of net.transitions) {
      if (!index.isEnabled(state.marking, transition.id)) continue;
      const marking = index.fire(state.marking, transition.id);
      const label = transition.label;

      if (label === null) {
        // Silent: structure, and free.
        consider({
          at: state.at,
          marking,
          cost: state.cost,
          priority: state.cost + unmatchable[state.at]!,
          move: { kind: 'silent', activity: null, at: state.at },
          parent: state,
        });
        continue;
      }

      if (event !== null && label === event) {
        // Synchronous: the log and the model agreed. Free, and the only move
        // that advances both.
        const cost = state.cost;
        consider({
          at: state.at + 1,
          marking,
          cost,
          priority: cost + unmatchable[state.at + 1]!,
          move: { kind: 'sync', activity: label, at: state.at },
          parent: state,
        });
      }

      // Model move: the model insists on this step and the log has no record.
      const cost = state.cost + 1;
      consider({
        at: state.at,
        marking,
        cost,
        priority: cost + unmatchable[state.at]!,
        move: { kind: 'model', activity: label, at: state.at },
        parent: state,
      });
    }

    // Log move: the log did something the model has no place for here.
    if (event !== null) {
      const cost = state.cost + 1;
      consider({
        at: state.at + 1,
        marking: state.marking,
        cost,
        priority: cost + unmatchable[state.at + 1]!,
        move: { kind: 'log', activity: event, at: state.at },
        parent: state,
      });
    }
  }

  return finish(fallback, trace.length, index, net, false);

  function finish(
    state: State,
    traceLength: number,
    netIndex: NetIndex,
    petri: PetriNet,
    optimal: boolean,
  ): Alignment {
    const moves: Move[] = [];
    for (let node: State | null = state; node?.move != null; node = node.parent) {
      moves.push(node.move);
    }
    moves.reverse();

    const worst = traceLength + shortestVisibleRun(netIndex, petri);
    return {
      moves,
      cost: state.cost,
      fitness: worst === 0 ? 1 : Math.max(0, 1 - state.cost / worst),
      optimal,
    };
  }
}

function stateKey(at: number, marking: Marking): string {
  return `${at}|${markingKey(marking)}`;
}

/**
 * Visible transitions on the shortest run from start to finish.
 *
 * The denominator for fitness: what an alignment would cost if the log matched
 * nothing at all and the model had to be walked from end to end alone. Cached
 * per net, since it is a property of the model rather than of the trace.
 */
const shortestRunCache = new WeakMap<PetriNet, number>();

function shortestVisibleRun(index: NetIndex, net: PetriNet): number {
  const cached = shortestRunCache.get(net);
  if (cached !== undefined) return cached;

  const goalKey = markingKey(finalMarking(net));
  const start = initialMarking(net);
  const seen = new Map<string, number>([[markingKey(start), 0]]);
  let frontier: Marking[] = [start];
  let answer = 0;

  // Uniform-cost over visible steps; silent steps are free and so are explored
  // within the same layer.
  for (let depth = 0; depth <= net.transitions.length * 2 && frontier.length > 0; depth += 1) {
    const next: Marking[] = [];
    const queue = [...frontier];
    while (queue.length > 0) {
      const marking = queue.shift()!;
      if (markingKey(marking) === goalKey) {
        shortestRunCache.set(net, depth);
        return depth;
      }
      for (const transition of net.transitions) {
        if (!index.isEnabled(marking, transition.id)) continue;
        const advanced = index.fire(marking, transition.id);
        const key = markingKey(advanced);
        const cost = transition.label === null ? depth : depth + 1;
        if ((seen.get(key) ?? Infinity) <= cost) continue;
        seen.set(key, cost);
        if (transition.label === null) queue.push(advanced);
        else next.push(advanced);
      }
    }
    frontier = next;
    answer = depth + 1;
  }

  shortestRunCache.set(net, answer);
  return answer;
}

/** A binary heap, because a sorted insert over a large frontier is quadratic. */
class Heap<T> {
  private readonly items: T[] = [];
  constructor(private readonly compare: (a: T, b: T) => number) {}

  isEmpty(): boolean {
    return this.items.length === 0;
  }

  push(item: T): void {
    this.items.push(item);
    let at = this.items.length - 1;
    while (at > 0) {
      const parent = (at - 1) >> 1;
      if (this.compare(this.items[at]!, this.items[parent]!) >= 0) break;
      [this.items[at], this.items[parent]] = [this.items[parent]!, this.items[at]!];
      at = parent;
    }
  }

  pop(): T | undefined {
    const top = this.items[0];
    const last = this.items.pop();
    if (this.items.length > 0 && last !== undefined) {
      this.items[0] = last;
      let at = 0;
      for (;;) {
        const left = at * 2 + 1;
        const right = left + 1;
        let small = at;
        if (left < this.items.length && this.compare(this.items[left]!, this.items[small]!) < 0) {
          small = left;
        }
        if (right < this.items.length && this.compare(this.items[right]!, this.items[small]!) < 0) {
          small = right;
        }
        if (small === at) break;
        [this.items[at], this.items[small]] = [this.items[small]!, this.items[at]!];
        at = small;
      }
    }
    return top;
  }
}

// ---------------------------------------------------------------------------

export interface Deviation {
  kind: 'log' | 'model';
  activity: string;
  /** Cases in which this deviation occurred. */
  cases: number;
  /** Times it occurred, which exceeds `cases` when it repeats within one. */
  occurrences: number;
  /** Plain statement of what it means. */
  reading: string;
}

export interface AlignedVariant {
  path: string[];
  cases: number;
  moves: Move[];
  cost: number;
  fitness: number;
  optimal: boolean;
}

export interface AlignmentReport {
  objectType: string;
  /** Variants aligned, most frequent first. */
  variants: AlignedVariant[];
  /** Cases covered by those variants. */
  casesAligned: number;
  totalCases: number;
  /** casesAligned / totalCases. */
  coverage: number;
  /** Case-weighted mean fitness across what was aligned, 0-1. */
  fitness: number;
  /** Every deviation, worst first — the thing an audit reads. */
  deviations: Deviation[];
  /** Variants whose search hit its bound, so their cost is a lower bound. */
  boundedSearches: number;
}

export interface AlignmentOptions extends VariantOptions {
  /** The model to align against. */
  model: ProcessTree;
  /** Variants to align, most frequent first. Default 100. */
  variantLimit?: number | undefined;
}

const DEFAULT_VARIANT_LIMIT = 100;

/**
 * Align a log against a model, variant by variant.
 *
 * Per variant rather than per case, for the reason conformance already replays
 * per variant: every case following the same route produces the same alignment,
 * and aligning it once and weighting by frequency is exact rather than an
 * approximation.
 */
export async function alignLog(
  client: SqlClient,
  dialect: SqlDialect,
  opts: AlignmentOptions,
): Promise<AlignmentReport> {
  const variantLimit = Math.max(1, Math.trunc(opts.variantLimit ?? DEFAULT_VARIANT_LIMIT));
  const net = treeToPetriNet(opts.model);

  const report = await analyseVariants(client, dialect, { ...opts, limit: variantLimit });

  const variants: AlignedVariant[] = [];
  const deviations = new Map<string, Deviation>();
  let casesAligned = 0;
  let weightedFitness = 0;
  let boundedSearches = 0;

  for (const variant of report.variants) {
    const alignment = alignTrace(net, variant.path);
    variants.push({
      path: variant.path,
      cases: variant.cases,
      moves: alignment.moves,
      cost: alignment.cost,
      fitness: alignment.fitness,
      optimal: alignment.optimal,
    });

    casesAligned += variant.cases;
    weightedFitness += alignment.fitness * variant.cases;
    if (!alignment.optimal) boundedSearches += 1;

    const seenHere = new Set<string>();
    for (const move of alignment.moves) {
      if (move.kind === 'sync' || move.kind === 'silent' || move.activity === null) continue;
      const key = `${move.kind}:${move.activity}`;
      const found = deviations.get(key) ?? {
        kind: move.kind,
        activity: move.activity,
        cases: 0,
        occurrences: 0,
        reading:
          move.kind === 'log'
            ? `${move.activity} happened where the model does not allow it`
            : `the model requires ${move.activity} and the log has no record of it`,
      };
      found.occurrences += variant.cases;
      if (!seenHere.has(key)) {
        found.cases += variant.cases;
        seenHere.add(key);
      }
      deviations.set(key, found);
    }
  }

  return {
    objectType: opts.objectType,
    variants,
    casesAligned,
    totalCases: report.totalCases,
    coverage: report.totalCases === 0 ? 0 : casesAligned / report.totalCases,
    fitness: casesAligned === 0 ? 1 : weightedFitness / casesAligned,
    deviations: [...deviations.values()].sort(
      (a, b) => b.cases - a.cases || a.activity.localeCompare(b.activity),
    ),
    boundedSearches,
  };
}
