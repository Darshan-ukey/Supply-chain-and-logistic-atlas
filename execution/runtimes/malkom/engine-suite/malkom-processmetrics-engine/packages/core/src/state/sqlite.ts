import { DatabaseSync } from 'node:sqlite';
import type { RunRetention } from '../config/defaults.js';
import type { Assignment, Calendar, MetricDefinition } from '../config/schemas.js';
import { ConflictError } from '../domain/errors.js';
import { uuidv7 } from '../domain/ids.js';
import { contentHash } from '../domain/registry.js';
import type { MetricStatus, MetricTrace, WindowGrain } from '../domain/types.js';
import type {
  AssignmentFilter,
  AssignmentRecord,
  CalendarRecord,
  DefinitionRecord,
  DefinitionState,
  DefinitionTransition,
  DefinitionVersionAppend,
  DefinitionVersionRecord,
  MetricPointRecord,
  MetricPointUpsert,
  MetricRunRecord,
  MetricsStateStore,
  PointDeleteFilter,
  PointQuery,
  PointUpsertResult,
  RegistryRecord,
  RunQuery,
  RunStatus,
  RunTrigger,
  ValidationStatus,
} from '../ports/statestore.js';
import { canonicalInstant, canonicalPointInstants, canonicalRunInstants } from './instants.js';

const MS_PER_DAY = 86_400_000;

/**
 * SQLite-backed MetricsStateStore over node:sqlite — the single-instance
 * default, zero dependencies. Table shapes follow the sibling engines'
 * proven pattern: the full JSON record in one column, hot query fields
 * extracted as indexed columns; the `malkom_metrics_` prefix namespaces the
 * engine inside a shared file or the host's own SQLite database.
 *
 * node:sqlite binds only null/number/bigint/string/blob — never hand it a
 * boolean or a Date. Everything bound below is already a string, number or
 * null; keep it that way when new tables land.
 */
export class SqliteMetricsStateStore implements MetricsStateStore {
  private db: DatabaseSync;

  constructor(filename = ':memory:') {
    this.db = new DatabaseSync(filename);
  }

