import type { SqlClient } from '../ports/sql.js';
import { agglomerate, unitVector } from './vectors.js';
import type { SqlDialect } from '../sql/dialect.js';
import type { CaseFilter } from './filter.js';
import { analyseVariants, type VariantOptions } from './variants.js';

/**
 * Four thousand variants collapsed into six behaviours.
 *
 * The only workable answer to an unstructured log. A variant list with a
 * three-thousand-row tail is not a finding, it is the absence of one: every row
 * is a route one case took, and nobody can read three thousand routes. Mining
 * the whole log at once gives a hairball; mining one variant gives a line.
 *
 * Clustering sits between. Group the routes that behave alike, and each group is
 * small enough to mine into a readable map while still covering enough cases to
 * be worth looking at. The output is deliberately a set of FILTERS as well as a
 * set of groups, because a cluster is only useful if you can then look at it —
 * every other analysis in this engine takes a filter, so a cluster becomes an
 * ordinary selection rather than a special mode.
 *
 * **Agglomerative, not k-means.** k-means needs a k nobody knows, starts from a
 * random seed, and gives a different answer on the same log twice. Merging the
 * closest pair repeatedly is deterministic, needs no seed, and produces the
 * whole hierarchy — so a caller can cut it at any k without re-running. On the
 * number of distinct variants a real log holds, the cost is irrelevant.
 */

export interface TraceCluster {
  id: number;
  /** The variant that best represents the group — its most common route. */
  representative: string[];
  /** Every route in the group, most frequent first. */
  variants: { path: string[]; cases: number }[];
  cases: number;
  /** Share of the clustered population, 0-1. */
  share: number;
  /**
   * Activities that mark this group out, most distinctive first.
   *
   * Measured against the rest of the population rather than in absolute terms:
   * an activity every case performs describes nothing, however common it is
   * here.
   */
  distinctiveActivities: { activity: string; lift: number; share: number }[];
  /** Selects exactly this group's cases, so a cluster can be looked at. */
  filter: CaseFilter;
  /** Plain description of what makes this group a group. */
  reading: string;
}

export interface ClusterReport {
  objectType: string;
  clusters: TraceCluster[];
  /** Variants fed into the clustering. */
  variantsClustered: number;
  /** Cases covered by those variants. */
  casesClustered: number;
  totalCases: number;
  /** Distinct routes in the whole log, so the reduction is visible. */
  totalVariants: number;
}

export interface ClusteringOptions extends VariantOptions {
  /** Groups to cut the hierarchy into. Default 6. */
  clusters?: number | undefined;
  /** Variants considered, most frequent first. Default 300. */
  variantLimit?: number | undefined;
}

const DEFAULT_CLUSTERS = 6;
const DEFAULT_VARIANT_LIMIT = 300;
/** Activities this much more common here than elsewhere are worth naming. */
const DISTINCTIVE_LIFT = 1.5;

