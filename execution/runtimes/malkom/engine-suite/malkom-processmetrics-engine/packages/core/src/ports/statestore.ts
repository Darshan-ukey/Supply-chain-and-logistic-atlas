import type { RunRetention } from '../config/defaults.js';
import type {
  Assignment,
  AssignmentScopeValue,
  Calendar,
  MetricDefinition,
  RegistryDoc,
  TargetOverride,
} from '../config/schemas.js';
import type { Scalar } from '../domain/filter.js';
import type { MetricStatus, MetricTrace, WindowGrain } from '../domain/types.js';

/**
 * The engine's own persistence port: registry versions, authoring documents
 * (calendars, definition heads, assignments), immutable definition versions,
 * computed points, the runs audit log, and a small KV (version counters and
 * rollup leases live in the KV via compare-and-set). Everything the engine
 * owns is read and written ONLY through this port — hosts never touch
 * malkom_metrics_* tables directly.
 *
 * Two shipped implementations: InMemoryMetricsStateStore (tests/ephemeral)
 * and SqliteMetricsStateStore (single-instance default). The table shapes
 * follow the sibling engines' proven pattern: full JSON record in one column,
 * hot query fields extracted as indexed columns.
 */

export interface RegistryRecord {
  version: number;
  hash: string;
  doc: RegistryDoc;
  createdAt: string;
}

/**
 * A stored calendar. `version` increments only when the content hash changes;
 * re-applying identical content is a no-op.
 */
export interface CalendarRecord {
  name: string;
  version: number;
  doc: Calendar;
  docHash: string;
  updatedAt: string;
}

/**
 * Definition lifecycle states, ported from the rules engine's group model:
 * draft → (submit) → pending → (activate) → active → (retire) → retired,
 * with reject sending pending back to draft. Editing an ACTIVE definition
 * moves the lineage back to draft while the activated version keeps
 * evaluating untouched (the head's `activeVersion` pointer survives the
 * edit); pending and retired heads refuse edits.
 */
export type DefinitionState = 'draft' | 'pending' | 'active' | 'retired';
export const DEFINITION_STATES = ['draft', 'pending', 'active', 'retired'] as const;

/**
 * Tier-1 verdict vocabulary — the rules engine's GroupValidity, verbatim:
 * 'valid' (clean), 'broken' (blocking issues), 'unchecked' (never swept /
 * edited since), 'degraded' (reserved for a future warnings tier — metric
 * tier-1 validation currently has no warning channel, so sweeps only ever
 * write valid/broken/unchecked).
 */
export type ValidationStatus = 'unchecked' | 'valid' | 'degraded' | 'broken';

/** One recorded lifecycle transition — the engine's half of the audit trail. */
export interface DefinitionTransition {
  to: DefinitionState;
  actor: string;
  at: string;
  reason?: string;
}

/**
 * The mutable head row of a metric definition, keyed by name: current state,
 * the working draft doc, and a pointer to the version that is live. Editing
 * never touches an activated version — it changes the head's doc, and the
 * next activation snapshots it.
 */
export interface DefinitionRecord {
  name: string;
  state: DefinitionState;
  doc: MetricDefinition;
  docHash: string;
  validationStatus: ValidationStatus;
  /** Highest versionNo ever snapshotted for this definition (0 = none yet). */
  latestVersion: number;
  /** The versionNo currently active, or null when none is. */
  activeVersion: number | null;
  /** State changes in order, each with its actor (never recorded without one). */
  transitions: DefinitionTransition[];
  createdAt: string;
  updatedAt: string;
}

/**
 * An immutable activation snapshot — what rollups, backfills and auditors
 * read. Append-only: activating a new version moves the HEAD's pointer and
 * never mutates old rows (`appendVersion` refuses an existing versionNo), so
 * a version row is bit-identical forever. The registry version — and the
 * calendar name+version when the definition references one — are pinned at
 * activation, so schema/calendar drift is detectable per point.
 */
export interface DefinitionVersionRecord {
  metric: string;
  versionNo: number;
  doc: MetricDefinition;
  registryVersion: number;
  calendarName?: string;
  calendarVersion?: number;
  activatedAt: string;
  actor: string;
}

/**
 * What appendVersion takes: everything but `versionNo` — the STORE assigns
 * it (MAX(versionNo) + 1, atomically with the insert), so a crash between
 * appending a version and updating the head can never brick the lineage on
 * a stale head counter.
 */
