import { z } from 'zod';

/**
 * The classification engine's vocabulary. A *model* is the unit of
 * configuration: which stream it serves (its id), which classes it may
 * answer with, and its learning behaviour. The engine owns the learned
 * state and the decisions; the host owns the text and what to do with
 * each answer.
 */

export const modelDefinitionSchema = z.object({
  id: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/),
  name: z.string().min(1).max(120),
  /** the closed set of answers this model may give */
  classes: z.array(z.string().min(1).max(80)).min(2).max(64),
  /** ONLINE_NB: multinomial naive bayes, learns from every answer */
  algorithm: z.literal('ONLINE_NB').default('ONLINE_NB'),
  /** answers below this confidence are returned but flagged low-confidence */
  confidenceFloor: z.number().min(0).max(100).default(0),
  enabled: z.boolean().default(true),
});
export type ModelDefinition = z.infer<typeof modelDefinitionSchema>;
export type ModelDefinitionInput = z.input<typeof modelDefinitionSchema>;

export const learnRequestSchema = z.object({
  text: z.string().min(1).max(20_000),
  label: z.string().min(1).max(80),
  /** what the model predicted before the human decided — correction tracking */
  predictedLabel: z.string().max(80).optional(),
});
export type LearnRequest = z.infer<typeof learnRequestSchema>;

export const predictRequestSchema = z.object({
  text: z.string().min(1).max(20_000),
});

export interface Prediction {
  label: string;
  confidence: number;
  lowConfidence: boolean;
  modelVersion: number;
}

export interface DecisionRecord {
  id: string;
  modelId: string;
  kind: 'predict' | 'learn';
  label: string;
  confidence: number | null;
  corrected: boolean | null;
  createdAt: string;
}

export const configBundleSchema = z.object({
  models: z.array(modelDefinitionSchema).max(128),
});
export type ConfigBundle = z.infer<typeof configBundleSchema>;
