import { z } from 'zod';

/**
 * The extraction engine's vocabulary. An *extractor* is the unit of
 * configuration: the field schema it fills, per-field hints (a label alias
 * or a /regex/ with one capture group), and the confidence floor below
 * which a hit is discarded. The engine owns the pattern knowledge and the
 * run log; the host owns the text and the record the fields land in.
 */

export const fieldDefinitionSchema = z.object({
  key: z.string().min(1).max(80),
  label: z.string().min(1).max(120),
  type: z.string().min(1).max(40).default('text'),
});
export type FieldDefinition = z.infer<typeof fieldDefinitionSchema>;

export const extractorDefinitionSchema = z.object({
  id: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/),
  name: z.string().min(1).max(120),
  fields: z.array(fieldDefinitionSchema).min(1).max(256),
  /** per-field override: "/regex with (capture)/" or a label alias */
  fieldHints: z.record(z.string(), z.string().max(500)).default({}),
  /** hits below this confidence (0..1) are discarded */
  confidenceFloor: z.number().min(0).max(1).default(0),
  enabled: z.boolean().default(true),
});
export type ExtractorDefinition = z.infer<typeof extractorDefinitionSchema>;
export type ExtractorDefinitionInput = z.input<typeof extractorDefinitionSchema>;

export const extractRequestSchema = z.object({
  text: z.string().min(1).max(200_000),
  /** already-known values — never overwritten */
  existing: z.record(z.string(), z.unknown()).default({}),
});
export type ExtractRequest = z.infer<typeof extractRequestSchema>;

export interface ExtractionResult {
  fields: Record<string, string | number>;
  confidence: Record<string, number>;
  extracted: number;
  extractorVersion: number;
}

export interface RunRecord {
  id: string;
  extractorId: string;
  extracted: number;
  fieldsRequested: number;
  createdAt: string;
}

export const configBundleSchema = z.object({
  extractors: z.array(extractorDefinitionSchema).max(128),
});
export type ConfigBundle = z.infer<typeof configBundleSchema>;
