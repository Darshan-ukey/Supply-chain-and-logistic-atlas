import { DfgView, type Dfg } from './dfg.js';

/**
 * Inductive Miner over the directly-follows graph (IMD).
 *
 * The Inductive Miner is the right default for discovery because of a
 * guarantee the older algorithms do not offer: **every tree it returns is
 * sound**. Alpha and Heuristics miners can both emit a model that deadlocks or
 * leaves tokens behind, which is a model nobody can replay, animate or
 * conformance-check. Here, when no cut is found the miner falls back to a
 * flower model — imprecise, but still sound and still honest about being a
 * fallback.
 *
 * This is the directly-follows variant: cuts are detected on the DFG rather
 * than by re-splitting the log at each recursion. That is what makes it linear
 * in log size (the log is touched exactly once, in SQL) instead of re-scanned
 * at every level, and it is the variant production tools ship.
 */

export type ProcessTree =
  | { op: 'activity'; label: string }
  /** The silent step. Makes a branch skippable without inventing an activity. */
  | { op: 'tau' }
  | { op: 'seq'; children: ProcessTree[] }
  | { op: 'xor'; children: ProcessTree[] }
  | { op: 'and'; children: ProcessTree[] }
  /** children[0] is the body, executed at least once; the rest are redo paths. */
  | { op: 'loop'; children: ProcessTree[] };

export type CutKind = 'xor' | 'seq' | 'and' | 'loop';

export interface MineResult {
  tree: ProcessTree;
  /** Cuts applied, outermost first — an audit trail of how the tree was derived. */
  cuts: CutKind[];
  /**
   * How many sub-graphs fell through to a flower model. Zero means the whole
   * log decomposed cleanly; a high count means the map is imprecise and the
   * caller should say so rather than present it as a discovered structure.
   */
  fallbacks: number;
  activityCount: number;
}

export interface MineOptions {
  /** Guard against pathological recursion on a huge, dense graph. */
  maxDepth?: number;
}

const DEFAULT_MAX_DEPTH = 200;

export function mineProcessTree(dfg: Dfg, opts: MineOptions = {}): MineResult {
  const view = DfgView.fromDfg(dfg);
  const state = { cuts: [] as CutKind[], fallbacks: 0 };
  const tree = mine(view, state, 0, opts.maxDepth ?? DEFAULT_MAX_DEPTH);
  return { tree, cuts: state.cuts, fallbacks: state.fallbacks, activityCount: view.size };
}

interface MineState {
  cuts: CutKind[];
  fallbacks: number;
}

function mine(view: DfgView, state: MineState, depth: number, maxDepth: number): ProcessTree {
  // --- base cases ----------------------------------------------------------
  if (view.size === 0) return { op: 'tau' };
  if (view.size === 1) {
    const [only] = [...view.activities];
    const label = only!;
    // A self-loop means the activity repeats: a (tau a)* — that is a+.
    return view.hasEdge(label, label)
      ? { op: 'loop', children: [{ op: 'activity', label }, { op: 'tau' }] }
      : { op: 'activity', label };
  }
  if (depth >= maxDepth) {
    state.fallbacks += 1;
    return flower(view);
  }

  // --- cuts, in the standard order ----------------------------------------
  const cut =
    findXorCut(view) ?? findSequenceCut(view) ?? findParallelCut(view) ?? findLoopCut(view);

  if (cut === null) {
    state.fallbacks += 1;
    return flower(view);
  }

  state.cuts.push(cut.kind);
  const partitions = orderPartitions(cut);
  const children = partitions.map((p) => mine(view.restrict(p), state, depth + 1, maxDepth));
  return { op: cut.kind, children } as ProcessTree;
}

/**
 * Give commutative operators a deterministic child order.
 *
 * `xor` and `and` mean the same thing however their branches are arranged, so
 * the order that falls out of graph traversal is arbitrary — and arbitrary
 * output makes two runs over the same log produce different trees. That breaks
 * model caching, model diffing, and the comparative mining that will want to
 * ask whether two cohorts discovered the SAME structure.
 *
 * `seq` and `loop` are ordered operators: their sequence carries meaning, and
 * for `loop` the first child is specifically the body. Both are left alone.
 */
function orderPartitions(cut: Cut): Set<string>[] {
  if (cut.kind !== 'xor' && cut.kind !== 'and') return cut.partitions;
  return [...cut.partitions].sort((a, b) => {
    const ka = [...a].sort().join('\u0000');
    const kb = [...b].sort().join('\u0000');
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });
}

/**
 * The flower model: any activity, any number of times, in any order.
 *
 * Deliberately the last resort. It fits every trace and predicts every
 * possible one, so it says almost nothing — but it is SOUND, and returning it
 * with `fallbacks` incremented is more honest than returning a confident
 * structure the data does not support.
 */
function flower(view: DfgView): ProcessTree {
  return {
    op: 'loop',
    children: [
      { op: 'tau' },
      ...[...view.activities].sort().map((label): ProcessTree => ({ op: 'activity', label })),
    ],
  };
}

