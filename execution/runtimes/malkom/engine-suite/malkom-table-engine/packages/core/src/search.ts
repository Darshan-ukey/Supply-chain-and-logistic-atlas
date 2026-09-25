/**
 * Global search, scoped to searchable columns only.
 *
 * Deliberately does NOT search every row property: derived/internal fields
 * (HTML blobs, raw payload mirrors) create false matches users can't see.
 */

import type { MalkomColumn, RowData } from './types.js';

export interface SearchTarget<TRow extends RowData> {
  field: string;
  searchValue?: ((row: TRow) => string) | undefined;
}

/** Extract the searchable targets from column config. */
export function searchTargetsOf<TRow extends RowData>(
  columns: MalkomColumn<TRow>[]
): SearchTarget<TRow>[] {
  return columns
    .filter((c) => c.searchable !== false && !!c.field)
    .map((c) => ({ field: c.field, searchValue: c.searchValue }));
}

function getByPath(row: Record<string, unknown>, path: string): unknown {
  if (!path.includes('.')) return row[path];
  let current: unknown = row;
  for (const part of path.split('.')) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function searchableText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    // Objects/arrays are not searched by default; use column.searchValue.
    return '';
  }
  return String(value);
}

/**
 * Build a row predicate for a search term over the given targets.
 * Empty/whitespace terms match everything.
 */
export function buildSearchPredicate<TRow extends RowData>(
  term: string,
  targets: SearchTarget<TRow>[]
): (row: TRow) => boolean {
  const needle = term.trim().toLowerCase();
  if (needle === '') return () => true;

  return (row: TRow): boolean =>
    targets.some((target) => {
      const text = target.searchValue
        ? target.searchValue(row)
        : searchableText(getByPath(row, target.field));
      return text.toLowerCase().includes(needle);
    });
}
