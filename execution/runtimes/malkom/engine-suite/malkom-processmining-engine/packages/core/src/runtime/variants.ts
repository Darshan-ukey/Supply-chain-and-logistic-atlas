import { countOf, numberOrNull } from '../domain/identifiers.js';
import type { SqlClient } from '../ports/sql.js';
import type { SqlDialect } from '../sql/dialect.js';
import type { CaseFilter } from './filter.js';
import { CASE_CYCLE_SECONDS, buildLog } from './logquery.js';
import type { LogCapabilities, Perspective } from './eventlog.js';
import type { BusinessCalendar } from './calendar.js';

/**
 * Variant analysis: the distinct paths cases actually take, ranked.
 *
 * A discovered map shows every possibility at once and so hides how work is
 * really distributed. Variants show the shape of that distribution, and in
 * almost every real process it is brutally uneven — a handful of paths carry
 * most of the volume and a long tail of one-off paths carries the rest.
 *
 * That split is the useful part. The head is what to optimise, because it is
 * where the volume is. The tail is what to investigate, because a path taken
 * once is either an exception worth understanding or a mistake worth stopping.
 */

export interface VariantOptions {
  objectType: string;
  schema?: string | undefined;
  window?: { from?: Date | undefined; to?: Date | undefined } | undefined;
  lifecycle?: readonly string[] | undefined;
  /** Restrict to whole CASES matching this selection. */
  filter?: CaseFilter | undefined;
  /** Step, person, or an event attribute — what goes in the boxes. */
  perspective?: Perspective | undefined;
  /** Probe with detectCapabilities; omitting it projects absent columns as NULL. */
  capabilities?: LogCapabilities | undefined;
  /**
   * Measure durations in working time rather than wall-clock. See
   * `LogQueryOptions.calendar`; off by default, and every figure here is the
   * wall-clock one without it.
   */
  calendar?: BusinessCalendar | undefined;
  /** Variants to return, most frequent first. Default 50. The rest are summarised. */
  limit?: number;
  /** Separator between activities in the path key. */
  separator?: string;
  /** Cap on activities kept per variant path, so one runaway case cannot bloat the result. */
  maxPathLength?: number;
}

export interface Variant {
  /** 1 = most frequent. */
  rank: number;
  /** The ordered activity sequence. */
  path: string[];
  cases: number;
  /** Share of all cases following this exact path, 0–1. */
  share: number;
  /** Running share including every variant ranked above this one. */
  cumulativeShare: number;
  events: number;
  /** Case cycle time for this path — the same path can still run at two speeds. */
  medianCycleSeconds: number | null;
  p90CycleSeconds: number | null;
  /** A few case ids, so a finding can be traced back to real work. */
  sampleCases: string[];
}

export interface VariantReport {
  objectType: string;
  totalCases: number;
  /** Distinct paths across the whole log, not just the returned page. */
  totalVariants: number;
  variants: Variant[];
  /** Variants beyond `limit`, rolled up rather than silently dropped. */
  remainder: { variants: number; cases: number; share: number } | null;
  /**
   * How many variants it takes to cover 80% of cases. The single most telling
   * number about a process: 3 means it is standardised, 400 means it is not.
   */
  variantsFor80Percent: number;
  /** Cases whose path is unique to them — the true one-offs. */
  singletonVariants: number;
  singletonCases: number;
}

const ORDER = `ts, CASE lower(COALESCE(lifecycle, ''))
    WHEN 'schedule' THEN 0 WHEN 'assign' THEN 1 WHEN 'start' THEN 2
    WHEN '' THEN 3 WHEN 'complete' THEN 4 ELSE 5 END, event_id`;

const DEFAULT_LIMIT = 50;
const DEFAULT_SEPARATOR = ' → ';
const DEFAULT_MAX_PATH = 200;

