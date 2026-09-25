import { hostname } from 'node:os';
import { z } from 'zod';
import {
  configBundleSchema,
  connectionProfileSchema,
  isAdapterRef,
  queueDefinitionSchema,
  type ConfigBundle,
  type ConnectionProfile,
  type QueueDefinition,
} from './config/schemas.js';
import { validateQueueDefinition, type ValidationResult } from './config/validate.js';
import { AdapterError, ConfigInvalidError, ConflictError, NotFoundError } from './domain/errors.js';
import {
  WORK_EVENTS_TABLE,
  workEventsStatements,
  type WorkEventsTableOptions,
} from './defaults/work-events.js';
import { checkWorkEventsCoverage, type CoverageOptions, type CoverageReport } from './defaults/coverage.js';
import { uuidv7 } from './domain/ids.js';
import { emptyCounts, type AllocationRunRecord, type RunTrigger } from './domain/types.js';
import { MetricsRegistry } from './metrics/metrics.js';
import type { BackendAdapter, QueueRuntimeRef } from './ports/adapter.js';
import type { Clock } from './ports/clock.js';
import { systemClock } from './ports/clock.js';
import type { Logger } from './ports/logger.js';
import { jsonConsoleLogger } from './ports/logger.js';
import type { ColumnInfo } from './ports/sql.js';
import type {
  RetentionPolicy,
  RunDeleteFilter,
  RunListFilter,
  RunsSummary,
  RunsSummaryFilter,
  StateStore,
} from './ports/statestore.js';
import { computeEligibility } from './runtime/eligibility.js';
import { executeRun, pausedKey, schemaFailureKey, type EngineHooks } from './runtime/pipeline.js';
import { QueueScheduler } from './runtime/scheduler.js';
import { InMemoryStateStore } from './state/memory.js';
import { SqlBindingAdapter } from './sql/binding-adapter.js';
import { ConnectionRegistry, type SecretResolver } from './sql/connections.js';
import { knownDialects } from './sql/dialect.js';
import { StrategyRegistry } from './strategies/registry.js';
import type { AllocationStrategy } from './strategies/types.js';

export const ENGINE_NAME = 'malkom-alloc';
export const ENGINE_VERSION = '0.1.0';

export interface EngineOptions {
  stateStore?: StateStore;
  /**
   * Whether engine.stop() closes the state store. Default true — the common
   * pattern constructs the store inline in these options. Pass false when
   * sharing one store across engines and manage its lifecycle yourself.
   */
  closeStateStoreOnStop?: boolean;
  clock?: Clock;
  logger?: Logger;
  hooks?: EngineHooks;
  secretResolver?: SecretResolver;
  /** Declared instance count; >1 on a non-shared store refuses to start. */
  instances?: number;
  retention?: RetentionPolicy;
  leaseTtlMs?: number;
  instanceId?: string;
  /**
   * Coverage watchdog: periodically scan a workEvents-convention table for
   * unallocated work with NO enabled queue definition, and make the silence
   * visible (warn logs + malkom_unconfigured_items gauge + /v1/coverage).
   */
  coverage?: CoverageOptions & { connectionRef: string; everyMs?: number };
}

export interface QueueStatus {
  definition: QueueDefinition;
  paused: boolean;
  scheduled: boolean;
  nextRunAt: string | null;
  lastRun: { id: string; status: string; startedAt: string; finishedAt?: string | undefined } | null;
}

export interface ScheduleView {
  queueId: string;
  name: string;
  subQueue: unknown;
  trigger: QueueDefinition['schedule']['trigger'];
  jitterMs: number;
  enabled: boolean;
  paused: boolean;
  nextRunAt: string | null;
  lastRunAt: string | null;
  lastStatus: string | null;
}

export interface AllocationView {
  runId: string;
  queueId: string;
  itemId: string;
  workerId: string;
  reason: string;
  outcome: string;
  at: string;
}

