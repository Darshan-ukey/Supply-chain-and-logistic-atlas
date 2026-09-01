import { DatabaseSync } from 'node:sqlite';
import type { ReviewRecord, StreamDefinition } from './schemas.js';

/**
 * State port + shipped stores (in-memory for tests, SQLite for real use),
 * following the sibling engines: WAL, NORMAL sync, 5s busy timeout.
 */

export interface StreamRecord {
  definition: StreamDefinition;
  version: number;
  updatedAt: string;
}

export interface QualityStateStore {
  putStream(record: StreamRecord): void;
  getStream(id: string): StreamRecord | null;
  listStreams(): StreamRecord[];
  deleteStream(id: string): void;
  putReview(record: ReviewRecord): void;
  getReview(id: string): ReviewRecord | null;
  listReviews(streamId: string | null, status: 'OPEN' | 'DONE' | null, limit: number, offset: number): ReviewRecord[];
  countReviews(streamId: string): { open: number; done: number; passed: number; failed: number };
  close(): void;
}

export class InMemoryQualityStateStore implements QualityStateStore {
  private readonly streams = new Map<string, StreamRecord>();
  private readonly reviews = new Map<string, ReviewRecord>();

  putStream(record: StreamRecord): void {
    this.streams.set(record.definition.id, record);
  }
  getStream(id: string): StreamRecord | null {
    return this.streams.get(id) ?? null;
  }
  listStreams(): StreamRecord[] {
    return [...this.streams.values()];
  }
  deleteStream(id: string): void {
    this.streams.delete(id);
  }
  putReview(record: ReviewRecord): void {
    this.reviews.set(record.id, record);
  }
  getReview(id: string): ReviewRecord | null {
    return this.reviews.get(id) ?? null;
  }
  listReviews(streamId: string | null, status: 'OPEN' | 'DONE' | null, limit: number, offset: number): ReviewRecord[] {
    const rows = [...this.reviews.values()]
      .filter((r) => (streamId === null || r.streamId === streamId) && (status === null || r.status === status))
      .sort((a, b) => b.openedAt.localeCompare(a.openedAt));
    return rows.slice(offset, offset + limit);
  }
  countReviews(streamId: string): { open: number; done: number; passed: number; failed: number } {
    const rows = [...this.reviews.values()].filter((r) => r.streamId === streamId);
    return {
      open: rows.filter((r) => r.status === 'OPEN').length,
      done: rows.filter((r) => r.status === 'DONE').length,
      passed: rows.filter((r) => r.outcome === 'PASS').length,
      failed: rows.filter((r) => r.outcome === 'FAIL').length,
    };
  }
  close(): void {
    this.streams.clear();
    this.reviews.clear();
  }
}

export class SqliteQualityStateStore implements QualityStateStore {
  private readonly db: DatabaseSync;

