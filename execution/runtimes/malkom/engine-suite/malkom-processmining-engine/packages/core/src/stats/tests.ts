/**
 * The statistical machinery comparative mining is held to.
 *
 * This is where most analytics tooling is quietly weakest. A dashboard reports
 * "Team A: 4.2 days, Team B: 5.1 days" and leaves the reader to assume the
 * difference means something. Usually it does not — and at scale, almost
 * everything looks significant, so significance alone is no protection either.
 *
 * Four rules are binding on every comparison this engine produces:
 *
 *  1. **Mann–Whitney U, not a t-test.** Cycle times are heavily right-skewed
 *     with a long tail. A t-test assumes normality and will report confident
 *     nonsense on exactly this shape of data.
 *  2. **Cliff's delta alongside every p-value.** Significant is not the same as
 *     important. At 500k cases essentially everything is significant; effect
 *     size is what survives scrutiny.
 *  3. **Benjamini–Hochberg across a family of comparisons.** Compare forty
 *     queues at p<0.05 and roughly two look like winners through chance alone.
 *  4. **Never a difference without n and an interval.** A gap computed from
 *     eleven cases and one from eleven thousand must not render identically.
 *
 * Mann–Whitney U for two INDEPENDENT samples has no implementation in the
 * usual Node statistics packages — `@stdlib/stats-wilcoxon` is the paired
 * signed-rank test, which is a different procedure, and no `ranksums` package
 * exists. It is implemented here, with tie correction and continuity
 * correction, and checked against published reference values in the tests.
 */

import { cumulativeStdNormalProbability, probit } from 'simple-statistics';

export type Alternative = 'two-sided' | 'less' | 'greater';

export interface RankSumResult {
  /** The U statistic for sample A. */
  u: number;
  /** Standardised statistic under the normal approximation. */
  z: number;
  pValue: number;
  nA: number;
  nB: number;
  /** True when ties were present and the variance was corrected for them. */
  tiesCorrected: boolean;
  /**
   * Tie-corrected variance of U, the quantity the p-value already rests on.
   *
   * Surfaced because an interval for Cliff's delta is a rescaling of it, and
   * recomputing it at the call site would be a second implementation of the tie
   * correction that could silently drift from this one.
   */
  varianceU: number;
}

/**
 * Mann–Whitney U (Wilcoxon rank-sum) for two independent samples.
 *
 * Uses the normal approximation, which is what every practical implementation
 * does above ~20 observations per group; below that it is conservative rather
 * than wrong. Tie correction matters here more than usual — process logs are
 * full of identical durations (same-day completions, zero waits), and
 * uncorrected variance would overstate significance precisely where ties are
 * most common.
 */
export function mannWhitneyU(
  a: readonly number[],
  b: readonly number[],
  alternative: Alternative = 'two-sided',
): RankSumResult {
  const nA = a.length;
  const nB = b.length;
  if (nA === 0 || nB === 0) {
    return {
      u: Number.NaN,
      z: Number.NaN,
      pValue: Number.NaN,
      nA,
      nB,
      tiesCorrected: false,
      varianceU: Number.NaN,
    };
  }

  const combined = [
    ...a.map((v) => ({ v, group: 0 as const })),
    ...b.map((v) => ({ v, group: 1 as const })),
  ].sort((x, y) => x.v - y.v);

  // Midranks: tied observations all take the average of the ranks they span.
  const ranks = new Array<number>(combined.length);
  const tieGroups: number[] = [];
  let i = 0;
  while (i < combined.length) {
    let j = i;
    while (j + 1 < combined.length && combined[j + 1]!.v === combined[i]!.v) j += 1;
    const midrank = (i + j + 2) / 2; // ranks are 1-based
    for (let k = i; k <= j; k += 1) ranks[k] = midrank;
    if (j > i) tieGroups.push(j - i + 1);
    i = j + 1;
  }

  let rankSumA = 0;
  for (let k = 0; k < combined.length; k += 1) {
    if (combined[k]!.group === 0) rankSumA += ranks[k]!;
  }

  return mannWhitneyFromRanks({ rankSumA, nA, nB, tieGroupSizes: tieGroups }, alternative);
}

/**
 * The rank-sum test computed from summary inputs rather than raw samples.
 *
 * This is the form the database can produce. Ranking is a window function, and
 * a rank sum is a GROUP BY — so the whole test can run over millions of cases
 * without a single value crossing into Node, which is the difference between a
 * comparison that works on a real log and one that only works on a demo.
 *
 * `mannWhitneyU` above delegates here so there is exactly one implementation
 * of the statistics, whichever route the data arrived by.
 */
