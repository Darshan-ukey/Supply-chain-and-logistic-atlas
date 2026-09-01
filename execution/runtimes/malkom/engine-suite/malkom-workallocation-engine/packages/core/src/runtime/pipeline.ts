import { isAdapterRef, type QueueDefinition } from '../config/schemas.js';
import { AdapterError } from '../domain/errors.js';
import { uuidv7 } from '../domain/ids.js';
import {
  emptyCounts,
  freeCapacity,
  type AllocationRunRecord,
  type Assignment,
  type RunAssignmentRecord,
  type RunTrigger,
  type WorkItem,
  type Worker,
} from '../domain/types.js';
import type { MetricsRegistry } from '../metrics/metrics.js';
import type { BackendAdapter, QueueRuntimeRef } from '../ports/adapter.js';
import type { Clock } from '../ports/clock.js';
import type { Logger } from '../ports/logger.js';
import type { StateStore } from '../ports/statestore.js';
import type { StrategyRegistry } from '../strategies/registry.js';
import { computeEligibility } from './eligibility.js';

export interface EngineHooks {
  onAssigned?(a: { queueId: string; runId: string; itemId: string; workerId: string; reason: string }): void | Promise<void>;
  onRunComplete?(record: AllocationRunRecord): void | Promise<void>;
  onError?(err: unknown, context: { queueId: string; runId?: string }): void | Promise<void>;
}

export interface RunOptions {
  queue: QueueRuntimeRef;
  adapter: BackendAdapter;
  store: StateStore;
  strategies: StrategyRegistry;
  metrics: MetricsRegistry;
  clock: Clock;
  logger: Logger;
  instanceId: string;
  trigger: RunTrigger;
  dryRun: boolean;
  hooks?: EngineHooks | undefined;
  leaseTtlMs?: number | undefined;
  applyChunkSize?: number | undefined;
}

const DEFAULT_LEASE_TTL_MS = 60_000;
const DEFAULT_APPLY_CHUNK = 50;
const DEFAULT_BATCH_LIMIT = 100;
const DEFAULT_OVERSCAN = 2;
const SCHEMA_FAILURES_BEFORE_PAUSE = 3;
const NOTE_CAP = 25;

function batchConfig(def: QueueDefinition): { batchLimit: number; overscan: number } {
  if (!isAdapterRef(def.work)) {
    return { batchLimit: def.work.batchLimit, overscan: def.work.overscanFactor };
  }
  return { batchLimit: DEFAULT_BATCH_LIMIT, overscan: DEFAULT_OVERSCAN };
}

export function pausedKey(queueId: string): string {
  return `paused:${queueId}`;
}

export function leaseKey(queueId: string): string {
  return `lease:queue:${queueId}`;
}

export function strategyStateKey(queueId: string, kind: string): string {
  return `strategy:${queueId}:${kind}`;
}

export function schemaFailureKey(queueId: string): string {
  return `schemaFailures:${queueId}`;
}

function skippedRecord(
  opts: RunOptions,
  reason: NonNullable<AllocationRunRecord['skipReason']>,
): AllocationRunRecord {
  const now = opts.clock.now().toISOString();
  return {
    id: uuidv7(opts.clock.now().getTime()),
    queueId: opts.queue.queueId,
    queueVersion: opts.queue.queueVersion,
    tenantId: opts.queue.definition.tenantId,
    trigger: opts.trigger,
    dryRun: opts.dryRun,
    status: 'skipped',
    skipReason: reason,
    startedAt: now,
    finishedAt: now,
    strategy: opts.queue.definition.strategy.kind,
    counts: emptyCounts(),
    assignments: [],
  };
}

/**
 * One allocation run: lease → hygiene → stale sweep → fetch workers → fetch
 * candidates → eligibility → pure strategy → persist intents → guarded apply
 * → reconcile audit → commit cursor over the applied subset.
 *
 * Crash-safe by construction: the run record (with planned assignments) is
 * persisted BEFORE any write is applied, so an assignment can never exist
 * without an audit trail; re-running is idempotent because applied items no
 * longer match the candidate filter.
 */
