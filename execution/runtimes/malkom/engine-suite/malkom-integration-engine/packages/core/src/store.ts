import { DatabaseSync } from 'node:sqlite';
import type { BindingRecord, ConnectionRecord, CustomDefRecord, RunRecord } from './schemas.js';

/**
 * State port + shipped stores (in-memory for tests, SQLite for real use),
 * following the sibling engines: WAL, NORMAL sync, 5s busy timeout.
 */

export interface IntegrateStateStore {
  putConnection(record: ConnectionRecord): void;
  getConnection(id: string): ConnectionRecord | null;
  listConnections(): ConnectionRecord[];
  deleteConnection(id: string): void;

  putBinding(record: BindingRecord): void;
  getBinding(id: string): BindingRecord | null;
  listBindings(connectionId: string | null): BindingRecord[];
  deleteBinding(id: string): void;

  putCustomDef(record: CustomDefRecord): void;
  getCustomDef(id: string): CustomDefRecord | null;
  listCustomDefs(): CustomDefRecord[];
  deleteCustomDef(id: string): void;

  putRun(record: RunRecord): void;
  getRun(id: string): RunRecord | null;
  listRuns(connectionId: string | null, status: string | null, limit: number, offset: number): RunRecord[];
  countAttempts(connectionId: string, itemId: string): number;
  pruneRuns(maxAgeMs: number, maxCount: number): void;
  close(): void;
}

export class InMemoryIntegrateStateStore implements IntegrateStateStore {
  private readonly connections = new Map<string, ConnectionRecord>();
  private readonly bindings = new Map<string, BindingRecord>();
  private readonly customDefs = new Map<string, CustomDefRecord>();
  private runs: RunRecord[] = [];

  putConnection(record: ConnectionRecord): void {
    this.connections.set(record.definition.id, record);
  }
  getConnection(id: string): ConnectionRecord | null {
    return this.connections.get(id) ?? null;
  }
  listConnections(): ConnectionRecord[] {
    return [...this.connections.values()];
  }
  deleteConnection(id: string): void {
    this.connections.delete(id);
  }

  putBinding(record: BindingRecord): void {
    this.bindings.set(record.definition.id, record);
  }
  getBinding(id: string): BindingRecord | null {
    return this.bindings.get(id) ?? null;
  }
  listBindings(connectionId: string | null): BindingRecord[] {
    return [...this.bindings.values()].filter(
      (record) => connectionId === null || record.definition.connectionId === connectionId,
    );
  }
  deleteBinding(id: string): void {
    this.bindings.delete(id);
  }

  putCustomDef(record: CustomDefRecord): void {
    this.customDefs.set(record.definition.id, record);
  }
  getCustomDef(id: string): CustomDefRecord | null {
    return this.customDefs.get(id) ?? null;
  }
  listCustomDefs(): CustomDefRecord[] {
    return [...this.customDefs.values()];
  }
  deleteCustomDef(id: string): void {
    this.customDefs.delete(id);
  }

  putRun(record: RunRecord): void {
    this.runs = [...this.runs.filter((run) => run.id !== record.id), record];
  }
  getRun(id: string): RunRecord | null {
    return this.runs.find((run) => run.id === id) ?? null;
  }
  listRuns(connectionId: string | null, status: string | null, limit: number, offset: number): RunRecord[] {
    return this.runs
      .filter(
        (run) =>
          (connectionId === null || run.connectionId === connectionId) && (status === null || run.status === status),
      )
      .slice()
      .reverse()
      .slice(offset, offset + limit);
  }
  countAttempts(connectionId: string, itemId: string): number {
    return this.runs.filter((run) => run.connectionId === connectionId && run.itemId === itemId).length;
  }
  pruneRuns(maxAgeMs: number, maxCount: number): void {
    const cutoff = Date.now() - maxAgeMs;
    this.runs = this.runs.filter((run) => Date.parse(run.createdAt) >= cutoff).slice(-maxCount);
  }
  close(): void {
    this.connections.clear();
    this.bindings.clear();
    this.customDefs.clear();
    this.runs = [];
  }
}

interface JsonRow {
  body: string;
}

export class SqliteIntegrateStateStore implements IntegrateStateStore {
  private readonly db: DatabaseSync;

