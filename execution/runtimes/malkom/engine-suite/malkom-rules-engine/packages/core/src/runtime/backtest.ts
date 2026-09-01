import type { CompiledRegistry } from '../domain/registry.js';
import type { EvaluationResult } from '../domain/types.js';
import type { SqlDialect } from '../sql/dialect.js';
import type { ConsistencyFinding } from './analyze.js';

/**
 * Backtesting (§5.3): evaluate a draft against real rows from the host DB —
 * read-only, via the registry's table binding — and show what it would have
 * matched, changed and flagged BEFORE anyone activates it. Evidence, not
 * promises.
 */

export interface BacktestOptions {
  /** Rows to sample (default 100, max 1000). */
  sample?: number;
  /** Evaluation instant; defaults to the engine clock. */
  asOf?: string | Date;
}

export interface BacktestRowOutcome {
  /** 0-based row index within the sample. */
  index: number;
  matched: boolean;
  rulesFired: number;
  violations: string[];
  patch: Array<{ field: string; value: unknown }>;
  effects: number;
}

export interface BacktestReport {
  entity: string;
  asOf: string;
  rowsSampled: number;
  /** Rows the draft's scope + filters matched. */
  matched: number;
  /** Rows where at least one rule fired. */
  rowsWithFiredRules: number;
  violations: number;
  patches: number;
  effects: number;
  /** Static overlap analysis: active groups this draft would collide with. */
  conflictsWithActive: ConsistencyFinding[];
  /** The first rows' outcomes, for eyeballing (capped). */
  sampleOutcomes: BacktestRowOutcome[];
}

export const BACKTEST_SAMPLE_DEFAULT = 100;
export const BACKTEST_SAMPLE_MAX = 1000;
export const BACKTEST_OUTCOMES_CAP = 20;

/**
 * SELECT every registered field of the entity, aliased to its field id, so
 * evaluation sees rows keyed exactly like rule conditions expect. Identifiers
 * are regex-validated at registry time and dialect-quoted here; the limit is
 * a bound parameter.
 */
export function buildSampleSelect(
  entity: string,
  registry: CompiledRegistry,
  dialect: SqlDialect,
  limit: number,
): { text: string; params: unknown[] } {
  const e = registry.entity(entity);
  if (!e?.table) throw new Error(`entity "${entity}" has no table binding`);
  const cols = e.fields
    .map((f) => `${dialect.quoteIdent(f.column ?? f.id)} AS ${dialect.quoteIdent(f.id)}`)
    .join(', ');
  return {
    text: `SELECT ${cols} FROM ${dialect.qualifyTable(e.table)} LIMIT ${dialect.placeholder(1)}`,
    params: [limit],
  };
}

export function summarizeRow(index: number, result: EvaluationResult): BacktestRowOutcome {
  const trace = result.trace[0];
  return {
    index,
    matched: trace !== undefined && trace.skipped === undefined,
    rulesFired: trace?.rules.filter((r) => r.fired).length ?? 0,
    violations: result.assertions.map((a) => a.message ?? `${a.field} assertion failed`),
    patch: result.patch.map((p) => ({ field: p.field, value: p.value })),
    effects: result.effects.length,
  };
}