export async function clusterTraces(
  client: SqlClient,
  dialect: SqlDialect,
  opts: ClusteringOptions,
): Promise<ClusterReport> {
  const wanted = Math.max(1, Math.trunc(opts.clusters ?? DEFAULT_CLUSTERS));
  const variantLimit = Math.max(1, Math.trunc(opts.variantLimit ?? DEFAULT_VARIANT_LIMIT));

  const report = await analyseVariants(client, dialect, { ...opts, limit: variantLimit });
  const variants = report.variants.map((v) => ({ path: v.path, cases: v.cases }));

  if (variants.length === 0) {
    return {
      objectType: opts.objectType,
      clusters: [],
      variantsClustered: 0,
      casesClustered: 0,
      totalCases: report.totalCases,
      totalVariants: report.totalVariants,
    };
  }

  const vectors = variants.map((v) => featureVector(v.path));
  const groups = agglomerate(vectors, Math.min(wanted, variants.length));

  const casesClustered = variants.reduce((n, v) => n + v.cases, 0);
  // Population-wide activity shares, so distinctiveness is measured against
  // everything else rather than against nothing.
  const overall = activityShares(variants);

  const clusters: TraceCluster[] = groups
    .map((members) => {
      const own = members
        .map((i) => variants[i]!)
        .sort((a, b) => b.cases - a.cases || a.path.join().localeCompare(b.path.join()));
      const cases = own.reduce((n, v) => n + v.cases, 0);
      const shares = activityShares(own);

      const distinctive = [...shares.entries()]
        .map(([activity, share]) => ({
          activity,
          share,
          // Lift against the whole population. An activity absent elsewhere has
          // no denominator, so it is treated as maximally distinctive rather
          // than dividing by zero.
          lift: (overall.get(activity) ?? 0) === 0 ? Infinity : share / overall.get(activity)!,
        }))
        .filter((a) => a.lift >= DISTINCTIVE_LIFT && a.share > 0)
        .sort((a, b) => b.lift - a.lift || a.activity.localeCompare(b.activity))
        .slice(0, 5);

      return {
        id: 0,
        representative: own[0]!.path,
        variants: own,
        cases,
        share: casesClustered === 0 ? 0 : cases / casesClustered,
        distinctiveActivities: distinctive,
        filter: filterFor(own.map((v) => v.path)),
        reading: readCluster(own, distinctive),
      };
    })
    .sort((a, b) => b.cases - a.cases || a.representative.join().localeCompare(b.representative.join()))
    .map((cluster, id) => ({ ...cluster, id }));

  return {
    objectType: opts.objectType,
    clusters,
    variantsClustered: variants.length,
    casesClustered,
    totalCases: report.totalCases,
    totalVariants: report.totalVariants,
  };
}

/**
 * How a route is described for the purpose of comparing it to another.
 *
 * Activities AND adjacent pairs. Activities alone would call two routes
 * identical whenever they use the same steps in a different order, which is
 * exactly the difference a process person cares about — "approve then check" is
 * not "check then approve". The pairs carry the ordering; the activities keep
 * routes of very different lengths comparable.
 */
function featureVector(path: readonly string[]): Map<string, number> {
  const features = new Map<string, number>();
  const bump = (key: string): void => {
    features.set(key, (features.get(key) ?? 0) + 1);
  };

  for (const activity of path) bump(`a:${activity}`);
  for (let i = 1; i < path.length; i += 1) bump(`p:${path[i - 1]}>${path[i]}`);

  // Unit length, so cosine distance compares shape rather than size: a
  // twenty-step route and a two-step route through the same activities should
  // not be far apart merely for being long.
  return unitVector(features);
}

/** Share of a population's cases in which each activity appears. */
function activityShares(
  variants: readonly { path: string[]; cases: number }[],
): Map<string, number> {
  const total = variants.reduce((n, v) => n + v.cases, 0);
  const counts = new Map<string, number>();
  for (const variant of variants) {
    for (const activity of new Set(variant.path)) {
      counts.set(activity, (counts.get(activity) ?? 0) + variant.cases);
    }
  }
  const shares = new Map<string, number>();
  if (total === 0) return shares;
  for (const [activity, n] of counts) shares.set(activity, n / total);
  return shares;
}

/**
 * A filter selecting exactly this cluster's cases.
 *
 * An `or` of exact routes rather than something cleverer. It is exact by
 * construction — a case is in the cluster if and only if it follows one of
 * these routes — and every analysis in the engine already takes a filter, so a
 * cluster becomes an ordinary selection rather than a mode.
 */
function filterFor(paths: readonly string[][]): CaseFilter {
  const args: CaseFilter[] = paths.map((path) => ({ kind: 'variant', path: [...path] }));
  return args.length === 1 ? args[0]! : { kind: 'or', args };
}

function readCluster(
  variants: readonly { path: string[]; cases: number }[],
  distinctive: readonly { activity: string; lift: number }[],
): string {
  const lengths = variants.map((v) => v.path.length);
  const shortest = Math.min(...lengths);
  const longest = Math.max(...lengths);
  const span = shortest === longest ? `${shortest} steps` : `${shortest}-${longest} steps`;

  if (distinctive.length === 0) {
    return variants.length === 1
      ? `a single route, ${span}`
      : `${variants.length} routes of ${span}, with nothing that marks them out from the rest`;
  }
  const named = distinctive.slice(0, 3).map((a) => a.activity).join(', ');
  return `${variants.length} route${variants.length === 1 ? '' : 's'} of ${span}, marked out by ${named}`;
}
