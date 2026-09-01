import type { Scalar } from '../domain/filter.js';
import type { MetricStatus } from '../domain/types.js';
import type { RunTrigger, ValidationStatus } from './statestore.js';
import type { Logger } from './logger.js';

/**
 * Host-facing events and hooks (the rules engine's D3 pattern): the engine
 * reports what happened; the host wires approvals, alerting and side effects.
 * Hook exceptions are caught and logged, NEVER fatal — an alerting bug must
 * not fail a committed computation (the alloc-engine rule).
 *
 * Every event carries `occurredAtIso` = the caller's nowIso. There is no
 * wall-clock read on the emit path — time always enters through the Clock
 * port or an explicit instant, so replays and tests are deterministic.
 */

/** Lifecycle events: a definition head changed state. */
export interface DefinitionEventBase {
  metric: string;
  actor: string;
  occurredAtIso: string;
  reason?: string;
}

/** Computation events: a point was (re)materialized. */
export interface MetricEventBase {
  metric: string;
  versionNo: number;
  scope: Record<string, Scalar>;
  scopeHash: string;
  windowKey: string;
  value: number | null;
  status: MetricStatus;
  revision: number;
  runId: string;
  trigger: RunTrigger;
  occurredAtIso: string;
}

export type EngineEvent =
  | ({ type: 'definition.submitted' } & DefinitionEventBase)
  | ({ type: 'definition.activated'; versionNo: number } & DefinitionEventBase)
  | ({ type: 'definition.rejected' } & DefinitionEventBase)
  | ({ type: 'definition.retired'; versionNo: number | null } & DefinitionEventBase)
  /** Every successful materialization emits one (breach events ride on top). */
  | ({ type: 'metric.computed' } & MetricEventBase)
  /**
   * The point ENTERED breach: status is breach and the point's last
   * NON-no_data status (previousStatus here) was not — a no_data gap between
   * two breaches never re-fires the alert.
   */
  | ({ type: 'metric.breached'; previousStatus: MetricStatus | null } & MetricEventBase)
  /**
   * The point's last NON-no_data status was breach; this one is
   * attained/warn — a recovery is announced even across a no_data gap.
   */
  | ({ type: 'metric.recovered'; previousStatus: MetricStatus } & MetricEventBase)
  | {
      type: 'sweep.completed';
      occurredAtIso: string;
      checked: number;
      results: ReadonlyArray<{ metric: string; validationStatus: ValidationStatus }>;
    }
  /** A rollup tick lost the (metric, scopeHash) lease — someone else computes. */
  | {
      type: 'rollup.skipped';
      metric: string;
      versionNo: number;
      scopeHash: string;
      windowKey: string;
      occurredAtIso: string;
    };

export type EngineEventType = EngineEvent['type'];

/** Where an error surfaced, for onError correlation. */
export interface EngineErrorContext {
  op: string;
  metric?: string;
  windowKey?: string;
  runId?: string;
}

export interface EngineHooks {
  /** Exceptions are caught and logged, never fatal. */
  onEvent?(event: EngineEvent): void | Promise<void>;
  onError?(err: unknown, context: EngineErrorContext): void | Promise<void>;
}

/**
 * Deliver one event through the hooks, swallowing hook failures: a throwing
 * onEvent is logged and reported to onError (whose own failure is swallowed
 * too — an error hook failing is not our problem twice).
 */
export async function fireEvent(hooks: EngineHooks | undefined, logger: Logger, event: EngineEvent): Promise<void> {
  if (hooks?.onEvent === undefined) return;
  try {
    await hooks.onEvent(event);
  } catch (err) {
    logger.warn({ type: event.type, err: String(err) }, 'onEvent hook failed');
    await fireError(hooks, logger, err, {
      op: event.type,
      ...('metric' in event ? { metric: event.metric } : {}),
    });
  }
}

/** Report an error through onError; a throwing onError is only logged. */
export async function fireError(
  hooks: EngineHooks | undefined,
  logger: Logger,
  err: unknown,
  context: EngineErrorContext,
): Promise<void> {
  if (hooks?.onError === undefined) return;
  try {
    await hooks.onError(err, context);
  } catch (hookErr) {
    logger.warn({ op: context.op, err: String(hookErr) }, 'onError hook failed');
  }
}
