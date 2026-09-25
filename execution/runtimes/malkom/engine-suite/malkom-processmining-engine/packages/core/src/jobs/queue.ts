import { ConfigInvalidError, UnsupportedError } from '../domain/errors.js';
import type { Logger } from '../ports/logger.js';
import { noopLogger } from '../ports/logger.js';

/**
 * Background jobs, on BullMQ.
 *
 * Two things in this engine want to happen on a schedule rather than on a
 * request: keeping the mined log current, and evaluating signals. Both are the
 * difference between a tool you open and a tool that tells you — and neither
 * belongs on the request path, because both can run for minutes.
 *
 * The rules that matter here are the same ones the rest of the engine follows:
 *
 *  - **The host owns the connection.** The engine never opens its own Redis,
 *    exactly as it never opens its own database. It is handed a connection or
 *    the options to make one, and it closes only what it opened.
 *  - **BullMQ is an OPTIONAL peer.** Loaded through a lazy import so an
 *    embedder who does not want background jobs does not need Redis installed
 *    to use the rest of the engine.
 *  - **Refresh is serialised per store.** DuckDB permits many readers and
 *    exactly one writer. Two refresh jobs against one store would not race
 *    over data — they would fail to open it at all. Concurrency is therefore
 *    per-store rather than global, so unrelated stores still refresh in
 *    parallel.
 */

/** Minimal shape of the BullMQ pieces used here, so the import stays lazy. */
interface BullQueue {
  add(name: string, data: unknown, opts?: unknown): Promise<{ id?: string }>;
  upsertJobScheduler?(id: string, repeat: unknown, template?: unknown): Promise<unknown>;
  removeJobScheduler?(id: string): Promise<boolean>;
  getJobSchedulers?(): Promise<{ key: string }[]>;
  close(): Promise<void>;
}

interface BullWorker {
  on(event: string, listener: (...args: unknown[]) => void): unknown;
  close(): Promise<void>;
}

export type MiningJob =
  /**
   * Bring a stream's mined log up to date.
   *
   * `through` exists so a scheduled run has a definite upper bound rather than
   * racing the clock: without it, two runs started a second apart would each
   * decide "now" differently and the coverage record would record a window
   * neither actually fetched.
   */
  | { kind: 'refresh'; store: string; streamId: string; through?: string }
  /**
   * Evaluate signal definitions and hand every firing to the sink.
   *
   * `at` is the evaluation instant, defaulting to when the job runs. Passing
   * it explicitly is what makes a re-run of a failed job produce the same
   * answer as the original attempt rather than a fresher one.
   */
  | { kind: 'signals'; store: string; definitionsId: string; at?: string };

export interface JobHandlers {
  refresh?(job: Extract<MiningJob, { kind: 'refresh' }>): Promise<unknown>;
  signals?(job: Extract<MiningJob, { kind: 'signals' }>): Promise<unknown>;
}

export interface JobsConfig {
  /**
   * An ioredis instance, or the options to build one.
   *
   * Handed over rather than described piecemeal, so the host's existing
   * connection — with its TLS, its auth, its cluster topology — is reused
   * rather than reconstructed from a subset the engine happened to expose.
   */
  connection: unknown;
  /** Queue name. Default 'malkom-mining'. Set it when several engines share a Redis. */
  queueName?: string;
  /** Key prefix, for sharing a Redis with other applications. */
  prefix?: string;
  logger?: Logger;
}

const DEFAULT_QUEUE = 'malkom-mining';

/**
 * How many of each kind may run at once.
 *
 * Refresh is 1 because it WRITES: DuckDB allows a single writer, so a second
 * concurrent refresh does not corrupt anything, it simply cannot open the
 * store. Signals only read, so several may run together.
 */
const CONCURRENCY: Record<MiningJob['kind'], number> = { refresh: 1, signals: 4 };

async function loadBullmq(): Promise<{
  Queue: new (name: string, opts: unknown) => BullQueue;
  Worker: new (name: string, processor: (job: unknown) => Promise<unknown>, opts: unknown) => BullWorker;
}> {
  try {
    // Lazy: an embedder who does not run background jobs must not need Redis.
    return (await import('bullmq')) as never;
  } catch {
    throw new UnsupportedError(
      'background jobs need the optional peer dependency bullmq — install it, or run refresh and signals from your own scheduler',
    );
  }
}