  constructor(path: string) {
    this.db = new DatabaseSync(path);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      PRAGMA busy_timeout = 5000;
      CREATE TABLE IF NOT EXISTS malkom_integrate_connections (
        id TEXT PRIMARY KEY, body TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS malkom_integrate_bindings (
        id TEXT PRIMARY KEY, connection_id TEXT NOT NULL, body TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS malkom_integrate_custom_defs (
        id TEXT PRIMARY KEY, body TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS malkom_integrate_runs (
        id TEXT PRIMARY KEY, connection_id TEXT NOT NULL, item_id TEXT NOT NULL,
        status TEXT NOT NULL, created_at TEXT NOT NULL, body TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_integrate_runs_conn
        ON malkom_integrate_runs (connection_id, item_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_integrate_bindings_conn
        ON malkom_integrate_bindings (connection_id);
    `);
  }

  private putJson(table: string, id: string, body: unknown, extra: Record<string, string> = {}): void {
    const columns = ['id', ...Object.keys(extra), 'body'];
    const placeholders = columns.map(() => '?').join(', ');
    const updates = columns
      .filter((column) => column !== 'id')
      .map((column) => `${column}=excluded.${column}`)
      .join(', ');
    this.db
      .prepare(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})
                ON CONFLICT(id) DO UPDATE SET ${updates}`)
      .run(id, ...Object.values(extra), JSON.stringify(body));
  }

  private getJson<T>(table: string, id: string): T | null {
    const row = this.db.prepare(`SELECT body FROM ${table} WHERE id = ?`).get(id) as JsonRow | undefined;
    return row === undefined ? null : (JSON.parse(row.body) as T);
  }

  private listJson<T>(table: string, where = '', params: (string | number)[] = []): T[] {
    const rows = this.db.prepare(`SELECT body FROM ${table} ${where} ORDER BY id`).all(...params) as unknown as JsonRow[];
    return rows.map((row) => JSON.parse(row.body) as T);
  }

  putConnection(record: ConnectionRecord): void {
    this.putJson('malkom_integrate_connections', record.definition.id, record);
  }
  getConnection(id: string): ConnectionRecord | null {
    return this.getJson<ConnectionRecord>('malkom_integrate_connections', id);
  }
  listConnections(): ConnectionRecord[] {
    return this.listJson<ConnectionRecord>('malkom_integrate_connections');
  }
  deleteConnection(id: string): void {
    this.db.prepare('DELETE FROM malkom_integrate_connections WHERE id = ?').run(id);
  }

  putBinding(record: BindingRecord): void {
    this.putJson('malkom_integrate_bindings', record.definition.id, record, {
      connection_id: record.definition.connectionId,
    });
  }
  getBinding(id: string): BindingRecord | null {
    return this.getJson<BindingRecord>('malkom_integrate_bindings', id);
  }
  listBindings(connectionId: string | null): BindingRecord[] {
    return connectionId === null
      ? this.listJson<BindingRecord>('malkom_integrate_bindings')
      : this.listJson<BindingRecord>('malkom_integrate_bindings', 'WHERE connection_id = ?', [connectionId]);
  }
  deleteBinding(id: string): void {
    this.db.prepare('DELETE FROM malkom_integrate_bindings WHERE id = ?').run(id);
  }

  putCustomDef(record: CustomDefRecord): void {
    this.putJson('malkom_integrate_custom_defs', record.definition.id, record);
  }
  getCustomDef(id: string): CustomDefRecord | null {
    return this.getJson<CustomDefRecord>('malkom_integrate_custom_defs', id);
  }
  listCustomDefs(): CustomDefRecord[] {
    return this.listJson<CustomDefRecord>('malkom_integrate_custom_defs');
  }
  deleteCustomDef(id: string): void {
    this.db.prepare('DELETE FROM malkom_integrate_custom_defs WHERE id = ?').run(id);
  }

  putRun(record: RunRecord): void {
    this.db
      .prepare(`INSERT INTO malkom_integrate_runs (id, connection_id, item_id, status, created_at, body)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET status=excluded.status, body=excluded.body`)
      .run(record.id, record.connectionId, record.itemId, record.status, record.createdAt, JSON.stringify(record));
  }
  getRun(id: string): RunRecord | null {
    const row = this.db.prepare('SELECT body FROM malkom_integrate_runs WHERE id = ?').get(id) as JsonRow | undefined;
    return row === undefined ? null : (JSON.parse(row.body) as RunRecord);
  }
  listRuns(connectionId: string | null, status: string | null, limit: number, offset: number): RunRecord[] {
    const clauses: string[] = [];
    const params: (string | number)[] = [];
    if (connectionId !== null) {
      clauses.push('connection_id = ?');
      params.push(connectionId);
    }
    if (status !== null) {
      clauses.push('status = ?');
      params.push(status);
    }
    const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = this.db
      .prepare(`SELECT body FROM malkom_integrate_runs ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
      .all(...params, limit, offset) as unknown as JsonRow[];
    return rows.map((row) => JSON.parse(row.body) as RunRecord);
  }
  countAttempts(connectionId: string, itemId: string): number {
    const row = this.db
      .prepare('SELECT COUNT(*) AS n FROM malkom_integrate_runs WHERE connection_id = ? AND item_id = ?')
      .get(connectionId, itemId) as { n: number };
    return row.n;
  }
  pruneRuns(maxAgeMs: number, maxCount: number): void {
    const cutoff = new Date(Date.now() - maxAgeMs).toISOString();
    this.db.prepare('DELETE FROM malkom_integrate_runs WHERE created_at < ?').run(cutoff);
    this.db
      .prepare(`DELETE FROM malkom_integrate_runs WHERE id NOT IN
                (SELECT id FROM malkom_integrate_runs ORDER BY created_at DESC LIMIT ?)`)
      .run(maxCount);
  }
  close(): void {
    this.db.close();
  }
}
