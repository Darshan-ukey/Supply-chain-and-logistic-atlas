import { DatabaseSync } from 'node:sqlite';
import type { ExtractorDefinition, RunRecord } from './schemas.js';

/**
 * State port + shipped stores (in-memory for tests, SQLite for real use),
 * following the sibling engines: WAL, NORMAL sync, 5s busy timeout.
 */

export interface ExtractorRecord {
  definition: ExtractorDefinition;
  version: number;
  updatedAt: string;
}

export interface ExtractStateStore {
  putExtractor(record: ExtractorRecord): void;
  getExtractor(id: string): ExtractorRecord | null;
  listExtractors(): ExtractorRecord[];
  deleteExtractor(id: string): void;
  appendRun(record: RunRecord): void;
  listRuns(extractorId: string | null, limit: number, offset: number): RunRecord[];
  pruneRuns(maxAgeMs: number, maxCount: number): void;
  close(): void;
}

export class InMemoryExtractStateStore implements ExtractStateStore {
  private readonly extractors = new Map<string, ExtractorRecord>();
  private runs: RunRecord[] = [];

  putExtractor(record: ExtractorRecord): void {
    this.extractors.set(record.definition.id, record);
  }
  getExtractor(id: string): ExtractorRecord | null {
    return this.extractors.get(id) ?? null;
  }
  listExtractors(): ExtractorRecord[] {
    return [...this.extractors.values()];
  }
  deleteExtractor(id: string): void {
    this.extractors.delete(id);
  }
  appendRun(record: RunRecord): void {
    this.runs.push(record);
  }
  listRuns(extractorId: string | null, limit: number, offset: number): RunRecord[] {
    const rows = this.runs.filter((r) => extractorId === null || r.extractorId === extractorId);
    return rows.slice().reverse().slice(offset, offset + limit);
  }
  pruneRuns(maxAgeMs: number, maxCount: number): void {
    const cutoff = Date.now() - maxAgeMs;
    this.runs = this.runs.filter((r) => Date.parse(r.createdAt) >= cutoff).slice(-maxCount);
  }
  close(): void {
    this.extractors.clear();
    this.runs = [];
  }
}

export class SqliteExtractStateStore implements ExtractStateStore {
  private readonly db: DatabaseSync;

  constructor(path: string) {
    this.db = new DatabaseSync(path);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      PRAGMA busy_timeout = 5000;
      CREATE TABLE IF NOT EXISTS malkom_extract_extractors (
        id TEXT PRIMARY KEY, definition TEXT NOT NULL,
        version INTEGER NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS malkom_extract_runs (
        id TEXT PRIMARY KEY, extractor_id TEXT NOT NULL,
        extracted INTEGER NOT NULL, fields_requested INTEGER NOT NULL, created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_extract_runs_extractor
        ON malkom_extract_runs (extractor_id, created_at);
    `);
  }

  putExtractor(record: ExtractorRecord): void {
    this.db
      .prepare(`INSERT INTO malkom_extract_extractors (id, definition, version, updated_at)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET definition=excluded.definition,
                  version=excluded.version, updated_at=excluded.updated_at`)
      .run(record.definition.id, JSON.stringify(record.definition), record.version, record.updatedAt);
  }

  getExtractor(id: string): ExtractorRecord | null {
    const row = this.db.prepare('SELECT definition, version, updated_at FROM malkom_extract_extractors WHERE id = ?').get(id) as
      | { definition: string; version: number; updated_at: string }
      | undefined;
    if (row === undefined) return null;
    return {
      definition: JSON.parse(row.definition) as ExtractorRecord['definition'],
      version: row.version,
      updatedAt: row.updated_at,
    };
  }

  listExtractors(): ExtractorRecord[] {
    const rows = this.db.prepare('SELECT id FROM malkom_extract_extractors ORDER BY id').all() as { id: string }[];
    return rows.map((row) => this.getExtractor(row.id)).filter((record): record is ExtractorRecord => record !== null);
  }

  deleteExtractor(id: string): void {
    this.db.prepare('DELETE FROM malkom_extract_extractors WHERE id = ?').run(id);
  }

  appendRun(record: RunRecord): void {
    this.db
      .prepare('INSERT INTO malkom_extract_runs (id, extractor_id, extracted, fields_requested, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(record.id, record.extractorId, record.extracted, record.fieldsRequested, record.createdAt);
  }

  listRuns(extractorId: string | null, limit: number, offset: number): RunRecord[] {
    const rows = (extractorId === null
      ? this.db.prepare('SELECT * FROM malkom_extract_runs ORDER BY created_at DESC LIMIT ? OFFSET ?').all(limit, offset)
      : this.db.prepare('SELECT * FROM malkom_extract_runs WHERE extractor_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?').all(extractorId, limit, offset)) as {
      id: string; extractor_id: string; extracted: number; fields_requested: number; created_at: string;
    }[];
    return rows.map((row) => ({
      id: row.id,
      extractorId: row.extractor_id,
      extracted: row.extracted,
      fieldsRequested: row.fields_requested,
      createdAt: row.created_at,
    }));
  }

  pruneRuns(maxAgeMs: number, maxCount: number): void {
    const cutoff = new Date(Date.now() - maxAgeMs).toISOString();
    this.db.prepare('DELETE FROM malkom_extract_runs WHERE created_at < ?').run(cutoff);
    this.db
      .prepare(`DELETE FROM malkom_extract_runs WHERE id NOT IN
                (SELECT id FROM malkom_extract_runs ORDER BY created_at DESC LIMIT ?)`)
      .run(maxCount);
  }

  close(): void {
    this.db.close();
  }
}
