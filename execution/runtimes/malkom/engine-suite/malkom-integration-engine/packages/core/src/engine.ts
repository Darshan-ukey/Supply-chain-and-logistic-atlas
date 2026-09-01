import { randomUUID } from 'node:crypto';
import type { IntegrateStateStore } from './store.js';
import { InMemoryIntegrateStateStore } from './store.js';
import { executeCustomOperation, pickPath } from './custom-http.js';
import { connectorById, validateConfig, type ConnectorDescriptor } from './registry.js';
import {
  bindingSchema,
  configBundleSchema,
  connectionSchema,
  connectorForFormat,
  legacyConfigFor,
  customConnectorDefSchema,
  executeRequestSchema,
  type BindingDefinition,
  type BindingDefinitionInput,
  type ConnectionDefinition,
  type ConnectionDefinitionInput,
  type ConnectionRecord,
  type ConnectionStatus,
  type CustomConnectorDefInput,
  type ExecuteRequest,
  type ExecuteResult,
  type RunRecord,
  type TestResult,
} from './schemas.js';

/**
 * Engine facade — every operation the control plane and the runtime call,
 * as a typed library API. The engine owns execution and the run ledger;
 * the host owns payloads, scheduling and credential values.
 *
 * Secret references resolve through a host-provided resolver:
 *   env:VAR    — process environment (default resolver handles this)
 *   vault:key  — host vault (the host must supply a resolver)
 * Adapter-executed connectors (cloud SDKs) run through host-registered
 * adapters; without one they test DEGRADED and execute FAILED, loudly.
 */

export type SecretResolver = (reference: string) => Promise<string>;
/** Writes a secret back to wherever the host keeps it. */
export type SecretWriter = (reference: string, value: string) => Promise<void>;

export const envSecretResolver: SecretResolver = (reference) => {
  if (reference.startsWith('env:')) return Promise.resolve(process.env[reference.slice(4)] ?? '');
  return Promise.resolve('');
};

export interface AdapterContext {
  descriptor: ConnectorDescriptor;
  config: Record<string, unknown>;
  secrets: Record<string, string>;
  /**
   * Store a rotated secret back where it came from. Present only when the
   * host supplied a way to write; an adapter that needs to refresh a
   * credential must cope with its absence rather than assume it can.
   */
  saveSecret?: (slot: string, value: string) => Promise<void>;
}

export interface AdapterOutcome {
  ok: boolean;
  detail: string;
  result?: unknown;
}

export interface ConnectorAdapter {
  test?(context: AdapterContext): Promise<AdapterOutcome>;
  execute?(context: AdapterContext, request: ExecuteRequest): Promise<AdapterOutcome>;
}

export interface IntegrationEngineOptions {
  stateStore?: IntegrateStateStore;
  resolveSecret?: SecretResolver;
  /** Persist a secret by its reference. Without it, rotation is read-only. */
  persistSecret?: SecretWriter;
  fetchImpl?: typeof fetch;
  retention?: { maxAgeMs: number; maxCount: number };
  clock?: () => Date;
}

/** Apply a binding's declarative field mapping to a payload. */
export const applyMapping = (
  mapping: BindingDefinition['mapping'],
  payload: Record<string, unknown>,
): Record<string, unknown> => {
  if (mapping.length === 0) return payload;
  const mapped: Record<string, unknown> = {};
  for (const rule of mapping) {
    const raw = rule.constant !== undefined ? rule.constant : pickPath(payload, rule.from);
    if (raw === undefined) continue;
    let coerced: unknown = raw;
    if (rule.coerce === 'number') coerced = Number(raw);
    else if (rule.coerce === 'boolean') coerced = raw === true || raw === 'true' || raw === '1';
    else if (rule.coerce === 'string') coerced = String(raw as string | number | boolean);
    else if (rule.coerce === 'date') coerced = new Date(String(raw as string | number)).toISOString();
    mapped[rule.to] = coerced;
  }
  return mapped;
};

/** Fields whose value is a plausible ping URL, in preference order. */
const PING_KEYS = ['endpoint', 'issuer', 'vaultUrl', 'baseUrl'] as const;

export class IntegrationEngine {
  private readonly store: IntegrateStateStore;
  private readonly resolveSecret: SecretResolver;
  private readonly persistSecret: SecretWriter | null;
  private readonly fetchImpl: typeof fetch;
  private readonly retention: { maxAgeMs: number; maxCount: number };
  private readonly clock: () => Date;
  private readonly adapters = new Map<string, ConnectorAdapter>();

