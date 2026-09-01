import { UnsupportedError } from '../domain/errors.js';
import type { ProcessTree } from './inductive.js';

/**
 * Process tree to Petri net.
 *
 * Conformance checking needs an executable model, and a process tree is a
 * grammar rather than something you can put tokens through. The translation
 * below is the standard one, and it is worth doing properly rather than
 * approximating: the same net is what PNML export will serialise, so a shortcut
 * here would show up later as a model other tools disagree with.
 *
 * Every construction produces a net with exactly one source and one sink and
 * no dangling parts, which is what makes replay terminate and fitness mean
 * something.
 */

export interface Transition {
  id: string;
  /** null marks a silent (tau) transition — structural, never in the log. */
  label: string | null;
}

export interface Arc {
  from: string;
  to: string;
}

export interface PetriNet {
  places: string[];
  transitions: Transition[];
  arcs: Arc[];
  initial: string;
  final: string;
}

class NetBuilder {
  readonly places: string[] = [];
  readonly transitions: Transition[] = [];
  readonly arcs: Arc[] = [];
  private placeSeq = 0;
  private transitionSeq = 0;

  place(): string {
    const id = `p${(this.placeSeq += 1)}`;
    this.places.push(id);
    return id;
  }

  transition(label: string | null): string {
    const id = `t${(this.transitionSeq += 1)}`;
    this.transitions.push({ id, label });
    return id;
  }

  arc(from: string, to: string): void {
    this.arcs.push({ from, to });
  }
}

/** Translate a process tree into a sound, single-entry single-exit Petri net. */
export function treeToPetriNet(tree: ProcessTree): PetriNet {
  const b = new NetBuilder();
  const initial = b.place();
  const final = b.place();
  build(b, tree, initial, final);
  return {
    places: b.places,
    transitions: b.transitions,
    arcs: b.arcs,
    initial,
    final,
  };
}

function build(b: NetBuilder, node: ProcessTree, source: string, sink: string): void {
  switch (node.op) {
    case 'activity': {
      const t = b.transition(node.label);
      b.arc(source, t);
      b.arc(t, sink);
      return;
    }
    case 'tau': {
      const t = b.transition(null);
      b.arc(source, t);
      b.arc(t, sink);
      return;
    }
    case 'seq': {
      // Chain the children, threading a fresh place between each pair.
      let cursor = source;
      node.children.forEach((child, i) => {
        const last = i === node.children.length - 1;
        const next = last ? sink : b.place();
        build(b, child, cursor, next);
        cursor = next;
      });
      if (node.children.length === 0) build(b, { op: 'tau' }, source, sink);
      return;
    }
    case 'xor': {
      // Every branch shares the same entry and exit, so exactly one runs.
      if (node.children.length === 0) build(b, { op: 'tau' }, source, sink);
      for (const child of node.children) build(b, child, source, sink);
      return;
    }
    case 'and': {
      // A split transition puts one token into each branch; a join takes one
      // from each. Without the explicit split/join a branch could start twice.
      if (node.children.length === 0) {
        build(b, { op: 'tau' }, source, sink);
        return;
      }
      const split = b.transition(null);
      const join = b.transition(null);
      b.arc(source, split);
      b.arc(join, sink);
      for (const child of node.children) {
        const childIn = b.place();
        const childOut = b.place();
        b.arc(split, childIn);
        b.arc(childOut, join);
        build(b, child, childIn, childOut);
      }
      return;
    }
    case 'loop': {
      // *(A, B...) is A, then optionally B and A again, any number of times.
      // The body runs source -> sink; each redo path runs sink -> source,
      // which is what makes the repetition possible without a counter.
      const [body, ...redos] = node.children;
      if (body === undefined) {
        build(b, { op: 'tau' }, source, sink);
        return;
      }
      build(b, body, source, sink);
      for (const redo of redos) build(b, redo, sink, source);
      return;
    }
  }
}

// ---------------------------------------------------------------------------
// Marking and firing
// ---------------------------------------------------------------------------

/** Tokens per place. Absent means zero. */
export type Marking = ReadonlyMap<string, number>;

export function initialMarking(net: PetriNet): Marking {
  return new Map([[net.initial, 1]]);
}

export function finalMarking(net: PetriNet): Marking {
  return new Map([[net.final, 1]]);
}

/** A stable string for a marking, so visited-set lookups are cheap. */
export function markingKey(marking: Marking): string {
  return [...marking.entries()]
    .filter(([, n]) => n > 0)
    .sort(([a], [c]) => (a < c ? -1 : a > c ? 1 : 0))
    .map(([p, n]) => `${p}:${n}`)
    .join(',');
}

