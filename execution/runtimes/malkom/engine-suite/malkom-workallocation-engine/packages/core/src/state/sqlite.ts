import { DatabaseSync } from 'node:sqlite';
import { StateStoreError } from '../domain/errors.js';
import type { AllocationRunRecord } from '../domain/types.js';
import type { Clock } from '../ports/clock.js';
import { systemClock } from '../ports/clock.js';
import type {
  LeaseGrant,
  QueueRunsSummary,
  RetentionPolicy,
  RunDeleteFilter,
  RunListFilter,
  RunsSummary,
  RunsSummaryFilter,
  StateStore,
} from '../ports/statestore.js';

/**
 * SQLite state store on node:sqlite — the small-footprint default. Zero native
 * dependencies, WAL mode, one file. Valid for SINGLE-INSTANCE deployments (or
 * multiple processes on one machine sharing the file). For multi-instance
 * deployments point the engine at shared engine-prefixed tables instead; the
 * engine refuses to start multi-instance on a private SQLite file.
 *
 * All mutating sections run inside BEGIN IMMEDIATE transactions, so lease
 * acquisition and compare-and-set are atomic across processes sharing the file.
 */
export class SqliteStateStore implements StateStore {
  private readonly db: DatabaseSync;
  private readonly clock: Clock;

  constructor(filename: string, clock: Clock = systemClock) {
    this.db = new DatabaseSync(filename);
    this.clock = clock;
  }