export type DefinitionVersionAppend = Omit<DefinitionVersionRecord, 'versionNo'>;

export interface AssignmentFilter {
  metric?: string;
}

/**
 * A stored assignment. (metric, scopeHash) is unique — re-putting the same
 * scope updates the existing row in place; scopeHash is the content hash of
 * the key-sorted scope object, so key order never creates duplicates.
 */
export interface AssignmentRecord {
  id: string;
  metric: string;
  scope: Record<string, AssignmentScopeValue>;
  scopeHash: string;
  targetOverride: TargetOverride | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * One computed metric point. Logical identity is (metric, scopeHash,
 * windowKey) — recomputing the same window for the same scope replaces the
 * row and bumps `revision` (starts at 1), so consumers can tell a fresh
 * computation from a repeat without diffing values.
 */
export interface MetricPointRecord {
  metric: string;
  versionNo: number;
  scopeHash: string;
  scope: Record<string, Scalar>;
  windowKey: string;
  windowStartIso: string;
  windowEndIso: string;
  grain: WindowGrain;
  value: number | null;
  numerator: number | null;
  denominator: number | null;
  targetValue: number | null;
  status: MetricStatus;
  /**
   * The last NON-no_data status this row has carried (the current one when
   * it is not no_data). Store-owned, like `revision`. Alert transitions
   * (breached/recovered) are judged against this, so a no_data gap between
   * two computations neither re-fires a breach nor swallows a recovery.
   */
  lastAlertStatus: MetricStatus | null;
  revision: number;
  computedAtIso: string;
  runId: string;
}

/** What upsertPoint takes: everything the store does not own itself. */
export type MetricPointUpsert = Omit<MetricPointRecord, 'revision' | 'lastAlertStatus'>;

/** The stored row plus the replaced row's statuses (breach/recovered detection). */
export interface PointUpsertResult {
  point: MetricPointRecord;
  /** Status of the row this upsert replaced; null on first computation. */
  previousStatus: MetricStatus | null;
  /**
   * lastAlertStatus of the replaced row (its last non-no_data status BEFORE
   * this write); null on first computation or when it never had one.
   */
  previousAlertStatus: MetricStatus | null;
}

export interface PointQuery {
  metric: string;
  scopeHash?: string;
  grain?: WindowGrain;
  /** Half-open range on windowStartIso: fromIso inclusive, toIso exclusive. */
  fromIso?: string;
  toIso?: string;
  limit?: number;
  /** By windowStartIso; 'asc' (default) or 'desc'. */
  order?: 'asc' | 'desc';
}

export interface PointDeleteFilter {
  metric?: string;
  /** Delete points whose window closed (windowEndIso) strictly before this. */
  beforeIso?: string;
}

/** Why a run happened: a cron tick, a host call, or a backfill window. */
export type RunTrigger = 'scheduled' | 'manual' | 'backfill';

export type RunStatus = 'ok' | 'error' | 'skipped';

/**
 * One materialization attempt, durably recorded — the audit half of every
 * point (ok), every failure (error), and every lease-lost tick (skipped).
 */
export interface MetricRunRecord {
  /** Time-ordered uuidv7. */
  id: string;
  metric: string;
  versionNo: number;
  trigger: RunTrigger;
  windowKey: string;
  scopeHash: string;
  status: RunStatus;
  startedAtIso: string;
  finishedAtIso: string;
  error: string | null;
  /** The evaluation's replay trace; null for skipped runs or stripped traces. */
  trace: MetricTrace | null;
}

export interface RunQuery {
  metric?: string;
  status?: RunStatus;
  trigger?: RunTrigger;
  scopeHash?: string;
  windowKey?: string;
  limit?: number;
  /** By startedAtIso (id tiebreak); 'desc' (default, latest first) or 'asc'. */
  order?: 'asc' | 'desc';
}

export interface MetricsStateStore {
  init(): Promise<void>;

  // --- registry versions ---
  putRegistry(record: RegistryRecord): Promise<void>;
  /** Latest when version is omitted; null when none stored. */
  getRegistry(version?: number): Promise<RegistryRecord | null>;