const DEFAULT_RETENTION: RetentionPolicy = { maxAgeMs: 30 * 24 * 3600_000, maxCountPerQueue: 2000 };

function queueKey(id: string): string {
  return `queue:${id}`;
}

/**
 * The engine facade — the whole embedding story. In library mode this object
 * IS the API; the HTTP router (http/router.ts) and the server/CLI shells are
 * thin transports over exactly these methods.
 */
export class AllocationEngine {
  readonly connections: ConnectionRegistry;
  readonly strategies = new StrategyRegistry();
  readonly metrics = new MetricsRegistry();

  private readonly customAdapters = new Map<string, BackendAdapter>();
  private readonly sqlAdapter: SqlBindingAdapter;
  private readonly scheduler: QueueScheduler;
  private readonly store: StateStore;
  private readonly ownsStore: boolean;
  private readonly clock: Clock;
  private readonly logger: Logger;
  private readonly hooks: EngineHooks | undefined;
  private readonly retention: RetentionPolicy;
  private readonly leaseTtlMs: number | undefined;
  private readonly instances: number;
  readonly instanceId: string;
  private started = false;
  private readonly coverageOpts: (CoverageOptions & { connectionRef: string; everyMs?: number }) | undefined;
  private coverageTimer: ReturnType<typeof setInterval> | undefined;

  constructor(options: EngineOptions = {}) {
    this.ownsStore = options.closeStateStoreOnStop ?? true;
    this.store = options.stateStore ?? new InMemoryStateStore(options.clock ?? systemClock);
    this.clock = options.clock ?? systemClock;
    this.logger = options.logger ?? jsonConsoleLogger;
    this.hooks = options.hooks;
    this.retention = options.retention ?? DEFAULT_RETENTION;
    this.leaseTtlMs = options.leaseTtlMs;
    this.instances = options.instances ?? 1;
    this.instanceId =
      options.instanceId ?? `${hostname()}-${process.pid}-${uuidv7().slice(0, 8)}`;
    this.coverageOpts = options.coverage;
    this.connections = new ConnectionRegistry(
      options.secretResolver ? { secretResolver: options.secretResolver } : {},
    );
    this.sqlAdapter = new SqlBindingAdapter(this.connections, this.clock);
    this.scheduler = new QueueScheduler(
      {
        run: (queueId) => this.runQueue(queueId, 'schedule', false).catch(() => undefined),
        onOverlapSkip: (queueId) => void this.recordOverlapSkip(queueId),
        onScheduleError: (queueId, err) =>
          this.logger.error({ queueId, err: String(err) }, 'scheduled run threw'),
      },
      this.logger,
    );
  }

  // -- Custom backend adapters ---------------------------------------------

  registerAdapter(name: string, adapter: BackendAdapter): void {
    this.customAdapters.set(name, adapter);
  }

  registerStrategy(strategy: AllocationStrategy<never> | AllocationStrategy<unknown>): void {
    this.strategies.register(strategy);
  }

  // -- Lifecycle -----------------------------------------------------------

  async start(): Promise<void> {
    if (this.started) return;
    if (this.instances > 1 && this.store instanceof InMemoryStateStore) {
      throw new ConfigInvalidError(
        'instances > 1 with an in-memory state store would silently double-assign — use a shared state store',
      );
    }
    await this.store.init();
    await this.store.markAbandonedRuns(new Date(this.clock.now().getTime() - 10 * 60_000));
    for (const def of await this.loadAllQueues()) {
      const paused = (await this.store.get(pausedKey(def.id))) === '1';
      this.scheduler.register(def, { startPaused: paused });
    }
    if (this.coverageOpts !== undefined) {
      const everyMs = Math.max(30_000, this.coverageOpts.everyMs ?? 300_000);
      this.coverageTimer = setInterval(() => {
        void this.coverage(this.coverageOpts!.connectionRef, this.coverageOpts).catch((err: unknown) =>
          this.logger.error({ err: String(err) }, 'coverage watchdog scan failed'),
        );
      }, everyMs);
      this.coverageTimer.unref?.();
    }
    this.started = true;
    this.logger.info({ instanceId: this.instanceId, version: ENGINE_VERSION }, 'engine started');
  }