  constructor(options: IntegrationEngineOptions = {}) {
    this.store = options.stateStore ?? new InMemoryIntegrateStateStore();
    this.resolveSecret = options.resolveSecret ?? envSecretResolver;
    this.persistSecret = options.persistSecret ?? null;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.retention = options.retention ?? { maxAgeMs: 90 * 24 * 60 * 60 * 1000, maxCount: 50_000 };
    this.clock = options.clock ?? (() => new Date());
  }

  /** Host registers an adapter for an adapter-executed connector. */
  registerAdapter(connectorId: string, adapter: ConnectorAdapter): void {
    this.adapters.set(connectorId, adapter);
  }

  /* ---------------- connections ---------------- */

  upsertConnection(input: ConnectionDefinitionInput): { id: string; version: number } {
    const definition = connectionSchema.parse(input);
    const descriptor = connectorById(definition.connectorId);
    if (descriptor === undefined) throw new EngineValidationError(`unknown connector ${definition.connectorId}`);
    const check = validateConfig(descriptor, definition.config);
    if (!check.ok) throw new EngineValidationError(check.errors.join('; '));
    const existing = this.store.getConnection(definition.id);
    const record: ConnectionRecord = {
      definition: { ...definition, config: check.value },
      version: (existing?.version ?? 0) + 1,
      status: existing?.status ?? 'UNTESTED',
      lastTestedAt: existing?.lastTestedAt ?? null,
      lastError: existing?.lastError ?? null,
      updatedAt: this.clock().toISOString(),
    };
    this.store.putConnection(record);
    return { id: definition.id, version: record.version };
  }

  getConnection(id: string): ConnectionRecord | null {
    return this.store.getConnection(id);
  }

  listConnections(): ConnectionRecord[] {
    return this.store.listConnections();
  }

  deleteConnection(id: string): void {
    const bound = this.store.listBindings(id);
    if (bound.length > 0) {
      throw new EngineConflictError(
        `connection ${id} has ${bound.length} binding(s): ${bound.map((record) => record.definition.id).join(', ')}`,
      );
    }
    this.store.deleteConnection(id);
  }

  /* ---------------- bindings ---------------- */

  upsertBinding(input: BindingDefinitionInput): { id: string; version: number } {
    const definition = bindingSchema.parse(input);
    if (this.store.getConnection(definition.connectionId) === null) {
      throw new EngineNotFoundError(`connection ${definition.connectionId} not found`);
    }
    const existing = this.store.getBinding(definition.id);
    const record = { definition, version: (existing?.version ?? 0) + 1, updatedAt: this.clock().toISOString() };
    this.store.putBinding(record);
    return { id: definition.id, version: record.version };
  }

  listBindings(connectionId: string | null): ReturnType<IntegrateStateStore['listBindings']> {
    return this.store.listBindings(connectionId);
  }

  deleteBinding(id: string): void {
    this.store.deleteBinding(id);
  }

  /* ---------------- custom connector definitions ---------------- */

  upsertCustomDef(input: CustomConnectorDefInput): { id: string; version: number } {
    const definition = customConnectorDefSchema.parse(input);
    const existing = this.store.getCustomDef(definition.id);
    const record = { definition, version: (existing?.version ?? 0) + 1, updatedAt: this.clock().toISOString() };
    this.store.putCustomDef(record);
    return { id: definition.id, version: record.version };
  }

  listCustomDefs(): ReturnType<IntegrateStateStore['listCustomDefs']> {
    return this.store.listCustomDefs();
  }

  deleteCustomDef(id: string): void {
    this.store.deleteCustomDef(id);
  }

  /* ---------------- secrets ---------------- */

  private async resolveSecrets(definition: ConnectionDefinition): Promise<Record<string, string>> {
    const secrets: Record<string, string> = {};
    for (const [slot, reference] of Object.entries(definition.secretRefs)) {
      secrets[slot] = await this.resolveSecret(reference);
    }
    return secrets;
  }

  /**
   * A writer bound to one connection: an adapter names a slot, and the
   * connection's own reference decides where that value is stored. An
   * adapter never learns where secrets live.
   */
  private secretWriterFor(definition: ConnectionDefinition): ((slot: string, value: string) => Promise<void>) | undefined {
    const persist = this.persistSecret;
    if (persist === null) return undefined;
    return async (slot: string, value: string): Promise<void> => {
      const reference = definition.secretRefs[slot];
      if (reference === undefined || reference === '') {
        throw new EngineValidationError(`no secret reference configured for slot ${slot}`);
      }
      await persist(reference, value);
    };
  }

