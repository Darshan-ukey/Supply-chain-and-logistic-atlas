import { randomUUID } from 'node:crypto';
import { missingMandatory, sampled } from './sampling.js';
import type { QualityStateStore } from './store.js';
import { InMemoryQualityStateStore } from './store.js';
import {
  completeReviewSchema,
  configBundleSchema,
  decideRequestSchema,
  openReviewSchema,
  streamDefinitionSchema,
  type AuditDecision,
  type ConfigBundle,
  type ReviewRecord,
  type StreamDefinitionInput,
  type StreamSummary,
} from './schemas.js';

/**
 * Engine facade — every operation the control plane exposes, as a typed
 * library API. The engine owns the audit decision, the review ledger, and
 * the pass-rate summaries; the host owns the items and what a failed
 * review causes.
 */

export interface QualityEngineOptions {
  stateStore?: QualityStateStore;
  clock?: () => Date;
}

export class QualityEngine {
  private readonly store: QualityStateStore;
  private readonly clock: () => Date;

  constructor(options: QualityEngineOptions = {}) {
    this.store = options.stateStore ?? new InMemoryQualityStateStore();
    this.clock = options.clock ?? (() => new Date());
  }

  upsertStream(input: StreamDefinitionInput): { id: string; version: number } {
    const definition = streamDefinitionSchema.parse(input);
    const existing = this.store.getStream(definition.id);
    const record = {
      definition,
      version: (existing?.version ?? 0) + 1,
      updatedAt: this.clock().toISOString(),
    };
    this.store.putStream(record);
    return { id: definition.id, version: record.version };
  }

  applyConfig(input: unknown): { applied: string[] } {
    const bundle: ConfigBundle = configBundleSchema.parse(input);
    const applied: string[] = [];
    for (const stream of bundle.streams) {
      this.upsertStream(stream);
      applied.push(stream.id);
    }
    return { applied };
  }

  listStreams(): { id: string; name: string; samplingPercent: number; mandatoryFields: string[]; enabled: boolean; version: number; updatedAt: string }[] {
    return this.store.listStreams().map((record) => ({
      id: record.definition.id,
      name: record.definition.name,
      samplingPercent: record.definition.samplingPercent,
      mandatoryFields: record.definition.mandatoryFields,
      enabled: record.definition.enabled,
      version: record.version,
      updatedAt: record.updatedAt,
    }));
  }

  deleteStream(id: string): void {
    this.store.deleteStream(id);
  }

  /** Deterministic: the same item always gets the same decision. */
  decide(streamId: string, input: unknown): AuditDecision {
    const request = decideRequestSchema.parse(input);
    const record = this.store.getStream(streamId);
    if (record === null) throw new EngineNotFoundError(`stream ${streamId} not found`);
    if (!record.definition.enabled) throw new EngineConflictError(`stream ${streamId} is disabled`);
    const reasons: string[] = [];
    const missing = missingMandatory(request.fields, record.definition.mandatoryFields);
    for (const key of missing) reasons.push(`missing:${key}`);
    if (sampled(streamId, request.itemId, record.definition.samplingPercent)) reasons.push('sampled');
    return { audit: reasons.length > 0, reasons, streamVersion: record.version };
  }

  openReview(input: unknown): ReviewRecord {
    const request = openReviewSchema.parse(input);
    if (this.store.getStream(request.streamId) === null) {
      throw new EngineNotFoundError(`stream ${request.streamId} not found`);
    }
    const record: ReviewRecord = {
      id: randomUUID(),
      streamId: request.streamId,
      itemId: request.itemId,
      status: 'OPEN',
      outcome: null,
      notes: null,
      fieldErrors: [],
      openedAt: this.clock().toISOString(),
      completedAt: null,
    };
    this.store.putReview(record);
    return record;
  }

  completeReview(reviewId: string, input: unknown): ReviewRecord {
    const request = completeReviewSchema.parse(input);
    const existing = this.store.getReview(reviewId);
    if (existing === null) throw new EngineNotFoundError(`review ${reviewId} not found`);
    if (existing.status === 'DONE') throw new EngineConflictError(`review ${reviewId} is already complete`);
    const record: ReviewRecord = {
      ...existing,
      status: 'DONE',
      outcome: request.outcome,
      notes: request.notes ?? null,
      fieldErrors: request.fieldErrors,
      completedAt: this.clock().toISOString(),
    };
    this.store.putReview(record);
    return record;
  }

  reviews(streamId: string | null, status: 'OPEN' | 'DONE' | null, limit: number, offset: number): ReviewRecord[] {
    return this.store.listReviews(streamId, status, Math.min(limit, 500), offset);
  }

  summary(streamId: string): StreamSummary {
    if (this.store.getStream(streamId) === null) throw new EngineNotFoundError(`stream ${streamId} not found`);
    const counts = this.store.countReviews(streamId);
    const decided = counts.passed + counts.failed;
    return {
      streamId,
      ...counts,
      passRate: decided === 0 ? null : Math.round((counts.passed / decided) * 1000) / 10,
    };
  }

  stop(): void {
    this.store.close();
  }
}

export class EngineNotFoundError extends Error {}
export class EngineConflictError extends Error {}
export class EngineValidationError extends Error {}
