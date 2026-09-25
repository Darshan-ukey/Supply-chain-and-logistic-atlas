import { randomUUID } from 'node:crypto';
import { answersLearned, emptyArtifact, learn, predict } from './nb.js';
import type { ClassifyStateStore } from './store.js';
import { InMemoryClassifyStateStore } from './store.js';
import {
  configBundleSchema,
  learnRequestSchema,
  modelDefinitionSchema,
  predictRequestSchema,
  type ConfigBundle,
  type DecisionRecord,
  type ModelDefinitionInput,
  type Prediction,
} from './schemas.js';

/**
 * Engine facade — every operation the control plane exposes, as a typed
 * library API. The engine owns learned state and the decision log; the
 * host owns the text and what each answer causes.
 */

export interface ClassificationEngineOptions {
  stateStore?: ClassifyStateStore;
  retention?: { maxAgeMs: number; maxCount: number };
  clock?: () => Date;
}

export class ClassificationEngine {
  private readonly store: ClassifyStateStore;
  private readonly retention: { maxAgeMs: number; maxCount: number };
  private readonly clock: () => Date;

  constructor(options: ClassificationEngineOptions = {}) {
    this.store = options.stateStore ?? new InMemoryClassifyStateStore();
    this.retention = options.retention ?? { maxAgeMs: 30 * 24 * 60 * 60 * 1000, maxCount: 10_000 };
    this.clock = options.clock ?? (() => new Date());
  }

  upsertModel(input: ModelDefinitionInput): { id: string; version: number } {
    const definition = modelDefinitionSchema.parse(input);
    const existing = this.store.getModel(definition.id);
    const record = {
      definition,
      artifact: existing?.artifact ?? emptyArtifact(),
      version: (existing?.version ?? 0) + 1,
      updatedAt: this.clock().toISOString(),
    };
    this.store.putModel(record);
    return { id: definition.id, version: record.version };
  }

  applyConfig(input: unknown): { applied: string[] } {
    const bundle: ConfigBundle = configBundleSchema.parse(input);
    const applied: string[] = [];
    for (const model of bundle.models) {
      this.upsertModel(model);
      applied.push(model.id);
    }
    return { applied };
  }

  listModels(): { id: string; name: string; classes: string[]; enabled: boolean; version: number; answersLearned: number; updatedAt: string }[] {
    return this.store.listModels().map((record) => ({
      id: record.definition.id,
      name: record.definition.name,
      classes: record.definition.classes,
      enabled: record.definition.enabled,
      version: record.version,
      answersLearned: answersLearned(record.artifact),
      updatedAt: record.updatedAt,
    }));
  }

  deleteModel(id: string): void {
    this.store.deleteModel(id);
  }

  predict(modelId: string, input: unknown): Prediction {
    const request = predictRequestSchema.parse(input);
    const record = this.store.getModel(modelId);
    if (record === null) throw new EngineNotFoundError(`model ${modelId} not found`);
    if (!record.definition.enabled) throw new EngineConflictError(`model ${modelId} is disabled`);
    const result = predict(record.artifact, request.text);
    const prediction: Prediction = {
      label: result.label,
      confidence: result.confidence,
      lowConfidence: result.confidence < record.definition.confidenceFloor,
      modelVersion: record.version,
    };
    this.record(modelId, 'predict', prediction.label, prediction.confidence, null);
    return prediction;
  }

  /** Learning IS the update — one answer, one increment, version bump. */
  learn(modelId: string, input: unknown): { learned: true; version: number; answersLearned: number; corrected: boolean | null } {
    const request = learnRequestSchema.parse(input);
    const record = this.store.getModel(modelId);
    if (record === null) throw new EngineNotFoundError(`model ${modelId} not found`);
    if (!record.definition.classes.includes(request.label)) {
      throw new EngineValidationError(`label ${JSON.stringify(request.label)} is not one of the model's classes`);
    }
    const artifact = learn(record.artifact, request.text, request.label);
    const next = { ...record, artifact, version: record.version + 1, updatedAt: this.clock().toISOString() };
    this.store.putModel(next);
    const corrected = request.predictedLabel === undefined ? null : request.predictedLabel !== request.label;
    this.record(modelId, 'learn', request.label, null, corrected);
    return { learned: true, version: next.version, answersLearned: answersLearned(artifact), corrected };
  }

  decisions(modelId: string | null, limit: number, offset: number): DecisionRecord[] {
    return this.store.listDecisions(modelId, Math.min(limit, 500), offset);
  }

  private record(modelId: string, kind: 'predict' | 'learn', label: string, confidence: number | null, corrected: boolean | null): void {
    this.store.appendDecision({
      id: randomUUID(),
      modelId,
      kind,
      label,
      confidence,
      corrected,
      createdAt: this.clock().toISOString(),
    });
    this.store.pruneDecisions(this.retention.maxAgeMs, this.retention.maxCount);
  }

  stop(): void {
    this.store.close();
  }
}

export class EngineNotFoundError extends Error {}
export class EngineConflictError extends Error {}
export class EngineValidationError extends Error {}
