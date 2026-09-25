import { describe, expect, it } from 'vitest';
import {
  abstractNodes,
  groupRareActivities,
  type ActivityStats,
  type Dfg,
} from '../src/runtime/dfg.js';

/**
 * Grouping rare steps, rather than hiding them.
 *
 * The failure this guards is quiet by nature. A map that silently drops twelve
 * steps looks exactly like a map of a twelve-step-simpler process, and a map
 * that folds them into one hub wired to everything invents a junction that
 * never existed. Both render fine. Both are wrong.
 *
 * So every fixture below has a shape decided in advance — which steps are rare,
 * which of them touch each other, and therefore how many boxes must come out —
 * and the assertions check that answer.
 */

/** A DFG with activity stats stated explicitly, so expectations are exact. */
function graph(
  activities: readonly (readonly [string, number, number])[],
  edges: readonly (readonly [string, string, number])[],
  extra: { starts?: Record<string, number>; ends?: Record<string, number> } = {},
): Dfg {
  const stats: ActivityStats[] = activities.map(([activity, frequency, caseCount]) => ({
    activity,
    frequency,
    caseCount,
    medianDurationSeconds: null,
    totalCost: null,
    medianCost: null,
  }));

  return {
    objectType: 'case',
    activities: stats,
    edges: edges.map(([from, to, frequency]) => ({
      from,
      to,
      frequency,
      caseCount: frequency,
      medianSeconds: 60,
      meanSeconds: 60,
    })),
    starts: new Map(Object.entries(extra.starts ?? {})),
    ends: new Map(Object.entries(extra.ends ?? {})),
    caseCount: 100,
    eventCount: activities.reduce((n, [, f]) => n + f, 0),
  };
}

/**
 * A busy spine with two rare detours, one of two adjacent steps and one of
 * three. Keeping the top half means the five detour steps fall below the cut,
 * and they must come out as TWO boxes rather than one.
 */
const TWO_DETOURS = graph(
  [
    ['submit', 500, 500],
    ['review', 480, 480],
    ['approve', 400, 400],
    // detour one, adjacent to each other
    ['chase', 20, 18],
    ['rechase', 12, 10],
    // detour two, elsewhere and adjacent to each other
    ['escalate', 9, 9],
    ['legal', 6, 6],
    ['board', 4, 4],
  ],
  [
    ['submit', 'review', 480],
    ['review', 'approve', 400],
    ['review', 'chase', 20],
    ['chase', 'rechase', 12],
    ['rechase', 'review', 12],
    ['review', 'escalate', 9],
    ['escalate', 'legal', 6],
    ['legal', 'board', 4],
    ['board', 'approve', 4],
  ],
  { starts: { submit: 500 }, ends: { approve: 400 } },
);

const RARE_KEEP = { keep: 3 / 8 };

