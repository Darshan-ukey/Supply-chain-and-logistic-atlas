import { ConfigInvalidError, ConflictError, NotFoundError } from './domain/errors.js';
import { uuidv7 } from './domain/ids.js';
import { filterFields } from './domain/filter.js';
import { CompiledRegistry, registryHash } from './domain/registry.js';
import type {
  ApplicableGroup,
  DecisionRecord,
  EvaluationResult,
  GroupHead,
  GroupState,
  GroupTransition,
  GroupValidity,
  GroupVersionRecord,
} from './domain/types.js';
import {
  scopeFields,
  type GroupDefinition,
  type GroupDefinitionInput,
  type RegistryDocInput,
} from './config/schemas.js';
import {
  validateGroupDefinition,
  validateRegistryDoc,
  type ValidationIssue,
  type ValidationResult,
} from './config/validate.js';
import { jsonSchemas, SCHEMA_VERSION } from './config/jsonschema.js';
import type { ConnectionProfile } from './config/connection.js';
import { ConnectionRegistry, type SecretResolver } from './sql/connections.js';
import { knownDialects } from './sql/dialect.js';
import { systemClock, type Clock } from './ports/clock.js';
import { jsonConsoleLogger, type Logger } from './ports/logger.js';
import type {
  DecisionDeleteFilter,
  DecisionQuery,
  GroupHeadFilter,
  RegistryRecord,
  RetentionPolicy,
  RulesStateStore,
} from './ports/statestore.js';
import { InMemoryRulesStateStore } from './state/memory.js';
import { CompiledRuleset, type ActiveGroupInput } from './runtime/compile.js';
import { applicableGroups, evaluateRuleset } from './runtime/evaluate.js';
import {
  definitionMatchesText,
  findOverlappingWrites,
  scopeAccepts,
  touchedFields,
  type AnalyzableGroup,
  type ConsistencyFinding,
} from './runtime/analyze.js';
import {
  BACKTEST_OUTCOMES_CAP,
  BACKTEST_SAMPLE_DEFAULT,
  BACKTEST_SAMPLE_MAX,
  buildSampleSelect,
  summarizeRow,
  type BacktestOptions,
  type BacktestReport,
} from './runtime/backtest.js';
import type { Scalar } from './domain/filter.js';
import { METRIC, MetricsRegistry } from './metrics/metrics.js';

export const ENGINE_NAME = 'malkom-rules';
export const ENGINE_VERSION = '0.2.0';

/** Lifecycle and registry events (§6, D3) — the host wires approvals here. */
export type EngineEventType =
  | 'registry.applied'
  | 'group.created'
  | 'group.updated'
  | 'group.submitted'
  | 'group.activated'
  | 'group.rejected'
  | 'group.retired';

export interface EngineEvent {
  type: EngineEventType;
  at: string;
  groupId?: string;
  version?: number;
  actor?: string;
  detail?: string;
}

export interface EngineHooks {
  /** Exceptions are caught and logged, never fatal. */
  onEvent?(event: EngineEvent): void | Promise<void>;
  onError?(err: unknown, context: { op: string; groupId?: string }): void | Promise<void>;
}

export interface RulesEngineOptions {
  stateStore?: RulesStateStore;
  /** Close the store on stop() when the engine created/owns it. Default true. */
  closeStateStoreOnStop?: boolean;
  clock?: Clock;
  logger?: Logger;
  hooks?: EngineHooks;
  secretResolver?: SecretResolver;
  retention?: RetentionPolicy;
  /** Also write decision records for explain() calls. Default false. */
  recordExplains?: boolean;
}

export interface ActorOptions {
  actor: string;
  reason?: string;
}

export interface EvaluateApiOptions {
  /** Explicit evaluation instant; defaults to the engine clock (§6.1). */
  asOf?: string | Date;
  /** Row id recorded on the decision; defaults to String(row.id) if present. */
  entityId?: string;
}

export interface TieredValidationResult extends ValidationResult {
  /** Whether the live-schema (tier-2) check ran (§5.2). */
  schematic: 'ran' | 'skipped-no-connection' | 'skipped-error';
}

