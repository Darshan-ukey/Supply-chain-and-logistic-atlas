import {
  DST_AMBIGUITY_DEFAULT,
  resolveDefaults,
  type DstAmbiguity,
  type EngineDefaults,
  type EngineDefaultsInput,
} from '../config/defaults.js';
import type { Assignment, Calendar, MetricDefinition, MetricWindow } from '../config/schemas.js';
import { referencedFieldsBySource } from '../config/validate.js';
import { ConfigInvalidError, UnsupportedError } from '../domain/errors.js';
import type { Scalar } from '../domain/filter.js';
import type { CompiledRegistry } from '../domain/registry.js';
import type { FetchTrace, MetricResult, ResolvedWindow } from '../domain/types.js';
import type { FactQuery, FactSourcePort } from '../ports/factsource.js';
import type { Logger } from '../ports/logger.js';
import type { ConnectionRegistry } from '../sql/connections.js';
import { SqlFactSource } from '../sql/factfetch.js';
import { compileCalendar, CompiledCalendar, wallClockAt, wallTimeToInstant } from './calendar.js';
import { compileMetric, effectiveTarget, type CompiledMetric } from './compile.js';
import { evaluateMetric, type MetricFacts } from './evaluate.js';
import { resolveWindow } from './window.js';

/**
 * On-demand calculation — the orchestration over the pure core:
 *
 *   compile (tier-1 gate) → resolve window → fetch per formula source
 *   (FactSourcePort or the SQL path; event anchors push the window range
 *   down, snapshot anchors fetch as-of-now) → evaluateMetric against the
 *   assignment-merged target → MetricResult.
 *
 * No persistence, no ambient clock (`at` is the caller's), no hidden
 * defaults — every knob comes from author data, definition options, or the
 * EngineDefaults the caller passes.
 */

/**
 * Where facts come from: a host port, or the M0 SQL substrate. The SQL form
 * takes an optional logger — driver failures log their FULL detail there
 * (the AdapterError the HTTP boundary serializes is generic).
 */
export type FactsAccess =
  | { source: FactSourcePort }
  | { connections: ConnectionRegistry; logger?: Logger };

export interface CalculateInput {
  /** A parsed definition (compiled here, tier-1 gated) or a precompiled metric. */
  definition: MetricDefinition | CompiledMetric;
  registry: CompiledRegistry;
  /** The known calendars; the definition's calendarRef resolves against these. */
  calendars?: ReadonlyArray<Calendar | CompiledCalendar>;
  /** Partial engine-defaults override, deep-merged over the documented defaults. */
  defaults?: EngineDefaultsInput;
  facts: FactsAccess;
  /** Concrete dimension bindings; defaults to the assignment's scope. */
  scope?: Record<string, Scalar>;
  /** The evaluation instant — the caller's clock, never the engine's. */
  at: string;
  /** Override the resolved window (replays, backtests); default: the definition's spec at `at`. */
  window?: ResolvedWindow;
  /** Merges its targetOverride into the judged target (effectiveTarget). */
  assignment?: Assignment;
}

function isCompiledMetric(d: MetricDefinition | CompiledMetric): d is CompiledMetric {
  return 'definition' in d;
}

/**
 * Resolve a definition's calendarRef from a caller-provided list, compiling
 * plain docs on demand. Shared by calculation, materialization and the
 * rollup scheduler (which needs the calendar's timezone for its crons).
 */
export function calendarFor(
  ref: string | undefined,
  calendars: ReadonlyArray<Calendar | CompiledCalendar>,
  defaults: EngineDefaults,
): CompiledCalendar | undefined {
  if (ref === undefined) return undefined;
  for (const cal of calendars) {
    if (cal instanceof CompiledCalendar) {
      if (cal.name === ref) return cal;
    } else if (cal.name === ref) {
      return compileCalendar(cal, undefined, { maxBusinessSpanDays: defaults.maxBusinessSpanDays });
    }
  }
  return undefined;
}