export interface RankSumInputs {
  /** Sum of midranks for group A, ranked across A and B combined. */
  rankSumA: number;
  nA: number;
  nB: number;
  /** Size of each group of tied values, for the variance correction. */
  tieGroupSizes: readonly number[];
}

export function mannWhitneyFromRanks(
  inputs: RankSumInputs,
  alternative: Alternative = 'two-sided',
): RankSumResult {
  const { rankSumA, nA, nB, tieGroupSizes } = inputs;
  if (nA === 0 || nB === 0) {
    return {
      u: Number.NaN,
      z: Number.NaN,
      pValue: Number.NaN,
      nA,
      nB,
      tiesCorrected: false,
      varianceU: Number.NaN,
    };
  }

  const uA = rankSumA - (nA * (nA + 1)) / 2;
  const n = nA + nB;
  const meanU = (nA * nB) / 2;

  // Tie-corrected variance. With no ties this reduces to nA*nB*(n+1)/12.
  const tieTerm = tieGroupSizes.reduce((sum, t) => sum + (t * t * t - t), 0);
  const varianceU =
    n > 1 ? ((nA * nB) / 12) * (n + 1 - tieTerm / (n * (n - 1))) : 0;

  if (varianceU <= 0) {
    // Every observation identical: there is no difference to detect.
    return {
      u: uA,
      z: 0,
      pValue: 1,
      nA,
      nB,
      tiesCorrected: tieGroupSizes.length > 0,
      varianceU,
    };
  }

  // Continuity correction, applied toward the mean so it can only make the
  // test more conservative, never less.
  const diff = uA - meanU;
  const corrected = diff === 0 ? 0 : diff - Math.sign(diff) * 0.5;
  const z = corrected / Math.sqrt(varianceU);

  let pValue: number;
  switch (alternative) {
    case 'greater':
      pValue = 1 - cumulativeStdNormalProbability(z);
      break;
    case 'less':
      pValue = cumulativeStdNormalProbability(z);
      break;
    case 'two-sided':
      pValue = 2 * (1 - cumulativeStdNormalProbability(Math.abs(z)));
      break;
  }

  return {
    u: uA,
    z,
    pValue: Math.min(1, Math.max(0, pValue)),
    nA,
    nB,
    tiesCorrected: tieGroupSizes.length > 0,
    varianceU,
  };
}

/**
 * Cliff's delta recovered from the U statistic.
 *
 * delta = 2U/(nA·nB) − 1 is an identity, not an approximation, so the effect
 * size comes free once the database has produced the rank sum — no second pass
 * over the data and no sampling.
 */
export function cliffsDeltaFromU(
  u: number,
  nA: number,
  nB: number,
  /**
   * Tie-corrected variance of U, from `mannWhitneyFromRanks`. Supply it and the
   * effect comes back with an interval; omit it and the interval is null.
   */
  varianceU?: number,
  confidence = 0.95,
): CliffsDelta {
  if (nA === 0 || nB === 0) {
    return { delta: Number.NaN, magnitude: 'negligible', interval: null };
  }

  const delta = (2 * u) / (nA * nB) - 1;
  return {
    delta,
    magnitude: magnitudeOf(Math.abs(delta)),
    interval: deltaInterval(delta, nA, nB, varianceU, confidence),
  };
}

/**
 * A confidence interval for Cliff's delta, from the variance already computed
 * for the p-value.
 *
 * Delta is a rescaling of U — `delta = 2U/(nA·nB) − 1` — so its variance is the
 * variance of U scaled by the same factor squared. Nothing new is estimated and
 * no sample is needed, which matters because this engine ranks inside the
 * database and never holds one: `bootstrapInterval` is the right tool when a
 * caller has the values in memory, and is unusable on this path by design.
 *
 * Two honest limits, both stated rather than smoothed over. The interval is a
 * normal approximation and is poor at small n — which is why `MIN_GROUP_SIZE`
 * suppresses those comparisons before anyone reads one. And delta is bounded at
 * ±1 while the approximation is not, so a wide interval is clamped; when a
 * bound sits exactly at ±1 that is a sign the estimate is imprecise, and `n`
 * travels with it so the reader can see why.
 *
 * The quantile comes from simple-statistics' `probit` rather than a hand-rolled
 * inverse normal. Its approximation is accurate to about 0.1%, immaterial
 * beside the normal approximation this interval already rests on.
 */
