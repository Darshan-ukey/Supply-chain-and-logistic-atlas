/**
 * Tests for global search: searchTargetsOf + buildSearchPredicate.
 *
 * The key behavioral contract: search is scoped to configured targets only.
 * Row fields that are not targets (derived HTML blobs, payload mirrors) must
 * never produce matches — that was the legacy bug this engine fixes.
 */

import { describe, expect, test } from 'vitest';
import {
  buildSearchPredicate,
  searchTargetsOf,
  type MalkomColumn,
  type SearchTarget
} from '@malkom/table-core';

describe('searchTargetsOf', () => {
  test('includes columns by default and excludes columns marked searchable:false', () => {
    const columns: MalkomColumn[] = [
      { field: 'name', header: 'Name' },
      { field: 'internalHtml', header: 'Raw HTML', searchable: false },
      { field: 'city', header: 'City', searchable: true }
    ];

    const targets = searchTargetsOf(columns);

    expect(targets.map((t) => t.field)).toEqual(['name', 'city']);
  });

  test('carries the searchValue function through to the target', () => {
    const searchValue = (row: Record<string, unknown>) => `custom:${row.name}`;
    const columns: MalkomColumn[] = [
      { field: 'name', header: 'Name', searchValue },
      { field: 'age', header: 'Age' }
    ];

    const targets = searchTargetsOf(columns);

    expect(targets[0].searchValue).toBe(searchValue);
    expect(targets[1].searchValue).toBeUndefined();
  });

  test('returns an empty list when every column opts out of search', () => {
    const columns: MalkomColumn[] = [
      { field: 'a', header: 'A', searchable: false },
      { field: 'b', header: 'B', searchable: false }
    ];

    expect(searchTargetsOf(columns)).toEqual([]);
  });
});

describe('buildSearchPredicate', () => {
  const targets: SearchTarget<Record<string, unknown>>[] = [
    { field: 'name' },
    { field: 'city' }
  ];

  test('an empty term matches every row', () => {
    const predicate = buildSearchPredicate('', targets);
    expect(predicate({ name: 'Alice', city: 'Sydney' })).toBe(true);
    expect(predicate({})).toBe(true);
  });

  test('a whitespace-only term matches every row', () => {
    const predicate = buildSearchPredicate('   \t  ', targets);
    expect(predicate({ name: 'Alice', city: 'Sydney' })).toBe(true);
    expect(predicate({})).toBe(true);
  });

  test('matches case-insensitively in both directions', () => {
    const upperTerm = buildSearchPredicate('ALICE', targets);
    expect(upperTerm({ name: 'alice', city: 'Sydney' })).toBe(true);

    const lowerTerm = buildSearchPredicate('sydney', targets);
    expect(lowerTerm({ name: 'Bob', city: 'SYDNEY' })).toBe(true);
  });

  test('matches substrings anywhere in the value', () => {
    const predicate = buildSearchPredicate('ydne', targets);
    expect(predicate({ name: 'Bob', city: 'Sydney' })).toBe(true);
    expect(predicate({ name: 'Bob', city: 'Melbourne' })).toBe(false);
  });

  test('trims the term before matching', () => {
    const predicate = buildSearchPredicate('  alice  ', targets);
    expect(predicate({ name: 'Alice', city: 'Sydney' })).toBe(true);
  });

  test('returns false when no target value contains the term', () => {
    const predicate = buildSearchPredicate('zzz', targets);
    expect(predicate({ name: 'Alice', city: 'Sydney' })).toBe(false);
  });

  test('only searches configured targets: a row field outside the targets never matches', () => {
    // Legacy bug: derived fields (HTML blobs etc.) on the row caused false
    // matches. The engine must ignore any row property that is not a target.
    const predicate = buildSearchPredicate('secret', targets);
    const row = {
      name: 'Alice',
      city: 'Sydney',
      derivedHtml: '<span class="secret">secret</span>',
      rawPayload: 'secret secret secret'
    };
    expect(predicate(row)).toBe(false);
  });

  test('object and array field values are not searched by default', () => {
    const objTargets: SearchTarget<Record<string, unknown>>[] = [
      { field: 'meta' },
      { field: 'tags' }
    ];
    const predicate = buildSearchPredicate('alpha', objTargets);
    expect(predicate({ meta: { label: 'alpha' }, tags: ['alpha', 'beta'] })).toBe(false);
  });

  test('a searchValue override is used instead of the raw field value', () => {
    const overrideTargets: SearchTarget<Record<string, unknown>>[] = [
      {
        field: 'meta',
        searchValue: (row) => (row.meta as { label: string }).label
      }
    ];
    const matches = buildSearchPredicate('alpha', overrideTargets);
    expect(matches({ meta: { label: 'Alpha thing' } })).toBe(true);

    // The raw (object) value would have been unsearchable; and once the
    // override exists, the raw value no longer participates at all.
    const rawTargets: SearchTarget<Record<string, unknown>>[] = [
      { field: 'name', searchValue: () => 'replacement text' }
    ];
    const noRawMatch = buildSearchPredicate('alice', rawTargets);
    expect(noRawMatch({ name: 'Alice' })).toBe(false);
    const overrideMatch = buildSearchPredicate('replacement', rawTargets);
    expect(overrideMatch({ name: 'Alice' })).toBe(true);
  });

  test('dot-path fields resolve nested values', () => {
    const nestedTargets: SearchTarget<Record<string, unknown>>[] = [
      { field: 'owner.address.city' }
    ];
    const predicate = buildSearchPredicate('perth', nestedTargets);
    expect(predicate({ owner: { address: { city: 'Perth' } } })).toBe(true);
    expect(predicate({ owner: { address: { city: 'Hobart' } } })).toBe(false);
  });

  test('dot-path fields with a missing or null intermediate do not match and do not throw', () => {
    const nestedTargets: SearchTarget<Record<string, unknown>>[] = [
      { field: 'owner.address.city' }
    ];
    const predicate = buildSearchPredicate('perth', nestedTargets);
    expect(predicate({})).toBe(false);
    expect(predicate({ owner: null })).toBe(false);
    expect(predicate({ owner: { address: undefined } })).toBe(false);
    expect(predicate({ owner: 'not-an-object' })).toBe(false);
  });

  test('number values are stringified for matching', () => {
    const numTargets: SearchTarget<Record<string, unknown>>[] = [{ field: 'count' }];
    expect(buildSearchPredicate('425', numTargets)({ count: 4250 })).toBe(true);
    expect(buildSearchPredicate('9', numTargets)({ count: 4250 })).toBe(false);
  });

  test('boolean values are stringified for matching', () => {
    const boolTargets: SearchTarget<Record<string, unknown>>[] = [{ field: 'active' }];
    expect(buildSearchPredicate('tru', boolTargets)({ active: true })).toBe(true);
    expect(buildSearchPredicate('false', boolTargets)({ active: false })).toBe(true);
    expect(buildSearchPredicate('false', boolTargets)({ active: true })).toBe(false);
  });

  test('null and undefined field values never match', () => {
    const predicate = buildSearchPredicate('null', targets);
    expect(predicate({ name: null, city: undefined })).toBe(false);
  });
});
