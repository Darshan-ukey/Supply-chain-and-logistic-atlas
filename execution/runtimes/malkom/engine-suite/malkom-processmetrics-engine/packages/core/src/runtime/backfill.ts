import { resolveDefaults, type EngineDefaultsInput } from '../config/defaults.js';
import type { Assignment, Calendar } from '../config/schemas.js';
import { ConfigInvalidError } from '../domain/errors.js';
import type { Scalar } from '../domain/filter.js';
import type { CompiledRegistry } from '../domain/registry.js';
import type { EngineHooks } from '../ports/hooks.js';
import type { Logger } from '../ports/logger.js';
import type { DefinitionVersionRecord, MetricsStateStore } from '../ports/statestore.js';
import { backtestWindows, calendarFor, type FactsAccess } from './calculate.js';
import type { CompiledCalendar } from './calendar.js';
import { materializeWindow, type MaterializeOutcome } from './materialize.js';

/**
 * Backfill: a backtest that PERSISTS. The same window enumeration as
 * backtestMetric (backtestWindows — periodic grains enumerate consecutive
 * windows, rolling specs step by EngineDefaults.backtestStep days) RESTRICTED
 * to windows that have CLOSED (endIso <= min(range.toIso, nowIso)) — a
 * still-open window would persist a partial point stamped as authoritative;
 * the compute-only backtest keeps the full enumeration. Each closed window
 * flows through the same materializeWindow path as the scheduler, so a
 * backfilled point is indistinguishable from a scheduled one except for its
 * run's trigger: every window upserts its point (revision bumps on
 * recompute), appends a run with trigger 'backfill', and emits
 * metric.computed.
 *
 * metric.breached / metric.recovered are SUPPRESSED by default
 * (EngineDefaults.backfillEmitsBreaches, default false): alert semantics
 * belong to the present — a breach that started and healed months ago must
 * not page anyone while history is being reconstructed. Hosts that want the
 * transitions anyway (e.g. seeding a fresh store and announcing the current
 * breach state) set backfillEmitsBreaches: true.
 *
 * Each window EVALUATES as of its own end (like backtest), so age-style
 * derived fields and trace.evaluatedAt replay historically; the run's
 * startedAtIso/finishedAtIso and the point's computedAtIso carry `nowIso` —
 * the actual execution instant — so retention never age-prunes a fresh
 * backfill's audit and snapshots can tell a complete point from a partial
 * one. Snapshot-anchored definitions refuse persisted history entirely:
 * their closed windows yield no_data points with a snapshotBackfill trace
 * note (see materializeWindow), because as-of-now facts cannot describe a
 * past window.
 */
export interface BackfillInput {
  /** The immutable activation snapshot to backfill — versionNo pins the points. */
  definitionVersion: DefinitionVersionRecord;
  registry: CompiledRegistry;
  calendars?: ReadonlyArray<Calendar | CompiledCalendar>;
  defaults?: EngineDefaultsInput;
  facts: FactsAccess;
  /** Concrete dimension bindings; defaults to the assignment's scope, else {}. */
  scope?: Record<string, Scalar>;
  assignment?: Assignment;
  /** Half-open range [fromIso, toIso) the backfilled windows must cover. */
  range: { fromIso: string; toIso: string };
  /**
   * The caller's clock — the execution instant stamped on runs and points,
   * and the closed-window cutoff: windows ending after it are not persisted.
   */
  nowIso: string;
  store: MetricsStateStore;
  hooks?: EngineHooks;
  logger?: Logger;
}

/** Runs recorded by a backfill always carry this trigger. */
export const BACKFILL_TRIGGER = 'backfill' as const;

export async function backfillMetric(input: BackfillInput): Promise<MaterializeOutcome[]> {
  const defaults = resolveDefaults(input.defaults);
  const nowMs = Date.parse(input.nowIso);
  if (Number.isNaN(nowMs)) {
    throw new ConfigInvalidError(`backfillMetric: nowIso is not a parseable instant: ${JSON.stringify(input.nowIso)}`);
  }
  const def = input.definitionVersion.doc;
  const calendar = calendarFor(def.calendarRef, input.calendars ?? [], defaults);
  // Persist only CLOSED windows: a window whose end lies beyond the range or
  // beyond "now" would store a partial value as if it were final.
  const cutoffMs = Math.min(Date.parse(input.range.toIso), nowMs);
  const windows = backtestWindows(def.window, input.range, calendar, defaults).filter(
    (w) => Date.parse(w.endIso) <= cutoffMs,
  );

  const outcomes: MaterializeOutcome[] = [];
  for (const window of windows) {
    outcomes.push(
      await materializeWindow({
        definitionVersion: input.definitionVersion,
        registry: input.registry,
        calendars: input.calendars ?? [],
        defaults,
        facts: input.facts,
        ...(input.scope !== undefined ? { scope: input.scope } : {}),
        ...(input.assignment !== undefined ? { assignment: input.assignment } : {}),
        resolvedWindow: window,
        nowIso: input.nowIso,
        evaluateAtIso: window.endIso,
        store: input.store,
        ...(input.hooks !== undefined ? { hooks: input.hooks } : {}),
        ...(input.logger !== undefined ? { logger: input.logger } : {}),
        trigger: BACKFILL_TRIGGER,
        emitBreachEvents: defaults.backfillEmitsBreaches,
      }),
    );
  }
  return outcomes;
}