interface Cut {
  kind: CutKind;
  partitions: Set<string>[];
}

// ---------------------------------------------------------------------------
// Exclusive choice
// ---------------------------------------------------------------------------

/**
 * Activities that never follow one another in either direction belong to
 * alternative branches. Connected components of the UNDIRECTED graph find
 * them directly.
 */
function findXorCut(view: DfgView): Cut | null {
  const components = undirectedComponents(view, view.activities);
  return components.length >= 2 ? { kind: 'xor', partitions: components } : null;
}

// ---------------------------------------------------------------------------
// Sequence
// ---------------------------------------------------------------------------

/**
 * A sequence cut needs partitions totally ordered by reachability: everything
 * in Σi reaches everything in Σj for i<j, and nothing comes back.
 *
 * Two activities must therefore share a partition when they are mutually
 * reachable (a genuine cycle) OR mutually unreachable (concurrent — ordering
 * them would assert an order the log never showed). Union-find closes that
 * relation transitively; the groups are then checked for a total order.
 */
function findSequenceCut(view: DfgView): Cut | null {
  const activities = [...view.activities];
  const reach = reachability(view);
  const uf = new UnionFind(activities);

  for (let i = 0; i < activities.length; i += 1) {
    for (let j = i + 1; j < activities.length; j += 1) {
      const a = activities[i]!;
      const b = activities[j]!;
      const ab = reach.get(a)!.has(b);
      const ba = reach.get(b)!.has(a);
      if (ab === ba) uf.union(a, b); // both reachable, or neither
    }
  }

  const groups = uf.groups();
  if (groups.length < 2) return null;

  // Order groups by reachability, then verify the order is genuinely total.
  const index = new Map<string, number>();
  groups.forEach((g, i) => {
    for (const a of g) index.set(a, i);
  });

  const before = groups.map(() => new Set<number>());
  for (const a of activities) {
    for (const b of reach.get(a)!) {
      const ia = index.get(a)!;
      const ib = index.get(b)!;
      if (ia !== ib) before[ia]!.add(ib);
    }
  }

  const order = groups.map((_, i) => i).sort((x, y) => before[y]!.size - before[x]!.size);
  for (let i = 0; i < order.length - 1; i += 1) {
    const from = order[i]!;
    const to = order[i + 1]!;
    // Consecutive groups must be ordered, and never in reverse.
    if (!before[from]!.has(to) || before[to]!.has(from)) return null;
  }

  return { kind: 'seq', partitions: order.map((i) => groups[i]!) };
}

// ---------------------------------------------------------------------------
// Parallel
// ---------------------------------------------------------------------------

/**
 * Concurrent branches: every activity in one partition is directly followed by
 * AND directly follows every activity in the others, because interleaving
 * produces both orders in the log.
 *
 * Found as connected components of the complement graph — a and b are joined
 * exactly when they are NOT fully interleaved, so whatever stays connected
 * cannot be split apart.
 *
 * Each partition must additionally contain a start and an end activity: a
 * branch that never starts or never finishes is not a concurrent branch, and
 * accepting one produces a model that can deadlock.
 */
function findParallelCut(view: DfgView): Cut | null {
  const activities = [...view.activities];
  const complement = new Map<string, Set<string>>(activities.map((a) => [a, new Set<string>()]));

  for (let i = 0; i < activities.length; i += 1) {
    for (let j = i + 1; j < activities.length; j += 1) {
      const a = activities[i]!;
      const b = activities[j]!;
      const interleaved = view.hasEdge(a, b) && view.hasEdge(b, a);
      if (!interleaved) {
        complement.get(a)!.add(b);
        complement.get(b)!.add(a);
      }
    }
  }

  const components = componentsOf(activities, (a) => complement.get(a) ?? new Set());
  if (components.length < 2) return null;

  for (const component of components) {
    const hasStart = [...component].some((a) => view.starts.has(a));
    const hasEnd = [...component].some((a) => view.ends.has(a));
    if (!hasStart || !hasEnd) return null;
  }
  return { kind: 'and', partitions: components };
}

// ---------------------------------------------------------------------------
// Loop
// ---------------------------------------------------------------------------

/**
 * A loop cut splits into a body — which holds every start and end activity —
 * and one or more redo parts entered only after the body finishes and left
 * only back into the body's start.
 *
 * Components that do not satisfy that are absorbed into the body rather than
 * rejecting the cut outright, which is the relaxation production implementations
 * use. The strict formulation additionally requires every redo part to connect
 * to EVERY end and start activity; real logs rarely satisfy it, and demanding it
 * sends almost every loop to the flower fallback.
 */
