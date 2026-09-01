import { describe, expect, it } from 'vitest';
import {
  computeEligibility,
  fifoStrategy,
  leastActiveStrategy,
  roundRobinStrategy,
  type WorkItem,
  type Worker,
} from '../src/index.js';

function items(n: number): WorkItem[] {
  return Array.from({ length: n }, (_, i) => ({ id: `T${i + 1}`, attrs: {} }));
}

function workers(spec: Array<[string, number | null, number]>): Worker[] {
  return spec.map(([id, capacity, currentLoad]) => ({ id, capacity, currentLoad, attrs: {} }));
}

function allEligible(is: WorkItem[], ws: Worker[]): ReadonlyMap<string, ReadonlySet<string>> {
  return computeEligibility([], is, ws).eligibility;
}

describe('fifo', () => {
  it('respects capacity and stops when everyone is full', () => {
    const is = items(5);
    const ws = workers([
      ['A', 1, 0],
      ['B', 2, 0],
    ]);
    const { assignments } = fifoStrategy.allocate({ items: is, workers: ws, eligibility: allEligible(is, ws), state: null, params: {} });
    expect(assignments).toHaveLength(3);
    expect(assignments.filter((a) => a.workerId === 'A')).toHaveLength(1);
    expect(assignments.filter((a) => a.workerId === 'B')).toHaveLength(2);
  });
});

describe('round_robin', () => {
  it('rotates in worker-id order and resumes after the cursor', () => {
    const is = items(4);
    const ws = workers([
      ['A', null, 0],
      ['B', null, 0],
      ['C', null, 0],
    ]);
    const r1 = roundRobinStrategy.allocate({ items: is, workers: ws, eligibility: allEligible(is, ws), state: null, params: {} });
    expect(r1.assignments.map((a) => a.workerId)).toEqual(['A', 'B', 'C', 'A']);

    const state = r1.stateAfter!(new Set(['T1', 'T2', 'T3', 'T4']));
    expect(state.lastWorkerId).toBe('A');

    const r2 = roundRobinStrategy.allocate({ items: items(2), workers: ws, eligibility: allEligible(items(2), ws), state, params: {} });
    expect(r2.assignments.map((a) => a.workerId)).toEqual(['B', 'C']);
  });

  it('commits the cursor only over APPLIED assignments', () => {
    const is = items(3);
    const ws = workers([
      ['A', null, 0],
      ['B', null, 0],
      ['C', null, 0],
    ]);
    const r = roundRobinStrategy.allocate({ items: is, workers: ws, eligibility: allEligible(is, ws), state: null, params: {} });
    // Only the first write committed; the cursor must rest on A, not C.
    expect(r.stateAfter!(new Set(['T1'])).lastWorkerId).toBe('A');
  });

  it('survives the cursor worker leaving the pool', () => {
    const ws = workers([
      ['A', null, 0],
      ['C', null, 0],
    ]);
    const r = roundRobinStrategy.allocate({
      items: items(1),
      workers: ws,
      eligibility: allEligible(items(1), ws),
      state: { lastWorkerId: 'B' },
      params: {},
    });
    expect(r.assignments[0]!.workerId).toBe('C'); // first id strictly after 'B'
  });

  it('skips ineligible workers in rotation', () => {
    const is = items(2);
    const ws = workers([
      ['A', null, 0],
      ['B', null, 0],
    ]);
    const eligibility = new Map<string, ReadonlySet<string>>([
      ['T1', new Set(['B'])],
      ['T2', new Set(['A', 'B'])],
    ]);
    const r = roundRobinStrategy.allocate({ items: is, workers: ws, eligibility, state: null, params: {} });
    expect(r.assignments.map((a) => a.workerId)).toEqual(['B', 'A']);
  });
});

describe('least_active', () => {
  it('balances toward the least loaded, counting tentative assignments', () => {
    const is = items(4);
    const ws = workers([
      ['A', null, 3],
      ['B', null, 0],
    ]);
    const r = leastActiveStrategy.allocate({ items: is, workers: ws, eligibility: allEligible(is, ws), state: null, params: {} });
    // B takes 3 until it reaches A's load, then they alternate.
    expect(r.assignments.map((a) => a.workerId)).toEqual(['B', 'B', 'B', 'A']);
  });
});

describe('eligibility matching', () => {
  it('eq and contains (array + substring) semantics', () => {
    const is: WorkItem[] = [
      { id: 'T1', attrs: { skill: 'claims' } },
      { id: 'T2', attrs: { skill: 'marine' } },
    ];
    const ws: Worker[] = [
      { id: 'A', capacity: null, currentLoad: 0, attrs: { skills: ['billing', 'claims'] } },
      { id: 'B', capacity: null, currentLoad: 0, attrs: { skills: 'claims,billing' } },
    ];
    const { eligibility, unmatchable } = computeEligibility(
      [{ itemField: 'skill', workerAttr: 'skills', op: 'contains' }],
      is,
      ws,
    );
    expect([...eligibility.get('T1')!]).toEqual(['A', 'B']);
    expect(eligibility.get('T2')!.size).toBe(0);
    expect(unmatchable).toHaveLength(1);
    expect(unmatchable[0]!.itemId).toBe('T2');
  });
});