export function deltaInterval(
  delta: number,
  nA: number,
  nB: number,
  varianceU?: number,
  confidence = 0.95,
): Interval | null {
  const n = Math.min(nA, nB);
  if (varianceU === undefined || !Number.isFinite(varianceU) || varianceU <= 0) return null;
  if (nA === 0 || nB === 0 || !Number.isFinite(delta)) return null;
  if (!(confidence > 0 && confidence < 1)) return null;

  const standardError = (2 * Math.sqrt(varianceU)) / (nA * nB);
  const z = probit(1 - (1 - confidence) / 2);
  const half = z * standardError;

  return {
    point: delta,
    lower: Math.max(-1, delta - half),
    upper: Math.min(1, delta + half),
    n,
  };
}

export type EffectMagnitude = 'negligible' | 'small' | 'medium' | 'large';

export interface CliffsDelta {
  /** -1 to +1. Positive means values in A tend to exceed those in B. */
  delta: number;
  magnitude: EffectMagnitude;
  /**
   * Confidence interval on `delta`, or null when one could not be computed.
   *
   * Rule 4 of this module is that a difference is never reported without n and
   * an interval, and the interval travels ON the effect so a caller cannot pick
   * up the point estimate and leave the uncertainty behind. Null is honest —
   * "we could not say" — and never to be rendered as a tight interval.
   */
  interval: Interval | null;
}

/**
 * Cliff's delta — the probability that a random value from A exceeds one from
 * B, minus the reverse.
 *
 * Chosen over Cohen's d for the same reason as Mann–Whitney over the t-test:
 * it makes no assumption about the shape of the distribution. It also has a
 * plain-language reading that survives a meeting — "a random case in A is
 * slower than a random case in B about 70% of the time" — which a standardised
 * mean difference does not.
 *
 * Computed by sorting rather than the naive O(nA·nB) pair comparison, so a
 * comparison over 100k cases stays instant instead of taking minutes.
 */
export function cliffsDelta(a: readonly number[], b: readonly number[]): CliffsDelta {
  const nA = a.length;
  const nB = b.length;
  if (nA === 0 || nB === 0) return { delta: Number.NaN, magnitude: 'negligible', interval: null };

  const sortedB = [...b].sort((x, y) => x - y);
  let greater = 0;
  let less = 0;

  for (const value of a) {
    // Count of B strictly below, and count strictly above, via binary search.
    const lower = lowerBound(sortedB, value);
    const upper = upperBound(sortedB, value);
    greater += lower; // B values < value
    less += nB - upper; // B values > value
  }

  const delta = (greater - less) / (nA * nB);
  // No variance is computed on this path, so the interval is honestly absent
  // rather than invented; callers holding a sample can use bootstrapInterval.
  return { delta, magnitude: magnitudeOf(Math.abs(delta)), interval: null };
}

/** Romano et al.'s thresholds, the ones normally quoted for Cliff's delta. */
function magnitudeOf(absDelta: number): EffectMagnitude {
  if (absDelta < 0.147) return 'negligible';
  if (absDelta < 0.33) return 'small';
  if (absDelta < 0.474) return 'medium';
  return 'large';
}