  async init(): Promise<void> {
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      PRAGMA busy_timeout = 5000;
      CREATE TABLE IF NOT EXISTS malkom_metrics_kv (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS malkom_metrics_registry (
        version INTEGER PRIMARY KEY,
        hash TEXT NOT NULL,
        created_at TEXT NOT NULL,
        record TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS malkom_metrics_calendars (
        name TEXT PRIMARY KEY,
        version INTEGER NOT NULL,
        doc TEXT NOT NULL,
        doc_hash TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS malkom_metrics_definitions (
        name TEXT PRIMARY KEY,
        state TEXT NOT NULL,
        doc TEXT NOT NULL,
        doc_hash TEXT NOT NULL,
        validation_status TEXT NOT NULL,
        latest_version INTEGER NOT NULL,
        active_version INTEGER,
        transitions_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS malkom_metrics_versions (
        metric TEXT NOT NULL,
        version_no INTEGER NOT NULL,
        activated_at TEXT NOT NULL,
        record TEXT NOT NULL,
        PRIMARY KEY (metric, version_no)
      );
      CREATE TABLE IF NOT EXISTS malkom_metrics_assignments (
        id TEXT PRIMARY KEY,
        metric TEXT NOT NULL,
        scope_json TEXT NOT NULL,
        scope_hash TEXT NOT NULL,
        target_override_json TEXT,
        active INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE (metric, scope_hash)
      );
      CREATE INDEX IF NOT EXISTS malkom_metrics_assignments_metric
        ON malkom_metrics_assignments (metric);
      CREATE TABLE IF NOT EXISTS malkom_metrics_points (
        metric TEXT NOT NULL,
        version_no INTEGER NOT NULL,
        scope_hash TEXT NOT NULL,
        scope_json TEXT NOT NULL,
        window_key TEXT NOT NULL,
        window_start TEXT NOT NULL,
        window_end TEXT NOT NULL,
        grain TEXT NOT NULL,
        value REAL,
        numerator REAL,
        denominator REAL,
        target_value REAL,
        status TEXT NOT NULL,
        last_alert_status TEXT,
        revision INTEGER NOT NULL,
        computed_at TEXT NOT NULL,
        run_id TEXT NOT NULL,
        PRIMARY KEY (metric, scope_hash, window_key)
      );
      CREATE INDEX IF NOT EXISTS malkom_metrics_points_metric_start
        ON malkom_metrics_points (metric, window_start);
      CREATE TABLE IF NOT EXISTS malkom_metrics_runs (
        id TEXT PRIMARY KEY,
        metric TEXT NOT NULL,
        version_no INTEGER NOT NULL,
        run_trigger TEXT NOT NULL,
        window_key TEXT NOT NULL,
        scope_hash TEXT NOT NULL,
        status TEXT NOT NULL,
        started_at TEXT NOT NULL,
        finished_at TEXT NOT NULL,
        error TEXT,
        trace_json TEXT
      );
      CREATE INDEX IF NOT EXISTS malkom_metrics_runs_metric_started
        ON malkom_metrics_runs (metric, started_at DESC);
      CREATE INDEX IF NOT EXISTS malkom_metrics_runs_started
        ON malkom_metrics_runs (started_at);
    `);
    // Migration for point tables created before last_alert_status existed —
    // CREATE TABLE IF NOT EXISTS never amends an existing shape.
    const pointColumns = this.db.prepare('PRAGMA table_info(malkom_metrics_points)').all() as Array<{ name: string }>;
    if (!pointColumns.some((c) => c.name === 'last_alert_status')) {
      this.db.exec('ALTER TABLE malkom_metrics_points ADD COLUMN last_alert_status TEXT');
    }
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
        `INSERT OR REPLACE INTO malkom_metrics_registry (version, hash, created_at, record)
         VALUES (?, ?, ?, ?)`,
      )
      .run(record.version, record.hash, record.createdAt, JSON.stringify(record));
  }

  async getRegistry(version?: number): Promise<RegistryRecord | null> {
    const row =
      version !== undefined
        ? this.db.prepare('SELECT record FROM malkom_metrics_registry WHERE version = ?').get(version)
        : this.db.prepare('SELECT record FROM malkom_metrics_registry ORDER BY version DESC LIMIT 1').get();
    return row ? (JSON.parse((row as { record: string }).record) as RegistryRecord) : null;
  }

  // --- calendars ---

  private calendarFromRow(row: {
    name: string;
    version: number;
    doc: string;
    doc_hash: string;
    updated_at: string;
  }): CalendarRecord {
    return {
      name: row.name,
      version: Number(row.version),
      doc: JSON.parse(row.doc) as Calendar,
      docHash: row.doc_hash,
      updatedAt: row.updated_at,
    };
  }

  async upsertCalendar(doc: Calendar, now: string = new Date().toISOString()): Promise<CalendarRecord> {
    const docHash = contentHash(doc);
    return this.tx(() => {
      const existing = this.db
        .prepare('SELECT name, version, doc, doc_hash, updated_at FROM malkom_metrics_calendars WHERE name = ?')
        .get(doc.name) as
        | { name: string; version: number; doc: string; doc_hash: string; updated_at: string }
        | undefined;
      if (existing && existing.doc_hash === docHash) return this.calendarFromRow(existing);
      const version = (existing ? Number(existing.version) : 0) + 1;
      this.db
        .prepare(
          `INSERT OR REPLACE INTO malkom_metrics_calendars (name, version, doc, doc_hash, updated_at)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .run(doc.name, version, JSON.stringify(doc), docHash, now);
      // Never alias the caller's doc — a later mutation must not reach into
      // what looks like a stored record (memory-store parity).
      return { name: doc.name, version, doc: structuredClone(doc), docHash, updatedAt: now };
    });
  }

  async getCalendar(name: string): Promise<CalendarRecord | null> {
    const row = this.db
      .prepare('SELECT name, version, doc, doc_hash, updated_at FROM malkom_metrics_calendars WHERE name = ?')
      .get(name) as { name: string; version: number; doc: string; doc_hash: string; updated_at: string } | undefined;
    return row ? this.calendarFromRow(row) : null;
  }

  async listCalendars(): Promise<CalendarRecord[]> {
    const rows = this.db
      .prepare('SELECT name, version, doc, doc_hash, updated_at FROM malkom_metrics_calendars ORDER BY name')
      .all() as Array<{ name: string; version: number; doc: string; doc_hash: string; updated_at: string }>;
    return rows.map((r) => this.calendarFromRow(r));
  }

  // --- definition heads ---

  private static readonly DEFINITION_COLUMNS =
    'name, state, doc, doc_hash, validation_status, latest_version, active_version, transitions_json, created_at, updated_at';

  private definitionFromRow(row: {
    name: string;
    state: string;
    doc: string;
    doc_hash: string;
    validation_status: string;
    latest_version: number;
    active_version: number | null;
    transitions_json: string;
    created_at: string;
    updated_at: string;
  }): DefinitionRecord {
    return {
      name: row.name,
      state: row.state as DefinitionState,
      doc: JSON.parse(row.doc) as MetricDefinition,
      docHash: row.doc_hash,
      validationStatus: row.validation_status as ValidationStatus,
      latestVersion: Number(row.latest_version),
      activeVersion: row.active_version === null ? null : Number(row.active_version),
      transitions: JSON.parse(row.transitions_json) as DefinitionTransition[],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private writeDefinitionHead(record: DefinitionRecord): void {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO malkom_metrics_definitions
           (${SqliteMetricsStateStore.DEFINITION_COLUMNS})
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        record.name,
        record.state,
        JSON.stringify(record.doc),
        record.docHash,
        record.validationStatus,
        record.latestVersion,
        record.activeVersion,
        JSON.stringify(record.transitions),
        record.createdAt,
        record.updatedAt,
      );
  }

  async saveDefinitionDraft(
    doc: MetricDefinition,
    now: string = new Date().toISOString(),
    actor?: string,
  ): Promise<DefinitionRecord> {
    const docHash = contentHash(doc);
    return this.tx(() => {
      const row = this.db
        .prepare(
          `SELECT ${SqliteMetricsStateStore.DEFINITION_COLUMNS} FROM malkom_metrics_definitions WHERE name = ?`,
        )
        .get(doc.name) as Parameters<SqliteMetricsStateStore['definitionFromRow']>[0] | undefined;
      const existing = row ? this.definitionFromRow(row) : undefined;
      if (existing !== undefined && existing.state !== 'draft' && existing.state !== 'active') {
        throw new ConflictError(
          existing.state === 'pending'
            ? `definition "${doc.name}" is pending approval — reject it back to draft before editing`
            : `definition "${doc.name}" is retired — retired lineages are read-only`,
        );
      }
      const transitions = existing?.transitions ?? [];
      if (existing?.state === 'active') {
        // Editing an active definition starts a new draft lineage; the active
        // version keeps evaluating untouched — this state change is audited.
        if (actor === undefined || actor.trim() === '') {
          throw new ConflictError(
            `editing the active definition "${doc.name}" records a transition — pass a non-empty actor`,
          );
        }
        transitions.push({ to: 'draft', actor, at: now, reason: 'edited' });
      }
      const record: DefinitionRecord = {
        name: doc.name,
        state: 'draft',
        doc,
        docHash,
        validationStatus: 'unchecked',
        latestVersion: existing?.latestVersion ?? 0,
        activeVersion: existing?.activeVersion ?? null,
        transitions,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      this.writeDefinitionHead(record);
      return structuredClone(record); // never alias the caller's doc
    });
  }

  async putDefinitionHead(record: DefinitionRecord): Promise<void> {
    this.writeDefinitionHead(record);
  }

  async setValidationStatus(
    name: string,
    status: ValidationStatus,
    expectedUpdatedAt: string,
    now: string = new Date().toISOString(),
  ): Promise<boolean> {
    const res = this.db
      .prepare(
        'UPDATE malkom_metrics_definitions SET validation_status = ?, updated_at = ? WHERE name = ? AND updated_at = ?',
      )
      .run(status, now, name, expectedUpdatedAt);
    return Number(res.changes) === 1;
  }

  async getDefinition(name: string): Promise<DefinitionRecord | null> {
    const row = this.db
      .prepare(`SELECT ${SqliteMetricsStateStore.DEFINITION_COLUMNS} FROM malkom_metrics_definitions WHERE name = ?`)
      .get(name) as Parameters<SqliteMetricsStateStore['definitionFromRow']>[0] | undefined;
    return row ? this.definitionFromRow(row) : null;
  }

  async listDefinitions(): Promise<DefinitionRecord[]> {
    const rows = this.db
      .prepare(
        `SELECT ${SqliteMetricsStateStore.DEFINITION_COLUMNS} FROM malkom_metrics_definitions ORDER BY name`,
      )
      .all() as Array<Parameters<SqliteMetricsStateStore['definitionFromRow']>[0]>;
    return rows.map((r) => this.definitionFromRow(r));
  }

  async deleteDefinition(name: string): Promise<void> {
    this.tx(() => {
      const versions = this.db
        .prepare('SELECT COUNT(*) AS n FROM malkom_metrics_versions WHERE metric = ?')
        .get(name) as { n: number };
      if (Number(versions.n) > 0) {
        throw new ConflictError(
          `definition "${name}" has immutable version rows — retire it instead of deleting (version history is kept forever)`,
        );
      }
      this.db.prepare('DELETE FROM malkom_metrics_definitions WHERE name = ?').run(name);
    });
  }

  // --- immutable definition versions ---

  async appendVersion(record: DefinitionVersionAppend): Promise<DefinitionVersionRecord> {
    return this.tx(() => {
      // The store owns versionNo: MAX + 1 over the rows that actually exist,
      // read in the SAME transaction as the insert — an orphaned row (crash
      // between append and head update) can then never brick the lineage.
      const row = this.db
        .prepare('SELECT COALESCE(MAX(version_no), 0) AS latest FROM malkom_metrics_versions WHERE metric = ?')
        .get(record.metric) as { latest: number };
      const stored: DefinitionVersionRecord = { ...structuredClone(record), versionNo: Number(row.latest) + 1 };
      this.db
        .prepare(
          `INSERT INTO malkom_metrics_versions (metric, version_no, activated_at, record)
           VALUES (?, ?, ?, ?)`,
        )
        .run(stored.metric, stored.versionNo, stored.activatedAt, JSON.stringify(stored));
      return stored;
    });
  }

  async getVersion(name: string, versionNo: number): Promise<DefinitionVersionRecord | null> {
    const row = this.db
      .prepare('SELECT record FROM malkom_metrics_versions WHERE metric = ? AND version_no = ?')
      .get(name, versionNo);
    return row ? (JSON.parse((row as { record: string }).record) as DefinitionVersionRecord) : null;
  }

  async getActiveVersion(name: string): Promise<DefinitionVersionRecord | null> {
    const head = await this.getDefinition(name);
    if (head === null || head.activeVersion === null) return null;
    return this.getVersion(name, head.activeVersion);
  }

  async listVersions(name: string): Promise<DefinitionVersionRecord[]> {
    const rows = this.db
      .prepare('SELECT record FROM malkom_metrics_versions WHERE metric = ? ORDER BY version_no')
      .all(name) as Array<{ record: string }>;
    return rows.map((r) => JSON.parse(r.record) as DefinitionVersionRecord);
  }

  // --- assignments ---

  private assignmentFromRow(row: {
    id: string;
    metric: string;
    scope_json: string;
    scope_hash: string;
    target_override_json: string | null;
    active: number;
    created_at: string;
    updated_at: string;
  }): AssignmentRecord {
    return {
      id: row.id,
      metric: row.metric,
      scope: JSON.parse(row.scope_json) as AssignmentRecord['scope'],
      scopeHash: row.scope_hash,
      targetOverride:
        row.target_override_json === null
          ? null
          : (JSON.parse(row.target_override_json) as AssignmentRecord['targetOverride']),
      active: Number(row.active) !== 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async putAssignment(assignment: Assignment, now: string = new Date().toISOString()): Promise<AssignmentRecord> {
    const scopeHash = contentHash(assignment.scope);
    const targetOverrideJson =
      assignment.targetOverride !== undefined ? JSON.stringify(assignment.targetOverride) : null;
    return this.tx(() => {
      const existing = this.db
        .prepare('SELECT id, created_at FROM malkom_metrics_assignments WHERE metric = ? AND scope_hash = ?')
        .get(assignment.metric, scopeHash) as { id: string; created_at: string } | undefined;
      const id = existing?.id ?? uuidv7();
      const createdAt = existing?.created_at ?? now;
      this.db
        .prepare(
          `INSERT OR REPLACE INTO malkom_metrics_assignments
             (id, metric, scope_json, scope_hash, target_override_json, active, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          id,
          assignment.metric,
          JSON.stringify(assignment.scope),
          scopeHash,
          targetOverrideJson,
          assignment.active ? 1 : 0,
          createdAt,
          now,
        );
      return {
        id,
        metric: assignment.metric,
        scope: structuredClone(assignment.scope),
        scopeHash,
        targetOverride: assignment.targetOverride !== undefined ? structuredClone(assignment.targetOverride) : null,
        active: assignment.active,
        createdAt,
        updatedAt: now,
      };
    });
  }

  async deleteAssignment(id: string): Promise<void> {
    this.db.prepare('DELETE FROM malkom_metrics_assignments WHERE id = ?').run(id);
  }

  async listAssignments(filter: AssignmentFilter = {}): Promise<AssignmentRecord[]> {
    const rows = (
      filter.metric !== undefined
        ? this.db
            .prepare(
              `SELECT id, metric, scope_json, scope_hash, target_override_json, active, created_at, updated_at
               FROM malkom_metrics_assignments WHERE metric = ? ORDER BY id`,
            )
            .all(filter.metric)
        : this.db
            .prepare(
              `SELECT id, metric, scope_json, scope_hash, target_override_json, active, created_at, updated_at
               FROM malkom_metrics_assignments ORDER BY id`,
            )
            .all()
    ) as Array<{
      id: string;
      metric: string;
      scope_json: string;
      scope_hash: string;
      target_override_json: string | null;
      active: number;
      created_at: string;
      updated_at: string;
    }>;
    return rows.map((r) => this.assignmentFromRow(r));
  }

  // --- points ---

  private static readonly POINT_COLUMNS =
    'metric, version_no, scope_hash, scope_json, window_key, window_start, window_end, grain, value, numerator, denominator, target_value, status, last_alert_status, revision, computed_at, run_id';

  private pointFromRow(row: {
    metric: string;
    version_no: number;
    scope_hash: string;
    scope_json: string;
    window_key: string;
    window_start: string;
    window_end: string;
    grain: string;
    value: number | null;
    numerator: number | null;
    denominator: number | null;
    target_value: number | null;
    status: string;
    last_alert_status: string | null;
    revision: number;
    computed_at: string;
    run_id: string;
  }): MetricPointRecord {
    return {
      metric: row.metric,
      versionNo: Number(row.version_no),
      scopeHash: row.scope_hash,
      scope: JSON.parse(row.scope_json) as MetricPointRecord['scope'],
      windowKey: row.window_key,
      windowStartIso: row.window_start,
      windowEndIso: row.window_end,
      grain: row.grain as WindowGrain,
      value: row.value === null ? null : Number(row.value),
      numerator: row.numerator === null ? null : Number(row.numerator),
      denominator: row.denominator === null ? null : Number(row.denominator),
      targetValue: row.target_value === null ? null : Number(row.target_value),
      status: row.status as MetricStatus,
      lastAlertStatus: row.last_alert_status === null ? null : (row.last_alert_status as MetricStatus),
      revision: Number(row.revision),
      computedAtIso: row.computed_at,
      runId: row.run_id,
    };
  }

  /** The upsert core, callable only inside an open transaction. */
  private upsertPointInTx(upsert: MetricPointUpsert): PointUpsertResult {
    const point = canonicalPointInstants(upsert);
    const existing = this.db
      .prepare(
        'SELECT status, last_alert_status, revision FROM malkom_metrics_points WHERE metric = ? AND scope_hash = ? AND window_key = ?',
      )
      .get(point.metric, point.scopeHash, point.windowKey) as
      | { status: string; last_alert_status: string | null; revision: number }
      | undefined;
    const revision = (existing ? Number(existing.revision) : 0) + 1;
    const previousAlertStatus =
      existing === undefined || existing.last_alert_status === null
        ? null
        : (existing.last_alert_status as MetricStatus);
    // no_data is transparent for alerting: it never overwrites the last real
    // verdict (see MetricPointRecord.lastAlertStatus).
    const lastAlertStatus = point.status !== 'no_data' ? point.status : previousAlertStatus;
    this.db
      .prepare(
        `INSERT OR REPLACE INTO malkom_metrics_points
           (${SqliteMetricsStateStore.POINT_COLUMNS})
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        point.metric,
        point.versionNo,
        point.scopeHash,
        JSON.stringify(point.scope),
        point.windowKey,
        point.windowStartIso,
        point.windowEndIso,
        point.grain,
        point.value,
        point.numerator,
        point.denominator,
        point.targetValue,
        point.status,
        lastAlertStatus,
        revision,
        point.computedAtIso,
        point.runId,
      );
    return {
      point: structuredClone({ ...point, lastAlertStatus, revision }),
      previousStatus: existing ? (existing.status as MetricStatus) : null,
      previousAlertStatus,
    };
  }

  async upsertPoint(point: MetricPointUpsert): Promise<PointUpsertResult> {
    return this.tx(() => this.upsertPointInTx(point));
  }

  async persistMaterialization(point: MetricPointUpsert, run: MetricRunRecord): Promise<PointUpsertResult> {
    // ONE transaction: the point and its audit run land together or not at all.
    return this.tx(() => {
      const result = this.upsertPointInTx(point);
      this.insertRun(canonicalRunInstants(run));
      return result;
    });
  }

  async queryPoints(query: PointQuery): Promise<MetricPointRecord[]> {
    const clauses = ['metric = ?'];
    const params: Array<string | number> = [query.metric];
    if (query.scopeHash !== undefined) {
      clauses.push('scope_hash = ?');
      params.push(query.scopeHash);
    }
    if (query.grain !== undefined) {
      clauses.push('grain = ?');
      params.push(query.grain);
    }
    if (query.fromIso !== undefined) {
      clauses.push('window_start >= ?');
      params.push(canonicalInstant(query.fromIso));
    }
    if (query.toIso !== undefined) {
      clauses.push('window_start < ?');
      params.push(canonicalInstant(query.toIso));
    }
    const dir = query.order === 'desc' ? 'DESC' : 'ASC';
    let sql =
      `SELECT ${SqliteMetricsStateStore.POINT_COLUMNS} FROM malkom_metrics_points ` +
      `WHERE ${clauses.join(' AND ')} ORDER BY window_start ${dir}, scope_hash ${dir}`;
    if (query.limit !== undefined) {
      sql += ' LIMIT ?';
      params.push(query.limit);
    }
    const rows = this.db.prepare(sql).all(...params) as Array<
      Parameters<SqliteMetricsStateStore['pointFromRow']>[0]
    >;
    return rows.map((r) => this.pointFromRow(r));
  }

  async deletePoints(filter: PointDeleteFilter): Promise<number> {
    const clauses: string[] = [];
    const params: string[] = [];
    if (filter.metric !== undefined) {
      clauses.push('metric = ?');
      params.push(filter.metric);
    }
    if (filter.beforeIso !== undefined) {
      clauses.push('window_end < ?');
      params.push(canonicalInstant(filter.beforeIso));
    }
    if (clauses.length === 0) return 0; // intent required
    const res = this.db.prepare(`DELETE FROM malkom_metrics_points WHERE ${clauses.join(' AND ')}`).run(...params);
    return Number(res.changes);
  }

  // --- runs ---

  private runFromRow(row: {
    id: string;
    metric: string;
    version_no: number;
    run_trigger: string;
    window_key: string;
    scope_hash: string;
    status: string;
    started_at: string;
    finished_at: string;
    error: string | null;
    trace_json: string | null;
  }): MetricRunRecord {
    return {
      id: row.id,
      metric: row.metric,
      versionNo: Number(row.version_no),
      trigger: row.run_trigger as RunTrigger,
      windowKey: row.window_key,
      scopeHash: row.scope_hash,
      status: row.status as RunStatus,
      startedAtIso: row.started_at,
      finishedAtIso: row.finished_at,
      error: row.error,
      trace: row.trace_json === null ? null : (JSON.parse(row.trace_json) as MetricTrace),
    };
  }

  private insertRun(record: MetricRunRecord): void {
    this.db
      .prepare(
        `INSERT INTO malkom_metrics_runs
           (id, metric, version_no, run_trigger, window_key, scope_hash, status, started_at, finished_at, error, trace_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        record.id,
        record.metric,
        record.versionNo,
        record.trigger,
        record.windowKey,
        record.scopeHash,
        record.status,
        record.startedAtIso,
        record.finishedAtIso,
        record.error,
        record.trace === null ? null : JSON.stringify(record.trace),
      );
  }

  async appendRun(record: MetricRunRecord): Promise<void> {
    this.insertRun(canonicalRunInstants(record));
  }

  async queryRuns(query: RunQuery = {}): Promise<MetricRunRecord[]> {
    const clauses: string[] = [];
    const params: Array<string | number> = [];
    if (query.metric !== undefined) {
      clauses.push('metric = ?');
      params.push(query.metric);
    }
    if (query.status !== undefined) {
      clauses.push('status = ?');
      params.push(query.status);
    }
    if (query.trigger !== undefined) {
      clauses.push('run_trigger = ?');
      params.push(query.trigger);
    }
    if (query.scopeHash !== undefined) {
      clauses.push('scope_hash = ?');
      params.push(query.scopeHash);
    }
    if (query.windowKey !== undefined) {
      clauses.push('window_key = ?');
      params.push(query.windowKey);
    }
    const where = clauses.length > 0 ? ` WHERE ${clauses.join(' AND ')}` : '';
    const dir = query.order === 'asc' ? 'ASC' : 'DESC';
    let sql =
      'SELECT id, metric, version_no, run_trigger, window_key, scope_hash, status, started_at, finished_at, error, trace_json ' +
      `FROM malkom_metrics_runs${where} ORDER BY started_at ${dir}, id ${dir}`;
    if (query.limit !== undefined) {
      sql += ' LIMIT ?';
      params.push(query.limit);
    }
    const rows = this.db.prepare(sql).all(...params) as Array<Parameters<SqliteMetricsStateStore['runFromRow']>[0]>;
    return rows.map((r) => this.runFromRow(r));
  }

  async pruneRuns(policy: RunRetention, nowIso: string): Promise<number> {
    return this.tx(() => {
      let removed = 0;
      // Age first: runs that started before the cutoff go.
      const cutoff = new Date(Date.parse(nowIso) - policy.runsMaxAgeDays * MS_PER_DAY).toISOString();
      removed += Number(this.db.prepare('DELETE FROM malkom_metrics_runs WHERE started_at < ?').run(cutoff).changes);
      // Then the row cap: oldest overflow goes.
      removed += Number(
        this.db
          .prepare(
            `DELETE FROM malkom_metrics_runs WHERE id NOT IN (
               SELECT id FROM malkom_metrics_runs ORDER BY started_at DESC, id DESC LIMIT ?
             )`,
          )
          .run(policy.runsMaxRows).changes,
      );
      if (!policy.keepTraces) {
        this.db.prepare('UPDATE malkom_metrics_runs SET trace_json = NULL WHERE trace_json IS NOT NULL').run();
      }
      return removed;
    });
  }

  // --- kv ---

  async get(key: string): Promise<string | null> {
    const row = this.db.prepare('SELECT value FROM malkom_metrics_kv WHERE key = ?').get(key) as
      | { value: string }
      | undefined;
    return row ? row.value : null;
  }

  async set(key: string, value: string): Promise<void> {
    this.db.prepare('INSERT OR REPLACE INTO malkom_metrics_kv (key, value) VALUES (?, ?)').run(key, value);
  }

  async delete(key: string): Promise<void> {
    this.db.prepare('DELETE FROM malkom_metrics_kv WHERE key = ?').run(key);
  }

  async compareAndSet(key: string, expect: string | null, value: string): Promise<boolean> {
    return this.tx(() => {
      const row = this.db.prepare('SELECT value FROM malkom_metrics_kv WHERE key = ?').get(key) as
        | { value: string }
        | undefined;
      const current = row ? row.value : null;
      if (current !== expect) return false;
      this.db.prepare('INSERT OR REPLACE INTO malkom_metrics_kv (key, value) VALUES (?, ?)').run(key, value);
      return true;
    });
  }

  async close(): Promise<void> {
    this.db.close();
  }
}
