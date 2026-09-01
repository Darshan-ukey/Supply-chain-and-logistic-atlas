import { resolveDefaults, type EngineDefaultsInput } from '../config/defaults.js';
import type { Assignment, Calendar } from '../config/schemas.js';
import { ConfigInvalidError, ConflictError } from '../domain/errors.js';
import type { Scalar } from '../domain/filter.js';
import { uuidv7 } from '../domain/ids.js';
import { contentHash, type CompiledRegistry } from '../domain/registry.js';
import type { MetricResult, MetricStatus, MetricTrace, ResolvedWindow } from '../domain/types.js';
import { fireError, fireEvent, type EngineHooks, type MetricEventBase } from '../ports/hooks.js';
import { jsonConsoleLogger, type Logger } from '../ports/logger.js';
import type {
  DefinitionVersionRecord,
  MetricPointRecord,
  MetricPointUpsert,
  MetricRunRecord,
  MetricsStateStore,
  RunTrigger,
} from '../ports/statestore.js';
import { calculateMetric, calendarFor, type FactsAccess } from './calculate.js';
import type { CompiledCalendar } from './calendar.js';
import { compileMetric, effectiveTarget, type CompiledMetric } from './compile.js';
import { resolveWindow } from './window.js';

/**
 * Materialization: one calculated window, PERSISTED — the write path the
 * rollup scheduler, backfills and manual recomputes all share, so a point
 * means exactly one thing no matter what produced it.
 *
 *   compile (from the IMMUTABLE version doc) → calculate (the M3 path,
 *   reused verbatim) → persistMaterialization (point + run in ONE store
 *   transaction; revision bumps on recompute) → events.
 *
 * Failure discipline: a fetch/evaluation error records a run with status
 * 'error' and writes NO point (yesterday's good value is never overwritten
 * by today's failure), reports through onError, then rethrows — the caller
 * decides whether that is fatal. A PERSISTENCE failure appends a best-effort
 * 'error' run (its own failure is only logged) and rethrows likewise. Hook
 * errors are caught and logged, never fatal (the alloc-engine rule).
 *
 * No wall-clock reads: `nowIso` is the caller's clock — the EXECUTION
 * instant. It stamps computedAtIso, the run instants and every event's
 * occurredAtIso; the evaluation instant (age-style derived fields,
 * trace.evaluatedAt) defaults to it but backfills pin it to the window end
 * via `evaluateAtIso`, so replays stay deterministic while the audit trail
 * records when the work actually ran.
 */

export interface MaterializeInput {
  /** The immutable activation snapshot to compute — versionNo pins the point. */
  definitionVersion: DefinitionVersionRecord;
  /** The registry to evaluate against (pass the pinned version for exact replays). */
  registry: CompiledRegistry;
  /** The known calendars; the definition's calendarRef resolves against these. */
  calendars?: ReadonlyArray<Calendar | CompiledCalendar>;
  /** Partial engine-defaults override, deep-merged over the documented defaults. */
  defaults?: EngineDefaultsInput;
  facts: FactsAccess;
  /** Concrete dimension bindings; defaults to the assignment's scope, else {}. */
  scope?: Record<string, Scalar>;
  /** Merges its targetOverride into the judged target (effectiveTarget). */
  assignment?: Assignment;
  /** Resolve the definition's window spec at this instant… */
  windowAt?: string;
  /** …or materialize exactly this window. Exactly one of the two is required. */
  resolvedWindow?: ResolvedWindow;
  /**
   * The caller's clock — the EXECUTION instant: computedAtIso, the run's
   * startedAtIso/finishedAtIso and every event's occurredAtIso.
   */
  nowIso: string;
  /**
   * The EVALUATION instant (age-style derived fields, trace.evaluatedAt).
   * Defaults to nowIso; backfills pass the window end so historical replays
   * stay deterministic.
   */
  evaluateAtIso?: string;
  store: MetricsStateStore;
  hooks?: EngineHooks;
  logger?: Logger;
  trigger: RunTrigger;
  /**
   * Emit metric.breached / metric.recovered on status transitions. Default
   * true; backfillMetric passes EngineDefaults.backfillEmitsBreaches so
   * historical windows do not page anyone (alert semantics belong to the
   * present). metric.computed is always emitted.
   */
  emitBreachEvents?: boolean;
  /**
   * Re-checked immediately BEFORE the point+run write (write fencing): when
   * it resolves false the write is aborted — no point, no run, no events —
   * and WriteAbortedError is thrown. The rollup scheduler verifies (and
   * renews) its lease here so a lease lost mid-materialization can never
   * double-write.
   */
  verifyWrite?: () => Promise<boolean>;
}

