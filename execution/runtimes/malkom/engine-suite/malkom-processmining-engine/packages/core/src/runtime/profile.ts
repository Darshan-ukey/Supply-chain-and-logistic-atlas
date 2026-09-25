import {
  eventsPerRow,
  grainYieldsSteps,
  type Attribute,
  type FilterExpr,
  type Grain,
  type SourceBinding,
} from '../config/schemas.js';
import { AdapterError, looksLikeSchemaError } from '../domain/errors.js';
import { countOf, instantMsOf, numberOrNull } from '../domain/identifiers.js';
import type { SqlClient } from '../ports/sql.js';
import {
  activityExpr,
  andAll,
  caseKeyExpr,
  compileFilter,
  eventTimestamps,
  fromClause,
  ParamBuilder,
  quoteColumn,
  whereClause,
} from '../sql/compile.js';
import type { SqlDialect } from '../sql/dialect.js';

/**
 * The profiler: bind a source, and find out immediately whether the role
 * mapping actually holds.
 *
 * This exists so a configuration mistake surfaces as DATA — "1.2M rows, 340k
 * cases, 3.5 events per case" — rather than as a plausible-looking process map
 * built on a wrong case key. It is the cheapest possible check and it runs
 * before anything downstream is trusted, which is why it is the first
 * capability in the engine rather than a diagnostic bolted on later.
 *
 * Everything here is aggregate SQL executed against the host. No event rows
 * are transferred.
 */

export type FindingSeverity = 'error' | 'warning' | 'info';

export interface ProfileFinding {
  severity: FindingSeverity;
  /** Stable machine-readable code; message wording is not API surface. */
  code: string;
  message: string;
  /** What to do about it. Present whenever there is a concrete action. */
  remedy?: string;
}

export interface RoleCoverage {
  role: string;
  column: string;
  nullCount: number;
  /** 0–1, and 0 rather than NaN when there are no rows at all. */
  nullRatio: number;
}

export interface BindingProfile {
  bindingId: string;
  grain: Grain;
  table: string;
  /** Object type the case key resolved to, when pivoting on an object link. */
  caseObject: string | undefined;
  /** The column actually used as the case key. Undefined means uncorrelatable. */
  caseColumn: string | undefined;
  rowCount: number;
  /** rowCount x events-per-row for this grain. Snapshot sources contribute zero. */
  eventCount: number;
  caseCount: number;
  /** Distinct activity names. Undefined for snapshot grain. */
  activityCount: number | undefined;
  /** Distinct resources. Undefined when no resource role is mapped. */
  resourceCount: number | undefined;
  rowsPerCase: { mean: number | null; median: number | null; max: number | null };
  eventsPerCase: { mean: number | null; median: number | null; max: number | null };
  /** Cases represented by exactly one source row. */
  singleRowCases: number;
  /** Span of the source's timestamps. Null for snapshot grain. */
  timeRange: { from: Date; to: Date } | null;
  /** Interval rows whose end precedes their start — always a data defect. */
  invertedIntervals: number | undefined;
  roleCoverage: RoleCoverage[];
  attributeCount: number;
  findings: ProfileFinding[];
}

export interface ProfileOptions {
  /**
   * Which object type to pivot the case key on. Omit to use the binding's
   * `roles.case`, or its sole object link.
   */
  caseObject?: string | undefined;
  /** Extra predicate ANDed with the binding's own `where` (a stream filter). */
  extraWhere?: FilterExpr | undefined;
  /**
   * Cardinality above which a process map stops being readable. Discovered
   * maps past a few hundred activities are hairballs, not insight.
   */
  activityCardinalityWarnAt?: number;
}

const DEFAULT_ACTIVITY_CARDINALITY_WARN_AT = 200;

