import { DatabaseSync } from 'node:sqlite';
import type { ItemRecord, LifecycleDefinition, TransitionRecord } from './schemas.js';

/**
 * State port + shipped stores (in-memory for tests, SQLite for real use),
 * following the sibling engines: WAL, NORMAL sync, 5s busy timeout.
 */

export interface LifecycleRecord {
  definition: LifecycleDefinition;
  version: number;
  updatedAt: string;
}

export interface WorkflowStateStore {
  putLifecycle(record: LifecycleRecord): void;
  getLifecycle(id: string): LifecycleRecord | null;
  listLifecycles(): LifecycleRecord[];
  deleteLifecycle(id: string): void;
  putItem(record: ItemRecord): void;
  getItem(lifecycleId: string, itemId: string): ItemRecord | null;
  listItems(lifecycleId: string, state: string | null, limit: number, offset: number): ItemRecord[];
  appendTransition(record: TransitionRecord): void;
  listTransitions(lifecycleId: string, itemId: string | null, limit: number, offset: number): TransitionRecord[];
  close(): void;
}

export class InMemoryWorkflowStateStore implements WorkflowStateStore {
  private readonly lifecycles = new Map<string, LifecycleRecord>();
  private readonly items = new Map<string, ItemRecord>();
  private transitions: TransitionRecord[] = [];

  private key(lifecycleId: string, itemId: string): string {
    return `${lifecycleId}::${itemId}`;
  }

  putLifecycle(record: LifecycleRecord): void {
    this.lifecycles.set(record.definition.id, record);
  }
  getLifecycle(id: string): LifecycleRecord | null {
    return this.lifecycles.get(id) ?? null;
  }
  listLifecycles(): LifecycleRecord[] {
    return [...this.lifecycles.values()];
  }
  deleteLifecycle(id: string): void {
    this.lifecycles.delete(id);
  }
  putItem(record: ItemRecord): void {
    this.items.set(this.key(record.lifecycleId, record.itemId), record);
  }
  getItem(lifecycleId: string, itemId: string): ItemRecord | null {
    return this.items.get(this.key(lifecycleId, itemId)) ?? null;
  }
  listItems(lifecycleId: string, state: string | null, limit: number, offset: number): ItemRecord[] {
    return [...this.items.values()]
      .filter((item) => item.lifecycleId === lifecycleId && (state === null || item.state === state))
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
      .slice(offset, offset + limit);
  }
  appendTransition(record: TransitionRecord): void {
    this.transitions.push(record);
  }
  listTransitions(lifecycleId: string, itemId: string | null, limit: number, offset: number): TransitionRecord[] {
    return this.transitions
      .filter((entry) => entry.lifecycleId === lifecycleId && (itemId === null || entry.itemId === itemId))
      .slice()
      .reverse()
      .slice(offset, offset + limit);
  }
  close(): void {
    this.lifecycles.clear();
    this.items.clear();
    this.transitions = [];
  }
}

export class SqliteWorkflowStateStore implements WorkflowStateStore {
  private readonly db: DatabaseSync;

