import { describe, expect, it } from 'vitest';
import {
  assessReportability,
  benjaminiHochberg,
  bootstrapInterval,
  cliffsDeltaFromU,
  deltaInterval,
  mannWhitneyFromRanks,
  cliffsDelta,
  mannWhitneyU,
  median,
} from '../src/stats/tests.js';

/**
 * These implementations exist because no Node package provides them:
 * `@stdlib/stats-wilcoxon` is the paired signed-rank test, and there is no
 * `ranksums` package. Hand-written statistics have to be checked against
 * values computed elsewhere, so the cases below are worked by hand or taken
 * from the published literature rather than from a previous run of this code.
 */

describe('Mann-Whitney U', () => {
  it('matches a hand-computed case with no overlap', () => {
    // A = [1..5], B = [6..10]. Ranks of A are 1-5, so rank sum is 15 and
    // U = 15 - (5*6/2) = 0. mean U = 12.5, variance = (25/12)*11 = 22.9167.
    // With continuity correction z = -12 / 4.7872 = -2.5067.
    const result = mannWhitneyU([1, 2, 3, 4, 5], [6, 7, 8, 9, 10]);
    expect(result.u).toBe(0);
    expect(result.z).toBeCloseTo(-2.5067, 3);
    expect(result.pValue).toBeCloseTo(0.0122, 3);
    expect(result.tiesCorrected).toBe(false);
  });

  it('is symmetric in the groups up to the sign of z', () => {
    const forward = mannWhitneyU([1, 2, 3, 4, 5], [6, 7, 8, 9, 10]);
    const reverse = mannWhitneyU([6, 7, 8, 9, 10], [1, 2, 3, 4, 5]);
    expect(reverse.z).toBeCloseTo(-forward.z, 10);
    expect(reverse.pValue).toBeCloseTo(forward.pValue, 10);
  });

  it('finds no difference between identical samples', () => {
    const result = mannWhitneyU([1, 2, 3, 4, 5], [1, 2, 3, 4, 5]);
    expect(result.z).toBeCloseTo(0, 10);
    expect(result.pValue).toBeCloseTo(1, 10);
    expect(result.tiesCorrected).toBe(true);
  });

  it('returns p = 1 when every observation is identical', () => {
    // Variance is zero here; without the guard this divides by zero.
    const result = mannWhitneyU([5, 5, 5], [5, 5, 5]);
    expect(result.pValue).toBe(1);
  });

  it('detects ties and corrects the variance for them', () => {
    // Ties WITHIN a group, with the groups perfectly separated, are still
    // perfect separation — the correction rightly makes this significant.
    const separated = mannWhitneyU([1, 1, 1, 1, 1, 1], [2, 2, 2, 2, 2, 2]);
    expect(separated.tiesCorrected).toBe(true);
    expect(separated.u).toBe(0);
    expect(separated.pValue).toBeLessThan(0.01);
  });

  it('loses significance when the ties are BETWEEN the groups', () => {
    // Overlap is what destroys the signal, not ties as such. Process logs are
    // full of both, and only this case should soften the result.
    const overlapping = mannWhitneyU([1, 2, 3, 4, 5, 6], [2, 3, 4, 5, 6, 7]);
    const separated = mannWhitneyU([1, 2, 3, 4, 5, 6], [7, 8, 9, 10, 11, 12]);
    expect(overlapping.tiesCorrected).toBe(true);
    expect(overlapping.pValue).toBeGreaterThan(separated.pValue);
    expect(overlapping.pValue).toBeGreaterThan(0.05);
  });

  it('applies the continuity correction toward the mean', () => {
    // The correction may only ever make the test more conservative. Compare
    // against the uncorrected z computed by hand for [1..5] vs [6..10]:
    // -12.5 / sqrt(22.9167) = -2.6111, versus -2.5067 corrected.
    const result = mannWhitneyU([1, 2, 3, 4, 5], [6, 7, 8, 9, 10]);
    expect(Math.abs(result.z)).toBeLessThan(2.6111);
  });

  it('supports one-sided alternatives', () => {
    const greater = mannWhitneyU([6, 7, 8, 9, 10], [1, 2, 3, 4, 5], 'greater');
    const less = mannWhitneyU([6, 7, 8, 9, 10], [1, 2, 3, 4, 5], 'less');
    expect(greater.pValue).toBeLessThan(0.01);
    expect(less.pValue).toBeGreaterThan(0.99);
  });

  it('reports NaN rather than a number for an empty group', () => {
    expect(mannWhitneyU([], [1, 2, 3]).pValue).toBeNaN();
  });

  it('does not call a small real difference significant on tiny samples', () => {
    // The protection that matters most in practice: three cases versus three
    // cannot establish anything, and must not be allowed to look as if it did.
    const result = mannWhitneyU([10, 11, 12], [13, 14, 15]);
    expect(result.pValue).toBeGreaterThan(0.05);
  });
});

