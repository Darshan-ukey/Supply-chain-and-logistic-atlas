import type { RegistryDoc } from '../config/schemas.js';
import type {
  DecisionRecord,
  EvaluationMode,
  GroupHead,
  GroupState,
  GroupVersionRecord,
} from '../domain/types.js';

/**
 * The engine's own persistence port (§8): registry versions, group heads,
 * immutable version snapshots, the decision log, the ruleset-version counter,
 * and a small KV. Everything the engine owns is read and written ONLY through
 * this port — hosts never touch malkom_rules_* tables directly (D6).
 *
 * Two shipped implementations: InMemoryRulesStateStore (tests/ephemeral) and
 * SqliteRulesStateStore (single-instance default). The table shapes follow
 * the sibling engine's proven pattern: full JSON record in one column, hot
 * query fields extracted as indexed columns.
 */

export interface RegistryRecord {
  version: number;
  hash: string;
  doc: RegistryDoc;
  createdAt: string;
}

export interface GroupHeadFilter {
  entity?: string;
  state?: GroupState;
}

export interface DecisionQuery {
  entity?: string;
  entityId?: string;
  mode?: EvaluationMode;
  /** ISO instants filtering on asOf (inclusive since, exclusive until). */
  since?: string;
  until?: string;
  limit?: number;
  offset?: number;
}

export interface DecisionDeleteFilter {
  entity?: string;
  /** Delete decisions with createdAt strictly before this instant. */
  before?: string;
  ids?: string[];
}

export interface RetentionPolicy {
  maxAgeMs?: number;
  maxCount?: number;
}

export interface RulesStateStore {
  init(): Promise<void>;

  // --- registry versions ---
  putRegistry(record: RegistryRecord): Promise<void>;
  /** Latest when version is omitted; null when none stored. */
  getRegistry(version?: number): Promise<RegistryRecord | null>;

  // --- group heads (mutable working state) ---
  putGroupHead(head: GroupHead): Promise<void>;
  getGroupHead(id: string): Promise<GroupHead | null>;
  listGroupHeads(filter?: GroupHeadFilter): Promise<GroupHead[]>;

  // --- immutable version snapshots ---
  putGroupVersion(record: GroupVersionRecord): Promise<void>;
  getGroupVersion(groupId: string, version: number): Promise<GroupVersionRecord | null>;
  listGroupVersions(groupId: string): Promise<GroupVersionRecord[]>;

  // --- ruleset version counter (the compiled-index cache key, §4.2) ---
  bumpRulesetVersion(): Promise<number>;
  currentRulesetVersion(): Promise<number>;

  // --- decision log (append-only; §2.5) ---
  appendDecision(record: DecisionRecord): Promise<void>;
  queryDecisions(query: DecisionQuery): Promise<{ decisions: DecisionRecord[]; total: number }>;
  /** Refuses an empty filter at the engine layer — audit data needs intent. */
  deleteDecisions(filter: DecisionDeleteFilter): Promise<number>;
  pruneDecisions(policy: RetentionPolicy, now: Date): Promise<number>;

  // --- kv ---
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  compareAndSet(key: string, expect: string | null, value: string): Promise<boolean>;

  close(): Promise<void>;
}