  async init(): Promise<void> {
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      PRAGMA busy_timeout = 5000;
      CREATE TABLE IF NOT EXISTS malkom_kv (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS malkom_leases (
        key        TEXT PRIMARY KEY,
        holder     TEXT NOT NULL,
        token      INTEGER NOT NULL DEFAULT 0,
        expires_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS malkom_runs (
        id         TEXT PRIMARY KEY,
        queue_id   TEXT NOT NULL,
        status     TEXT NOT NULL,
        started_at TEXT NOT NULL,
        record     TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS malkom_runs_queue_started ON malkom_runs (queue_id, started_at DESC);
      CREATE INDEX IF NOT EXISTS malkom_runs_status ON malkom_runs (status);
    `);
  }

  private tx<T>(fn: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const out = fn();
      this.db.exec('COMMIT');
      return out;
    } catch (err) {
      try {
        this.db.exec('ROLLBACK');
      } catch {
        /* already rolled back */
      }
      throw err instanceof StateStoreError ? err : new StateStoreError(String(err));
    }
  }

  async acquireLease(key: string, holder: string, ttlMs: number): Promise<LeaseGrant | null> {
    const now = this.clock.now().getTime();
    return this.tx(() => {
      const row = this.db
        .prepare('SELECT holder, token, expires_at FROM malkom_leases WHERE key = ?')
        .get(key) as { holder: string; token: number; expires_at: number } | undefined;
      if (row && row.expires_at > now && row.holder !== holder) return null;
      const token = (row?.token ?? 0) + 1;
      this.db
        .prepare(
          `INSERT INTO malkom_leases (key, holder, token, expires_at) VALUES (?, ?, ?, ?)
           ON CONFLICT(key) DO UPDATE SET holder = excluded.holder, token = excluded.token, expires_at = excluded.expires_at`,
        )
        .run(key, holder, token, now + ttlMs);
      return { token };
    });
  }

  async renewLease(key: string, holder: string, ttlMs: number): Promise<boolean> {
    const now = this.clock.now().getTime();
    const res = this.db
      .prepare('UPDATE malkom_leases SET expires_at = ? WHERE key = ? AND holder = ? AND expires_at > ?')
      .run(now + ttlMs, key, holder, now);
    return Number(res.changes) === 1;
  }

  async releaseLease(key: string, holder: string): Promise<void> {
    this.db.prepare('UPDATE malkom_leases SET expires_at = 0 WHERE key = ? AND holder = ?').run(key, holder);
  }

  async get(key: string): Promise<string | null> {
    const row = this.db.prepare('SELECT value FROM malkom_kv WHERE key = ?').get(key) as
      | { value: string }
      | undefined;
    return row?.value ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    this.db
      .prepare(
        'INSERT INTO malkom_kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      )
      .run(key, value);
  }

  async delete(key: string): Promise<void> {
    this.db.prepare('DELETE FROM malkom_kv WHERE key = ?').run(key);
  }

  async compareAndSet(key: string, expect: string | null, value: string): Promise<boolean> {
    return this.tx(() => {
      const row = this.db.prepare('SELECT value FROM malkom_kv WHERE key = ?').get(key) as
        | { value: string }
        | undefined;
      const current = row?.value ?? null;
      if (current !== expect) return false;
      this.db
        .prepare(
          'INSERT INTO malkom_kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
        )
        .run(key, value);
      return true;
    });
  }

  async listKeys(prefix: string): Promise<string[]> {
    const rows = this.db
      .prepare("SELECT key FROM malkom_kv WHERE key GLOB ? ORDER BY key")
      .all(`${prefix.replaceAll('[', '[[]').replaceAll('*', '[*]').replaceAll('?', '[?]')}*`) as Array<{
      key: string;
    }>;
    return rows.map((r) => r.key);
  }

  async appendRun(record: AllocationRunRecord): Promise<void> {
    this.db
      .prepare('INSERT INTO malkom_runs (id, queue_id, status, started_at, record) VALUES (?, ?, ?, ?, ?)')
      .run(record.id, record.queueId, record.status, record.startedAt, JSON.stringify(record));
  }

  async updateRun(id: string, patch: Partial<AllocationRunRecord>): Promise<void> {
    this.tx(() => {
      const row = this.db.prepare('SELECT record FROM malkom_runs WHERE id = ?').get(id) as
        | { record: string }
        | undefined;
      if (!row) return;
      const merged = { ...(JSON.parse(row.record) as AllocationRunRecord), ...patch };
      this.db
        .prepare('UPDATE malkom_runs SET status = ?, record = ? WHERE id = ?')
        .run(merged.status, JSON.stringify(merged), id);
    });
  }

  async getRun(id: string): Promise<AllocationRunRecord | null> {
    const row = this.db.prepare('SELECT record FROM malkom_runs WHERE id = ?').get(id) as
      | { record: string }
      | undefined;
    return row ? (JSON.parse(row.record) as AllocationRunRecord) : null;
  }

  async listRuns(filter: RunListFilter): Promise<{ runs: AllocationRunRecord[]; total: number }> {
    const where: string[] = [];
    const params: unknown[] = [];
    if (filter.queueId !== undefined) {
      where.push('queue_id = ?');
      params.push(filter.queueId);
    }
    if (filter.status !== undefined) {
      where.push('status = ?');
      params.push(filter.status);
    }
    if (filter.since !== undefined) {
      where.push('started_at >= ?');
      params.push(filter.since.toISOString());
    }
    if (filter.until !== undefined) {
      where.push('started_at <= ?');
      params.push(filter.until.toISOString());
    }
    const clause = where.length > 0 ? ` WHERE ${where.join(' AND ')}` : '';
    const total = (
      this.db.prepare(`SELECT COUNT(*) AS n FROM malkom_runs${clause}`).get(...(params as never[])) as {
        n: number;
      }
    ).n;
    const limit = Math.min(filter.limit ?? 50, 500);
    const offset = filter.offset ?? 0;
    const rows = this.db
      .prepare(`SELECT record FROM malkom_runs${clause} ORDER BY started_at DESC, id DESC LIMIT ? OFFSET ?`)
      .all(...(params as never[]), limit, offset) as Array<{ record: string }>;
    return { runs: rows.map((r) => JSON.parse(r.record) as AllocationRunRecord), total };
  }

  async summarizeRuns(filter: RunsSummaryFilter): Promise<RunsSummary> {
    const where: string[] = [];
    const params: unknown[] = [];
    if (filter.queueId !== undefined) {
      where.push('queue_id = ?');
      params.push(filter.queueId);
    }
    if (filter.since !== undefined) {
      where.push('started_at >= ?');
      params.push(filter.since.toISOString());
    }
    if (filter.until !== undefined) {
      where.push('started_at <= ?');
      params.push(filter.until.toISOString());
    }
    const clause = where.length > 0 ? ` WHERE ${where.join(' AND ')}` : '';

    const statusRows = this.db
      .prepare(`SELECT status, COUNT(*) AS n FROM malkom_runs${clause} GROUP BY status`)
      .all(...(params as never[])) as Array<{ status: string; n: number }>;
    const byStatus: Record<string, number> = {};
    let totalRuns = 0;
    for (const r of statusRows) {
      byStatus[r.status] = r.n;
      totalRuns += r.n;
    }

    // Counts are aggregated straight out of the record JSON — no paging.
    const innerClause = where.length > 0 ? ` AND ${where.map((w) => `r2.${w}`).join(' AND ')}` : '';
    const queueRows = this.db
      .prepare(
        `SELECT queue_id,
                COUNT(*) AS runs,
                COALESCE(SUM(CAST(json_extract(record, '$.counts.assigned') AS INTEGER)), 0) AS assigned,
                COALESCE(SUM(CAST(json_extract(record, '$.counts.lost') AS INTEGER)), 0) AS lost,
                COALESCE(SUM(CAST(json_extract(record, '$.counts.errors') AS INTEGER)), 0) AS errors,
                COALESCE(SUM(CAST(json_extract(record, '$.counts.released') AS INTEGER)), 0) AS released,
                SUM(CASE WHEN status = 'skipped' THEN 1 ELSE 0 END) AS skipped,
                MAX(started_at) AS last_run_at,
                (SELECT r2.status FROM malkom_runs r2
                  WHERE r2.queue_id = m.queue_id${innerClause}
                  ORDER BY r2.started_at DESC, r2.id DESC LIMIT 1) AS last_status,
                AVG(CASE WHEN json_extract(record, '$.finishedAt') IS NOT NULL
                    THEN (julianday(json_extract(record, '$.finishedAt')) - julianday(started_at)) * 86400000.0
                    END) AS avg_duration_ms
         FROM malkom_runs m${clause} GROUP BY queue_id ORDER BY queue_id`,
      )
      .all(...(params as never[]), ...(params as never[])) as Array<Record<string, unknown>>;

    const byQueue: QueueRunsSummary[] = queueRows.map((r) => ({
      queueId: String(r['queue_id']),
      runs: Number(r['runs'] ?? 0),
      assigned: Number(r['assigned'] ?? 0),
      lost: Number(r['lost'] ?? 0),
      errors: Number(r['errors'] ?? 0),
      released: Number(r['released'] ?? 0),
      skipped: Number(r['skipped'] ?? 0),
      lastRunAt: r['last_run_at'] === null || r['last_run_at'] === undefined ? null : String(r['last_run_at']),
      lastStatus: r['last_status'] === null || r['last_status'] === undefined ? null : String(r['last_status']),
      avgDurationMs:
        r['avg_duration_ms'] === null || r['avg_duration_ms'] === undefined
          ? null
          : Math.round(Number(r['avg_duration_ms'])),
    }));

    return { totalRuns, byStatus, byQueue };
  }

  async deleteRuns(filter: RunDeleteFilter): Promise<number> {
    if (filter.ids && filter.ids.length > 0) {
      const placeholders = filter.ids.map(() => '?').join(',');
      const res = this.db
        .prepare(`DELETE FROM malkom_runs WHERE id IN (${placeholders})`)
        .run(...(filter.ids as never[]));
      return Number(res.changes);
    }
    const where: string[] = [];
    const params: unknown[] = [];
    if (filter.queueId !== undefined) {
      where.push('queue_id = ?');
      params.push(filter.queueId);
    }
    if (filter.status !== undefined) {
      where.push('status = ?');
      params.push(filter.status);
    }
    if (filter.before !== undefined) {
      where.push('started_at < ?');
      params.push(filter.before.toISOString());
    }
    if (where.length === 0) return 0; // refuse unfiltered mass delete; API enforces this too
    const res = this.db
      .prepare(`DELETE FROM malkom_runs WHERE ${where.join(' AND ')}`)
      .run(...(params as never[]));
    return Number(res.changes);
  }

  async pruneRuns(policy: RetentionPolicy): Promise<number> {
    let deleted = 0;
    if (policy.maxAgeMs !== undefined) {
      const cutoff = new Date(this.clock.now().getTime() - policy.maxAgeMs).toISOString();
      const res = this.db
        .prepare("DELETE FROM malkom_runs WHERE started_at < ? AND status != 'running'")
        .run(cutoff);
      deleted += Number(res.changes);
    }
    if (policy.maxCountPerQueue !== undefined) {
      const res = this.db
        .prepare(
          `DELETE FROM malkom_runs WHERE status != 'running' AND id IN (
             SELECT id FROM (
               SELECT id, ROW_NUMBER() OVER (PARTITION BY queue_id ORDER BY started_at DESC, id DESC) AS rn
               FROM malkom_runs
             ) WHERE rn > ?
           )`,
        )
        .run(policy.maxCountPerQueue);
      deleted += Number(res.changes);
    }
    return deleted;
  }

  async markAbandonedRuns(olderThan: Date): Promise<number> {
    const cutoff = olderThan.toISOString();
    return this.tx(() => {
      const rows = this.db
        .prepare("SELECT id, record FROM malkom_runs WHERE status = 'running' AND started_at < ?")
        .all(cutoff) as Array<{ id: string; record: string }>;
      for (const row of rows) {
        const rec = JSON.parse(row.record) as AllocationRunRecord;
        rec.status = 'abandoned';
        this.db
          .prepare("UPDATE malkom_runs SET status = 'abandoned', record = ? WHERE id = ?")
          .run(JSON.stringify(rec), row.id);
      }
      return rows.length;
    });
  }

  async close(): Promise<void> {
    this.db.close();
  }
}
