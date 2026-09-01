import { DatabaseSync } from 'node:sqlite';
import type { RuleSetDefinition } from './schemas.js';

/**
 * State port + shipped stores (in-memory for tests, SQLite for real use),
 * following the sibling engines: WAL, NORMAL sync, 5s busy timeout.
 */

export interface RuleSetRecord {
  definition: RuleSetDefinition;
  version: number;
  updatedAt: string;
}

export interface EvaluationRecord {
  id: string;
  ruleSetId: string;
  passed: boolean;
  errors: number;
  warnings: number;
  createdAt: string;
}

export interface ValidateStateStore {
  putRuleSet(record: RuleSetRecord): void;
  getRuleSet(id: string): RuleSetRecord | null;
  listRuleSets(): RuleSetRecord[];
  deleteRuleSet(id: string): void;
  appendEvaluation(record: EvaluationRecord): void;
  listEvaluations(ruleSetId: string | null, limit: number, offset: number): EvaluationRecord[];
  pruneEvaluations(maxAgeMs: number, maxCount: number): void;
  close(): void;
}

export class InMemoryValidateStateStore implements ValidateStateStore {
  private readonly ruleSets = new Map<string, RuleSetRecord>();
  private evaluations: EvaluationRecord[] = [];

  putRuleSet(record: RuleSetRecord): void {
    this.ruleSets.set(record.definition.id, record);
  }
  getRuleSet(id: string): RuleSetRecord | null {
    return this.ruleSets.get(id) ?? null;
  }
  listRuleSets(): RuleSetRecord[] {
    return [...this.ruleSets.values()];
  }
  deleteRuleSet(id: string): void {
    this.ruleSets.delete(id);
  }
  appendEvaluation(record: EvaluationRecord): void {
    this.evaluations.push(record);
  }
  listEvaluations(ruleSetId: string | null, limit: number, offset: number): EvaluationRecord[] {
    return this.evaluations
      .filter((entry) => ruleSetId === null || entry.ruleSetId === ruleSetId)
      .slice()
      .reverse()
      .slice(offset, offset + limit);
  }
  pruneEvaluations(maxAgeMs: number, maxCount: number): void {
    const cutoff = Date.now() - maxAgeMs;
    this.evaluations = this.evaluations.filter((entry) => Date.parse(entry.createdAt) >= cutoff).slice(-maxCount);
  }
  close(): void {
    this.ruleSets.clear();
    this.evaluations = [];
  }
}

export class SqliteValidateStateStore implements ValidateStateStore {
  private readonly db: DatabaseSync;

  constructor(path: string) {
    this.db = new DatabaseSync(path);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      PRAGMA busy_timeout = 5000;
      CREATE TABLE IF NOT EXISTS malkom_validate_rulesets (
        id TEXT PRIMARY KEY, definition TEXT NOT NULL,
        version INTEGER NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS malkom_validate_evaluations (
        id TEXT PRIMARY KEY, rule_set_id TEXT NOT NULL, passed INTEGER NOT NULL,
        errors INTEGER NOT NULL, warnings INTEGER NOT NULL, created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_validate_evaluations_ruleset
        ON malkom_validate_evaluations (rule_set_id, created_at);
    `);
  }

  putRuleSet(record: RuleSetRecord): void {
    this.db
      .prepare(`INSERT INTO malkom_validate_rulesets (id, definition, version, updated_at)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET definition=excluded.definition,
                  version=excluded.version, updated_at=excluded.updated_at`)
      .run(record.definition.id, JSON.stringify(record.definition), record.version, record.updatedAt);
  }

  getRuleSet(id: string): RuleSetRecord | null {
    const row = this.db.prepare('SELECT definition, version, updated_at FROM malkom_validate_rulesets WHERE id = ?').get(id) as
      | { definition: string; version: number; updated_at: string }
      | undefined;
    if (row === undefined) return null;
    return {
      definition: JSON.parse(row.definition) as RuleSetRecord['definition'],
      version: row.version,
      updatedAt: row.updated_at,
    };
  }

  listRuleSets(): RuleSetRecord[] {
    const rows = this.db.prepare('SELECT id FROM malkom_validate_rulesets ORDER BY id').all() as { id: string }[];
    return rows.map((row) => this.getRuleSet(row.id)).filter((record): record is RuleSetRecord => record !== null);
  }

  deleteRuleSet(id: string): void {
    this.db.prepare('DELETE FROM malkom_validate_rulesets WHERE id = ?').run(id);
  }

  appendEvaluation(record: EvaluationRecord): void {
    this.db
      .prepare('INSERT INTO malkom_validate_evaluations (id, rule_set_id, passed, errors, warnings, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(record.id, record.ruleSetId, record.passed ? 1 : 0, record.errors, record.warnings, record.createdAt);
  }

  listEvaluations(ruleSetId: string | null, limit: number, offset: number): EvaluationRecord[] {
    const rows = (ruleSetId === null
      ? this.db.prepare('SELECT * FROM malkom_validate_evaluations ORDER BY created_at DESC LIMIT ? OFFSET ?').all(limit, offset)
      : this.db.prepare('SELECT * FROM malkom_validate_evaluations WHERE rule_set_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?').all(ruleSetId, limit, offset)) as {
      id: string; rule_set_id: string; passed: number; errors: number; warnings: number; created_at: string;
    }[];
    return rows.map((row) => ({
      id: row.id,
      ruleSetId: row.rule_set_id,
      passed: row.passed === 1,
      errors: row.errors,
      warnings: row.warnings,
      createdAt: row.created_at,
    }));
  }

  pruneEvaluations(maxAgeMs: number, maxCount: number): void {
    const cutoff = new Date(Date.now() - maxAgeMs).toISOString();
    this.db.prepare('DELETE FROM malkom_validate_evaluations WHERE created_at < ?').run(cutoff);
    this.db
      .prepare(`DELETE FROM malkom_validate_evaluations WHERE id NOT IN
                (SELECT id FROM malkom_validate_evaluations ORDER BY created_at DESC LIMIT ?)`)
      .run(maxCount);
  }

  close(): void {
    this.db.close();
  }
}
