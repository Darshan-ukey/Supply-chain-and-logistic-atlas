import { Cron } from 'croner';
import { resolveDefaults, type EngineDefaults, type EngineDefaultsInput } from '../config/defaults.js';
import type { Assignment, Calendar, MetricWindow, Weekday } from '../config/schemas.js';
import { NotFoundError } from '../domain/errors.js';
import type { Scalar } from '../domain/filter.js';
import { uuidv7 } from '../domain/ids.js';
import { contentHash, type CompiledRegistry } from '../domain/registry.js';
import type { ResolvedWindow } from '../domain/types.js';
import { systemClock, type Clock } from '../ports/clock.js';
import { fireEvent, type EngineHooks } from '../ports/hooks.js';
import { jsonConsoleLogger, type Logger } from '../ports/logger.js';
import type {
  AssignmentRecord,
  DefinitionVersionRecord,
  MetricsStateStore,
  MetricRunRecord,
  RunStatus,
} from '../ports/statestore.js';
import { calendarFor, type FactsAccess } from './calculate.js';
import type { CompiledCalendar } from './calendar.js';
import { materializeWindow, WriteAbortedError } from './materialize.js';
import { labeledPeriodStartMs, resolveWindow, WEEKDAY_INDEX } from './window.js';

/**
 * The rollup scheduler: one croner job per (active definition version ×
 * enumerated scope), materializing each JUST-CLOSED window shortly after it
 * closes. Croner gives per-job IANA timezones with correct DST handling and
 * in-process overlap protection — zero dependencies; cross-instance overlap
 * is the kv lease's job (the alloc-engine discipline).
 *
 * What gets scheduled:
 *  - PERIODIC definitions only. Rolling windows have no closing edge — every
 *    instant ends one — so they are on-demand + backfill only, never cron'd.
 *  - Scope enumeration comes from ACTIVE assignments. A definition whose
 *    scope.dimensions is [] measures the whole entity, so it materializes
 *    the empty scope even with no assignment; a DIMENSIONED definition
 *    without active assignments materializes nothing — the engine never
 *    invents scope values (it cannot know which slices matter).
 *  - The cron expression per grain comes from EngineDefaults.rollupCrons;
 *    the cron's timezone is the definition's calendar timezone, else
 *    EngineDefaults.defaultTimezone — "shortly after close" in the
 *    definition's own midnight, not the host's. The WEEK cron's day-of-week
 *    field is derived from the calendar's weekStart (rollupCrons.week keeps
 *    only the time of day), so a Tuesday-start week is materialized on
 *    Tuesday, not the following Monday.
 *
 * Every tick resolves the PREVIOUS window (see previousWindow) at the tick
 * instant from the injected Clock, takes the per-(metric, scopeHash) lease,
 * and materializes through the same path as backfills and manual computes —
 * with the lease RE-VERIFIED (and renewed) immediately before the write, so
 * a lease lost mid-materialization aborts as 'skipped' instead of
 * double-writing. A tick that never got the lease records a 'skipped' run
 * and emits rollup.skipped. Timers are unref()ed so an embedded engine never
 * pins the host process; stop() cancels every job and DRAINS in-flight ticks
 * before resolving; refresh() re-reads active versions and assignments (the
 * M5 facade calls it on lifecycle changes) — refresh/stop are serialized on
 * a promise-chain mutex so concurrent calls can never orphan a live Cron.
 */

type PeriodicWindow = Extract<MetricWindow, { kind: 'periodic' }>;

/**
 * The window a tick firing just after a period boundary must materialize:
 * the one that closes AT that boundary. The boundary is the start of the
 * period LABELED by the tick's wall date (labeledPeriodStartMs) — for an
 * ordinary tick that equals the containing window's start, and the instant
 * one millisecond before it (windows are half-open, so any instant below a
 * boundary is in the closing window; 1ms is exact at ISO-instant resolution)
 * resolves to the just-closed window. Anchoring on the labeled boundary
 * rather than the containing window's own start keeps a tick that fires
 * inside a DST-repeated hour (dstAmbiguity 'later': the new period's
 * midnight resolves to its SECOND occurrence, still ahead of the tick)
 * pointed at the window closing at that boundary — stepping back from the
 * containing window instead would skip it forever. No fixed offsets —
 * DST-shortened days and calendar week starts stay correct.
 */
