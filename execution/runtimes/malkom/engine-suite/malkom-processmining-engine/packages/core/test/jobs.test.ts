import { describe, expect, it } from 'vitest';
import { ConfigInvalidError, UnsupportedError } from '../src/domain/errors.js';
import {
  JOB_CONCURRENCY,
  createMiningQueue,
  dispatchJob,
  type JobHandlers,
  type MiningJob,
} from '../src/jobs/queue.js';

/**
 * The job layer without a Redis.
 *
 * What is worth pinning here is not that BullMQ works — it is battle-tested
 * and not ours to verify — but the two engine-specific rules layered on top:
 * refresh must never run concurrently against one store, and an unhandled job
 * kind must fail rather than quietly succeed.
 */

describe('background jobs', () => {
  it('refuses to start without a connection from the host', async () => {
    await expect(
      createMiningQueue({ connection: undefined as unknown as object }),
    ).rejects.toBeInstanceOf(ConfigInvalidError);
  });

  it('serialises refresh, because DuckDB permits exactly one writer', () => {
    // Not a tuning knob. Two refresh jobs against one store do not race over
    // rows — the second cannot open the file at all. If this ever becomes
    // greater than 1, scheduled refreshes start failing intermittently and the
    // cause is a long way from the symptom.
    expect(JOB_CONCURRENCY.refresh).toBe(1);
    // Signals only read, so they may run together.
    expect(JOB_CONCURRENCY.signals).toBeGreaterThan(1);
  });

  it('routes each kind to its handler', async () => {
    const seen: string[] = [];
    const handlers: JobHandlers = {
      refresh: async (job) => {
        seen.push(`refresh:${job.streamId}`);
        return 'ok';
      },
      signals: async (job) => {
        seen.push(`signals:${job.definitionsId}`);
        return 'ok';
      },
    };

    await dispatchJob(handlers, { kind: 'refresh', store: 's', streamId: 'orders' });
    await dispatchJob(handlers, { kind: 'signals', store: 's', definitionsId: 'sla' });
    expect(seen).toEqual(['refresh:orders', 'signals:sla']);
  });

  it('fails loudly when a kind has no handler', async () => {
    // The alternative — succeeding silently — leaves the log quietly stale
    // while every report drawn from it still looks fine.
    const job: MiningJob = { kind: 'refresh', store: 's', streamId: 'orders' };
    await expect(dispatchJob({}, job)).rejects.toBeInstanceOf(UnsupportedError);
    await expect(dispatchJob({ signals: async () => 1 }, job)).rejects.toThrow(
      /no handler registered for refresh/,
    );
  });

  it('lets a handler failure surface, so the queue can retry it', async () => {
    const boom = new Error('host database unreachable');
    await expect(
      dispatchJob(
        {
          refresh: async () => {
            throw boom;
          },
        },
        { kind: 'refresh', store: 's', streamId: 'orders' },
      ),
    ).rejects.toBe(boom);
  });
});
