import { z } from 'zod';
import { connectionProfileSchema, type ConnectionProfile } from './config/connection.js';
import { engineDefaultsSchema, type EngineDefaults, type EngineDefaultsInput } from './config/defaults.js';
import { jsonSchemas, SCHEMA_VERSION } from './config/jsonschema.js';
import {
  aggFnSchema,
  assignmentSchema,
  calendarSchema,
  instantSchema,
  metricDefinitionSchema,
  metricKindSchema,
  metricTypeSchema,
  type Assignment,
  type AssignmentInput,
  type CalendarInput,
  type MetricDefinition,
  type MetricDefinitionInput,
  type RegistryDocInput,
} from './config/schemas.js';
import {
  validateAssignment,
  validateMetricDefinition,
  validateMetricLive,
  validateRegistryDoc,
  type LiveSchemaAccess,
  type ValidationIssue,
} from './config/validate.js';
import { ConfigInvalidError, ConflictError, NotFoundError } from './domain/errors.js';
import { scalarEquals, type Scalar } from './domain/filter.js';
import { uuidv7 } from './domain/ids.js';
import { CompiledRegistry, contentHash, registryHash } from './domain/registry.js';
import type { MetricResult, MetricTrace, ResolvedWindow, WindowGrain } from './domain/types.js';
import { ApiAuth } from './http/auth.js';
import { systemClock, type Clock } from './ports/clock.js';
import type { FactSourcePort } from './ports/factsource.js';
import type { EngineEvent, EngineHooks } from './ports/hooks.js';
import { jsonConsoleLogger, type Logger } from './ports/logger.js';
import {
  DEFINITION_STATES,
  type AssignmentRecord,
  type CalendarRecord,
  type DefinitionRecord,
  type DefinitionVersionRecord,
  type MetricPointRecord,
  type MetricRunRecord,
  type MetricsStateStore,
  type PointDeleteFilter,
  type PointQuery,
  type RegistryRecord,
  type RunQuery,
  type ValidationStatus,
} from './ports/statestore.js';
import { backfillMetric } from './runtime/backfill.js';
import { backtestMetric, calculateMetric, calendarFor, type FactsAccess } from './runtime/calculate.js';
import { compileCalendar, CompiledCalendar } from './runtime/calendar.js';
import { effectiveTarget } from './runtime/compile.js';
import {
  activateDefinition,
  rejectDefinition,
  retireDefinition,
  revalidationSweep as sweepDefinitions,
  submitDefinition,
  worseOf,
  type SweepEntry,
} from './runtime/lifecycle.js';
import { RollupScheduler, type RollupJob } from './runtime/scheduler.js';
import { resolveWindow } from './runtime/window.js';
import { ConnectionRegistry } from './sql/connections.js';
import { knownDialects } from './sql/dialect.js';
import { dialectIntrospector } from './sql/factfetch.js';
import { InMemoryMetricsStateStore } from './state/memory.js';
import { SqliteMetricsStateStore } from './state/sqlite.js';
import { TELEMETRY, TelemetryRegistry } from './telemetry/telemetry.js';

export const ENGINE_NAME = 'malkom-processmetrics-engine';
/** Pinned at build time; keep in lock-step with packages/core/package.json. */
export const ENGINE_VERSION = '0.1.0';

/**
 * The engine facade — the whole embedding story. In library mode this object
 * IS the API; the HTTP router and the server/CLI shells are thin transports
 * over exactly these methods. Ported from the rules engine's facade shape:
 * requireRegistry gating, no-op registry re-applies, sweep-on-change, hooks
 * that are never fatal, and telemetry refreshed non-throwing.
 *
 * Every mutation validates its input AT THE BOUNDARY with zod (z.input
 * shapes) or the tier-1 validators — the facade never trusts callers, even
 * in-process ones.
 */

// ---------------------------------------------------------------------------
// Constructor options — all optional, all documented, zod-validated
// ---------------------------------------------------------------------------

/** How the engine gets its own state store when not handed an instance. */
export type StateOption = MetricsStateStore | { kind: 'memory' } | { kind: 'sqlite'; path: string };

export interface AuthKeysInput {
  adminKeys?: string[];
  readKeys?: string[];
}

export interface SchedulerOptionsInput {
  /** Start the RollupScheduler on engine.start(). Default false. */
  enabled?: boolean;
  /** Rebuild scheduler jobs on lifecycle/assignment changes. Default true. */
  autoRefresh?: boolean;
}

export interface MetricsEngineOptions {
  /**
   * A MetricsStateStore instance, or a descriptor the engine constructs from:
   * `{ kind: 'memory' }` (the default — tests/ephemeral embedding) or
   * `{ kind: 'sqlite', path }` (single-instance persistence via node:sqlite).
   */
  state?: StateOption;
  /**
   * A prebuilt ConnectionRegistry (library mode: registerClient/registerFactory
   * for full credential control) or declarative connection profiles. Default:
   * an empty registry — SQL-backed entities then fail loudly at fetch time.
   */
  connections?: ConnectionRegistry | ConnectionProfile[];
  /** Partial engine-defaults override, merged over the documented defaults. */
  defaults?: EngineDefaultsInput;
  /** Host event/error hooks; exceptions are caught and logged, never fatal. */
  hooks?: EngineHooks;
  /** Time source; default systemClock. Injectable for deterministic tests. */
  clock?: Clock;
  /** Default jsonConsoleLogger. */
  logger?: Logger;
  /**
   * Bearer keys for the control plane (ApiAuth input). Both lists empty (the
   * default) leaves the plane OPEN — deliberate for dev embedding; the server
   * shell warns loudly. The router enforces these on every request.
   */
  auth?: AuthKeysInput;
  /** Rollup scheduling. Default `{ enabled: false, autoRefresh: true }`. */
  scheduler?: SchedulerOptionsInput;
  /**
   * Close the store on stop() when the engine created/owns it. Default true
   * (the alloc-engine precedent) — pass false when sharing one store across
   * engines and managing its lifecycle yourself.
   */
  closeStateStoreOnStop?: boolean;
  /** Lease-holder identity, distinct per process. Default: a fresh uuidv7. */
  instanceId?: string;
  /**
   * Host-provided fact access for entities without table+connection bindings
   * (or to bypass SQL entirely). Default: the SQL fetch path over
   * `connections`. MemoryFactSource is the shipped in-memory implementation.
   */
  factSource?: FactSourcePort;
}

const stateDescriptorSchema = z.union([
  z.strictObject({ kind: z.literal('memory') }),
  z.strictObject({ kind: z.literal('sqlite'), path: z.string().min(1) }),
]);

const authKeysSchema = z.strictObject({
  adminKeys: z.array(z.string().min(1)).default([]),
  readKeys: z.array(z.string().min(1)).default([]),
});