interface Prepared {
  compiled: CompiledMetric;
  defaults: EngineDefaults;
  fetcher: FactSourcePort;
  mode: FetchTrace['mode'];
  scope: Record<string, Scalar> | undefined;
}

function prepare(input: CalculateInput | BacktestInput): Prepared {
  const defaults = resolveDefaults(input.defaults);
  let compiled: CompiledMetric;
  if (isCompiledMetric(input.definition)) {
    compiled = input.definition;
  } else {
    const calendar = calendarFor(input.definition.calendarRef, input.calendars ?? [], defaults);
    compiled = compileMetric(input.definition, input.registry, calendar);
  }
  const fetcher =
    'source' in input.facts
      ? input.facts.source
      : new SqlFactSource(input.facts.connections, input.registry, input.facts.logger);
  const mode: FetchTrace['mode'] = 'source' in input.facts ? 'port' : 'sql';
  const scope = input.scope ?? input.assignment?.scope;
  return { compiled, defaults, fetcher, mode, scope };
}

/** Fetch every formula source's facts for one window; throws on overflow. */
async function fetchForWindow(
  prep: Prepared,
  window: ResolvedWindow,
): Promise<{ facts: MetricFacts; fetch: FetchTrace }> {
  const { compiled, defaults, fetcher } = prep;
  const def = compiled.definition;
  const fieldsBySource = referencedFieldsBySource(def);

  const sources =
    def.formula.kind === 'aggregate'
      ? [def.formula.over.source]
      : [def.formula.numerator.source, def.formula.denominator.source];
  const unique = [...new Set(sources)];

  const rowsByEntity = new Map<string, ReadonlyArray<Record<string, unknown>>>();
  const perSource: Array<{ entity: string; rows: number; limited: boolean }> = [];
  for (const entity of unique) {
    const q: FactQuery = {
      entity,
      fields: fieldsBySource.get(entity) ?? [],
      limit: defaults.maxFactRows + 1, // one sentinel row proves overflow
    };
    if (prep.scope !== undefined && Object.keys(prep.scope).length > 0) q.scope = prep.scope;
    if (def.anchor.kind === 'event') {
      q.anchor = { field: def.anchor.field, startIso: window.startIso, endIso: window.endIso };
    }
    const rows = await fetcher.fetchFacts(q);
    if (rows.length > defaults.maxFactRows) {
      throw new UnsupportedError(
        `fact fetch for entity "${entity}" exceeded maxFactRows (${defaults.maxFactRows}) — ` +
          `narrow the scope or window, or raise EngineDefaults.maxFactRows; silent truncation is forbidden`,
      );
    }
    rowsByEntity.set(entity, rows);
    perSource.push({ entity, rows: rows.length, limited: false });
  }

  // Ratios over two DIFFERENT sources evaluate per role; everything else
  // shares the single fetched set.
  const facts: MetricFacts =
    def.formula.kind === 'ratio' && sources[0] !== sources[1]
      ? { numerator: rowsByEntity.get(sources[0]!)!, denominator: rowsByEntity.get(sources[1]!)! }
      : rowsByEntity.get(sources[0]!)!;
  return { facts, fetch: { mode: prep.mode, perSource } };
}

async function calculateAt(
  prep: Prepared,
  window: ResolvedWindow,
  nowIso: string,
  assignment: Assignment | undefined,
): Promise<MetricResult> {
  const { compiled, defaults } = prep;
  const { facts, fetch } = await fetchForWindow(prep, window);
  const result = evaluateMetric(compiled, facts, {
    window,
    ...(prep.scope !== undefined ? { scope: prep.scope } : {}),
    nowIso,
    target: effectiveTarget(compiled.definition, assignment),
    defaults,
  });
  result.trace.fetch = fetch;
  return result;
}

/**
 * Calculate one metric point on demand. The window defaults to the
 * definition's spec resolved at `at`; pass `window` to replay a specific
 * period. Facts are fetched per formula source (a ratio's numerator and
 * denominator may read different entities) and never truncated silently —
 * a fetch beyond EngineDefaults.maxFactRows throws.
 */