export function markingsEqual(a: Marking, b: Marking): boolean {
  return markingKey(a) === markingKey(b);
}

/** Index a net once; replay then runs without rescanning the arc list. */
export class NetIndex {
  readonly inputs = new Map<string, string[]>();
  readonly outputs = new Map<string, string[]>();
  readonly byLabel = new Map<string, string[]>();
  readonly silent: string[] = [];
  readonly labelOf = new Map<string, string | null>();

  constructor(readonly net: PetriNet) {
    for (const t of net.transitions) {
      this.inputs.set(t.id, []);
      this.outputs.set(t.id, []);
      this.labelOf.set(t.id, t.label);
      if (t.label === null) {
        this.silent.push(t.id);
      } else {
        const list = this.byLabel.get(t.label) ?? [];
        list.push(t.id);
        this.byLabel.set(t.label, list);
      }
    }
    const transitionIds = new Set(net.transitions.map((t) => t.id));
    for (const arc of net.arcs) {
      if (transitionIds.has(arc.to)) this.inputs.get(arc.to)!.push(arc.from);
      else if (transitionIds.has(arc.from)) this.outputs.get(arc.from)!.push(arc.to);
      else {
        throw new UnsupportedError(
          `malformed net: arc ${arc.from} -> ${arc.to} does not touch a transition`,
        );
      }
    }
  }

  hasLabel(label: string): boolean {
    return this.byLabel.has(label);
  }

  isEnabled(marking: Marking, transitionId: string): boolean {
    for (const place of this.inputs.get(transitionId) ?? []) {
      if ((marking.get(place) ?? 0) < 1) return false;
    }
    return true;
  }

  /** Fire a transition. Assumes enabled; callers force-enable first if needed. */
  fire(marking: Marking, transitionId: string): Map<string, number> {
    const next = new Map(marking);
    for (const place of this.inputs.get(transitionId) ?? []) {
      next.set(place, (next.get(place) ?? 0) - 1);
    }
    for (const place of this.outputs.get(transitionId) ?? []) {
      next.set(place, (next.get(place) ?? 0) + 1);
    }
    for (const [place, n] of [...next.entries()]) if (n <= 0) next.delete(place);
    return next;
  }

  /** Tokens a transition needs that the marking does not have. */
  missingFor(marking: Marking, transitionId: string): string[] {
    const missing: string[] = [];
    for (const place of this.inputs.get(transitionId) ?? []) {
      if ((marking.get(place) ?? 0) < 1) missing.push(place);
    }
    return missing;
  }

  tokenCount(marking: Marking): number {
    let total = 0;
    for (const n of marking.values()) total += Math.max(0, n);
    return total;
  }
}

/**
 * Find a sequence of SILENT transitions that makes `goal` enabled.
 *
 * Silent steps are invisible in the log but essential in the net — a skip, a
 * loop-back, a parallel split. Without searching for them, every model with a
 * tau in it would look unfit against a log that follows it perfectly.
 *
 * Breadth-first so the shortest route wins, and bounded so a net with many
 * silent transitions cannot make replay run away.
 */
export function silentPathTo(
  index: NetIndex,
  marking: Marking,
  isGoal: (m: Marking) => boolean,
  maxSteps = 24,
  maxVisited = 2000,
): { marking: Marking; fired: string[] } | null {
  if (isGoal(marking)) return { marking, fired: [] };

  const start = markingKey(marking);
  const visited = new Set<string>([start]);
  let frontier: { marking: Marking; fired: string[] }[] = [{ marking, fired: [] }];

  for (let step = 0; step < maxSteps; step += 1) {
    const next: { marking: Marking; fired: string[] }[] = [];
    for (const state of frontier) {
      for (const t of index.silent) {
        if (!index.isEnabled(state.marking, t)) continue;
        const advanced = index.fire(state.marking, t);
        const key = markingKey(advanced);
        if (visited.has(key)) continue;
        visited.add(key);
        const candidate = { marking: advanced, fired: [...state.fired, t] };
        if (isGoal(advanced)) return candidate;
        next.push(candidate);
        if (visited.size > maxVisited) return null;
      }
    }
    if (next.length === 0) return null;
    frontier = next;
  }
  return null;
}

/** Transitions carrying a visible label, for reporting what a model contains. */
export function modelActivities(net: PetriNet): string[] {
  return [...new Set(net.transitions.map((t) => t.label).filter((l): l is string => l !== null))].sort();
}
