import { validateMetricDefinition } from '../config/validate.js';
import { ConfigInvalidError, ConflictError, NotFoundError } from '../domain/errors.js';
import type { CompiledRegistry } from '../domain/registry.js';
import { fireEvent, type EngineHooks } from '../ports/hooks.js';
import { jsonConsoleLogger, type Logger } from '../ports/logger.js';
import type {
  DefinitionRecord,
  DefinitionState,
  DefinitionVersionRecord,
  MetricsStateStore,
  ValidationStatus,
} from '../ports/statestore.js';

/**
 * The definition lifecycle — the rules engine's group state machine, ported:
 *
 *   draft --submit--> pending --activate--> active --retire--> retired
 *                        |
 *                     reject
 *                        v
 *                      draft
 *
 * plus draft-edit-while-active (saveDefinitionDraft moves an ACTIVE lineage
 * back to draft while the activated version keeps evaluating — the stores
 * own that rule, see MetricsStateStore.saveDefinitionDraft). Every transition
 * requires a non-empty actor and is appended to the head's transition log.
 *
 * Activation is the trust gate: tier-1 is RE-RUN against the current registry
 * and calendars — the stored validationStatus is a dashboard hint, never an
 * authorization — and success snapshots the doc as an immutable version row
 * pinning registryVersion (and the calendar name+version when referenced).
 *
 * These are free functions over the store; the M5 engine facade wraps them.
 * No wall-clock reads on the event path: `now` defaults like the store
 * methods do, and every emitted event carries it as occurredAtIso.
 */

export interface LifecycleOptions {
  /** Who did it — required and non-empty for every transition. */
  actor: string;
  reason?: string;
  /** The transition instant (ISO); defaults to the wall clock like the stores. */
  now?: string;
  hooks?: EngineHooks;
  logger?: Logger;
}

function requireActor(actor: string): string {
  if (typeof actor !== 'string' || actor.trim() === '') {
    throw new ConfigInvalidError('lifecycle transitions require a non-empty actor');
  }
  return actor;
}

function nowOf(opts: LifecycleOptions): string {
  return opts.now ?? new Date().toISOString();
}

function loggerOf(opts: LifecycleOptions): Logger {
  return opts.logger ?? jsonConsoleLogger;
}

async function mustGetHead(store: MetricsStateStore, name: string): Promise<DefinitionRecord> {
  const head = await store.getDefinition(name);
  if (!head) throw new NotFoundError(`definition ${JSON.stringify(name)}`);
  return head;
}

async function transition(
  store: MetricsStateStore,
  name: string,
  from: DefinitionState,
  to: DefinitionState,
  verb: string,
  opts: LifecycleOptions,
): Promise<DefinitionRecord> {
  const actor = requireActor(opts.actor);
  const head = await mustGetHead(store, name);
  if (head.state !== from) {
    throw new ConflictError(`cannot ${verb} a ${head.state} definition (requires ${from})`);
  }
  const at = nowOf(opts);
  head.state = to;
  head.transitions.push({ to, actor, at, ...(opts.reason !== undefined ? { reason: opts.reason } : {}) });
  head.updatedAt = at;
  await store.putDefinitionHead(head);
  return head;
}

/** draft → pending: hand the working draft to whoever approves activations. */
export async function submitDefinition(
  store: MetricsStateStore,
  name: string,
  opts: LifecycleOptions,
): Promise<DefinitionRecord> {
  const head = await transition(store, name, 'draft', 'pending', 'submit', opts);
  await fireEvent(opts.hooks, loggerOf(opts), {
    type: 'definition.submitted',
    metric: name,
    actor: opts.actor,
    occurredAtIso: head.updatedAt,
    ...(opts.reason !== undefined ? { reason: opts.reason } : {}),
  });
  return head;
}

/** pending → draft: send it back for another editing round. */
export async function rejectDefinition(
  store: MetricsStateStore,
  name: string,
  opts: LifecycleOptions,
): Promise<DefinitionRecord> {
  const head = await transition(store, name, 'pending', 'draft', 'reject', opts);
  await fireEvent(opts.hooks, loggerOf(opts), {
    type: 'definition.rejected',
    metric: name,
    actor: opts.actor,
    occurredAtIso: head.updatedAt,
    ...(opts.reason !== undefined ? { reason: opts.reason } : {}),
  });
  return head;
}

/**
 * pending → active. Gate: tier-1 must be clean against the CURRENT registry
 * and the store's calendars — re-run here, never trusted from the stored
 * validationStatus — otherwise a ConfigInvalidError lists every issue.
 *
 * Success appends an immutable version row (per-definition versionNo
 * increment; pinned registryVersion; pinned calendar name+version when the
 * definition references one) and points the head at it. Exactly one version
 * is active per definition: activating a new one moves the head's pointer —
 * old version rows are never touched.
 */