  /* ---------------- test / verify ---------------- */

  async testConnection(id: string): Promise<TestResult> {
    const record = this.store.getConnection(id);
    if (record === null) throw new EngineNotFoundError(`connection ${id} not found`);
    const descriptor = connectorById(record.definition.connectorId);
    if (descriptor === undefined) throw new EngineValidationError(`unknown connector ${record.definition.connectorId}`);

    let status: ConnectionStatus;
    let detail: string;
    try {
      const secrets = await this.resolveSecrets(record.definition);
      const outcome = await this.runTest(descriptor, record.definition, secrets);
      status = outcome.status;
      detail = outcome.detail;
    } catch (error) {
      status = 'FAILED';
      detail = (error as Error).message.slice(0, 300);
    }

    const testedAt = this.clock().toISOString();
    this.store.putConnection({
      ...record,
      status,
      lastTestedAt: testedAt,
      lastError: status === 'HEALTHY' ? null : detail,
      updatedAt: testedAt,
    });
    this.recordRun(id, null, 'TEST', `test-${testedAt}`, status === 'HEALTHY' ? 'OK' : 'FAILED', detail, null, 1);
    return { status, detail, testedAt };
  }

  private async runTest(
    descriptor: ConnectorDescriptor,
    definition: ConnectionDefinition,
    secrets: Record<string, string>,
  ): Promise<{ status: ConnectionStatus; detail: string }> {
    if (descriptor.test === 'config-only') {
      const missing = descriptor.secretSlots.filter(
        (slot) => definition.secretRefs[slot] !== undefined && secrets[slot] === '',
      );
      return missing.length > 0
        ? { status: 'DEGRADED', detail: `secret reference(s) resolved empty: ${missing.join(', ')}` }
        : { status: 'HEALTHY', detail: 'configuration valid' };
    }
    if (descriptor.test === 'http-ping') {
      const target = this.pingUrl(definition.config, secrets);
      if (target === null) return { status: 'FAILED', detail: 'no endpoint configured to ping' };
      try {
        const response = await this.fetchImpl(target, { method: 'GET', signal: AbortSignal.timeout(10_000) });
        return response.status < 500
          ? { status: 'HEALTHY', detail: `reachable — HTTP ${response.status}` }
          : { status: 'DEGRADED', detail: `HTTP ${response.status}` };
      } catch (error) {
        return { status: 'FAILED', detail: (error as Error).message.slice(0, 200) };
      }
    }
    if (descriptor.test === 'custom-op') {
      const defId = String(definition.config['customDefId'] ?? '');
      const def = this.store.getCustomDef(defId);
      if (def === null) return { status: 'FAILED', detail: `custom definition ${defId} not found` };
      const testOp = def.definition.operations.find((operation) => operation.isTest) ?? def.definition.operations[0];
      if (testOp === undefined) return { status: 'FAILED', detail: 'definition has no operations' };
      const outcome = await executeCustomOperation(def.definition, testOp.key, {}, secrets['secret'] ?? '', this.fetchImpl);
      return outcome.ok ? { status: 'HEALTHY', detail: outcome.detail } : { status: 'FAILED', detail: outcome.detail };
    }
    // adapter
    const adapter = this.adapters.get(descriptor.id);
    if (adapter?.test === undefined) {
      return { status: 'DEGRADED', detail: `no ${descriptor.id} adapter registered — deploy the runtime adapter to test live` };
    }
    const writer = this.secretWriterFor(definition);
    const outcome = await adapter.test({
      descriptor, config: definition.config, secrets,
      ...(writer === undefined ? {} : { saveSecret: writer }),
    });
    return outcome.ok ? { status: 'HEALTHY', detail: outcome.detail } : { status: 'FAILED', detail: outcome.detail };
  }

  private pingUrl(config: Record<string, unknown>, secrets: Record<string, string>): string | null {
    for (const key of PING_KEYS) {
      const value = config[key];
      if (typeof value === 'string' && value.startsWith('http')) return value;
    }
    const webhook = secrets['webhookUrl'];
    if (webhook !== undefined && webhook.startsWith('http')) return webhook;
    return null;
  }

  /* ---------------- execute ---------------- */

