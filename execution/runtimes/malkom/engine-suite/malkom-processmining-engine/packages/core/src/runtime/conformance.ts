import type { SqlClient } from '../ports/sql.js';
import type { SqlDialect } from '../sql/dialect.js';
import type { ProcessTree } from './inductive.js';
import {
  initialMarking,
  markingKey,
  modelActivities,
  NetIndex,
  silentPathTo,
  treeToPetriNet,
  type Marking,
  type PetriNet,
} from './petrinet.js';
import { fScore, interpretQuality, measurePrecision, type PrecisionResult } from './precision.js';
import { analyseVariants, type VariantOptions } from './variants.js';

/**
 * Conformance checking by token-based replay.
 *
 * Discovery answers "what happens". This answers "where does what happens
 * differ from what is supposed to happen" — which is the compliance and audit
 * question, and a different one.
 *
 * Each trace is replayed through the model as tokens. Where the model cannot
 * produce a token the trace needs, a token is BORROWED and counted: that is a
 * step done out of order, or done without its prerequisite. Where tokens are
 * left behind at the end, the case stopped short of finishing the model.
 * Fitness is the standard combination of the two.
 *
 * Replay runs once per distinct VARIANT and is weighted by case count, not
 * once per case. A million cases following forty paths is forty replays. The
 * numbers are identical because two cases with the same activity sequence
 * replay identically by construction.
 */

export interface ConformanceOptions extends VariantOptions {
  /** The intended process. Usually discovered from a known-good period, then frozen. */
  model: ProcessTree;
  /** Deviating variants to report, worst first. Default 25. */
  deviationLimit?: number;
}

export interface ActivityDeviation {
  activity: string;
  kind: 'not-in-model' | 'out-of-order' | 'skipped';
  /** Cases affected, weighted by variant frequency. */
  cases: number;
  /** Occurrences across all cases. */
  occurrences: number;
  explanation: string;
}

export interface VariantConformance {
  rank: number;
  path: string[];
  cases: number;
  /** 0–1, where 1 is a trace the model explains exactly. */
  fitness: number;
  fitsPerfectly: boolean;
  /** Activities the trace performed that the model could not accept there. */
  problems: string[];
}

export interface ConformanceReport {
  objectType: string;
  totalCases: number;
  variantsReplayed: number;
  /**
   * Cases actually covered by the replay. Below totalCases when the variant
   * page was capped — every rate below is computed over THIS number, and
   * reporting one without the other would overstate the result.
   */
  casesReplayed: number;
  /** casesReplayed / totalCases. 1 means the whole log was checked. */
  coverage: number;
  /**
   * True when the model accepts essentially anything — a flower fallback, or a
   * model with no visible structure. Fitness against such a model is close to
   * 100% by construction and says nothing about compliance; the number is real
   * but the conclusion a reader would draw from it is not.
   */
  modelIsPermissive: boolean;
  /** Share of the model's activities that sit inside a flower, 0–1. */
  permissiveShare: number;
  /** Case-weighted mean fitness across the log, 0–1. */
  logFitness: number;
  /**
   * Of everything the model allows, how much the log actually does, 0–1.
   *
   * Never omit this next to fitness. A model that permits everything has
   * fitness 1 by construction, and precision is the only measure that says so.
   */
  precision: PrecisionResult;
  /** Harmonic mean of fitness and precision — one number that neither can game. */
  fScore: number;
  /** Plain-language reading of the fitness/precision pair. */
  verdict: string;
  /** Cases the model explains with no borrowed or leftover tokens. */
  perfectlyFittingCases: number;
  perfectlyFittingRate: number;
  /** Activities in the log that the model does not contain at all. */
  unmodelledActivities: string[];
  /** Activities the model contains that the log never performed. */
  unusedModelActivities: string[];
  deviations: ActivityDeviation[];
  worstVariants: VariantConformance[];
  /** Variants beyond the reported page, rolled up rather than dropped. */
  remainder: { variants: number; cases: number } | null;
}

const DEFAULT_DEVIATION_LIMIT = 25;