function findLoopCut(view: DfgView): Cut | null {
  if (view.starts.size === 0 || view.ends.size === 0) return null;

  const body = new Set<string>([...view.starts, ...view.ends]);
  const rest = new Set([...view.activities].filter((a) => !body.has(a)));
  if (rest.size === 0) return null;

  let candidates = undirectedComponents(view, rest);
  const redo: Set<string>[] = [];
  let changed = true;

  // Absorbing a component into the body can invalidate another component's
  // check (its edges may now touch a non-end body activity), so this repeats
  // until it stabilises rather than deciding in one pass.
  while (changed) {
    changed = false;
    redo.length = 0;
    const stillCandidates: Set<string>[] = [];

    for (const component of candidates) {
      if (isRedoPart(view, body, component)) {
        redo.push(component);
        stillCandidates.push(component);
      } else {
        for (const a of component) body.add(a);
        changed = true;
      }
    }
    candidates = stillCandidates;
    if (changed) continue;
  }

  if (redo.length === 0) return null;
  if (body.size === 0) return null;
  if (body.size === view.size) return null;

  return { kind: 'loop', partitions: [body, ...redo] };
}

function isRedoPart(view: DfgView, body: ReadonlySet<string>, component: ReadonlySet<string>): boolean {
  let enteredFromEnd = false;
  let returnsToStart = false;

  for (const b of body) {
    for (const c of component) {
      if (view.hasEdge(b, c)) {
        // The body may only hand off to a redo part from an END activity.
        if (!view.ends.has(b)) return false;
        enteredFromEnd = true;
      }
      if (view.hasEdge(c, b)) {
        // A redo part may only return to a START activity.
        if (!view.starts.has(b)) return false;
        returnsToStart = true;
      }
    }
  }
  // A component that neither enters nor returns is not a redo path at all.
  return enteredFromEnd && returnsToStart;
}

// ---------------------------------------------------------------------------
// Graph helpers
// ---------------------------------------------------------------------------

function undirectedComponents(view: DfgView, subset: ReadonlySet<string>): Set<string>[] {
  const neighbours = (a: string): Set<string> => {
    const out = new Set<string>();
    for (const b of view.successors(a)) if (subset.has(b) && b !== a) out.add(b);
    for (const b of view.predecessors(a)) if (subset.has(b) && b !== a) out.add(b);
    return out;
  };
  return componentsOf([...subset], neighbours);
}

function componentsOf(
  nodes: readonly string[],
  neighbours: (a: string) => ReadonlySet<string>,
): Set<string>[] {
  const seen = new Set<string>();
  const components: Set<string>[] = [];

  for (const node of nodes) {
    if (seen.has(node)) continue;
    const component = new Set<string>();
    const stack = [node];
    while (stack.length > 0) {
      const a = stack.pop()!;
      if (component.has(a)) continue;
      component.add(a);
      seen.add(a);
      for (const b of neighbours(a)) if (!component.has(b)) stack.push(b);
    }
    components.push(component);
  }
  return components;
}

/** Transitive reachability, by BFS from each node. Activity counts are small. */
function reachability(view: DfgView): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const a of view.activities) {
    out.set(a, view.reachableFrom(view.successors(a)));
  }
  return out;
}

class UnionFind {
  private readonly parent = new Map<string, string>();

  constructor(items: Iterable<string>) {
    for (const i of items) this.parent.set(i, i);
  }

  find(a: string): string {
    let root = a;
    while (this.parent.get(root) !== root) root = this.parent.get(root)!;
    let cursor = a;
    while (this.parent.get(cursor) !== root) {
      const next = this.parent.get(cursor)!;
      this.parent.set(cursor, root);
      cursor = next;
    }
    return root;
  }

  union(a: string, b: string): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent.set(ra, rb);
  }

  groups(): Set<string>[] {
    const byRoot = new Map<string, Set<string>>();
    for (const item of this.parent.keys()) {
      const root = this.find(item);
      let group = byRoot.get(root);
      if (group === undefined) {
        group = new Set();
        byRoot.set(root, group);
      }
      group.add(item);
    }
    return [...byRoot.values()];
  }
}

// ---------------------------------------------------------------------------
// Presentation
// ---------------------------------------------------------------------------

/** Compact process-tree notation: `->( 'a', X( 'b', 'c' ) )`. */
export function treeToString(tree: ProcessTree): string {
  switch (tree.op) {
    case 'activity':
      return `'${tree.label}'`;
    case 'tau':
      return 'tau';
    case 'seq':
      return `->( ${tree.children.map(treeToString).join(', ')} )`;
    case 'xor':
      return `X( ${tree.children.map(treeToString).join(', ')} )`;
    case 'and':
      return `+( ${tree.children.map(treeToString).join(', ')} )`;
    case 'loop':
      return `*( ${tree.children.map(treeToString).join(', ')} )`;
  }
}

/** Every activity label in the tree, in traversal order. */
export function treeActivities(tree: ProcessTree, into: string[] = []): string[] {
  if (tree.op === 'activity') into.push(tree.label);
  else if (tree.op !== 'tau') for (const c of tree.children) treeActivities(c, into);
  return into;
}

/** Node count, including operators — a rough proxy for model complexity. */
export function treeSize(tree: ProcessTree): number {
  if (tree.op === 'activity' || tree.op === 'tau') return 1;
  return 1 + tree.children.reduce((sum, c) => sum + treeSize(c), 0);
}