  async stop(): Promise<void> {
    if (this.coverageTimer !== undefined) clearInterval(this.coverageTimer);
    this.scheduler.stopAll();
    await this.connections.closeAll();
    if (this.ownsStore) await this.store.close();
    this.started = false;
  }

  // -- Queue configuration -------------------------------------------------

  async upsertQueue(input: unknown): Promise<{ definition: QueueDefinition; warnings: string[] }> {
    const parsed = queueDefinitionSchema.safeParse(input);
    if (!parsed.success) {
      throw new ConfigInvalidError('queue definition failed schema validation', zodIssues(parsed.error));
    }
    const def = parsed.data;

    const staticCheck = validateQueueDefinition(def);
    if (!staticCheck.ok) throw new ConfigInvalidError('queue definition invalid', staticCheck.errors);

    if (!this.strategies.has(def.strategy.kind)) {
      throw new ConfigInvalidError(`unknown strategy kind ${JSON.stringify(def.strategy.kind)}`, [
        `registered: ${this.strategies.kinds().join(', ')}`,
      ]);
    }
    for (const side of [def.work, def.workers]) {
      if (isAdapterRef(side)) {
        if (!this.customAdapters.has(side.adapterRef)) {
          throw new ConfigInvalidError(`adapterRef ${JSON.stringify(side.adapterRef)} is not registered`);
        }
      } else if (!this.connections.has(side.connectionRef)) {
        throw new ConfigInvalidError(
          `connectionRef ${JSON.stringify(side.connectionRef)} is not registered — register the connection first`,
        );
      }
    }

    const existing = await this.getQueue(def.id).catch(() => null);
    if (def.version !== undefined && existing && def.version !== existing.version) {
      throw new ConflictError(
        `version mismatch: queue ${def.id} is at version ${existing.version}, request expected ${def.version}`,
      );
    }
    const stored: QueueDefinition = { ...def, version: (existing?.version ?? 0) + 1 };
    await this.store.set(queueKey(def.id), JSON.stringify(stored));

    if (this.started) {
      const paused = (await this.store.get(pausedKey(def.id))) === '1';
      this.scheduler.register(stored, { startPaused: paused });
    }
    this.logger.info({ queueId: def.id, version: stored.version }, 'queue upserted');
    return { definition: stored, warnings: staticCheck.warnings };
  }

  async getQueue(id: string): Promise<QueueDefinition> {
    const raw = await this.store.get(queueKey(id));
    if (raw === null) throw new NotFoundError(`queue ${JSON.stringify(id)}`);
    return JSON.parse(raw) as QueueDefinition;
  }

  async listQueues(): Promise<QueueDefinition[]> {
    return this.loadAllQueues();
  }

  async deleteQueue(id: string): Promise<void> {
    await this.getQueue(id); // 404 if absent
    this.scheduler.unregister(id);
    await this.store.delete(queueKey(id));
    await this.store.delete(pausedKey(id));
    await this.store.delete(schemaFailureKey(id));
    this.logger.info({ queueId: id }, 'queue deleted (run history retained)');
  }

  async queueStatus(id: string): Promise<QueueStatus> {
    const definition = await this.getQueue(id);
    const paused = (await this.store.get(pausedKey(id))) === '1';
    const { runs } = await this.store.listRuns({ queueId: id, limit: 1 });
    const last = runs[0];
    return {
      definition,
      paused,
      scheduled: this.scheduler.has(id),
      nextRunAt: this.scheduler.nextRunAt(id)?.toISOString() ?? null,
      lastRun: last
        ? { id: last.id, status: last.status, startedAt: last.startedAt, finishedAt: last.finishedAt }
        : null,
    };
  }

