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
 * The RulesStateStore contract in Maps and arrays. Tests and ephemeral
 * embedding only — nothing survives the process. Deep-copies on the way in
 * and out so callers can never mutate stored state by reference.
 */
export class InMemoryRulesStateStore implements RulesStateStore {
  private registries = new Map<number, RegistryRecord>();
  private heads = new Map<string, GroupHead>();
  private versions = new Map<string, GroupVersionRecord>();
  private decisions: DecisionRecord[] = [];
  private kv = new Map<string, string>();
  private rulesetVersion = 0;

  async init(): Promise<void> {}

  private clone<T>(v: T): T {
    return structuredClone(v);
  }

  async putRegistry(record: RegistryRecord): Promise<void> {
    this.registries.set(record.version, this.clone(record));
  }

  async getRegistry(version?: number): Promise<RegistryRecord | null> {
    if (version !== undefined) {
      const r = this.registries.get(version);
      return r ? this.clone(r) : null;
    }
    const latest = Math.max(0, ...this.registries.keys());
    const r = this.registries.get(latest);
    return r ? this.clone(r) : null;
  }

  async putGroupHead(head: GroupHead): Promise<void> {
    this.heads.set(head.id, this.clone(head));
  }

  async getGroupHead(id: string): Promise<GroupHead | null> {
    const h = this.heads.get(id);
    return h ? this.clone(h) : null;
  }

  async listGroupHeads(filter: GroupHeadFilter = {}): Promise<GroupHead[]> {
    return [...this.heads.values()]
      .filter((h) => (filter.entity === undefined || h.entity === filter.entity)
        && (filter.state === undefined || h.state === filter.state))
      .sort((a, b) => (a.id < b.id ? -1 : 1))
      .map((h) => this.clone(h));
  }

  async putGroupVersion(record: GroupVersionRecord): Promise<void> {
    this.versions.set(`${record.groupId}:${record.version}`, this.clone(record));
  }

  async getGroupVersion(groupId: string, version: number): Promise<GroupVersionRecord | null> {
    const v = this.versions.get(`${groupId}:${version}`);
    return v ? this.clone(v) : null;
  }

  async listGroupVersions(groupId: string): Promise<GroupVersionRecord[]> {
    return [...this.versions.values()]
      .filter((v) => v.groupId === groupId)
      .sort((a, b) => a.version - b.version)
      .map((v) => this.clone(v));
  }

  async bumpRulesetVersion(): Promise<number> {
    this.rulesetVersion += 1;
    return this.rulesetVersion;
  }

  async currentRulesetVersion(): Promise<number> {
    return this.rulesetVersion;
  }

  async appendDecision(record: DecisionRecord): Promise<void> {
    this.decisions.push(this.clone(record));
  }

  async queryDecisions(query: DecisionQuery): Promise<{ decisions: DecisionRecord[]; total: number }> {
    const filtered = this.decisions
      .filter((d) =>
        (query.entity === undefined || d.entity === query.entity)
        && (query.entityId === undefined || d.entityId === query.entityId)
        && (query.mode === undefined || d.mode === query.mode)
        && (query.since === undefined || Date.parse(d.asOf) >= Date.parse(query.since))
        && (query.until === undefined || Date.parse(d.asOf) < Date.parse(query.until)))
      .sort((a, b) => (a.id > b.id ? -1 : 1)); // uuidv7: newest first
    const offset = query.offset ?? 0;
    const limit = query.limit ?? 100;
    return {
      decisions: filtered.slice(offset, offset + limit).map((d) => this.clone(d)),
      total: filtered.length,
    };
  }

  async deleteDecisions(filter: DecisionDeleteFilter): Promise<number> {
    const ids = filter.ids ? new Set(filter.ids) : null;
    const before = filter.before !== undefined ? Date.parse(filter.before) : null;
    const keep: DecisionRecord[] = [];
    let removed = 0;
    for (const d of this.decisions) {
      const matches =
        (filter.entity === undefined || d.entity === filter.entity)
        && (before === null || Date.parse(d.createdAt) < before)
        && (ids === null || ids.has(d.id));
      if (matches) removed += 1;
      else keep.push(d);
    }
    this.decisions = keep;
    return removed;
  }

  async pruneDecisions(policy: RetentionPolicy, now: Date): Promise<number> {
    let removed = 0;
    if (policy.maxAgeMs !== undefined) {
      const cutoff = now.getTime() - policy.maxAgeMs;
      const before = this.decisions.length;
      this.decisions = this.decisions.filter((d) => Date.parse(d.createdAt) >= cutoff);
      removed += before - this.decisions.length;
    }
    if (policy.maxCount !== undefined && this.decisions.length > policy.maxCount) {
      this.decisions.sort((a, b) => (a.id < b.id ? -1 : 1)); // oldest first
      const excess = this.decisions.length - policy.maxCount;
      this.decisions.splice(0, excess);
      removed += excess;
    }
    return removed;
  }

  async get(key: string): Promise<string | null> {
    return this.kv.get(key) ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    this.kv.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.kv.delete(key);
  }

  async compareAndSet(key: string, expect: string | null, value: string): Promise<boolean> {
    const current = this.kv.get(key) ?? null;
    if (current !== expect) return false;
    this.kv.set(key, value);
    return true;
  }

  async close(): Promise<void> {}
}
