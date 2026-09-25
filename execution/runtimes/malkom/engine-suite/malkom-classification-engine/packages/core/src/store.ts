import { DatabaseSync } from 'node:sqlite';
import type { NbArtifact } from './nb.js';
import type { DecisionRecord, ModelDefinition } from './schemas.js';

/**
 * State port + shipped stores (in-memory for tests, SQLite for real use),
 * following the sibling engines: WAL, NORMAL sync, 5s busy timeout.
 */

export interface ModelRecord {
  definition: ModelDefinition;
  artifact: NbArtifact;
  version: number;
  updatedAt: string;
}

export interface ClassifyStateStore {
  putModel(record: ModelRecord): void;
  getModel(id: string): ModelRecord | null;
  listModels(): ModelRecord[];
  deleteModel(id: string): void;
  appendDecision(record: DecisionRecord): void;
  listDecisions(modelId: string | null, limit: number, offset: number): DecisionRecord[];
  pruneDecisions(maxAgeMs: number, maxCount: number): void;
  close(): void;
}

export class InMemoryClassifyStateStore implements ClassifyStateStore {
  private readonly models = new Map<string, ModelRecord>();
  private decisions: DecisionRecord[] = [];

  putModel(record: ModelRecord): void {
    this.models.set(record.definition.id, record);
  }
  getModel(id: string): ModelRecord | null {
    return this.models.get(id) ?? null;
  }
  listModels(): ModelRecord[] {
    return [...this.models.values()];
  }
  deleteModel(id: string): void {
    this.models.delete(id);
  }
  appendDecision(record: DecisionRecord): void {
    this.decisions.push(record);
  }
  listDecisions(modelId: string | null, limit: number, offset: number): DecisionRecord[] {
    const rows = this.decisions.filter((d) => modelId === null || d.modelId === modelId);
    return rows.slice().reverse().slice(offset, offset + limit);
  }
  pruneDecisions(maxAgeMs: number, maxCount: number): void {
    const cutoff = Date.now() - maxAgeMs;
    this.decisions = this.decisions.filter((d) => Date.parse(d.createdAt) >= cutoff).slice(-maxCount);
  }
  close(): void {
    this.models.clear();
    this.decisions = [];
  }
}

export class SqliteClassifyStateStore implements ClassifyStateStore {
  private readonly db: DatabaseSync;

  constructor(path: string) {
    this.db = new DatabaseSync(path);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      PRAGMA busy_timeout = 5000;
      CREATE TABLE IF NOT EXISTS malkom_classify_models (
        id TEXT PRIMARY KEY, definition TEXT NOT NULL, artifact TEXT NOT NULL,
        version INTEGER NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS malkom_classify_decisions (
        id TEXT PRIMARY KEY, model_id TEXT NOT NULL, kind TEXT NOT NULL,
        label TEXT NOT NULL, confidence REAL, corrected INTEGER, created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_classify_decisions_model
        ON malkom_classify_decisions (model_id, created_at);
    `);
  }

  putModel(record: ModelRecord): void {
    this.db
      .prepare(`INSERT INTO malkom_classify_models (id, definition, artifact, version, updated_at)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET definition=excluded.definition, artifact=excluded.artifact,
                  version=excluded.version, updated_at=excluded.updated_at`)
      .run(record.definition.id, JSON.stringify(record.definition), JSON.stringify(record.artifact), record.version, record.updatedAt);
  }

  getModel(id: string): ModelRecord | null {
    const row = this.db.prepare('SELECT definition, artifact, version, updated_at FROM malkom_classify_models WHERE id = ?').get(id) as
      | { definition: string; artifact: string; version: number; updated_at: string }
      | undefined;
    if (row === undefined) return null;
    return {
      definition: JSON.parse(row.definition) as ModelRecord['definition'],
      artifact: JSON.parse(row.artifact) as ModelRecord['artifact'],
      version: row.version,
      updatedAt: row.updated_at,
    };
  }

  listModels(): ModelRecord[] {
    const rows = this.db.prepare('SELECT id FROM malkom_classify_models ORDER BY id').all() as { id: string }[];
    return rows.map((row) => this.getModel(row.id)).filter((record): record is ModelRecord => record !== null);
  }

  deleteModel(id: string): void {
    this.db.prepare('DELETE FROM malkom_classify_models WHERE id = ?').run(id);
  }

  appendDecision(record: DecisionRecord): void {
    this.db
      .prepare('INSERT INTO malkom_classify_decisions (id, model_id, kind, label, confidence, corrected, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(record.id, record.modelId, record.kind, record.label, record.confidence, record.corrected === null ? null : record.corrected ? 1 : 0, record.createdAt);
  }

  listDecisions(modelId: string | null, limit: number, offset: number): DecisionRecord[] {
    const rows = (modelId === null
      ? this.db.prepare('SELECT * FROM malkom_classify_decisions ORDER BY created_at DESC LIMIT ? OFFSET ?').all(limit, offset)
      : this.db.prepare('SELECT * FROM malkom_classify_decisions WHERE model_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?').all(modelId, limit, offset)) as {
      id: string; model_id: string; kind: string; label: string; confidence: number | null; corrected: number | null; created_at: string;
    }[];
    return rows.map((row) => ({
      id: row.id,
      modelId: row.model_id,
      kind: row.kind as DecisionRecord['kind'],
      label: row.label,
      confidence: row.confidence,
      corrected: row.corrected === null ? null : row.corrected === 1,
      createdAt: row.created_at,
    }));
  }

  pruneDecisions(maxAgeMs: number, maxCount: number): void {
    const cutoff = new Date(Date.now() - maxAgeMs).toISOString();
    this.db.prepare('DELETE FROM malkom_classify_decisions WHERE created_at < ?').run(cutoff);
    this.db
      .prepare(`DELETE FROM malkom_classify_decisions WHERE id NOT IN
                (SELECT id FROM malkom_classify_decisions ORDER BY created_at DESC LIMIT ?)`)
      .run(maxCount);
  }

  close(): void {
    this.db.close();
  }
}