export function previousWindow(
  spec: PeriodicWindow,
  atIso: string,
  calendar: CompiledCalendar | undefined,
  defaults: EngineDefaults,
): ResolvedWindow {
  const boundaryMs = labeledPeriodStartMs(spec, atIso, calendar, defaults);
  const justBefore = new Date(boundaryMs - 1).toISOString();
  return resolveWindow(spec, justBefore, calendar, defaults);
}

/**
 * The week-grain cron with its day-of-week field rebound to a calendar's
 * weekStart: rollupCrons.week contributes the time of day (and any seconds
 * field), the calendar says WHICH day closes a week. Croner uses the
 * getUTCDay() convention (sun = 0), the same table window resolution uses.
 */
export function weekCronFor(weekCron: string, weekStart: Weekday): string {
  const fields = weekCron.trim().split(/\s+/);
  fields[fields.length - 1] = String(WEEKDAY_INDEX[weekStart]);
  return fields.join(' ');
}

/** KV key of one rollup's cross-instance lease. */
export function rollupLeaseKey(metric: string, scopeHash: string): string {
  return `lease:rollup:${metric}:${scopeHash}`;
}

/** The lease value stored in the kv — the fencing token only ever grows. */
interface LeaseState {
  holder: string;
  token: number;
  expiresAtMs: number;
}

/** One scheduled rollup, as introspectable surface. */
export interface RollupJob {
  metric: string;
  versionNo: number;
  scopeHash: string;
  scope: Record<string, Scalar>;
  grain: PeriodicWindow['grain'];
  /** The cron expression handed to croner (EngineDefaults.rollupCrons[grain]; week DOW per calendar). */
  cron: string;
  /** The IANA timezone the cron fires in. */
  timezone: string;
}

interface JobEntry {
  job: RollupJob;
  version: DefinitionVersionRecord;
  assignment: Assignment | undefined;
  cron: Cron | null;
}

export interface RollupSchedulerOptions {
  store: MetricsStateStore;
  registry: CompiledRegistry;
  /** The known calendars; definitions' calendarRefs resolve against these. */
  calendars?: ReadonlyArray<Calendar | CompiledCalendar>;
  defaults?: EngineDefaultsInput;
  facts: FactsAccess;
  hooks?: EngineHooks;
  clock?: Clock;
  logger?: Logger;
  /** Lease holder identity — distinct per process. Default: a fresh uuidv7. */
  instanceId?: string;
}

function jobKey(metric: string, scopeHash: string): string {
  return `${metric} ${scopeHash}`;
}

/** AssignmentRecord → the Assignment shape the calculation core consumes. */
function toAssignment(record: AssignmentRecord): Assignment {
  return {
    metric: record.metric,
    scope: record.scope,
    active: record.active,
    ...(record.targetOverride !== null ? { targetOverride: record.targetOverride } : {}),
  };
}

export class RollupScheduler {
  private readonly store: MetricsStateStore;
  private readonly registry: CompiledRegistry;
  private readonly calendars: ReadonlyArray<Calendar | CompiledCalendar>;
  private readonly defaults: EngineDefaults;
  private readonly facts: FactsAccess;
  private readonly hooks: EngineHooks | undefined;
  private readonly clock: Clock;
  private readonly logger: Logger;
  private readonly instanceId: string;

  private readonly entries = new Map<string, JobEntry>();
  /** In-flight ticks — stop() drains these before the caller may proceed. */
  private readonly inFlight = new Set<Promise<unknown>>();
  /** Promise-chain mutex serializing refresh()/stop() (never rejects). */
  private rebuildChain: Promise<void> = Promise.resolve();
  private started = false;