  async execute(connectionId: string, input: unknown): Promise<ExecuteResult> {
    const request = executeRequestSchema.parse(input);
    const record = this.store.getConnection(connectionId);
    if (record === null) throw new EngineNotFoundError(`connection ${connectionId} not found`);
    if (!record.definition.enabled) throw new EngineConflictError(`connection ${connectionId} is disabled`);
    const descriptor = connectorById(record.definition.connectorId);
    if (descriptor === undefined) throw new EngineValidationError(`unknown connector ${record.definition.connectorId}`);

    let config = record.definition.config;
    let payload = request.payload;
    let bindingId: string | null = null;
    if (request.bindingId !== undefined) {
      const binding = this.store.getBinding(request.bindingId);
      if (binding === null) throw new EngineNotFoundError(`binding ${request.bindingId} not found`);
      if (!binding.definition.enabled) throw new EngineConflictError(`binding ${request.bindingId} is disabled`);
      bindingId = binding.definition.id;
      config = { ...config, ...binding.definition.config };
      payload = applyMapping(binding.definition.mapping, payload);
    }

    const attempt = this.store.countAttempts(connectionId, request.itemId) + 1;
    const secrets = await this.resolveSecrets(record.definition);
    const writer = this.secretWriterFor(record.definition);
    const outcome = await this.runExecution(descriptor, config, secrets, { ...request, payload }, writer);

    const status = outcome.status;
    const storedPayload = status === 'OK' ? null : payload;
    const runId = this.recordRun(connectionId, bindingId, status === 'PREPARED' ? 'DELIVER' : 'EXECUTE', request.itemId, status, outcome.detail, storedPayload, attempt);
    this.store.pruneRuns(this.retention.maxAgeMs, this.retention.maxCount);
    return { runId, status, detail: outcome.detail, connectionVersion: record.version, result: outcome.result };
  }

  private async runExecution(
    descriptor: ConnectorDescriptor,
    config: Record<string, unknown>,
    secrets: Record<string, string>,
    request: ExecuteRequest,
    saveSecret?: (slot: string, value: string) => Promise<void>,
  ): Promise<{ status: RunRecord['status']; detail: string; result: unknown }> {
    if (descriptor.execution === 'staged' || descriptor.execution === 'none') {
      return {
        status: 'PREPARED',
        detail: `${descriptor.id} payload staged for host transport`,
        result: null,
      };
    }
    if (descriptor.execution === 'http') {
      return this.httpExecute(descriptor, config, secrets, request);
    }
    if (descriptor.execution === 'custom') {
      const defId = String(config['customDefId'] ?? '');
      const def = this.store.getCustomDef(defId);
      if (def === null) return { status: 'FAILED', detail: `custom definition ${defId} not found`, result: null };
      const operationKey =
        request.operation ?? def.definition.operations.find((operation) => operation.direction === 'write')?.key ?? '';
      const outcome = await executeCustomOperation(def.definition, operationKey, request.payload, secrets['secret'] ?? '', this.fetchImpl);
      return { status: outcome.ok ? 'OK' : 'FAILED', detail: outcome.detail, result: outcome.result };
    }
    // adapter
    const adapter = this.adapters.get(descriptor.id);
    if (adapter?.execute === undefined) {
      return { status: 'FAILED', detail: `no ${descriptor.id} adapter registered on this host`, result: null };
    }
    const outcome = await adapter.execute({
      descriptor, config, secrets,
      ...(saveSecret === undefined ? {} : { saveSecret }),
    }, request);
    return { status: outcome.ok ? 'OK' : 'FAILED', detail: outcome.detail, result: outcome.result ?? null };
  }

  /** Native HTTP delivery for http-executed connectors. */
  private async httpExecute(
    descriptor: ConnectorDescriptor,
    config: Record<string, unknown>,
    secrets: Record<string, string>,
    request: ExecuteRequest,
    saveSecret?: (slot: string, value: string) => Promise<void>,
  ): Promise<{ status: RunRecord['status']; detail: string; result: unknown }> {
    const endpoint = this.pingUrl(config, secrets);
    if (endpoint === null) return { status: 'FAILED', detail: 'no endpoint configured', result: null };
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    const token = secrets['authToken'] ?? secrets['botToken'] ?? secrets['accessToken'] ?? secrets['apiToken'] ?? secrets['apiKey'] ?? '';
    if (token !== '') headers['authorization'] = `Bearer ${token}`;
    const timeoutRaw = config['timeoutMs'];
    const timeoutMs = typeof timeoutRaw === 'number' ? timeoutRaw : 15_000;
    const body =
      descriptor.id === 'saas.slack'
        ? JSON.stringify({ text: String(request.payload['text'] ?? JSON.stringify(request.payload)) })
        : JSON.stringify(request.payload);
    try {
      const response = await this.fetchImpl(endpoint, {
        method: 'POST',
        headers,
        body,
        signal: AbortSignal.timeout(timeoutMs),
      });
      return response.ok
        ? { status: 'OK', detail: `HTTP ${response.status}`, result: null }
        : { status: 'FAILED', detail: `HTTP ${response.status}`, result: null };
    } catch (error) {
      return { status: 'FAILED', detail: (error as Error).message.slice(0, 200), result: null };
    }
  }