/** Typed criteria for queryGroups (D6) — deliberately not a query DSL. */
export interface GroupQueryCriteria {
  entity?: string;
  state?: GroupState;
  validity?: GroupValidity;
  /** Groups whose rules read or write this field (reverse-index semantics). */
  touchesField?: string;
  /** Groups explicitly scoped to accept this value on this field. */
  scopeValue?: { field: string; value: Scalar };
  /** Groups whose effectiveTo ends before this instant — expiry dashboards. */
  expiringBefore?: string;
  /** Case-insensitive search over names, rule names, messages, reasons. */
  text?: string;
  limit?: number;
  offset?: number;
}

const VALIDITY_RANK: Record<GroupValidity, number> = {
  valid: 0,
  unchecked: 1,
  degraded: 2,
  broken: 3,
};

function worseValidity(a: GroupValidity, b: GroupValidity): GroupValidity {
  return VALIDITY_RANK[a] >= VALIDITY_RANK[b] ? a : b;
}

function validityOf(result: ValidationResult): GroupValidity {
  if (result.errors.length > 0) return 'broken';
  if (result.warnings.length > 0) return 'degraded';
  return 'valid';
}

function issueStrings(issues: ValidationIssue[]): string[] {
  return issues.map((i) => `${i.path}: ${i.message}`);
}

/**
 * The engine facade — the whole embedding story. In library mode this object
 * IS the API; the HTTP router and the server/CLI shells are thin transports
 * over exactly these methods.
 */
export class RulesEngine {
  readonly connections: ConnectionRegistry;
  readonly metrics = new MetricsRegistry();

  private readonly store: RulesStateStore;
  private readonly ownStore: boolean;
  private readonly clock: Clock;
  private readonly logger: Logger;
  private readonly hooks: EngineHooks;
  private readonly retention: RetentionPolicy;
  private readonly recordExplains: boolean;

  private registryCache: CompiledRegistry | null = null;
  private compiled: CompiledRuleset | null = null;
  private started = false;

  constructor(options: RulesEngineOptions = {}) {
    this.store = options.stateStore ?? new InMemoryRulesStateStore();
    this.ownStore = options.closeStateStoreOnStop ?? true;
    this.clock = options.clock ?? systemClock;
    this.logger = options.logger ?? jsonConsoleLogger;
    this.hooks = options.hooks ?? {};
    this.retention = options.retention ?? { maxAgeMs: 30 * 24 * 60 * 60 * 1000, maxCount: 10_000 };
    this.recordExplains = options.recordExplains ?? false;
    this.connections = new ConnectionRegistry(
      options.secretResolver ? { secretResolver: options.secretResolver } : {},
    );
  }

  async start(): Promise<void> {
    await this.store.init();
    const record = await this.store.getRegistry();
    this.registryCache = record ? new CompiledRegistry(record.doc, record.version) : null;
    this.compiled = null;
    this.started = true;
    await this.refreshGroupGauges(); // prime after restart; never throws
  }

  async stop(): Promise<void> {
    this.started = false;
    await this.connections.closeAll();
    if (this.ownStore) await this.store.close();
  }

  registerConnectionProfile(profile: ConnectionProfile): void {
    this.connections.registerProfile(profile);
  }

  // -------------------------------------------------------------------------
  // Registry
  // -------------------------------------------------------------------------

  async applyRegistry(input: RegistryDocInput): Promise<{ version: number; hash: string }> {
    const { result, doc } = validateRegistryDoc(input);
    if (!result.ok || !doc) {
      throw new ConfigInvalidError('registry validation failed', issueStrings(result.errors));
    }
    const current = await this.store.getRegistry();
    const hash = registryHash(doc);
    if (current && current.hash === hash) {
      // Identical content (e.g. the same boot file on every restart) is a
      // no-op — no version churn, no sweep, no event.
      this.registryCache ??= new CompiledRegistry(current.doc, current.version);
      return { version: current.version, hash };
    }
    const version = (current?.version ?? 0) + 1;
    const record: RegistryRecord = {
      version,
      hash,
      doc,
      createdAt: this.now(),
    };
    await this.store.putRegistry(record);
    this.registryCache = new CompiledRegistry(doc, version);
    this.compiled = null;

    await this.revalidationSweep();
    await this.fire({ type: 'registry.applied', at: record.createdAt, detail: `v${version}` });
    return { version, hash: record.hash };
  }