  constructor(path: string) {
    this.db = new DatabaseSync(path);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      PRAGMA busy_timeout = 5000;
      CREATE TABLE IF NOT EXISTS malkom_quality_streams (
        id TEXT PRIMARY KEY, definition TEXT NOT NULL,
        version INTEGER NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS malkom_quality_reviews (
        id TEXT PRIMARY KEY, stream_id TEXT NOT NULL, item_id TEXT NOT NULL,
        status TEXT NOT NULL, outcome TEXT, notes TEXT, field_errors TEXT NOT NULL,
        opened_at TEXT NOT NULL, completed_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_quality_reviews_stream
        ON malkom_quality_reviews (stream_id, status, opened_at);
    `);
  }

  putStream(record: StreamRecord): void {
    this.db
      .prepare(`INSERT INTO malkom_quality_streams (id, definition, version, updated_at)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET definition=excluded.definition,
                  version=excluded.version, updated_at=excluded.updated_at`)
      .run(record.definition.id, JSON.stringify(record.definition), record.version, record.updatedAt);
  }

  getStream(id: string): StreamRecord | null {
    const row = this.db.prepare('SELECT definition, version, updated_at FROM malkom_quality_streams WHERE id = ?').get(id) as
      | { definition: string; version: number; updated_at: string }
      | undefined;
    if (row === undefined) return null;
    return {
      definition: JSON.parse(row.definition) as StreamRecord['definition'],
      version: row.version,
      updatedAt: row.updated_at,
    };
  }

  listStreams(): StreamRecord[] {
    const rows = this.db.prepare('SELECT id FROM malkom_quality_streams ORDER BY id').all() as { id: string }[];
    return rows.map((row) => this.getStream(row.id)).filter((record): record is StreamRecord => record !== null);
  }

  deleteStream(id: string): void {
    this.db.prepare('DELETE FROM malkom_quality_streams WHERE id = ?').run(id);
  }

  putReview(record: ReviewRecord): void {
    this.db
      .prepare(`INSERT INTO malkom_quality_reviews (id, stream_id, item_id, status, outcome, notes, field_errors, opened_at, completed_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET status=excluded.status, outcome=excluded.outcome,
                  notes=excluded.notes, field_errors=excluded.field_errors, completed_at=excluded.completed_at`)
      .run(
        record.id, record.streamId, record.itemId, record.status, record.outcome,
        record.notes, JSON.stringify(record.fieldErrors), record.openedAt, record.completedAt,
      );
  }

  getReview(id: string): ReviewRecord | null {
    const row = this.db.prepare('SELECT * FROM malkom_quality_reviews WHERE id = ?').get(id) as
      | { id: string; stream_id: string; item_id: string; status: string; outcome: string | null; notes: string | null; field_errors: string; opened_at: string; completed_at: string | null }
      | undefined;
    if (row === undefined) return null;
    return this.rowToReview(row);
  }

  listReviews(streamId: string | null, status: 'OPEN' | 'DONE' | null, limit: number, offset: number): ReviewRecord[] {
    const clauses: string[] = [];
    const params: (string | number)[] = [];
    if (streamId !== null) {
      clauses.push('stream_id = ?');
      params.push(streamId);
    }
    if (status !== null) {
      clauses.push('status = ?');
      params.push(status);
    }
    const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = this.db
      .prepare(`SELECT * FROM malkom_quality_reviews ${where} ORDER BY opened_at DESC LIMIT ? OFFSET ?`)
      .all(...params, limit, offset) as {
      id: string; stream_id: string; item_id: string; status: string; outcome: string | null; notes: string | null; field_errors: string; opened_at: string; completed_at: string | null;
    }[];
    return rows.map((row) => this.rowToReview(row));
  }

  countReviews(streamId: string): { open: number; done: number; passed: number; failed: number } {
    const row = this.db
      .prepare(`SELECT
                  SUM(CASE WHEN status = 'OPEN' THEN 1 ELSE 0 END) AS open,
                  SUM(CASE WHEN status = 'DONE' THEN 1 ELSE 0 END) AS done,
                  SUM(CASE WHEN outcome = 'PASS' THEN 1 ELSE 0 END) AS passed,
                  SUM(CASE WHEN outcome = 'FAIL' THEN 1 ELSE 0 END) AS failed
                FROM malkom_quality_reviews WHERE stream_id = ?`)
      .get(streamId) as { open: number | null; done: number | null; passed: number | null; failed: number | null };
    return { open: row.open ?? 0, done: row.done ?? 0, passed: row.passed ?? 0, failed: row.failed ?? 0 };
  }

  private rowToReview(row: { id: string; stream_id: string; item_id: string; status: string; outcome: string | null; notes: string | null; field_errors: string; opened_at: string; completed_at: string | null }): ReviewRecord {
    return {
      id: row.id,
      streamId: row.stream_id,
      itemId: row.item_id,
      status: row.status as ReviewRecord['status'],
      outcome: row.outcome as ReviewRecord['outcome'],
      notes: row.notes,
      fieldErrors: JSON.parse(row.field_errors) as string[],
      openedAt: row.opened_at,
      completedAt: row.completed_at,
    };
  }

  close(): void {
    this.db.close();
  }
}
