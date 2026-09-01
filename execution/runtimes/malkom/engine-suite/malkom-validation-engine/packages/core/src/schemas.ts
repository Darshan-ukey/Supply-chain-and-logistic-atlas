import { z } from 'zod';

/**
 * The validation engine's vocabulary. A *rule set* is the unit of
 * configuration: the checks a record must satisfy before it may pass
 * unattended. One substrate, two callers — the automated gate and the
 * human screen evaluate the same rule set, so the two paths cannot drift.
 *
 * The engine owns the checks and the outcome; the host owns the record
 * and what a failure causes.
 */

export const checkSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('required'), field: z.string().min(1).max(80), message: z.string().max(200).optional() }),
  z.object({ kind: z.literal('pattern'), field: z.string().min(1).max(80), pattern: z.string().min(1).max(300), message: z.string().max(200).optional() }),
  z.object({ kind: z.literal('length'), field: z.string().min(1).max(80), min: z.number().int().min(0).default(0), max: z.number().int().min(1).default(4000), message: z.string().max(200).optional() }),
  z.object({ kind: z.literal('range'), field: z.string().min(1).max(80), min: z.number().optional(), max: z.number().optional(), message: z.string().max(200).optional() }),
  z.object({ kind: z.literal('oneOf'), field: z.string().min(1).max(80), values: z.array(z.string().max(120)).min(1).max(500), message: z.string().max(200).optional() }),
  z.object({ kind: z.literal('date'), field: z.string().min(1).max(80), message: z.string().max(200).optional() }),
  /** the field is required only when another field holds one of these values */
  z.object({
    kind: z.literal('requiredWhen'),
    field: z.string().min(1).max(80),
    whenField: z.string().min(1).max(80),
    whenValues: z.array(z.string().max(120)).min(1).max(200),
    message: z.string().max(200).optional(),
  }),
  /** two fields must not hold the same value */
  z.object({ kind: z.literal('differentFrom'), field: z.string().min(1).max(80), otherField: z.string().min(1).max(80), message: z.string().max(200).optional() }),
]);
export type Check = z.infer<typeof checkSchema>;

export const ruleSetDefinitionSchema = z.object({
  id: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/),
  name: z.string().min(1).max(120),
  checks: z.array(checkSchema).max(500).default([]),
  /** failures on these fields are reported but do not block */
  warnOnly: z.array(z.string().min(1).max(80)).max(200).default([]),
  enabled: z.boolean().default(true),
});
export type RuleSetDefinition = z.infer<typeof ruleSetDefinitionSchema>;
export type RuleSetDefinitionInput = z.input<typeof ruleSetDefinitionSchema>;

export const evaluateRequestSchema = z.object({
  fields: z.record(z.string(), z.unknown()).default({}),
});

export interface Finding {
  field: string;
  rule: string;
  message: string;
  severity: 'ERROR' | 'WARN';
}

export interface ValidationOutcome {
  passed: boolean;
  findings: Finding[];
  checksRun: number;
  ruleSetVersion: number;
}

export const configBundleSchema = z.object({
  ruleSets: z.array(ruleSetDefinitionSchema).max(128),
});
export type ConfigBundle = z.infer<typeof configBundleSchema>;