  async getRegistry(version?: number): Promise<RegistryRecord | null> {
    return this.store.getRegistry(version);
  }

  /**
   * Re-check every group against the current registry and mark validity
   * (§5.3). Broken groups stay visible and loud — never silently skipped:
   * their active versions keep evaluating (the pinned snapshot is intact),
   * but authors and dashboards see `broken` until the group or registry heals.
   */
  async revalidationSweep(): Promise<Array<{ groupId: string; validity: GroupValidity }>> {
    const registry = this.requireRegistry();
    const out: Array<{ groupId: string; validity: GroupValidity }> = [];
    const heads = await this.store.listGroupHeads();
    for (const head of heads) {
      let validity = validityOf(validateGroupDefinition(head.draft, registry).result);
      if (head.activeVersion !== null) {
        const active = await this.store.getGroupVersion(head.id, head.activeVersion);
        if (active) {
          validity = worseValidity(
            validity,
            validityOf(validateGroupDefinition(active.definition, registry).result),
          );
        }
      }
      if (validity !== head.validity) {
        head.validity = validity;
        head.updatedAt = this.now();
        await this.store.putGroupHead(head);
      }
      out.push({ groupId: head.id, validity });
    }
    await this.refreshGroupGauges(heads);
    return out;
  }

  // -------------------------------------------------------------------------
  // Authoring & lifecycle (§6)
  // -------------------------------------------------------------------------

  async createGroup(input: GroupDefinitionInput, opts: ActorOptions): Promise<GroupHead> {
    const registry = this.requireRegistry();
    const { result, definition } = validateGroupDefinition(input, registry);
    if (!definition) {
      // Not even shape-valid: nothing coherent to store.
      throw new ConfigInvalidError('group definition failed to parse', issueStrings(result.errors));
    }
    const at = this.now();
    const head: GroupHead = {
      id: uuidv7(this.clock.now().getTime()),
      entity: definition.entity,
      name: definition.name,
      state: 'draft',
      latestVersion: 0,
      activeVersion: null,
      draft: definition,
      validity: validityOf(result),
      transitions: [{ to: 'draft', actor: opts.actor, at }],
      createdAt: at,
      updatedAt: at,
      ...(definition.tenantId !== undefined ? { tenantId: definition.tenantId } : {}),
    };
    await this.store.putGroupHead(head);
    await this.fire({ type: 'group.created', at, groupId: head.id, actor: opts.actor });
    return head;
  }

  /**
   * Edit the working draft. Cross-reference (tier-1) errors are storable —
   * drafts compose incrementally (§5) — but the shape must parse. Editing an
   * active or retired group moves the LINEAGE back to draft; the active
   * version keeps evaluating untouched (§2.4).
   */
  async updateGroup(id: string, input: GroupDefinitionInput, opts: ActorOptions): Promise<GroupHead> {
    const registry = this.requireRegistry();
    const head = await this.mustGetHead(id);
    if (head.state === 'pending') {
      throw new ConflictError('group is pending approval — reject it back to draft before editing');
    }
    const { result, definition } = validateGroupDefinition(input, registry);
    if (!definition) {
      throw new ConfigInvalidError('group definition failed to parse', issueStrings(result.errors));
    }
    const at = this.now();
    head.draft = definition;
    head.name = definition.name;
    head.entity = definition.entity;
    head.validity = validityOf(result);
    head.updatedAt = at;
    if (head.state !== 'draft') {
      head.state = 'draft';
      head.transitions.push({ to: 'draft', actor: opts.actor, at, reason: 'edited' });
    }
    await this.store.putGroupHead(head);
    await this.fire({ type: 'group.updated', at, groupId: id, actor: opts.actor });
    return head;
  }

  async submit(id: string, opts: ActorOptions): Promise<GroupHead> {
    return this.transition(id, 'draft', 'pending', 'group.submitted', opts);
  }