  constructor(path: string) {
    this.db = new DatabaseSync(path);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      PRAGMA busy_timeout = 5000;
      CREATE TABLE IF NOT EXISTS malkom_workflow_lifecycles (
        id TEXT PRIMARY KEY, definition TEXT NOT NULL,
        version INTEGER NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS malkom_workflow_items (
        lifecycle_id TEXT NOT NULL, item_id TEXT NOT NULL, state TEXT NOT NULL,
        started_at TEXT NOT NULL, accrued_ms INTEGER NOT NULL,
        running_since TEXT, completed_at TEXT,
        PRIMARY KEY (lifecycle_id, item_id)
      );
      CREATE INDEX IF NOT EXISTS idx_workflow_items_state
        ON malkom_workflow_items (lifecycle_id, state);
      CREATE TABLE IF NOT EXISTS malkom_workflow_transitions (
        id TEXT PRIMARY KEY, lifecycle_id TEXT NOT NULL, item_id TEXT NOT NULL,
        from_state TEXT NOT NULL, to_state TEXT NOT NULL, actor TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_workflow_transitions_item
        ON malkom_workflow_transitions (lifecycle_id, item_id, created_at);
    `);
  }

  putLifecycle(record: LifecycleRecord): void {
    this.db
      .prepare(`INSERT INTO malkom_workflow_lifecycles (id, definition, version, updated_at)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET definition=excluded.definition,
                  version=excluded.version, updated_at=excluded.updated_at`)
      .run(record.definition.id, JSON.stringify(record.definition), record.version, record.updatedAt);
  }

  getLifecycle(id: string): LifecycleRecord | null {
    const row = this.db.prepare('SELECT definition, version, updated_at FROM malkom_workflow_lifecycles WHERE id = ?').get(id) as
      | { definition: string; version: number; updated_at: string }
      | undefined;
    if (row === undefined) return null;
    return {
      definition: JSON.parse(row.definition) as LifecycleRecord['definition'],
      version: row.version,
      updatedAt: row.updated_at,
    };
  }

  listLifecycles(): LifecycleRecord[] {
    const rows = this.db.prepare('SELECT id FROM malkom_workflow_lifecycles ORDER BY id').all() as { id: string }[];
    return rows.map((row) => this.getLifecycle(row.id)).filter((record): record is LifecycleRecord => record !== null);
  }

  deleteLifecycle(id: string): void {
    this.db.prepare('DELETE FROM malkom_workflow_lifecycles WHERE id = ?').run(id);
  }

  putItem(record: ItemRecord): void {
    this.db
      .prepare(`INSERT INTO malkom_workflow_items (lifecycle_id, item_id, state, started_at, accrued_ms, running_since, completed_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(lifecycle_id, item_id) DO UPDATE SET state=excluded.state,
                  accrued_ms=excluded.accrued_ms, running_since=excluded.running_since,
                  completed_at=excluded.completed_at`)
      .run(record.lifecycleId, record.itemId, record.state, record.startedAt, record.accruedMs, record.runningSince, record.completedAt);
  }

  getItem(lifecycleId: string, itemId: string): ItemRecord | null {
    const row = this.db
      .prepare('SELECT * FROM malkom_workflow_items WHERE lifecycle_id = ? AND item_id = ?')
      .get(lifecycleId, itemId) as
      | { lifecycle_id: string; item_id: string; state: string; started_at: string; accrued_ms: number; running_since: string | null; completed_at: string | null }
      | undefined;
    if (row === undefined) return null;
    return this.rowToItem(row);
  }

  listItems(lifecycleId: string, state: string | null, limit: number, offset: number): ItemRecord[] {
    const rows = (state === null
      ? this.db.prepare('SELECT * FROM malkom_workflow_items WHERE lifecycle_id = ? ORDER BY started_at DESC LIMIT ? OFFSET ?').all(lifecycleId, limit, offset)
      : this.db.prepare('SELECT * FROM malkom_workflow_items WHERE lifecycle_id = ? AND state = ? ORDER BY started_at DESC LIMIT ? OFFSET ?').all(lifecycleId, state, limit, offset)) as {
      lifecycle_id: string; item_id: string; state: string; started_at: string; accrued_ms: number; running_since: string | null; completed_at: string | null;
    }[];
    return rows.map((row) => this.rowToItem(row));
  }

  appendTransition(record: TransitionRecord): void {
    this.db
      .prepare('INSERT INTO malkom_workflow_transitions (id, lifecycle_id, item_id, from_state, to_state, actor, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(record.id, record.lifecycleId, record.itemId, record.fromState, record.toState, record.actor, record.createdAt);
  }

  listTransitions(lifecycleId: string, itemId: string | null, limit: number, offset: number): TransitionRecord[] {
    const rows = (itemId === null
      ? this.db.prepare('SELECT * FROM malkom_workflow_transitions WHERE lifecycle_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?').all(lifecycleId, limit, offset)
      : this.db.prepare('SELECT * FROM malkom_workflow_transitions WHERE lifecycle_id = ? AND item_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?').all(lifecycleId, itemId, limit, offset)) as {
      id: string; lifecycle_id: string; item_id: string; from_state: string; to_state: string; actor: string; created_at: string;
    }[];
    return rows.map((row) => ({
      id: row.id,
      lifecycleId: row.lifecycle_id,
      itemId: row.item_id,
      fromState: row.from_state,
      toState: row.to_state,
      actor: row.actor,
      createdAt: row.created_at,
    }));
  }

  private rowToItem(row: { lifecycle_id: string; item_id: string; state: string; started_at: string; accrued_ms: number; running_since: string | null; completed_at: string | null }): ItemRecord {
    return {
      lifecycleId: row.lifecycle_id,
      itemId: row.item_id,
      state: row.state,
      startedAt: row.started_at,
      accruedMs: row.accrued_ms,
      runningSince: row.running_since,
      completedAt: row.completed_at,
    };
  }

  close(): void {
    this.db.close();
  }
}