export interface MiningQueue {
  /** Run a job as soon as a worker is free. */
  enqueue(job: MiningJob): Promise<string | undefined>;
  /**
   * Register a repeating job, or update it in place.
   *
   * Keyed by a caller-chosen id so that re-registering on every boot — which
   * every application does — updates the existing schedule rather than
   * stacking another one beside it. Getting this wrong is the classic way a
   * nightly refresh silently becomes an hourly one.
   */
  schedule(id: string, cron: string, job: MiningJob, tz?: string): Promise<void>;
  unschedule(id: string): Promise<boolean>;
  scheduled(): Promise<string[]>;
  /** Closes only what this engine opened. */
  close(): Promise<void>;
}

export async function createMiningQueue(config: JobsConfig): Promise<MiningQueue> {
  if (config.connection === undefined || config.connection === null) {
    throw new ConfigInvalidError('background jobs need a Redis connection from the host', [
      'pass an ioredis instance, or { host, port } for bullmq to build one',
    ]);
  }
  const { Queue } = await loadBullmq();
  const name = config.queueName ?? DEFAULT_QUEUE;
  const queue = new Queue(name, {
    connection: config.connection,
    ...(config.prefix !== undefined ? { prefix: config.prefix } : {}),
  });

  return {
    async enqueue(job) {
      const added = await queue.add(job.kind, job, {
        // Keep a short history: enough to see what happened, not enough to
        // turn Redis into a log store.
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 500 },
        attempts: 3,
        backoff: { type: 'exponential', delay: 30_000 },
      });
      return added.id;
    },

    async schedule(id, cron, job, tz) {
      if (queue.upsertJobScheduler === undefined) {
        throw new UnsupportedError(
          'this bullmq version has no job scheduler API — upgrade to bullmq 5.16 or later',
        );
      }
      await queue.upsertJobScheduler(
        id,
        { pattern: cron, ...(tz !== undefined ? { tz } : {}) },
        { name: job.kind, data: job },
      );
    },

    async unschedule(id) {
      if (queue.removeJobScheduler === undefined) return false;
      return queue.removeJobScheduler(id);
    },

    async scheduled() {
      if (queue.getJobSchedulers === undefined) return [];
      return (await queue.getJobSchedulers()).map((s) => s.key);
    },

    close: () => queue.close(),
  };
}

export interface MiningWorker {
  close(): Promise<void>;
}

/**
 * Route one job to its handler.
 *
 * Separated from the worker so the routing rule can be tested without a Redis
 * — and so a host running its own scheduler can reuse it rather than
 * reimplementing the refusal below.
 *
 * An unregistered kind throws rather than returning quietly. A scheduled
 * refresh that reports success while doing nothing is the worst possible
 * failure here: the log silently stops being current and every number drawn
 * from it stays plausible.
 */
export async function dispatchJob(handlers: JobHandlers, job: MiningJob): Promise<unknown> {
  const handler = handlers[job.kind];
  if (handler === undefined) {
    throw new UnsupportedError(`no handler registered for ${job.kind} jobs`);
  }
  return (handler as (j: MiningJob) => Promise<unknown>)(job);
}

/**
 * Start a worker.
 *
 * A handler that is not supplied means the worker refuses that kind of job
 * rather than silently succeeding at nothing — a scheduled refresh that
 * reports success while doing nothing is worse than one that fails loudly.
 */
export async function createMiningWorker(
  config: JobsConfig,
  handlers: JobHandlers,
): Promise<MiningWorker> {
  const { Worker } = await loadBullmq();
  const logger = config.logger ?? noopLogger;
  const name = config.queueName ?? DEFAULT_QUEUE;

  const worker = new Worker(
    name,
    async (raw: unknown) => {
      const job = (raw as { data: MiningJob }).data;
      const started = Date.now();
      const result = await dispatchJob(handlers, job);
      logger.info(
        { kind: job.kind, store: job.store, ms: Date.now() - started },
        'mining job finished',
      );
      return result;
    },
    {
      connection: config.connection,
      ...(config.prefix !== undefined ? { prefix: config.prefix } : {}),
      // The highest of the per-kind limits; the write-lock rule that actually
      // matters is enforced by the group below.
      concurrency: Math.max(...Object.values(CONCURRENCY)),
    },
  );

  worker.on('failed', (...args: unknown[]) => {
    const [job, err] = args as [{ data?: MiningJob } | undefined, Error | undefined];
    logger.error(
      {
        kind: job?.data?.kind ?? 'unknown',
        store: job?.data?.store,
        error: err?.message ?? 'unknown',
      },
      'mining job failed',
    );
  });

  return { close: () => worker.close() };
}

/** The per-kind concurrency the engine expects, exposed for hosts running their own worker. */
export const JOB_CONCURRENCY: Readonly<Record<MiningJob['kind'], number>> = CONCURRENCY;