describe('which steps end up in which box', () => {
  it('makes one box per run of rare steps, not one bucket for all of them', () => {
    const grouped = groupRareActivities(TWO_DETOURS, RARE_KEEP);

    expect(grouped.groups).toHaveLength(2);
    const sizes = grouped.groups!.map((g) => g.activities.length).sort();
    expect(sizes).toEqual([2, 3]);

    // A single bucket would wire both detours to the same node and draw a
    // junction the process does not have.
    const ids = new Set(grouped.groups!.map((g) => g.id));
    expect(ids.size).toBe(2);
  });

  it('names a box after its busiest member and says how many it holds', () => {
    const grouped = groupRareActivities(TWO_DETOURS, RARE_KEEP);
    const chase = grouped.groups!.find((g) => g.activities.includes('chase'));

    expect(chase?.activities).toEqual(['chase', 'rechase']);
    expect(chase?.id).toBe('chase +1 more');
  });

  it('leaves the busy steps exactly as they were', () => {
    const grouped = groupRareActivities(TWO_DETOURS, RARE_KEEP);
    const names = grouped.activities.map((a) => a.activity);

    for (const kept of ['submit', 'review', 'approve']) expect(names).toContain(kept);
    for (const folded of ['chase', 'rechase', 'escalate', 'legal', 'board']) {
      expect(names).not.toContain(folded);
    }
  });

  it('leaves a lone rare step visible rather than renaming it', () => {
    // One rare step among busy ones is readable. Collapsing it into a box is
    // not a simplification, it is the same step under an unfamiliar name.
    const lonely = graph(
      [
        ['a', 100, 100],
        ['b', 90, 90],
        ['odd', 3, 3],
      ],
      [
        ['a', 'b', 90],
        ['a', 'odd', 3],
        ['odd', 'b', 3],
      ],
    );

    const grouped = groupRareActivities(lonely, { keep: 2 / 3 });
    // Empty, not absent: grouping ran and decided there was nothing to collapse,
    // which is a different answer from never having been asked.
    expect(grouped.groups).toEqual([]);
    expect(grouped.activities.map((a) => a.activity)).toContain('odd');
  });

  it('collapses a lone step when the caller asks for it', () => {
    const lonely = graph(
      [
        ['a', 100, 100],
        ['b', 90, 90],
        ['odd', 3, 3],
      ],
      [
        ['a', 'b', 90],
        ['a', 'odd', 3],
        ['odd', 'b', 3],
      ],
    );

    const grouped = groupRareActivities(lonely, { keep: 2 / 3, minClusterSize: 1 });
    expect(grouped.groups).toHaveLength(1);
    expect(grouped.groups![0]?.id).toBe('odd');
  });

  it('never collapses a pinned step', () => {
    const grouped = groupRareActivities(TWO_DETOURS, { ...RARE_KEEP, pin: ['board'] });
    expect(grouped.activities.map((a) => a.activity)).toContain('board');
  });
});

describe('what the box says about itself', () => {
  const grouped = groupRareActivities(TWO_DETOURS, RARE_KEEP);
  const escalation = grouped.groups!.find((g) => g.activities.includes('escalate'))!;
  const node = grouped.activities.find((a) => a.activity === escalation.id)!;

  it('adds up the executions, because executions add up', () => {
    // escalate 9 + legal 6 + board 4
    expect(escalation.frequency).toBe(19);
    expect(node.frequency).toBe(19);
  });

  it('takes the largest case count rather than summing them', () => {
    // One case can pass through several members; summing would report more
    // cases than the log holds.
    expect(escalation.caseCount).toBe(9);
    expect(escalation.caseCount).toBeLessThan(9 + 6 + 4);
  });

  it('refuses a duration, because a median across different steps is not one', () => {
    expect(node.medianDurationSeconds).toBeNull();
    expect(node.medianCost).toBeNull();
  });

  it('sums cost, which is additive, and stays null when nothing was costed', () => {
    const costed: Dfg = {
      ...TWO_DETOURS,
      activities: TWO_DETOURS.activities.map((a) => ({
        ...a,
        totalCost: ['escalate', 'legal', 'board'].includes(a.activity) ? 10 : null,
      })),
    };

    const withCost = groupRareActivities(costed, RARE_KEEP);
    const box = withCost.activities.find((a) => a.activity.startsWith('escalate'))!;
    expect(box.totalCost).toBe(30);

    // The other box costed nothing, and null is not zero.
    const uncosted = withCost.activities.find((a) => a.activity.startsWith('chase'))!;
    expect(uncosted.totalCost).toBeNull();
  });
});

