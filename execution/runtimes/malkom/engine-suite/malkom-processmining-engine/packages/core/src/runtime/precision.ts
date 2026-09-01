import type { ProcessTree } from './inductive.js';
import {
  initialMarking,
  modelActivities,
  NetIndex,
  silentPathTo,
  treeToPetriNet,
  type Marking,
} from './petrinet.js';

/**
 * Precision — the half of conformance that fitness cannot see.
 *
 * Fitness asks "can the model explain what happened". A model that permits
 * everything answers yes to that every time, which is why a flower model
 * scores 100% fitness against any log whatsoever. Precision asks the opposite
 * question: **of everything the model allows, how much does the log actually
 * do?** A flower scores near zero.
 *
 * The two together are the honest pair, and reporting fitness alone — which is
 * what this engine did until precision existed — invites a reader to conclude
 * a process is under control when the model was simply too permissive to
 * disagree with anything.
 *
 * The measure implemented here is escaping-edges precision (Muñoz-Gama &
 * Carmona): walk each trace through the model, and at every state compare the
 * activities the model would allow next against the activities the log was
 * ever observed to do next from that same state. Every allowed-but-unused
 * option is an escaping edge.
 */

export interface PrecisionResult {
  /** 0–1. High means the model is tight around the observed behaviour. */
  precision: number;
  /** States visited during the walk. */
  states: number;
  /** Allowed-but-never-taken options, weighted by how often the state occurred. */
  escapingEdges: number;
  /** Total options the model allowed, weighted the same way. */
  allowedEdges: number;
  /** The states that permit the most unused behaviour — where the model is loosest. */
  loosestStates: LooseState[];
}

export interface LooseState {
  /** The activity sequence that reaches this state, truncated for display. */
  prefix: string[];
  /** How many cases pass through it. */
  weight: number;
  observed: string[];
  /** Activities the model allows here that the log never does. */
  escaping: string[];
}

export interface WeightedTrace {
  path: readonly string[];
  /** Cases following this exact path. */
  weight: number;
}

interface StateRecord {
  prefix: string[];
  weight: number;
  observed: Set<string>;
  enabled: Set<string>;
}

const DEFAULT_LOOSEST_LIMIT = 10;

/**
 * Unit separator. Joining a prefix with an empty string would make ['ab'] and
 * ['a','b'] the same state, silently merging two different points in the
 * process.
 */
const PREFIX_SEP = String.fromCharCode(31);

/**
 * Compute precision for a model against a set of weighted traces.
 *
 * Traces are weighted variants rather than individual cases, for the same
 * reason replay is: two cases with the same activity sequence visit exactly
 * the same states, so counting them separately changes nothing but the cost.
 */
