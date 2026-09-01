import { randomUUID } from 'node:crypto';
import { extractFields } from './patterns.js';
import type { ExtractStateStore } from './store.js';
import { InMemoryExtractStateStore } from './store.js';
import {
  configBundleSchema,
  extractorDefinitionSchema,
  extractRequestSchema,
  type ConfigBundle,
  type ExtractionResult,
  type ExtractorDefinitionInput,
  type RunRecord,
} from './schemas.js';

/**
 * Engine facade — every operation the control plane exposes, as a typed
 * library API. The engine owns the pattern knowledge, extractor
 * definitions, and the run log; the host owns the text and the record
 * the extracted fields land in.
 */

export interface ExtractionEngineOptions {
  stateStore?: ExtractStateStore;
  retention?: { maxAgeMs: number; maxCount: number };
  clock?: () => Date;
}

export class ExtractionEngine {
  private readonly store: ExtractStateStore;
  private readonly retention: { maxAgeMs: number; maxCount: number };
  private readonly clock: () => Date;

  constructor(options: ExtractionEngineOptions = {}) {
    this.store = options.stateStore ?? new InMemoryExtractStateStore();
    this.retention = options.retention ?? { maxAgeMs: 30 * 24 * 60 * 60 * 1000, maxCount: 10_000 };
    this.clock = options.clock ?? (() => new Date());
  }

  upsertExtractor(input: ExtractorDefinitionInput): { id: string; version: number } {
    const definition = extractorDefinitionSchema.parse(input);
    const existing = this.store.getExtractor(definition.id);
    const record = {
      definition,
      version: (existing?.version ?? 0) + 1,
      updatedAt: this.clock().toISOString(),
    };
    this.store.putExtractor(record);
    return { id: definition.id, version: record.version };
  }

  applyConfig(input: unknown): { applied: string[] } {
    const bundle: ConfigBundle = configBundleSchema.parse(input);
    const applied: string[] = [];
    for (const extractor of bundle.extractors) {
      this.upsertExtractor(extractor);
      applied.push(extractor.id);
    }
    return { applied };
  }

  listExtractors(): { id: string; name: string; fields: number; enabled: boolean; version: number; updatedAt: string }[] {
    return this.store.listExtractors().map((record) => ({
      id: record.definition.id,
      name: record.definition.name,
      fields: record.definition.fields.length,
      enabled: record.definition.enabled,
      version: record.version,
      updatedAt: record.updatedAt,
    }));
  }

  deleteExtractor(id: string): void {
    this.store.deleteExtractor(id);
  }

  extract(extractorId: string, input: unknown): ExtractionResult {
    const request = extractRequestSchema.parse(input);
    const record = this.store.getExtractor(extractorId);
    if (record === null) throw new EngineNotFoundError(`extractor ${extractorId} not found`);
    if (!record.definition.enabled) throw new EngineConflictError(`extractor ${extractorId} is disabled`);
    const result = extractFields(
      request.text,
      record.definition.fields,
      request.existing,
      record.definition.fieldHints,
      record.definition.confidenceFloor,
    );
    this.recordRun(extractorId, result.extracted, record.definition.fields.length);
    return { ...result, extractorVersion: record.version };
  }

  runs(extractorId: string | null, limit: number, offset: number): RunRecord[] {
    return this.store.listRuns(extractorId, Math.min(limit, 500), offset);
  }

  private recordRun(extractorId: string, extracted: number, fieldsRequested: number): void {
    this.store.appendRun({
      id: randomUUID(),
      extractorId,
      extracted,
      fieldsRequested,
      createdAt: this.clock().toISOString(),
    });
    this.store.pruneRuns(this.retention.maxAgeMs, this.retention.maxCount);
  }

  stop(): void {
    this.store.close();
  }
}

export class EngineNotFoundError extends Error {}
export class EngineConflictError extends Error {}
export class EngineValidationError extends Error {}