export interface MaterializeOutcome {
  result: MetricResult;
  point: MetricPointRecord;
  /** Status of the point this one replaced; null on first computation. */
  previousStatus: MetricStatus | null;
  run: MetricRunRecord;
}

/**
 * Thrown when `verifyWrite` refused the persistence: the computation
 * happened but NOTHING was stored or announced. The scheduler maps this to
 * a lost-lease 'skipped' run.
 */
export class WriteAbortedError extends ConflictError {}

/** Statuses a breached point may "recover" to (no_data is not a recovery). */
const RECOVERED_STATUSES: ReadonlySet<MetricStatus> = new Set(['attained', 'warn']);

/** The trace note stamped when snapshot-anchored backfill refuses a window. */
const SNAPSHOT_BACKFILL_NOTE = 'window predates fetch instant';

/**
 * The no_data result a persisted backfill records for a snapshot-anchored
 * window that closed before the fetch instant: as-of-now facts cannot
 * describe a past window (rows created after it would enter with age 0),
 * so refusing to fabricate history is the only honest point.
 */
function snapshotBackfillRefusal(
  compiled: CompiledMetric,
  window: ResolvedWindow,
  evaluateAtIso: string,
  assignment: Assignment | undefined,
): MetricResult {
  const def = compiled.definition;
  const excluded: Record<string, number> = {};
  for (const exclusion of compiled.exclusions) excluded[exclusion.id] = 0;
  const trace: MetricTrace = {
    factsIn: 0,
    scopeFiltered: 0,
    excluded,
    anchor: def.anchor,
    derivedFields: compiled.derived.map((d) => d.name),
    aggregates: compiled.aggregates.map((a) => ({ role: a.role, agg: a.agg, field: a.field, rowsIn: 0, values: 0 })),
    skippedValues: 0,
    snapshotBackfill: SNAPSHOT_BACKFILL_NOTE,
    evaluatedAt: evaluateAtIso,
  };
  if (compiled.calendar !== undefined) {
    trace.calendar =
      compiled.calendar.version !== undefined
        ? { name: compiled.calendar.name, version: compiled.calendar.version }
        : { name: compiled.calendar.name };
  }
  const result: MetricResult = {
    metric: def.name,
    kind: def.kind,
    metricType: def.metricType,
    unit: def.unit,
    value: null,
    status: 'no_data',
    window,
    trace,
  };
  if (def.formula.kind === 'ratio') {
    result.numerator = null;
    result.denominator = null;
  }
  result.target = effectiveTarget(def, assignment);
  return result;
}