export function measurePrecision(
  model: ProcessTree,
  traces: readonly WeightedTrace[],
  opts: { loosestLimit?: number } = {},
): PrecisionResult {
  const net = treeToPetriNet(model);
  const index = new NetIndex(net);
  const labels = new Set(modelActivities(net));
  const states = new Map<string, StateRecord>();

  for (const trace of traces) {
    let marking: Marking = initialMarking(net);
    const prefix: string[] = [];

    for (const activity of trace.path) {
      // States are keyed by the LOG PREFIX, not by the model's marking.
      //
      // This is the whole measure. A flower model returns to the same marking
      // after every activity, so marking-keyed states collapse the entire log
      // into one state where — across all traces — every activity eventually
      // gets observed. Precision then reports 1.0 for a model that permits
      // everything, which is precisely the failure it exists to detect.
      //
      // Keyed by prefix, "what happened after A_SUBMITTED" is its own state:
      // the log does one thing there, the flower allows twenty-three, and the
      // ratio says so.
      const key = prefix.join(PREFIX_SEP);
      let record = states.get(key);
      if (record === undefined) {
        record = {
          prefix: [...prefix],
          weight: 0,
          observed: new Set(),
          enabled: enabledActivities(index, marking, labels),
        };
        states.set(key, record);
      }
      record.weight += trace.weight;
      record.observed.add(activity);

      // Advance. An activity the model cannot accept here leaves the marking
      // where it is: the trace has departed from the model, and precision is
      // not the measure that reports that — fitness is.
      if (!labels.has(activity)) {
        prefix.push(activity);
        continue;
      }
      const candidates = index.byLabel.get(activity) ?? [];
      const reached = silentPathTo(index, marking, (m) =>
        candidates.some((t) => index.isEnabled(m, t)),
      );
      if (reached === null) {
        prefix.push(activity);
        continue;
      }
      marking = reached.marking;
      const enabled = candidates.find((t) => index.isEnabled(marking, t));
      if (enabled === undefined) {
        prefix.push(activity);
        continue;
      }
      marking = index.fire(marking, enabled);
      prefix.push(activity);
    }
  }

  let weightedObserved = 0;
  let weightedAllowed = 0;
  let escaping = 0;
  const loose: LooseState[] = [];

  for (const record of states.values()) {
    // Only options the model actually offers count as allowed; an activity the
    // log did that the model forbids is a fitness problem, not a precision one.
    const allowedHere = record.enabled.size;
    if (allowedHere === 0) continue;
    const observedHere = [...record.observed].filter((a) => record.enabled.has(a)).length;

    weightedObserved += record.weight * observedHere;
    weightedAllowed += record.weight * allowedHere;

    const escapingHere = [...record.enabled].filter((a) => !record.observed.has(a));
    escaping += record.weight * escapingHere.length;

    if (escapingHere.length > 0) {
      loose.push({
        prefix: record.prefix.slice(-6),
        weight: record.weight,
        observed: [...record.observed].sort(),
        escaping: escapingHere.sort(),
      });
    }
  }

  return {
    precision: weightedAllowed > 0 ? weightedObserved / weightedAllowed : 1,
    states: states.size,
    escapingEdges: escaping,
    allowedEdges: weightedAllowed,
    loosestStates: loose
      .sort((a, b) => b.weight * b.escaping.length - a.weight * a.escaping.length)
      .slice(0, opts.loosestLimit ?? DEFAULT_LOOSEST_LIMIT),
  };
}

/**
 * Which visible activities the model can perform from this marking, allowing
 * silent steps to be taken first.
 *
 * Silent steps have to be followed or the count is wrong in both directions: a
 * model whose next real choice sits behind a tau would appear to allow nothing,
 * and precision would be overstated to 1.
 */
function enabledActivities(
  index: NetIndex,
  marking: Marking,
  labels: ReadonlySet<string>,
): Set<string> {
  const enabled = new Set<string>();
  for (const label of labels) {
    const candidates = index.byLabel.get(label) ?? [];
    if (candidates.some((t) => index.isEnabled(marking, t))) {
      enabled.add(label);
      continue;
    }
    const reached = silentPathTo(
      index,
      marking,
      (m) => candidates.some((t) => index.isEnabled(m, t)),
      8, // shallower than replay: this runs once per label per state
      300,
    );
    if (reached !== null) enabled.add(label);
  }
  return enabled;
}

/**
 * The single number that balances the two.
 *
 * Neither measure is useful alone: a flower has fitness 1 and precision near 0,
 * while a model listing only the single most common trace has precision 1 and
 * dreadful fitness. The harmonic mean punishes a model that wins one by
 * abandoning the other, which is exactly the failure mode both invite.
 */
export function fScore(fitness: number, precision: number): number {
  if (fitness <= 0 || precision <= 0) return 0;
  return (2 * fitness * precision) / (fitness + precision);
}

/** A plain-language reading of the fitness/precision pair. */
export function interpretQuality(fitness: number, precision: number): string {
  const good = 0.8;
  const poor = 0.5;
  if (fitness >= good && precision >= good) {
    return 'the model both explains what happened and stays close to it — a trustworthy reference';
  }
  if (fitness >= good && precision < poor) {
    return 'the model explains everything because it permits almost everything; its high fitness is not evidence of compliance';
  }
  if (fitness < poor && precision >= good) {
    return 'the model is specific but much of the log departs from it — either the process has changed or the model was never followed';
  }
  if (fitness < poor && precision < poor) {
    return 'the model neither explains the log nor constrains it; it is not a useful reference for this data';
  }
  return 'the model is a partial fit — usable as a starting point, not as a compliance baseline';
}