export async function checkConformance(
  client: SqlClient,
  dialect: SqlDialect,
  opts: ConformanceOptions,
): Promise<ConformanceReport> {
  const deviationLimit = opts.deviationLimit ?? DEFAULT_DEVIATION_LIMIT;

  // Replay per variant, weighted by case count. Ask for enough variants to
  // cover the log rather than the default page.
  const variantReport = await analyseVariants(client, dialect, {
    ...opts,
    limit: opts.limit ?? 2000,
  });

  const net = treeToPetriNet(opts.model);
  const index = new NetIndex(net);
  const modelLabels = new Set(modelActivities(net));

  const deviationIndex = new Map<string, ActivityDeviation>();
  const observed = new Set<string>();
  const results: VariantConformance[] = [];

  let weightedFitness = 0;
  let perfectCases = 0;

  for (const variant of variantReport.variants) {
    for (const activity of variant.path) observed.add(activity);

    const replay = replayTrace(index, variant.path, modelLabels);
    const fitness = replay.fitness;
    weightedFitness += fitness * variant.cases;
    if (replay.perfect) perfectCases += variant.cases;

    for (const problem of replay.problems) {
      const key = `${problem.activity}|${problem.kind}`;
      const existing = deviationIndex.get(key);
      if (existing === undefined) {
        deviationIndex.set(key, {
          activity: problem.activity,
          kind: problem.kind,
          cases: variant.cases,
          occurrences: problem.count * variant.cases,
          explanation: explain(problem.kind, problem.activity),
        });
      } else {
        existing.cases += variant.cases;
        existing.occurrences += problem.count * variant.cases;
      }
    }

    results.push({
      rank: variant.rank,
      path: variant.path,
      cases: variant.cases,
      fitness,
      fitsPerfectly: replay.perfect,
      problems: replay.problems.map((p) => `${p.kind}: ${p.activity}`),
    });
  }

  const replayedCases = results.reduce((sum, r) => sum + r.cases, 0);
  const totalCases = variantReport.totalCases;
  const fitness = replayedCases > 0 ? weightedFitness / replayedCases : 0;

  // Precision walks the same weighted variants, so it costs one more pass over
  // a few thousand paths rather than anything proportional to the log.
  const precision = measurePrecision(
    opts.model,
    variantReport.variants.map((v) => ({ path: v.path, weight: v.cases })),
  );

  return {
    objectType: opts.objectType,
    totalCases,
    variantsReplayed: results.length,
    casesReplayed: replayedCases,
    coverage: totalCases > 0 ? replayedCases / totalCases : 0,
    modelIsPermissive: isPermissive(opts.model),
    permissiveShare: permissiveShare(opts.model),
    logFitness: fitness,
    precision,
    fScore: fScore(fitness, precision.precision),
    verdict: interpretQuality(fitness, precision.precision),
    perfectlyFittingCases: perfectCases,
    perfectlyFittingRate: replayedCases > 0 ? perfectCases / replayedCases : 0,
    unmodelledActivities: [...observed].filter((a) => !modelLabels.has(a)).sort(),
    unusedModelActivities: [...modelLabels].filter((a) => !observed.has(a)).sort(),
    deviations: [...deviationIndex.values()].sort((a, b) => b.cases - a.cases).slice(0, deviationLimit),
    worstVariants: results
      .filter((r) => !r.fitsPerfectly)
      .sort((a, b) => a.fitness - b.fitness || b.cases - a.cases)
      .slice(0, deviationLimit),
    remainder:
      variantReport.remainder === null
        ? null
        : { variants: variantReport.remainder.variants, cases: variantReport.remainder.cases },
  };
}

interface TraceProblem {
  activity: string;
  kind: ActivityDeviation['kind'];
  count: number;
}

interface ReplayResult {
  fitness: number;
  perfect: boolean;
  problems: TraceProblem[];
}

/**
 * Replay one activity sequence, counting borrowed and leftover tokens.
 *
 * Fitness follows the standard token-replay formula:
 *
 *     0.5 * (1 - missing/consumed) + 0.5 * (1 - remaining/produced)
 *
 * The two halves measure different failures and both matter. Missing tokens
 * mean the trace did something the model was not ready for. Remaining tokens
 * mean the trace stopped before the model was finished. A trace can score
 * badly on either alone, and averaging them keeps one from masking the other.
 */
