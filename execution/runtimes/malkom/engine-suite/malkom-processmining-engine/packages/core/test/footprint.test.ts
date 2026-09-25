import { describe, expect, it } from 'vitest';
import { compareFootprints, footprint, relationAt } from '../src/runtime/footprint.js';
import { dfgFixture } from './helpers/logs.js';

/**
 * The footprint exists to answer "what changed", so most of what is pinned here
 * is the comparison rather than the grid. The grid itself has one property
 * worth stating outright: a pair that never occurred adjacently is absent, not
 * present-and-empty, because a dense grid over a real log is almost entirely a
 * report of things that did not happen.
 */

describe('the grid', () => {
  it('reads a one-way arc in both directions', () => {
    const fp = footprint(dfgFixture([['a', 'b', 10]]));
    expect(relationAt(fp, 'a', 'b')).toBe('follows');
    expect(relationAt(fp, 'b', 'a')).toBe('precedes');
  });

  it('calls a pair seen in both orders parallel', () => {
    const fp = footprint(
      dfgFixture([
        ['b', 'c', 6],
        ['c', 'b', 5],
      ]),
    );
    expect(relationAt(fp, 'b', 'c')).toBe('parallel');
    expect(relationAt(fp, 'c', 'b')).toBe('parallel');
  });

  it('omits pairs that never met rather than reporting an empty relation', () => {
    const fp = footprint(
      dfgFixture([
        ['a', 'b', 4],
        ['b', 'c', 4],
      ]),
    );
    // a and c both occur, and never adjacently.
    expect(fp.activities).toContain('a');
    expect(fp.activities).toContain('c');
    expect(relationAt(fp, 'a', 'c')).toBeNull();
    expect(fp.cells.some((cell) => cell.from === 'a' && cell.to === 'c')).toBe(false);
  });

  it('says how many activities a capped grid left out', () => {
    const fp = footprint(
      dfgFixture([
        ['a', 'b', 100],
        ['b', 'c', 80],
        ['c', 'd', 60],
        ['d', 'e', 40],
      ]),
      { limit: 2 },
    );
    expect(fp.activities).toHaveLength(2);
    expect(fp.omitted).toBe(3);
  });

  it('reports nothing omitted when everything fits', () => {
    expect(footprint(dfgFixture([['a', 'b', 3]])).omitted).toBe(0);
  });
});

describe('what changed between two logs', () => {
  /** Credit check and address verification, once concurrent. */
  const before = footprint(
    dfgFixture([
      ['submit', 'credit', 50],
      ['submit', 'address', 50],
      ['credit', 'address', 30],
      ['address', 'credit', 28],
      ['address', 'decide', 50],
      ['credit', 'decide', 50],
    ]),
  );

  /** The same process after the order was mandated. */
  const after = footprint(
    dfgFixture([
      ['submit', 'credit', 60],
      ['credit', 'address', 60],
      ['address', 'decide', 60],
    ]),
  );

  it('names the pair whose ordering was tightened', () => {
    const { differences } = compareFootprints(before, after);
    const changed = differences.find((d) => d.from === 'credit' && d.to === 'address');
    expect(changed).toEqual({
      from: 'credit',
      to: 'address',
      before: 'parallel',
      after: 'follows',
    });
  });

  it('reports a pair that stopped meeting at all', () => {
    const { differences } = compareFootprints(before, after);
    // submit no longer leads straight to address; it goes through credit.
    const dropped = differences.find((d) => d.from === 'submit' && d.to === 'address');
    expect(dropped?.before).toBe('follows');
    expect(dropped?.after).toBeNull();
  });

  it('leaves unchanged pairs out of the differences', () => {
    const { differences } = compareFootprints(before, after);
    expect(differences.some((d) => d.from === 'submit' && d.to === 'credit')).toBe(false);
  });

  it('scores an unchanged process as fully in agreement', () => {
    const comparison = compareFootprints(before, before);
    expect(comparison.differences).toEqual([]);
    expect(comparison.agreement).toBe(1);
    expect(comparison.onlyBefore).toEqual([]);
    expect(comparison.onlyAfter).toEqual([]);
  });

  it('scores a genuinely changed process below one', () => {
    expect(compareFootprints(before, after).agreement).toBeLessThan(1);
  });

  it('names activities that exist on one side only', () => {
    const withExtra = footprint(
      dfgFixture([
        ['submit', 'credit', 60],
        ['credit', 'escalate', 20],
        ['escalate', 'decide', 20],
        ['credit', 'address', 60],
        ['address', 'decide', 60],
      ]),
    );

    const comparison = compareFootprints(before, withExtra);
    expect(comparison.onlyAfter).toEqual(['escalate']);
    expect(comparison.onlyBefore).toEqual([]);
    // A new activity is a change the grid cannot express as a cell, so it must
    // not silently vanish into the agreement score.
    expect(comparison.differences.every((d) => d.from !== 'escalate' && d.to !== 'escalate')).toBe(
      true,
    );
  });

  it('measures agreement over pairs that occurred, not over the empty grid', () => {
    // Two logs sharing four activities but only one arc each, and different
    // ones. Counting every empty cell would score them near-identical.
    const one = footprint(dfgFixture([['a', 'b', 10], ['c', 'd', 10]]));
    const two = footprint(dfgFixture([['a', 'c', 10], ['b', 'd', 10]]));
    expect(compareFootprints(one, two).agreement).toBeLessThan(0.5);
  });
});