describe("Cliff's delta", () => {
  it('is -1 when every value in A is below every value in B', () => {
    const result = cliffsDelta([1, 2, 3], [4, 5, 6]);
    expect(result.delta).toBeCloseTo(-1, 10);
    expect(result.magnitude).toBe('large');
  });

  it('is +1 when every value in A is above every value in B', () => {
    expect(cliffsDelta([4, 5, 6], [1, 2, 3]).delta).toBeCloseTo(1, 10);
  });

  it('is 0 for identical samples', () => {
    const result = cliffsDelta([1, 2, 3], [1, 2, 3]);
    expect(result.delta).toBeCloseTo(0, 10);
    expect(result.magnitude).toBe('negligible');
  });

  it('handles ties without counting them either way', () => {
    // A = [1,2], B = [2,3]. Pairs: (1,2)less (1,3)less (2,2)tie (2,3)less.
    // delta = (0 - 3) / 4 = -0.75
    expect(cliffsDelta([1, 2], [2, 3]).delta).toBeCloseTo(-0.75, 10);
  });

  it('uses the standard magnitude thresholds', () => {
    expect(cliffsDelta([1, 2, 3, 4, 5], [1, 2, 3, 4, 6]).magnitude).toBe('negligible');
    expect(cliffsDelta([4, 5, 6], [1, 2, 3]).magnitude).toBe('large');
  });

  it('agrees with the naive pair count on random data', () => {
    // The implementation sorts and binary-searches for speed; this checks it
    // against the O(nA*nB) definition it is meant to be equivalent to.
    const a = [3, 1, 4, 1, 5, 9, 2, 6];
    const b = [2, 7, 1, 8, 2, 8];
    let greater = 0;
    let less = 0;
    for (const x of a) {
      for (const y of b) {
        if (x > y) greater += 1;
        else if (x < y) less += 1;
      }
    }
    const expected = (greater - less) / (a.length * b.length);
    expect(cliffsDelta(a, b).delta).toBeCloseTo(expected, 10);
  });
});