describe('the traffic through a box', () => {
  const grouped = groupRareActivities(TWO_DETOURS, RARE_KEEP);
  const chaseBox = grouped.groups!.find((g) => g.activities.includes('chase'))!.id;
  const edge = (from: string, to: string) =>
    grouped.edges.find((e) => e.from === from && e.to === to);

  it('routes an arc into a rare step into the box instead', () => {
    expect(edge('review', 'chase')).toBeUndefined();
    expect(edge('review', chaseBox)?.frequency).toBe(20);
  });

  it('routes an arc out of a rare step out of the box', () => {
    expect(edge(chaseBox, 'review')?.frequency).toBe(12);
  });

  it('absorbs the arcs inside a box rather than drawing them as a loop', () => {
    // chase -> rechase is now internal. Drawn as a self-loop it would read as
    // a repetition the process does not have.
    expect(edge(chaseBox, chaseBox)).toBeUndefined();
  });

  it('merges two arcs that now land on the same box', () => {
    // Two busy steps both leading into one cluster must sum, not overwrite.
    const converging = graph(
      [
        ['a', 100, 100],
        ['b', 100, 100],
        ['x', 8, 8],
        ['y', 5, 5],
      ],
      [
        ['a', 'x', 8],
        ['b', 'x', 4],
        ['x', 'y', 5],
      ],
    );

    const g = groupRareActivities(converging, { keep: 0.5 });
    const box = g.groups![0]!.id;
    expect(g.edges.find((e) => e.from === 'a' && e.to === box)?.frequency).toBe(8);
    expect(g.edges.find((e) => e.from === 'b' && e.to === box)?.frequency).toBe(4);
  });

  it('carries the start and end counts onto the box', () => {
    const bookended = graph(
      [
        ['main', 100, 100],
        ['oddStart', 6, 6],
        ['oddNext', 4, 4],
      ],
      [
        ['oddStart', 'oddNext', 4],
        ['oddNext', 'main', 4],
      ],
      { starts: { oddStart: 6, main: 94 }, ends: { main: 100 } },
    );

    const g = groupRareActivities(bookended, { keep: 1 / 3 });
    const box = g.groups![0]!.id;
    // Losing this is what produces a map with no entry point.
    expect(g.starts.get(box)).toBe(6);
    expect(g.starts.get('main')).toBe(94);
    expect(g.ends.get('main')).toBe(100);
  });
});

describe('behaving predictably', () => {
  it('leaves a graph alone when there is nothing rare enough to group', () => {
    const grouped = groupRareActivities(TWO_DETOURS, { keep: 1 });
    expect(grouped.groups).toEqual([]);
    expect(grouped.activities).toHaveLength(TWO_DETOURS.activities.length);
  });

  it('gives the same answer every time', () => {
    const a = groupRareActivities(TWO_DETOURS, RARE_KEEP);
    const b = groupRareActivities(TWO_DETOURS, RARE_KEEP);
    expect(a.groups).toEqual(b.groups);
    expect(a.edges).toEqual(b.edges);
  });

  it('does not steal the name of a real activity', () => {
    // A generated label can collide, because an activity name may hold any
    // printable character. Two nodes silently becoming one is the bug.
    const collides = graph(
      [
        ['busy', 100, 100],
        ['chase +1 more', 80, 80],
        ['chase', 6, 6],
        ['rechase', 4, 4],
      ],
      [
        ['busy', 'chase +1 more', 80],
        ['busy', 'chase', 6],
        ['chase', 'rechase', 4],
      ],
    );

    const g = groupRareActivities(collides, { keep: 0.5 });
    const names = g.activities.map((a) => a.activity);
    expect(names).toContain('chase +1 more');
    expect(g.groups![0]?.id).not.toBe('chase +1 more');
    expect(new Set(names).size).toBe(names.length);
  });

  it('keeps every execution on the map, unlike hiding', () => {
    const grouped = groupRareActivities(TWO_DETOURS, RARE_KEEP);
    const total = (d: Dfg): number => d.activities.reduce((n, a) => n + a.frequency, 0);

    // Grouping conserves the work; bridging deliberately does not, because a
    // hidden step's executions leave the map with it.
    expect(total(grouped)).toBe(total(TWO_DETOURS));
    expect(total(abstractNodes(TWO_DETOURS, RARE_KEEP))).toBeLessThan(total(TWO_DETOURS));
  });
});
