import { Cron } from 'croner';
import type { QueueDefinition } from '../config/schemas.js';
import type { Logger } from '../ports/logger.js';

export interface SchedulerCallbacks {
  /** The full run pipeline (lease included) for a scheduled tick. */
  run(queueId: string): Promise<unknown>;
  /** A tick fired while the previous run was still active (croner `protect`). */
  onOverlapSkip(queueId: string): void;
  onScheduleError(queueId: string, err: unknown): void;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * One croner job per queue. Croner gives per-job IANA timezones with correct
 * DST handling, in-process overlap protection, and pause/resume/trigger —
 * zero dependencies. Cross-instance overlap is the lease's job, not ours.
 */
export class QueueScheduler {
  private readonly jobs = new Map<string, Cron>();
  private readonly logger: Logger;
  private readonly callbacks: SchedulerCallbacks;

  constructor(callbacks: SchedulerCallbacks, logger: Logger) {
    this.callbacks = callbacks;
    this.logger = logger;
  }

  /** (Re)register a queue's job; replaces any existing schedule atomically. */
  register(def: QueueDefinition, opts: { startPaused?: boolean } = {}): void {
    this.unregister(def.id);
    if (!def.enabled) return;

    const t = def.schedule.trigger;
    const jitterMs = def.schedule.jitterMs;
    const tick = async () => {
      if (jitterMs > 0) await sleep(Math.floor(Math.random() * jitterMs));
      await this.callbacks.run(def.id);
    };

    const common = {
      protect: () => this.callbacks.onOverlapSkip(def.id),
      catch: (err: unknown) => this.callbacks.onScheduleError(def.id, err),
      paused: opts.startPaused ?? false,
    };

    let job: Cron;
    if (t.kind === 'cron') {
      job = t.tz !== undefined ? new Cron(t.expr, { ...common, timezone: t.tz }, tick) : new Cron(t.expr, common, tick);
    } else {
      // Seconds-granularity pattern gated by croner's minimum-interval option.
      const seconds = Math.max(1, Math.round(t.everyMs / 1000));
      job = new Cron('* * * * * *', { ...common, interval: seconds }, tick);
    }
    this.jobs.set(def.id, job);
    this.logger.info({ queueId: def.id, schedule: t }, 'queue scheduled');
  }

  unregister(queueId: string): void {
    const job = this.jobs.get(queueId);
    if (job) {
      job.stop();
      this.jobs.delete(queueId);
    }
  }

  pause(queueId: string): boolean {
    return this.jobs.get(queueId)?.pause() ?? false;
  }

  resume(queueId: string): boolean {
    return this.jobs.get(queueId)?.resume() ?? false;
  }

  nextRunAt(queueId: string): Date | null {
    return this.jobs.get(queueId)?.nextRun() ?? null;
  }

  isBusy(queueId: string): boolean {
    return this.jobs.get(queueId)?.isBusy() ?? false;
  }

  has(queueId: string): boolean {
    return this.jobs.has(queueId);
  }

  stopAll(): void {
    for (const job of this.jobs.values()) job.stop();
    this.jobs.clear();
  }
}