  async pauseQueue(id: string): Promise<void> {
    await this.getQueue(id);
    await this.store.set(pausedKey(id), '1');
    this.scheduler.pause(id);
    this.logger.info({ queueId: id }, 'queue paused');
  }

  async resumeQueue(id: string): Promise<void> {
    await this.getQueue(id);
    await this.store.delete(pausedKey(id));
    await this.store.delete(schemaFailureKey(id)); // fresh start after a fix
    this.scheduler.resume(id);
    this.logger.info({ queueId: id }, 'queue resumed');
  }

  // -- Running -------------------------------------------------------------

  async runQueue(id: string, trigger: RunTrigger, dryRun: boolean): Promise<AllocationRunRecord> {
    const definition = await this.getQueue(id);
    const queue: QueueRuntimeRef = { queueId: id, queueVersion: definition.version ?? 0, definition };
    const record = await executeRun({
      queue,
      adapter: this.adapterFor(definition),
      store: this.store,
      strategies: this.strategies,
      metrics: this.metrics,
      clock: this.clock,
      logger: this.logger,
      instanceId: this.instanceId,
      trigger,
      dryRun,
      hooks: this.hooks,
      leaseTtlMs: this.leaseTtlMs,
    });
    void this.store.pruneRuns(this.retention).catch(() => 0);
    return record;
  }

  async releaseItems(id: string, itemIds: string[]): Promise<number> {
    const definition = await this.getQueue(id);
    const adapter = this.adapterFor(definition);
    const release = adapter.assigner.release?.bind(adapter.assigner);
    if (!release) throw new ConfigInvalidError(`queue ${id}: adapter does not support release`);
    const queue: QueueRuntimeRef = { queueId: id, queueVersion: definition.version ?? 0, definition };
    const n = await release(queue, itemIds);
    this.metrics.increment('malkom_released_total', { queue: id }, n);
    return n;
  }

  // -- Validation (three tiers) --------------------------------------------

  async validateQueue(idOrDef: string | unknown): Promise<
    ValidationResult & {
      columns?: { work?: ColumnInfo[]; workers?: ColumnInfo[] };
      sample?: Array<Record<string, unknown>>;
    }
  > {
    const def =
      typeof idOrDef === 'string'
        ? await this.getQueue(idOrDef)
        : (() => {
            const parsed = queueDefinitionSchema.safeParse(idOrDef);
            if (!parsed.success) {
              throw new ConfigInvalidError('queue definition failed schema validation', zodIssues(parsed.error));
            }
            return parsed.data;
          })();

    const result = validateQueueDefinition(def);
    const errors = [...result.errors];
    const warnings = [...result.warnings];
    const columns: { work?: ColumnInfo[]; workers?: ColumnInfo[] } = {};
    let sample: Array<Record<string, unknown>> | undefined;

    // Tier 2: live schema check; Tier 3: sample query.
    if (!isAdapterRef(def.work)) {
      const b = def.work;
      const probe = await this.connections.probe(b.connectionRef, b.table);
      if (!probe.ok) {
        errors.push(`work connection ${JSON.stringify(b.connectionRef)}: ${probe.detail ?? 'unreachable'}`);
      } else if (probe.columns) {
        columns.work = probe.columns;
        const have = new Set(probe.columns.map((c) => c.name));
        const need = new Set<string>([
          b.fields.id,
          b.fields.assignee,
          b.fields.state,
          ...(b.fields.subQueue ? [b.fields.subQueue.column] : []),
          ...(b.fields.assignedAt ? [b.fields.assignedAt.column] : []),
          ...(b.fields.createdAt ? [b.fields.createdAt] : []),
          ...(b.fields.priority ? [b.fields.priority] : []),
          ...b.fields.attributes,
          ...b.ordering.map((o) => o.column),
        ]);
        for (const col of need) {
          if (!have.has(col)) errors.push(`work table ${b.table.name}: column ${JSON.stringify(col)} does not exist`);
        }
        if (errors.length === 0) {
          try {
            const queue: QueueRuntimeRef = { queueId: def.id, queueVersion: def.version ?? 0, definition: def };
            const items = await this.sqlAdapter.work.fetchAllocatable(queue, 5);
            sample = items.map((i) => ({ id: i.id, createdAt: i.createdAt?.toISOString(), ...i.attrs }));
          } catch (err) {
            errors.push(`sample query failed: ${err instanceof Error ? err.message : String(err)}`);
          }
        }
      }
    }
    if (!isAdapterRef(def.workers)) {
      const wb = def.workers;
      const probe = await this.connections.probe(wb.connectionRef, wb.table);
      if (!probe.ok) {
        errors.push(`workers connection ${JSON.stringify(wb.connectionRef)}: ${probe.detail ?? 'unreachable'}`);
      } else if (probe.columns) {
        columns.workers = probe.columns;
        const have = new Set(probe.columns.map((c) => c.name));
        const need = new Set<string>([
          wb.fields.id,
          ...(wb.fields.displayName ? [wb.fields.displayName] : []),
          ...(wb.fields.capacity?.column ? [wb.fields.capacity.column] : []),
          ...(wb.load.kind === 'column' ? [wb.load.column] : []),
          ...wb.fields.attributes,
        ]);
        for (const col of need) {
          if (!have.has(col)) errors.push(`workers table ${wb.table.name}: column ${JSON.stringify(col)} does not exist`);
        }
      }
    }

    const out: ValidationResult & {
      columns?: { work?: ColumnInfo[]; workers?: ColumnInfo[] };
      sample?: Array<Record<string, unknown>>;
    } = { ok: errors.length === 0, errors, warnings };
    if (columns.work || columns.workers) out.columns = columns;
    if (sample !== undefined) out.sample = sample;
    return out;
  }