function lowerBound(sorted: readonly number[], target: number): number {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (sorted[mid]! < target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function upperBound(sorted: readonly number[], target: number): number {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (sorted[mid]! <= target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export interface AdjustedPValue {
  /** Position in the input array, so results can be matched back. */
  index: number;
  pValue: number;
  /** Benjamini–Hochberg adjusted p-value (a q-value). */
  adjusted: number;
  /** Whether it survives at the chosen false-discovery rate. */
  significant: boolean;
}

/**
 * Benjamini–Hochberg false-discovery-rate correction.
 *
 * Without it, comparing forty groups at p<0.05 produces about two "findings"
 * from chance alone, and they are indistinguishable from real ones. BH is
 * preferred to Bonferroni here because it controls the proportion of false
 * discoveries rather than the chance of any at all — with dozens of process
 * comparisons, Bonferroni is so conservative that genuine effects disappear.
 *
 * Adjusted values are made monotone as the procedure requires, so a smaller
 * raw p can never end up with a larger q than one above it.
 */
export function benjaminiHochberg(
  pValues: readonly number[],
  fdr = 0.05,
): AdjustedPValue[] {
  const n = pValues.length;
  if (n === 0) return [];

  const order = pValues
    .map((pValue, index) => ({ pValue, index }))
    .sort((x, y) => x.pValue - y.pValue);

  const adjusted = new Array<number>(n);
  let running = 1;
  // Walk from the largest p downwards, keeping the running minimum: that is
  // what enforces monotonicity.
  for (let rank = n; rank >= 1; rank -= 1) {
    const entry = order[rank - 1]!;
    const value = Math.min(1, (entry.pValue * n) / rank);
    running = Math.min(running, value);
    adjusted[entry.index] = running;
  }

  return pValues.map((pValue, index) => ({
    index,
    pValue,
    adjusted: adjusted[index]!,
    significant: adjusted[index]! <= fdr,
  }));
}

export interface Interval {
  point: number;
  lower: number;
  upper: number;
  /** Observations the estimate rests on. Never report the interval without it. */
  n: number;
}

/**
 * NOTE ON WHICH INTERVAL TO USE. This one needs the values in memory, so it
 * suits a caller holding its own sample. The analyses in this engine rank
 * inside the database and never hold one — they use `deltaInterval`, which is
 * built from the variance the p-value already rests on. Neither is a
 * replacement for the other, and this is not dead code awaiting deletion.
 *
 * Percentile bootstrap confidence interval for a statistic.
 *
 * Bootstrapping rather than a closed form because the statistic of interest is
 * usually a median or a difference of medians, and those have no convenient
 * analytical interval on skewed data.
 *
 * The resampler is seeded and deterministic: an interval that moves between
 * two runs over identical data invites people to re-run until they like the
 * answer.
 */
export function bootstrapInterval(
  sample: readonly number[],
  statistic: (values: readonly number[]) => number,
  opts: { iterations?: number; confidence?: number; seed?: number } = {},
): Interval {
  const n = sample.length;
  const point = n === 0 ? Number.NaN : statistic(sample);
  if (n < 2) return { point, lower: Number.NaN, upper: Number.NaN, n };

  const iterations = opts.iterations ?? 2000;
  const confidence = opts.confidence ?? 0.95;
  const random = mulberry32(opts.seed ?? 0x5eed);

  const estimates = new Array<number>(iterations);
  const draw = new Array<number>(n);
  for (let i = 0; i < iterations; i += 1) {
    for (let k = 0; k < n; k += 1) draw[k] = sample[Math.floor(random() * n)]!;
    estimates[i] = statistic(draw);
  }
  estimates.sort((x, y) => x - y);

  const alpha = (1 - confidence) / 2;
  const lower = estimates[Math.max(0, Math.floor(alpha * iterations))]!;
  const upper = estimates[Math.min(iterations - 1, Math.ceil((1 - alpha) * iterations) - 1)]!;
  return { point, lower, upper, n };
}

/** Small deterministic PRNG. Reproducibility is the whole point. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function median(values: readonly number[]): number {
  if (values.length === 0) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

/**
 * Is a comparison worth reporting at all?
 *
 * A guard against the two ways a difference misleads: too few observations to
 * mean anything, and a difference too small to act on however certain it is.
 */
export interface ReportabilityVerdict {
  reportable: boolean;
  reason: string;
}

export const MIN_GROUP_SIZE = 20;

export function assessReportability(
  nA: number,
  nB: number,
  effect: CliffsDelta,
  adjustedP: number,
  fdr = 0.05,
): ReportabilityVerdict {
  if (nA < MIN_GROUP_SIZE || nB < MIN_GROUP_SIZE) {
    return {
      reportable: false,
      reason: `too few cases to compare (${nA} vs ${nB}; at least ${MIN_GROUP_SIZE} per group)`,
    };
  }
  if (adjustedP > fdr) {
    return {
      reportable: false,
      reason: `not significant after correcting for multiple comparisons (q = ${adjustedP.toFixed(3)})`,
    };
  }
  if (effect.magnitude === 'negligible') {
    return {
      reportable: false,
      reason: `statistically significant but the effect is negligible (Cliff's delta ${effect.delta.toFixed(3)}) — with enough cases almost any difference reaches significance`,
    };
  }
  return { reportable: true, reason: `${effect.magnitude} effect, q = ${adjustedP.toFixed(3)}` };
}