  async reject(id: string, opts: ActorOptions): Promise<GroupHead> {
    return this.transition(id, 'pending', 'draft', 'group.rejected', opts);
  }

  /**
   * Activate the pending draft: validate against the CURRENT registry, then
   * snapshot it as an immutable version and point evaluation at it (§6).
   * Who may call this is the host's decision — the engine records who did.
   */
  async activate(id: string, opts: ActorOptions): Promise<GroupHead> {
    const registry = this.requireRegistry();
    const head = await this.mustGetHead(id);
    if (head.state !== 'pending') {
      throw new ConflictError(`cannot activate a ${head.state} group — submit() it first`);
    }
    const { result, definition } = validateGroupDefinition(head.draft, registry, {
      forActivation: true,
    });
    if (!result.ok || !definition) {
      throw new ConfigInvalidError('activation blocked by validation', issueStrings(result.errors));
    }
    const at = this.now();

    if (head.activeVersion !== null) {
      const previous = await this.store.getGroupVersion(head.id, head.activeVersion);
      if (previous) {
        previous.supersededAt = at;
        await this.store.putGroupVersion(previous);
      }
    }

    const version = head.latestVersion + 1;
    const snapshot: GroupVersionRecord = {
      groupId: head.id,
      version,
      definition,
      registryVersion: registry.version,
      createdAt: at,
      activatedBy: opts.actor,
    };
    await this.store.putGroupVersion(snapshot);

    head.state = 'active';
    head.latestVersion = version;
    head.activeVersion = version;
    head.validity = validityOf(result);
    head.transitions.push({ to: 'active', actor: opts.actor, at });
    head.updatedAt = at;
    await this.store.putGroupHead(head);

    await this.store.bumpRulesetVersion();
    this.compiled = null;
    this.metrics.increment(METRIC.activations);
    await this.refreshGroupGauges();
    await this.fire({ type: 'group.activated', at, groupId: id, version, actor: opts.actor });
    return head;
  }

  async retire(id: string, opts: ActorOptions): Promise<GroupHead> {
    const head = await this.mustGetHead(id);
    if (head.state !== 'active') {
      throw new ConflictError(`cannot retire a ${head.state} group`);
    }
    const at = this.now();
    if (head.activeVersion !== null) {
      const active = await this.store.getGroupVersion(head.id, head.activeVersion);
      if (active) {
        active.supersededAt = at;
        active.retiredBy = opts.actor;
        await this.store.putGroupVersion(active);
      }
    }
    head.state = 'retired';
    head.activeVersion = null;
    const transition: GroupTransition = { to: 'retired', actor: opts.actor, at };
    if (opts.reason !== undefined) transition.reason = opts.reason;
    head.transitions.push(transition);
    head.updatedAt = at;
    await this.store.putGroupHead(head);

    await this.store.bumpRulesetVersion();
    this.compiled = null;
    this.metrics.increment(METRIC.retirements);
    await this.refreshGroupGauges();
    await this.fire({ type: 'group.retired', at, groupId: id, actor: opts.actor });
    return head;
  }

  async getGroup(id: string): Promise<GroupHead> {
    return this.mustGetHead(id);
  }

  async listGroups(filter?: GroupHeadFilter): Promise<GroupHead[]> {
    return this.store.listGroupHeads(filter);
  }

  async listGroupVersions(id: string): Promise<GroupVersionRecord[]> {
    await this.mustGetHead(id);
    return this.store.listGroupVersions(id);
  }

  // -------------------------------------------------------------------------
  // Validation (§5.2): tier-1 always; tier-2 against the live schema when a
  // connection is available.
  // -------------------------------------------------------------------------