const schedulerOptionsSchema = z.strictObject({
  enabled: z.boolean().default(false),
  autoRefresh: z.boolean().default(true),
});

const instanceIdSchema = z.string().min(1).max(128);

function isStateStore(v: unknown): v is MetricsStateStore {
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof (v as MetricsStateStore).init === 'function' &&
    typeof (v as MetricsStateStore).upsertPoint === 'function'
  );
}

// ---------------------------------------------------------------------------
// Boundary schemas — the z.input shapes every mutation validates against
// ---------------------------------------------------------------------------

// Boundary instants REQUIRE an explicit timezone (Z or ±HH:MM): a zone-less
// datetime would be read in the host's local zone, so the same request could
// name different windows on different hosts.
const instant = instantSchema;

const scalarValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
const scopeInputSchema = z.record(z.string(), scalarValueSchema);

const WINDOW_GRAIN_RE = /^(day|week|month|quarter|rolling-[1-9]\d*[dh])$/;
const grainSchema = z
  .string()
  .regex(WINDOW_GRAIN_RE, 'must be a window grain (day|week|month|quarter|rolling-<n>d|rolling-<n>h)');

const rangeSchema = z.strictObject({ fromIso: instant, toIso: instant });

const actorSchema = z.strictObject({
  actor: z.string().min(1, 'actor is required (the audit trail records who did this)'),
  reason: z.string().min(1).optional(),
});

const calculateInputSchema = z.strictObject({
  metric: z.string().min(1),
  scope: scopeInputSchema.optional(),
  at: instant.optional(),
  allowDraft: z.boolean().optional(),
});

const snapshotInputSchema = z.strictObject({
  scope: scopeInputSchema.optional(),
  at: instant.optional(),
  mode: z.enum(['auto', 'live', 'points']).optional(),
});

const seriesInputSchema = z.strictObject({
  metric: z.string().min(1),
  scope: scopeInputSchema.optional(),
  grain: grainSchema.optional(),
  fromIso: instant,
  toIso: instant,
});

const backtestInputSchema = z.strictObject({
  metric: z.string().min(1),
  scope: scopeInputSchema.optional(),
  range: rangeSchema,
});

const backfillInputSchema = backtestInputSchema;

const pointQuerySchema = z.strictObject({
  metric: z.string().min(1),
  scopeHash: z.string().min(1).optional(),
  grain: grainSchema.optional(),
  fromIso: instant.optional(),
  toIso: instant.optional(),
  limit: z.number().int().min(1).max(100_000).optional(),
  order: z.enum(['asc', 'desc']).optional(),
});

const pointDeleteSchema = z.strictObject({
  metric: z.string().min(1).optional(),
  beforeIso: instant.optional(),
});

const runQuerySchema = z.strictObject({
  metric: z.string().min(1).optional(),
  status: z.enum(['ok', 'error', 'skipped']).optional(),
  trigger: z.enum(['scheduled', 'manual', 'backfill']).optional(),
  scopeHash: z.string().min(1).optional(),
  windowKey: z.string().min(1).optional(),
  limit: z.number().int().min(1).max(100_000).optional(),
  order: z.enum(['asc', 'desc']).optional(),
});

// ---------------------------------------------------------------------------
// Public API shapes
// ---------------------------------------------------------------------------

export interface ActorOptions {
  actor: string;
  reason?: string;
}

export interface ValidateMetricOptions {
  /** Also run tier-2 (live schema) through the registered connections. */
  live?: boolean;
}

export interface TieredValidationResult {
  /** No blocking issues. Advisory issues (severity 'warning') do not fail a verdict. */
  ok: boolean;
  issues: ValidationIssue[];
  /** Whether the live-schema (tier-2) check ran. */
  schematic: 'ran' | 'skipped-not-requested' | 'skipped-no-connection' | 'skipped-error';
  /** The tier-2 failure detail when schematic is 'skipped-error'. */
  schematicDetail?: string;
}

export interface CalculateApiInput {
  metric: string;
  /**
   * Concrete dimension bindings. Keys must be scope dimensions of the metric
   * — an unknown key is a 422, never a silent match-nothing. A SUBSET of the
   * dimensions is allowed (coarser slice); {} evaluates the whole entity.
   */
  scope?: Record<string, Scalar>;
  /** Evaluation instant; defaults to the engine clock. */
  at?: string;
  /**
   * Whether a metric with NO active version may fall back to its working
   * draft. Default true (library callers are in-process and trusted). The
   * HTTP router sets this from the caller's scope — false for read keys —
   * because executing an unreviewed draft formula against live data is the
   * capability backtest admin-gates. With false and no active version the
   * call is a 409 CONFLICT.
   */
  allowDraft?: boolean;
}

export type SnapshotMode = 'auto' | 'live' | 'points';

export interface SnapshotApiInput {
  /** Slice filter: assignments whose scope agrees on every given key match. */
  scope?: Record<string, Scalar>;
  /** Evaluation instant; defaults to the engine clock. */
  at?: string;
  /**
   * 'auto' (default): serve the stored point when its windowKey equals the
   * current window's key, else compute live. 'live': always compute.
   * 'points': stored points only — slices without one are omitted.
   */
  mode?: SnapshotMode;
}

/**
 * One snapshot entry: a MetricResult (trace present when computed live)
 * plus where it came from and the assignment that scoped it.
 */
export type SnapshotEntry = Omit<MetricResult, 'trace'> & {
  trace?: MetricTrace;
  source: 'point' | 'live';
  assignment: AssignmentRecord | null;
  scope: Record<string, Scalar>;
  scopeHash: string;
  /** Stored-point extras (absent on live computations). */
  versionNo?: number;
  revision?: number;
  computedAtIso?: string;
};

export interface SeriesApiInput {
  metric: string;
  scope?: Record<string, Scalar>;
  grain?: WindowGrain;
  /** Half-open range on windowStartIso: fromIso inclusive, toIso exclusive. */
  fromIso: string;
  toIso: string;
}

export interface BacktestApiInput {
  metric: string;
  scope?: Record<string, Scalar>;
  /** Half-open range [fromIso, toIso) the backtest windows must cover. */
  range: { fromIso: string; toIso: string };
}

export interface BackfillApiInput {
  metric: string;
  /** One explicit slice; omitted = every active assignment's slice. */
  scope?: Record<string, Scalar>;
  range: { fromIso: string; toIso: string };
}

export interface BackfillReport {
  metric: string;
  versionNo: number;
  range: { fromIso: string; toIso: string };
  slices: number;
  points: MetricPointRecord[];
}

// ---------------------------------------------------------------------------
// Internals shared with the router
// ---------------------------------------------------------------------------

