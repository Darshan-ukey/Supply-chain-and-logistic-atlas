import { DatabaseSync } from 'node:sqlite';
import type { ReadReach } from './access.js';
import type { Handover, HandoverEvent } from './engine.js';
import { SCOPE_FIELDS, scopeMatches } from './schemas.js';

/**
 * The state port and the two shipped stores. In-memory for tests and embedded
 * use; SQLite through Node's built-in driver for real deployments — same
 * bargain as every sibling engine, so there is no native module and no broker.
 *
 * `commit` writes the projection, the event and the idempotency record as one
 * unit. That is the whole transactional requirement: a handover whose event
 * landed but whose projection did not would report a clock nobody can explain.
 */

/**
 * The query surface. Everything above the single case — the resolver's desk,
 * the raiser's "what am I waiting on", the breach list, and every fact the
 * metrics engine reads — is one of these. A ledger nobody can look across is
 * an archive, not an operational system.
 */
export interface HandoverQuery {
  readonly status?: readonly string[];
  readonly holder?: readonly string[];
  readonly destination?: readonly string[];
  readonly reasonCode?: readonly string[];
  readonly subjectType?: string;
  /** Who raised it — the raiser's own list. */
  readonly createdBy?: string;
  readonly clusterKey?: string;
  readonly deflectionKey?: string;
  /** Deadline earlier than this instant: the at-risk and breached list. */
  readonly dueBefore?: string;
  readonly raisedAfter?: string;
  readonly raisedBefore?: string;
  /**
   * What the asking viewer may see. Applied as query terms rather than as a
   * filter afterwards: a desk with ten thousand handovers cannot be filtered
   * in memory, and a page silently trimmed after the fact reports a total that
   * is a lie. Absent means unrestricted, so every caller-facing path must set
   * it — the engine's read methods do.
   */
  readonly reach?: ReadReach;
  readonly order?: 'due' | 'raised' | 'raised-desc';
  readonly limit?: number;
  readonly offset?: number;
}

export interface IdempotencyRecord {
  readonly handoverId: string;
  readonly eventId: string;
}

export interface HandoverStore {
  get(handoverId: string): Handover | null;
  events(handoverId: string): readonly HandoverEvent[];
  findByIdempotencyKey(key: string): IdempotencyRecord | null;
  commit(handover: Handover, event: HandoverEvent, idempotencyKey: string): void;
  /** Open handovers on one subject — what the case panel and dedupe read. */
  bySubject(subjectType: string, subjectId: string): readonly Handover[];
  /** Open handovers sharing a cluster key: one answer settles them all. */
  byCluster(clusterKey: string): readonly Handover[];
  /** Handovers matching a query, ordered and paged. */
  list(query: HandoverQuery): readonly Handover[];
  /** How many match, ignoring limit and offset. */
  count(query: HandoverQuery): number;
  close(): void;
}

const inSet = (values: readonly string[] | undefined, candidate: string): boolean =>
  values === undefined || values.length === 0 || values.includes(candidate);

/** One definition of what a query means, shared by every store. */
export const matchesQuery = (handover: Handover, query: HandoverQuery): boolean => {
  if (!inSet(query.status, handover.status)) return false;
  if (!inSet(query.holder, handover.holder)) return false;
  if (!inSet(query.reasonCode, handover.reasonCode)) return false;
  if (query.destination !== undefined && query.destination.length > 0) {
    if (handover.destination === null || !query.destination.includes(handover.destination)) return false;
  }
  if (query.subjectType !== undefined && handover.subject.type !== query.subjectType) return false;
  if (query.createdBy !== undefined && handover.createdBy !== query.createdBy) return false;
  if (query.clusterKey !== undefined && handover.clusterKey !== query.clusterKey) return false;
  if (query.deflectionKey !== undefined && handover.deflectionKey !== query.deflectionKey) return false;
  if (query.dueBefore !== undefined) {
    if (handover.dueAt === null || Date.parse(handover.dueAt) >= Date.parse(query.dueBefore)) return false;
  }
  if (query.raisedAfter !== undefined && Date.parse(handover.createdAt) < Date.parse(query.raisedAfter)) return false;
  if (query.raisedBefore !== undefined && Date.parse(handover.createdAt) >= Date.parse(query.raisedBefore)) return false;
  if (query.reach !== undefined && !withinReach(handover, query.reach)) return false;
  return true;
};

