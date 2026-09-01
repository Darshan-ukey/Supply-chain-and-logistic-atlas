import type { Dfg } from './dfg.js';

/**
 * The footprint: how every pair of activities is ordered, as a grid.
 *
 * For each ordered pair the log supports exactly one of four answers — a always
 * leads to b, b always leads to a, both orders occur, or the two never met.
 * This is the ordering-relation table the Alpha algorithm is built on. The
 * algorithm itself is not worth having (no noise handling, breaks on short
 * loops, emits models that can deadlock) but the table is, because it is the
 * cheapest legible way to answer a question the map answers badly:
 *
 *   what changed between January and March?
 *
 * A map redrawn twice has to be compared by eye, and two spaghetti diagrams
 * side by side settle nothing. Two footprints diff to a short list of cells —
 * "Credit Check and Verify Address used to run in either order; since March,
 * Credit Check always comes first" — which is a sentence somebody can act on.
 *
 * One honest limitation, stated because it is easy to misread: `parallel` here
 * means only that both orders were observed. True concurrency and a two-step
 * loop are indistinguishable at this resolution. `heuristics.ts` separates
 * them, and a caller showing both should say which it is reporting.
 */

export type FootprintRelation =
  /** `from` was observed leading to `to`, never the reverse. */
  | 'follows'
  /** `to` was observed leading to `from`, never the reverse. */
  | 'precedes'
  /** Both orders occur: concurrent, or alternating. */
  | 'parallel';

export interface FootprintCell {
  from: string;
  to: string;
  relation: FootprintRelation;
}

export interface Footprint {
  objectType: string;
  /** Activities covered, most frequent first. */
  activities: string[];
  /**
   * Non-empty relations only. A pair absent from this list never occurred
   * adjacently, which is the fourth relation and by far the most common — a
   * dense grid would be mostly a report of things that did not happen.
   */
  cells: FootprintCell[];
  /** Activities dropped by `limit`, so a truncated grid cannot read as whole. */
  omitted: number;
}

export interface FootprintOptions {
  /**
   * Activities to include, ranked by frequency. Default 60.
   *
   * A grid is quadratic: 60 activities is 3,600 cells, 300 would be 90,000. The
   * cap is on the payload, not on the analysis — the DFG it reads was built
   * over the whole log.
   */
  limit?: number;
}

const DEFAULT_LIMIT = 60;

/** NUL joins the halves; an activity name may hold any printable character. */
const SEP = '\u0000';

export function footprint(dfg: Dfg, opts: FootprintOptions = {}): Footprint {
  const limit = Math.max(1, opts.limit ?? DEFAULT_LIMIT);

  const ranked = [...dfg.activities].sort(
    (a, b) => b.frequency - a.frequency || a.activity.localeCompare(b.activity),
  );
  const kept = ranked.slice(0, limit).map((a) => a.activity);
  const inScope = new Set(kept);

  const observed = new Set<string>();
  for (const edge of dfg.edges) {
    if (inScope.has(edge.from) && inScope.has(edge.to)) {
      observed.add(`${edge.from}${SEP}${edge.to}`);
    }
  }
  const seen = (from: string, to: string): boolean => observed.has(`${from}${SEP}${to}`);

  const cells: FootprintCell[] = [];
  for (const from of kept) {
    for (const to of kept) {
      const forward = seen(from, to);
      const reverse = seen(to, from);
      if (!forward && !reverse) continue;
      cells.push({
        from,
        to,
        relation: forward && reverse ? 'parallel' : forward ? 'follows' : 'precedes',
      });
    }
  }

  return {
    objectType: dfg.objectType,
    activities: kept,
    cells,
    omitted: Math.max(0, ranked.length - kept.length),
  };
}

/** Read one cell. Absent means the two activities were never adjacent. */
export function relationAt(fp: Footprint, from: string, to: string): FootprintRelation | null {
  for (const cell of fp.cells) {
    if (cell.from === from && cell.to === to) return cell.relation;
  }
  return null;
}

export interface FootprintDifference {
  from: string;
  to: string;
  /** Null on either side means the pair was never adjacent in that log. */
  before: FootprintRelation | null;
  after: FootprintRelation | null;
}

export interface FootprintComparison {
  /** Cells whose relation changed, over activities present in both. */
  differences: FootprintDifference[];
  /** Activities that exist in one side only — a change the grid cannot express. */
  onlyBefore: string[];
  onlyAfter: string[];
  /**
   * Share of shared cells that agree, 0–1.
   *
   * Over the pairs adjacent in at least one of the two, not over the full grid.
   * Counting the empty cells would put agreement near 1 for any pair of logs,
   * because most activity pairs never meet in either.
   */
  agreement: number;
}

/**
 * Diff two footprints.
 *
 * Deliberately not symmetric in naming: one side is `before` and one is
 * `after`, because every use of this is a question about change — two periods,
 * two regions, the log against a reference. Naming them A and B would leave the
 * reader to work out which direction a difference runs.
 */
export function compareFootprints(before: Footprint, after: Footprint): FootprintComparison {
  const beforeSet = new Set(before.activities);
  const afterSet = new Set(after.activities);
  const shared = before.activities.filter((a) => afterSet.has(a));

  const index = (fp: Footprint): Map<string, FootprintRelation> => {
    const map = new Map<string, FootprintRelation>();
    for (const cell of fp.cells) map.set(`${cell.from}${SEP}${cell.to}`, cell.relation);
    return map;
  };
  const b = index(before);
  const a = index(after);

  const differences: FootprintDifference[] = [];
  let compared = 0;

  for (const from of shared) {
    for (const to of shared) {
      const key = `${from}${SEP}${to}`;
      const wasRelation = b.get(key) ?? null;
      const isRelation = a.get(key) ?? null;
      if (wasRelation === null && isRelation === null) continue;
      compared += 1;
      if (wasRelation !== isRelation) {
        differences.push({ from, to, before: wasRelation, after: isRelation });
      }
    }
  }

  return {
    differences,
    onlyBefore: before.activities.filter((x) => !afterSet.has(x)),
    onlyAfter: after.activities.filter((x) => !beforeSet.has(x)),
    agreement: compared === 0 ? 1 : (compared - differences.length) / compared,
  };
}
