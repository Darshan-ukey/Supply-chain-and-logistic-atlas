/**
 * Ported from the allocation engine's filter suite — this file is the drift
 * guard for the condition semantics the two engines share (null handling,
 * driver coercions, schema safety). The allocation engine's binding-schema
 * and SQL-compiler cases have no counterpart here: this engine evaluates
 * rules against materialized rows only (see evaluateFilter's doc comment),
 * so there is no compilation twin to guard.
 */
import { describe, expect, it } from 'vitest';
import {
  evaluateFilter,
  filterExprSchema,
  filterFields,
  filterValueSets,
  type FilterContext,
  type FilterExpr,
} from '../src/domain/filter.js';

describe('evaluateFilter', () => {
  const row = { status: 'NEW', priority: 5, region: null, active: true, name: 'alpha' };

  it.each<[FilterExpr, boolean]>([
    [{ op: 'eq', field: 'status', value: 'NEW' }, true],
    [{ op: 'eq', field: 'status', value: 'OLD' }, false],
    [{ op: 'eq', field: 'region', value: null }, true],
    [{ op: 'neq', field: 'region', value: 'EU' }, false], // SQL: NULL <> x is not true
    [{ op: 'in', field: 'status', values: ['NEW', 'REOPENED'] }, true],
    [{ op: 'notIn', field: 'status', values: ['CLOSED'] }, true],
    [{ op: 'notIn', field: 'region', values: ['EU'] }, false], // NULL NOT IN is not true
    [{ op: 'isNull', field: 'region' }, true],
    [{ op: 'isNotNull', field: 'region' }, false],
    [{ op: 'gt', field: 'priority', value: 4 }, true],
    [{ op: 'lte', field: 'priority', value: 4 }, false],
    [{ op: 'gt', field: 'region', value: 1 }, false], // comparisons against NULL never true
    [{ op: 'and', args: [{ op: 'eq', field: 'status', value: 'NEW' }, { op: 'gt', field: 'priority', value: 1 }] }, true],
    [{ op: 'or', args: [{ op: 'eq', field: 'status', value: 'X' }, { op: 'eq', field: 'active', value: true }] }, true],
    [{ op: 'not', arg: { op: 'eq', field: 'status', value: 'NEW' } }, false],
  ])('%j → %s', (expr, expected) => {
    expect(evaluateFilter(expr, row)).toBe(expected);
  });

  it('tolerates driver stringification of numbers', () => {
    expect(evaluateFilter({ op: 'eq', field: 'n', value: 5 }, { n: '5' })).toBe(true);
    expect(evaluateFilter({ op: 'gt', field: 'n', value: 4 }, { n: '5' })).toBe(true);
  });
});

describe('filter schema safety', () => {
  it('rejects non-identifier field names', () => {
    expect(filterExprSchema.safeParse({ op: 'eq', field: 'a"; DROP TABLE x; --', value: 1 }).success).toBe(false);
    expect(filterExprSchema.safeParse({ op: 'eq', field: 'ok_col$1', value: 1 }).success).toBe(true);
  });

  it('bounds in/notIn value lists and and/or arg lists', () => {
    expect(filterExprSchema.safeParse({ op: 'in', field: 'status', values: [] }).success).toBe(false);
    const tooManyValues = Array.from({ length: 257 }, (_, i) => i);
    expect(filterExprSchema.safeParse({ op: 'in', field: 'status', values: tooManyValues }).success).toBe(false);
    expect(filterExprSchema.safeParse({ op: 'and', args: [] }).success).toBe(false);
    const tooManyArgs = Array.from({ length: 33 }, () => ({ op: 'eq', field: 'x', value: 1 }));
    expect(filterExprSchema.safeParse({ op: 'and', args: tooManyArgs }).success).toBe(false);
  });
});