/**
 * Reachable when the viewer raised it, or when any read grant covers the work
 * OR the desk it sits on. Either is enough: a raiser must be able to follow
 * their own question into a department they have no other business in, and a
 * desk must be able to see a question it has been handed from a country it
 * does not otherwise cover.
 */
export const withinReach = (handover: Handover, reach: ReadReach): boolean => {
  if (reach.unrestricted) return true;
  if (reach.ownRaisesOf !== null && handover.createdBy === reach.ownRaisesOf) return true;
  const watching = handover.participants.filter((participant) => participant.removedAt === null);
  return reach.scopes.some(
    (scope) =>
      scopeMatches(scope, handover.scope) ||
      scopeMatches(scope, handover.destinationScope) ||
      // A desk tagged in can see it. That is the whole point of tagging one in
      // rather than transferring the handover away from the desk that has it.
      watching.some((participant) => scopeMatches(scope, participant.scope)),
  );
};

/** Undated work sorts last on a deadline order rather than first. */
export const orderHandovers = (rows: Handover[], order: HandoverQuery['order']): Handover[] => {
  const by = order ?? 'raised';
  return rows.sort((a, b) => {
    if (by === 'due') {
      if (a.dueAt === null && b.dueAt === null) return a.createdAt.localeCompare(b.createdAt);
      if (a.dueAt === null) return 1;
      if (b.dueAt === null) return -1;
      return a.dueAt.localeCompare(b.dueAt);
    }
    return by === 'raised-desc' ? b.createdAt.localeCompare(a.createdAt) : a.createdAt.localeCompare(b.createdAt);
  });
};

const paged = (rows: Handover[], query: HandoverQuery): Handover[] =>
  rows.slice(query.offset ?? 0, (query.offset ?? 0) + (query.limit ?? 200));

export class InMemoryHandoverStore implements HandoverStore {
  private readonly handovers = new Map<string, Handover>();
  private readonly log = new Map<string, HandoverEvent[]>();
  private readonly keys = new Map<string, IdempotencyRecord>();

  get(handoverId: string): Handover | null {
    return this.handovers.get(handoverId) ?? null;
  }
  events(handoverId: string): readonly HandoverEvent[] {
    return this.log.get(handoverId) ?? [];
  }
  findByIdempotencyKey(key: string): IdempotencyRecord | null {
    return this.keys.get(key) ?? null;
  }
  commit(handover: Handover, event: HandoverEvent, idempotencyKey: string): void {
    this.handovers.set(handover.id, handover);
    const events = this.log.get(handover.id) ?? [];
    events.push(event);
    this.log.set(handover.id, events);
    this.keys.set(idempotencyKey, { handoverId: handover.id, eventId: event.eventId });
  }
  bySubject(subjectType: string, subjectId: string): readonly Handover[] {
    return [...this.handovers.values()].filter(
      (handover) => handover.subject.type === subjectType && handover.subject.id === subjectId,
    );
  }
  byCluster(clusterKey: string): readonly Handover[] {
    return [...this.handovers.values()].filter((handover) => handover.clusterKey === clusterKey);
  }
  list(query: HandoverQuery): readonly Handover[] {
    const matched = [...this.handovers.values()].filter((handover) => matchesQuery(handover, query));
    return paged(orderHandovers(matched, query.order), query);
  }
  count(query: HandoverQuery): number {
    return [...this.handovers.values()].filter((handover) => matchesQuery(handover, query)).length;
  }
  close(): void {
    this.handovers.clear();
    this.log.clear();
    this.keys.clear();
  }
}

export class SqliteHandoverStore implements HandoverStore {
  private readonly db: DatabaseSync;