export async function analyseVariants(
  client: SqlClient,
  dialect: SqlDialect,
  opts: VariantOptions,
): Promise<VariantReport> {
  const limit = opts.limit ?? DEFAULT_LIMIT;
  const separator = opts.separator ?? DEFAULT_SEPARATOR;
  const maxPath = opts.maxPathLength ?? DEFAULT_MAX_PATH;

  const params: unknown[] = [];
  const { sql: log } = buildLog(dialect, params, opts);

  // A trace is only the same variant as another if the ORDER matches too, so
  // the aggregation has to be ordered — an unordered concat would merge paths
  // that share activities but not sequence.
  const perCase = `
    SELECT case_id,
           ${dialect.stringAgg('activity', separator, ORDER)} AS path,
           COUNT(*) AS events,
           ${CASE_CYCLE_SECONDS} AS cycle_s
    FROM (${log}) v
    GROUP BY case_id`;

  const grouped = `
    SELECT path,
           COUNT(*) AS cases,
           SUM(events) AS events,
           ${dialect.medianOf('cycle_s')} AS median_cycle,
           ${dialect.quantileOf('cycle_s', 0.9)} AS p90_cycle,
           MIN(case_id) AS sample_a,
           MAX(case_id) AS sample_b
    FROM (${perCase}) c
    GROUP BY path`;

  const [topRows, summaryRows] = await Promise.all([
    client.query(`SELECT * FROM (${grouped}) g ORDER BY cases DESC, path ASC LIMIT ${Math.max(1, limit)}`, params),
    client.query(
      `SELECT COUNT(*) AS variants,
              SUM(cases) AS total_cases,
              COUNT(*) FILTER (WHERE cases = 1) AS singleton_variants,
              SUM(CASE WHEN cases = 1 THEN cases ELSE 0 END) AS singleton_cases
       FROM (${grouped}) s`,
      params,
    ),
  ]);

  const summary = summaryRows.rows[0] ?? {};
  const totalCases = countOf(summary['total_cases']);
  const totalVariants = countOf(summary['variants']);

  let cumulative = 0;
  const variants: Variant[] = topRows.rows.map((r, i) => {
    const cases = countOf(r['cases']);
    const share = totalCases > 0 ? cases / totalCases : 0;
    cumulative += share;
    const rawPath = String(r['path'] ?? '');
    const path = rawPath === '' ? [] : rawPath.split(separator).slice(0, maxPath);
    const samples = [String(r['sample_a'] ?? ''), String(r['sample_b'] ?? '')].filter(
      (s, idx, arr) => s !== '' && arr.indexOf(s) === idx,
    );
    return {
      rank: i + 1,
      path,
      cases,
      share,
      cumulativeShare: cumulative,
      events: countOf(r['events']),
      medianCycleSeconds: numberOrNull(r['median_cycle']),
      p90CycleSeconds: numberOrNull(r['p90_cycle']),
      sampleCases: samples,
    };
  });

  const shownCases = variants.reduce((sum, v) => sum + v.cases, 0);
  const remainderVariants = totalVariants - variants.length;
  // Never drop the tail silently — a report that shows 50 of 4,000 variants
  // and says nothing reads as though it showed all of them.
  const remainder =
    remainderVariants > 0
      ? {
          variants: remainderVariants,
          cases: totalCases - shownCases,
          share: totalCases > 0 ? (totalCases - shownCases) / totalCases : 0,
        }
      : null;

  return {
    objectType: opts.objectType,
    totalCases,
    totalVariants,
    variants,
    remainder,
    variantsFor80Percent: await countVariantsForCoverage(client, grouped, params, totalCases, 0.8),
    singletonVariants: countOf(summary['singleton_variants']),
    singletonCases: countOf(summary['singleton_cases']),
  };
}

/**
 * How many variants it takes to cover a share of cases.
 *
 * Computed over ALL variants, not just the returned page, because the answer
 * is frequently larger than any sensible page size — and that is precisely
 * when the number matters most.
 */
async function countVariantsForCoverage(
  client: SqlClient,
  grouped: string,
  params: readonly unknown[],
  totalCases: number,
  target: number,
): Promise<number> {
  if (totalCases === 0) return 0;
  const needed = Math.ceil(totalCases * target);
  const { rows } = await client.query(
    `SELECT MIN(rn) AS n FROM (
       SELECT ROW_NUMBER() OVER (ORDER BY cases DESC, path ASC) AS rn,
              SUM(cases) OVER (ORDER BY cases DESC, path ASC
                               ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS running
       FROM (${grouped}) g
     ) r WHERE running >= ${needed}`,
    params,
  );
  return countOf(rows[0]?.['n']);
}

/** Render a variant path compactly for a terminal or a label. */
export function formatPath(path: readonly string[], maxSteps = 8): string {
  if (path.length <= maxSteps) return path.join(' → ');
  const head = path.slice(0, maxSteps - 1).join(' → ');
  return `${head} → … (+${path.length - (maxSteps - 1)} more)`;
}