  // -- Schedules / runs / allocations views --------------------------------

  async listSchedules(): Promise<ScheduleView[]> {
    const defs = await this.loadAllQueues();
    const views: ScheduleView[] = [];
    for (const def of defs) {
      const paused = (await this.store.get(pausedKey(def.id))) === '1';
      const { runs } = await this.store.listRuns({ queueId: def.id, limit: 1 });
      const last = runs[0];
      views.push({
        queueId: def.id,
        name: def.name,
        subQueue: !isAdapterRef(def.work) ? (def.work.fields.subQueue?.value ?? null) : null,
        trigger: def.schedule.trigger,
        jitterMs: def.schedule.jitterMs,
        enabled: def.enabled,
        paused,
        nextRunAt: this.scheduler.nextRunAt(def.id)?.toISOString() ?? null,
        lastRunAt: last?.startedAt ?? null,
        lastStatus: last?.status ?? null,
      });
    }
    return views;
  }

  listRuns(filter: RunListFilter): Promise<{ runs: AllocationRunRecord[]; total: number }> {
    return this.store.listRuns(filter);
  }

  /** Aggregated run-log view for host dashboards — totals per status and per queue. */
  summarizeRuns(filter: RunsSummaryFilter): Promise<RunsSummary> {
    return this.store.summarizeRuns(filter);
  }

  /**
   * Coverage watchdog: report unallocated (queueId, subqueueId) combinations
   * in a workEvents-convention table that NO enabled queue definition covers —
   * "work we were supposed to run but had no rules for". Observes only; never
   * creates work, never validates business rules.
   */
  async coverage(connectionRef: string, opts: CoverageOptions = {}): Promise<CoverageReport> {
    const conn = await this.connections.resolve(connectionRef);
    const report = await checkWorkEventsCoverage(conn, connectionRef, await this.loadAllQueues(), opts);
    for (const u of report.uncovered) {
      this.logger.warn(
        { connectionRef, queueId: u.queueId, subqueueId: u.subqueueId, unallocated: u.unallocated },
        'unconfigured work: items waiting with no allocation rules',
      );
      this.metrics.setGauge(
        'malkom_unconfigured_items',
        { queue: String(u.queueId), subqueue: String(u.subqueueId ?? '') },
        u.unallocated,
      );
    }
    return report;
  }