export async function executeRun(opts: RunOptions): Promise<AllocationRunRecord> {
  const { queue, store, clock, logger, metrics } = opts;
  const def = queue.definition;
  const qid = queue.queueId;
  const labels = { queue: qid };

  // -- Gate checks ---------------------------------------------------------
  if (!def.enabled && !opts.dryRun) {
    const rec = skippedRecord(opts, 'disabled');
    await store.appendRun(rec);
    metrics.increment('malkom_runs_total', { ...labels, status: 'skipped' });
    return rec;
  }
  const paused = (await store.get(pausedKey(qid))) === '1';
  if (paused && !opts.dryRun) {
    const rec = skippedRecord(opts, 'paused');
    await store.appendRun(rec);
    metrics.increment('malkom_runs_total', { ...labels, status: 'skipped' });
    return rec;
  }

  const leaseTtl = opts.leaseTtlMs ?? DEFAULT_LEASE_TTL_MS;
  const startedAtDate = clock.now();
  const runId = uuidv7(startedAtDate.getTime());

  // -- Lease (skipped for dry runs — they perform no writes) ---------------
  let leaseToken: number | undefined;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let leaseLost = false;
  if (!opts.dryRun) {
    const grant = await store.acquireLease(leaseKey(qid), opts.instanceId, leaseTtl);
    if (!grant) {
      const rec = skippedRecord(opts, 'lease_held');
      await store.appendRun(rec);
      metrics.increment('malkom_runs_total', { ...labels, status: 'skipped' });
      logger.info({ queueId: qid, runId }, 'run skipped: lease held elsewhere');
      return rec;
    }
    leaseToken = grant.token;
    heartbeat = setInterval(() => {
      void store.renewLease(leaseKey(qid), opts.instanceId, leaseTtl).then(
        (ok) => {
          if (!ok) leaseLost = true;
        },
        () => {
          leaseLost = true;
        },
      );
    }, Math.max(1000, Math.floor(leaseTtl / 3)));
    heartbeat.unref?.();
  }

  const record: AllocationRunRecord = {
    id: runId,
    queueId: qid,
    queueVersion: queue.queueVersion,
    tenantId: def.tenantId,
    trigger: opts.trigger,
    dryRun: opts.dryRun,
    status: 'running',
    startedAt: startedAtDate.toISOString(),
    leaseToken,
    strategy: def.strategy.kind,
    counts: emptyCounts(),
    assignments: [],
    notes: [],
  };
  const note = (n: string) => {
    if ((record.notes?.length ?? 0) < NOTE_CAP) record.notes!.push(n);
  };

  const finalize = async (status: AllocationRunRecord['status'], error?: string): Promise<AllocationRunRecord> => {
    if (heartbeat) clearInterval(heartbeat);
    record.status = status;
    if (error !== undefined) record.error = error;
    record.finishedAt = clock.now().toISOString();
    const durationMs = new Date(record.finishedAt).getTime() - startedAtDate.getTime();
    try {
      await store.updateRun(runId, {
        status: record.status,
        finishedAt: record.finishedAt,
        counts: record.counts,
        assignments: record.assignments,
        notes: record.notes,
        error: record.error,
      });
    } catch (err) {
      logger.error({ queueId: qid, runId, err: String(err) }, 'failed to persist final run record');
    }
    if (!opts.dryRun) {
      await store.releaseLease(leaseKey(qid), opts.instanceId).catch(() => {});
    }
    metrics.increment('malkom_runs_total', { ...labels, status });
    metrics.observe('malkom_run_duration_ms', labels, durationMs);
    try {
      await opts.hooks?.onRunComplete?.(record);
    } catch (err) {
      logger.warn({ queueId: qid, runId, err: String(err) }, 'onRunComplete hook threw');
    }
    return record;
  };

  try {
    // Hygiene: surface crashed runs; cheap on the status index.
    await store.markAbandonedRuns(new Date(startedAtDate.getTime() - leaseTtl * 2)).catch(() => 0);

    // Intent record exists from the start — even a failed fetch leaves a trace.
    await store.appendRun(record);

    // -- Stale sweep -------------------------------------------------------
    if (!opts.dryRun && def.staleAfter) {
      const releaseStale = opts.adapter.assigner.releaseStale?.bind(opts.adapter.assigner);
      if (releaseStale) {
        const cutoff = new Date(startedAtDate.getTime() - def.staleAfter.minutes * 60_000);
        const released = await releaseStale(queue, cutoff);
        record.counts.released = released;
        if (released > 0) {
          metrics.increment('malkom_released_total', labels, released);
          note(`stale sweep released ${released} item(s) assigned before ${cutoff.toISOString()}`);
        }
      } else {
        note('staleAfter configured but adapter does not implement releaseStale — sweep skipped');
      }
    }

    // -- Workers first: short-circuit when nobody can take work ------------
    const workers = await opts.adapter.workers.fetchEligible(queue);
    record.counts.eligibleWorkers = workers.length;
    metrics.setGauge('malkom_eligible_workers', labels, workers.length);
    const totalFree = workers.reduce((s, w) => s + freeCapacity(w), 0);
    if (workers.length === 0 || totalFree <= 0) {
      note(workers.length === 0 ? 'no eligible workers' : 'no free capacity');
      return await finalize('succeeded');
    }

    // -- Candidates --------------------------------------------------------
    const { batchLimit, overscan } = batchConfig(def);
    const items = await opts.adapter.work.fetchAllocatable(queue, batchLimit * overscan);
    record.counts.candidates = items.length;
    metrics.setGauge('malkom_candidate_pool_size', labels, items.length);
    const oldest = items.reduce<number>((max, it) => {
      if (!it.createdAt) return max;
      return Math.max(max, (startedAtDate.getTime() - it.createdAt.getTime()) / 1000);
    }, 0);
    metrics.setGauge('malkom_oldest_unassigned_seconds', labels, Math.max(0, Math.round(oldest)));

    if (items.length === 0) {
      return await finalize('succeeded');
    }

    // -- Eligibility (hard constraints, before any strategy) ---------------
    const { eligibility, unmatchable } = computeEligibility(def.matching, items, workers);
    record.counts.skippedNoWorker = unmatchable.length;
    for (const u of unmatchable.slice(0, 10)) note(`item ${u.itemId} skipped: ${u.reason}`);
    const matched: WorkItem[] = items.filter((it) => (eligibility.get(it.id)?.size ?? 0) > 0).slice(0, batchLimit);
    record.counts.matched = matched.length;
    if (matched.length === 0) {
      return await finalize('succeeded');
    }

    // -- Pure strategy -----------------------------------------------------
    const strategy = opts.strategies.get(def.strategy.kind);
    const stateRaw = await store.get(strategyStateKey(qid, def.strategy.kind));
    const state: unknown = stateRaw === null ? null : (JSON.parse(stateRaw) as unknown);
    const result = strategy.allocate({
      items: matched,
      workers,
      eligibility,
      state,
      params: def.strategy.params,
    });

    // -- Defensive enforcement (custom strategies cannot break invariants) --
    const matchedIds = new Set(matched.map((i) => i.id));
    const ledger = new Map<string, number>(workers.map((w) => [w.id, freeCapacity(w)]));
    const seenItems = new Set<string>();
    const plan: Assignment[] = [];
    for (const a of result.assignments) {
      if (!matchedIds.has(a.itemId) || seenItems.has(a.itemId)) {
        note(`strategy dropped: duplicate/unknown item ${a.itemId}`);
        continue;
      }
      if (!(eligibility.get(a.itemId)?.has(a.workerId) ?? false)) {
        note(`strategy dropped: worker ${a.workerId} not eligible for item ${a.itemId}`);
        continue;
      }
      const free = ledger.get(a.workerId) ?? 0;
      if (free <= 0) {
        note(`strategy dropped: worker ${a.workerId} over capacity`);
        continue;
      }
      ledger.set(a.workerId, free - 1);
      seenItems.add(a.itemId);
      plan.push(a);
    }
    record.counts.planned = plan.length;

    // -- Persist intents BEFORE applying -----------------------------------
    record.assignments = plan.map<RunAssignmentRecord>((a) => ({
      itemId: a.itemId,
      workerId: a.workerId,
      reason: a.reason,
      outcome: opts.dryRun ? 'dry-run' : 'planned',
    }));
    await store.updateRun(runId, { assignments: record.assignments, counts: record.counts });

    // -- Dry run: explain instead of apply ---------------------------------
    if (opts.dryRun) {
      const explain = opts.adapter.assigner.explain?.bind(opts.adapter.assigner);
      if (explain && plan.length > 0) {
        const lines = await explain(queue, plan);
        for (const l of lines.slice(0, NOTE_CAP)) note(l);
      }
      return await finalize('succeeded');
    }

    // -- Guarded apply, chunked --------------------------------------------
    const byItem = new Map(record.assignments.map((a) => [a.itemId, a]));
    const applied = new Set<string>();
    const chunkSize = opts.applyChunkSize ?? DEFAULT_APPLY_CHUNK;
    let aborted = false;
    for (let i = 0; i < plan.length && !aborted; i += chunkSize) {
      if (leaseLost) {
        note('lease lost mid-run — stopping before next chunk');
        aborted = true;
        break;
      }
      const chunk = plan.slice(i, i + chunkSize);
      const results = await opts.adapter.assigner.assign(queue, chunk);
      for (const r of results) {
        const rec = byItem.get(r.itemId);
        if (!rec) continue;
        if (r.status === 'assigned') {
          rec.outcome = 'assigned';
          applied.add(r.itemId);
          record.counts.assigned++;
          metrics.increment('malkom_assignments_total', { ...labels, outcome: 'assigned' });
          const item = matched.find((m) => m.id === r.itemId);
          if (item?.createdAt) {
            metrics.observe('malkom_item_wait_seconds', labels, (clock.now().getTime() - item.createdAt.getTime()) / 1000);
          }
          try {
            await opts.hooks?.onAssigned?.({ queueId: qid, runId, itemId: r.itemId, workerId: rec.workerId, reason: rec.reason });
          } catch (err) {
            logger.warn({ queueId: qid, runId, err: String(err) }, 'onAssigned hook threw');
          }
        } else if (r.status === 'lost') {
          rec.outcome = 'lost';
          record.counts.lost++;
          metrics.increment('malkom_assignments_total', { ...labels, outcome: 'lost' });
        } else {
          rec.outcome = 'error';
          rec.error = r.message;
          record.counts.errors++;
          metrics.increment('malkom_assignments_total', { ...labels, outcome: 'error' });
        }
      }
    }

    // -- Cursor commits over the APPLIED subset only ------------------------
    if (result.stateAfter) {
      try {
        const next = result.stateAfter(applied);
        await store.set(strategyStateKey(qid, def.strategy.kind), JSON.stringify(next));
      } catch (err) {
        note(`strategy stateAfter failed: ${String(err)}`);
      }
    }

    // Healthy run resets the schema-drift counter.
    await store.delete(schemaFailureKey(qid)).catch(() => {});

    const status = record.counts.errors > 0 || aborted ? 'partial' : 'succeeded';
    return await finalize(status);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ queueId: qid, runId, err: message }, 'allocation run failed');
    try {
      await opts.hooks?.onError?.(err, { queueId: qid, runId });
    } catch {
      /* hook errors never mask the run error */
    }

    // Schema drift: N consecutive schema-class failures auto-pause the queue.
    if (err instanceof AdapterError && err.schemaClass && !opts.dryRun) {
      const n = Number((await store.get(schemaFailureKey(qid)).catch(() => '0')) ?? '0') + 1;
      await store.set(schemaFailureKey(qid), String(n)).catch(() => {});
      if (n >= SCHEMA_FAILURES_BEFORE_PAUSE) {
        await store.set(pausedKey(qid), '1').catch(() => {});
        note(`auto-paused after ${n} consecutive schema-class failures — fix the binding and resume`);
        logger.error({ queueId: qid, runId, failures: n }, 'queue auto-paused: repeated schema errors');
      } else {
        note(`schema-class failure ${n}/${SCHEMA_FAILURES_BEFORE_PAUSE} before auto-pause`);
      }
    }
    return await finalize('failed', message);
  }
}