export async function materializeWindow(input: MaterializeInput): Promise<MaterializeOutcome> {
  const defaults = resolveDefaults(input.defaults);
  const logger = input.logger ?? jsonConsoleLogger;
  const version = input.definitionVersion;
  const def = version.doc;

  const nowMs = Date.parse(input.nowIso);
  if (Number.isNaN(nowMs)) {
    throw new ConfigInvalidError(`materializeWindow: nowIso is not a parseable instant: ${JSON.stringify(input.nowIso)}`);
  }
  const evaluateAtIso = input.evaluateAtIso ?? input.nowIso;

  // Compile from the immutable version doc (tier-1 gate against the given
  // registry) and pin the window.
  const calendar = calendarFor(def.calendarRef, input.calendars ?? [], defaults);
  const compiled = compileMetric(def, input.registry, calendar);
  let window: ResolvedWindow;
  if (input.resolvedWindow !== undefined) {
    window = input.resolvedWindow;
  } else if (input.windowAt !== undefined) {
    window = resolveWindow(def.window, input.windowAt, compiled.calendar, defaults);
  } else {
    throw new ConfigInvalidError('materializeWindow: pass windowAt or resolvedWindow — there is no implicit window');
  }

  const scope = input.scope ?? input.assignment?.scope ?? {};
  const scopeHash = contentHash(scope);
  const runId = uuidv7(nowMs);

  let result: MetricResult;
  // Snapshot-anchored history cannot be reconstructed: a persisted backfill
  // of a window that closed before the fetch instant records an explicit
  // no_data refusal instead of fabricating an as-of-now value into the past.
  const refusesSnapshotHistory =
    input.trigger === 'backfill' && def.anchor.kind === 'snapshot' && Date.parse(window.endIso) < nowMs;
  if (refusesSnapshotHistory) {
    result = snapshotBackfillRefusal(compiled, window, evaluateAtIso, input.assignment);
  } else {
    try {
      result = await calculateMetric({
        definition: compiled,
        registry: input.registry,
        defaults,
        facts: input.facts,
        scope,
        at: evaluateAtIso,
        window,
        ...(input.assignment !== undefined ? { assignment: input.assignment } : {}),
      });
    } catch (err) {
      // Audit the failure, write no point, report, and stay loud.
      const run: MetricRunRecord = {
        id: runId,
        metric: def.name,
        versionNo: version.versionNo,
        trigger: input.trigger,
        windowKey: window.key,
        scopeHash,
        status: 'error',
        startedAtIso: input.nowIso,
        finishedAtIso: input.nowIso,
        error: err instanceof Error ? err.message : String(err),
        trace: null,
      };
      await input.store.appendRun(run);
      await fireError(input.hooks, logger, err, {
        op: 'materialize',
        metric: def.name,
        windowKey: window.key,
        runId,
      });
      throw err;
    }
  }

  const upsert: MetricPointUpsert = {
    metric: def.name,
    versionNo: version.versionNo,
    scopeHash,
    scope,
    windowKey: window.key,
    windowStartIso: window.startIso,
    windowEndIso: window.endIso,
    grain: window.grain,
    value: result.value,
    numerator: result.numerator ?? null,
    denominator: result.denominator ?? null,
    targetValue: result.target?.value ?? null,
    status: result.status,
    computedAtIso: input.nowIso,
    runId,
  };
  const run: MetricRunRecord = {
    id: runId,
    metric: def.name,
    versionNo: version.versionNo,
    trigger: input.trigger,
    windowKey: window.key,
    scopeHash,
    status: 'ok',
    startedAtIso: input.nowIso,
    finishedAtIso: input.nowIso,
    error: null,
    trace: result.trace,
  };

  // Write fencing: the caller's last word before anything is persisted.
  if (input.verifyWrite !== undefined && !(await input.verifyWrite())) {
    throw new WriteAbortedError(
      `materializeWindow: write verification refused persisting "${def.name}" ${window.key} — nothing was stored`,
    );
  }

  let point: MetricPointRecord;
  let previousStatus: MetricStatus | null;
  let previousAlertStatus: MetricStatus | null;
  try {
    ({ point, previousStatus, previousAlertStatus } = await input.store.persistMaterialization(upsert, run));
  } catch (err) {
    // The point+run write failed atomically (nothing stored). Best-effort
    // audit of the failure; its own failure is only logged.
    const errorRun: MetricRunRecord = {
      ...run,
      status: 'error',
      error: err instanceof Error ? err.message : String(err),
      trace: null,
    };
    try {
      await input.store.appendRun(errorRun);
    } catch (auditErr) {
      logger.error(
        { metric: def.name, windowKey: window.key, runId, err: String(auditErr) },
        'materialization persistence failed AND the error run could not be audited',
      );
    }
    await fireError(input.hooks, logger, err, {
      op: 'materialize',
      metric: def.name,
      windowKey: window.key,
      runId,
    });
    throw err;
  }

  const base: MetricEventBase = {
    metric: def.name,
    versionNo: version.versionNo,
    scope,
    scopeHash,
    windowKey: window.key,
    value: result.value,
    status: result.status,
    revision: point.revision,
    runId,
    trigger: input.trigger,
    occurredAtIso: input.nowIso,
  };
  await fireEvent(input.hooks, logger, { type: 'metric.computed', ...base });
  if (input.emitBreachEvents ?? true) {
    // Transitions are judged against the last NON-no_data status: a no_data
    // gap must neither re-fire a standing breach nor swallow a recovery.
    if (result.status === 'breach' && previousAlertStatus !== 'breach') {
      await fireEvent(input.hooks, logger, { type: 'metric.breached', previousStatus: previousAlertStatus, ...base });
    } else if (previousAlertStatus === 'breach' && RECOVERED_STATUSES.has(result.status)) {
      await fireEvent(input.hooks, logger, { type: 'metric.recovered', previousStatus: previousAlertStatus, ...base });
    }
  }

  return { result, point, previousStatus, run };
}