  async getRun(id: string): Promise<AllocationRunRecord> {
    const run = await this.store.getRun(id);
    if (!run) throw new NotFoundError(`run ${JSON.stringify(id)}`);
    return run;
  }

  async deleteRuns(filter: RunDeleteFilter): Promise<number> {
    if (
      (filter.ids === undefined || filter.ids.length === 0) &&
      filter.queueId === undefined &&
      filter.status === undefined &&
      filter.before === undefined
    ) {
      throw new ConfigInvalidError('refusing unfiltered run deletion — pass queueId, status, before, or ids');
    }
    return this.store.deleteRuns(filter);
  }

  /**
   * Flattened assignment audit across runs (bounded scan, newest first).
   * Dry-run and unapplied 'planned' records are excluded unless an explicit
   * outcome filter asks for them — the audit answers "what actually happened".
   */
  async listAllocations(filter: {
    queueId?: string | undefined;
    workerId?: string | undefined;
    itemId?: string | undefined;
    outcome?: string | undefined;
    limit?: number | undefined;
  }): Promise<AllocationView[]> {
    const limit = Math.min(filter.limit ?? 100, 1000);
    const out: AllocationView[] = [];
    let offset = 0;
    while (out.length < limit) {
      const { runs } = await this.store.listRuns({ queueId: filter.queueId, limit: 100, offset });
      if (runs.length === 0) break;
      for (const run of runs) {
        for (const a of run.assignments) {
          if (filter.outcome !== undefined) {
            if (a.outcome !== filter.outcome) continue;
          } else if (a.outcome === 'dry-run' || a.outcome === 'planned') {
            continue;
          }
          if (filter.workerId !== undefined && a.workerId !== filter.workerId) continue;
          if (filter.itemId !== undefined && a.itemId !== filter.itemId) continue;
          out.push({
            runId: run.id,
            queueId: run.queueId,
            itemId: a.itemId,
            workerId: a.workerId,
            reason: a.reason,
            outcome: a.outcome,
            at: run.finishedAt ?? run.startedAt,
          });
          if (out.length >= limit) break;
        }
        if (out.length >= limit) break;
      }
      offset += 100;
      if (offset >= 500) break; // bounded scan — deep audits should filter by queueId
    }
    return out;
  }

  // -- Config bundles ------------------------------------------------------

  async applyConfig(input: unknown, opts: { expectedVersion?: number } = {}): Promise<{ configVersion: number; warnings: string[] }> {
    const parsed = configBundleSchema.safeParse(input);
    if (!parsed.success) throw new ConfigInvalidError('config bundle failed schema validation', zodIssues(parsed.error));
    const bundle: ConfigBundle = parsed.data;

    const currentRaw = await this.store.get('configVersion');
    const current = currentRaw === null ? 0 : Number(currentRaw);
    if (opts.expectedVersion !== undefined && opts.expectedVersion !== current) {
      throw new ConflictError(`config version mismatch: store is at ${current}, request expected ${opts.expectedVersion}`);
    }

    const warnings: string[] = [];
    for (const profile of bundle.connections) {
      this.connections.registerProfile(profile);
    }
    for (const q of bundle.queues) {
      const { warnings: w } = await this.upsertQueue(q);
      warnings.push(...w.map((x) => `${q.id}: ${x}`));
    }
    const next = current + 1;
    const ok = await this.store.compareAndSet('configVersion', currentRaw, String(next));
    if (!ok) throw new ConflictError('config version changed concurrently — re-read and retry');
    return { configVersion: next, warnings };
  }

  async currentConfig(): Promise<{ configVersion: number; connections: Array<{ id: string; dialect: string }>; queues: QueueDefinition[] }> {
    const raw = await this.store.get('configVersion');
    return {
      configVersion: raw === null ? 0 : Number(raw),
      connections: this.connections.list(),
      queues: await this.loadAllQueues(),
    };
  }