  constructor(path: string) {
    this.db = new DatabaseSync(path);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      PRAGMA busy_timeout = 5000;
      CREATE TABLE IF NOT EXISTS malkom_exception_handovers (
        id TEXT PRIMARY KEY, version INTEGER NOT NULL, status TEXT NOT NULL,
        reason_code TEXT NOT NULL, subject_type TEXT NOT NULL, subject_id TEXT NOT NULL,
        cluster_key TEXT, deflection_key TEXT, holder TEXT NOT NULL, destination TEXT,
        due_at TEXT, created_at TEXT NOT NULL, created_by TEXT NOT NULL DEFAULT '',
        w_region TEXT DEFAULT '', w_country TEXT DEFAULT '', w_office TEXT DEFAULT '',
        w_department TEXT DEFAULT '', w_subDepartment TEXT DEFAULT '',
        w_queue TEXT DEFAULT '', w_subQueue TEXT DEFAULT '', w_workType TEXT DEFAULT '',
        d_region TEXT DEFAULT '', d_country TEXT DEFAULT '', d_office TEXT DEFAULT '',
        d_department TEXT DEFAULT '', d_subDepartment TEXT DEFAULT '',
        d_queue TEXT DEFAULT '', d_subQueue TEXT DEFAULT '', d_workType TEXT DEFAULT '',
        document TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_exception_subject
        ON malkom_exception_handovers (subject_type, subject_id);
      CREATE INDEX IF NOT EXISTS idx_exception_cluster
        ON malkom_exception_handovers (cluster_key) WHERE cluster_key IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_exception_desk
        ON malkom_exception_handovers (status, holder, destination, due_at);
      CREATE INDEX IF NOT EXISTS idx_exception_deflect
        ON malkom_exception_handovers (reason_code, deflection_key, status)
        WHERE deflection_key IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_exception_raiser
        ON malkom_exception_handovers (created_by, status, due_at);
      CREATE INDEX IF NOT EXISTS idx_exception_reach
        ON malkom_exception_handovers (d_region, d_country, d_office, d_department, status);
      CREATE TABLE IF NOT EXISTS malkom_exception_events (
        event_id TEXT PRIMARY KEY, handover_id TEXT NOT NULL, sequence INTEGER NOT NULL,
        type TEXT NOT NULL, at TEXT NOT NULL, document TEXT NOT NULL,
        UNIQUE (handover_id, sequence)
      );
      CREATE INDEX IF NOT EXISTS idx_exception_events_case
        ON malkom_exception_events (handover_id, sequence);
      CREATE TABLE IF NOT EXISTS malkom_exception_participants (
        handover_id TEXT NOT NULL, destination_id TEXT NOT NULL,
        region TEXT DEFAULT '', country TEXT DEFAULT '', office TEXT DEFAULT '',
        department TEXT DEFAULT '', subDepartment TEXT DEFAULT '',
        queue TEXT DEFAULT '', subQueue TEXT DEFAULT '',
        active INTEGER NOT NULL DEFAULT 1,
        PRIMARY KEY (handover_id, destination_id)
      );
      CREATE INDEX IF NOT EXISTS idx_exception_participant_reach
        ON malkom_exception_participants (active, region, country, office, department);
      CREATE TABLE IF NOT EXISTS malkom_exception_idempotency (
        key TEXT PRIMARY KEY, handover_id TEXT NOT NULL, event_id TEXT NOT NULL
      );
    `);
    // Forward compatibility for a state file written by an earlier build:
    // CREATE TABLE IF NOT EXISTS will not add a column to a table that is
    // already there, and a missing column here is a query that returns
    // nothing rather than an error, which is the worse failure.
    try {
      this.db.exec("ALTER TABLE malkom_exception_handovers ADD COLUMN created_by TEXT NOT NULL DEFAULT ''");
    } catch {
      // already present, which is the normal case
    }
    try {
      this.db.exec('ALTER TABLE malkom_exception_handovers ADD COLUMN deflection_key TEXT');
    } catch {
      // already present
    }
    for (const prefix of ['w', 'd']) {
      for (const field of SCOPE_FIELDS) {
        try {
          this.db.exec(`ALTER TABLE malkom_exception_handovers ADD COLUMN ${prefix}_${field} TEXT DEFAULT ''`);
        } catch {
          // already present
        }
      }
    }
  }

  /** One WHERE clause, built from the same query the port defines. */
  private where(query: HandoverQuery): { sql: string; values: (string | number)[] } {
    const clauses: string[] = [];
    const values: (string | number)[] = [];
    const anyOf = (column: string, list: readonly string[] | undefined): void => {
      if (list === undefined || list.length === 0) return;
      clauses.push(`${column} IN (${list.map(() => '?').join(', ')})`);
      values.push(...list);
    };
    anyOf('status', query.status);
    anyOf('holder', query.holder);
    anyOf('reason_code', query.reasonCode);
    anyOf('destination', query.destination);
    if (query.subjectType !== undefined) { clauses.push('subject_type = ?'); values.push(query.subjectType); }
    if (query.createdBy !== undefined) { clauses.push('created_by = ?'); values.push(query.createdBy); }
    if (query.clusterKey !== undefined) { clauses.push('cluster_key = ?'); values.push(query.clusterKey); }
    if (query.deflectionKey !== undefined) { clauses.push('deflection_key = ?'); values.push(query.deflectionKey); }
    if (query.dueBefore !== undefined) { clauses.push('due_at IS NOT NULL AND due_at < ?'); values.push(query.dueBefore); }
    if (query.raisedAfter !== undefined) { clauses.push('created_at >= ?'); values.push(query.raisedAfter); }
    if (query.raisedBefore !== undefined) { clauses.push('created_at < ?'); values.push(query.raisedBefore); }

    // A grant becomes SQL rather than a post-filter. Each grant is an AND of
    // the fields it pins; reach is the OR of the grants, matched against the
    // work scope or the desk scope, plus the viewer's own raises.
    const reach = query.reach;
    if (reach !== undefined && !reach.unrestricted) {
      const alternatives: string[] = [];
      if (reach.ownRaisesOf !== null) { alternatives.push('created_by = ?'); values.push(reach.ownRaisesOf); }
      for (const scope of reach.scopes) {
        const pinned = SCOPE_FIELDS.filter((field) => (scope[field] ?? '') !== '');
        if (pinned.length === 0) { alternatives.push('1=1'); continue; }
        for (const prefix of ['w', 'd'] as const) {
          alternatives.push(`(${pinned.map((field) => `${prefix}_${field} = ?`).join(' AND ')})`);
          values.push(...pinned.map((field) => scope[field] ?? ''));
        }
        // …and any desk tagged in, which is a join rather than a column.
        alternatives.push(
          `EXISTS (SELECT 1 FROM malkom_exception_participants p
                    WHERE p.handover_id = malkom_exception_handovers.id AND p.active = 1
                      AND ${pinned.map((field) => `p.${field} = ?`).join(' AND ')})`,
        );
        values.push(...pinned.map((field) => scope[field] ?? ''));
      }
      // No grants at all means no rows. Deny by default, in SQL.
      clauses.push(alternatives.length === 0 ? '1=0' : `(${alternatives.join(' OR ')})`);
    }
    return { sql: clauses.length === 0 ? '' : ` WHERE ${clauses.join(' AND ')}`, values };
  }

  list(query: HandoverQuery): readonly Handover[] {
    const { sql, values } = this.where(query);
    // Undated work sorts last on a deadline order, matching the shared helper.
    const order =
      query.order === 'due' ? ' ORDER BY due_at IS NULL, due_at, created_at'
      : query.order === 'raised-desc' ? ' ORDER BY created_at DESC'
      : ' ORDER BY created_at';
    const rows = this.db
      .prepare(`SELECT document FROM malkom_exception_handovers${sql}${order} LIMIT ? OFFSET ?`)
      .all(...values, query.limit ?? 200, query.offset ?? 0) as { document: string }[];
    return rows.map((row) => JSON.parse(row.document) as Handover);
  }

  count(query: HandoverQuery): number {
    const { sql, values } = this.where(query);
    const row = this.db
      .prepare(`SELECT COUNT(*) AS n FROM malkom_exception_handovers${sql}`)
      .get(...values) as { n: number } | undefined;
    return row?.n ?? 0;
  }

  get(handoverId: string): Handover | null {
    const row = this.db
      .prepare('SELECT document FROM malkom_exception_handovers WHERE id = ?')
      .get(handoverId) as { document: string } | undefined;
    return row === undefined ? null : (JSON.parse(row.document) as Handover);
  }

  events(handoverId: string): readonly HandoverEvent[] {
    const rows = this.db
      .prepare('SELECT document FROM malkom_exception_events WHERE handover_id = ? ORDER BY sequence')
      .all(handoverId) as { document: string }[];
    return rows.map((row) => JSON.parse(row.document) as HandoverEvent);
  }

  findByIdempotencyKey(key: string): IdempotencyRecord | null {
    const row = this.db
      .prepare('SELECT handover_id, event_id FROM malkom_exception_idempotency WHERE key = ?')
      .get(key) as { handover_id: string; event_id: string } | undefined;
    return row === undefined ? null : { handoverId: row.handover_id, eventId: row.event_id };
  }

  commit(handover: Handover, event: HandoverEvent, idempotencyKey: string): void {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db
        .prepare(
          `INSERT INTO malkom_exception_handovers
             (id, version, status, reason_code, subject_type, subject_id, cluster_key,
              deflection_key, holder, destination, due_at, created_at, created_by,
              w_region, w_country, w_office, w_department, w_subDepartment, w_queue, w_subQueue, w_workType,
              d_region, d_country, d_office, d_department, d_subDepartment, d_queue, d_subQueue, d_workType,
              document)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET version=excluded.version, status=excluded.status,
             cluster_key=excluded.cluster_key, deflection_key=excluded.deflection_key, holder=excluded.holder,
             destination=excluded.destination, due_at=excluded.due_at, document=excluded.document`,
        )
        .run(
          handover.id,
          handover.version,
          handover.status,
          handover.reasonCode,
          handover.subject.type,
          handover.subject.id,
          handover.clusterKey,
          handover.deflectionKey,
          handover.holder,
          handover.destination,
          handover.dueAt,
          handover.createdAt,
          handover.createdBy,
          ...SCOPE_FIELDS.map((field) => handover.scope[field] ?? ''),
          ...SCOPE_FIELDS.map((field) => handover.destinationScope[field] ?? ''),
          JSON.stringify(handover),
        );
      this.db
        .prepare(
          `INSERT INTO malkom_exception_events (event_id, handover_id, sequence, type, at, document)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run(event.eventId, event.handoverId, event.sequence, event.type, event.at, JSON.stringify(event));
      this.db
        .prepare('INSERT INTO malkom_exception_idempotency (key, handover_id, event_id) VALUES (?, ?, ?)')
        .run(idempotencyKey, handover.id, event.eventId);
      // Participants are rewritten wholesale: the set is small, and a diff
      // that drifted from the document would decide who can see what.
      this.db.prepare('DELETE FROM malkom_exception_participants WHERE handover_id = ?').run(handover.id);
      const insert = this.db.prepare(
        `INSERT INTO malkom_exception_participants
           (handover_id, destination_id, region, country, office, department, subDepartment, queue, subQueue, active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      for (const participant of handover.participants) {
        insert.run(
          handover.id, participant.destinationId,
          ...SCOPE_FIELDS.map((field) => participant.scope[field] ?? ''),
          participant.removedAt === null ? 1 : 0,
        );
      }
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  bySubject(subjectType: string, subjectId: string): readonly Handover[] {
    const rows = this.db
      .prepare('SELECT document FROM malkom_exception_handovers WHERE subject_type = ? AND subject_id = ? ORDER BY created_at')
      .all(subjectType, subjectId) as { document: string }[];
    return rows.map((row) => JSON.parse(row.document) as Handover);
  }

  byCluster(clusterKey: string): readonly Handover[] {
    const rows = this.db
      .prepare('SELECT document FROM malkom_exception_handovers WHERE cluster_key = ? ORDER BY created_at')
      .all(clusterKey) as { document: string }[];
    return rows.map((row) => JSON.parse(row.document) as Handover);
  }

  close(): void {
    this.db.close();
  }
}
