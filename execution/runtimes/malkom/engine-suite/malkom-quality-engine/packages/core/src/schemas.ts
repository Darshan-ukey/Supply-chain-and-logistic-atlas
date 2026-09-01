import { z } from 'zod';

/**
 * The quality engine's vocabulary. A *stream* is the unit of configuration:
 * the sampling percentage applied to items flowing through it and the
 * fields that must be present for an item to skip review. The engine owns
 * the audit decision, the review ledger, and the pass-rate summaries; the
 * host owns the items and what a failed review causes.
 */

export const streamDefinitionSchema = z.object({
  id: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/),
  name: z.string().min(1).max(120),
  /** percentage of items sampled for review, decided deterministically per item */
  samplingPercent: z.number().min(0).max(100).default(0),
  /** items missing any of these fields are always sent to review */
  mandatoryFields: z.array(z.string().min(1).max(80)).max(128).default([]),
  enabled: z.boolean().default(true),
});
export type StreamDefinition = z.infer<typeof streamDefinitionSchema>;
export type StreamDefinitionInput = z.input<typeof streamDefinitionSchema>;

export const decideRequestSchema = z.object({
  itemId: z.string().min(1).max(200),
  fields: z.record(z.string(), z.unknown()).default({}),
});
export type DecideRequest = z.infer<typeof decideRequestSchema>;

export interface AuditDecision {
  audit: boolean;
  reasons: string[];
  streamVersion: number;
}

export const reviewOutcomeSchema = z.enum(['PASS', 'FAIL']);

export const openReviewSchema = z.object({
  streamId: z.string().min(1).max(64),
  itemId: z.string().min(1).max(200),
});

export const completeReviewSchema = z.object({
  outcome: reviewOutcomeSchema,
  notes: z.string().max(2000).optional(),
  /** field keys the reviewer marked wrong */
  fieldErrors: z.array(z.string().min(1).max(80)).max(128).default([]),
});

export interface ReviewRecord {
  id: string;
  streamId: string;
  itemId: string;
  status: 'OPEN' | 'DONE';
  outcome: 'PASS' | 'FAIL' | null;
  notes: string | null;
  fieldErrors: string[];
  openedAt: string;
  completedAt: string | null;
}

export interface StreamSummary {
  streamId: string;
  open: number;
  done: number;
  passed: number;
  failed: number;
  passRate: number | null;
}

export const configBundleSchema = z.object({
  streams: z.array(streamDefinitionSchema).max(128),
});
export type ConfigBundle = z.infer<typeof configBundleSchema>;