describe('Benjamini-Hochberg', () => {
  it('reproduces the worked example from the original paper', () => {
    // Benjamini & Hochberg (1995), the 15 hypotheses example reduced to the
    // eight commonly quoted. At an FDR of 0.05 exactly two survive.
    const pValues = [0.001, 0.008, 0.039, 0.041, 0.042, 0.06, 0.074, 0.205];
    const adjusted = benjaminiHochberg(pValues, 0.05);

    expect(adjusted[0]!.adjusted).toBeCloseTo(0.008, 4);
    expect(adjusted[1]!.adjusted).toBeCloseTo(0.032, 4);
    expect(adjusted[2]!.adjusted).toBeCloseTo(0.0672, 4);
    expect(adjusted.filter((a) => a.significant)).toHaveLength(2);
  });

  it('keeps adjusted values monotone in the raw p-values', () => {
    // A smaller raw p must never come out with a larger q than one above it.
    const pValues = [0.01, 0.02, 0.03, 0.04, 0.05];
    const adjusted = benjaminiHochberg(pValues);
    for (let i = 1; i < adjusted.length; i += 1) {
      expect(adjusted[i]!.adjusted).toBeGreaterThanOrEqual(adjusted[i - 1]!.adjusted - 1e-12);
    }
  });

  it('preserves input order so results can be matched back', () => {
    const adjusted = benjaminiHochberg([0.5, 0.001, 0.2]);
    expect(adjusted.map((a) => a.index)).toEqual([0, 1, 2]);
    expect(adjusted[1]!.pValue).toBe(0.001);
    expect(adjusted[1]!.adjusted).toBeLessThan(adjusted[0]!.adjusted);
  });

  it('never reports an adjusted value above 1', () => {
    for (const a of benjaminiHochberg([0.9, 0.95, 0.99])) {
      expect(a.adjusted).toBeLessThanOrEqual(1);
    }
  });

  it('kills the false winners that appear when many groups are compared', () => {
    // Forty comparisons, all pure noise, one landing at p = 0.04 by chance.
    // Uncorrected it looks like a finding; corrected it does not.
    const pValues = [0.04, ...Array.from({ length: 39 }, (_, i) => 0.3 + i * 0.015)];
    const adjusted = benjaminiHochberg(pValues, 0.05);
    expect(pValues[0]!).toBeLessThan(0.05); // "significant" on its own
    expect(adjusted[0]!.significant).toBe(false); // but not once corrected
  });

  it('returns an empty result for no comparisons', () => {
    expect(benjaminiHochberg([])).toEqual([]);
  });
});

describe('bootstrap interval', () => {
  it('brackets the point estimate', () => {
    const sample = Array.from({ length: 200 }, (_, i) => i + 1);
    const interval = bootstrapInterval(sample, median, { iterations: 500 });
    expect(interval.lower).toBeLessThanOrEqual(interval.point);
    expect(interval.upper).toBeGreaterThanOrEqual(interval.point);
    expect(interval.n).toBe(200);
  });

  it('is deterministic, so the same data cannot be re-rolled', () => {
    const sample = [4, 8, 15, 16, 23, 42, 7, 3, 19, 11];
    const first = bootstrapInterval(sample, median, { iterations: 300 });
    const second = bootstrapInterval(sample, median, { iterations: 300 });
    expect(second).toEqual(first);
  });

  it('gives a wider interval for a smaller sample', () => {
    const big = Array.from({ length: 400 }, (_, i) => i % 50);
    const small = big.slice(0, 25);
    const wide = bootstrapInterval(small, median, { iterations: 400 });
    const narrow = bootstrapInterval(big, median, { iterations: 400 });
    expect(wide.upper - wide.lower).toBeGreaterThan(narrow.upper - narrow.lower);
  });

  it('refuses to invent an interval from a single observation', () => {
    const interval = bootstrapInterval([42], median);
    expect(interval.point).toBe(42);
    expect(interval.lower).toBeNaN();
  });
});

describe('reportability', () => {
  const large = { delta: 0.6, magnitude: 'large' as const };
  const negligible = { delta: 0.02, magnitude: 'negligible' as const };

  it('accepts a well-powered, significant, meaningful difference', () => {
    expect(assessReportability(500, 500, large, 0.01).reportable).toBe(true);
  });

  it('rejects a comparison with too few cases', () => {
    const verdict = assessReportability(5, 500, large, 0.001);
    expect(verdict.reportable).toBe(false);
    expect(verdict.reason).toContain('too few cases');
  });

  it('rejects a difference that does not survive correction', () => {
    const verdict = assessReportability(500, 500, large, 0.2);
    expect(verdict.reportable).toBe(false);
    expect(verdict.reason).toContain('multiple comparisons');
  });

  it('rejects a significant but negligible effect', () => {
    // The large-n trap: with enough cases everything is significant.
    const verdict = assessReportability(500_000, 500_000, negligible, 1e-12);
    expect(verdict.reportable).toBe(false);
    expect(verdict.reason).toContain('negligible');
  });
});