  // --- calendars ---
  /** Idempotent on content: an identical doc keeps version and updatedAt. */
  upsertCalendar(doc: Calendar, now?: string): Promise<CalendarRecord>;
  getCalendar(name: string): Promise<CalendarRecord | null>;
  listCalendars(): Promise<CalendarRecord[]>;

  // --- definition heads (mutable working state) ---
  /**
   * Saves the draft head; createdAt is preserved, validationStatus resets to
   * 'unchecked'. Allowed only while the head is a draft, or on an ACTIVE head
   * — which moves the lineage back to draft (recording an 'edited' transition,
   * so `actor` is required then) while `activeVersion` keeps evaluating.
   * Pending heads must be rejected back to draft first; retired heads refuse
   * edits. Throws ConflictError otherwise.
   */
  saveDefinitionDraft(doc: MetricDefinition, now?: string, actor?: string): Promise<DefinitionRecord>;
  /** Replace the head verbatim — the lifecycle runtime's write path. */
  putDefinitionHead(record: DefinitionRecord): Promise<void>;
  /**
   * CAS: stamp the head's validationStatus (and updatedAt = now) only while
   * the stored updatedAt still equals `expectedUpdatedAt`; false on a miss.
   * The revalidation sweep writes through this so a concurrent transition
   * (e.g. a retire between the sweep's snapshot and its write-back) is never
   * overwritten by a stale head.
   */
  setValidationStatus(name: string, status: ValidationStatus, expectedUpdatedAt: string, now?: string): Promise<boolean>;
  getDefinition(name: string): Promise<DefinitionRecord | null>;
  listDefinitions(): Promise<DefinitionRecord[]>;
  /**
   * Remove a head that never activated. Refuses (ConflictError) while version
   * rows exist — activated lineages end their life through `retire`, keeping
   * every version row readable forever; deleting and recreating the name
   * would otherwise collide with the surviving immutable rows.
   */
  deleteDefinition(name: string): Promise<void>;

  // --- immutable definition versions ---
  /**
   * Append the next immutable version row: the store assigns versionNo
   * (MAX + 1, atomically with the insert) and returns the stored record.
   * Rows are append-only and never mutated.
   */
  appendVersion(record: DefinitionVersionAppend): Promise<DefinitionVersionRecord>;
  getVersion(name: string, versionNo: number): Promise<DefinitionVersionRecord | null>;
  /** The version the head's activeVersion points at; null when none active. */
  getActiveVersion(name: string): Promise<DefinitionVersionRecord | null>;
  listVersions(name: string): Promise<DefinitionVersionRecord[]>;

  // --- assignments ---
  /** Insert, or update in place when (metric, scopeHash) already exists. */
  putAssignment(assignment: Assignment, now?: string): Promise<AssignmentRecord>;
  deleteAssignment(id: string): Promise<void>;
  listAssignments(filter?: AssignmentFilter): Promise<AssignmentRecord[]>;

  // --- points (computed metric values) ---
  /**
   * Insert or replace by (metric, scopeHash, windowKey); the store assigns
   * `revision` (1, then +1 per replace) and returns the replaced row's status.
   */
  upsertPoint(point: MetricPointUpsert): Promise<PointUpsertResult>;
  queryPoints(query: PointQuery): Promise<MetricPointRecord[]>;
  /** An empty filter deletes nothing — bulk deletion needs stated intent. */
  deletePoints(filter: PointDeleteFilter): Promise<number>;

  /**
   * Persist one materialization ATOMICALLY: upsert the point and append its
   * run in a single transaction (sqlite) / synchronous step (memory), so a
   * crash can never leave a point standing without its audit run.
   */
  persistMaterialization(point: MetricPointUpsert, run: MetricRunRecord): Promise<PointUpsertResult>;

  // --- runs (append-only audit) ---
  appendRun(record: MetricRunRecord): Promise<void>;
  queryRuns(query?: RunQuery): Promise<MetricRunRecord[]>;
  /**
   * Apply the retention policy as of `nowIso`: age prune first
   * (startedAtIso older than runsMaxAgeDays), then row-cap overflow beyond
   * runsMaxRows (oldest first); when keepTraces is false, traces are stripped
   * from the surviving rows. Returns the number of DELETED runs.
   */
  pruneRuns(policy: RunRetention, nowIso: string): Promise<number>;

  // --- kv ---
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  compareAndSet(key: string, expect: string | null, value: string): Promise<boolean>;

  close(): Promise<void>;
}