export function replayTrace(
  index: NetIndex,
  trace: readonly string[],
  modelLabels: ReadonlySet<string>,
): ReplayResult {
  let marking: Marking = initialMarking(index.net);
  let produced = 1; // the initial token counts as produced
  let consumed = 0;
  let missing = 0;

  const problems = new Map<string, TraceProblem>();
  const note = (activity: string, kind: ActivityDeviation['kind']): void => {
    const key = `${activity}|${kind}`;
    const existing = problems.get(key);
    if (existing === undefined) problems.set(key, { activity, kind, count: 1 });
    else existing.count += 1;
  };

  for (const activity of trace) {
    if (!modelLabels.has(activity)) {
      // The model has no such step at all. Nothing to fire; the trace simply
      // did something the model never describes.
      note(activity, 'not-in-model');
      continue;
    }

    const candidates = index.byLabel.get(activity) ?? [];

    // Prefer reaching an enabled transition through silent steps — a skip or a
    // loop-back in the model is legitimate behaviour, not a deviation.
    const reached = silentPathTo(index, marking, (m) =>
      candidates.some((t) => index.isEnabled(m, t)),
    );

    if (reached !== null) {
      for (const silent of reached.fired) {
        consumed += index.inputs.get(silent)?.length ?? 0;
        produced += index.outputs.get(silent)?.length ?? 0;
      }
      marking = reached.marking;
      const enabled = candidates.find((t) => index.isEnabled(marking, t))!;
      consumed += index.inputs.get(enabled)?.length ?? 0;
      produced += index.outputs.get(enabled)?.length ?? 0;
      marking = index.fire(marking, enabled);
      continue;
    }

    // Nothing reachable. Borrow the tokens the cheapest candidate needs and
    // record it: the step happened, but not where the model allows it.
    const cheapest = candidates.reduce((best, t) =>
      index.missingFor(marking, t).length < index.missingFor(marking, best).length ? t : best,
    );
    const shortfall = index.missingFor(marking, cheapest);
    missing += shortfall.length;

    const borrowed = new Map(marking);
    for (const place of shortfall) borrowed.set(place, (borrowed.get(place) ?? 0) + 1);
    produced += shortfall.length; // borrowed tokens are produced from nowhere
    consumed += index.inputs.get(cheapest)?.length ?? 0;
    produced += index.outputs.get(cheapest)?.length ?? 0;
    marking = index.fire(borrowed, cheapest);
    note(activity, 'out-of-order');
  }

  // Try to finish: silent steps may still be needed to reach the final place.
  const finished = silentPathTo(index, marking, (m) => (m.get(index.net.final) ?? 0) >= 1);
  if (finished !== null) {
    for (const silent of finished.fired) {
      consumed += index.inputs.get(silent)?.length ?? 0;
      produced += index.outputs.get(silent)?.length ?? 0;
    }
    marking = finished.marking;
  }

  // Whatever is left over, minus the one token the final place should hold.
  const leftover = Math.max(0, index.tokenCount(marking) - (marking.get(index.net.final) ?? 0));
  const unfinished = (marking.get(index.net.final) ?? 0) === 0;
  if (unfinished || leftover > 0) {
    // Report against the last activity the trace actually performed, which is
    // where a reader will look for the explanation.
    const last = trace[trace.length - 1];
    if (last !== undefined) note(last, 'skipped');
  }
  const remaining = leftover + (unfinished ? 1 : 0);
  consumed += 1; // the final token is consumed by completing

  const missingRatio = consumed > 0 ? missing / consumed : 0;
  const remainingRatio = produced > 0 ? remaining / produced : 0;
  const fitness = clamp01(0.5 * (1 - missingRatio) + 0.5 * (1 - remainingRatio));

  return {
    fitness,
    perfect: missing === 0 && remaining === 0 && problems.size === 0,
    problems: [...problems.values()],
  };
}

function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return Math.min(1, Math.max(0, x));
}

function explain(kind: ActivityDeviation['kind'], activity: string): string {
  switch (kind) {
    case 'not-in-model':
      return `"${activity}" happens in the log but the reference model has no such step — either the model is out of date, or this work is off-process`;
    case 'out-of-order':
      return `"${activity}" happened when the model was not ready for it — a prerequisite step was skipped, or the order differs from the model`;
    case 'skipped':
      return `cases ended after "${activity}" without completing the model — steps the model still expected never happened`;
  }
}

/**
 * A flower subtree: a loop with a silent body and bare activities as redo
 * paths. It permits those activities in any order, any number of times, and is
 * what the Inductive Miner emits when it can find no structure at all.
 */
function isFlower(node: ProcessTree): boolean {
  if (node.op !== 'loop') return false;
  const [body, ...redos] = node.children;
  if (body === undefined || body.op !== 'tau') return false;
  return redos.length > 0 && redos.every((r) => r.op === 'activity' || r.op === 'tau');
}

function countActivities(node: ProcessTree): number {
  if (node.op === 'activity') return 1;
  if (node.op === 'tau') return 0;
  return node.children.reduce((sum, c) => sum + countActivities(c), 0);
}

function countFlowerActivities(node: ProcessTree): number {
  if (isFlower(node)) return countActivities(node);
  if (node.op === 'activity' || node.op === 'tau') return 0;
  return node.children.reduce((sum, c) => sum + countFlowerActivities(c), 0);
}

/**
 * What share of the model's activities sit inside a flower, 0–1.
 *
 * Checking only the root is not enough: a model can be a tidy sequence whose
 * middle is one enormous flower, and it will still accept almost anything
 * while looking structured from the outside.
 */
export function permissiveShare(model: ProcessTree): number {
  const total = countActivities(model);
  return total === 0 ? 0 : countFlowerActivities(model) / total;
}

/**
 * Does this model accept essentially any sequence of its activities?
 *
 * Such a model scores near-perfect fitness against any log, so reporting that
 * score without this flag invites the reader to conclude the process is under
 * control when the truth is that no structure was ever found.
 */
export function isPermissive(model: ProcessTree): boolean {
  return permissiveShare(model) >= 0.5;
}

/** The Petri net a model translates to, for export or inspection. */
export function referenceNet(model: ProcessTree): PetriNet {
  return treeToPetriNet(model);
}

/** A readable marking, for debugging a replay. */
export function describeMarking(marking: Marking): string {
  const key = markingKey(marking);
  return key === '' ? '(empty)' : key;
}
