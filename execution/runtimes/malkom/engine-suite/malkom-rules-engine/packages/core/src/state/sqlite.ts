import { DatabaseSync } from 'node:sqlite';
import type {
  DecisionDeleteFilter,
  DecisionQuery,
  GroupHeadFilter,
  RegistryRecord,
  RetentionPolicy,
  RulesStateStore,
} from '../ports/statestore.js';
import type { DecisionRecord, GroupHead, GroupVersionRecord } from '../domain/types.js';

/**
 * SQLite-backed RulesStateStore over node:sqlite — the single-instance
 * default, zero dependencies. Table shapes follow the sibling engine's
 * proven pattern: the full JSON record in one column, hot query fields
 * extracted as indexed columns; the `malkom_rules_` prefix namespaces the
 * engine inside a shared file or the host's own SQLite database.
 */
export class SqliteRulesStateStore implements RulesStateStore {
  private db: DatabaseSync;

  constructor(filename = ':memory:') {
    this.db = new DatabaseSync(filename);
  }

  async init(): Promise<void> {
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      PRAGMA busy_timeout = 5000;
      CREATE TABLE IF NOT EXISTS malkom_rules_kv (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS malkom_rules_registry (
        version INTEGER PRIMARY KEY,
        hash TEXT NOT NULL,
        created_at TEXT NOT NULL,
        record TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS malkom_rules_groups (
        id TEXT PRIMARY KEY,
        entity TEXT NOT NULL,
        state TEXT NOT NULL,
        name TEXT NOT NULL,
        record TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS malkom_rules_groups_entity_state
        ON malkom_rules_groups (entity, state);
      CREATE TABLE IF NOT EXISTS malkom_rules_versions (
        group_id TEXT NOT NULL,
        version INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        record TEXT NOT NULL,
        PRIMARY KEY (group_id, version)
      );
      CREATE TABLE IF NOT EXISTS malkom_rules_decisions (
        id TEXT PRIMARY KEY,
        entity TEXT NOT NULL,
        entity_id TEXT,
        as_of TEXT NOT NULL,
        ruleset_version INTEGER NOT NULL,
        mode TEXT NOT NULL,
        created_at TEXT NOT NULL,
        record TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS malkom_rules_decisions_entity_created
        ON malkom_rules_decisions (entity, created_at DESC);
      CREATE INDEX IF NOT EXISTS malkom_rules_decisions_entity_id
        ON malkom_rules_decisions (entity_id);
    `);
  }

  /** BEGIN IMMEDIATE: take the write lock up front, fail fast on contention. */
  private tx<T>(fn: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const out = fn();
      this.db.exec('COMMIT');
      return out;
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }

  // --- registry ---

  async putRegistry(record: RegistryRecord): Promise<void> {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO malkom_rules_registry (version, hash, created_at, record)
         VALUES (?, ?, ?, ?)`,
      )
      .run(record.version, record.hash, record.createdAt, JSON.stringify(record));
  }

  async getRegistry(version?: number): Promise<RegistryRecord | null> {
    const row =
      version !== undefined
        ? this.db.prepare('SELECT record FROM malkom_rules_registry WHERE version = ?').get(version)
        : this.db.prepare('SELECT record FROM malkom_rules_registry ORDER BY version DESC LIMIT 1').get();
    return row ? (JSON.parse((row as { record: string }).record) as RegistryRecord) : null;
  }

  // --- group heads ---

  async putGroupHead(head: GroupHead): Promise<void> {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO malkom_rules_groups (id, entity, state, name, record)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(head.id, head.entity, head.state, head.name, JSON.stringify(head));
  }

  async getGroupHead(id: string): Promise<GroupHead | null> {
    const row = this.db.prepare('SELECT record FROM malkom_rules_groups WHERE id = ?').get(id);
    return row ? (JSON.parse((row as { record: string }).record) as GroupHead) : null;
  }

  async listGroupHeads(filter: GroupHeadFilter = {}): Promise<GroupHead[]> {
    const clauses: string[] = [];
    const params: string[] = [];
    if (filter.entity !== undefined) {
      clauses.push('entity = ?');
      params.push(filter.entity);
    }
    if (filter.state !== undefined) {
      clauses.push('state = ?');
      params.push(filter.state);
    }
    const where = clauses.length > 0 ? ` WHERE ${clauses.join(' AND ')}` : '';
    const rows = this.db
      .prepare(`SELECT record FROM malkom_rules_groups${where} ORDER BY id`)
      .all(...params) as Array<{ record: string }>;
    return rows.map((r) => JSON.parse(r.record) as GroupHead);
  }

  // --- version snapshots ---

  async putGroupVersion(record: GroupVersionRecord): Promise<void> {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO malkom_rules_versions (group_id, version, created_at, record)
         VALUES (?, ?, ?, ?)`,
      )
      .run(record.groupId, record.version, record.createdAt, JSON.stringify(record));
  }

  async getGroupVersion(groupId: string, version: number): Promise<GroupVersionRecord | null> {
    const row = this.db
      .prepare('SELECT record FROM malkom_rules_versions WHERE group_id = ? AND version = ?')
      .get(groupId, version);
    return row ? (JSON.parse((row as { record: string }).record) as GroupVersionRecord) : null;
  }

  async listGroupVersions(groupId: string): Promise<GroupVersionRecord[]> {
    const rows = this.db
      .prepare('SELECT record FROM malkom_rules_versions WHERE group_id = ? ORDER BY version')
      .all(groupId) as Array<{ record: string }>;
    return rows.map((r) => JSON.parse(r.record) as GroupVersionRecord);
  }

  // --- ruleset version counter ---

  async bumpRulesetVersion(): Promise<number> {
    return this.tx(() => {
      const row = this.db
        .prepare("SELECT value FROM malkom_rules_kv WHERE key = 'rulesetVersion'")
        .get() as { value: string } | undefined;
      const next = (row ? Number(row.value) : 0) + 1;
      this.db
        .prepare("INSERT OR REPLACE INTO malkom_rules_kv (key, value) VALUES ('rulesetVersion', ?)")
        .run(String(next));
      return next;
    });
  }

  async currentRulesetVersion(): Promise<number> {
    const row = this.db
      .prepare("SELECT value FROM malkom_rules_kv WHERE key = 'rulesetVersion'")
      .get() as { value: string } | undefined;
    return row ? Number(row.value) : 0;
  }

  // --- decision log ---

  async appendDecision(record: DecisionRecord): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO malkom_rules_decisions
           (id, entity, entity_id, as_of, ruleset_version, mode, created_at, record)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        record.id,
        record.entity,
        record.entityId,
        record.asOf,
        record.rulesetVersion,
        record.mode,
        record.createdAt,
        JSON.stringify(record),
      );
  }

  async queryDecisions(query: DecisionQuery): Promise<{ decisions: DecisionRecord[]; total: number }> {
    const clauses: string[] = [];
    const params: Array<string | number> = [];
    if (query.entity !== undefined) {
      clauses.push('entity = ?');
      params.push(query.entity);
    }
    if (query.entityId !== undefined) {
      clauses.push('entity_id = ?');
      params.push(query.entityId);
    }
    if (query.mode !== undefined) {
      clauses.push('mode = ?');
      params.push(query.mode);
    }
    if (query.since !== undefined) {
      clauses.push('as_of >= ?');
      params.push(new Date(query.since).toISOString());
    }
    if (query.until !== undefined) {
      clauses.push('as_of < ?');
      params.push(new Date(query.until).toISOString());
    }
    const where = clauses.length > 0 ? ` WHERE ${clauses.join(' AND ')}` : '';
    const total = (
      this.db.prepare(`SELECT COUNT(*) AS n FROM malkom_rules_decisions${where}`).get(...params) as {
        n: number;
      }
    ).n;
    const rows = this.db
      .prepare(`SELECT record FROM malkom_rules_decisions${where} ORDER BY id DESC LIMIT ? OFFSET ?`)
      .all(...params, query.limit ?? 100, query.offset ?? 0) as Array<{ record: string }>;
    return { decisions: rows.map((r) => JSON.parse(r.record) as DecisionRecord), total };
  }

  async deleteDecisions(filter: DecisionDeleteFilter): Promise<number> {
    const clauses: string[] = [];
    const params: string[] = [];
    if (filter.entity !== undefined) {
      clauses.push('entity = ?');
      params.push(filter.entity);
    }
    if (filter.before !== undefined) {
      clauses.push('created_at < ?');
      params.push(new Date(filter.before).toISOString());
    }
    if (filter.ids !== undefined && filter.ids.length > 0) {
      clauses.push(`id IN (${filter.ids.map(() => '?').join(', ')})`);
      params.push(...filter.ids);
    }
    if (clauses.length === 0) return 0; // engine refuses; defense in depth here
    const res = this.db
      .prepare(`DELETE FROM malkom_rules_decisions WHERE ${clauses.join(' AND ')}`)
      .run(...params);
    return Number(res.changes);
  }

  async pruneDecisions(policy: RetentionPolicy, now: Date): Promise<number> {
    let removed = 0;
    if (policy.maxAgeMs !== undefined) {
      const cutoff = new Date(now.getTime() - policy.maxAgeMs).toISOString();
      const res = this.db
        .prepare('DELETE FROM malkom_rules_decisions WHERE created_at < ?')
        .run(cutoff);
      removed += Number(res.changes);
    }
    if (policy.maxCount !== undefined) {
      const res = this.db
        .prepare(
          `DELETE FROM malkom_rules_decisions WHERE id NOT IN (
             SELECT id FROM malkom_rules_decisions ORDER BY id DESC LIMIT ?
           )`,
        )
        .run(policy.maxCount);
      removed += Number(res.changes);
    }
    return removed;
  }

  // --- kv ---

  async get(key: string): Promise<string | null> {
    const row = this.db.prepare('SELECT value FROM malkom_rules_kv WHERE key = ?').get(key) as
      | { value: string }
      | undefined;
    return row ? row.value : null;
  }

  async set(key: string, value: string): Promise<void> {
    this.db.prepare('INSERT OR REPLACE INTO malkom_rules_kv (key, value) VALUES (?, ?)').run(key, value);
  }

  async delete(key: string): Promise<void> {
    this.db.prepare('DELETE FROM malkom_rules_kv WHERE key = ?').run(key);
  }

  async compareAndSet(key: string, expect: string | null, value: string): Promise<boolean> {
    return this.tx(() => {
      const row = this.db.prepare('SELECT value FROM malkom_rules_kv WHERE key = ?').get(key) as
        | { value: string }
        | undefined;
      const current = row ? row.value : null;
      if (current !== expect) return false;
      this.db.prepare('INSERT OR REPLACE INTO malkom_rules_kv (key, value) VALUES (?, ?)').run(key, value);
      return true;
    });
  }

  async close(): Promise<void> {
    this.db.close();
  }
}