export async function calculateMetric(input: CalculateInput): Promise<MetricResult> {
  const prep = prepare(input);
  const window =
    input.window ?? resolveWindow(prep.compiled.definition.window, input.at, prep.compiled.calendar, prep.defaults);
  return calculateAt(prep, window, input.at, input.assignment);
}

export interface BacktestInput extends Omit<CalculateInput, 'at' | 'window'> {
  /** Half-open range [fromIso, toIso) the backtest windows must cover. */
  range: { fromIso: string; toIso: string };
}

/** The same wall time `days` days later in `tz` (rolling-backtest stepping). */
function stepWallDays(t: number, days: number, tz: string, ambiguity: DstAmbiguity): number {
  const w = wallClockAt(tz, t);
  const millisecond = t - Math.floor(t / 1000) * 1000;
  return wallTimeToInstant(tz, { ...w, day: w.day + days, millisecond }, ambiguity);
}

/**
 * The windows a backtest (or backfill) of `spec` over [fromIso, toIso) must
 * cover, in order:
 *
 *  - PERIODIC specs enumerate the consecutive windows of their grain covering
 *    the range: the window containing `fromIso` through the last window
 *    starting before `toIso`.
 *  - ROLLING specs have no natural period, so the window END steps from
 *    `fromIso` in `defaults.backtestStep`-day increments (wall-clock days in
 *    the resolving timezone; default 1 = daily) while it stays before `toIso`.
 *
 * Shared by backtestMetric (compute-only) and backfillMetric (persisting) so
 * the two can never enumerate different histories for the same range.
 */
export function backtestWindows(
  spec: MetricWindow,
  range: { fromIso: string; toIso: string },
  calendar: CompiledCalendar | undefined,
  defaults: EngineDefaults,
): ResolvedWindow[] {
  const fromMs = Date.parse(range.fromIso);
  const toMs = Date.parse(range.toIso);
  if (Number.isNaN(fromMs) || Number.isNaN(toMs)) {
    throw new ConfigInvalidError(`backtest range is not a pair of parseable instants: ${JSON.stringify(range)}`);
  }
  if (fromMs >= toMs) {
    throw new ConfigInvalidError('backtest range.fromIso must be before range.toIso (half-open [from, to))');
  }

  const windows: ResolvedWindow[] = [];
  if (spec.kind === 'periodic') {
    let window = resolveWindow(spec, range.fromIso, calendar, defaults);
    while (Date.parse(window.startIso) < toMs) {
      windows.push(window);
      // The instant at a window's END belongs to the NEXT window (half-open).
      window = resolveWindow(spec, window.endIso, calendar, defaults);
    }
    return windows;
  }

  const tz = calendar?.timezone ?? defaults.defaultTimezone;
  const ambiguity: DstAmbiguity = calendar?.dstAmbiguity ?? DST_AMBIGUITY_DEFAULT;
  for (let endMs = fromMs; endMs < toMs; endMs = stepWallDays(endMs, defaults.backtestStep, tz, ambiguity)) {
    windows.push(resolveWindow(spec, new Date(endMs).toISOString(), calendar, defaults));
  }
  return windows;
}

/**
 * Recompute a metric's history over [fromIso, toIso) — a MetricResult per
 * window (see backtestWindows for the enumeration), NO persistence. Empty
 * windows yield `no_data` results, never gaps.
 *
 * Each point evaluates AS OF its window end (nowIso = window.endIso), so
 * age-style derived fields replay historically. Snapshot-anchored metrics
 * still fetch facts as-of-now — a snapshot cannot time-travel; the window
 * merely labels the point.
 */
export async function backtestMetric(input: BacktestInput): Promise<MetricResult[]> {
  const prep = prepare(input);
  const windows = backtestWindows(prep.compiled.definition.window, input.range, prep.compiled.calendar, prep.defaults);
  const results: MetricResult[] = [];
  for (const window of windows) {
    results.push(await calculateAt(prep, window, window.endIso, input.assignment));
  }
  return results;
}