describe('inSet (value-set membership)', () => {
  const ctx: FilterContext = {
    valueSet: (id) => (id === 'region:transpacific-uswc' ? ['USWC', 'JP', 'KR'] : undefined),
  };
  const expr: FilterExpr = { op: 'inSet', field: 'region', set: 'region:transpacific-uswc' };

  it('matches when the row value is a member of the resolved set', () => {
    expect(evaluateFilter(expr, { region: 'JP' }, ctx)).toBe(true);
  });

  it('misses when the row value is not a member', () => {
    expect(evaluateFilter(expr, { region: 'EU' }, ctx)).toBe(false);
  });

  it('treats a NULL (or missing) row value as not a member', () => {
    expect(evaluateFilter(expr, { region: null }, ctx)).toBe(false);
    expect(evaluateFilter(expr, {}, ctx)).toBe(false);
  });

  it('tolerates driver stringification inside set membership', () => {
    const numCtx: FilterContext = { valueSet: () => [1, 2, 3] };
    expect(evaluateFilter({ op: 'inSet', field: 'n', set: 'nums' }, { n: '2' }, numCtx)).toBe(true);
  });

  it('throws on an unknown set id — a config defect, not a false condition', () => {
    expect(() =>
      evaluateFilter({ op: 'inSet', field: 'region', set: 'region:nope' }, { region: 'JP' }, ctx),
    ).toThrow(/unknown value-set "region:nope"/);
  });

  it('throws when no resolver is provided', () => {
    expect(() => evaluateFilter(expr, { region: 'JP' })).toThrow(/unknown value-set/);
    expect(() => evaluateFilter(expr, { region: 'JP' }, {})).toThrow(/unknown value-set/);
  });

  it('accepts value-set ids and rejects garbage', () => {
    expect(filterExprSchema.safeParse({ op: 'inSet', field: 'region', set: 'region:transpacific-uswc' }).success).toBe(true);
    expect(filterExprSchema.safeParse({ op: 'inSet', field: 'currency', set: 'iso4217' }).success).toBe(true);
    expect(filterExprSchema.safeParse({ op: 'inSet', field: 'region', set: 'has spaces' }).success).toBe(false);
    expect(filterExprSchema.safeParse({ op: 'inSet', field: 'region', set: ':leading-colon' }).success).toBe(false);
    expect(filterExprSchema.safeParse({ op: 'inSet', field: 'region', set: 'x"; DROP TABLE sets; --' }).success).toBe(false);
    // The field of an inSet term is still a plain identifier.
    expect(filterExprSchema.safeParse({ op: 'inSet', field: 'bad field', set: 'iso4217' }).success).toBe(false);
  });
});

describe('field and value-set collection', () => {
  const expr: FilterExpr = {
    op: 'and',
    args: [
      { op: 'eq', field: 'status', value: 'NEW' },
      {
        op: 'or',
        args: [
          { op: 'inSet', field: 'region', set: 'region:transpacific-uswc' },
          { op: 'not', arg: { op: 'inSet', field: 'currency', set: 'iso4217' } },
        ],
      },
      { op: 'isNull', field: 'closed_at' },
    ],
  };

  it('filterFields collects every referenced field, including inSet terms', () => {
    expect(filterFields(expr)).toEqual(new Set(['status', 'region', 'currency', 'closed_at']));
  });

  it('filterValueSets collects set ids through and/or/not nesting', () => {
    expect(filterValueSets(expr)).toEqual(new Set(['region:transpacific-uswc', 'iso4217']));
    expect(filterValueSets({ op: 'eq', field: 'status', value: 'NEW' })).toEqual(new Set());
  });
});

describe('matches (regex)', () => {
  const row = { bl: 'MAEU1234567', teu: 40, empty: '', missing: undefined, nothing: null };

  it.each<[string, string, boolean]>([
    ['bl', '^[A-Z]{4}\\d{7}$', true],
    ['bl', '^HLCU', false],
    ['empty', '^$', true], // empty string is a value, not a NULL
    ['teu', '^40$', true], // numbers match against their string form
  ])('field %s against /%s/ → %s', (field, pattern, expected) => {
    expect(evaluateFilter({ op: 'matches', field, pattern }, row)).toBe(expected);
  });

  it('NULL and missing fields never match — SQL semantics', () => {
    expect(evaluateFilter({ op: 'matches', field: 'nothing', pattern: '.*' }, row)).toBe(false);
    expect(evaluateFilter({ op: 'matches', field: 'ghost', pattern: '.*' }, row)).toBe(false);
  });

  it('rejects invalid or oversize patterns at the schema', () => {
    expect(filterExprSchema.safeParse({ op: 'matches', field: 'bl', pattern: '(' }).success).toBe(false);
    expect(filterExprSchema.safeParse({ op: 'matches', field: 'bl', pattern: 'x'.repeat(257) }).success).toBe(false);
    expect(filterExprSchema.safeParse({ op: 'matches', field: 'bl', pattern: '^[A-Z]+$' }).success).toBe(true);
  });

  it('participates in field collection and nesting', () => {
    const nested: FilterExpr = { op: 'not', arg: { op: 'matches', field: 'bl', pattern: '^X' } };
    expect(filterFields(nested)).toEqual(new Set(['bl']));
    expect(evaluateFilter(nested, row)).toBe(true);
  });
});