  constructor(options: RollupSchedulerOptions) {
    this.store = options.store;
    this.registry = options.registry;
    this.calendars = options.calendars ?? [];
    this.defaults = resolveDefaults(options.defaults);
    this.facts = options.facts;
    this.hooks = options.hooks;
    this.clock = options.clock ?? systemClock;
    this.logger = options.logger ?? jsonConsoleLogger;
    this.instanceId = options.instanceId ?? uuidv7();
  }

  /** Build the job set from the store and start the cron timers. */
  async start(): Promise<void> {
    this.started = true;
    await this.refresh();
  }

  /**
   * Serialize an operation on the rebuild mutex: refresh/stop run strictly
   * one after another, so two interleaved rebuilds can never each construct
   * a Cron for the same job and orphan one of them.
   */
  private serialized<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.rebuildChain.then(fn);
    this.rebuildChain = run.then(
      () => undefined,
      () => undefined, // the chain must survive a failed operation
    );
    return run;
  }

  /**
   * Cancel every cron timer and WAIT for in-flight ticks to finish — after
   * stop() resolves, no tick will touch the store again (the engine closes
   * it right after). The job set is rebuilt on the next start().
   */
  async stop(): Promise<void> {
    this.started = false;
    await this.serialized(async () => {
      for (const entry of this.entries.values()) {
        entry.cron?.stop();
        entry.cron = null;
      }
      this.entries.clear();
      await Promise.allSettled([...this.inFlight]);
    });
  }

  /**
   * Re-read active definition versions and assignments and rebuild the job
   * set (replacing all cron timers). The facade calls this on every
   * lifecycle or assignment change; ticks always use the versions captured
   * by the latest refresh. Serialized: concurrent refreshes run one after
   * another instead of interleaving their stop/build phases.
   */
  refresh(): Promise<void> {
    return this.serialized(() => this.rebuild());
  }

  private async rebuild(): Promise<void> {
    for (const entry of this.entries.values()) entry.cron?.stop();
    this.entries.clear();
    if (!this.started) return;

    for (const head of await this.store.listDefinitions()) {
      if (head.activeVersion === null) continue; // never activated, or retired
      const version = await this.store.getActiveVersion(head.name);
      if (version === null) continue;
      const def = version.doc;
      if (def.window.kind !== 'periodic') continue; // rolling: on-demand + backfill only
      const spec = def.window;

      const calendar = calendarFor(def.calendarRef, this.calendars, this.defaults);
      const timezone = calendar?.timezone ?? this.defaults.defaultTimezone;
      // Week windows close on the calendar's weekStart — the cron's DOW must
      // follow it or the point lands up to six days late.
      const cronExpr =
        spec.grain === 'week'
          ? weekCronFor(this.defaults.rollupCrons.week, calendar?.weekStart ?? this.defaults.weekStart)
          : this.defaults.rollupCrons[spec.grain];

      // Enumerate scopes: active assignments, or the empty scope for
      // dimensionless definitions (with its assignment when one exists).
      const assignments = (await this.store.listAssignments({ metric: head.name })).filter((a) => a.active);
      const slices: Array<{ scope: Record<string, Scalar>; scopeHash: string; assignment: Assignment | undefined }> =
        [];
      if (def.scope.dimensions.length === 0) {
        const emptyHash = contentHash({});
        const own = assignments.find((a) => a.scopeHash === emptyHash);
        slices.push({ scope: {}, scopeHash: emptyHash, assignment: own ? toAssignment(own) : undefined });
      } else {
        for (const a of assignments) {
          slices.push({ scope: a.scope, scopeHash: a.scopeHash, assignment: toAssignment(a) });
        }
      }

      for (const slice of slices) {
        const job: RollupJob = {
          metric: head.name,
          versionNo: version.versionNo,
          scopeHash: slice.scopeHash,
          scope: slice.scope,
          grain: spec.grain,
          cron: cronExpr,
          timezone,
        };
        const entry: JobEntry = { job, version, assignment: slice.assignment, cron: null };
        entry.cron = new Cron(
          cronExpr,
          {
            timezone,
            unref: true, // an embedded engine must never pin the host process
            // In-process overlap (a tick outlasting its interval) — the kv
            // lease already guards cross-instance overlap.
            protect: () => this.logger.warn({ metric: job.metric, scopeHash: job.scopeHash }, 'rollup tick overlapped — skipped by croner protect'),
            catch: (err: unknown) => this.logger.error({ metric: job.metric, scopeHash: job.scopeHash, err: String(err) }, 'rollup tick failed'),
          },
          async () => {
            await this.trackTick(entry);
          },
        );
        // Defensive: a key collision must never orphan a live Cron.
        const displaced = this.entries.get(jobKey(job.metric, job.scopeHash));
        if (displaced !== undefined) {
          displaced.cron?.stop();
          displaced.cron = null;
        }
        this.entries.set(jobKey(job.metric, job.scopeHash), entry);
      }
    }
  }

  /** The scheduled jobs — introspection surface (and the test seam). */
  jobs(): RollupJob[] {
    return [...this.entries.values()].map((e) => ({ ...e.job, scope: { ...e.job.scope } }));
  }

  /** The underlying croner job for one rollup, or null. Introspection only. */
  cronFor(metric: string, scopeHash: string): Cron | null {
    return this.entries.get(jobKey(metric, scopeHash))?.cron ?? null;
  }

  /**
   * The per-job tick, public so tests and hosts can fire a rollup without
   * waiting for cron: previous-window resolution at the CURRENT clock
   * instant, lease, materialize, release. Returns the run status ('skipped'
   * when the lease was held elsewhere or lost before the write; 'error' is
   * already audited and reported, never thrown out of a tick).
   */
  async tick(metric: string, scopeHash: string): Promise<RunStatus> {
    const entry = this.entries.get(jobKey(metric, scopeHash));
    if (entry === undefined) throw new NotFoundError(`rollup job for ${JSON.stringify(metric)}/${scopeHash}`);
    return this.trackTick(entry);
  }

  /** Run one tick with in-flight tracking, so stop() can drain it. */
  private trackTick(entry: JobEntry): Promise<RunStatus> {
    const run = this.runTick(entry);
    this.inFlight.add(run);
    void run.then(
      () => this.inFlight.delete(run),
      () => this.inFlight.delete(run),
    );
    return run;
  }

  private async runTick(entry: JobEntry): Promise<RunStatus> {
    const nowIso = this.clock.now().toISOString();
    const nowMs = Date.parse(nowIso);
    const def = entry.version.doc;
    const calendar = calendarFor(def.calendarRef, this.calendars, this.defaults);
    const window = previousWindow(def.window as PeriodicWindow, nowIso, calendar, this.defaults);
    const { metric, scopeHash } = entry.job;

    const token = await this.acquireLease(metric, scopeHash, nowMs);
    if (token === null) {
      await this.recordSkipped(entry, window, nowIso);
      return 'skipped';
    }

    let status: RunStatus = 'ok';
    try {
      await materializeWindow({
        definitionVersion: entry.version,
        registry: this.registry,
        calendars: this.calendars,
        defaults: this.defaults,
        facts: this.facts,
        scope: entry.job.scope,
        ...(entry.assignment !== undefined ? { assignment: entry.assignment } : {}),
        resolvedWindow: window,
        nowIso,
        store: this.store,
        ...(this.hooks !== undefined ? { hooks: this.hooks } : {}),
        logger: this.logger,
        trigger: 'scheduled',
        // Write fencing: re-verify (and renew) OUR lease immediately before
        // the point+run write — a lease that expired and was stolen while we
        // computed must abort the write, not double-materialize.
        verifyWrite: () => this.verifyLease(metric, scopeHash, token),
      });
    } catch (err) {
      if (err instanceof WriteAbortedError) {
        // Lost the lease between compute and write: nothing was stored —
        // audit the stand-down exactly like a lease lost up front.
        this.logger.warn({ metric, scopeHash, windowKey: window.key }, 'rollup lease lost before write — skipped');
        await this.recordSkipped(entry, window, nowIso);
        status = 'skipped';
      } else {
        // materializeWindow already audited the 'error' run and ran onError;
        // a tick stays quiet so cron keeps ticking.
        status = 'error';
        this.logger.error({ metric, scopeHash, windowKey: window.key, err: String(err) }, 'rollup materialization failed');
      }
    } finally {
      await this.releaseLease(metric, scopeHash, token).catch((err: unknown) =>
        this.logger.warn({ metric, scopeHash, err: String(err) }, 'rollup lease release failed'),
      );
      await this.store
        .pruneRuns(this.defaults.retention, nowIso)
        .catch((err: unknown) => this.logger.warn({ err: String(err) }, 'run pruning failed'));
    }
    return status;
  }

  /** Audit a stood-down tick: a 'skipped' run plus the rollup.skipped event. */
  private async recordSkipped(entry: JobEntry, window: ResolvedWindow, nowIso: string): Promise<void> {
    const { metric, scopeHash } = entry.job;
    const run: MetricRunRecord = {
      id: uuidv7(Date.parse(nowIso)),
      metric,
      versionNo: entry.version.versionNo,
      trigger: 'scheduled',
      windowKey: window.key,
      scopeHash,
      status: 'skipped',
      startedAtIso: nowIso,
      finishedAtIso: nowIso,
      error: null,
      trace: null,
    };
    await this.store.appendRun(run);
    await fireEvent(this.hooks, this.logger, {
      type: 'rollup.skipped',
      metric,
      versionNo: entry.version.versionNo,
      scopeHash,
      windowKey: window.key,
      occurredAtIso: nowIso,
    });
  }

  /**
   * Take the (metric, scopeHash) lease via kv compare-and-set: succeed only
   * when the slot is free or expired — a LIVE lease stands even when this
   * instance holds it (a concurrent tick of the same instance must stand
   * down, not double-run). The fencing token increments on every acquisition
   * and never resets, so a stale holder can always be told from the current
   * one; the token this tick acquired is returned and travels through
   * verify/release. A lost CAS race means someone else took it — null.
   */
  private async acquireLease(metric: string, scopeHash: string, nowMs: number): Promise<number | null> {
    const key = rollupLeaseKey(metric, scopeHash);
    const raw = await this.store.get(key);
    const current = raw === null ? null : (JSON.parse(raw) as LeaseState);
    if (current !== null && current.expiresAtMs > nowMs) return null;
    const next: LeaseState = {
      holder: this.instanceId,
      token: (current?.token ?? 0) + 1,
      expiresAtMs: nowMs + this.defaults.scheduler.leaseTtlMs,
    };
    return (await this.store.compareAndSet(key, raw, JSON.stringify(next))) ? next.token : null;
  }

  /**
   * Re-verify — and RENEW, atomically via CAS — the lease this tick
   * acquired: true only when the stored lease still carries our holder AND
   * our token, and the renewal CAS won. Any other outcome means the lease
   * expired and was (or is being) taken over: the write must not happen.
   */
  private async verifyLease(metric: string, scopeHash: string, token: number): Promise<boolean> {
    const key = rollupLeaseKey(metric, scopeHash);
    const raw = await this.store.get(key);
    if (raw === null) return false;
    const current = JSON.parse(raw) as LeaseState;
    if (current.holder !== this.instanceId || current.token !== token) return false;
    const nowMs = Date.parse(this.clock.now().toISOString());
    const renewed: LeaseState = { ...current, expiresAtMs: nowMs + this.defaults.scheduler.leaseTtlMs };
    return this.store.compareAndSet(key, raw, JSON.stringify(renewed));
  }

  /**
   * Expire the lease THIS tick acquired (holder and token stay for the next
   * fencing bump). Token-checked: if another acquisition superseded ours,
   * its lease is left alone — the first finisher must never release the
   * second's lease.
   */
  private async releaseLease(metric: string, scopeHash: string, token: number): Promise<void> {
    const key = rollupLeaseKey(metric, scopeHash);
    const raw = await this.store.get(key);
    if (raw === null) return;
    const current = JSON.parse(raw) as LeaseState;
    if (current.holder !== this.instanceId || current.token !== token) return;
    await this.store.compareAndSet(key, raw, JSON.stringify({ ...current, expiresAtMs: 0 }));
  }
}