function zodIssues(error: z.ZodError): ValidationIssue[] {
  return error.issues.map((i) => ({
    path: i.path.map((p) => (typeof p === 'number' ? `[${p}]` : String(p))).join('.').replace(/\.\[/g, '['),
    code: i.code,
    message: i.message,
  }));
}

/** A 422 that carries BOTH flat details and the structured issues array. */
function invalid(message: string, issues: ValidationIssue[]): ConfigInvalidError {
  return new ConfigInvalidError(
    message,
    issues.map((i) => `${i.path}: ${i.message}`),
    issues,
  );
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

/**
 * Does an assignment's scope agree with a requested slice filter? Every key
 * the REQUEST pins that the assignment also binds must match (scalarEquals);
 * request keys the assignment does not bind constrain nothing.
 */
function scopeAgrees(assignmentScope: Record<string, Scalar>, request: Record<string, Scalar>): boolean {
  return Object.entries(request).every(
    ([key, value]) => !(key in assignmentScope) || scalarEquals(assignmentScope[key], value),
  );
}

interface Slice {
  scope: Record<string, Scalar>;
  scopeHash: string;
  assignment: AssignmentRecord | null;
}

export class MetricsEngine {
  /** Register clients/factories/profiles here in library mode. */
  readonly connections: ConnectionRegistry;
  /** The engine's OWN operational counters (the business domain is "metrics"). */
  readonly telemetry = new TelemetryRegistry();
  /** Bearer-key checker the router enforces; open when no keys configured. */
  readonly auth: ApiAuth;

  private readonly store: MetricsStateStore;
  private readonly ownStore: boolean;
  private readonly clock: Clock;
  private readonly logger: Logger;
  private readonly hostHooks: EngineHooks;
  /** Telemetry-observing wrapper handed to every runtime path. */
  private readonly hooks: EngineHooks;
  private readonly defaults: EngineDefaults;
  private readonly schedulerOpts: { enabled: boolean; autoRefresh: boolean };
  private readonly instanceId: string;
  private readonly factSource: FactSourcePort | undefined;

  private scheduler: RollupScheduler | null = null;
  /** Promise-chain mutex: rebuilds/stops of the scheduler never interleave. */
  private schedulerChain: Promise<void> = Promise.resolve();
  private registryCache: CompiledRegistry | null = null;
  private started = false;

  constructor(options: MetricsEngineOptions = {}) {
    // --- logger first: later blocks (connections) thread it through ---
    this.logger = options.logger ?? jsonConsoleLogger;
    if (typeof this.logger.info !== 'function' || typeof this.logger.warn !== 'function') {
      throw invalid('invalid engine option "logger"', [{ path: 'logger', message: 'must be a Logger' }]);
    }

    // --- state store ---
    if (options.state === undefined) {
      this.store = new InMemoryMetricsStateStore();
    } else if (isStateStore(options.state)) {
      this.store = options.state;
    } else {
      const parsed = stateDescriptorSchema.safeParse(options.state);
      if (!parsed.success) throw invalid('invalid engine option "state"', zodIssues(parsed.error));
      this.store =
        parsed.data.kind === 'memory'
          ? new InMemoryMetricsStateStore()
          : new SqliteMetricsStateStore(parsed.data.path);
    }
    this.ownStore = options.closeStateStoreOnStop ?? true;
    if (typeof this.ownStore !== 'boolean') {
      throw invalid('invalid engine option "closeStateStoreOnStop"', [
        { path: 'closeStateStoreOnStop', message: 'must be a boolean' },
      ]);
    }

    // --- connections (engine-created registries report driver-level errors,
    //     e.g. a dropped idle pg connection, to the engine logger; a prebuilt
    //     registry keeps whatever logger IT was constructed with) ---
    if (options.connections === undefined) {
      this.connections = new ConnectionRegistry({ logger: this.logger });
    } else if (options.connections instanceof ConnectionRegistry) {
      this.connections = options.connections;
    } else {
      const parsed = z.array(connectionProfileSchema).safeParse(options.connections);
      if (!parsed.success) throw invalid('invalid engine option "connections"', zodIssues(parsed.error));
      this.connections = new ConnectionRegistry({ logger: this.logger });
      for (const profile of parsed.data) this.connections.registerProfile(profile);
    }

    // --- plain-data options, zod-validated ---
    const defaults = engineDefaultsSchema.safeParse(options.defaults ?? {});
    if (!defaults.success) throw invalid('invalid engine option "defaults"', zodIssues(defaults.error));
    this.defaults = defaults.data;

    const auth = authKeysSchema.safeParse(options.auth ?? {});
    if (!auth.success) throw invalid('invalid engine option "auth"', zodIssues(auth.error));
    this.auth = new ApiAuth(auth.data);

    const sched = schedulerOptionsSchema.safeParse(options.scheduler ?? {});
    if (!sched.success) throw invalid('invalid engine option "scheduler"', zodIssues(sched.error));
    this.schedulerOpts = sched.data;

    if (options.instanceId !== undefined) {
      const id = instanceIdSchema.safeParse(options.instanceId);
      if (!id.success) throw invalid('invalid engine option "instanceId"', zodIssues(id.error));
      this.instanceId = id.data;
    } else {
      this.instanceId = uuidv7();
    }

    // --- injected seams, duck-checked ---
    this.clock = options.clock ?? systemClock;
    if (typeof this.clock.now !== 'function') {
      throw invalid('invalid engine option "clock"', [{ path: 'clock', message: 'must expose now(): Date' }]);
    }
    this.hostHooks = options.hooks ?? {};
    if (typeof this.hostHooks !== 'object' || this.hostHooks === null) {
      throw invalid('invalid engine option "hooks"', [{ path: 'hooks', message: 'must be an EngineHooks object' }]);
    }
    this.factSource = options.factSource;
    if (this.factSource !== undefined && typeof this.factSource.fetchFacts !== 'function') {
      throw invalid('invalid engine option "factSource"', [
        { path: 'factSource', message: 'must expose fetchFacts(query)' },
      ]);
    }

    // Telemetry rides on the event stream: every runtime path gets this
    // wrapper, which observes and then delegates to the host's hooks.
    // fireEvent() catches host-hook failures, so counting always happens.
    this.hooks = {
      onEvent: async (event) => {
        this.observeEvent(event);
        await this.hostHooks.onEvent?.(event);
      },
      onError: async (err, context) => {
        if (context.op === 'materialize') {
          try {
            this.telemetry.increment(TELEMETRY.runs, { status: 'error' });
          } catch {
            /* telemetry must never fail an operation */
          }
        }
        await this.hostHooks.onError?.(err, context);
      },
    };
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  /** Seed the engine tables, prime the registry cache, optionally start rollups. */
  async start(): Promise<void> {
    await this.store.init();
    const record = await this.store.getRegistry();
    this.registryCache = record ? new CompiledRegistry(record.doc, record.version) : null;
    this.started = true;
    if (this.schedulerOpts.enabled) await this.rebuildScheduler();
    await this.refreshGauges(); // prime after restart; never throws
    this.logger.info({ instanceId: this.instanceId, version: ENGINE_VERSION }, 'metrics engine started');
  }

  async stop(): Promise<void> {
    this.started = false;
    // Serialize with any in-flight rebuild, and DRAIN in-flight ticks before
    // the store closes underneath them.
    await this.schedulerOp(async () => {
      await this.scheduler?.stop();
      this.scheduler = null;
    });
    await this.connections.closeAll();
    if (this.ownStore) await this.store.close();
  }

  /** The scheduler's current job set — introspection surface. */
  schedulerJobs(): RollupJob[] {
    return this.scheduler?.jobs() ?? [];
  }

  // -------------------------------------------------------------------------
  // Registry
  // -------------------------------------------------------------------------

  async applyRegistry(input: RegistryDocInput): Promise<{ version: number; hash: string }> {
    this.requireStarted();
    const { result, doc } = validateRegistryDoc(input);
    if (!result.ok || !doc) throw invalid('registry validation failed', result.errors);

    const current = await this.store.getRegistry();
    const hash = registryHash(doc);
    if (current && current.hash === hash) {
      // Identical content (e.g. the same boot file on every restart) is a
      // no-op — no version churn, no sweep, no event.
      this.registryCache ??= new CompiledRegistry(current.doc, current.version);
      return { version: current.version, hash };
    }
    const version = (current?.version ?? 0) + 1;
    await this.store.putRegistry({ version, hash, doc, createdAt: this.now() });
    this.registryCache = new CompiledRegistry(doc, version);

    // Content changed: every definition gets re-checked (sweep.completed
    // fires from the sweep) and the scheduler rebinds to the new registry.
    await this.revalidationSweep();
    await this.rebuildScheduler();
    return { version, hash };
  }

  async getRegistry(version?: number): Promise<RegistryRecord | null> {
    this.requireStarted();
    return this.store.getRegistry(version);
  }

  /**
   * Re-run tier-1 for every non-retired definition against the current
   * registry + calendars, persisting verdicts (see runtime/lifecycle).
   * Broken definitions stay visible and loud, never silently skipped.
   */
  async revalidationSweep(): Promise<SweepEntry[]> {
    const registry = this.requireRegistry();
    const calendars = await this.store.listCalendars();
    const entries = await sweepDefinitions({
      store: this.store,
      registry,
      calendars,
      now: this.now(),
      hooks: this.hooks,
      logger: this.logger,
    });
    await this.refreshGauges();
    return entries;
  }

  // -------------------------------------------------------------------------
  // Calendars
  // -------------------------------------------------------------------------

  async upsertCalendar(input: CalendarInput): Promise<CalendarRecord> {
    this.requireStarted();
    const doc = this.parsed(calendarSchema, input, 'calendar');
    const before = await this.store.getCalendar(doc.name);
    const record = await this.store.upsertCalendar(doc, this.now());
    if (before?.version !== record.version) {
      // Content changed: definitions referencing it re-validate, and the
      // scheduler's timezone bindings rebuild.
      if (this.registryCache !== null) await this.revalidationSweep();
      await this.rebuildScheduler();
    }
    return record;
  }

  async getCalendar(name: string): Promise<CalendarRecord> {
    this.requireStarted();
    const record = await this.store.getCalendar(name);
    if (!record) throw new NotFoundError(`calendar ${JSON.stringify(name)}`);
    return record;
  }

  async listCalendars(): Promise<CalendarRecord[]> {
    this.requireStarted();
    return this.store.listCalendars();
  }

  // -------------------------------------------------------------------------
  // Definitions — authoring & lifecycle
  // -------------------------------------------------------------------------

  /** Create a new draft. The shape must parse; tier-1 issues are storable. */
  async createMetric(input: MetricDefinitionInput, opts: ActorOptions): Promise<DefinitionRecord> {
    const registry = this.requireRegistry();
    const actor = this.requireActor(opts);
    const doc = this.parsed(metricDefinitionSchema, input, 'metric definition');
    if ((await this.store.getDefinition(doc.name)) !== null) {
      throw new ConflictError(`metric "${doc.name}" already exists — update it instead`);
    }
    return this.saveDraft(doc, registry, actor.actor);
  }

  /**
   * Edit the working draft (saveDefinitionDraft semantics): drafts edit in
   * place; editing an ACTIVE definition moves the lineage back to draft while
   * the activated version keeps computing; pending/retired heads refuse edits.
   */
  async updateMetric(name: string, input: MetricDefinitionInput, opts: ActorOptions): Promise<DefinitionRecord> {
    const registry = this.requireRegistry();
    const actor = this.requireActor(opts);
    const doc = this.parsed(metricDefinitionSchema, input, 'metric definition');
    if (doc.name !== name) {
      throw invalid('definition name mismatch', [
        { path: 'name', message: `body names "${doc.name}" but the target is "${name}" — definitions are keyed by name` },
      ]);
    }
    await this.mustGetDefinition(name);
    return this.saveDraft(doc, registry, actor.actor);
  }

  async getMetric(name: string): Promise<DefinitionRecord> {
    this.requireStarted();
    return this.mustGetDefinition(name);
  }

  async listMetrics(): Promise<DefinitionRecord[]> {
    this.requireStarted();
    return this.store.listDefinitions();
  }

  async listMetricVersions(name: string): Promise<DefinitionVersionRecord[]> {
    this.requireStarted();
    await this.mustGetDefinition(name);
    return this.store.listVersions(name);
  }

  /**
   * Tier-1 always; `{ live: true }` adds tier-2 against the live schema
   * through the registered connections. Returns the verdict — never throws
   * on validation findings.
   */
  async validateMetric(
    nameOrInput: string | MetricDefinitionInput,
    opts: ValidateMetricOptions = {},
  ): Promise<TieredValidationResult> {
    const registry = this.requireRegistry();
    let doc: MetricDefinition;
    if (typeof nameOrInput === 'string') {
      doc = (await this.mustGetDefinition(nameOrInput)).doc;
    } else {
      const parsed = metricDefinitionSchema.safeParse(nameOrInput);
      if (!parsed.success) {
        return { ok: false, issues: zodIssues(parsed.error), schematic: 'skipped-not-requested' };
      }
      doc = parsed.data;
    }

    const calendars = await this.store.listCalendars();
    const issues = validateMetricDefinition(doc, registry, calendars);
    const out: TieredValidationResult = {
      ok: issues.length === 0,
      issues,
      schematic: opts.live === true ? 'skipped-no-connection' : 'skipped-not-requested',
    };
    if (opts.live !== true) return out;

    const sources =
      doc.formula.kind === 'aggregate'
        ? [doc.formula.over.source]
        : [doc.formula.numerator.source, doc.formula.denominator.source];
    try {
      const access: Record<string, LiveSchemaAccess> = {};
      for (const source of new Set(sources)) {
        const entity = registry.entity(source);
        if (!entity?.table || entity.connectionRef === undefined || !this.connections.has(entity.connectionRef)) {
          continue;
        }
        const { client, dialect } = await this.connections.resolve(entity.connectionRef);
        access[entity.connectionRef] = { client, introspector: dialectIntrospector(dialect) };
      }
      if (Object.keys(access).length > 0) {
        out.issues.push(...(await validateMetricLive(doc, registry, access)));
        out.schematic = 'ran';
      }
    } catch (err) {
      out.schematic = 'skipped-error';
      out.schematicDetail = err instanceof Error ? err.message : String(err);
    }
    // Advisories (severity 'warning', e.g. anchor_encoding_suspect) inform
    // the verdict without failing it.
    out.ok = !out.issues.some((i) => i.severity !== 'warning');
    return out;
  }

  /** draft → pending: hand the draft to whoever approves activations. */
  async submit(name: string, opts: ActorOptions): Promise<DefinitionRecord> {
    this.requireStarted();
    return submitDefinition(this.store, name, this.lifecycleOpts(opts));
  }

  /**
   * pending → active: tier-1 re-runs against the CURRENT registry — re-read
   * from the STORE first (another instance may have advanced it behind this
   * process's cache; the activation gate must never validate against a stale
   * registry) — an immutable version row is appended (registry + calendar
   * pinned) and the scheduler picks the new version up.
   */
  async activate(name: string, opts: ActorOptions): Promise<{ head: DefinitionRecord; version: DefinitionVersionRecord }> {
    const registry = await this.freshRegistry();
    const out = await activateDefinition(this.store, name, registry, this.lifecycleOpts(opts));
    await this.refreshScheduler();
    await this.refreshGauges();
    return out;
  }

  /** pending → draft: send it back for another editing round. */
  async reject(name: string, opts: ActorOptions): Promise<DefinitionRecord> {
    this.requireStarted();
    return rejectDefinition(this.store, name, this.lifecycleOpts(opts));
  }

  /** active → retired: rollups stop; every version row stays readable. */
  async retire(name: string, opts: ActorOptions): Promise<DefinitionRecord> {
    this.requireStarted();
    const head = await retireDefinition(this.store, name, this.lifecycleOpts(opts));
    await this.refreshScheduler();
    await this.refreshGauges();
    return head;
  }

  // -------------------------------------------------------------------------
  // Assignments
  // -------------------------------------------------------------------------

  async assign(input: AssignmentInput): Promise<AssignmentRecord> {
    const registry = this.requireRegistry();
    const assignment = this.parsed(assignmentSchema, input, 'assignment');
    const head = await this.mustGetDefinition(assignment.metric);
    const issues = validateAssignment(assignment, head.doc, registry);
    if (issues.length > 0) throw invalid('assignment validation failed', issues);
    const record = await this.store.putAssignment(assignment, this.now());
    await this.refreshScheduler();
    return record;
  }

  async unassign(id: string): Promise<void> {
    this.requireStarted();
    const all = await this.store.listAssignments();
    if (!all.some((a) => a.id === id)) throw new NotFoundError(`assignment ${JSON.stringify(id)}`);
    await this.store.deleteAssignment(id);
    await this.refreshScheduler();
  }

  async listAssignments(filter: { metric?: string } = {}): Promise<AssignmentRecord[]> {
    this.requireStarted();
    return this.store.listAssignments(filter.metric !== undefined ? { metric: filter.metric } : {});
  }

  // -------------------------------------------------------------------------
  // Evaluation
  // -------------------------------------------------------------------------

  /**
   * Calculate one metric point on demand — NO persistence. Uses the ACTIVE
   * version's doc when one exists; without one, the working draft (which
   * must be tier-1 clean to compile) — but ONLY when `allowDraft` permits
   * (default true; the router grants it to admin scope only, see
   * CalculateApiInput.allowDraft). A matching active assignment's
   * targetOverride merges into the judged target.
   */
  async calculate(input: CalculateApiInput): Promise<MetricResult> {
    const registry = this.requireRegistry();
    const parsed = this.parsed(calculateInputSchema, input, 'calculate input');
    const head = await this.mustGetDefinition(parsed.metric);
    const active = await this.store.getActiveVersion(parsed.metric);
    if (active === null && parsed.allowDraft === false) {
      throw new ConflictError(
        `metric "${parsed.metric}" has no active version — executing its working draft requires admin scope (activate it, or backtest as admin)`,
      );
    }
    const doc = active?.doc ?? head.doc;
    const at = parsed.at ?? this.now();
    const scope = parsed.scope ?? {};
    this.requireScopeKeys(scope, doc.scope.dimensions, doc.name);
    const assignment = await this.assignmentFor(parsed.metric, scope);
    const calendars = await this.calendarDocs();
    const t0 = performance.now();
    const result = await calculateMetric({
      definition: doc,
      registry,
      calendars,
      defaults: this.defaults,
      facts: this.factsAccess(),
      scope,
      at,
      ...(assignment !== null ? { assignment: toAssignment(assignment) } : {}),
    });
    this.telemetry.observe(TELEMETRY.runDurationMs, performance.now() - t0);
    return result;
  }

  /**
   * The current value of every ACTIVE definition whose assignment scope
   * agrees with the requested slice (dimensionless definitions are always
   * included). See SnapshotApiInput.mode for point-vs-live semantics.
   */
  async snapshot(input: SnapshotApiInput = {}): Promise<SnapshotEntry[]> {
    const registry = this.requireRegistry();
    const parsed = this.parsed(snapshotInputSchema, input, 'snapshot input');
    const mode: SnapshotMode = parsed.mode ?? 'auto';
    const at = parsed.at ?? this.now();
    const request = parsed.scope ?? {};
    const calendars = await this.calendarDocs();

    // Resolve the active docs first: the requested slice keys must be scope
    // dimensions of at least ONE active definition — a typo'd key would
    // otherwise silently constrain nothing.
    const active: MetricDefinition[] = [];
    for (const head of await this.store.listDefinitions()) {
      // Keyed on the ACTIVE VERSION pointer, not head state: an edited
      // lineage (head back in draft) still has a computing active version —
      // the scheduler's discipline, mirrored.
      if (head.activeVersion === null) continue;
      const version = await this.store.getActiveVersion(head.name);
      if (version !== null) active.push(version.doc);
    }
    if (active.length > 0) {
      const knownDimensions = [...new Set(active.flatMap((def) => def.scope.dimensions))];
      this.requireScopeKeys(request, knownDimensions, 'any active definition');
    }

    const entries: SnapshotEntry[] = [];
    for (const def of active) {
      const slices = await this.slicesOf(def, request);
      if (slices.length === 0) continue;

      const calendar = calendarFor(def.calendarRef, calendars, this.defaults);
      const window = resolveWindow(def.window, at, calendar, this.defaults);

      for (const slice of slices) {
        let point: MetricPointRecord | undefined;
        if (mode !== 'live') {
          const recent = await this.store.queryPoints({
            metric: def.name,
            scopeHash: slice.scopeHash,
            order: 'desc',
            limit: 20,
          });
          point = recent.find((p) => p.windowKey === window.key);
          // auto: a point computed BEFORE its window closed is partial —
          // recompute live rather than serving it as authoritative. Explicit
          // 'points' mode is a raw store read and serves what is there.
          if (
            mode === 'auto' &&
            point !== undefined &&
            Date.parse(point.computedAtIso) < Date.parse(point.windowEndIso)
          ) {
            point = undefined;
          }
        }
        if (point !== undefined) {
          entries.push(this.entryFromPoint(def, point, slice.assignment, window));
          continue;
        }
        if (mode === 'points') continue; // store-only mode: absent stays absent

        const t0 = performance.now();
        const result = await calculateMetric({
          definition: def,
          registry,
          calendars,
          defaults: this.defaults,
          facts: this.factsAccess(),
          scope: slice.scope,
          at,
          window,
          ...(slice.assignment !== null ? { assignment: toAssignment(slice.assignment) } : {}),
        });
        this.telemetry.observe(TELEMETRY.runDurationMs, performance.now() - t0);
        entries.push({
          ...result,
          source: 'live',
          assignment: slice.assignment,
          scope: slice.scope,
          scopeHash: slice.scopeHash,
        });
      }
    }
    return entries;
  }

  /** A stored-points read over [fromIso, toIso) — no computation, ever. */
  async series(input: SeriesApiInput): Promise<MetricPointRecord[]> {
    this.requireStarted();
    const parsed = this.parsed(seriesInputSchema, input, 'series input');
    await this.mustGetDefinition(parsed.metric);
    const query: PointQuery = {
      metric: parsed.metric,
      fromIso: parsed.fromIso,
      toIso: parsed.toIso,
      order: 'asc',
    };
    if (parsed.scope !== undefined) query.scopeHash = contentHash(parsed.scope);
    if (parsed.grain !== undefined) query.grain = parsed.grain as WindowGrain;
    return this.store.queryPoints(query);
  }

  /**
   * Recompute the WORKING DRAFT's history over a range — evidence before
   * activation, no persistence. One MetricResult per enumerated window.
   */
  async backtest(input: BacktestApiInput): Promise<MetricResult[]> {
    const registry = this.requireRegistry();
    const parsed = this.parsed(backtestInputSchema, input, 'backtest input');
    const head = await this.mustGetDefinition(parsed.metric);
    const scope = parsed.scope ?? {};
    this.requireScopeKeys(scope, head.doc.scope.dimensions, head.doc.name);
    const assignment = await this.assignmentFor(parsed.metric, scope);
    return backtestMetric({
      definition: head.doc,
      registry,
      calendars: await this.calendarDocs(),
      defaults: this.defaults,
      facts: this.factsAccess(),
      scope,
      range: parsed.range,
      ...(assignment !== null ? { assignment: toAssignment(assignment) } : {}),
    });
  }

  /**
   * A backtest that PERSISTS, pinned to the ACTIVE version: every enumerated
   * window upserts its point and appends a 'backfill' run. Without an
   * explicit scope, every active assignment's slice is backfilled (the empty
   * scope for dimensionless definitions).
   */
  async backfill(input: BackfillApiInput): Promise<BackfillReport> {
    const registry = this.requireRegistry();
    const parsed = this.parsed(backfillInputSchema, input, 'backfill input');
    await this.mustGetDefinition(parsed.metric);
    const version = await this.store.getActiveVersion(parsed.metric);
    if (version === null) {
      throw new ConflictError(`cannot backfill "${parsed.metric}" — no active version (backfills pin activated snapshots)`);
    }
    const def = version.doc;

    let slices: Slice[];
    if (parsed.scope !== undefined) {
      this.requireScopeKeys(parsed.scope, def.scope.dimensions, def.name);
      slices = [
        {
          scope: parsed.scope,
          scopeHash: contentHash(parsed.scope),
          assignment: await this.assignmentFor(parsed.metric, parsed.scope),
        },
      ];
    } else {
      slices = await this.slicesOf(def, {});
      if (slices.length === 0) {
        throw invalid('nothing to backfill', [
          {
            path: 'scope',
            message: `metric "${parsed.metric}" is dimensioned and has no active assignments — pass an explicit scope or assign slices first`,
          },
        ]);
      }
    }

    const calendars = await this.calendarDocs();
    const points: MetricPointRecord[] = [];
    for (const slice of slices) {
      const outcomes = await backfillMetric({
        definitionVersion: version,
        registry,
        calendars,
        defaults: this.defaults,
        facts: this.factsAccess(),
        scope: slice.scope,
        ...(slice.assignment !== null ? { assignment: toAssignment(slice.assignment) } : {}),
        range: parsed.range,
        nowIso: this.now(),
        store: this.store,
        hooks: this.hooks,
        logger: this.logger,
      });
      points.push(...outcomes.map((o) => o.point));
    }
    return {
      metric: parsed.metric,
      versionNo: version.versionNo,
      range: parsed.range,
      slices: slices.length,
      points,
    };
  }

  // -------------------------------------------------------------------------
  // Data plane — points and runs
  // -------------------------------------------------------------------------

  async queryPoints(query: PointQuery): Promise<MetricPointRecord[]> {
    this.requireStarted();
    const parsed = this.parsed(pointQuerySchema, query, 'point query');
    const out: PointQuery = { metric: parsed.metric };
    if (parsed.scopeHash !== undefined) out.scopeHash = parsed.scopeHash;
    if (parsed.grain !== undefined) out.grain = parsed.grain as WindowGrain;
    if (parsed.fromIso !== undefined) out.fromIso = parsed.fromIso;
    if (parsed.toIso !== undefined) out.toIso = parsed.toIso;
    if (parsed.limit !== undefined) out.limit = parsed.limit;
    if (parsed.order !== undefined) out.order = parsed.order;
    return this.store.queryPoints(out);
  }

  async deletePoints(filter: PointDeleteFilter): Promise<number> {
    this.requireStarted();
    const parsed = this.parsed(pointDeleteSchema, filter, 'point delete filter');
    if (parsed.metric === undefined && parsed.beforeIso === undefined) {
      throw invalid('refusing unfiltered point deletion', [
        { path: '', message: 'pass metric and/or beforeIso — bulk deletion needs stated intent' },
      ]);
    }
    const out: PointDeleteFilter = {};
    if (parsed.metric !== undefined) out.metric = parsed.metric;
    if (parsed.beforeIso !== undefined) out.beforeIso = parsed.beforeIso;
    return this.store.deletePoints(out);
  }

  async queryRuns(query: RunQuery = {}): Promise<MetricRunRecord[]> {
    this.requireStarted();
    const parsed = this.parsed(runQuerySchema, query, 'run query');
    const out: RunQuery = {};
    if (parsed.metric !== undefined) out.metric = parsed.metric;
    if (parsed.status !== undefined) out.status = parsed.status;
    if (parsed.trigger !== undefined) out.trigger = parsed.trigger;
    if (parsed.scopeHash !== undefined) out.scopeHash = parsed.scopeHash;
    if (parsed.windowKey !== undefined) out.windowKey = parsed.windowKey;
    if (parsed.limit !== undefined) out.limit = parsed.limit;
    if (parsed.order !== undefined) out.order = parsed.order;
    return this.store.queryRuns(out);
  }

  /** Apply EngineDefaults.retention now; returns the number of deleted runs. */
  async pruneRuns(): Promise<number> {
    this.requireStarted();
    return this.store.pruneRuns(this.defaults.retention, this.now());
  }

  // -------------------------------------------------------------------------
  // Discovery
  // -------------------------------------------------------------------------

  jsonSchemas(): Record<string, unknown> {
    return jsonSchemas();
  }

  describe(): Record<string, unknown> {
    const registry = this.registryCache;
    return {
      engine: ENGINE_NAME,
      version: ENGINE_VERSION,
      schemaVersion: SCHEMA_VERSION,
      capabilities: {
        operators: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'notIn', 'inSet', 'matches', 'isNull', 'isNotNull', 'and', 'or', 'not'],
        aggregations: [...aggFnSchema.options],
        formulaKinds: ['aggregate', 'ratio'],
        metricKinds: [...metricKindSchema.options],
        metricTypes: [...metricTypeSchema.options],
        grains: ['day', 'week', 'month', 'quarter'],
        windowKinds: ['periodic', 'rolling'],
        statuses: ['attained', 'warn', 'breach', 'no_data', 'computed'],
        definitionStates: [...DEFINITION_STATES],
        snapshotModes: ['auto', 'live', 'points'],
        dialects: knownDialects(),
        // calculate's fall-back to the WORKING DRAFT (no active version) is
        // admin-gated over HTTP; snapshot executes active versions only.
        draftExecution: 'admin',
      },
      scheduler: {
        enabled: this.schedulerOpts.enabled,
        autoRefresh: this.schedulerOpts.autoRefresh,
        jobs: this.scheduler?.jobs().length ?? 0,
      },
      registry: registry
        ? {
            version: registry.version,
            hash: registry.hash,
            entities: registry.entityIds().map((id) => {
              const e = registry.entity(id)!;
              return {
                id,
                ...(e.name !== undefined ? { name: e.name } : {}),
                ...(e.subQueueField !== undefined
                  ? { subQueueField: e.subQueueField, subQueues: registry.subQueues(id) ?? [] }
                  : {}),
                fields: e.fields.map((f) => f.id),
              };
            }),
          }
        : null,
    };
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  private now(): string {
    return this.clock.now().toISOString();
  }

  private requireStarted(): void {
    if (!this.started) throw new ConflictError('engine not started — call start() first');
  }

  private requireRegistry(): CompiledRegistry {
    this.requireStarted();
    if (!this.registryCache) {
      throw new ConfigInvalidError('no registry applied — applyRegistry() before using the engine');
    }
    return this.registryCache;
  }

  /**
   * The registry as the STORE currently has it: re-read and re-compile when
   * the cache has drifted (multi-instance shared store). Trust gates
   * (activation) use this; hot read paths keep the cache.
   */
  private async freshRegistry(): Promise<CompiledRegistry> {
    this.requireStarted();
    const record = await this.store.getRegistry();
    if (
      record !== null &&
      (this.registryCache === null ||
        this.registryCache.version !== record.version ||
        this.registryCache.hash !== record.hash)
    ) {
      this.registryCache = new CompiledRegistry(record.doc, record.version);
    }
    return this.requireRegistry();
  }

  /**
   * Boundary guard for evaluation scopes: every key must be one of the
   * definition's scope.dimensions. Partial scopes are allowed (a subset
   * slices more coarsely, {} evaluates the whole entity) — an UNKNOWN key is
   * refused, because it would silently match nothing and fabricate a
   * value-0 point out of a typo.
   */
  private requireScopeKeys(scope: Record<string, Scalar>, dimensions: readonly string[], metric: string): void {
    const unknown = Object.keys(scope).filter((key) => !dimensions.includes(key));
    if (unknown.length > 0) {
      throw invalid(
        `invalid scope for metric "${metric}"`,
        unknown.map((key) => ({
          path: `scope.${key}`,
          message: `"${key}" is not a scope dimension of metric "${metric}" (dimensions: ${
            dimensions.length > 0 ? dimensions.join(', ') : 'none — this metric is entity-wide'
          })`,
        })),
      );
    }
  }

  private parsed<S extends z.ZodType>(schema: S, value: unknown, what: string): z.output<S> {
    const result = schema.safeParse(value);
    if (!result.success) throw invalid(`invalid ${what}`, zodIssues(result.error));
    return result.data;
  }

  private requireActor(opts: ActorOptions): ActorOptions {
    const a = this.parsed(actorSchema, opts, 'actor options (the audit trail records who did this)');
    return a.reason !== undefined ? { actor: a.actor, reason: a.reason } : { actor: a.actor };
  }

  private lifecycleOpts(opts: ActorOptions): {
    actor: string;
    reason?: string;
    now: string;
    hooks: EngineHooks;
    logger: Logger;
  } {
    const a = this.requireActor(opts);
    return {
      actor: a.actor,
      ...(a.reason !== undefined ? { reason: a.reason } : {}),
      now: this.now(),
      hooks: this.hooks,
      logger: this.logger,
    };
  }

  private async mustGetDefinition(name: string): Promise<DefinitionRecord> {
    const head = await this.store.getDefinition(name);
    if (!head) throw new NotFoundError(`metric ${JSON.stringify(name)}`);
    return head;
  }

  /**
   * Persist a draft head and stamp its tier-1 verdict. Cross-reference
   * errors are STORABLE (drafts compose incrementally — the rules-engine
   * discipline); only the shape gate upstream is blocking. When the lineage
   * has an ACTIVE version, the stamped verdict is the WORSE of the draft's
   * and the active doc's (the sweep's ranking): the pinned version keeps
   * computing, so a clean draft edit must never hide that what is still
   * computing broke.
   */
  private async saveDraft(doc: MetricDefinition, registry: CompiledRegistry, actor: string): Promise<DefinitionRecord> {
    const head = await this.store.saveDefinitionDraft(doc, this.now(), actor);
    const calendars = await this.store.listCalendars();
    let status: ValidationStatus = validateMetricDefinition(doc, registry, calendars).length > 0 ? 'broken' : 'valid';
    if (head.activeVersion !== null) {
      const active = await this.store.getVersion(doc.name, head.activeVersion);
      if (active !== null) {
        status = worseOf(status, validateMetricDefinition(active.doc, registry, calendars).length > 0 ? 'broken' : 'valid');
      }
    }
    if (head.validationStatus !== status) {
      head.validationStatus = status;
      await this.store.putDefinitionHead(head);
    }
    await this.refreshGauges();
    return head;
  }

  private factsAccess(): FactsAccess {
    return this.factSource !== undefined
      ? { source: this.factSource }
      : { connections: this.connections, logger: this.logger };
  }

  private async calendarDocs(): Promise<CompiledCalendar[]> {
    const records = await this.store.listCalendars();
    return records.map((r) =>
      compileCalendar(r.doc, r.version, { maxBusinessSpanDays: this.defaults.maxBusinessSpanDays }),
    );
  }

  /** The active assignment binding exactly this scope, or null. */
  private async assignmentFor(metric: string, scope: Record<string, Scalar>): Promise<AssignmentRecord | null> {
    const hash = contentHash(scope);
    const assignments = await this.store.listAssignments({ metric });
    return assignments.find((a) => a.active && a.scopeHash === hash) ?? null;
  }

  /**
   * The slices a definition materializes/snapshots for: active assignments
   * agreeing with the request filter; the empty scope for dimensionless
   * definitions (always included — with its assignment when one exists).
   */
  private async slicesOf(def: MetricDefinition, request: Record<string, Scalar>): Promise<Slice[]> {
    const assignments = (await this.store.listAssignments({ metric: def.name })).filter((a) => a.active);
    if (def.scope.dimensions.length === 0) {
      const emptyHash = contentHash({});
      return [{ scope: {}, scopeHash: emptyHash, assignment: assignments.find((a) => a.scopeHash === emptyHash) ?? null }];
    }
    return assignments
      .filter((a) => scopeAgrees(a.scope, request))
      .map((a) => ({ scope: a.scope, scopeHash: a.scopeHash, assignment: a }));
  }

  /** A stored point, reshaped into the snapshot entry vocabulary. */
  private entryFromPoint(
    def: MetricDefinition,
    point: MetricPointRecord,
    assignment: AssignmentRecord | null,
    window: ResolvedWindow,
  ): SnapshotEntry {
    const entry: SnapshotEntry = {
      metric: def.name,
      kind: def.kind,
      metricType: def.metricType,
      unit: def.unit,
      value: point.value,
      numerator: point.numerator,
      denominator: point.denominator,
      status: point.status,
      window: {
        startIso: point.windowStartIso,
        endIso: point.windowEndIso,
        key: point.windowKey,
        grain: point.grain,
        alignment: window.alignment,
      },
      source: 'point',
      assignment,
      scope: point.scope,
      scopeHash: point.scopeHash,
      versionNo: point.versionNo,
      revision: point.revision,
      computedAtIso: point.computedAtIso,
    };
    if (point.targetValue !== null) {
      // The merged target as of NOW — point.targetValue is what was judged.
      entry.target = effectiveTarget(def, assignment !== null ? toAssignment(assignment) : undefined);
    }
    return entry;
  }

  /** Serialize scheduler mutations — two rebuilds racing each other would
   * construct two schedulers and orphan one's live cron timers. */
  private schedulerOp<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.schedulerChain.then(fn);
    this.schedulerChain = run.then(
      () => undefined,
      () => undefined, // the chain must survive a failed operation
    );
    return run;
  }

  private rebuildScheduler(): Promise<void> {
    return this.schedulerOp(async () => {
      await this.scheduler?.stop();
      this.scheduler = null;
      if (!this.schedulerOpts.enabled || !this.started || this.registryCache === null) return;
      this.scheduler = new RollupScheduler({
        store: this.store,
        registry: this.registryCache,
        calendars: await this.calendarDocs(),
        defaults: this.defaults,
        facts: this.factsAccess(),
        hooks: this.hooks,
        clock: this.clock,
        logger: this.logger,
        instanceId: this.instanceId,
      });
      await this.scheduler.start();
    });
  }

  private refreshScheduler(): Promise<void> {
    return this.schedulerOp(async () => {
      if (this.scheduler !== null && this.schedulerOpts.autoRefresh) await this.scheduler.refresh();
    });
  }

  /** Best-effort telemetry: must never fail (or delay) a committed operation. */
  private async refreshGauges(): Promise<void> {
    try {
      const heads = await this.store.listDefinitions();
      this.telemetry.setGauge(TELEMETRY.activeDefinitions, heads.filter((h) => h.state === 'active').length);
      this.telemetry.setGauge(TELEMETRY.brokenDefinitions, heads.filter((h) => h.validationStatus === 'broken').length);
    } catch (err) {
      this.logger.warn({ err: String(err) }, 'definition gauge refresh failed');
    }
  }

  /** Count what the event stream reports; telemetry never fails an operation. */
  private observeEvent(event: EngineEvent): void {
    try {
      this.telemetry.increment(TELEMETRY.transitions, { event: event.type });
      switch (event.type) {
        case 'definition.activated':
          this.telemetry.increment(TELEMETRY.activations);
          break;
        case 'definition.retired':
          this.telemetry.increment(TELEMETRY.retirements);
          break;
        case 'metric.computed':
          this.telemetry.increment(TELEMETRY.runs, { trigger: event.trigger, status: 'ok' });
          this.telemetry.increment(TELEMETRY.points);
          break;
        case 'metric.breached':
          this.telemetry.increment(TELEMETRY.breaches);
          break;
        case 'rollup.skipped':
          this.telemetry.increment(TELEMETRY.runs, { trigger: 'scheduled', status: 'skipped' });
          break;
        case 'sweep.completed':
          this.telemetry.increment(TELEMETRY.sweeps);
          this.telemetry.setGauge(
            TELEMETRY.brokenDefinitions,
            event.results.filter((r) => r.validationStatus === 'broken').length,
          );
          break;
        default:
          break;
      }
    } catch {
      /* telemetry must never fail an operation */
    }
  }
}