  async validateGroup(draftOrId: GroupDefinitionInput | string): Promise<TieredValidationResult> {
    const registry = this.requireRegistry();
    const input =
      typeof draftOrId === 'string' ? (await this.mustGetHead(draftOrId)).draft : draftOrId;
    const { result, definition } = validateGroupDefinition(input, registry);
    const out: TieredValidationResult = { ...result, schematic: 'skipped-no-connection' };
    if (!definition) return out;

    const entity = registry.entity(definition.entity);
    if (!entity?.table || entity.connectionRef === undefined || !this.connections.has(entity.connectionRef)) {
      return out;
    }
    try {
      const { client, dialect } = await this.connections.resolve(entity.connectionRef);
      const q = dialect.columnsQuery(entity.table.schema, entity.table.name);
      const res = await client.query(q.text, q.params);
      const live = new Set(
        res.rows
          .map((r) => r['name'] ?? r['column_name'] ?? r['COLUMN_NAME'])
          .filter((v): v is string => typeof v === 'string')
          .map((v) => v.toLowerCase()),
      );
      const touched = new Set<string>(scopeFields(definition.scope));
      for (const f of definition.filters) filterFields(f, touched);
      for (const rule of definition.rules) {
        filterFields(rule.when, touched);
        for (const action of rule.then) {
          if (action.verb === 'effect') continue; // target entity checked by its own binding
          touched.add(action.field);
          if (action.verb === 'assert') filterFields(action.check, touched);
        }
      }
      for (const fieldId of [...touched].sort()) {
        const column = registry.columnFor(definition.entity, fieldId);
        if (column !== undefined && !live.has(column.toLowerCase())) {
          out.errors.push({
            path: 'entity',
            message: `column "${column}" (field "${fieldId}") missing from live table ${entity.table.name}`,
          });
        }
      }
      out.ok = out.errors.length === 0;
      out.schematic = 'ran';
    } catch (err) {
      out.schematic = 'skipped-error';
      out.warnings.push({
        path: 'entity',
        message: `tier-2 introspection failed: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
    return out;
  }

  // -------------------------------------------------------------------------
  // Evaluation (§4, §7)
  // -------------------------------------------------------------------------

  async applicable(
    entity: string,
    props: Record<string, unknown>,
    opts: EvaluateApiOptions = {},
  ): Promise<ApplicableGroup[]> {
    const ruleset = await this.ruleset();
    return applicableGroups(ruleset, entity, props, this.asOf(opts));
  }

  async explain(
    entity: string,
    row: Record<string, unknown>,
    opts: EvaluateApiOptions = {},
  ): Promise<EvaluationResult> {
    const ruleset = await this.ruleset();
    const t0 = performance.now();
    const result = evaluateRuleset(ruleset, entity, row, { asOf: this.asOf(opts), mode: 'explain' });
    this.observeEvaluation(result, performance.now() - t0);
    if (this.recordExplains) await this.record(result, row, opts);
    return result;
  }

  async apply(
    entity: string,
    row: Record<string, unknown>,
    opts: EvaluateApiOptions = {},
  ): Promise<EvaluationResult> {
    const ruleset = await this.ruleset();
    const t0 = performance.now();
    const result = evaluateRuleset(ruleset, entity, row, { asOf: this.asOf(opts), mode: 'apply' });
    this.observeEvaluation(result, performance.now() - t0);
    await this.record(result, row, opts);
    void this.store
      .pruneDecisions(this.retention, this.clock.now())
      .catch((err) => this.logger.warn({ err: String(err) }, 'decision pruning failed'));
    return result;
  }

  private observeEvaluation(result: EvaluationResult, durationMs: number): void {
    this.metrics.increment(METRIC.evaluations, { mode: result.mode });
    if (result.assertions.length > 0) {
      this.metrics.increment(METRIC.assertions, {}, result.assertions.length);
    }
    if (result.conflicts.length > 0) {
      this.metrics.increment(METRIC.conflicts, {}, result.conflicts.length);
    }
    this.metrics.observe(METRIC.evalDurationMs, durationMs);
  }

  /** Best-effort telemetry: must never fail (or delay) a committed operation. */
  private async refreshGroupGauges(heads?: GroupHead[]): Promise<void> {
    try {
      const list = heads ?? (await this.store.listGroupHeads());
      this.metrics.setGauge(METRIC.activeGroups, list.filter((h) => h.state === 'active').length);
      this.metrics.setGauge(METRIC.brokenGroups, list.filter((h) => h.validity === 'broken').length);
    } catch (err) {
      this.logger.warn({ err: String(err) }, 'group gauge refresh failed');
    }
  }

  // -------------------------------------------------------------------------
  // Rule-domain queries (D6): the engine is the ONLY query path for what it
  // owns. Typed criteria, deliberately not a query DSL.
  // -------------------------------------------------------------------------

  async queryGroups(criteria: GroupQueryCriteria = {}): Promise<{ groups: GroupHead[]; total: number }> {
    const registry = this.requireRegistry();
    const filter: GroupHeadFilter = {};
    if (criteria.entity !== undefined) filter.entity = criteria.entity;
    if (criteria.state !== undefined) filter.state = criteria.state;
    let heads = await this.store.listGroupHeads(filter);

    if (criteria.validity !== undefined) {
      heads = heads.filter((h) => h.validity === criteria.validity);
    }
    if (criteria.expiringBefore !== undefined) {
      const cutoff = Date.parse(criteria.expiringBefore);
      heads = heads.filter(
        (h) => h.draft.effectiveTo !== undefined && Date.parse(h.draft.effectiveTo) < cutoff,
      );
    }

    // Definition-inspecting criteria look at the draft AND the active
    // snapshot — an edited lineage must not hide what is still evaluating.
    if (
      criteria.touchesField !== undefined ||
      criteria.scopeValue !== undefined ||
      criteria.text !== undefined
    ) {
      const matched: GroupHead[] = [];
      for (const head of heads) {
        const defs = [head.draft];
        if (head.activeVersion !== null) {
          const active = await this.store.getGroupVersion(head.id, head.activeVersion);
          if (active) defs.push(active.definition);
        }
        const hit = defs.some((def) => {
          if (criteria.touchesField !== undefined && !touchedFields(def).has(criteria.touchesField)) {
            return false;
          }
          if (
            criteria.scopeValue !== undefined &&
            !scopeAccepts(def.scope, criteria.scopeValue.field, criteria.scopeValue.value, registry)
          ) {
            return false;
          }
          if (criteria.text !== undefined && !definitionMatchesText(def, criteria.text)) {
            return false;
          }
          return true;
        });
        if (hit) matched.push(head);
      }
      heads = matched;
    }

    const total = heads.length;
    const offset = criteria.offset ?? 0;
    const limit = Math.min(criteria.limit ?? 100, 500);
    return { groups: heads.slice(offset, offset + limit), total };
  }

  /**
   * Consistency tier (§5.2): pairwise overlap analysis across active groups —
   * plus a draft, when given — reporting pairs that can match the same row
   * and write the same field.
   */
  async consistency(draftOrId?: GroupDefinitionInput | string): Promise<ConsistencyFinding[]> {
    const registry = this.requireRegistry();
    const groups: AnalyzableGroup[] = [];
    for (const head of await this.store.listGroupHeads()) {
      if (head.activeVersion === null) continue;
      const snapshot = await this.store.getGroupVersion(head.id, head.activeVersion);
      if (snapshot) groups.push({ groupId: head.id, name: head.name, definition: snapshot.definition });
    }
    if (draftOrId !== undefined) {
      const input =
        typeof draftOrId === 'string' ? (await this.mustGetHead(draftOrId)).draft : draftOrId;
      const { result, definition } = validateGroupDefinition(input, registry);
      if (!definition) {
        throw new ConfigInvalidError('draft failed to parse', issueStrings(result.errors));
      }
      const draftId = typeof draftOrId === 'string' ? draftOrId : 'draft';
      groups.push({
        groupId: draftId,
        name: definition.name,
        definition,
      });
      return findOverlappingWrites(groups, registry).filter((f) =>
        f.groups.some((g) => g.groupId === draftId),
      );
    }
    return findOverlappingWrites(groups, registry);
  }

  /**
   * Backtest (§5.3): evaluate a draft against real rows from the host DB —
   * read-only — and report what it would have done. The flagship authoring
   * feature: evidence before activation.
   */
  async backtest(
    draftOrId: GroupDefinitionInput | string,
    opts: BacktestOptions = {},
  ): Promise<BacktestReport> {
    const registry = this.requireRegistry();
    const input =
      typeof draftOrId === 'string' ? (await this.mustGetHead(draftOrId)).draft : draftOrId;
    const { result, definition } = validateGroupDefinition(input, registry);
    if (!result.ok || !definition) {
      throw new ConfigInvalidError('backtest requires a tier-1-valid draft', issueStrings(result.errors));
    }
    const entity = registry.entity(definition.entity);
    if (!entity?.table || entity.connectionRef === undefined || !this.connections.has(entity.connectionRef)) {
      throw new ConfigInvalidError(
        `backtest needs entity "${definition.entity}" bound to a table and a registered connection`,
      );
    }
    const asOf = this.asOf(opts.asOf !== undefined ? { asOf: opts.asOf } : {});
    const sample = Math.min(opts.sample ?? BACKTEST_SAMPLE_DEFAULT, BACKTEST_SAMPLE_MAX);

    const { client, dialect } = await this.connections.resolve(entity.connectionRef);
    const q = buildSampleSelect(definition.entity, registry, dialect, sample);
    const { rows } = await client.query(q.text, q.params);

    const draftGroupId = typeof draftOrId === 'string' ? draftOrId : 'draft';
    const draftRuleset = new CompiledRuleset(registry, 0, [
      {
        groupId: draftGroupId,
        version: 0,
        definition,
        registryVersion: registry.version,
        createdAt: this.now(),
      },
    ]);

    const report: BacktestReport = {
      entity: definition.entity,
      asOf,
      rowsSampled: rows.length,
      matched: 0,
      rowsWithFiredRules: 0,
      violations: 0,
      patches: 0,
      effects: 0,
      conflictsWithActive: await this.consistency(input),
      sampleOutcomes: [],
    };
    rows.forEach((row, index) => {
      const verdict = evaluateRuleset(draftRuleset, definition.entity, row, { asOf, mode: 'explain' });
      const outcome = summarizeRow(index, verdict);
      if (outcome.matched) report.matched += 1;
      if (outcome.rulesFired > 0) report.rowsWithFiredRules += 1;
      report.violations += outcome.violations.length;
      report.patches += outcome.patch.length;
      report.effects += outcome.effects;
      if (report.sampleOutcomes.length < BACKTEST_OUTCOMES_CAP) report.sampleOutcomes.push(outcome);
    });
    return report;
  }

  // -------------------------------------------------------------------------
  // Decision log (§2.5, D6)
  // -------------------------------------------------------------------------

  async queryDecisions(query: DecisionQuery = {}): Promise<{ decisions: DecisionRecord[]; total: number }> {
    this.assertInstant('since', query.since);
    this.assertInstant('until', query.until);
    if (query.limit !== undefined && (!Number.isInteger(query.limit) || query.limit < 0)) {
      throw new ConfigInvalidError(`invalid limit: ${String(query.limit)}`);
    }
    if (query.offset !== undefined && (!Number.isInteger(query.offset) || query.offset < 0)) {
      throw new ConfigInvalidError(`invalid offset: ${String(query.offset)}`);
    }
    const limit = Math.min(query.limit ?? 100, 500);
    return this.store.queryDecisions({ ...query, limit });
  }

  async deleteDecisions(filter: DecisionDeleteFilter): Promise<number> {
    if (filter.entity === undefined && filter.before === undefined && (filter.ids?.length ?? 0) === 0) {
      throw new ConfigInvalidError('refusing unfiltered decision deletion — pass entity, before, or ids');
    }
    this.assertInstant('before', filter.before);
    return this.store.deleteDecisions(filter);
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
        verbs: ['assert', 'default', 'set', 'effect'],
        hitPolicies: ['first', 'all', 'unique'],
        operators: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'notIn', 'inSet', 'matches', 'isNull', 'isNotNull', 'and', 'or', 'not'],
        scopeOperators: ['eq', 'in', 'inSet'],
        dialects: knownDialects(),
        modes: ['applicable', 'explain', 'apply'],
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

  private asOf(opts: EvaluateApiOptions): string {
    if (opts.asOf === undefined) return this.now();
    const d = opts.asOf instanceof Date ? opts.asOf : new Date(opts.asOf);
    if (Number.isNaN(d.getTime())) {
      throw new ConfigInvalidError(`invalid asOf instant: ${String(opts.asOf)}`);
    }
    return d.toISOString();
  }

  private assertInstant(name: string, value: string | undefined): void {
    if (value !== undefined && !Number.isFinite(Date.parse(value))) {
      throw new ConfigInvalidError(`invalid ${name} instant: ${value}`);
    }
  }

  private requireRegistry(): CompiledRegistry {
    if (!this.started) throw new ConflictError('engine not started — call start() first');
    if (!this.registryCache) {
      throw new ConfigInvalidError('no registry applied — applyRegistry() before using the engine');
    }
    return this.registryCache;
  }

  private async mustGetHead(id: string): Promise<GroupHead> {
    const head = await this.store.getGroupHead(id);
    if (!head) throw new NotFoundError(`group ${JSON.stringify(id)}`);
    return head;
  }

  private async transition(
    id: string,
    from: GroupState,
    to: GroupState,
    event: EngineEventType,
    opts: ActorOptions,
  ): Promise<GroupHead> {
    const head = await this.mustGetHead(id);
    if (head.state !== from) {
      throw new ConflictError(`cannot ${event.split('.')[1]} a ${head.state} group (requires ${from})`);
    }
    const at = this.now();
    head.state = to;
    const transition: GroupTransition = { to, actor: opts.actor, at };
    if (opts.reason !== undefined) transition.reason = opts.reason;
    head.transitions.push(transition);
    head.updatedAt = at;
    await this.store.putGroupHead(head);
    await this.fire({ type: event, at, groupId: id, actor: opts.actor });
    return head;
  }

  /** Rebuild the compiled ruleset when stale; cache key is the version pair. */
  private async ruleset(): Promise<CompiledRuleset> {
    const registry = this.requireRegistry();
    const version = await this.store.currentRulesetVersion();
    if (this.compiled && this.compiled.rulesetVersion === version && this.compiled.registry === registry) {
      return this.compiled;
    }
    const active: ActiveGroupInput[] = [];
    for (const head of await this.store.listGroupHeads()) {
      if (head.activeVersion === null) continue;
      const snapshot = await this.store.getGroupVersion(head.id, head.activeVersion);
      if (!snapshot) continue;
      active.push({
        groupId: head.id,
        version: snapshot.version,
        definition: snapshot.definition,
        registryVersion: snapshot.registryVersion,
        createdAt: head.createdAt,
      });
    }
    this.compiled = new CompiledRuleset(registry, version, active);
    return this.compiled;
  }

  private async record(
    result: EvaluationResult,
    row: Record<string, unknown>,
    opts: EvaluateApiOptions,
  ): Promise<void> {
    const rawId = opts.entityId ?? (row['id'] !== null && row['id'] !== undefined ? String(row['id']) : null);
    const record: DecisionRecord = {
      id: uuidv7(this.clock.now().getTime()),
      entity: result.entity,
      entityId: rawId,
      asOf: result.asOf,
      rulesetVersion: result.rulesetVersion,
      mode: result.mode,
      matched: result.trace
        .filter((t) => t.skipped === undefined)
        .map((t) => ({ groupId: t.groupId, version: t.version })),
      counts: {
        groupsConsidered: result.trace.length,
        groupsMatched: result.trace.filter((t) => t.skipped === undefined).length,
        rulesFired: result.trace.reduce((n, t) => n + t.rules.filter((r) => r.fired).length, 0),
        assertions: result.assertions.length,
        patched: result.patch.length,
        effects: result.effects.length,
        conflicts: result.conflicts.length,
      },
      result,
      createdAt: this.now(),
    };
    await this.store.appendDecision(record);
  }

  private async fire(event: EngineEvent): Promise<void> {
    this.metrics.increment(METRIC.transitions, { event: event.type });
    try {
      await this.hooks.onEvent?.(event);
    } catch (err) {
      this.logger.warn({ type: event.type, err: String(err) }, 'onEvent hook failed');
      try {
        const ctx: { op: string; groupId?: string } = { op: event.type };
        if (event.groupId !== undefined) ctx.groupId = event.groupId;
        await this.hooks.onError?.(err, ctx);
      } catch {
        // onError failing is not our problem twice.
      }
    }
  }
}