  /**
   * Provision the default workEvents table (idempotent) on a registered
   * connection. An optional convention — see defaults/work-events.ts.
   */
  async provisionWorkEvents(
    connectionRef: string,
    opts: WorkEventsTableOptions = {},
  ): Promise<{ table: string; dialect: string; statements: number }> {
    const { client, dialect } = await this.connections.resolve(connectionRef);
    const statements = workEventsStatements(dialect, opts);
    for (const stmt of statements) {
      try {
        await client.execute(stmt, []);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        // Idempotency: MySQL lacks IF NOT EXISTS on CREATE INDEX.
        if (!/already exists|duplicate key/i.test(msg)) {
          throw new AdapterError(`provision workEvents on ${JSON.stringify(connectionRef)}: ${msg}`);
        }
      }
    }
    const table = opts.table ?? WORK_EVENTS_TABLE;
    this.logger.info({ connectionRef, table, dialect: dialect.name }, 'workEvents table provisioned');
    return { table, dialect: dialect.name, statements: statements.length };
  }

  registerConnectionProfile(input: unknown): ConnectionProfile {
    const parsed = connectionProfileSchema.safeParse(input);
    if (!parsed.success) throw new ConfigInvalidError('connection profile failed schema validation', zodIssues(parsed.error));
    this.connections.registerProfile(parsed.data);
    return parsed.data;
  }

  // -- Discovery -----------------------------------------------------------

  describe(): Record<string, unknown> {
    return {
      engine: ENGINE_NAME,
      version: ENGINE_VERSION,
      schemaVersion: 1,
      instanceId: this.instanceId,
      capabilities: {
        strategies: this.strategies.kinds(),
        dialects: knownDialects(),
        features: ['validate', 'dry-run', 'release', 'stale-sweep', 'metrics', 'allocations-audit', 'config-bundles', 'work-events'],
      },
      links: {
        queues: '/v1/queues',
        schedules: '/v1/schedules',
        runs: '/v1/runs',
        allocations: '/v1/allocations',
        metrics: '/v1/metrics',
        schemas: '/v1/schema',
        health: '/v1/health',
        config: '/v1/config',
      },
    };
  }

  // -- Internals -----------------------------------------------------------

  private adapterFor(def: QueueDefinition): BackendAdapter {
    if (isAdapterRef(def.work)) {
      const adapter = this.customAdapters.get(def.work.adapterRef);
      if (!adapter) throw new ConfigInvalidError(`adapterRef ${JSON.stringify(def.work.adapterRef)} is not registered`);
      return adapter;
    }
    return this.sqlAdapter;
  }

  private async loadAllQueues(): Promise<QueueDefinition[]> {
    const keys = await this.store.listKeys('queue:');
    const defs: QueueDefinition[] = [];
    for (const k of keys) {
      const raw = await this.store.get(k);
      if (raw !== null) defs.push(JSON.parse(raw) as QueueDefinition);
    }
    return defs.sort((a, b) => a.id.localeCompare(b.id));
  }

  private async recordOverlapSkip(queueId: string): Promise<void> {
    this.metrics.increment('malkom_overlap_skips_total', { queue: queueId });
    try {
      const def = await this.getQueue(queueId);
      const now = this.clock.now().toISOString();
      await this.store.appendRun({
        id: uuidv7(this.clock.now().getTime()),
        queueId,
        queueVersion: def.version ?? 0,
        tenantId: def.tenantId,
        trigger: 'schedule',
        dryRun: false,
        status: 'skipped',
        skipReason: 'already_running',
        startedAt: now,
        finishedAt: now,
        strategy: def.strategy.kind,
        counts: emptyCounts(),
        assignments: [],
      });
    } catch {
      /* best-effort visibility */
    }
  }
}

function zodIssues(err: z.ZodError): string[] {
  return err.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`);
}

// Re-exported so hosts can drive eligibility computation in custom tooling.
export { computeEligibility };