export async function activateDefinition(
  store: MetricsStateStore,
  name: string,
  registry: CompiledRegistry,
  opts: LifecycleOptions,
): Promise<{ head: DefinitionRecord; version: DefinitionVersionRecord }> {
  const actor = requireActor(opts.actor);
  const head = await mustGetHead(store, name);
  if (head.state !== 'pending') {
    throw new ConflictError(`cannot activate a ${head.state} definition — submit it first`);
  }

  const calendars = await store.listCalendars();
  const issues = validateMetricDefinition(head.doc, registry, calendars);
  if (issues.length > 0) {
    throw new ConfigInvalidError(
      `activation of "${name}" blocked by tier-1 validation (${issues.length} issue${issues.length === 1 ? '' : 's'})`,
      issues.map((i) => `${i.path}: ${i.message}`),
    );
  }

  const at = nowOf(opts);
  const calendarRecord =
    head.doc.calendarRef !== undefined ? calendars.find((c) => c.name === head.doc.calendarRef) : undefined;
  // The STORE assigns versionNo (MAX over the existing rows + 1, atomically
  // with the insert) — deriving it from the head's counter would brick the
  // lineage after a crash between appendVersion and putDefinitionHead.
  const version = await store.appendVersion({
    metric: name,
    doc: head.doc,
    registryVersion: registry.version,
    ...(calendarRecord !== undefined
      ? { calendarName: calendarRecord.name, calendarVersion: calendarRecord.version }
      : {}),
    activatedAt: at,
    actor,
  });

  head.state = 'active';
  head.latestVersion = version.versionNo;
  head.activeVersion = version.versionNo;
  head.validationStatus = 'valid';
  head.transitions.push({ to: 'active', actor, at, ...(opts.reason !== undefined ? { reason: opts.reason } : {}) });
  head.updatedAt = at;
  await store.putDefinitionHead(head);

  await fireEvent(opts.hooks, loggerOf(opts), {
    type: 'definition.activated',
    metric: name,
    versionNo: version.versionNo,
    actor,
    occurredAtIso: at,
    ...(opts.reason !== undefined ? { reason: opts.reason } : {}),
  });
  return { head, version };
}

/**
 * active → retired: the head stops pointing at any version (rollups stop),
 * but every version row stays — point-in-time getVersion works forever.
 */
export async function retireDefinition(
  store: MetricsStateStore,
  name: string,
  opts: LifecycleOptions,
): Promise<DefinitionRecord> {
  const actor = requireActor(opts.actor);
  const head = await mustGetHead(store, name);
  if (head.state !== 'active') {
    throw new ConflictError(`cannot retire a ${head.state} definition (requires active)`);
  }
  const at = nowOf(opts);
  const retiredVersion = head.activeVersion;
  head.state = 'retired';
  head.activeVersion = null;
  head.transitions.push({ to: 'retired', actor, at, ...(opts.reason !== undefined ? { reason: opts.reason } : {}) });
  head.updatedAt = at;
  await store.putDefinitionHead(head);

  await fireEvent(opts.hooks, loggerOf(opts), {
    type: 'definition.retired',
    metric: name,
    versionNo: retiredVersion,
    actor,
    occurredAtIso: at,
    ...(opts.reason !== undefined ? { reason: opts.reason } : {}),
  });
  return head;
}

// ---------------------------------------------------------------------------
// Revalidation sweep
// ---------------------------------------------------------------------------

/** Worst-of ordering, the rules engine's VALIDITY_RANK verbatim. */
const STATUS_RANK: Record<ValidationStatus, number> = {
  valid: 0,
  unchecked: 1,
  degraded: 2,
  broken: 3,
};

/** The worse of two verdicts — shared with the facade's draft-save stamping. */
export function worseOf(a: ValidationStatus, b: ValidationStatus): ValidationStatus {
  return STATUS_RANK[a] >= STATUS_RANK[b] ? a : b;
}

export interface SweepInput {
  store: MetricsStateStore;
  registry: CompiledRegistry;
  /** The known calendars — tier-1 resolves calendarRef against these names. */
  calendars: ReadonlyArray<{ name: string }>;
  /** Sweep instant (updatedAt on re-marked heads, occurredAtIso on the event). */
  now?: string;
  hooks?: EngineHooks;
  logger?: Logger;
}

export interface SweepEntry {
  metric: string;
  validationStatus: ValidationStatus;
}

/**
 * Re-run tier-1 for every NON-RETIRED definition head against the given
 * registry + calendars and persist the verdict on each head. Like the rules
 * engine's sweep, the head's doc AND the active version's pinned doc are both
 * checked (an edited lineage must not hide that what is still computing
 * broke) and the worse verdict wins. Broken definitions stay visible and
 * loud, never silently skipped: their active versions keep materializing
 * (the pinned snapshot is intact) while dashboards show `broken`.
 *
 * Deliberately NOT wired into registry/calendar upserts here — the M5 engine
 * facade calls this after every applyRegistry/upsertCalendar, exactly like
 * the rules engine does.
 */
export async function revalidationSweep(input: SweepInput): Promise<SweepEntry[]> {
  const { store, registry, calendars } = input;
  const now = input.now ?? new Date().toISOString();
  const logger = input.logger ?? jsonConsoleLogger;

  const out: SweepEntry[] = [];
  for (const head of await store.listDefinitions()) {
    if (head.state === 'retired') continue;
    let status: ValidationStatus =
      validateMetricDefinition(head.doc, registry, calendars).length > 0 ? 'broken' : 'valid';
    if (head.activeVersion !== null) {
      const active = await store.getVersion(head.name, head.activeVersion);
      if (active) {
        status = worseOf(
          status,
          validateMetricDefinition(active.doc, registry, calendars).length > 0 ? 'broken' : 'valid',
        );
      }
    }
    if (status !== head.validationStatus) {
      // CAS on updatedAt: the sweep works from a snapshot, and a transition
      // that landed in between (say a retire) must never be overwritten by
      // this stale head — skip and log instead.
      const written = await store.setValidationStatus(head.name, status, head.updatedAt, now);
      if (!written) {
        logger.warn(
          { metric: head.name, validationStatus: status },
          'revalidation sweep verdict not persisted — the head changed mid-sweep',
        );
      }
    }
    out.push({ metric: head.name, validationStatus: status });
  }

  await fireEvent(input.hooks, logger, {
    type: 'sweep.completed',
    occurredAtIso: now,
    checked: out.length,
    results: out,
  });
  return out;
}
