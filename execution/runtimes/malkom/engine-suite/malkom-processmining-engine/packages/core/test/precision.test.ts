import { describe, expect, it } from 'vitest';
import type { ProcessTree } from '../src/runtime/inductive.js';
import {
  fScore,
  interpretQuality,
  measurePrecision,
  type WeightedTrace,
} from '../src/runtime/precision.js';

/**
 * Precision exists to catch the one failure fitness cannot see: a model so
 * permissive that it agrees with everything. Every case here is checkable by
 * hand from the definition — observed options over allowed options, weighted
 * by how often each state occurs.
 */

const SEQ: ProcessTree = {
  op: 'seq',
  children: [
    { op: 'activity', label: 'a' },
    { op: 'activity', label: 'b' },
    { op: 'activity', label: 'c' },
  ],
};

/** *( tau, a, b, c ) — any of the three, any order, any number of times. */
const FLOWER: ProcessTree = {
  op: 'loop',
  children: [
    { op: 'tau' },
    { op: 'activity', label: 'a' },
    { op: 'activity', label: 'b' },
    { op: 'activity', label: 'c' },
  ],
};

function trace(path: string[], weight = 1): WeightedTrace {
  return { path, weight };
}

describe('precision', () => {
  it('is 1 for a model that allows exactly what the log does', () => {
    // At every prefix the sequence permits one activity and the log does it.
    const result = measurePrecision(SEQ, [trace(['a', 'b', 'c'], 10)]);
    expect(result.precision).toBeCloseTo(1, 10);
    expect(result.escapingEdges).toBe(0);
    expect(result.loosestStates).toHaveLength(0);
  });

  it('collapses for a flower model, which fitness alone cannot detect', () => {
    // Three prefixes: (start), [a], [a,b]. The flower allows all three
    // activities at each; the log does one. Precision = 1/3.
    const result = measurePrecision(FLOWER, [trace(['a', 'b', 'c'], 1)]);
    expect(result.precision).toBeCloseTo(1 / 3, 6);
    expect(result.escapingEdges).toBe(6); // 2 unused at each of 3 states
  });

  it('rises as the log exercises more of what the model allows', () => {
    // Same flower, but now the log takes every option from the start state.
    const narrow = measurePrecision(FLOWER, [trace(['a', 'b', 'c'])]);
    const wide = measurePrecision(FLOWER, [
      trace(['a', 'b', 'c']),
      trace(['b', 'a', 'c']),
      trace(['c', 'a', 'b']),
    ]);
    expect(wide.precision).toBeGreaterThan(narrow.precision);
  });

  it('weights states by how many cases pass through them', () => {
    // A common prefix that is tightly followed should dominate a rare loose one.
    const result = measurePrecision(
      { op: 'xor', children: [SEQ, { op: 'activity', label: 'z' }] },
      [trace(['a', 'b', 'c'], 1000), trace(['z'], 1)],
    );
    // The heavily-weighted, well-behaved path keeps precision high.
    expect(result.precision).toBeGreaterThan(0.7);
  });

  it('names the states where the model is loosest', () => {
    const result = measurePrecision(FLOWER, [trace(['a', 'b', 'c'], 50)]);
    const loosest = result.loosestStates[0];
    expect(loosest).toBeDefined();
    expect(loosest!.weight).toBe(50);
    expect(loosest!.escaping.length).toBe(2);
  });

  it('does not treat two different prefixes as one state', () => {
    // The prefixes ['a','b'] and ['ab'] must not collide. Joining with an
    // empty string makes both the key "ab", merging two unrelated points in
    // the process and averaging their behaviour together.
    //
    // Each needs a following activity, since a state is recorded before an
    // activity — a prefix nothing follows is never a state.
    const model: ProcessTree = {
      op: 'xor',
      children: [
        {
          op: 'seq',
          children: [
            { op: 'activity', label: 'a' },
            { op: 'activity', label: 'b' },
            { op: 'activity', label: 'x' },
          ],
        },
        {
          op: 'seq',
          children: [{ op: 'activity', label: 'ab' }, { op: 'activity', label: 'y' }],
        },
      ],
    };
    const result = measurePrecision(model, [trace(['a', 'b', 'x']), trace(['ab', 'y'])]);
    // (start), [a], [a,b], [ab] — four states. The empty-string join gives three.
    expect(result.states).toBe(4);
  });

  it('follows silent steps when counting what the model allows', () => {
    // ->( a, X( b, tau ), c ). After 'a' the model allows b AND c (via the
    // silent skip). Not following taus would count only b and overstate
    // precision.
    const optional: ProcessTree = {
      op: 'seq',
      children: [
        { op: 'activity', label: 'a' },
        { op: 'xor', children: [{ op: 'activity', label: 'b' }, { op: 'tau' }] },
        { op: 'activity', label: 'c' },
      ],
    };
    const result = measurePrecision(optional, [trace(['a', 'b', 'c'])]);
    // At [a] the model allows {b, c} and the log does only b, so precision
    // there is 1/2 — strictly below 1.
    expect(result.precision).toBeLessThan(1);
    expect(result.loosestStates.some((s) => s.escaping.includes('c'))).toBe(true);
  });

  it('returns 1 for an empty log rather than dividing by zero', () => {
    expect(measurePrecision(SEQ, []).precision).toBe(1);
  });
});

describe('F-score', () => {
  it('is the harmonic mean of fitness and precision', () => {
    expect(fScore(1, 1)).toBeCloseTo(1, 10);
    expect(fScore(0.8, 0.4)).toBeCloseTo((2 * 0.8 * 0.4) / 1.2, 10);
  });

  it('punishes a model that wins one measure by abandoning the other', () => {
    // A flower: perfect fitness, dreadful precision. The F-score refuses to
    // average that into something respectable.
    expect(fScore(1.0, 0.1)).toBeLessThan(0.2);
    expect(fScore(0.55, 0.55)).toBeGreaterThan(fScore(1.0, 0.1));
  });

  it('is zero when either measure is zero', () => {
    expect(fScore(1, 0)).toBe(0);
    expect(fScore(0, 1)).toBe(0);
  });
});

describe('quality interpretation', () => {
  it('calls out a permissive model explicitly', () => {
    expect(interpretQuality(1.0, 0.2)).toContain('not evidence of compliance');
  });

  it('calls out a model the process has departed from', () => {
    expect(interpretQuality(0.3, 0.9)).toContain('never followed');
  });

  it('endorses a model that is both faithful and tight', () => {
    expect(interpretQuality(0.95, 0.9)).toContain('trustworthy');
  });

  it('does not endorse a model that is bad at both', () => {
    expect(interpretQuality(0.2, 0.2)).toContain('not a useful reference');
  });
});
