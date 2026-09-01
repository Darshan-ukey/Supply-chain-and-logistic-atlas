import { randomUUID } from 'node:crypto';
import { evaluate } from './checks.js';
import type { ValidateStateStore } from './store.js';
import { InMemoryValidateStateStore } from './store.js';
import {
  configBundleSchema,
  evaluateRequestSchema,
  ruleSetDefinitionSchema,
  type ConfigBundle,
  type RuleSetDefinitionInput,
  type ValidationOutcome,
} from './schemas.js';
import type { EvaluationRecord } from './store.js';

/**
 * Engine facade — every operation the control plane exposes, as a typed
 * library API. The engine owns the checks and the outcome; the host owns
 * the record and what a failure causes. Both the automated gate and the
 * human screen call the same rule set, so the paths cannot drift.
 */

export interface ValidationEngineOptions {
  stateStore?: ValidateStateStore;
  retention?: { maxAgeMs: number; maxCount: number };
  clock?: () => Date;
}

export class ValidationEngine {
  private readonly store: ValidateStateStore;
  private readonly retention: { maxAgeMs: number; maxCount: number };
  private readonly clock: () => Date;

  constructor(options: ValidationEngineOptions = {}) {
    this.store = options.stateStore ?? new InMemoryValidateStateStore();
    this.retention = options.retention ?? { maxAgeMs: 30 * 24 * 60 * 60 * 1000, maxCount: 20_000 };
    this.clock = options.clock ?? (() => new Date());
  }

  upsertRuleSet(input: RuleSetDefinitionInput): { id: string; version: number } {
    const definition = ruleSetDefinitionSchema.parse(input);
    const existing = this.store.getRuleSet(definition.id);
    const record = {
      definition,
      version: (existing?.version ?? 0) + 1,
      updatedAt: this.clock().toISOString(),
    };
    this.store.putRuleSet(record);
    return { id: definition.id, version: record.version };
  }

  applyConfig(input: unknown): { applied: string[] } {
    const bundle: ConfigBundle = configBundleSchema.parse(input);
    const applied: string[] = [];
    for (const ruleSet of bundle.ruleSets) {
      this.upsertRuleSet(ruleSet);
      applied.push(ruleSet.id);
    }
    return { applied };
  }

  listRuleSets(): { id: string; name: string; checks: number; enabled: boolean; version: number; updatedAt: string }[] {
    return this.store.listRuleSets().map((record) => ({
      id: record.definition.id,
      name: record.definition.name,
      checks: record.definition.checks.length,
      enabled: record.definition.enabled,
      version: record.version,
      updatedAt: record.updatedAt,
    }));
  }

  deleteRuleSet(id: string): void {
    this.store.deleteRuleSet(id);
  }

  evaluate(ruleSetId: string, input: unknown): ValidationOutcome {
    const request = evaluateRequestSchema.parse(input);
    const record = this.store.getRuleSet(ruleSetId);
    if (record === null) throw new EngineNotFoundError(`rule set ${ruleSetId} not found`);
    if (!record.definition.enabled) throw new EngineConflictError(`rule set ${ruleSetId} is disabled`);
    const result = evaluate(record.definition.checks, request.fields, record.definition.warnOnly);
    const errors = result.findings.filter((entry) => entry.severity === 'ERROR').length;
    this.store.appendEvaluation({
      id: randomUUID(),
      ruleSetId,
      passed: result.passed,
      errors,
      warnings: result.findings.length - errors,
      createdAt: this.clock().toISOString(),
    });
    this.store.pruneEvaluations(this.retention.maxAgeMs, this.retention.maxCount);
    return {
      passed: result.passed,
      findings: result.findings,
      checksRun: record.definition.checks.length,
      ruleSetVersion: record.version,
    };
  }

  evaluations(ruleSetId: string | null, limit: number, offset: number): EvaluationRecord[] {
    return this.store.listEvaluations(ruleSetId, Math.min(limit, 500), offset);
  }

  stop(): void {
    this.store.close();
  }
}

export class EngineNotFoundError extends Error {}
export class EngineConflictError extends Error {}
export class EngineValidationError extends Error {}