  /* ---------------- run ledger ---------------- */

  private recordRun(
    connectionId: string,
    bindingId: string | null,
    kind: RunRecord['kind'],
    itemId: string,
    status: RunRecord['status'],
    detail: string,
    payload: Record<string, unknown> | null,
    attempt: number,
  ): string {
    const run: RunRecord = {
      id: randomUUID(),
      connectionId,
      bindingId,
      kind,
      itemId,
      status,
      attempt,
      detail,
      payload,
      createdAt: this.clock().toISOString(),
    };
    this.store.putRun(run);
    return run.id;
  }

  /** Retry a failed run, or re-drive a prepared one, from its stored payload. */
  async redeliver(runId: string): Promise<ExecuteResult> {
    const existing = this.store.getRun(runId);
    if (existing === null) throw new EngineNotFoundError(`run ${runId} not found`);
    if (existing.status === 'OK') throw new EngineConflictError(`run ${runId} already succeeded`);
    if (existing.payload === null) throw new EngineConflictError(`run ${runId} has no stored payload`);
    return this.execute(existing.connectionId, {
      itemId: existing.itemId,
      payload: existing.payload,
      ...(existing.bindingId !== null ? { bindingId: existing.bindingId } : {}),
    });
  }

  /** Host transport collected a PREPARED payload — close it out. */
  collect(runId: string, detail: string): RunRecord {
    const existing = this.store.getRun(runId);
    if (existing === null) throw new EngineNotFoundError(`run ${runId} not found`);
    if (existing.status !== 'PREPARED') throw new EngineConflictError(`run ${runId} is not prepared`);
    const updated: RunRecord = { ...existing, status: 'OK', detail: detail.slice(0, 300), payload: null };
    this.store.putRun(updated);
    return updated;
  }

  runs(connectionId: string | null, status: string | null, limit: number, offset: number): RunRecord[] {
    return this.store.listRuns(connectionId, status, Math.min(limit, 500), offset);
  }

  /* ---------------- config bundle ---------------- */

  /**
   * Apply a configuration bundle.
   *
   * One unusable entry does not discard the rest: a single legacy row with
   * an incomplete endpoint would otherwise leave an organisation with no
   * integration configuration at all. Rejections are returned with their
   * reason so the host can surface exactly what needs fixing — skipped
   * silently would be worse than failing loudly.
   */
  applyConfig(input: unknown): { applied: string[]; rejected: { id: string; reason: string }[] } {
    const bundle = configBundleSchema.parse(input);
    const applied: string[] = [];
    const rejected: { id: string; reason: string }[] = [];

    const attempt = (id: string, label: string, apply: () => void): void => {
      try {
        apply();
        applied.push(label);
      } catch (error) {
        rejected.push({ id, reason: (error as Error).message.slice(0, 300) });
      }
    };

    for (const custom of bundle.customConnectors) {
      attempt(custom.id, `custom:${custom.id}`, () => this.upsertCustomDef(custom));
    }
    // v1 compat: destinations become connections on their format's connector
    for (const destination of bundle.destinations) {
      attempt(destination.id, destination.id, () => this.upsertConnection({
        id: destination.id,
        connectorId: connectorForFormat(destination.format),
        name: destination.name,
        config: legacyConfigFor(destination),
        secretRefs: {},
        enabled: destination.enabled,
      }));
    }
    for (const connection of bundle.connections) {
      attempt(connection.id ?? "connection", connection.id ?? "connection", () => this.upsertConnection(connection));
    }
    for (const binding of bundle.bindings) {
      attempt(binding.id ?? "binding", `binding:${binding.id}`, () => this.upsertBinding(binding));
    }
    return { applied, rejected };
  }

  stop(): void {
    this.store.close();
  }
}

export class EngineNotFoundError extends Error {}
export class EngineConflictError extends Error {}
export class EngineValidationError extends Error {}