/** Profile one bound source. Runs two aggregate queries; transfers no event rows. */
export async function profileBinding(
  client: SqlClient,
  dialect: SqlDialect,
  binding: SourceBinding,
  opts: ProfileOptions = {},
): Promise<BindingProfile> {
  // The FROM clause, which may be several joined tables — the host declares
  // where its data lives, and joining it is then the engine's job.
  const table = fromClause(binding.from, dialect);
  const caseExpr = caseKeyExpr(binding, dialect, opts.caseObject);
  const activity = activityExpr(binding.roles, dialect, binding.from);
  const timestamps = eventTimestamps(binding, dialect);
  const perRow = eventsPerRow(binding.grain);

  const overview = await runOverview(client, dialect, binding, {
    table,
    caseExpr,
    activity,
    timestamps,
    ...(opts.extraWhere !== undefined ? { extraWhere: opts.extraWhere } : {}),
  });

  const distribution =
    caseExpr === undefined
      ? { mean: null, median: null, max: null, singleRowCases: 0 }
      : await runDistribution(client, dialect, binding, {
          table,
          caseExpr,
          ...(opts.extraWhere !== undefined ? { extraWhere: opts.extraWhere } : {}),
        });

  const caseColumn = resolveCaseColumn(binding, opts.caseObject);
  const scale = (n: number | null): number | null => (n === null ? null : n * perRow);

  const profile: BindingProfile = {
    bindingId: binding.id,
    grain: binding.grain,
    table,
    caseObject: opts.caseObject,
    caseColumn,
    rowCount: overview.rowCount,
    eventCount: overview.rowCount * perRow,
    caseCount: overview.caseCount,
    activityCount: overview.activityCount,
    resourceCount: overview.resourceCount,
    rowsPerCase: { mean: distribution.mean, median: distribution.median, max: distribution.max },
    eventsPerCase: {
      mean: scale(distribution.mean),
      median: scale(distribution.median),
      max: scale(distribution.max),
    },
    singleRowCases: distribution.singleRowCases,
    timeRange: overview.timeRange,
    invertedIntervals: overview.invertedIntervals,
    roleCoverage: overview.roleCoverage,
    attributeCount: (binding.attributes as Attribute[]).length,
    findings: [],
  };

  profile.findings = deriveFindings(binding, profile, opts);
  return profile;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

interface OverviewShape {
  table: string;
  caseExpr: string | undefined;
  activity: string | undefined;
  timestamps: { label: string; expr: string }[];
  extraWhere?: FilterExpr;
}

interface OverviewResult {
  rowCount: number;
  caseCount: number;
  activityCount: number | undefined;
  resourceCount: number | undefined;
  timeRange: { from: Date; to: Date } | null;
  invertedIntervals: number | undefined;
  roleCoverage: RoleCoverage[];
}

/**
 * One scan producing every scalar the profile needs.
 *
 * `COUNT(*) FILTER (WHERE ...)` is standard in both Postgres and DuckDB and
 * keeps null accounting in the same pass as the totals, so the numbers are
 * guaranteed to describe one consistent read rather than two.
 */
async function runOverview(
  client: SqlClient,
  dialect: SqlDialect,
  binding: SourceBinding,
  shape: OverviewShape,
): Promise<OverviewResult> {
  const params = new ParamBuilder(dialect);
  const predicate = bindingPredicate(binding, dialect, params, shape.extraWhere);

  const selects: string[] = ['COUNT(*) AS row_count'];
  const nullRoles: { role: string; column: string; alias: string }[] = [];

  if (shape.caseExpr !== undefined) {
    selects.push(`COUNT(DISTINCT ${shape.caseExpr}) AS case_count`);
    selects.push(`COUNT(*) FILTER (WHERE ${shape.caseExpr} IS NULL) AS null_case`);
    nullRoles.push({
      role: 'case',
      column: resolveCaseColumn(binding, undefined) ?? 'case',
      alias: 'null_case',
    });
  } else {
    selects.push('0 AS case_count');
  }

  if (shape.activity !== undefined) {
    selects.push(`COUNT(DISTINCT ${shape.activity}) AS activity_count`);
  }

  const resourceColumn = binding.roles.resource;
  if (resourceColumn !== undefined) {
    const quoted = quoteColumn(resourceColumn, dialect, binding.from);
    selects.push(`COUNT(DISTINCT ${quoted}) AS resource_count`);
    selects.push(`COUNT(*) FILTER (WHERE ${quoted} IS NULL) AS null_resource`);
    nullRoles.push({ role: 'resource', column: resourceColumn, alias: 'null_resource' });
  }

  const first = shape.timestamps[0];
  const last = shape.timestamps[shape.timestamps.length - 1];
  if (first !== undefined && last !== undefined) {
    selects.push(`MIN(${first.expr}) AS min_ts`);
    selects.push(`MAX(${last.expr}) AS max_ts`);
    for (const [i, ts] of shape.timestamps.entries()) {
      const alias = `null_ts_${i}`;
      selects.push(`COUNT(*) FILTER (WHERE ${ts.expr} IS NULL) AS ${alias}`);
      nullRoles.push({ role: ts.label, column: timestampColumnFor(binding, ts.label), alias });
    }
  }

  // An interval whose end precedes its start is always a defect, and it is
  // silently destructive: the event pair sorts backwards and manufactures a
  // transition that never occurred.
  const startTs = shape.timestamps[0];
  const endTs = shape.timestamps[1];
  const isInterval = binding.grain === 'interval' && startTs !== undefined && endTs !== undefined;
  if (isInterval) {
    selects.push(`COUNT(*) FILTER (WHERE ${endTs.expr} < ${startTs.expr}) AS inverted`);
  }

  const text = `SELECT ${selects.join(', ')} FROM ${shape.table}${whereClause(predicate)}`;
  const row = await queryOne(client, text, params.params, binding.id);

  const rowCount = countOf(row['row_count']);
  const minTs = instantMsOf(row['min_ts']);
  const maxTs = instantMsOf(row['max_ts']);

  return {
    rowCount,
    caseCount: countOf(row['case_count']),
    activityCount: shape.activity !== undefined ? countOf(row['activity_count']) : undefined,
    resourceCount: resourceColumn !== undefined ? countOf(row['resource_count']) : undefined,
    timeRange:
      minTs !== null && maxTs !== null ? { from: new Date(minTs), to: new Date(maxTs) } : null,
    invertedIntervals: isInterval ? countOf(row['inverted']) : undefined,
    roleCoverage: nullRoles.map(({ role, column, alias }) => {
      const nullCount = countOf(row[alias]);
      return { role, column, nullCount, nullRatio: rowCount === 0 ? 0 : nullCount / rowCount };
    }),
  };
}

interface DistributionResult {
  mean: number | null;
  median: number | null;
  max: number | null;
  singleRowCases: number;
}

/**
 * Rows-per-case distribution, computed by grouping in the database.
 *
 * Median as well as mean, deliberately: trace lengths are long-tailed, and a
 * handful of pathological cases drag the mean somewhere no real case lives.
 */
async function runDistribution(
  client: SqlClient,
  dialect: SqlDialect,
  binding: SourceBinding,
  shape: { table: string; caseExpr: string; extraWhere?: FilterExpr },
): Promise<DistributionResult> {
  const params = new ParamBuilder(dialect);
  const predicate = andAll([
    bindingPredicate(binding, dialect, params, shape.extraWhere),
    `${shape.caseExpr} IS NOT NULL`,
  ]);

  const inner = `SELECT COUNT(*) AS n FROM ${shape.table}${whereClause(predicate)} GROUP BY ${shape.caseExpr}`;
  const text =
    `SELECT AVG(CAST(n AS DOUBLE PRECISION)) AS mean_rows, ` +
    `${dialect.medianOf('CAST(n AS DOUBLE PRECISION)')} AS median_rows, ` +
    `MAX(n) AS max_rows, ` +
    `COUNT(*) FILTER (WHERE n = 1) AS single_row_cases ` +
    `FROM (${inner}) AS per_case`;

  const row = await queryOne(client, text, params.params, binding.id);
  return {
    mean: numberOrNull(row['mean_rows']),
    median: numberOrNull(row['median_rows']),
    max: numberOrNull(row['max_rows']),
    singleRowCases: countOf(row['single_row_cases']),
  };
}

function bindingPredicate(
  binding: SourceBinding,
  dialect: SqlDialect,
  params: ParamBuilder,
  extraWhere: FilterExpr | undefined,
): string | undefined {
  return andAll([
    binding.where !== undefined ? compileFilter(binding.where, dialect, params, binding.from) : undefined,
    extraWhere !== undefined ? compileFilter(extraWhere, dialect, params, binding.from) : undefined,
  ]);
}

async function queryOne(
  client: SqlClient,
  text: string,
  params: readonly unknown[],
  bindingId: string,
): Promise<Record<string, unknown>> {
  let rows: Record<string, unknown>[];
  try {
    ({ rows } = await client.query(text, params));
  } catch (err) {
    throw new AdapterError(
      `profile query failed for binding ${JSON.stringify(bindingId)}: ${String(err)}`,
      { schemaClass: looksLikeSchemaError(err), binding: bindingId },
    );
  }
  const row = rows[0];
  if (row === undefined) {
    // An aggregate-only SELECT always returns exactly one row; none means the
    // driver contract was broken, not that the table was empty.
    throw new AdapterError(`profile query returned no rows for binding ${JSON.stringify(bindingId)}`, {
      binding: bindingId,
    });
  }
  return row;
}

function resolveCaseColumn(binding: SourceBinding, caseObject: string | undefined): string | undefined {
  if (caseObject !== undefined) return binding.objects.find((o) => o.type === caseObject)?.column;
  if (binding.roles.case !== undefined) return binding.roles.case;
  return binding.objects[0]?.column;
}

function timestampColumnFor(binding: SourceBinding, label: string): string {
  const { roles } = binding;
  if (label === 'start' && roles.start !== undefined) return roles.start.column;
  if (label === 'complete' && roles.end !== undefined) return roles.end.column;
  if (roles.timestamp !== undefined) return roles.timestamp.column;
  return label;
}

// ---------------------------------------------------------------------------
// Findings — the part a human reads
// ---------------------------------------------------------------------------

function deriveFindings(
  binding: SourceBinding,
  p: BindingProfile,
  opts: ProfileOptions,
): ProfileFinding[] {
  const out: ProfileFinding[] = [];
  const cardinalityLimit = opts.activityCardinalityWarnAt ?? DEFAULT_ACTIVITY_CARDINALITY_WARN_AT;

  if (p.rowCount === 0) {
    out.push({
      severity: 'error',
      code: 'NO_ROWS',
      message: 'the binding matched no rows at all',
      remedy: "check the table, the binding's where clause, and any stream filter in force",
    });
    return out; // every other finding would be noise
  }

  if (p.caseColumn === undefined) {
    out.push({
      severity: 'error',
      code: 'NO_CASE_KEY',
      message: 'no case key could be resolved, so these rows cannot be correlated into cases',
      remedy: 'set roles.case, or declare an object link and pivot on its type',
    });
    return out;
  }

  // --- the headline check --------------------------------------------------
  // A mapping that yields one row per case is the classic wrong-case-key
  // signature: the "case" is really the row id, and every trace has length 1.
  if (grainYieldsSteps(binding.grain) && p.caseCount > 0) {
    const singleRatio = p.singleRowCases / p.caseCount;
    if (p.rowCount === p.caseCount) {
      out.push({
        severity: 'error',
        code: 'SINGLE_ROW_CASES',
        message: `every case is represented by exactly one row (${p.caseCount.toLocaleString()} cases from ${p.rowCount.toLocaleString()} rows) — column ${JSON.stringify(p.caseColumn)} identifies rows, not business items`,
        remedy:
          'point the case key at the value that REPEATS across the rows of one business item (a booking or document reference), not at a per-row id',
      });
    } else if (singleRatio > 0.5) {
      out.push({
        severity: 'warning',
        code: 'MOSTLY_SINGLE_ROW_CASES',
        message: `${Math.round(singleRatio * 100)}% of cases have only one row, so most traces have no transitions to discover`,
        remedy:
          'check whether the case key is correct, or whether the time window is cutting cases in half at its edges',
      });
    }
  }

  // --- correlation quality -------------------------------------------------
  const caseCoverage = p.roleCoverage.find((r) => r.role === 'case');
  if (caseCoverage !== undefined && caseCoverage.nullCount > 0) {
    out.push({
      severity: 'warning',
      code: 'NULL_CASE_KEY',
      message: `${caseCoverage.nullCount.toLocaleString()} rows (${pct(caseCoverage.nullRatio)}) have a null case key and are excluded from every trace`,
      remedy: 'filter them out explicitly in the binding, or fix the source so they carry a reference',
    });
  }

  // --- timestamps ----------------------------------------------------------
  for (const cov of p.roleCoverage) {
    if (cov.role === 'case' || cov.role === 'resource') continue;
    if (cov.nullCount === 0) continue;
    out.push({
      severity: cov.nullRatio > 0.05 ? 'warning' : 'info',
      code: 'NULL_TIMESTAMP',
      message: `${cov.nullCount.toLocaleString()} rows (${pct(cov.nullRatio)}) have a null ${cov.role} timestamp in ${JSON.stringify(cov.column)}; those events cannot be placed in the trace`,
      remedy: 'exclude them in the binding so the omission is explicit rather than incidental',
    });
  }

  if (p.invertedIntervals !== undefined && p.invertedIntervals > 0) {
    out.push({
      severity: 'error',
      code: 'INVERTED_INTERVALS',
      message: `${p.invertedIntervals.toLocaleString()} rows end before they start — those pairs sort backwards and manufacture transitions that never occurred`,
      remedy: 'fix the source data or exclude these rows; the engine will not silently reorder them',
    });
  }

  // --- activity ------------------------------------------------------------
  if (p.activityCount !== undefined) {
    if (p.activityCount <= 1) {
      out.push({
        severity: 'warning',
        code: 'SINGLE_ACTIVITY',
        message: `only ${p.activityCount} distinct activity — a discovered map would have nothing to show`,
        remedy: 'compose a finer classifier, e.g. add the transaction-state column alongside the sub-queue',
      });
    } else if (p.activityCount > cardinalityLimit) {
      out.push({
        severity: 'warning',
        code: 'HIGH_ACTIVITY_CARDINALITY',
        message: `${p.activityCount.toLocaleString()} distinct activities — a discovered map at this cardinality is a hairball, not insight`,
        remedy: 'use a coarser classifier (drop a column from roles.activity), or mine a filtered subset',
      });
    }
  }

  // --- perspectives this binding cannot serve ------------------------------
  if (binding.roles.resource === undefined) {
    out.push({
      severity: 'info',
      code: 'NO_RESOURCE_ROLE',
      message: 'no resource role is mapped, so this source cannot serve the organizational perspective',
      remedy: 'map roles.resource to the column naming who performed the work',
    });
  }

  if (!grainYieldsSteps(binding.grain)) {
    out.push({
      severity: 'info',
      code: 'SNAPSHOT_SOURCE',
      message: 'snapshot grain: this source contributes case attributes only, never steps',
    });
  }

  if (
    p.eventsPerCase.median !== null &&
    p.eventsPerCase.median > 0 &&
    !out.some((f) => f.severity === 'error')
  ) {
    out.unshift({
      severity: 'info',
      code: 'PROFILE_OK',
      message: `${p.rowCount.toLocaleString()} rows -> ${p.caseCount.toLocaleString()} cases, median ${p.eventsPerCase.median} events per case, longest ${p.eventsPerCase.max ?? '?'}`,
    });
  }

  return out;
}

function pct(ratio: number): string {
  const p = ratio * 100;
  return p < 0.1 ? '<0.1%' : `${p.toFixed(1)}%`;
}

/** True when nothing blocks using this binding. */
export function profileIsUsable(profile: BindingProfile): boolean {
  return !profile.findings.some((f) => f.severity === 'error');
}