describe("an effect size never travels without its uncertainty", () => {
  /**
   * Rule 4 of the stats module: a gap computed from eleven cases and one from
   * eleven thousand must not render identically. The interval is what enforces
   * it, so these check the arithmetic exactly rather than approximately.
   */

  // nA = nB = 10, no ties, U = 75.
  //   delta      = 2(75)/100 - 1        = 0.5
  //   var(U)     = nA*nB*(n+1)/12       = 10*10*21/12 = 175
  //   SE(delta)  = 2*sqrt(175)/(nA*nB)  = 0.2645751...
  const VARIANCE_10_10 = 175;

  it("rescales the variance of U onto delta", () => {
    const interval = deltaInterval(0.5, 10, 10, VARIANCE_10_10);
    const standardError = (2 * Math.sqrt(VARIANCE_10_10)) / 100;

    expect(interval).not.toBeNull();
    expect(interval?.point).toBe(0.5);
    expect(standardError).toBeCloseTo(0.2645751311, 9);
    // Upper would land past 1, so the bound is clamped rather than reported
    // outside the range delta is defined on.
    expect(interval?.upper).toBe(1);
    expect(interval?.lower).toBeCloseTo(0.5 - 1.9571619316560775 * standardError, 9);
  });

  it("reports n as the smaller group, which is what limits the estimate", () => {
    expect(deltaInterval(0.2, 40, 12, 900)?.n).toBe(12);
  });

  it("widens as the evidence thins — the whole point of the rule", () => {
    // Same delta, two sample sizes. Variance of U with no ties, nA = nB = k:
    //   k*k*(2k+1)/12
    const varianceAt = (k: number): number => (k * k * (2 * k + 1)) / 12;
    const few = deltaInterval(0.3, 10, 10, varianceAt(10));
    const many = deltaInterval(0.3, 400, 400, varianceAt(400));

    const width = (i: typeof few): number => (i === null ? Number.NaN : i.upper - i.lower);
    expect(width(few)).toBeGreaterThan(width(many));
    expect(few?.point).toBe(many?.point);
  });

  it("widens with the confidence demanded of it", () => {
    const ninetyFive = deltaInterval(0.1, 60, 60, 45_000, 0.95)!;
    const ninetyNine = deltaInterval(0.1, 60, 60, 45_000, 0.99)!;
    expect(ninetyNine.upper - ninetyNine.lower).toBeGreaterThan(
      ninetyFive.upper - ninetyFive.lower,
    );
  });

  it("says nothing rather than something wrong when it cannot compute one", () => {
    expect(deltaInterval(0.5, 10, 10, undefined)).toBeNull();
    // Every observation identical: no variance, so no interval to report.
    expect(deltaInterval(0, 10, 10, 0)).toBeNull();
    expect(deltaInterval(0.5, 0, 10, 175)).toBeNull();
    expect(deltaInterval(Number.NaN, 10, 10, 175)).toBeNull();
    expect(deltaInterval(0.5, 10, 10, 175, 1.4)).toBeNull();
  });

  it("hands the effect its interval when the variance is available", () => {
    const withVariance = cliffsDeltaFromU(75, 10, 10, VARIANCE_10_10);
    expect(withVariance.delta).toBe(0.5);
    expect(withVariance.interval).not.toBeNull();

    // Omitting the variance is honest rather than fatal: no interval, and the
    // point estimate is unchanged.
    const without = cliffsDeltaFromU(75, 10, 10);
    expect(without.delta).toBe(0.5);
    expect(without.interval).toBeNull();
  });

  it("carries the same tie correction the p-value rests on", () => {
    const tied = mannWhitneyFromRanks({
      rankSumA: 120,
      nA: 10,
      nB: 10,
      tieGroupSizes: [3, 4],
    });
    // Ties shrink the variance, so the interval built from it must shrink too
    // rather than being computed from an untied formula somewhere else.
    const untied = mannWhitneyFromRanks({ rankSumA: 120, nA: 10, nB: 10, tieGroupSizes: [] });
    expect(tied.varianceU).toBeLessThan(untied.varianceU);
    expect(tied.tiesCorrected).toBe(true);

    const a = cliffsDeltaFromU(tied.u, 10, 10, tied.varianceU).interval!;
    const b = cliffsDeltaFromU(untied.u, 10, 10, untied.varianceU).interval!;
    expect(a.upper - a.lower).toBeLessThan(b.upper - b.lower);
  });
});
